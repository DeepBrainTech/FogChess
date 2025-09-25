<template>
  <div class="game-container" :class="{ 'victory-flash': isVictoryFlash, 'defeat-flash': isDefeatFlash }">
    <div class="game-header">
      <div class="room-info">
        <h2>{{ room?.name || '游戏房间' }}</h2>
        <div v-if="room" class="room-info-container">
          <div class="invite-link">
            邀请链接: 
            <div class="tooltip-container">
              <button class="copy-btn invite-btn" @click="copyInviteLink">点击复制</button>
              <div class="tooltip">从浏览器直接加入！</div>
            </div>
          </div>
          <div class="room-id">
            房间地址: 
            <div class="tooltip-container">
              <button class="copy-btn" @click="copyRoomIdOnly">点击复制</button>
              <div class="tooltip">从主菜单加入房间！</div>
            </div>
          </div>
        </div>
        <div class="players">
          <div 
            v-for="player in room?.players" 
            :key="player.id"
            class="player-row"
            :class="{ 
              'current-player': player.color === gameState?.currentPlayer && gameState?.gameStatus !== 'finished',
              'winner': gameState?.gameStatus === 'finished' && gameState?.winner === player.color,
              'loser': gameState?.gameStatus === 'finished' && gameState?.winner && gameState?.winner !== player.color
            }"
          >
            <div class="player-info">
              <span class="player-color" :class="player.color"></span>
              {{ player.color === roomStore.currentPlayer?.color ? '你' : '对方' }}
              <span v-if="player.color === gameState?.currentPlayer && gameState?.gameStatus !== 'finished'" class="turn-indicator">(当前回合)</span>
            </div>
            <div class="captured-pieces">
              <img 
                v-for="(piece, index) in getCapturedPieces(player.color)" 
                :key="index"
                :src="getPieceImage(piece)"
                :alt="piece"
                class="captured-piece"
                :style="{ 'z-index': index }"
              />
            </div>
          </div>
        </div>
      </div>
      
      <div class="game-controls">
        <button 
          v-if="canRequestUndo" 
          @click="requestUndo" 
          class="undo-button"
          :disabled="undoRequestPending"
        >
          {{ undoRequestPending ? '等待对手同意...' : '悔棋' }}
        </button>
        <button 
          v-if="gameState?.gameStatus === 'playing'"
          @click="showSurrenderDialog" 
          class="surrender-button"
        >
          认输
        </button>
        <button 
          v-if="gameState?.gameStatus === 'finished'" 
          @click="showDownloadPgnDialog" 
          class="download-button secondary"
        >
          导出PGN
        </button>
        <button 
          v-if="gameState" 
          @click="showDownloadFenDialog" 
          class="download-button"
        >
          下载FEN
        </button>
        <button @click="toggleSound" class="sound-button" :class="{ 'sound-off': !audioService.getEnabled() }">
          {{ audioService.getEnabled() ? '🔊' : '🔇' }} 音效
        </button>
        <button @click="showLeaveDialog" class="leave-button">
          离开游戏
        </button>
      </div>
    </div>
    
    <div class="game-content">
      <div class="chess-container">
        <ChessBoard />
      </div>
      
      <div class="game-sidebar">
        <div class="game-status">
          <h3>游戏状态</h3>
          <div class="status-item">
            <span class="label">当前玩家:</span>
            <span class="value current-player-indicator">
              <span 
                class="turn-dot" 
                :class="{ 'my-turn': isMyTurn, 'opponent-turn': !isMyTurn }"
              ></span>
              {{ gameState?.currentPlayer === 'white' ? '白方' : '黑方' }}
            </span>
          </div>
          <div class="status-item">
            <span class="label">游戏状态:</span>
            <span class="value">{{ getGameStatusText() }}</span>
          </div>
          <div v-if="gameState?.winner" class="status-item">
            <span class="label">获胜者:</span>
            <span class="value">{{ gameState.winner === 'white' ? '白方' : '黑方' }}</span>
          </div>
        </div>
        
        <div class="move-history">
          <h3>移动历史</h3>
          <div class="moves-list">
            <!-- 表头 -->
            <div class="move-header">
              <div class="header-round">回合数</div>
              <div class="header-white">白方</div>
              <div class="header-black">黑方</div>
            </div>
            <!-- 移动记录 -->
            <div 
              v-for="(round, roundIndex) in getRounds()" 
              :key="roundIndex"
              class="move-item"
            >
              <div class="move-number">{{ roundIndex + 1 }}.</div>
              <div class="move-columns">
                <div class="move-column white-moves">
                  <span 
                    v-if="round.white && canSeeMoveAtRound(round.white)"
                    class="move-notation"
                  >
                    {{ round.white.from }}-{{ round.white.to }}
                  </span>
                  <span v-else class="move-hidden">?</span>
                </div>
                <div class="move-column black-moves">
                  <span 
                    v-if="round.black && canSeeMoveAtRound(round.black)"
                    class="move-notation"
                  >
                    {{ round.black.from }}-{{ round.black.to }}
                  </span>
                  <span v-else class="move-hidden">?</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 回放控制按钮 -->
          <div class="replay-controls">
            <button 
              class="replay-btn"
              title="回到开始"
            >
              <img src="/src/assets/replay/rewind-start.svg" alt="回到开始" class="replay-icon" />
            </button>
            <button 
              class="replay-btn"
              title="回退一步"
            >
              <img src="/src/assets/replay/step-backward.svg" alt="回退一步" class="replay-icon" />
            </button>
            <button 
              class="replay-btn play-btn"
              title="自动播放"
            >
              <img 
                src="/src/assets/replay/play.svg" 
                alt="播放" 
                class="replay-icon" 
              />
            </button>
            <button 
              class="replay-btn"
              title="前进一步"
            >
              <img src="/src/assets/replay/step-forward.svg" alt="前进一步" class="replay-icon" />
            </button>
            <button 
              class="replay-btn"
              title="跳到最新"
            >
              <img src="/src/assets/replay/fast-forward.svg" alt="跳到最新" class="replay-icon" />
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 通用弹窗 -->
    <div v-if="showDialog" class="dialog-overlay" @click="closeDialog">
      <div class="dialog-content" @click.stop>
        <h3>{{ dialogTitle }}</h3>
        <p>{{ dialogMessage }}</p>
        <div v-if="dialogType === 'undo-request'" class="dialog-buttons">
          <button @click="confirmUndoRequest" class="confirm-btn">确定</button>
          <button @click="closeDialog" class="cancel-btn">取消</button>
        </div>
        <div v-else-if="dialogType === 'undo-response'" class="dialog-buttons">
          <button @click="respondToUndo(true)" class="accept-btn">同意</button>
          <button @click="respondToUndo(false)" class="reject-btn">不同意</button>
        </div>
        <div v-else-if="dialogType === 'surrender-confirm'" class="dialog-buttons">
          <button @click="confirmSurrender" class="confirm-btn">确认</button>
          <button @click="closeDialog" class="cancel-btn">我再想想</button>
        </div>
        <div v-else-if="dialogType === 'leave-confirm'" class="dialog-buttons">
          <button @click="confirmLeave" class="confirm-btn">确定</button>
          <button @click="closeDialog" class="cancel-btn">取消</button>
        </div>
        <div v-else-if="dialogType === 'download-fen'" class="dialog-buttons">
          <button @click="confirmDownloadFen" class="confirm-btn">确定</button>
          <button @click="closeDialog" class="cancel-btn">取消</button>
        </div>
        <div v-else-if="dialogType === 'download-pgn'" class="dialog-buttons">
          <button @click="confirmDownloadPgn" class="confirm-btn">确定</button>
          <button @click="closeDialog" class="cancel-btn">取消</button>
        </div>
        <div v-else class="dialog-buttons">
          <button @click="closeDialog" class="ok-btn">确定</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 游戏结束弹窗 -->
  <div v-if="showGameOver" class="dialog-overlay" @click="closeGameOver">
    <div class="dialog-content" @click.stop>
      <h3 :class="{ 'victory-title': isWinner, 'defeat-title': !isWinner }">{{ gameOverTitle }}</h3>
      <p>{{ gameOverMessage }}</p>
      <div class="dialog-buttons">
        <button @click="closeGameOver" class="ok-btn">确定</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useRoomStore } from '../stores/room';
import { useGameStore } from '../stores/game';
import { audioService } from '../services/audio';
import ChessBoard from '../components/chess/ChessBoard.vue';

const router = useRouter();
const roomStore = useRoomStore();
const gameStore = useGameStore();

const room = computed(() => roomStore.currentRoom);
const gameState = computed(() => gameStore.gameState);

// 弹窗相关状态
const showDialog = ref(false);
const dialogType = ref<'undo-request' | 'undo-response' | 'undo-result' | 'undo-error' | 'surrender-confirm' | 'leave-confirm' | 'download-fen' | 'download-pgn'>('undo-request');
const dialogTitle = ref('');
const dialogMessage = ref('');
const undoRequestPending = ref(false);

// 游戏结束弹窗
const showGameOver = ref(false);
const gameOverTitle = ref('Game Over');
const gameOverMessage = ref('');

// 背景闪烁效果
const isVictoryFlash = ref(false);
const isDefeatFlash = ref(false);

// 计算属性
const canRequestUndo = computed(() => {
  if (!gameState.value || !roomStore.currentPlayer) return false;
  return gameState.value.gameStatus === 'playing' && 
         gameState.value.moveHistory && 
         gameState.value.moveHistory.length > 0;
});

const isMyTurn = computed(() => {
  if (!gameState.value || !roomStore.currentPlayer) return false;
  return gameState.value.currentPlayer === roomStore.currentPlayer.color;
});

function countPiecesFromBoardPart(boardPart: string) {
  const counts: Record<string, number> = {
    K: 0, Q: 0, R: 0, B: 0, N: 0, P: 0,
    k: 0, q: 0, r: 0, b: 0, n: 0, p: 0
  };
  for (const ch of boardPart) {
    if (counts.hasOwnProperty(ch)) {
      counts[ch]++;
    }
  }
  return counts;
}

function initialCountsFor(color: 'white' | 'black') {
  // 经典开局的初始子力数量
  if (color === 'white') {
    return { K: 1, Q: 1, R: 2, B: 2, N: 2, P: 8 };
  } else {
    return { k: 1, q: 1, r: 2, b: 2, n: 2, p: 8 };
  }
}

// 获取被吃棋子列表（根据当前FEN与初始数量对比推断）
const getCapturedPieces = (playerColor: 'white' | 'black') => {
  const fen = gameState.value?.board;
  if (!fen) return [] as string[];
  const boardPart = fen.split(' ')[0];
  const counts = countPiecesFromBoardPart(boardPart);
  const result: string[] = [];

  if (playerColor === 'white') {
    const init = initialCountsFor('black');
    const mapping: [keyof typeof init, string][] = [
      ['q', 'q'], ['r', 'r'], ['b', 'b'], ['n', 'n'], ['p', 'p'], ['k', 'k']
    ];
    for (const [key, sym] of mapping) {
      const present = counts[key as string] || 0;
      const missing = (init as any)[key] - present;
      for (let i = 0; i < Math.max(0, missing); i++) result.push(sym);
    }
  } else {
    const init = initialCountsFor('white');
    const mapping: [keyof typeof init, string][] = [
      ['Q', 'Q'], ['R', 'R'], ['B', 'B'], ['N', 'N'], ['P', 'P'], ['K', 'K']
    ];
    for (const [key, sym] of mapping) {
      const present = counts[key as string] || 0;
      const missing = (init as any)[key] - present;
      for (let i = 0; i < Math.max(0, missing); i++) result.push(sym);
    }
  }
  return result;
};

// 获取棋子图片路径
const getPieceImage = (pieceSymbol: string) => {
  const pieceMap: { [key: string]: string } = {
    'K': 'king-white',
    'Q': 'queen-white', 
    'R': 'rook-white',
    'B': 'bishop-white',
    'N': 'knight-white',
    'P': 'pawn-white',
    'k': 'king-black',
    'q': 'queen-black',
    'r': 'rook-black', 
    'b': 'bishop-black',
    'n': 'knight-black',
    'p': 'pawn-black'
  };
  
  const pieceName = pieceMap[pieceSymbol] || 'pawn-white';
  return new URL(`../assets/pieces/${pieceName}.svg`, import.meta.url).href;
};

// 判断当前玩家是否能看见这个移动（已弃用，使用 canSeeMoveAtRound 替代）
// const canSeeMove = (move: any) => {
//   if (!roomStore.currentPlayer) return false;
//   
//   // 迷雾棋规则：只能看到自己的移动
//   return move.player === roomStore.currentPlayer.color;
// };

// 回放控制状态（暂时保留，明天实现逻辑）
// const currentMoveIndex = ref(0);
// const isAutoPlaying = ref(false);
// const autoPlayInterval = ref<number | null>(null);
// const isReplayMode = ref(false);

// 计算当前回合索引
// const currentRoundIndex = computed(() => {
//   return Math.floor(currentMoveIndex.value / 2);
// });

// 将移动历史按回合分组
const getRounds = () => {
  const moves = gameState.value?.moveHistory || [];
  const rounds = [];
  
  for (let i = 0; i < moves.length; i += 2) {
    const round: any = {};
    
    // 白方移动（偶数索引）
    if (i < moves.length && moves[i].player === 'white') {
      round.white = moves[i];
    }
    
    // 黑方移动（奇数索引）
    if (i + 1 < moves.length && moves[i + 1].player === 'black') {
      round.black = moves[i + 1];
    }
    
    rounds.push(round);
  }
  
  return rounds;
};

// 判断在指定回合是否能看见移动（考虑迷雾棋规则）
const canSeeMoveAtRound = (move: any) => {
  if (!roomStore.currentPlayer) return false;
  
  // 迷雾棋规则：只能看到自己的移动
  return move.player === roomStore.currentPlayer.color;
};

// 回放控制函数（明天实现）
// const goToStart = () => { ... };
// const stepBackward = () => { ... };
// const stepForward = () => { ... };
// const goToEnd = () => { ... };
// const toggleAutoPlay = () => { ... };
// const startAutoPlay = () => { ... };
// const stopAutoPlay = () => { ... };
// const updateBoardState = () => { ... };
// const reconstructBoardFromMoves = (moves: any[]) => { ... };
// const applyMoveToBoard = (board: string, move: any) => { ... };

// 组件销毁时清理（明天实现）
// onUnmounted(() => {
//   stopAutoPlay();
// });

const getGameStatusText = () => {
  if (!gameState.value) return '等待中';
  
  switch (gameState.value.gameStatus) {
    case 'waiting':
      return '等待玩家';
    case 'playing':
      return '游戏中';
    case 'finished':
      return '游戏结束';
    default:
      return '未知状态';
  }
};

const toggleSound = () => {
  const currentState = audioService.getEnabled();
  audioService.setEnabled(!currentState);
};

const showLeaveDialog = () => {
  // 检查游戏状态：只有在游戏进行中才需要确认
  if (gameState.value?.gameStatus === 'playing') {
    dialogType.value = 'leave-confirm';
    dialogTitle.value = '离开游戏';
    dialogMessage.value = '确定要离开游戏吗？';
    showDialog.value = true;
  } else {
    // 游戏未开始或已结束，直接离开
    directLeave();
  }
};

const confirmLeave = () => {
  directLeave();
  closeDialog();
};

const directLeave = () => {
  roomStore.leaveRoom();
  gameStore.resetGame();
  router.push('/');
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

function parseBoardPartToMatrix(boardPart: string): (string | null)[][] {
  const rows = boardPart.split('/');
  const matrix: (string | null)[][] = [];
  for (let r = 0; r < 8; r++) {
    const rowStr = rows[r];
    const row: (string | null)[] = [];
    for (const ch of rowStr) {
      if (ch >= '1' && ch <= '8') {
        const n = parseInt(ch);
        for (let i = 0; i < n; i++) row.push(null);
      } else {
        row.push(ch);
      }
    }
    matrix.push(row);
  }
  return matrix;
}

function matrixToBoardPart(matrix: (string | null)[][]): string {
  const parts: string[] = [];
  for (let r = 0; r < 8; r++) {
    let rowStr = '';
    let emptyCount = 0;
    for (let c = 0; c < 8; c++) {
      const cell = matrix[r][c];
      if (!cell) {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          rowStr += String(emptyCount);
          emptyCount = 0;
        }
        rowStr += cell;
      }
    }
    if (emptyCount > 0) rowStr += String(emptyCount);
    parts.push(rowStr);
  }
  return parts.join('/');
}

function notationToCoords(notation: string): { r: number; c: number } {
  const file = notation.charCodeAt(0) - 97; // a=0
  const rank = parseInt(notation[1], 10); // 1-8
  const r = 8 - rank;
  const c = file;
  return { r, c };
}

function getPrevPositionBoardPart(currentFen: string): string | null {
  const fenParts = currentFen.split(' ');
  if (fenParts.length === 0) return null;
  const boardPart = fenParts[0];
  const last = gameState.value?.moveHistory?.[gameState.value.moveHistory.length - 1];
  if (!last) return boardPart; // 没有历史就用当前

  // 还原上一步
  const matrix = parseBoardPartToMatrix(boardPart);
  const from = notationToCoords(last.from);
  const to = notationToCoords(last.to);

  // 目标格上的当前棋子（执行过最后一步后）
  const movedNow = matrix[to.r][to.c];
  // 处理升变：如果存在升变，则上一步原本是兵
  let originalMoved = movedNow;
  if ((last as any).promotion && movedNow) {
    const isWhite = movedNow === movedNow.toUpperCase();
    originalMoved = isWhite ? 'P' : 'p';
  }

  // 将棋子移回 from
  matrix[from.r][from.c] = originalMoved || null;
  // 清空 to
  matrix[to.r][to.c] = null;

  // 还原被吃子（如果有）
  const capturedSym: string | undefined = (last as any).captured;
  if (capturedSym) {
    matrix[to.r][to.c] = capturedSym;
  } else {
    // 如果没有提供被吃子信息，但对局由于吃王结束，则补上王
    const endedByKing = isKingCaptured(fenParts[0]);
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

  // 如果因为吃王结束，导出最后一步前的局面
  let fenToSave = fen;
  if (gameState.value?.gameStatus === 'finished') {
    const boardPart = fen.split(' ')[0];
    if (isKingCaptured(boardPart)) {
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

const confirmSurrender = () => {
  if (!room.value) return;
  
  gameStore.surrender(room.value.id);
  closeDialog();
};

// 复制完整的邀请链接
const copyInviteLink = async () => {
  if (!room.value) return;
  const text = `${window.location.origin}?room=${room.value.id}`;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
  } catch {}
};

// 只复制房间ID
const copyRoomIdOnly = async () => {
  if (!room.value) return;
  const text = room.value.id;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
  } catch {}
};

// 悔棋相关方法
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

const closeDialog = () => {
  showDialog.value = false;
  undoRequestPending.value = false;
};

// 显示弹窗的方法（供外部调用）
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
  // 针对“未开始”状态的友好提示
  if (message && (message.toLowerCase().includes('not in playing state') || message.includes('未开始'))) {
    dialogTitle.value = '游戏未开始';
    dialogMessage.value = '等待对手加入';
    showDialog.value = true;
    undoRequestPending.value = false;
    return;
  }
  // 根据消息内容设置不同的标题
  if (message.includes('对局已结束') || message.includes('请开始新游戏')) {
    dialogTitle.value = '对局结束';
  } else {
    dialogTitle.value = '无法悔棋';
  }
  dialogMessage.value = message;
  showDialog.value = true;
  undoRequestPending.value = false;
};

onMounted(() => {
  if (!room.value) {
    router.push('/');
    return;
  }
  
  // 设置当前玩家
  if (roomStore.currentPlayer) {
    gameStore.setCurrentPlayer(roomStore.currentPlayer);
  }
  
  // 设置游戏状态（放在设置当前玩家之后，便于应用迷雾）
  if (room.value.gameState) {
    gameStore.setGameState(room.value.gameState);
  }
  
  // 设置Socket监听器
  gameStore.setupSocketListeners();
  
  // 监听悔棋事件
  window.addEventListener('show-undo-request', (event: any) => {
    showUndoRequestDialog(event.detail.fromPlayer, event.detail.attemptsLeft);
  });
  
  window.addEventListener('show-undo-result', (event: any) => {
    showUndoResultDialog(event.detail.accepted);
  });
  
  window.addEventListener('show-undo-error', (event: any) => {
    showUndoErrorDialog(event.detail.message);
  });
  
  // 不再需要这个事件监听器，改为直接检查棋盘状态
});

// 游戏结束时的胜负状态
const isWinner = ref(false);
const gameEndReason = ref<'king-captured' | 'surrender'>('king-captured');

// 监听游戏结束
watch(gameState, (gs) => {
  if (!gs) return;
  if (gs.gameStatus === 'finished' && !showGameOver.value && gs.winner) {
    const myColor = roomStore.currentPlayer?.color;
    const isWin = myColor ? gs.winner === myColor : false;
    isWinner.value = isWin;
    
    // 设置标题和消息
    gameOverTitle.value = isWin ? 'Victory' : 'Defeat';
    
    // 通过检查FEN判断游戏结束原因
    const kingWasCaptured = isKingCaptured(gs.board);
    gameEndReason.value = kingWasCaptured ? 'king-captured' : 'surrender';
    
    // 根据结束原因和胜负设置中文消息
    if (gameEndReason.value === 'king-captured') {
      // 王被吃掉的情况
      if (isWin) {
        gameOverMessage.value = '恭喜你，吃掉了对面国王！';
      } else {
        gameOverMessage.value = '很抱歉，你被吃掉了国王！';
      }
    } else {
      // 认输的情况
      if (isWin) {
        gameOverMessage.value = '恭喜你，你赢了！';
      } else {
        gameOverMessage.value = '很抱歉，你输了！';
      }
    }
    
    // 同时触发背景闪烁效果和显示弹窗
    if (isWin) {
      isVictoryFlash.value = true;
    } else {
      isDefeatFlash.value = true;
    }
    showGameOver.value = true;
    
    // 2秒后停止背景闪烁，还原背景
    setTimeout(() => {
      isVictoryFlash.value = false;
      isDefeatFlash.value = false;
    }, 2000);
  }
});

const closeGameOver = () => {
  showGameOver.value = false;
};

// 检查FEN中是否缺少某种颜色的王（判断是否被吃掉）
const isKingCaptured = (fen: string): boolean => {
  const boardPart = fen.split(' ')[0]; // 取FEN的棋盘部分
  const hasWhiteKing = boardPart.includes('K');
  const hasBlackKing = boardPart.includes('k');
  
  // 如果任何一方的王不在棋盘上，说明被吃掉了
  return !hasWhiteKing || !hasBlackKing;
};

function toDatePGNString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

function mapCoordFog(coord: string): string {
  // 将标准 a1..h8 映射为 d4..k11（文件+3，行+3）
  if (!coord || coord.length < 2) return coord;
  const file = coord[0];
  const rankStr = coord.slice(1);
  const fileMapped = String.fromCharCode(file.charCodeAt(0) + 3);
  const rankMapped = (parseInt(rankStr, 10) + 3).toString();
  return `${fileMapped}${rankMapped}`;
}

function moveToChessComLAN(move: any): string {
  // 模仿示例：前缀非兵棋子字母(K,Q,R,B,N)，坐标使用自定义映射；
  // 非吃用 '-'，吃子用 'x'，若吃王则在末尾加 '#'
  const piece = (move.piece || '').toString();
  const isPawn = piece.toLowerCase() === 'p' || piece === '';
  const pieceLetterMap: Record<string, string> = { k: 'K', q: 'Q', r: 'R', b: 'B', n: 'N', p: '' };
  const prefix = isPawn ? '' : (pieceLetterMap[piece.toLowerCase()] || '');

  const fromOut = mapCoordFog(move.from);
  const toOut = mapCoordFog(move.to);

  const isCapture = !!move.captured;
  const delimiter = isCapture ? 'x' : '-';

  const capturedIsKing = move.captured === 'k' || move.captured === 'K';
  const checkOrMate = capturedIsKing ? '#' : '';

  const promo = move.promotion ? `=${String(move.promotion).toUpperCase()}` : '';

  return `${prefix}${fromOut}${delimiter}${toOut}${promo}${checkOrMate}`;
}

const confirmDownloadPgn = () => {
  const gs = gameState.value;
  if (!gs) { closeDialog(); return; }

  // 复制历史（迷雾棋：吃王结束应保留最后一步）
  const moves = [...(gs.moveHistory || [])];

  // 结果
  const result = gs.winner === 'white' ? '1-0' : gs.winner === 'black' ? '0-1' : gs.winner === 'draw' ? '1/2-1/2' : '*';

  // 玩家
  const whiteName = room.value?.players.find(p => p.color === 'white')?.name || 'White';
  const blackName = room.value?.players.find(p => p.color === 'black')?.name || 'Black';

  // 头部（加入 Variant 与 RuleVariants）
  const today = new Date();
  const headers = [
    `[Event "FogChess"]`,
    `[Site "Local"]`,
    `[Date "${toDatePGNString(today)}"]`,
    `[Round "-"]`,
    `[White "${whiteName}"]`,
    `[Black "${blackName}"]`,
    `[Result "${result}"]`,
    `[Variant "Fog of War"]`,
    `[RuleVariants "EnPassant FogOfWar Play4Mate"]`
  ];

  // 着法（每回合两步）
  const pgnMoves: string[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    const turn = Math.floor(i / 2) + 1;
    const whiteMove = moves[i] ? moveToChessComLAN(moves[i]) : '';
    const blackMove = moves[i + 1] ? moveToChessComLAN(moves[i + 1]) : '';
    pgnMoves.push(`${turn}. ${whiteMove}${blackMove ? ' ' + blackMove : ''}`.trim());
  }

  const pgn = headers.join('\n') + `\n\n` + pgnMoves.join(' ');

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
</script>

<style scoped>
.game-container {
  height: 100vh;
  background: #9ca8b8;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.game-header {
  background: white;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.room-info h2 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 26px;
}

.room-info-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 15px;
}

.room-id, .invite-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 17px;
  gap: 20px;
}

/* 移除房间ID代码块样式，因为不再显示 */

.copy-btn {
  padding: 8px 14px;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 15px;
  transition: background-color 0.3s ease;
}

.copy-btn:hover {
  background: #1976D2;
}

.invite-btn {
  background: #4CAF50;
}

.invite-btn:hover {
  background: #45a049;
}

/* 自定义悬浮提示框 */
.tooltip-container {
  position: relative;
  display: inline-block;
}

.tooltip {
  position: absolute;
  top: 50%;
  left: 100%;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
  z-index: 1000;
  margin-left: 8px;
}

.tooltip::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 100%;
  transform: translateY(-50%);
  border: 5px solid transparent;
  border-right-color: rgba(0, 0, 0, 0.9);
}

.tooltip-container:hover .tooltip {
  opacity: 1;
  visibility: visible;
}

.players {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.player-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-radius: 20px;
  background: #f0f2f5;
  transition: all 0.3s ease;
  font-size: 15px;
  min-width: 320px; /* 进一步增加最小宽度 */
}

.player-row.current-player {
  background: #e3f2fd;
  border: 2px solid #2196F3;
}

.player-row.winner {
  background: rgba(76, 175, 80, 0.3); /* 半透明绿色 */
  border: 2px solid rgba(76, 175, 80, 0.6);
}

.player-row.loser {
  background: rgba(244, 67, 54, 0.3); /* 半透明红色 */
  border: 2px solid rgba(244, 67, 54, 0.6);
}

.player-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0; /* allow remaining space for captured pieces */
}

.captured-pieces {
  display: flex;
  align-items: center;
  gap: 0;
  white-space: nowrap; /* keep in one line */
  flex: 0 0 auto;
  max-width: 250px; /* 进一步增加最大宽度以显示更多棋子 */
}

.captured-piece {
  width: 21px;
  height: 21px;
  object-fit: contain;
  filter: drop-shadow(1px 1px 1px rgba(0, 0, 0, 0.3));
  transition: all 0.2s ease;
  margin-left: -6px; /* slight overlap */
}

.captured-piece:first-child {
  margin-left: 0;
}

.captured-piece:hover {
  transform: scale(1.1);
}

.player-color {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid #333;
}

.player-color.white {
  background: white;
}

.player-color.black {
  background: black;
}

.turn-indicator {
  font-size: 15px;
  color: #2196F3;
  font-weight: bold;
}

.game-controls {
  display: flex;
  gap: 10px;
}

.sound-button {
  padding: 12px 20px;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  font-size: 16px;
}

.sound-button:hover {
  background: #45a049;
}

.sound-button.sound-off {
  background: #757575;
}

.sound-button.sound-off:hover {
  background: #616161;
}

.leave-button {
  padding: 12px 20px;
  background: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  font-size: 16px;
}

.leave-button:hover {
  background: #d32f2f;
}

.undo-button {
  padding: 12px 20px;
  background: #ff9800;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  margin-right: 10px;
  font-size: 16px;
}

.undo-button:hover:not(:disabled) {
  background: #f57c00;
}

.undo-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.surrender-button {
  padding: 12px 20px;
  background: #ff5722;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  margin-right: 10px;
  font-size: 16px;
}

.surrender-button:hover {
  background: #e64a19;
}

.download-button {
  padding: 12px 20px;
  background: #607d8b;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  font-size: 16px;
}

.download-button:hover {
  background: #546e7a;
}

.download-button.secondary {
  background: #455a64;
}

.download-button.secondary:hover {
  background: #37474f;
}

.game-content {
  flex: 1;
  display: flex;
  gap: 20px;
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.chess-container {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.game-sidebar {
  width: 360px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.game-status, .move-history {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.game-status h3, .move-history h3 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 20px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
  font-size: 15px;
}

.status-item:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.label {
  font-weight: bold;
  color: #666;
}

.value {
  color: #333;
}

.current-player-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.turn-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.turn-dot.my-turn {
  background-color: #478058;
  box-shadow: 0 0 8px rgba(71, 128, 88, 0.4);
}

.turn-dot.opponent-turn {
  background-color: #999;
}

.moves-list {
  max-height: 250px;
  overflow-y: auto;
}

.move-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  border-bottom: 1px solid #eee;
  font-size: 14px;
}

.move-item:last-child {
  border-bottom: none;
}

.move-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 2px solid #ddd;
  font-weight: bold;
  font-size: 14px;
  color: #333;
  background: #f8f9fa;
  border-radius: 6px 6px 0 0;
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-round {
  font-weight: bold;
  color: #333;
  min-width: 35px;
  font-size: 14px;
}

.header-white, .header-black {
  flex: 1;
  text-align: center;
  font-size: 14px;
}

/* 回放控制按钮样式 */
.replay-controls {
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: #f8f9fa;
  border-top: 1px solid #ddd;
  border-radius: 0 0 8px 8px;
  margin-top: 10px;
}

.replay-btn {
  width: 50px;
  height: 50px;
  border: none;
  border-radius: 50%;
  background: #6c757d;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
}

.replay-btn:hover:not(:disabled) {
  background: #5a6268;
  transform: scale(1.05);
}

.replay-btn:disabled {
  background: #adb5bd;
  cursor: not-allowed;
  transform: none;
}

.replay-btn.play-btn {
  background: #28a745;
}

.replay-btn.play-btn:hover:not(:disabled) {
  background: #218838;
}

.replay-btn.play-btn.playing {
  background: #dc3545;
}

.replay-btn.play-btn.playing:hover:not(:disabled) {
  background: #c82333;
}

.replay-icon {
  width: 24px;
  height: 24px;
  filter: brightness(0) invert(1); /* 将SVG图标变为白色 */
  transition: all 0.2s ease;
}

.replay-btn:hover:not(:disabled) .replay-icon {
  transform: scale(1.1);
}

.replay-btn:disabled .replay-icon {
  opacity: 0.5;
}

/* 当前回合高亮（明天实现） */
/* .move-item.active-round {
  background: #e3f2fd;
  border-left: 4px solid #2196F3;
} */

.move-number {
  font-weight: bold;
  color: #666;
  min-width: 35px;
  font-size: 14px;
}

.move-columns {
  display: flex;
  flex: 1;
  gap: 8px;
}

.move-column {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 20px;
}

.move-notation {
  font-family: monospace;
  font-size: 14px;
  color: #495057;
  font-weight: 500;
}

.move-hidden {
  color: #adb5bd;
  font-size: 16px;
  font-weight: bold;
}

.move-player {
  font-size: 14px;
  color: #666;
  padding: 4px 10px;
  background: #f0f0f0;
  border-radius: 10px;
}

@media (max-width: 768px) {
  .game-content {
    flex-direction: column;
  }
  
  .game-sidebar {
    width: 100%;
  }
  
  .game-header {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }
  
  .players {
    justify-content: center;
  }
}

/* 统一弹窗样式 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.dialog-content {
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: 90%;
  text-align: center;
}

.dialog-content h3 {
  margin: 0 0 20px 0;
  color: #333;
  font-size: 26px;
  font-weight: 600;
}

/* 游戏结束弹窗标题颜色 */
.victory-title {
  color: #4CAF50 !important;
  text-shadow: 0 0 10px rgba(76, 175, 80, 0.3);
}

.defeat-title {
  color: #f44336 !important;
  text-shadow: 0 0 10px rgba(244, 67, 54, 0.3);
}

.dialog-content p {
  margin: 0 0 30px 0;
  color: #666;
  line-height: 1.6;
  font-size: 18px;
}

.dialog-buttons {
  display: flex;
  gap: 15px;
  justify-content: center;
}

.dialog-buttons button {
  padding: 14px 28px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 17px;
  font-weight: 500;
  transition: all 0.3s ease;
  min-width: 110px;
}

.confirm-btn {
  background: #4CAF50;
  color: white;
}

.confirm-btn:hover {
  background: #45a049;
}

.cancel-btn {
  background: #f44336;
  color: white;
}

.cancel-btn:hover {
  background: #da190b;
}

.accept-btn {
  background: #4CAF50;
  color: white;
}

.accept-btn:hover {
  background: #45a049;
}

.reject-btn {
  background: #f44336;
  color: white;
}

.reject-btn:hover {
  background: #da190b;
}

.ok-btn {
  background: #2196F3;
  color: white;
}

.ok-btn:hover {
  background: #1976D2;
}

/* 背景闪烁效果 */
.game-container {
  position: relative;
  transition: all 0.3s ease;
}

.game-container::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 500;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.game-container.victory-flash::before {
  background: rgba(76, 175, 80, 0.6);
  backdrop-filter: blur(2px);
  opacity: 1;
  animation: victoryPulse 2s ease-in-out;
}

.game-container.defeat-flash::before {
  background: rgba(244, 67, 54, 0.6);
  backdrop-filter: blur(2px);
  opacity: 1;
  animation: defeatPulse 2s ease-in-out;
}

@keyframes victoryPulse {
  0% { opacity: 0; background: rgba(76, 175, 80, 0); }
  25% { opacity: 1; background: rgba(76, 175, 80, 0.7); }
  50% { opacity: 1; background: rgba(76, 175, 80, 0.6); }
  75% { opacity: 1; background: rgba(76, 175, 80, 0.5); }
  100% { opacity: 0; background: rgba(76, 175, 80, 0); }
}

@keyframes defeatPulse {
  0% { opacity: 0; background: rgba(244, 67, 54, 0); }
  25% { opacity: 1; background: rgba(244, 67, 54, 0.7); }
  50% { opacity: 1; background: rgba(244, 67, 54, 0.6); }
  75% { opacity: 1; background: rgba(244, 67, 54, 0.5); }
  100% { opacity: 0; background: rgba(244, 67, 54, 0); }
}
</style>
