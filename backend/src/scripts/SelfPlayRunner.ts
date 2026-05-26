import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_AI_CONFIG, loadSavedBestConfig } from '../ai/AiConfig';
import { ExperienceBuffer } from '../ai/ExperienceBuffer';
import { ExperienceLogger } from '../ai/ExperienceLogger';
import { SableFowAI } from '../ai/SableFowAI';
import type { AiColor } from '../ai/types';
import { ChessService } from '../services/ChessService';

export interface SelfPlayOptions {
  games: number;
  maxPlies: number;
  useStockfish: boolean;
}

function optionNumber(name: string, fallback: number): number {
  const match = process.argv.find(argument => argument.startsWith(`--${name}=`));
  const parsed = match ? Number(match.split('=')[1]) : fallback;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function optionsFromArgs(): SelfPlayOptions {
  return {
    games: optionNumber('games', 1),
    maxPlies: optionNumber('max-plies', 80),
    useStockfish: process.argv.includes('--stockfish')
  };
}

async function runGame(index: number, options: SelfPlayOptions, logger: ExperienceLogger): Promise<void> {
  const gameId = `self-play-${Date.now()}-${index}-${uuidv4()}`;
  const chess = new ChessService();
  let state = chess.createNewGame();
  state.gameStatus = 'playing';
  const best = loadSavedBestConfig()?.configWeights || DEFAULT_AI_CONFIG;
  const white = new SableFowAI({ ...best, useStockfish: options.useStockfish });
  const black = new SableFowAI({ ...best, useStockfish: options.useStockfish });
  logger.beginGame(gameId, [
    { name: 'SABLE-White', color: 'white', role: 'ai' },
    { name: 'SABLE-Black', color: 'black', role: 'ai' }
  ], 'self-play');

  for (let ply = 1; ply <= options.maxPlies && state.gameStatus === 'playing'; ply++) {
    const color: AiColor = state.currentPlayer;
    const ai = color === 'white' ? white : black;
    const result = await ai.getBestMove(state, color, `${gameId}:${color}`);
    if (!result.move) {
      state.gameStatus = 'finished';
      state.winner = 'draw';
      await logger.finishGame(gameId, state.moveHistory, 'draw', 'no-legal-move');
      return;
    }
    const piece = chess.getPieceAtSquare(result.move.from);
    const executed = chess.makeMove({
      ...result.move,
      piece,
      promotion: result.move.promotion as 'q' | 'r' | 'b' | 'n' | undefined
    });
    if (!executed.success || !executed.gameState) {
      state.gameStatus = 'finished';
      state.winner = color === 'white' ? 'black' : 'white';
      await logger.finishGame(gameId, state.moveHistory, state.winner, 'illegal-ai-move');
      return;
    }
    state = executed.gameState;
    logger.recordDecision(gameId, color, ply, result);
  }

  if (state.gameStatus !== 'finished') {
    state.gameStatus = 'finished';
    state.winner = 'draw';
    await logger.finishGame(gameId, state.moveHistory, 'draw', 'max-plies');
  } else {
    await logger.finishGame(gameId, state.moveHistory, state.winner || null, 'king-captured');
  }
}

export async function runSelfPlayGames(options: SelfPlayOptions): Promise<string> {
  const buffer = new ExperienceBuffer();
  const logger = new ExperienceLogger(buffer);
  for (let game = 1; game <= options.games; game++) {
    await runGame(game, options, logger);
  }
  return buffer.getStoragePath();
}

async function main(): Promise<void> {
  const options = optionsFromArgs();
  const savedTo = await runSelfPlayGames(options);
  console.log(JSON.stringify({
    games: options.games,
    maxPlies: options.maxPlies,
    useStockfish: options.useStockfish,
    savedTo
  }));
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}
