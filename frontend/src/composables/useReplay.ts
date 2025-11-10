import { computed, ref, watch, type WatchSource } from 'vue';
import type { GameState, Move } from '../types';
import { replayService } from '../services/replay';
import { animationService } from '../services/animation';
import { useGameStore } from '../stores/game';
import { audioService } from '../services/audio';

export function useReplay(
  gameStateSource: WatchSource<GameState | null>,
  currentPlayerColorSource: WatchSource<'white' | 'black' | null>
) {
  const gameStore = useGameStore();

  const currentMoveIndex = ref(0);
  const totalMoves = computed(() => ((gameStateSource as any).value?.moveHistory || []).length);
  const getMoves = () => ((gameStateSource as any).value?.moveHistory || []) as Move[];

  const goToStart = async () => {
    const moves = getMoves();
    if (moves.length === 0) return;
    const previousIndex = currentMoveIndex.value;
    if (previousIndex === 0) return;

    currentMoveIndex.value = 0;
    await updateBoardForMoves(currentMoveIndex.value);
    playReplaySound(moves, previousIndex - 1);
  };

  const stepBackward = async () => {
    const moves = getMoves();
    if (moves.length === 0) return;
    if (currentMoveIndex.value > 0) {
      const prevIndex = currentMoveIndex.value;
      currentMoveIndex.value -= 1;
      await updateBoardForMoves(currentMoveIndex.value);

      playReplaySound(moves, prevIndex - 1);
    }
  };

  const stepForward = async () => {
    if (currentMoveIndex.value < totalMoves.value) {
      const moves = getMoves();
      const newIndex = currentMoveIndex.value + 1;
      currentMoveIndex.value = newIndex;

      if (newIndex === totalMoves.value) {
        gameStore.setReplayState(null);
      } else {
        await updateBoardForMoves(newIndex);
      }

      playReplaySound(moves, newIndex - 1);
    }
  };

  const goToEnd = () => {
    const moves = getMoves();
    if (moves.length === 0) return;
    if (currentMoveIndex.value === totalMoves.value) return;
    currentMoveIndex.value = totalMoves.value;
    gameStore.setReplayState(null);

    playReplaySound(moves, moves.length - 1);
  };

  async function updateBoardForMoves(movesApplied: number) {
    const gs = (gameStateSource as any).value as GameState | null;
    if (!gs) return;
    const moves: Move[] = gs.moveHistory || [];
    const upToIndex = Math.min(moves.length, movesApplied);

    // 如果是从历史状态前进，播放动画
    if (movesApplied > 0 && currentMoveIndex.value < movesApplied) {
      const movesToAnimate = moves.slice(currentMoveIndex.value, upToIndex);
      const animationMoves = movesToAnimate.map(m => ({ from: m.from, to: m.to }));
      if (animationMoves.length > 0) {
        await animationService.animateMoves(animationMoves, { duration: 150 });
      }
    }

    const boardPart = (replayService.constructor as any).reconstructBoardFromMoves(moves, upToIndex);
    gameStore.setReplayState({ board: boardPart });
  }

  // 当对手有新一步时且当前不在最新，回到最新
  watch(gameStateSource, (gs) => {
    const latestMoves = (gs?.moveHistory || []).length;
    if (currentMoveIndex.value !== latestMoves && latestMoves > 0) {
      const latestMove = gs?.moveHistory?.[latestMoves - 1];
      const myColor = (currentPlayerColorSource as any).value as 'white' | 'black' | null;
      if (latestMove && myColor && latestMove.player !== myColor) {
        currentMoveIndex.value = latestMoves;
        gameStore.setReplayState(null);
      }
    }
  });

  return {
    currentMoveIndex,
    totalMoves,
    goToStart,
    stepBackward,
    stepForward,
    goToEnd,
    updateBoardForMoves
  };
}

function playReplaySound(moves: Move[], moveIndex: number) {
  if (moveIndex < 0 || moveIndex >= moves.length) return;
  if (isCaptureMove(moves, moveIndex)) {
    audioService.playCaptureSound();
  } else {
    audioService.playMoveSound();
  }
}

export function isCaptureMove(
  moves: Move[],
  moveIndex: number,
  initialBoardPart?: string
): boolean {
  const move = moves[moveIndex];
  if (!move) return false;
  if (move.captured && String(move.captured).trim().length > 0) {
    return true;
  }

  try {
    const boardBefore = getBoardMatrixForMoves(moves, moveIndex, initialBoardPart);
    if (!boardBefore) return false;

    const { row, col } = notationToCoords(move.to);
    const targetPiece = boardBefore?.[row]?.[col];
    if (targetPiece) {
      return true;
    }

    const isPawn = (move.piece || '').toLowerCase() === 'p';
    const fileChanged = move.from?.[0] && move.to?.[0] && move.from[0] !== move.to[0];
    if (isPawn && fileChanged) {
      // 兵斜走到空格：只可能是过路兵吃子
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

export function getBoardMatrixForMoves(
  moves: Move[],
  upToIndex: number,
  initialBoardPart?: string
): (string | null)[][] | null {
  try {
    const clamped = Math.max(0, Math.min(moves.length, upToIndex));
    const boardPart = (replayService.constructor as any).reconstructBoardFromMoves(
      moves,
      clamped,
      initialBoardPart
    );
    return boardPartToMatrix(boardPart);
  } catch {
    return null;
  }
}

function boardPartToMatrix(boardPart: string): (string | null)[][] {
  const rows = boardPart.split('/');
  const matrix: (string | null)[][] = [];

  for (let r = 0; r < 8; r++) {
    const row: (string | null)[] = [];
    const rowStr = rows[r] || '';
    for (const ch of rowStr) {
      if (ch >= '1' && ch <= '8') {
        const n = parseInt(ch, 10);
        for (let i = 0; i < n; i++) {
          row.push(null);
        }
      } else {
        row.push(ch);
      }
    }
    matrix.push(row);
  }
  return matrix;
}

export function notationToCoords(notation: string): { row: number; col: number } {
  const fileChar = notation?.charCodeAt(0);
  const rankValue = parseInt(notation?.[1] ?? '', 10);
  const file = Number.isFinite(fileChar) ? Math.max(0, Math.min(7, fileChar - 97)) : 0;
  const rank = Number.isFinite(rankValue) ? Math.max(1, Math.min(8, rankValue)) : 1;
  const row = 8 - rank;
  const col = file;
  return { row, col };
}
