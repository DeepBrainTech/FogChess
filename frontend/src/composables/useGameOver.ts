import { ref, watch } from 'vue';
import type { GameState } from '../types';
import type { Ref } from 'vue';

export function useGameOver(gameStateSource: Ref<GameState | null>, currentPlayerColorSource: Ref<'white' | 'black' | null>) {
  const showGameOver = ref(false);
  const isWinner = ref(false);
  const gameOverTitle = ref('Game Over');
  const gameOverMessage = ref('');
  const isVictoryFlash = ref(false);
  const isDefeatFlash = ref(false);

  function isKingCaptured(fen?: string): boolean {
    if (!fen || typeof fen !== 'string') return false;
    const boardPart = fen.split(' ')[0];
    const hasWhiteKing = boardPart.includes('K');
    const hasBlackKing = boardPart.includes('k');
    return !hasWhiteKing || !hasBlackKing;
  }

  watch(gameStateSource, (gs) => {
    if (!gs) return;
    if (gs.gameStatus === 'finished' && !showGameOver.value && gs.winner) {
      const myColor = currentPlayerColorSource.value;
      const win = myColor ? gs.winner === myColor : false;
      isWinner.value = win;
      gameOverTitle.value = win ? 'Victory' : 'Defeat';

      const fenStr = (gs as any).board ?? (gs as any).fen;
      const kingWasCaptured = isKingCaptured(fenStr);
      const reason = kingWasCaptured ? 'king' : 'surrender';
      if (reason === 'king') {
        gameOverMessage.value = win ? '恭喜你，吃掉了对面国王！' : '很抱歉，你被吃掉了国王！';
      } else {
        gameOverMessage.value = win ? '恭喜你，你赢了！' : '很抱歉，你输了！';
      }

      if (win) {
        isVictoryFlash.value = true;
      } else {
        isDefeatFlash.value = true;
      }
      showGameOver.value = true;

      setTimeout(() => {
        isVictoryFlash.value = false;
        isDefeatFlash.value = false;
      }, 2000);
    }
  });

  const closeGameOver = () => {
    showGameOver.value = false;
  };

  return { showGameOver, isWinner, gameOverTitle, gameOverMessage, isVictoryFlash, isDefeatFlash, closeGameOver };
}
