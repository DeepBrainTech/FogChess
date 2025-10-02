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
      const isDraw = gs.winner === 'draw';
      
      isWinner.value = win;
      
      if (isDraw) {
        gameOverTitle.value = 'Draw';
        gameOverMessage.value = '平局！';
        // 平局不闪红绿，也不设置胜负状态
        isVictoryFlash.value = false;
        isDefeatFlash.value = false;
        isWinner.value = false; // 平局时不是胜利者
      } else {
        gameOverTitle.value = win ? 'Victory' : 'Defeat';

        const fenStr = (gs as any).board ?? (gs as any).fen;
        const kingWasCaptured = isKingCaptured(fenStr);
        
        // 检查是否是超时结束
        const isTimeout = (gs as any).timeout || false;
        
        if (isTimeout) {
          if (win) {
            gameOverMessage.value = '恭喜你，对手超时了！';
          } else {
            gameOverMessage.value = '很抱歉，你超时了！';
          }
        } else {
          const reason = kingWasCaptured ? 'king' : 'surrender';
          if (reason === 'king') {
            gameOverMessage.value = win ? '恭喜你，吃掉了对面国王！' : '很抱歉，你被吃掉了国王！';
          } else {
            gameOverMessage.value = win ? '恭喜你，你赢了！' : '很抱歉，你输了！';
          }
        }

        if (win) {
          isVictoryFlash.value = true;
        } else {
          isDefeatFlash.value = true;
        }
      }
      
      showGameOver.value = true;

      if (!isDraw) {
        setTimeout(() => {
          isVictoryFlash.value = false;
          isDefeatFlash.value = false;
        }, 2000);
      }
    }
  });

  // 监听超时事件
  if (typeof window !== 'undefined') {
    window.addEventListener('game-timeout', (ev: any) => {
      const detail = ev?.detail;
      if (detail?.player) {
        const myColor = currentPlayerColorSource.value;
        const isMyTimeout = myColor === detail.player;
        
        isWinner.value = !isMyTimeout; // 如果不是我超时，则我获胜
        gameOverTitle.value = isMyTimeout ? 'Defeat' : 'Victory';
        gameOverMessage.value = isMyTimeout ? '很抱歉，你超时了！' : '恭喜你，对手超时了！';
        
        if (isMyTimeout) {
          isDefeatFlash.value = true;
        } else {
          isVictoryFlash.value = true;
        }
        
        showGameOver.value = true;

        setTimeout(() => {
          isDefeatFlash.value = false;
          isVictoryFlash.value = false;
        }, 2000);
      }
    });
  }

  const closeGameOver = () => {
    showGameOver.value = false;
  };

  return { showGameOver, isWinner, gameOverTitle, gameOverMessage, isVictoryFlash, isDefeatFlash, closeGameOver };
}
