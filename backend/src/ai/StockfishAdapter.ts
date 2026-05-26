import type { AiMove } from './types';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';

export interface StockfishEvaluationOptions {
  depth: number;
  timeLimitMs: number;
  evaluationKey?: string;
  heuristicFallback?: () => number;
}

export interface StockfishEvaluation {
  centipawns: number;
  mateIn?: number;
  source: 'stockfish' | 'heuristic-fallback';
  available: boolean;
  cacheHit: boolean;
}

export interface StockfishAdapter {
  readonly available: boolean;
  evaluatePosition(boardOrFen: string, options: StockfishEvaluationOptions): Promise<StockfishEvaluation>;
  evaluateMove(boardOrFen: string, move: AiMove, options: StockfishEvaluationOptions): Promise<StockfishEvaluation>;
  clearCache(): void;
}

export class HeuristicFallbackStockfishAdapter implements StockfishAdapter {
  readonly available = false;
  private readonly cache = new Map<string, StockfishEvaluation>();

  constructor(private readonly maxCacheEntries = 1000) {}

  async evaluatePosition(boardOrFen: string, options: StockfishEvaluationOptions): Promise<StockfishEvaluation> {
    return this.evaluateCached(
      `position:${boardOrFen}:${options.depth}:${options.timeLimitMs}:${options.evaluationKey || ''}`,
      options
    );
  }

  async evaluateMove(boardOrFen: string, move: AiMove, options: StockfishEvaluationOptions): Promise<StockfishEvaluation> {
    return this.evaluateCached(
      `move:${boardOrFen}:${move.from}${move.to}${move.promotion || ''}:${options.depth}:${options.timeLimitMs}:${options.evaluationKey || ''}`,
      options
    );
  }

  clearCache(): void {
    this.cache.clear();
  }

  private evaluateCached(key: string, options: StockfishEvaluationOptions): StockfishEvaluation {
    const cached = this.cache.get(key);
    if (cached) return { ...cached, cacheHit: true };
    const raw = options.heuristicFallback ? options.heuristicFallback() : 0;
    const result: StockfishEvaluation = {
      centipawns: Number.isFinite(raw) ? raw * 100 : 0,
      source: 'heuristic-fallback',
      available: false,
      cacheHit: false
    };
    if (this.cache.size >= this.maxCacheEntries) {
      const oldest = this.cache.keys().next().value as string | undefined;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(key, result);
    return result;
  }
}

/**
 * Serializes bounded UCI searches through an isolated Stockfish 18 Lite WASM
 * process. Inputs must be belief hypotheses, never the hidden source board.
 */
export class NodeStockfishAdapter implements StockfishAdapter {
  readonly available = true;
  private readonly cache = new Map<string, StockfishEvaluation>();
  private enginePromise?: Promise<ChildProcessWithoutNullStreams>;
  private engine?: ChildProcessWithoutNullStreams;
  private lineListener?: (line: string) => void;
  private lineBuffer = '';
  private workQueue: Promise<void> = Promise.resolve();
  private activeReject?: (reason?: unknown) => void;

  constructor(private readonly maxCacheEntries = 1000) {}

  async evaluatePosition(boardOrFen: string, options: StockfishEvaluationOptions): Promise<StockfishEvaluation> {
    return this.evaluateCached(
      `position:${boardOrFen}:${options.depth}:${options.timeLimitMs}:${options.evaluationKey || ''}`,
      boardOrFen,
      undefined,
      options
    );
  }

  async evaluateMove(boardOrFen: string, move: AiMove, options: StockfishEvaluationOptions): Promise<StockfishEvaluation> {
    return this.evaluateCached(
      `move:${boardOrFen}:${move.from}${move.to}${move.promotion || ''}:${options.depth}:${options.timeLimitMs}:${options.evaluationKey || ''}`,
      boardOrFen,
      move,
      options
    );
  }

  clearCache(): void {
    this.cache.clear();
  }

  private async evaluateCached(
    key: string,
    fen: string,
    move: AiMove | undefined,
    options: StockfishEvaluationOptions
  ): Promise<StockfishEvaluation> {
    const cached = this.cache.get(key);
    if (cached) return { ...cached, cacheHit: true };
    if (!this.hasBothKings(fen)) return this.fallback(key, options);

    try {
      let result: StockfishEvaluation | undefined;
      const job = async () => {
        result = await this.search(fen, move, options);
      };
      const running = this.workQueue.then(job, job);
      this.workQueue = running.then(() => undefined, () => undefined);
      await running;
      if (!result) return this.fallback(key, options);
      this.remember(key, result);
      return result;
    } catch {
      return this.fallback(key, options);
    }
  }

  private async search(
    fen: string,
    move: AiMove | undefined,
    options: StockfishEvaluationOptions
  ): Promise<StockfishEvaluation> {
    const engine = await this.getEngine();
    const uciMove = move ? `${move.from}${move.to}${move.promotion || ''}` : '';
    const command = uciMove ? `position fen ${fen} moves ${uciMove}` : `position fen ${fen}`;
    return new Promise((resolve, reject) => {
      let centipawns = 0;
      let mateIn: number | undefined;
      let finished = false;
      const complete = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        this.clearActiveReject(reject);
        const perspective = move ? -1 : 1;
        resolve({
          centipawns: perspective * centipawns,
          mateIn: mateIn === undefined ? undefined : perspective * mateIn,
          source: 'stockfish',
          available: true,
          cacheHit: false
        });
      };
      this.lineListener = line => {
        const score = line.match(/\bscore (cp|mate) (-?\d+)/);
        if (score) {
          if (score[1] === 'cp') centipawns = Number(score[2]);
          else {
            mateIn = Number(score[2]);
            centipawns = Math.sign(mateIn || 1) * 100000;
          }
        }
        if (line.startsWith('bestmove')) complete();
      };
      this.activeReject = reject;
      const timeout = setTimeout(() => {
        this.clearActiveReject(reject);
        this.destroyEngine();
        reject(new Error('Stockfish search timeout'));
      }, Math.max(options.timeLimitMs + 250, 300));
      this.send(engine, command);
      this.send(engine, `go depth ${Math.max(1, options.depth)} movetime ${Math.max(10, options.timeLimitMs)}`);
    });
  }

  private async getEngine(): Promise<ChildProcessWithoutNullStreams> {
    if (!this.enginePromise) {
      this.enginePromise = this.startEngine();
    }
    return this.enginePromise;
  }

  private async startEngine(): Promise<ChildProcessWithoutNullStreams> {
    const enginePath = require.resolve('stockfish/bin/stockfish-18-lite-single.js');
    const engine = spawn(process.execPath, [enginePath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    this.engine = engine;
    engine.stdout.setEncoding('utf8');
    engine.stdout.on('data', (chunk: string) => this.handleOutput(chunk));
    engine.stderr.on('data', () => undefined);
    engine.stdin.on('error', error => this.handleEngineFailure(engine, error));
    engine.once('error', error => this.handleEngineFailure(engine, error));
    engine.once('exit', (code, signal) => this.handleEngineFailure(
      engine,
      new Error(`Stockfish process exited (${code ?? signal ?? 'unknown'})`)
    ));
    process.once('exit', () => {
      if (this.engine === engine) engine.kill();
    });
    await this.waitFor(engine, 'uci', line => line === 'uciok');
    this.send(engine, 'setoption name Threads value 1');
    this.send(engine, 'setoption name Hash value 16');
    await this.waitFor(engine, 'isready', line => line === 'readyok');
    return engine;
  }

  private waitFor(
    engine: ChildProcessWithoutNullStreams,
    command: string,
    predicate: (line: string) => boolean
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.clearActiveReject(reject);
        this.destroyEngine();
        reject(new Error('Stockfish startup timeout'));
      }, 5000);
      this.activeReject = reject;
      this.lineListener = line => {
        if (predicate(line)) {
          clearTimeout(timeout);
          this.clearActiveReject(reject);
          resolve();
        }
      };
      this.send(engine, command);
    });
  }

  private send(engine: ChildProcessWithoutNullStreams, command: string): void {
    if (this.engine !== engine || engine.killed || engine.stdin.destroyed || !engine.stdin.writable) {
      this.handleEngineFailure(engine, new Error('Stockfish input stream is unavailable'));
      return;
    }
    try {
      engine.stdin.write(`${command}\n`, error => {
        if (error) this.handleEngineFailure(engine, error);
      });
    } catch (error) {
      this.handleEngineFailure(engine, error instanceof Error ? error : new Error(String(error)));
    }
  }

  private handleOutput(chunk: string): void {
    this.lineBuffer += chunk;
    const lines = this.lineBuffer.split(/\r?\n/);
    this.lineBuffer = lines.pop() || '';
    for (const line of lines) this.lineListener?.(line.trim());
  }

  private destroyEngine(): void {
    this.lineListener = undefined;
    this.lineBuffer = '';
    const engine = this.engine;
    this.engine = undefined;
    this.enginePromise = undefined;
    if (engine && !engine.killed) engine.kill();
  }

  private handleEngineFailure(engine: ChildProcessWithoutNullStreams, error: Error): void {
    if (this.engine !== engine) return;
    const reject = this.activeReject;
    this.activeReject = undefined;
    this.destroyEngine();
    reject?.(error);
  }

  private clearActiveReject(reject: (reason?: unknown) => void): void {
    if (this.activeReject === reject) this.activeReject = undefined;
  }

  private hasBothKings(fen: string): boolean {
    const placement = fen.split(' ')[0] || '';
    return (placement.match(/K/g) || []).length === 1 && (placement.match(/k/g) || []).length === 1;
  }

  private fallback(key: string, options: StockfishEvaluationOptions): StockfishEvaluation {
    const raw = options.heuristicFallback ? options.heuristicFallback() : 0;
    const result: StockfishEvaluation = {
      centipawns: Number.isFinite(raw) ? raw * 100 : 0,
      source: 'heuristic-fallback',
      available: false,
      cacheHit: false
    };
    this.remember(key, result);
    return result;
  }

  private remember(key: string, result: StockfishEvaluation): void {
    if (this.cache.size >= this.maxCacheEntries) {
      const oldest = this.cache.keys().next().value as string | undefined;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(key, result);
  }
}

export const SHARED_STOCKFISH_ADAPTER = new NodeStockfishAdapter();
