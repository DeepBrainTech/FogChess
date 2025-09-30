import { computed, ref, watch, type WatchSource } from 'vue';
import type { GameState, Move } from '../types';
import { replayService } from '../services/replay';
import { animationService } from '../services/animation';
import { useGameStore } from '../stores/game';

export function useReplay(
  gameStateSource: WatchSource<GameState | null>,
  currentPlayerColorSource: WatchSource<'white' | 'black' | null>
) {
  const gameStore = useGameStore();

  const currentMoveIndex = ref(0);
  const totalMoves = computed(() => ((gameStateSource as any).value?.moveHistory || []).length);

  const goToStart = () => {
    if (totalMoves.value === 0) return;
    currentMoveIndex.value = 0;
    updateBoardForMoves(currentMoveIndex.value);
  };

  const stepBackward = async () => {
    if (totalMoves.value === 0) return;
    if (currentMoveIndex.value > 0) {
      currentMoveIndex.value -= 1;
      await updateBoardForMoves(currentMoveIndex.value);
    }
  };

  const stepForward = async () => {
    if (currentMoveIndex.value < totalMoves.value) {
      currentMoveIndex.value += 1;
      if (currentMoveIndex.value === totalMoves.value) {
        goToEnd();
      } else {
        await updateBoardForMoves(currentMoveIndex.value);
      }
    }
  };

  const goToEnd = () => {
    currentMoveIndex.value = totalMoves.value;
    gameStore.setReplayState(null);
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
