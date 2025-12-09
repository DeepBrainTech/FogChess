<template>
  <div class="demo-board-wrapper">
    <div class="demo-header">
      <h3>{{ t('rules.demo.title') }}</h3>
      <button @click="resetBoard" class="reset-btn">{{ t('rules.demo.reset') }}</button>
    </div>
    
    <div class="demo-turn-indicator" :class="{ 'game-over': gameWinner !== null }">
      <template v-if="gameWinner">
        <span class="winner-text">
          {{ gameWinner === 'white' ? t('rules.demo.whiteWins') : t('rules.demo.blackWins') }}
        </span>
      </template>
      <template v-else>
        {{ t('rules.demo.currentMove') }}: 
        <span :class="{ 'turn-white': currentTurn === 'white', 'turn-black': currentTurn === 'black' }">
          {{ currentTurn === 'white' ? t('rules.demo.white') : t('rules.demo.black') }}
        </span>
      </template>
    </div>
    
    <div class="demo-board-container">
      <div 
        class="demo-board"
        @pointerup="onBoardPointerUp"
        @pointermove="onBoardPointerMove"
      >
        <div v-for="row in 8" :key="`row-${row}`" class="demo-row">
          <div 
            v-for="col in 8" 
            :key="`col-${col}`"
            :class="getSquareClass(row - 1, col - 1)"
            @click="onSquareClick(row - 1, col - 1)"
            @pointerdown="onPointerDown(row - 1, col - 1, $event)"
          >
            <div v-if="getPiece(row - 1, col - 1)" class="demo-piece">
              <img 
                :src="getPieceImage(getPiece(row - 1, col - 1)!)" 
                :alt="getPiece(row - 1, col - 1)!.type"
                draggable="false"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 升变弹窗 -->
    <div v-if="showPromotionDialog" class="promotion-overlay" @click="showPromotionDialog = false">
      <div class="promotion-dialog" @click.stop>
        <h4>{{ t('rules.demo.promotion') }}</h4>
        <div class="promotion-options">
          <div 
            v-for="type in ['queen', 'rook', 'bishop', 'knight']" 
            :key="type"
            class="promotion-option"
            @click="selectPromotion(type as any)"
          >
            <img 
              :src="getPieceImage({ type: type as any, color: promotionColor! })" 
              :alt="type"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { t } from '../../services/i18n';

interface Piece {
  type: 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
  color: 'white' | 'black';
}

const board = ref<(Piece | null)[][]>([]);
const selectedSquare = ref<{ row: number; col: number } | null>(null);
const legalMoves = ref<string[]>([]);
const currentTurn = ref<'white' | 'black'>('white');
const gameWinner = ref<'white' | 'black' | null>(null);
const isDragging = ref(false);
const dragStartSquare = ref<{ row: number; col: number } | null>(null);
const dragGhost = ref<HTMLElement | null>(null);
let startX = 0;
let startY = 0;
const DRAG_THRESHOLD = 5;

// 记录上一步移动（用于过路兵）
const lastMove = ref<{ from: { row: number; col: number }; to: { row: number; col: number }; piece: Piece } | null>(null);

// 记录棋子是否移动过（用于王车易位）
const hasMoved = ref<{ [key: string]: boolean }>({});

// 升变相关
const showPromotionDialog = ref(false);
const promotionSquare = ref<{ row: number; col: number } | null>(null);
const promotionColor = ref<'white' | 'black' | null>(null);
const promotionMoveInfo = ref<{ fromRow: number; fromCol: number; toRow: number; toCol: number; piece: Piece } | null>(null);

// 初始化棋盘
const initBoard = () => {
  const newBoard: (Piece | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  
  // 设置黑方棋子（第0行和第1行）
  newBoard[0][0] = { type: 'rook', color: 'black' };
  newBoard[0][1] = { type: 'knight', color: 'black' };
  newBoard[0][2] = { type: 'bishop', color: 'black' };
  newBoard[0][3] = { type: 'queen', color: 'black' };
  newBoard[0][4] = { type: 'king', color: 'black' };
  newBoard[0][5] = { type: 'bishop', color: 'black' };
  newBoard[0][6] = { type: 'knight', color: 'black' };
  newBoard[0][7] = { type: 'rook', color: 'black' };
  for (let i = 0; i < 8; i++) {
    newBoard[1][i] = { type: 'pawn', color: 'black' };
  }
  
  // 设置白方棋子（第6行和第7行）
  for (let i = 0; i < 8; i++) {
    newBoard[6][i] = { type: 'pawn', color: 'white' };
  }
  newBoard[7][0] = { type: 'rook', color: 'white' };
  newBoard[7][1] = { type: 'knight', color: 'white' };
  newBoard[7][2] = { type: 'bishop', color: 'white' };
  newBoard[7][3] = { type: 'queen', color: 'white' };
  newBoard[7][4] = { type: 'king', color: 'white' };
  newBoard[7][5] = { type: 'bishop', color: 'white' };
  newBoard[7][6] = { type: 'knight', color: 'white' };
  newBoard[7][7] = { type: 'rook', color: 'white' };
  
  board.value = newBoard;
  selectedSquare.value = null;
  legalMoves.value = [];
  currentTurn.value = 'white';
  gameWinner.value = null;
  lastMove.value = null;
  hasMoved.value = {};
  showPromotionDialog.value = false;
  promotionSquare.value = null;
  promotionColor.value = null;
  promotionMoveInfo.value = null;
};

const resetBoard = () => {
  initBoard();
};

const getPiece = (row: number, col: number): Piece | null => {
  return board.value[row]?.[col] || null;
};

const getPieceImage = (piece: Piece): string => {
  return new URL(`../../assets/pieces/${piece.type}-${piece.color}.svg`, import.meta.url).href;
};

const toNotation = (row: number, col: number): string => {
  return `${String.fromCharCode(97 + col)}${8 - row}`;
};

const fromNotation = (notation: string): { row: number; col: number } => {
  const col = notation.charCodeAt(0) - 97;
  const row = 8 - parseInt(notation[1]);
  return { row, col };
};

// 检查某个位置是否被某方攻击
const isSquareUnderAttack = (row: number, col: number, byColor: 'white' | 'black'): boolean => {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = getPiece(r, c);
      if (piece && piece.color === byColor) {
        const attacks = getPseudoLegalMoves(r, c, false);
        if (attacks.includes(toNotation(row, col))) {
          return true;
        }
      }
    }
  }
  return false;
};

// 检查某方是否被将军
const isInCheck = (color: 'white' | 'black'): boolean => {
  // 找到国王位置
  let kingRow = -1, kingCol = -1;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = getPiece(r, c);
      if (piece && piece.type === 'king' && piece.color === color) {
        kingRow = r;
        kingCol = c;
        break;
      }
    }
    if (kingRow >= 0) break;
  }
  if (kingRow < 0) return false;
  
  const enemyColor = color === 'white' ? 'black' : 'white';
  return isSquareUnderAttack(kingRow, kingCol, enemyColor);
};

// 模拟移动并检查是否会导致自己被将军
const wouldBeInCheckAfterMove = (fromRow: number, fromCol: number, toRow: number, toCol: number): boolean => {
  const piece = getPiece(fromRow, fromCol);
  if (!piece) return true;
  
  // 备份
  const backup = getPiece(toRow, toCol);
  board.value[toRow][toCol] = piece;
  board.value[fromRow][fromCol] = null;
  
  const inCheck = isInCheck(piece.color);
  
  // 恢复
  board.value[fromRow][fromCol] = piece;
  board.value[toRow][toCol] = backup;
  
  return inCheck;
};

// 获取伪合法移动（不考虑将军）
const getPseudoLegalMoves = (row: number, col: number, checkCastling: boolean = true): string[] => {
  const piece = getPiece(row, col);
  if (!piece) return [];
  
  const moves: string[] = [];
  
  switch (piece.type) {
    case 'pawn':
      const direction = piece.color === 'white' ? -1 : 1;
      // 前进一格
      if (row + direction >= 0 && row + direction < 8 && !getPiece(row + direction, col)) {
        moves.push(toNotation(row + direction, col));
        // 初始位置可前进两格
        const startRow = piece.color === 'white' ? 6 : 1;
        if (row === startRow && !getPiece(row + 2 * direction, col)) {
          moves.push(toNotation(row + 2 * direction, col));
        }
      }
      // 斜吃
      for (const dc of [-1, 1]) {
        const nr = row + direction;
        const nc = col + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const target = getPiece(nr, nc);
          if (target && target.color !== piece.color) {
            moves.push(toNotation(nr, nc));
          }
        }
      }
      // 过路兵
      if (lastMove.value && lastMove.value.piece.type === 'pawn') {
        const lastFromRow = lastMove.value.from.row;
        const lastToRow = lastMove.value.to.row;
        const lastToCol = lastMove.value.to.col;
        // 检查上一步是否是兵前进两格
        if (Math.abs(lastFromRow - lastToRow) === 2 && lastToRow === row && Math.abs(lastToCol - col) === 1) {
          const enPassantRow = row + direction;
          moves.push(toNotation(enPassantRow, lastToCol));
        }
      }
      break;
      
    case 'knight':
      const knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      for (const [dr, dc] of knightMoves) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const target = getPiece(nr, nc);
          if (!target || target.color !== piece.color) {
            moves.push(toNotation(nr, nc));
          }
        }
      }
      break;
      
    case 'bishop':
      for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
        for (let i = 1; i < 8; i++) {
          const nr = row + dr * i;
          const nc = col + dc * i;
          if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) break;
          const target = getPiece(nr, nc);
          if (!target) {
            moves.push(toNotation(nr, nc));
          } else {
            if (target.color !== piece.color) moves.push(toNotation(nr, nc));
            break;
          }
        }
      }
      break;
      
    case 'rook':
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        for (let i = 1; i < 8; i++) {
          const nr = row + dr * i;
          const nc = col + dc * i;
          if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) break;
          const target = getPiece(nr, nc);
          if (!target) {
            moves.push(toNotation(nr, nc));
          } else {
            if (target.color !== piece.color) moves.push(toNotation(nr, nc));
            break;
          }
        }
      }
      break;
      
    case 'queen':
      for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        for (let i = 1; i < 8; i++) {
          const nr = row + dr * i;
          const nc = col + dc * i;
          if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) break;
          const target = getPiece(nr, nc);
          if (!target) {
            moves.push(toNotation(nr, nc));
          } else {
            if (target.color !== piece.color) moves.push(toNotation(nr, nc));
            break;
          }
        }
      }
      break;
      
    case 'king':
      for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const target = getPiece(nr, nc);
          if (!target || target.color !== piece.color) {
            moves.push(toNotation(nr, nc));
          }
        }
      }
      // 王车易位
      if (checkCastling && !hasMoved.value[toNotation(row, col)] && !isInCheck(piece.color)) {
        const enemyColor = piece.color === 'white' ? 'black' : 'white';
        // 王侧易位
        if (!hasMoved.value[toNotation(row, 7)]) {
          if (!getPiece(row, 5) && !getPiece(row, 6)) {
            if (!isSquareUnderAttack(row, 5, enemyColor) && !isSquareUnderAttack(row, 6, enemyColor)) {
              moves.push(toNotation(row, 6));
            }
          }
        }
        // 后侧易位
        if (!hasMoved.value[toNotation(row, 0)]) {
          if (!getPiece(row, 1) && !getPiece(row, 2) && !getPiece(row, 3)) {
            if (!isSquareUnderAttack(row, 2, enemyColor) && !isSquareUnderAttack(row, 3, enemyColor)) {
              moves.push(toNotation(row, 2));
            }
          }
        }
      }
      break;
  }
  
  return moves;
};

// 计算合法移动（考虑将军）
const calculateLegalMoves = (row: number, col: number): string[] => {
  const piece = getPiece(row, col);
  if (!piece || piece.color !== currentTurn.value) return [];
  
  const pseudoMoves = getPseudoLegalMoves(row, col);
  const legalMoves: string[] = [];
  
  for (const move of pseudoMoves) {
    const { row: toRow, col: toCol } = fromNotation(move);
    if (!wouldBeInCheckAfterMove(row, col, toRow, toCol)) {
      legalMoves.push(move);
    }
  }
  
  return legalMoves;
};

const getSquareClass = (row: number, col: number) => {
  const isLight = (row + col) % 2 === 0;
  const notation = toNotation(row, col);
  const isSelected = selectedSquare.value?.row === row && selectedSquare.value?.col === col;
  const isLegal = legalMoves.value.includes(notation);
  
  return {
    'demo-square': true,
    'demo-square-light': isLight,
    'demo-square-dark': !isLight,
    'demo-square-selected': isSelected,
    'demo-square-legal': isLegal
  };
};

const onSquareClick = (row: number, col: number) => {
  // 如果刚刚完成了拖拽，忽略这次点击
  if (gameWinner.value) return;
  
  const notation = toNotation(row, col);
  
  if (selectedSquare.value) {
    // 已选中棋子
    if (selectedSquare.value.row === row && selectedSquare.value.col === col) {
      // 点击同一格，取消选择
      selectedSquare.value = null;
      legalMoves.value = [];
    } else if (legalMoves.value.includes(notation)) {
      // 移动到合法位置
      movePiece(selectedSquare.value.row, selectedSquare.value.col, row, col);
      selectedSquare.value = null;
      legalMoves.value = [];
    } else {
      // 选择新棋子
      const piece = getPiece(row, col);
      if (piece && piece.color === currentTurn.value) {
        selectedSquare.value = { row, col };
        legalMoves.value = calculateLegalMoves(row, col);
      } else {
        selectedSquare.value = null;
        legalMoves.value = [];
      }
    }
  } else {
    // 未选中，选择棋子
    const piece = getPiece(row, col);
    if (piece && piece.color === currentTurn.value) {
      selectedSquare.value = { row, col };
      legalMoves.value = calculateLegalMoves(row, col);
    }
  }
};

const movePiece = (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
  const piece = board.value[fromRow][fromCol];
  if (!piece) return;
  
  // 检查是否是过路兵
  if (piece.type === 'pawn' && Math.abs(toCol - fromCol) === 1 && !getPiece(toRow, toCol)) {
    // 过路兵吃子
    if (lastMove.value && lastMove.value.piece.type === 'pawn') {
      const lastToRow = lastMove.value.to.row;
      const lastToCol = lastMove.value.to.col;
      if (lastToCol === toCol && lastToRow === fromRow) {
        board.value[lastToRow][lastToCol] = null;
      }
    }
  }
  
  // 检查是否是王车易位
  if (piece.type === 'king' && Math.abs(toCol - fromCol) === 2) {
    if (toCol === 6) {
      // 王侧易位
      const rook = board.value[fromRow][7];
      board.value[fromRow][5] = rook;
      board.value[fromRow][7] = null;
      if (rook) hasMoved.value[toNotation(fromRow, 5)] = true;
    } else if (toCol === 2) {
      // 后侧易位
      const rook = board.value[fromRow][0];
      board.value[fromRow][3] = rook;
      board.value[fromRow][0] = null;
      if (rook) hasMoved.value[toNotation(fromRow, 3)] = true;
    }
  }
  
  // 执行移动
  board.value[toRow][toCol] = piece;
  board.value[fromRow][fromCol] = null;
  
  // 检查是否需要升变
  if (piece.type === 'pawn' && (toRow === 0 || toRow === 7)) {
    promotionSquare.value = { row: toRow, col: toCol };
    promotionColor.value = piece.color;
    promotionMoveInfo.value = { fromRow, fromCol, toRow, toCol, piece: { ...piece } };
    showPromotionDialog.value = true;
    return; // 等待用户选择升变
  }
  
  // 完成移动
  finishMove(fromRow, fromCol, toRow, toCol, piece);
};

const finishMove = (fromRow: number, fromCol: number, toRow: number, toCol: number, piece: Piece) => {
  // 记录移动
  lastMove.value = {
    from: { row: fromRow, col: fromCol },
    to: { row: toRow, col: toCol },
    piece: { ...piece }
  };
  
  // 标记已移动
  hasMoved.value[toNotation(toRow, toCol)] = true;
  
  // 切换回合
  currentTurn.value = currentTurn.value === 'white' ? 'black' : 'white';
  
  // 检查是否将死
  setTimeout(() => {
    if (isCheckmate(currentTurn.value)) {
      // 将死，显示获胜者
      gameWinner.value = currentTurn.value === 'white' ? 'black' : 'white';
    }
  }, 100);
};

const selectPromotion = (type: 'queen' | 'rook' | 'bishop' | 'knight') => {
  if (!promotionSquare.value || !promotionColor.value || !promotionMoveInfo.value) return;
  
  const { row, col } = promotionSquare.value;
  const { fromRow, fromCol, toRow, toCol } = promotionMoveInfo.value;
  
  // 升变
  board.value[row][col] = { type, color: promotionColor.value };
  
  // 关闭弹窗
  showPromotionDialog.value = false;
  
  // 完成移动（使用升变后的棋子信息）
  const promotedPiece: Piece = { type, color: promotionColor.value };
  finishMove(fromRow, fromCol, toRow, toCol, promotedPiece);
  
  promotionSquare.value = null;
  promotionColor.value = null;
  promotionMoveInfo.value = null;
};

// 检查是否将死
const isCheckmate = (color: 'white' | 'black'): boolean => {
  if (!isInCheck(color)) return false;
  
  // 遍历所有己方棋子，看是否有任何合法移动
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = getPiece(r, c);
      if (piece && piece.color === color) {
        const moves = getPseudoLegalMoves(r, c);
        for (const move of moves) {
          const { row: toRow, col: toCol } = fromNotation(move);
          if (!wouldBeInCheckAfterMove(r, c, toRow, toCol)) {
            return false; // 有合法移动，未将死
          }
        }
      }
    }
  }
  
  return true; // 无合法移动，将死
};

// 拖拽功能
const onPointerDown = (row: number, col: number, e: PointerEvent) => {
  if (gameWinner.value) return;
  const piece = getPiece(row, col);
  if (!piece || piece.color !== currentTurn.value) return;
  
  dragStartSquare.value = { row, col };
  
  startX = e.clientX;
  startY = e.clientY;
  isDragging.value = false;
  
  // 不要在这里 preventDefault，以免阻止 click 事件
};

const onBoardPointerMove = (e: PointerEvent) => {
  if (!dragStartSquare.value) return;
  
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  
  if (!isDragging.value && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
    isDragging.value = true;
    createDragGhost(dragStartSquare.value.row, dragStartSquare.value.col);
    // 选中棋子并显示合法移动
    selectedSquare.value = dragStartSquare.value;
    legalMoves.value = calculateLegalMoves(dragStartSquare.value.row, dragStartSquare.value.col);
    e.preventDefault(); // 只在开始拖拽时阻止默认行为
  }
  
  if (isDragging.value && dragGhost.value) {
    updateGhostPosition(e.clientX, e.clientY);
    e.preventDefault();
  }
};

const onBoardPointerUp = (e: PointerEvent) => {
  if (!dragStartSquare.value) return;
  
  const wasDragging = isDragging.value;
  const fromRow = dragStartSquare.value.row;
  const fromCol = dragStartSquare.value.col;
  
  if (wasDragging && dragGhost.value) {
    // 拖拽模式：查找落点并执行移动
    const target = getSquareFromPoint(e.clientX, e.clientY);
    cleanupDrag();
    
    if (target) {
      const notation = toNotation(target.row, target.col);
      if (legalMoves.value.includes(notation)) {
        movePiece(fromRow, fromCol, target.row, target.col);
      }
    }
    
    selectedSquare.value = null;
    legalMoves.value = [];
    dragStartSquare.value = null;
    e.preventDefault(); // 阻止后续的 click 事件
  } else {
    // 未触发拖拽，重置并让 click 事件处理
    dragStartSquare.value = null;
  }
};

const createDragGhost = (row: number, col: number) => {
  const piece = getPiece(row, col);
  if (!piece) return;
  
  const imgSrc = getPieceImage(piece);
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.pointerEvents = 'none';
  el.style.zIndex = '9999';
  el.style.width = '60px';
  el.style.height = '60px';
  
  const img = document.createElement('img');
  img.src = imgSrc;
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.filter = 'drop-shadow(2px 2px 4px rgba(0,0,0,0.5))';
  el.appendChild(img);
  
  document.body.appendChild(el);
  dragGhost.value = el;
};

const updateGhostPosition = (clientX: number, clientY: number) => {
  if (!dragGhost.value) return;
  const size = 60;
  dragGhost.value.style.transform = `translate(${clientX - size / 2}px, ${clientY - size / 2}px)`;
};

const getSquareFromPoint = (clientX: number, clientY: number): { row: number; col: number } | null => {
  const boardEl = document.querySelector('.demo-board') as HTMLElement | null;
  if (!boardEl) return null;
  
  const rect = boardEl.getBoundingClientRect();
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
    return null;
  }
  
  const col = Math.floor(((clientX - rect.left) / rect.width) * 8);
  const row = Math.floor(((clientY - rect.top) / rect.height) * 8);
  
  if (row < 0 || row >= 8 || col < 0 || col >= 8) return null;
  return { row, col };
};

const cleanupDrag = () => {
  if (dragGhost.value && dragGhost.value.parentElement) {
    dragGhost.value.parentElement.removeChild(dragGhost.value);
  }
  dragGhost.value = null;
  isDragging.value = false;
};

onMounted(() => {
  initBoard();
});

onBeforeUnmount(() => {
  cleanupDrag();
});
</script>

<style scoped>
.demo-board-wrapper {
  margin-top: 40px;
  padding: 30px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.05);
}

.demo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.demo-header h3 {
  margin: 0;
  color: #2C3E50;
  font-size: 1.4rem;
  font-weight: 700;
}

.demo-turn-indicator {
  text-align: center;
  padding: 12px 20px;
  background: rgba(255, 159, 120, 0.1);
  border: 2px solid #FF9F78;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: 600;
  color: #2C3E50;
  margin-bottom: 20px;
}

.turn-white {
  color: #333;
  font-weight: 700;
}

.turn-black {
  color: #000;
  font-weight: 700;
}

.demo-turn-indicator.game-over {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 159, 120, 0.2));
  border-color: #FFD700;
  animation: winnerPulse 2s ease-in-out infinite;
}

.winner-text {
  color: #FF9F78;
  font-weight: 700;
  font-size: 1.2rem;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

@keyframes winnerPulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 rgba(255, 215, 0, 0.4);
  }
  50% {
    transform: scale(1.02);
    box-shadow: 0 0 20px rgba(255, 215, 0, 0.6);
  }
}

.reset-btn {
  padding: 8px 20px;
  background: #FF9F78;
  color: white;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(255, 159, 120, 0.3);
}

.reset-btn:hover {
  background: #ff8a5c;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 159, 120, 0.4);
}

.demo-board-container {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}

.demo-board {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(8, 1fr);
  width: 400px;
  height: 400px;
  border: 2px solid #7a8a9a;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  user-select: none;
}

.demo-row {
  display: contents;
}

.demo-square {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.demo-square-light {
  background-color: #F0D9B5;
}

.demo-square-dark {
  background-color: #B58863;
}

.demo-square-selected {
  background-color: #a9bd70 !important;
}

.demo-square-legal::after {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  background-color: rgba(30, 136, 229, 0.8);
  border-radius: 50%;
  pointer-events: none;
}

.demo-square:hover {
  filter: brightness(1.1);
}

.demo-piece {
  width: 85%;
  height: 85%;
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: none;
}

.demo-piece img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

@media (max-width: 600px) {
  .demo-board {
    width: 320px;
    height: 320px;
  }
  
  .demo-board-wrapper {
    padding: 20px;
  }
}

.promotion-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
}

.promotion-dialog {
  background: white;
  border-radius: 16px;
  padding: 30px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  max-width: 400px;
}

.promotion-dialog h4 {
  margin: 0 0 20px 0;
  color: #2C3E50;
  font-size: 1.3rem;
  text-align: center;
  font-weight: 700;
}

.promotion-options {
  display: flex;
  gap: 15px;
  justify-content: center;
}

.promotion-option {
  width: 70px;
  height: 70px;
  border: 3px solid #ddd;
  border-radius: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;
  background: #F0D9B5;
}

.promotion-option:hover {
  border-color: #FF9F78;
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(255, 159, 120, 0.4);
}

.promotion-option img {
  width: 90%;
  height: 90%;
  object-fit: contain;
}
</style>
