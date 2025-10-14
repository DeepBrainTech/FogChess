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

  const showLeaveDialog = async () => {
    const { t } = await import('../services/i18n');
    if (gameState.value?.gameStatus === 'playing') {
      dialogType.value = 'leave-confirm';
      dialogTitle.value = t('dialogs.leave.title');
      dialogMessage.value = t('dialogs.leave.msg');
      showDialog.value = true;
    } else {
      directLeave();
    }
  };

  const confirmLeave = () => {
    directLeave();
    closeDialog();
  };

  const showSurrenderDialog = async () => {
    const { t } = await import('../services/i18n');
    dialogType.value = 'surrender-confirm';
    dialogTitle.value = t('dialogs.resign.title');
    dialogMessage.value = t('dialogs.resign.msg');
    showDialog.value = true;
  };

  const showDownloadFenDialog = async () => {
    const { t } = await import('../services/i18n');
    dialogType.value = 'download-fen';
    dialogTitle.value = t('dialogs.downloadFen.title');
    dialogMessage.value = t('dialogs.downloadFen.msg');
    showDialog.value = true;
  };

  const showDownloadPgnDialog = async () => {
    const { t } = await import('../services/i18n');
    dialogType.value = 'download-pgn';
    dialogTitle.value = t('dialogs.exportPgn.title');
    dialogMessage.value = t('dialogs.exportPgn.msg');
    showDialog.value = true;
  };

  const showDrawDialog = async () => {
    const { t } = await import('../services/i18n');
    dialogType.value = 'draw-request';
    dialogTitle.value = t('dialogs.draw.title');
    dialogMessage.value = t('dialogs.draw.msg');
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
    const roomName = room.value?.name || 'FogChess';
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
    const roomName = room.value?.name || 'FogChess';
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

  const requestUndo = async () => {
    if (!room.value || !roomStore.currentPlayer) return;
    dialogType.value = 'undo-request';
    const { t } = await import('../services/i18n');
    dialogTitle.value = t('dialogs.undo.request.title');
    dialogMessage.value = t('dialogs.undo.request.msg');
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

  const showUndoRequestDialog = async (fromPlayer: string, attemptsLeft?: number) => {
    const { t } = await import('../services/i18n');
    dialogType.value = 'undo-response';
    dialogTitle.value = t('dialogs.undo.fromOpponent');
    const attemptsText = attemptsLeft ? (current => current.replace('{attempts}', ` (${attemptsLeft})`))(t('dialogs.undo.fromOpponent.msg')) : t('dialogs.undo.fromOpponent.msg').replace('{attempts}', '');
    dialogMessage.value = attemptsText.replace('{name}', fromPlayer);
    showDialog.value = true;
  };

  const showUndoResultDialog = async (accepted: boolean) => {
    dialogType.value = 'undo-result';
    dialogTitle.value = 'Undo';
    const { t } = await import('../services/i18n');
    dialogMessage.value = accepted ? t('dialog.undo.accepted') : t('dialog.undo.rejected');
    showDialog.value = true;
    undoRequestPending.value = false;
  };

  const showUndoErrorDialog = async (message: string) => {
    const { t } = await import('../services/i18n');
    dialogType.value = 'undo-error';
    if (message && message.toLowerCase().includes('not in playing state')) {
      dialogTitle.value = t('dialog.notStarted.title');
      dialogMessage.value = t('dialog.notStarted.message');
      showDialog.value = true;
      undoRequestPending.value = false;
      return;
    }
    if (message.includes('game finished') || message.includes('please start new game')) {
      dialogTitle.value = t('dialog.finished.title');
    } else if (message.toLowerCase().includes('not your turn')) {
      // Not your turn
      dialogTitle.value = t('dialog.cannotMove.title');
      dialogMessage.value = t('dialog.notYourTurn');
      showDialog.value = true;
      undoRequestPending.value = false;
      return;
    } else if (message.toLowerCase().includes('cannot undo, please make a move first')) {
      // Cannot undo, please make a move first
      dialogTitle.value = t('dialog.cannotUndo.title');
      dialogMessage.value = t('dialogs.cannotUndo.msg');
      showDialog.value = true;
      undoRequestPending.value = false;
      return;
    } else {
      dialogTitle.value = t('dialog.cannotUndo.title');
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

  const showDrawRequestDialog = async (fromPlayer: string) => {
    const { t } = await import('../services/i18n');
    dialogType.value = 'draw-response';
    dialogTitle.value = t('dialogs.draw.fromOpponent');
    dialogMessage.value = t('dialogs.draw.fromOpponent.msg').replace('{name}', fromPlayer);
    showDialog.value = true;
  };

  const showDrawResultDialog = async (accepted: boolean) => {
    const { t } = await import('../services/i18n');
    dialogType.value = 'draw-result';
    dialogTitle.value = t('dialogs.draw.result');
    dialogMessage.value = accepted ? t('dialogs.draw.accepted') : t('dialogs.draw.rejected');
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


