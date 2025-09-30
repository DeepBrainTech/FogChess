import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { GameState, Move, Player } from '../types';
import { socketService } from '../services/socket';
import { chessService } from '../services/chess';
import { audioService } from '../services/audio';
import { replayService } from '../services/replay';
import { animationService } from '../services/animation';
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
    
    // 迷雾棋规则：每个玩家始终看到自己的棋子和自己棋子可以移动到的格子
    // 视野应该基于当前连接的玩家身份，而不是当前回合
    const playerColor = currentPlayer.value?.color || roomStore.currentPlayer?.color;
    
    if (playerColor && newGameState.fogOfWar) {
      chessService.applyFogFor(playerColor, newGameState.fogOfWar);
    }
  };

  function countMyPieces(boardPart: string, myColor: 'white' | 'black'): number {
    let count = 0;
    for (const ch of boardPart) {
      if (myColor === 'white') {
        if (/[KQRBNP]/.test(ch)) count++;
      } else {
        if (/[kqrbnp]/.test(ch)) count++;
      }
    }
    return count;
  }

  function playOpponentMoveSoundIfAny(prevFen: string | undefined, nextFen: string, nextCurrentPlayer: 'white' | 'black') {
    if (!currentPlayer.value) return;
    if (!prevFen) return;
    const myColor = currentPlayer.value.color;
    const lastMover: 'white' | 'black' = nextCurrentPlayer === 'white' ? 'black' : 'white';
    if (lastMover !== myColor) {
      const prevBoard = prevFen.split(' ')[0] || '';
      const nextBoard = nextFen.split(' ')[0] || '';
      const prevCount = countMyPieces(prevBoard, myColor);
      const nextCount = countMyPieces(nextBoard, myColor);
      if (nextCount < prevCount) {
        audioService.playCaptureSound();
      } else {
        audioService.playMoveSound();
      }
    }
  }

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

    // 播放移动动画
    try {
      await animationService.animateMove(from, to, { duration: 200 });
    } catch (error) {
      console.warn('动画播放失败，继续执行移动:', error);
    }

    // 播放音效：检查是否吃子
    const isCapture = checkIfCapture(to);
    if (isCapture) {
      audioService.playCaptureSound();
    } else {
      audioService.playMoveSound();
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

  const checkIfCapture = (to: string): boolean => {
    // 检查目标格是否有对方棋子
    const targetPiece = getPieceAtSquare(to);
    if (!targetPiece) return false;
    
    // 检查是否是对方棋子
    const currentColor = currentPlayer.value?.color;
    if (!currentColor) return false;
    
    const isWhitePiece = targetPiece === targetPiece.toUpperCase();
    const isBlackPiece = targetPiece === targetPiece.toLowerCase();
    const isOpponentPiece = (currentColor === 'white' && isBlackPiece) || 
                           (currentColor === 'black' && isWhitePiece);
    
    return isOpponentPiece;
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

      // 追加：迷雾棋王车易位（不检查将军穿越/落点是否受控）
      try {
        appendCastlingMovesIfEligible(square);
      } catch (e) {
        // 保守处理：忽略前端易位计算错误
      }

      highlightMoves();
    });
  };

  function appendCastlingMovesIfEligible(square: string) {
    // 仅当选择的是己方国王，且在起始位置，且与起始车之间无子且双方均未动
    if (!gameState.value || !currentPlayer.value) return;
    const color = currentPlayer.value.color;

    const kingStart = color === 'white' ? 'e1' : 'e8';
    if (square !== kingStart) return;

    const kingCoords = chessService.getSquareCoordinates(kingStart);
    if (!kingCoords) return;
    const kingSquare = chessService.getSquare(kingCoords.row, kingCoords.col);
    if (!kingSquare?.piece || kingSquare.piece.type !== 'king' || kingSquare.piece.color !== color) return;

    // 工具函数
    const isEmpty = (notation: string) => {
      const c = chessService.getSquareCoordinates(notation);
      if (!c) return false;
      const sq = chessService.getSquare(c.row, c.col);
      return !!sq && !sq.piece;
    };
    const pieceAt = (notation: string) => {
      const c = chessService.getSquareCoordinates(notation);
      if (!c) return null;
      const sq = chessService.getSquare(c.row, c.col);
      return sq?.piece || null;
    };

    const hasMoved = (startSquare: string): boolean => {
      const history = gameState.value?.moveHistory || [];
      return history.some(m => m.from === startSquare);
    };

    // 短易位：王 e1/e8 -> g1/g8，车 h1/h8 -> f1/f8
    const rookShortStart = color === 'white' ? 'h1' : 'h8';
    const kingShortTarget = color === 'white' ? 'g1' : 'g8';
    const pathShort = color === 'white' ? ['f1', 'g1'] : ['f8', 'g8'];

    const rookShortPiece = pieceAt(rookShortStart);
    if (
      rookShortPiece && rookShortPiece.type === 'rook' && rookShortPiece.color === color &&
      !hasMoved(kingStart) && !hasMoved(rookShortStart) &&
      pathShort.every(p => isEmpty(p))
    ) {
      if (!possibleMoves.value.includes(kingShortTarget)) {
        possibleMoves.value.push(kingShortTarget);
      }
    }

    // 长易位：王 e1/e8 -> c1/c8，车 a1/a8 -> d1/d8
    const rookLongStart = color === 'white' ? 'a1' : 'a8';
    const kingLongTarget = color === 'white' ? 'c1' : 'c8';
    const pathLong = color === 'white' ? ['b1', 'c1', 'd1'] : ['b8', 'c8', 'd8'];

    const rookLongPiece = pieceAt(rookLongStart);
    if (
      rookLongPiece && rookLongPiece.type === 'rook' && rookLongPiece.color === color &&
      !hasMoved(kingStart) && !hasMoved(rookLongStart) &&
      pathLong.every(p => isEmpty(p))
    ) {
      if (!possibleMoves.value.includes(kingLongTarget)) {
        possibleMoves.value.push(kingLongTarget);
      }
    }
  }

  const resetGame = () => {
    gameState.value = null;
    currentPlayer.value = null;
    selectedSquare.value = null;
    possibleMoves.value = [];
    chessService.clearHighlights();
  };

  // 回放状态管理
  const replayState = ref<any>(null);
  
  const setReplayState = (state: any) => {
    replayState.value = state;
    if (state) {
      // 进入回放模式，设置棋盘状态
      chessService.setBoardFromFen(state.board);
      // 历史局面下的基础视野：仅显示"自己棋子所在格"（不暴露对方）
      try {
        const viewer = currentPlayer.value?.color;
        if (viewer) {
          const fog = (replayService.constructor as any).calculateBasicVisibility(state.board, viewer);
          chessService.applyFogFor(viewer, fog as any);
        }
      } catch {}
    } else {
      // 退出回放模式，恢复当前游戏状态
      if (gameState.value) {
        chessService.setBoardFromFen(gameState.value.board);
        if (currentPlayer.value && gameState.value.fogOfWar) {
          chessService.applyFogFor(currentPlayer.value.color, gameState.value.fogOfWar);
        }
      }
    }
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
      const prevFen = gameState.value?.board;
      const next = data.gameState as GameState;
      // 先根据对手移动情况播放音效（基于 FEN 差异）
      playOpponentMoveSoundIfAny(prevFen, next.board, next.currentPlayer);
      setGameState(next);
    });

    socketService.on('game-updated', (data: any) => {
      // 通常用于悔棋等同步更新，不播放音效
      setGameState(data.gameState);
    });

    socketService.on('undo-requested', (data: any) => {
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
      // 这里需要通知Game.vue显示结果弹窗
      window.dispatchEvent(new CustomEvent('show-undo-result', { 
        detail: { accepted: data.accepted } 
      }));
    });

    socketService.on('undo-executed', (data: any) => {
      setGameState(data.gameState);
    });

    // 监听错误事件
    socketService.on('error', (data: any) => {
      console.error('Socket error:', data);
      // 走子不合法（例如点击非蓝点）静默处理：不弹"无法悔棋"
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
    replayState,
    
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
    surrender,
    setReplayState
  };
});
