import { ref, type Ref } from 'vue';
import type { Room, GameState } from '../types';
import type { Router } from 'vue-router';
import { buildPGN } from '../utils/chessExport';
import { parseBoardPartToMatrix, matrixToBoardPart, notationToCoords, isKingCapturedFromBoardPart } from '../utils/fen';

export type DialogType = 'undo-request' | 'undo-response' | 'undo-result' | 'undo-error' | 'surrender-confirm' | 'leave-confirm' | 'download-fen' | 'download-pgn' | 'draw-request' | 'draw-response' | 'draw-result';

export function useGameDialogs(params: {
  room: Ref<Room | null>;
  gameState: Ref<GameState | null>;
  roomStore: { leaveRoom: () => void; currentPlayer: { color: 'white' | 'black' } | null };
  gameStore: {
    resetGame: () => void;
    setCurrentPlayer: (p: any) => void;
    setGameState: (g: GameState) => void;
    setupSocketListeners: () => void;
    requestUndo: (roomId: string) => void;
    respondToUndo: (roomId: string, accepted: boolean) => void;
    surrender: (roomId: string) => void;
    requestDraw: (roomId: string) => void;
    respondToDraw: (roomId: string, accepted: boolean) => void;
  };
  router: Router;
}) {
  const { room, gameState, roomStore, gameStore, router } = params;

  const showDialog = ref(false);
  const dialogType = ref<DialogType>('undo-request');
  const dialogTitle = ref('');
  const dialogMessage = ref('');
  const undoRequestPending = ref(false);

  const closeDialog = () => {
    showDialog.value = false;
    undoRequestPending.value = false;
  };

  const directLeave = () => {
    roomStore.leaveRoom();
    gameStore.resetGame();
    router.push('/');
  };

  const showLeaveDialog = () => {
    if (gameState.value?.gameStatus === 'playing') {
      dialogType.value = 'leave-confirm';
      dialogTitle.value = '离开游戏';
      dialogMessage.value = '确定要离开游戏吗？';
      showDialog.value = true;
    } else {
      directLeave();
    }
  };

  const confirmLeave = () => {
    directLeave();
    closeDialog();
  };

  const showSurrenderDialog = () => {
    dialogType.value = 'surrender-confirm';
    dialogTitle.value = '认输';
    dialogMessage.value = '确定认输吗？';
    showDialog.value = true;
  };

  const showDownloadFenDialog = () => {
    dialogType.value = 'download-fen';
    dialogTitle.value = '下载FEN';
    dialogMessage.value = '确定下载对局代码吗？';
    showDialog.value = true;
  };

  const showDownloadPgnDialog = () => {
    dialogType.value = 'download-pgn';
    dialogTitle.value = '导出PGN';
    dialogMessage.value = '确定导出本局PGN吗？';
    showDialog.value = true;
  };

  const showDrawDialog = () => {
    dialogType.value = 'draw-request';
    dialogTitle.value = '申请和棋';
    dialogMessage.value = '确定申请和棋吗？';
    showDialog.value = true;
  };

  function getPrevPositionBoardPart(currentFen: string): string | null {
    const fenParts = currentFen.split(' ');
    if (fenParts.length === 0) return null;
    const boardPart = fenParts[0];
    const last = gameState.value?.moveHistory?.[gameState.value.moveHistory.length - 1];
    if (!last) return boardPart;

    const matrix = parseBoardPartToMatrix(boardPart);
    const from = notationToCoords(last.from);
    const to = notationToCoords(last.to);

    const movedNow = matrix[to.r][to.c];
    let originalMoved = movedNow;
    if ((last as any).promotion && movedNow) {
      const isWhite = movedNow === movedNow.toUpperCase();
      originalMoved = isWhite ? 'P' : 'p';
    }
    matrix[from.r][from.c] = originalMoved || null;
    matrix[to.r][to.c] = null;

    const capturedSym: string | undefined = (last as any).captured;
    if (capturedSym) {
      matrix[to.r][to.c] = capturedSym;
    } else {
      const endedByKing = isKingCapturedFromBoardPart(fenParts[0]);
      if (endedByKing && last.player) {
        const kingSym = last.player === 'white' ? 'k' : 'K';
        matrix[to.r][to.c] = kingSym;
      }
    }
    return matrixToBoardPart(matrix);
  }

  const confirmDownloadFen = () => {
    const fen = gameState.value?.board;
    if (!fen) {
      closeDialog();
      return;
    }
    let fenToSave = fen;
    if (gameState.value?.gameStatus === 'finished') {
      const boardPart = fen.split(' ')[0];
      if (isKingCapturedFromBoardPart(boardPart)) {
        const prevBoardPart = getPrevPositionBoardPart(fen);
        if (prevBoardPart) {
          const parts = fen.split(' ');
          parts[0] = prevBoardPart;
          fenToSave = parts.join(' ');
        }
      }
    }
    const roomName = room.value?.name || '迷雾象棋';
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const filename = `${roomName}-${year}-${day}-${month}.fen`;
    const blob = new Blob([fenToSave + '\n'], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    closeDialog();
  };

  const confirmDownloadPgn = () => {
    const gs = gameState.value;
    if (!gs) { closeDialog(); return; }
    const moves = [...(gs.moveHistory || [])];
    const result = gs.winner === 'white' ? '1-0' : gs.winner === 'black' ? '0-1' : gs.winner === 'draw' ? '1/2-1/2' : '*';
    const whiteName = room.value?.players.find(p => p.color === 'white')?.name || 'White';
    const blackName = room.value?.players.find(p => p.color === 'black')?.name || 'Black';
    const pgn = buildPGN(moves as any, whiteName, blackName, result, new Date());
    const roomName = room.value?.name || '迷雾象棋';
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const filename = `${roomName}-${year}-${day}-${month}.pgn`;
    const blob = new Blob([pgn + '\n'], { type: 'application/x-chess-pgn;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    closeDialog();
  };

  const requestUndo = () => {
    if (!room.value || !roomStore.currentPlayer) return;
    dialogType.value = 'undo-request';
    dialogTitle.value = '请求悔棋';
    dialogMessage.value = '确定要请求悔棋吗？';
    showDialog.value = true;
  };

  const confirmUndoRequest = () => {
    if (!room.value) return;
    undoRequestPending.value = true;
    gameStore.requestUndo(room.value.id);
    closeDialog();
  };

  const respondToUndo = (accepted: boolean) => {
    if (!room.value) return;
    gameStore.respondToUndo(room.value.id, accepted);
    closeDialog();
  };

  const showUndoRequestDialog = (fromPlayer: string, attemptsLeft?: number) => {
    dialogType.value = 'undo-response';
    dialogTitle.value = '对手请求悔棋';
    const attemptsText = attemptsLeft ? ` (剩余尝试次数: ${attemptsLeft})` : '';
    dialogMessage.value = `${fromPlayer} 请求悔棋，是否同意？${attemptsText}`;
    showDialog.value = true;
  };

  const showUndoResultDialog = (accepted: boolean) => {
    dialogType.value = 'undo-result';
    dialogTitle.value = '悔棋结果';
    dialogMessage.value = accepted ? '对手同意了悔棋请求' : '对手拒绝了悔棋请求';
    showDialog.value = true;
    undoRequestPending.value = false;
  };

  const showUndoErrorDialog = (message: string) => {
    dialogType.value = 'undo-error';
    if (message && (message.toLowerCase().includes('not in playing state') || message.includes('未开始'))) {
      dialogTitle.value = '游戏未开始';
      dialogMessage.value = '等待对手加入';
      showDialog.value = true;
      undoRequestPending.value = false;
      return;
    }
    if (message.includes('对局已结束') || message.includes('请开始新游戏')) {
      dialogTitle.value = '对局结束';
    } else if (message.toLowerCase().includes('not your turn')) {
      // 不是你的回合
      dialogTitle.value = '无法移动';
      dialogMessage.value = '不是你的回合';
      showDialog.value = true;
      undoRequestPending.value = false;
      return;
    } else {
      dialogTitle.value = '无法悔棋';
    }
    dialogMessage.value = message;
    showDialog.value = true;
    undoRequestPending.value = false;
  };

  const confirmDrawRequest = () => {
    if (!room.value) return;
    gameStore.requestDraw(room.value.id);
    closeDialog();
  };

  const respondToDraw = (accepted: boolean) => {
    if (!room.value) return;
    gameStore.respondToDraw(room.value.id, accepted);
    closeDialog();
  };

  const showDrawRequestDialog = (fromPlayer: string) => {
    dialogType.value = 'draw-response';
    dialogTitle.value = '对手申请和棋';
    dialogMessage.value = `${fromPlayer} 申请和棋，是否同意？`;
    showDialog.value = true;
  };

  const showDrawResultDialog = (accepted: boolean) => {
    dialogType.value = 'draw-result';
    dialogTitle.value = '和棋结果';
    dialogMessage.value = accepted ? '对手同意了和棋请求' : '对手拒绝了和棋请求';
    showDialog.value = true;
  };

  const registerUndoWindowEvents = () => {
    window.addEventListener('show-undo-request', (event: any) => {
      showUndoRequestDialog(event.detail.fromPlayer, event.detail.attemptsLeft);
    });
    window.addEventListener('show-undo-result', (event: any) => {
      showUndoResultDialog(event.detail.accepted);
    });
    window.addEventListener('show-undo-error', (event: any) => {
      showUndoErrorDialog(event.detail.message);
    });
    window.addEventListener('show-draw-request', (event: any) => {
      showDrawRequestDialog(event.detail.fromPlayer);
    });
    window.addEventListener('show-draw-result', (event: any) => {
      showDrawResultDialog(event.detail.accepted);
    });
  };

  return {
    // state
    showDialog,
    dialogType,
    dialogTitle,
    dialogMessage,
    undoRequestPending,
    // actions
    closeDialog,
    showLeaveDialog,
    confirmLeave,
    showSurrenderDialog,
    showDownloadFenDialog,
    showDownloadPgnDialog,
    confirmDownloadFen,
    confirmDownloadPgn,
    requestUndo,
    confirmUndoRequest,
    respondToUndo,
    showUndoRequestDialog,
    showUndoResultDialog,
    showUndoErrorDialog,
    showDrawDialog,
    confirmDrawRequest,
    respondToDraw,
    showDrawRequestDialog,
    showDrawResultDialog,
    registerUndoWindowEvents,
  };
}


