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
    gameState.value = newGameState;
    chessService.setBoardFromFen(newGameState.board);
  };

  const setCurrentPlayer = (player: Player) => {
    currentPlayer.value = player;
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

  const makeMove = (from: string, to: string) => {
    if (!gameState.value || !currentPlayer.value) return;
    
    const move: Omit<Move, 'timestamp'> = {
      from,
      to,
      piece: getPieceAtSquare(from) || '',
      player: currentPlayer.value.color
    };

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

  const resetGame = () => {
    gameState.value = null;
    currentPlayer.value = null;
    selectedSquare.value = null;
    possibleMoves.value = [];
    chessService.clearHighlights();
  };

  // 监听Socket事件
  const setupSocketListeners = () => {
    socketService.on('move-made', (data) => {
      setGameState(data.gameState);
    });

    socketService.on('game-updated', (data) => {
      setGameState(data.gameState);
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
    setupSocketListeners
  };
});
