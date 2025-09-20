import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { GameState, Move, Player } from '../types';
import { socketService } from '../services/socket';
import { chessService } from '../services/chess';
import { useRoomStore } from './room';

export const useGameStore = defineStore('game', () => {
  const roomStore = useRoomStore();
  
  // 状态
  const gameState = ref<GameState | null>(null);
  const currentPlayer = ref<Player | null>(null);
  const selectedSquare = ref<string | null>(null);
  const possibleMoves = ref<string[]>([]);
  const isMyTurn = computed(() => {
    return currentPlayer.value && gameState.value && 
           currentPlayer.value.color === gameState.value.currentPlayer;
  });

  // 动作
  const setGameState = (newGameState: GameState) => {
    console.log('[setGameState] Received game state:', {
      fen: newGameState.board,
      current: newGameState.currentPlayer,
      status: newGameState.gameStatus,
      wVisible: newGameState.fogOfWar?.whiteVisible?.length,
      bVisible: newGameState.fogOfWar?.blackVisible?.length
    });
    
    gameState.value = newGameState;
    chessService.setBoardFromFen(newGameState.board);
    
    // 迷雾棋规则：每个玩家始终看到自己的棋子和自己棋子可以移动到的格子
    // 视野应该基于当前连接的玩家身份，而不是当前回合
    const playerColor = currentPlayer.value?.color || roomStore.currentPlayer?.color;
    console.log('[setGameState] Applying fog for player:', playerColor);
    
    if (playerColor && newGameState.fogOfWar) {
      chessService.applyFogFor(playerColor, newGameState.fogOfWar);
    }
  };

  const setCurrentPlayer = (player: Player) => {
    currentPlayer.value = player;
    if (gameState.value) {
      chessService.applyFogFor(player.color, gameState.value.fogOfWar as any);
    }
  };

  const selectSquare = (square: string) => {
    if (!isMyTurn.value) return;
    
    if (selectedSquare.value === square) {
      // 取消选择
      selectedSquare.value = null;
      possibleMoves.value = [];
      chessService.clearHighlights();
    } else {
      // 选择新格子
      selectedSquare.value = square;
      possibleMoves.value = getPossibleMoves(square);
      highlightMoves();
    }
  };

  const makeMove = async (from: string, to: string) => {
    if (!gameState.value || !currentPlayer.value) return;
    
    const move: Omit<Move, 'timestamp'> = {
      from,
      to,
      piece: getPieceAtSquare(from) || '',
      player: currentPlayer.value.color
    };

    // 兵升变：若兵走到末行，弹窗选择升变子
    const pieceSymbol = move.piece.toLowerCase();
    if (pieceSymbol === 'p') {
      const destRank = parseInt(to[1], 10);
      const isWhite = move.piece === 'P';
      const promote = (isWhite && destRank === 8) || (!isWhite && destRank === 1);
      if (promote) {
        const choice = window.prompt('选择升变(Q/R/B/N)，默认Q：', 'Q');
        const map: Record<string, 'q'|'r'|'b'|'n'> = { Q: 'q', R: 'r', B: 'b', N: 'n', q: 'q', r: 'r', b: 'b', n: 'n' };
        const picked = choice ? map[choice.trim()] : 'q';
        if (!picked) return; // 用户取消或输入无效则不走
        (move as any).promotion = picked;
      }
    }

    // 发送移动到服务器
    if (roomStore.currentRoom) {
      socketService.makeMove(roomStore.currentRoom.id, move);
    }
    
    // 清除选择
    selectedSquare.value = null;
    possibleMoves.value = [];
    chessService.clearHighlights();
  };

  const getPieceAtSquare = (square: string): string | null => {
    const coords = chessService.getSquareCoordinates(square);
    if (!coords) return null;
    
    const boardSquare = chessService.getSquare(coords.row, coords.col);
    if (!boardSquare?.piece) return null;
    
    const pieceMap: { [key: string]: string } = {
      'king': 'K',
      'queen': 'Q',
      'rook': 'R',
      'bishop': 'B',
      'knight': 'N',
      'pawn': 'P'
    };
    
    const piece = boardSquare.piece;
    const symbol = pieceMap[piece.type];
    return piece.color === 'white' ? symbol : symbol.toLowerCase();
  };

  const getPossibleMoves = (square: string): string[] => {
    // 简化版本，实际应该调用chess.js或实现完整规则
    const moves: string[] = [];
    const coords = chessService.getSquareCoordinates(square);
    if (!coords) return moves;
    
    // 这里应该实现真正的移动规则
    // 暂时返回空数组
    return moves;
  };

  const highlightMoves = () => {
    chessService.clearHighlights();
    
    if (selectedSquare.value) {
      const coords = chessService.getSquareCoordinates(selectedSquare.value);
      if (coords) {
        chessService.highlightSquare(coords.row, coords.col, 'selected');
      }
    }
    
    possibleMoves.value.forEach(square => {
      const coords = chessService.getSquareCoordinates(square);
      if (coords) {
        chessService.highlightSquare(coords.row, coords.col, 'possible');
      }
    });
  };

  // 请求后端合法走法并高亮
  const requestLegalMoves = (square: string) => {
    if (!roomStore.currentRoom) return;
    socketService.getLegalMoves(roomStore.currentRoom.id, square);
    (socketService as any).on('legal-moves', (data: any) => {
      if (data.square !== square) return;
      possibleMoves.value = data.moves || [];
      highlightMoves();
    });
  };

  const resetGame = () => {
    gameState.value = null;
    currentPlayer.value = null;
    selectedSquare.value = null;
    possibleMoves.value = [];
    chessService.clearHighlights();
  };

  // 悔棋相关方法
  const requestUndo = (roomId: string) => {
    socketService.requestUndo(roomId);
  };

  const respondToUndo = (roomId: string, accepted: boolean) => {
    socketService.respondToUndo(roomId, accepted);
  };

  const surrender = (roomId: string) => {
    socketService.surrender(roomId);
  };

  // 监听Socket事件
  const setupSocketListeners = () => {
    socketService.on('move-made', (data: any) => {
      console.log('[socket] move-made', data);
      setGameState(data.gameState);
    });

    socketService.on('game-updated', (data: any) => {
      console.log('[socket] game-updated', data);
      setGameState(data.gameState);
    });

    socketService.on('undo-requested', (data: any) => {
      console.log('[socket] undo-requested', data);
      // 这里需要通知Game.vue显示弹窗
      // 可以通过事件总线或者直接调用方法
      window.dispatchEvent(new CustomEvent('show-undo-request', { 
        detail: { 
          fromPlayer: data.fromPlayer,
          attemptsLeft: data.attemptsLeft 
        } 
      }));
    });

    socketService.on('undo-response', (data: any) => {
      console.log('[socket] undo-response', data);
      // 这里需要通知Game.vue显示结果弹窗
      window.dispatchEvent(new CustomEvent('show-undo-result', { 
        detail: { accepted: data.accepted } 
      }));
    });

    socketService.on('undo-executed', (data: any) => {
      console.log('[socket] undo-executed', data);
      setGameState(data.gameState);
    });

    // 监听错误事件
    socketService.on('error', (data: any) => {
      console.log('[socket] error', data);
      // 走子不合法（例如点击非蓝点）静默处理：不弹“无法悔棋”
      if (data && (data.message === 'Invalid move' || data.message === 'Failed to make move')) {
        return;
      }
      // 仅在悔棋等流程的错误时，通知Game.vue显示弹窗
      window.dispatchEvent(new CustomEvent('show-undo-error', {
        detail: { message: data.message }
      }));
    });
  };

  return {
    // 状态
    gameState,
    currentPlayer,
    selectedSquare,
    possibleMoves,
    isMyTurn,
    
    // 动作
    setGameState,
    setCurrentPlayer,
    selectSquare,
    makeMove,
    resetGame,
    setupSocketListeners,
    requestLegalMoves,
    requestUndo,
    respondToUndo,
    surrender
  };
});
