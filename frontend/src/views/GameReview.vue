<template>
  <div>
    <div class="game-container">
      <div class="game-content">
        <div class="dual-board-wrapper" :style="{ '--review-board-size': reviewBoardSize }">
          <div class="board-section primary-board">
            <div class="board-header">
              <h3>{{ t('review.board.primary') }}</h3>
              <span class="board-subtitle">{{ viewModeLabel }}</span>
            </div>
            <ChessBoard />
          </div>
          <div class="board-section god-board">
            <div class="board-header">
              <h3>{{ t('review.board.god') }}</h3>
              <span class="board-subtitle">{{ t('review.viewMode.god') }}</span>
            </div>
            <StaticChessBoard
              :fen="godViewFen"
              :last-move-squares="lastMoveSquares"
              :size="reviewBoardSize"
            />
          </div>
        </div>
        
        <div class="game-sidebar">
          <GameStatusCard :game-state="gameState" :is-my-turn="false" />
          
          <MoveHistory 
            :moves="gameState?.moveHistory || []" 
            :current-player-color="viewingPlayerColor" 
            reveal-all 
          />

          <!-- 回放控制按钮 -->
          <ReplayControls 
            :total-moves="totalMoves"
            :current-move-index="currentMoveIndex"
            :show-notice="false"
            @goToStart="goToStart"
            @stepBackward="stepBackward"
            @stepForward="stepForward"
            @goToEnd="goToEnd"
          />
        </div>
      </div>
      
      <GameHeader 
        :room="reviewRoom"
        :game-state="gameState"
        :current-player-color="viewingPlayerColor"
        :get-captured-pieces="getCapturedPieces"
        :get-piece-image="getPieceImage"
        :players="playersForHeader"
      >
        <div class="review-actions">
          <!-- 视野切换按钮组 -->
          <div class="view-mode-buttons">
            <button 
              @click="setViewMode('white')" 
              class="view-mode-btn"
              :class="{ active: viewMode === 'white' }"
              :title="t('review.viewMode.white')"
            >
              ⚪
            </button>
            <button 
              @click="setViewMode('black')" 
              class="view-mode-btn"
              :class="{ active: viewMode === 'black' }"
              :title="t('review.viewMode.black')"
            >
              ⚫
            </button>
            <button 
              @click="setViewMode('alternating')" 
              class="view-mode-btn"
              :class="{ active: viewMode === 'alternating' }"
              :title="t('review.viewMode.alternating')"
            >
              🔄
            </button>
          </div>

          <div class="review-action-buttons">
            <button
              class="sound-button"
              :class="{ 'sound-off': !soundEnabled }"
              @click="toggleSound"
              :title="t('actions.sound')"
            >
              {{ soundEnabled ? '🔊' : '🔇' }}
            </button>

            <button @click="goBack" class="back-button">
              ← {{ t('lobby.backToHome') || '返回' }}
            </button>
          </div>
        </div>
      </GameHeader>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useGameStore } from '../stores/game';
import { useAuthStore } from '../stores/auth';
import { chessService } from '../services/chess';
import { ReplayService } from '../services/replay';
import { animationService } from '../services/animation';
import { audioService } from '../services/audio';
import ChessBoard from '../components/chess/ChessBoard.vue';
import StaticChessBoard from '../components/chess/StaticChessBoard.vue';
import ReplayControls from '../components/replay/ReplayControls.vue';
import MoveHistory from '../components/history/MoveHistory.vue';
import GameStatusCard from '../components/status/GameStatusCard.vue';
import GameHeader from '../components/game/GameHeader.vue';
import { t } from '../services/i18n';
import type { GameState, Move, Room, Player } from '../types';
import { getCapturedPiecesForColor, getPieceImageBySymbol } from '../utils/captured';
import './Game.css';

const router = useRouter();
const route = useRoute();
const gameStore = useGameStore();
const authStore = useAuthStore();

interface DisplayPlayer extends Player {
  label?: string;
  rating?: number;
  isAi?: boolean;
}

// 标准开局 FEN（所有已完成的对局都从标准开局开始）
const STANDARD_STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const gameId = computed(() => route.params.gameId as string);
const gameData = ref<any>(null);
const gameState = ref<GameState | null>(null);
const reviewRoom = ref<Room | null>(null);
const viewingPlayerColor = ref<'white' | 'black'>('white');
const currentMoveIndex = ref(0);
const hasProgressChanged = ref(false);
const soundEnabled = ref(true);
const loading = ref(true);
const viewMode = ref<'white' | 'black' | 'alternating'>(gameStore.viewModePreference === 'auto' ? 'alternating' : gameStore.viewModePreference);
gameStore.setViewModePreference(viewMode.value);
const godViewFen = ref(STANDARD_STARTING_FEN);
const reviewBoardSize = 'min(60vh, 36vw, 420px)';

const apiBase = (import.meta as any).env?.VITE_API_URL || '';
const playerRatings = ref<Record<number, number>>({});

const fetchPlayerRatings = async (ids: number[]) => {
  if (!ids.length) return;
  try {
    const uniqueIds = Array.from(new Set(ids.filter(id => id > 0)));
    const query = uniqueIds.join(',');
    const url = apiBase ? `${apiBase}/user/ratings?ids=${query}` : `/api/user/ratings?ids=${query}`;
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error(`Failed to load ratings: ${response.status}`);
    }
    const data = await response.json();
    const nextRatings: Record<number, number> = { ...playerRatings.value };
    const rows: Array<{ id: number | string; rating: number }> = data.ratings || [];
    rows.forEach(row => {
      const userId =
        typeof row.id === 'string' ? parseInt(row.id, 10) : row.id;
      if (Number.isFinite(userId) && typeof row.rating === 'number' && Number.isFinite(row.rating)) {
        nextRatings[userId] = row.rating;
      }
    });
    playerRatings.value = nextRatings;
  } catch (error) {
    console.error('Failed to fetch review player ratings:', error);
  }
};
const totalMoves = computed(() => {
  return gameState.value?.moveHistory?.length || 0;
});

const lastMoveSquares = computed(() => {
  const moves = gameState.value?.moveHistory || [];
  if (!moves.length || currentMoveIndex.value === 0) return [];
  const index = Math.min(currentMoveIndex.value, moves.length);
  const lastMove = moves[index - 1];
  if (!lastMove) return [];
  const squares: string[] = [];
  if (lastMove.from) squares.push(lastMove.from);
  if (lastMove.to) squares.push(lastMove.to);
  return squares;
});

const viewModeLabel = computed(() => {
  switch (viewMode.value) {
    case 'white':
      return t('review.viewMode.white');
    case 'black':
      return t('review.viewMode.black');
    default:
      return t('review.viewMode.alternating');
  }
});

const getViewerColor = (): 'white' | 'black' => {
  if (viewMode.value === 'white') return 'white';
  if (viewMode.value === 'black') return 'black';
  return (gameState.value?.currentPlayer || 'white') as 'white' | 'black';
};

const applyPerspective = (color: 'white' | 'black') => {
  gameStore.setCurrentPlayer({
    id: `review-${color}`,
    name: color,
    color,
    socketId: ''
  });
  gameStore.setViewModePreference(viewMode.value);
};

const getCapturedPieces = (playerColor: 'white' | 'black') => {
  if (!gameState.value) return [];
  return getCapturedPiecesForColor(gameState.value.board, playerColor);
};

const getPieceImage = (pieceSymbol: string) => {
  return getPieceImageBySymbol(pieceSymbol);
};

const playersForHeader = computed<DisplayPlayer[]>(() => {
  if (!reviewRoom.value) return [];
  return reviewRoom.value.players.map(player => {
    const isAi = !player.mainUserId || player.mainUserId <= 0;
    const rating =
      !isAi && typeof player.mainUserId === 'number'
        ? playerRatings.value[player.mainUserId] 
        : undefined;
    const isViewer = player.mainUserId && player.mainUserId === authStore.user?.id;
    const name = player.name || (isViewer ? authStore.user?.username : '') || t('header.opponent');
    const label = !isAi && typeof rating === 'number' ? `${name}: ${rating}` : name;
    return { ...player, isAi, rating, label };
  });
});

const goBack = () => {
  router.push('/profile');
};

const toggleSound = () => {
  const newState = !soundEnabled.value;
  audioService.setEnabled(newState);
  soundEnabled.value = newState;
};

const setViewMode = (mode: 'white' | 'black' | 'alternating') => {
  viewMode.value = mode;
  gameStore.setViewModePreference(mode);
  if (gameState.value) {
    applyFogForCurrentView();
  }
};

const applyFogForCurrentView = () => {
  if (!gameState.value) return;

  const boardPart = gameState.value.board.split(' ')[0];
  const viewerColor = getViewerColor();

  let fog: { whiteVisible: string[]; blackVisible: string[] };
  if (viewMode.value === 'white') {
    fog = ReplayService.calculateBasicVisibility(boardPart, 'white');
  } else if (viewMode.value === 'black') {
    fog = ReplayService.calculateBasicVisibility(boardPart, 'black');
  } else {
    fog = ReplayService.calculateBasicVisibility(boardPart, viewerColor);
  }

  const updatedGameState: GameState = {
    ...gameState.value,
    fogOfWar: {
      ...fog,
      lastKnownPositions: { white: {}, black: {} }
    }
  };

  gameState.value = updatedGameState;
  gameStore.setGameState(updatedGameState);
  godViewFen.value = updatedGameState.board;
  applyPerspective(viewerColor);
  gameStore.setViewModePreference(viewMode.value);
};

const goToStart = async () => {
  if (totalMoves.value === 0) return;
  currentMoveIndex.value = 0;
  hasProgressChanged.value = true;
  await updateBoardForMoves(0);
};

const stepBackward = async () => {
  if (totalMoves.value === 0) return;
  if (currentMoveIndex.value > 0) {
    const prevIndex = currentMoveIndex.value; // 保存旧的索引
    currentMoveIndex.value -= 1;
    hasProgressChanged.value = true;
    await updateBoardForMoves(currentMoveIndex.value, prevIndex);
  }
};

const stepForward = async () => {
  if (currentMoveIndex.value < totalMoves.value) {
    const prevIndex = currentMoveIndex.value; // 保存旧的索引
    const newIndex = prevIndex + 1;
    currentMoveIndex.value = newIndex;
    hasProgressChanged.value = true;
    // 始终使用 updateBoardForMoves 来播放动画，包括最后一步
    await updateBoardForMoves(newIndex, prevIndex);
  }
};

const goToEnd = async () => {
  if (totalMoves.value === 0) return;
  currentMoveIndex.value = totalMoves.value;
  hasProgressChanged.value = true;
  
  // 显示最终状态（使用 final_fen 或从移动历史重建）
  if (gameState.value && gameData.value) {
    const moves: Move[] = gameState.value.moveHistory || [];
    
    let finalFen: string;
    if (gameData.value.final_fen) {
      // 使用保存的最终 FEN
      finalFen = gameData.value.final_fen;
    } else if (moves.length > 0) {
      // 从标准开局和移动历史重建最终状态
      const startingBoardPart = STANDARD_STARTING_FEN.split(' ')[0];
      const boardPart = ReplayService.reconstructBoardFromMoves(moves, moves.length, startingBoardPart);
      const lastMove = moves[moves.length - 1];
      const currentPlayer = lastMove.player === 'white' ? 'black' : 'white';
      finalFen = boardPart + ` ${currentPlayer === 'white' ? 'w' : 'b'} KQkq - 0 1`;
    } else {
      finalFen = STANDARD_STARTING_FEN;
    }
    
    chessService.setBoardFromFen(finalFen);
    
    // 更新游戏状态
    const newGameState: GameState = {
      ...gameState.value,
      board: finalFen,
      currentPlayer: (moves.length > 0 ? (moves[moves.length - 1].player === 'white' ? 'black' : 'white') : 'white') as 'white' | 'black'
    };
    gameState.value = newGameState;
    gameStore.setGameState(newGameState);
    
    // 应用当前视野模式
    applyFogForCurrentView();
  }
};

async function updateBoardForMoves(movesApplied: number, prevIndexOverride?: number) {
  if (!gameState.value || !gameData.value) return;
  const moves: Move[] = gameState.value.moveHistory || [];
  const upToIndex = Math.min(moves.length, movesApplied);

  const startingBoardPart = STANDARD_STARTING_FEN.split(' ')[0];
  
  let boardPart: string;
  if (upToIndex === 0) {
    // 显示初始状态（标准棋盘）
    boardPart = startingBoardPart;
  } else {
    // 从标准开局开始重建到指定步数
    boardPart = ReplayService.reconstructBoardFromMoves(moves, upToIndex, startingBoardPart);
  }

  // 使用传入的 prevIndexOverride（如果提供），否则使用 currentMoveIndex.value
  const prevIndex = prevIndexOverride !== undefined ? prevIndexOverride : currentMoveIndex.value;
  
  // 如果是从历史状态向前移动，播放动画和音效
  if (movesApplied > prevIndex && upToIndex > prevIndex) {
    const movesToAnimate = moves.slice(prevIndex, upToIndex);
    for (let i = 0; i < movesToAnimate.length; i++) {
      const move = movesToAnimate[i];
      const moveIndex = prevIndex + i;
      
      // 先更新棋盘到移动前的状态（用于动画）
      let beforeMoveFen: string;
      if (moveIndex > 0) {
        const beforeBoardPart = ReplayService.reconstructBoardFromMoves(moves, moveIndex, STANDARD_STARTING_FEN.split(' ')[0]);
        const beforePlayer = moves[moveIndex - 1]?.player === 'white' ? 'black' : 'white';
        beforeMoveFen = beforeBoardPart + ` ${beforePlayer === 'white' ? 'w' : 'b'} KQkq - 0 1`;
      } else {
        beforeMoveFen = STANDARD_STARTING_FEN;
      }
      
      chessService.setBoardFromFen(beforeMoveFen);
      gameStore.setGameState({
        ...gameState.value,
        board: beforeMoveFen
      });
      
      // 等待一小段时间让DOM更新
      await new Promise(resolve => setTimeout(resolve, 10));
      
      if (soundEnabled.value) {
        // 播放移动音效
        if (move.captured) {
          audioService.playCaptureSound();
        } else {
          audioService.playMoveSound();
        }
      }
      
      // 播放移动动画
      try {
        await animationService.animateMove(move.from, move.to, { duration: 150 });
      } catch (error) {
        console.warn('Animation failed:', error);
      }
      
      // 动画后更新棋盘到移动后的状态
      // 注意：在动画循环中，我们只更新到当前移动后的状态，不提前到达最终目标
      // 最终的棋盘状态会在循环结束后统一更新
      const afterMoveIndex = moveIndex + 1;
      const afterBoardPart = ReplayService.reconstructBoardFromMoves(moves, afterMoveIndex, STANDARD_STARTING_FEN.split(' ')[0]);
      // 确定当前玩家：如果 afterMoveIndex 还没有到达 moves.length，说明还有下一步，当前玩家是下一步的玩家
      // 否则，当前玩家是最后一步移动的玩家的对手
      const afterPlayer = afterMoveIndex < moves.length ? 
        (moves[afterMoveIndex].player === 'white' ? 'black' : 'white') : 
        (moves[moveIndex].player === 'white' ? 'black' : 'white');
      const afterMoveFen = afterBoardPart + ` ${afterPlayer === 'white' ? 'w' : 'b'} KQkq - 0 1`;
      chessService.setBoardFromFen(afterMoveFen);
      // 只更新棋盘显示，不更新 gameState（等循环结束后统一更新）
      gameStore.setGameState({
        ...gameState.value,
        board: afterMoveFen
      });
    }
    
    // 如果已经播放了所有动画，直接返回，避免循环结束后再次更新棋盘状态
    // 这样可以确保最后一步的动画结果不会被覆盖
    if (upToIndex === moves.length && movesApplied === moves.length) {
      // 确定当前玩家（游戏已结束，显示最后一步移动的玩家的对手）
      const lastMove = moves[moves.length - 1];
      const currentPlayer = lastMove.player === 'white' ? 'black' : 'white';
      
      // 使用 final_fen 或重建的最终状态
      let finalFen: string;
      if (gameData.value.final_fen) {
        finalFen = gameData.value.final_fen;
      } else {
        const finalBoardPart = ReplayService.reconstructBoardFromMoves(moves, moves.length, STANDARD_STARTING_FEN.split(' ')[0]);
        finalFen = finalBoardPart + ` ${currentPlayer === 'white' ? 'w' : 'b'} KQkq - 0 1`;
      }
      
      const newGameState: GameState = {
        ...gameState.value,
        board: finalFen,
        currentPlayer: currentPlayer as 'white' | 'black'
      };
      
      gameState.value = newGameState;
      gameStore.setGameState(newGameState);
      applyFogForCurrentView();
      return;
    }
  } 
  // 如果是从历史状态向后移动，播放反向动画
  else if (movesApplied < prevIndex && upToIndex < prevIndex) {
    // 从后往前遍历需要撤销的移动
    const movesToUndo = moves.slice(upToIndex, prevIndex);
    // 反转顺序，从最后一个移动开始撤销
    for (let i = movesToUndo.length - 1; i >= 0; i--) {
      const move = movesToUndo[i];
      const moveIndex = upToIndex + i;
      
      // 先显示移动后的状态（用于反向动画）
      const afterMoveIndex = moveIndex + 1;
      const afterBoardPart = ReplayService.reconstructBoardFromMoves(moves, afterMoveIndex, STANDARD_STARTING_FEN.split(' ')[0]);
      const afterPlayer = afterMoveIndex < moves.length ? 
        (moves[afterMoveIndex].player === 'white' ? 'black' : 'white') : 
        (moves[moveIndex].player === 'white' ? 'black' : 'white');
      const afterMoveFen = afterBoardPart + ` ${afterPlayer === 'white' ? 'w' : 'b'} KQkq - 0 1`;
      
      chessService.setBoardFromFen(afterMoveFen);
      gameStore.setGameState({
        ...gameState.value,
        board: afterMoveFen
      });
      
      // 等待一小段时间让DOM更新
      await new Promise(resolve => setTimeout(resolve, 10));
      
      if (soundEnabled.value) {
        // 播放移动音效（反向移动也用同样的音效）
        if (move.captured) {
          audioService.playCaptureSound();
        } else {
          audioService.playMoveSound();
        }
      }
      
      // 播放反向移动动画（从 to 到 from）
      try {
        await animationService.animateMove(move.to, move.from, { duration: 150 });
      } catch (error) {
        console.warn('Animation failed:', error);
      }
      
      // 动画后更新棋盘到移动前的状态
      let beforeMoveFen: string;
      if (moveIndex > 0) {
        const beforeBoardPart = ReplayService.reconstructBoardFromMoves(moves, moveIndex, STANDARD_STARTING_FEN.split(' ')[0]);
        const beforePlayer = moves[moveIndex - 1]?.player === 'white' ? 'black' : 'white';
        beforeMoveFen = beforeBoardPart + ` ${beforePlayer === 'white' ? 'w' : 'b'} KQkq - 0 1`;
      } else {
        beforeMoveFen = STANDARD_STARTING_FEN;
      }
      
      chessService.setBoardFromFen(beforeMoveFen);
      // 只更新棋盘显示，不更新 gameState（等循环结束后统一更新）
      gameStore.setGameState({
        ...gameState.value,
        board: beforeMoveFen
      });
    }
  }
  
  // 确定当前玩家（如果还有未应用的移动，显示下一步移动的玩家）
  const currentPlayer = upToIndex < moves.length ? moves[upToIndex].player : 
                        (upToIndex === 0 ? 'white' : (moves[upToIndex - 1]?.player === 'white' ? 'black' : 'white'));
  
  // 更新棋盘到目标状态（使用完整的 FEN）
  const fullFen = boardPart + ` ${currentPlayer === 'white' ? 'w' : 'b'} KQkq - 0 1`;
  chessService.setBoardFromFen(fullFen);
  
  // 更新游戏状态
  const newGameState: GameState = {
    ...gameState.value,
    board: fullFen,
    currentPlayer: currentPlayer as 'white' | 'black'
  };
  
  gameState.value = newGameState;
  // 更新 gameStore 以便 ChessBoard 能正确渲染
  gameStore.setGameState(newGameState);
  
  // 应用当前视野模式
  applyFogForCurrentView();
}

const fetchGameDetails = async () => {
  try {
    const url = apiBase ? `${apiBase}/game/${gameId.value}` : `/api/game/${gameId.value}`;
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to load game: ${response.status}`);
    }
    
    const data = await response.json();
    gameData.value = data.game;
    
    // 解析移动历史
    let moves: Move[] = [];
    if (gameData.value.moves) {
      if (typeof gameData.value.moves === 'string') {
        moves = JSON.parse(gameData.value.moves);
      } else if (Array.isArray(gameData.value.moves)) {
        moves = gameData.value.moves;
      }
    }
    
    // 确保 moves 格式正确（包含必要的字段）
    moves = moves.map((move: any) => ({
      from: move.from,
      to: move.to,
      piece: move.piece,
      captured: move.captured,
      promotion: move.promotion,
      timestamp: move.timestamp ? new Date(move.timestamp) : new Date(),
      player: move.player || (move.piece && /[A-Z]/.test(move.piece) ? 'white' : 'black')
    }));
    
    // 确定当前用户是白方还是黑方
    const isWhite = authStore.user?.username === gameData.value.white_name;
    viewingPlayerColor.value = isWhite ? 'white' : 'black';
    
    // 创建 Room 对象用于显示
    reviewRoom.value = {
      id: gameData.value.id,
      name: `${t('review.title')}: ${gameData.value.white_name} VS ${gameData.value.black_name}`,
      players: [
        { id: 'white', name: gameData.value.white_name, color: 'white', socketId: '', mainUserId: gameData.value.white_user_id ?? undefined },
        { id: 'black', name: gameData.value.black_name, color: 'black', socketId: '', mainUserId: gameData.value.black_user_id ?? undefined }
      ],
      spectators: [],
      gameState: {
        board: gameData.value.final_fen || STANDARD_STARTING_FEN,
        currentPlayer: 'white',
        gameStatus: 'finished',
        moveHistory: moves,
        fogOfWar: {
          whiteVisible: [],
          blackVisible: [],
          lastKnownPositions: { white: {}, black: {} }
        },
        winner: gameData.value.result === 'white' ? 'white' : 
                gameData.value.result === 'black' ? 'black' : 
                gameData.value.result === 'draw' ? 'draw' : undefined
      },
      createdAt: new Date(gameData.value.finished_at),
      isFull: true
    };
    
    // 设置当前玩家（用于 ChessBoard 的视角判断）
    gameStore.setCurrentPlayer({
      id: String(authStore.user?.id || ''),
      name: authStore.user?.username || '',
      color: viewingPlayerColor.value,
      socketId: ''
    });

    const ratingIds: number[] = [];
    if (typeof gameData.value.white_user_id === 'number' && gameData.value.white_user_id > 0) {
      ratingIds.push(gameData.value.white_user_id);
    }
    if (typeof gameData.value.black_user_id === 'number' && gameData.value.black_user_id > 0) {
      ratingIds.push(gameData.value.black_user_id);
    }
    if (ratingIds.length) {
      await fetchPlayerRatings(ratingIds);
    }
    
    // 初始化游戏状态（所有已完成的对局都从标准开局开始）
    gameState.value = {
      board: STANDARD_STARTING_FEN,
      currentPlayer: 'white',
      gameStatus: 'finished',
      moveHistory: moves,
      fogOfWar: {
        whiteVisible: [],
        blackVisible: [],
        lastKnownPositions: { white: {}, black: {} }
      },
      winner: gameData.value.result === 'white' ? 'white' : 
              gameData.value.result === 'black' ? 'black' : 
              gameData.value.result === 'draw' ? 'draw' : undefined
    };
    
    // 默认从步骤0开始（初始棋盘状态）
    currentMoveIndex.value = 0;
    hasProgressChanged.value = false;
    
    // 显示初始状态（步骤0）
    await updateBoardForMoves(0);
    
  } catch (err) {
    console.error('Failed to fetch game details:', err);
    router.push('/profile');
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  if (!gameId.value) {
    router.push('/profile');
    return;
  }
  fetchGameDetails();
});

onUnmounted(() => {
  gameStore.setViewModePreference('auto');
});
</script>

<style scoped>
.review-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.review-action-buttons {
  display: flex;
  gap: 10px;
  align-items: center;
}

.view-mode-buttons {
  display: flex;
  gap: 8px;
}

.game-content {
  align-items: flex-start;
  gap: 28px;
}

.dual-board-wrapper {
  flex: 0 0 auto;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, max-content);
  gap: 28px;
  justify-content: center;
  align-items: start;
  padding-right: 10px;
}

.board-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: var(--review-board-size);
}

.board-header {
  text-align: center;
}

.board-header h3 {
  margin: 0;
  font-size: 20px;
  color: #333;
}

.board-subtitle {
  font-size: 14px;
  color: #666;
}

.primary-board :deep(.chess-board) {
  padding: 12px;
}

.primary-board :deep(.board-container) {
  width: var(--review-board-size);
  height: var(--review-board-size);
  max-width: 420px;
  max-height: 420px;
}

.god-board :deep(.board-wrapper) {
  width: var(--review-board-size);
  height: var(--review-board-size);
}

.view-mode-btn {
  padding: 8px 12px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.3s ease;
  white-space: nowrap;
  min-width: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.view-mode-btn:hover {
  background: #5a6268;
  transform: scale(1.05);
}

.view-mode-btn.active {
  background: #F9992C;
  box-shadow: 0 2px 8px rgba(249, 153, 44, 0.4);
}

@media (max-width: 1280px) {
  .dual-board-wrapper {
    grid-auto-flow: row;
    grid-template-columns: repeat(1, minmax(0, max-content));
    justify-content: center;
    padding-right: 0;
  }

  .primary-board :deep(.board-container) {
    width: min(60vh, 75vw, 360px);
    height: min(60vh, 75vw, 360px);
  }

  .god-board :deep(.board-wrapper) {
    width: min(60vh, 75vw, 360px);
    height: min(60vh, 75vw, 360px);
  }
}

@media (max-width: 768px) {
  .dual-board-wrapper {
    grid-auto-flow: row;
    grid-template-columns: repeat(1, minmax(0, max-content));
  }
}

.back-button {
  padding: 10px 16px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s ease;
  white-space: nowrap;
  font-family: 'Microsoft YaHei', '微软雅黑', 'PingFang SC', 'Hiragino Sans GB', '幼圆', 'YouYuan', sans-serif;
}

.back-button:hover {
  background: #5a6268;
}
</style>

