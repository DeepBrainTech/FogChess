import { promises as fs } from 'fs';
import path from 'path';

export interface ExperienceLog {
  gameId: string;
  timestamp: string;
  players: Array<{ name: string; color: 'white' | 'black'; role: 'human' | 'ai' }>;
  source: 'human-vs-ai' | 'self-play';
  moveHistory: unknown[];
  decisions: unknown[];
  result: 'white' | 'black' | 'draw' | null;
  gameOverReason: string;
}

export interface ExperienceBufferOptions {
  maxGames?: number;
  maxDecisions?: number;
  maxFileBytes?: number;
  retainedFileBytes?: number;
  filePath?: string;
}

export class ExperienceBuffer {
  private readonly maxGames: number;
  private readonly maxDecisions: number;
  private readonly maxFileBytes: number;
  private readonly retainedFileBytes: number;
  private readonly filePath: string;
  private readonly games: ExperienceLog[] = [];

  constructor(options: ExperienceBufferOptions = {}) {
    this.maxGames = options.maxGames ?? 200;
    this.maxDecisions = options.maxDecisions ?? 20000;
    this.maxFileBytes = options.maxFileBytes ?? 32 * 1024 * 1024;
    this.retainedFileBytes = Math.min(
      options.retainedFileBytes ?? 24 * 1024 * 1024,
      this.maxFileBytes
    );
    this.filePath = options.filePath ||
      path.resolve(__dirname, '../../data/experience/games.jsonl');
  }

  async append(log: ExperienceLog): Promise<void> {
    this.games.push(log);
    this.prune();
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.appendFile(this.filePath, `${JSON.stringify(log)}\n`, 'utf8');
    await this.compactFileIfNeeded();
  }

  list(): ExperienceLog[] {
    return this.games.map(log => JSON.parse(JSON.stringify(log)) as ExperienceLog);
  }

  async clear(): Promise<void> {
    this.games.length = 0;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, '', 'utf8');
  }

  async export(destinationPath?: string): Promise<string> {
    const content = this.games.map(log => JSON.stringify(log)).join('\n');
    if (destinationPath) {
      await fs.mkdir(path.dirname(destinationPath), { recursive: true });
      await fs.writeFile(destinationPath, content ? `${content}\n` : '', 'utf8');
    }
    return content;
  }

  getStoragePath(): string {
    return this.filePath;
  }

  private prune(): void {
    while (this.games.length > this.maxGames) this.games.shift();
    let decisions = this.games.reduce((sum, game) => sum + game.decisions.length, 0);
    while (this.games.length && decisions > this.maxDecisions) {
      decisions -= this.games[0].decisions.length;
      this.games.shift();
    }
  }

  private async compactFileIfNeeded(): Promise<void> {
    const stats = await fs.stat(this.filePath).catch(() => null);
    if (!stats || stats.size <= this.maxFileBytes) return;
    const bytesToRead = Math.min(stats.size, this.retainedFileBytes);
    const handle = await fs.open(this.filePath, 'r');
    const buffer = Buffer.alloc(bytesToRead);
    try {
      await handle.read(buffer, 0, bytesToRead, stats.size - bytesToRead);
    } finally {
      await handle.close();
    }
    let recentLogs = buffer.toString('utf8');
    if (bytesToRead < stats.size) {
      const firstNewline = recentLogs.indexOf('\n');
      recentLogs = firstNewline >= 0 ? recentLogs.slice(firstNewline + 1) : '';
    }
    const temporaryPath = `${this.filePath}.compact`;
    await fs.writeFile(temporaryPath, recentLogs, 'utf8');
    await fs.rename(temporaryPath, this.filePath);
  }
}

export const DEFAULT_EXPERIENCE_BUFFER = new ExperienceBuffer();
