import { ref, watch, type WatchSource } from 'vue';
import type { GameState } from '../types';

export function useNewMoveNotice(
  gameStateSource: WatchSource<GameState | null>,
  currentPlayerColorSource: WatchSource<'white' | 'black' | null>
) {
  const hasNewMove = ref(false);
  const lastKnownMoveCount = ref(0);
  const isShowingNotification = ref(false);

  const triggerNotification = () => {
    if (isShowingNotification.value) return;
    isShowingNotification.value = true;
    hasNewMove.value = true;
    setTimeout(() => {
      hasNewMove.value = false;
      isShowingNotification.value = false;
    }, 600);
  };

  watch(gameStateSource, (gs) => {
    const latestMoves = (gs?.moveHistory || []).length;
    if (latestMoves > lastKnownMoveCount.value) {
      const latestMove = gs?.moveHistory?.[latestMoves - 1];
      const myColor = (currentPlayerColorSource as any).value as 'white' | 'black' | null;
      const isOpponentMove = latestMove && myColor && latestMove.player !== myColor;
      if (isOpponentMove) {
        triggerNotification();
      }
      lastKnownMoveCount.value = latestMoves;
    }
  });

  const clearNotice = () => {
    hasNewMove.value = false;
    isShowingNotification.value = false;
  };

  return { hasNewMove, triggerNotification, clearNotice, lastKnownMoveCount };
}
