import { Chess } from 'chess.js';
import type { GameState, Move, FogOfWarState } from '../types';

export class ChessService {
  private chess: Chess;
  private moveHistory: Move[] = []; // 手动管理移动历史
  private undoAttempts: Map<number, number> = new Map(); // 记录每步的悔棋尝试次数

  constructor() {
    this.chess = new Chess();
  }

  /**
   * 创建新的游戏状态
   */
  createNewGame(): GameState {
    this.chess.reset();
    this.moveHistory = []; // 重置移动历史
    this.undoAttempts.clear(); // 重置悔棋尝试次数
    const fen = this.chess.fen();
    
    return {
      board: fen,
      currentPlayer: 'white',
      gameStatus: 'waiting',
      moveHistory: this.moveHistory,
      fogOfWar: this.computeFog()
    };
  }

  /**
   * 执行移动（迷雾棋规则）
   */
  makeMove(move: Omit<Move, 'timestamp' | 'player'>): { success: boolean; gameState?: GameState; error?: string } {
    try {
      // 迷雾棋特殊规则：允许国王进入将军状态
      // 我们需要自定义移动验证，绕过chess.js的将军检查
      
      // 首先验证移动是否基本合法（与前端蓝点一致：使用 getLegalMovesForSquare）
      // 特判：若目标格为对方国王，且几何可达，直接允许（防止生成器疏漏）
      const dstPiece = this.chess.get(move.to as any) as any;
      const moverColor: 'white' | 'black' = /[A-Z]/.test(move.piece) ? 'white' : 'black';
      let expectedWinner: 'white' | 'black' | undefined = undefined;
      let isKingCaptureShortcut = false;
      if (dstPiece && dstPiece.type === 'k') {
        const pt = (move.piece || '').toLowerCase() as 'p'|'n'|'b'|'r'|'q'|'k';
        const color = /[A-Z]/.test(move.piece) ? 'w' : 'b';
        if (pt && this.canReachSquareIgnoringCheck(move.from, move.to, pt, color)) {
          isKingCaptureShortcut = true;
          expectedWinner = moverColor;
        }
      }
      const legalTargets = this.getLegalMovesForSquare(move.from);
      if (!isKingCaptureShortcut && !legalTargets.includes(move.to)) {
        return { success: false, error: 'Invalid move' };
      }

      // 兵升变：优先使用前端选择的promotion；若未提供且满足条件，则默认升后
      let promotion: 'q' | 'r' | 'b' | 'n' | undefined = (move as any).promotion;
      const isPawn = move.piece.toLowerCase() === 'p';
      if (isPawn && !promotion) {
        const destRank = parseInt(move.to[1], 10);
        if ((move.piece === 'P' && destRank === 8) || (move.piece === 'p' && destRank === 1)) {
          promotion = 'q';
        }
      }
      // 使用纯几何方式执行移动（不调用 chess.move）
      let capturedKingColor: 'white' | 'black' | undefined;
      try {
        const result = this.applyGeometricMove(move.from, move.to, move.piece, promotion);
        capturedKingColor = result.capturedKingColor;
      } catch (error) {
        return { success: false, error: 'Failed to execute move' };
      }

      // 如果没有在执行前就检测到目标是王，这里再二次确认：场上是否缺失某方国王
      let finalWinner: 'white' | 'black' | undefined = expectedWinner || (capturedKingColor ? (capturedKingColor === 'white' ? 'black' : 'white') : undefined);
      if (!finalWinner) {
        const whiteKing = this.findKingSquare('w');
        const blackKing = this.findKingSquare('b');
        if (!whiteKing && blackKing) finalWinner = 'black';
        if (!blackKing && whiteKing) finalWinner = 'white';
      }

      // 添加到移动历史（保留前端传入的 promotion）
      const moveRecord: Move = {
        ...move,
        timestamp: new Date(),
        player: this.chess.turn() === 'w' ? 'black' : 'white' // 刚移动完的玩家
      };
      this.moveHistory.push(moveRecord);

      const gameState: GameState = {
        board: this.chess.fen(),
        currentPlayer: this.chess.turn() === 'w' ? 'white' : 'black',
        gameStatus: 'playing',
        winner: finalWinner || this.getWinner(),
        moveHistory: [...this.moveHistory], // 使用手动管理的移动历史
        fogOfWar: this.computeFog()
      };

      if (gameState.winner) {
        gameState.gameStatus = 'finished';
      }

      return { success: true, gameState };
    } catch (error) {
      return { success: false, error: 'Invalid move' };
    }
  }

  /**
   * 以纯几何方式执行移动：
   * - 不调用 chess.move，从而不触发将军相关限制
   * - 处理吃子/吃王、升变、易位、过路兵
   * - 手动更新 FEN 的 active color / castling / en passant / clocks
   */
  private applyGeometricMove(from: string, to: string, piece: string, promotion?: 'q'|'r'|'b'|'n'):
    { capturedKingColor?: 'white'|'black' } {
    const isWhite = piece === piece.toUpperCase();
    const color: 'w'|'b' = isWhite ? 'w' : 'b';

    const fromSquare = from as any;
    const toSquare = to as any;

    const pieceOnFrom = this.chess.get(fromSquare) as any;
    if (!pieceOnFrom) {
      throw new Error('No piece on from square');
    }

    const preParts = this.chess.fen().split(' ');
    let rights = preParts[2] && preParts[2] !== '-' ? preParts[2] : '';
    const removeRight = (ch: string) => { rights = rights.replace(ch, ''); };

    // 目标格与潜在吃王
    const targetPiece = this.chess.get(toSquare) as any;
    let capturedKingColor: 'white' | 'black' | undefined;
    if (targetPiece && targetPiece.type === 'k') {
      capturedKingColor = targetPiece.color === 'w' ? 'white' : 'black';
    }

    // 过路兵判定（兵斜走到空格，且 en passant 目标等于落点）
    let isEnPassant = false;
    if (pieceOnFrom.type === 'p') {
      const fileChanged = from[0] !== to[0];
      const toEmpty = !targetPiece;
      const epTarget = preParts[3] && preParts[3] !== '-' ? preParts[3] : undefined;
      if (fileChanged && toEmpty && epTarget === to) {
        isEnPassant = true;
      }
    }

    // 捕获：普通吃子或过路兵
    if (isEnPassant) {
      const dir = isWhite ? 1 : -1; // 白吃过路：to 的下一行是被吃兵
      const capturedRank = parseInt(to[1], 10) - dir;
      const capturedSq = `${to[0]}${capturedRank}` as any;
      const epPawn = this.chess.get(capturedSq) as any;
      if (epPawn && epPawn.type === 'p') {
        this.chess.remove(capturedSq);
      }
    } else if (targetPiece) {
      this.chess.remove(toSquare);
      // 捕获起始位车会影响对方的易位权
      if (targetPiece.type === 'r') {
        if (to === 'a1') removeRight('Q');
        if (to === 'h1') removeRight('K');
        if (to === 'a8') removeRight('q');
        if (to === 'h8') removeRight('k');
      }
    }

    // 移除起始格
    this.chess.remove(fromSquare);

    // 兵升变处理
    let finalType: any = pieceOnFrom.type;
    if (pieceOnFrom.type === 'p' && (to.endsWith('8') || to.endsWith('1'))) {
      finalType = (promotion || 'q');
    }

    // 易位：若王从 e1/e8 到 g/c，则同步移动车
    const fromStr = String(fromSquare);
    const toStr = String(toSquare);
    const doCastle = (rookFrom: string, rookTo: string) => {
      const rook = this.chess.get(rookFrom as any) as any;
      if (rook && rook.type === 'r' && rook.color === color) {
        this.chess.remove(rookFrom as any);
        this.chess.put({ type: 'r', color }, rookTo as any);
      }
    };
    if (pieceOnFrom.type === 'k') {
      if (isWhite && fromStr === 'e1' && toStr === 'g1') doCastle('h1','f1');
      if (isWhite && fromStr === 'e1' && toStr === 'c1') doCastle('a1','d1');
      if (!isWhite && fromStr === 'e8' && toStr === 'g8') doCastle('h8','f8');
      if (!isWhite && fromStr === 'e8' && toStr === 'c8') doCastle('a8','d8');
    }

    // 把走子落到目标格
    this.chess.put({ type: finalType, color }, toSquare);

    // 更新 FEN 的行棋方、易位权、过路兵、回合数
    // 先抓取当前（已经几何挪子后）的棋盘FEN，保留棋盘布局部分
    const afterParts = this.chess.fen().split(' ');
    // active color
    afterParts[1] = isWhite ? 'b' : 'w';
    // castling rights：若王或相应车移动则收回权利
    if (pieceOnFrom.type === 'k') {
      if (isWhite) { removeRight('K'); removeRight('Q'); } else { removeRight('k'); removeRight('q'); }
    }
    if (pieceOnFrom.type === 'r') {
      if (isWhite && fromStr === 'h1') removeRight('K');
      if (isWhite && fromStr === 'a1') removeRight('Q');
      if (!isWhite && fromStr === 'h8') removeRight('k');
      if (!isWhite && fromStr === 'a8') removeRight('q');
    }
    afterParts[2] = rights.length ? rights : '-';

    // en passant target
    const fromRank = parseInt(from[1], 10);
    const toRank = parseInt(to[1], 10);
    if (pieceOnFrom.type === 'p' && Math.abs(toRank - fromRank) === 2) {
      const midRank = (fromRank + toRank) / 2;
      afterParts[3] = `${from[0]}${midRank}`;
    } else {
      afterParts[3] = '-';
    }

    // halfmove clock
    const prevHalf = parseInt(preParts[4] || '0', 10) || 0;
    const isCapture = !!targetPiece || isEnPassant;
    afterParts[4] = (pieceOnFrom.type === 'p' || isCapture) ? '0' : String(prevHalf + 1);

    // fullmove number
    const prevFull = parseInt(preParts[5] || '1', 10) || 1;
    afterParts[5] = isWhite ? String(prevFull) : String(prevFull + 1);

    // 将更新后的状态加载回引擎（使用最新的棋盘布局 + 更新后的元字段）
    // 特殊情况：如果吃掉了王，我们手动更新必要字段但保持棋盘现状
    if (capturedKingColor) {
      // 手动更新关键字段，避免 chess.js 校验"缺王"的 FEN
      try {
        // 只更新行棋方，不重新加载整个 FEN
        (this.chess as any)._turn = isWhite ? 'b' : 'w';
        (this.chess as any)._halfMoves = parseInt(afterParts[4], 10);
        (this.chess as any)._fullMoves = parseInt(afterParts[5], 10);
      } catch (e) {
        // Continue if manual update fails
      }
    } else {
      this.chess.load(afterParts.join(' '));
    }

    return { capturedKingColor };
  }

  /**
   * 迷雾棋移动验证（允许国王进入将军状态）
   */
  private isValidMoveForFogOfWar(from: string, to: string, piece: string): boolean {
    try {
      const moves = this.generatePseudoLegalMoves(from);
      return moves.includes(to);
    } catch {
      return false;
    }
  }

  /**
   * 获取当前棋盘状态
   */
  getCurrentState(): GameState {
    return {
      board: this.chess.fen(),
      currentPlayer: this.chess.turn() === 'w' ? 'white' : 'black',
      gameStatus: 'playing',
      winner: this.getWinner(),
      moveHistory: this.getMoveHistory(),
      fogOfWar: this.computeFog()
    };
  }

  /**
   * 初始化迷雾战争状态
   */
  private computeFog(): FogOfWarState {
    // 迷雾棋规则：
    // - 每方可见：己方所有棋子所在格 + 从这些格子出发的所有合法走法到达格
    // - 如果己方棋子可以捕获对手棋子，那么对手棋子所在的格子也可见
    const whiteVisible = new Set<string>();
    const blackVisible = new Set<string>();

    const boardState = this.chess.board();
    
    // 遍历所有棋子
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const square = boardState[rank][file];
        if (!square) continue;
        
        const fileChar = String.fromCharCode(97 + file); // a-h
        const sq = `${fileChar}${8 - rank}`; // e.g. e4
        
        if (square.color === 'w') {
          // 白方棋子所在格子可见
          whiteVisible.add(sq);
          
          // 获取该棋子的所有可能移动（包括捕获）
          // 使用自定义方法确保不依赖当前回合
          const moves = this.getPieceMoves(sq, square.type, 'w', boardState);
          
          // 所有可移动到的格子都可见
          for (const move of moves) {
            whiteVisible.add(move);
          }
          
        } else if (square.color === 'b') {
          // 黑方棋子所在格子可见
          blackVisible.add(sq);
          
          // 获取该棋子的所有可能移动（包括捕获）
          // 使用自定义方法确保不依赖当前回合
          const moves = this.getPieceMoves(sq, square.type, 'b', boardState);
          
          // 所有可移动到的格子都可见
          for (const move of moves) {
            blackVisible.add(move);
          }
        }
      }
    }

    return {
      whiteVisible: Array.from(whiteVisible),
      blackVisible: Array.from(blackVisible),
      lastKnownPositions: { white: {}, black: {} }
    };
  }

  /**
   * 获取棋子的所有可能移动（不依赖当前回合）
   */
  private getPieceMoves(square: string, pieceType: string, color: 'w' | 'b', boardState: any[][]): string[] {
    try {
      return this.generatePseudoLegalMoves(square);
    } catch (error) {
      return [];
    }
  }

  /**
   * 获取获胜者
   */
  private getWinner(capturedPiece?: string): 'white' | 'black' | 'draw' | undefined {
    // Fog of War：仅当国王被吃掉才结束
    if (capturedPiece === 'k') {
      return this.chess.turn() === 'w' ? 'black' : 'white';
    }
    return undefined;
  }

  /**
   * 获取移动历史
   */
  private getMoveHistory(): Move[] {
    return [...this.moveHistory];
  }

  /**
   * 验证移动是否合法
   */
  isValidMove(from: string, to: string): boolean {
    try {
      const moves = this.chess.moves({ square: from as any, verbose: true, legal: false } as any) as any[];
      return moves.some((move: any) => move.to === to);
    } catch {
      return false;
    }
  }

  /**
   * 获取可能的移动
   */
  getPossibleMoves(square?: string): any[] {
    if (square) {
      return this.chess.moves({ square: square as any, verbose: true, legal: false } as any) as any[];
    }
    return this.chess.moves({ verbose: true, legal: false } as any) as any[];
  }

  /**
   * 返回某个格子的合法走法（目标坐标数组）。
   * 不依赖当前轮到谁：临时切换FEN的行棋方为该格子的棋子颜色后计算，再恢复。
   */
  getLegalMovesForSquare(square: string): string[] {
    try {
      return this.generatePseudoLegalMoves(square);
    } catch {
      return [];
    }
  }

  /**
   * 生成指定格子的伪合法走法（完全忽略将军），仅返回目标坐标数组
   */
  private generatePseudoLegalMoves(from: string): string[] {
    const piece = this.chess.get(from as any) as any;
    if (!piece) return [];
    const color: 'w'|'b' = piece.color;

    const toXY = (sq: string) => [sq.charCodeAt(0) - 97, parseInt(sq[1], 10) - 1] as [number, number];
    const toSq = (x: number, y: number) => `${String.fromCharCode(97 + x)}${y + 1}`;
    const inBoard = (x: number, y: number) => x >= 0 && x < 8 && y >= 0 && y < 8;
    const getAt = (x: number, y: number) => this.chess.get(toSq(x, y) as any) as any;

    const [fx, fy] = toXY(from);
    const moves: string[] = [];

    const pushRay = (dx: number, dy: number) => {
      let x = fx + dx, y = fy + dy;
      while (inBoard(x, y)) {
        const p = getAt(x, y);
        if (!p) {
          moves.push(toSq(x, y));
        } else {
          if (p.color !== color) moves.push(toSq(x, y));
          break;
        }
        x += dx; y += dy;
      }
    };

    const fenParts = this.chess.fen().split(' ');
    const castlingRights = fenParts[2] || '-';
    const epTarget = fenParts[3] && fenParts[3] !== '-' ? fenParts[3] : undefined;

    switch (piece.type) {
      case 'n': { // 马
        const deltas = [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]];
        for (const [dx, dy] of deltas) {
          const x = fx + dx, y = fy + dy; if (!inBoard(x, y)) continue;
          const p = getAt(x, y); if (!p || p.color !== color) moves.push(toSq(x, y));
        }
        break;
      }
      case 'k': { // 王（允许入/穿受攻格）
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) {
          const x = fx + dx, y = fy + dy; if (!inBoard(x, y)) continue;
          const p = getAt(x, y); if (!p || p.color !== color) moves.push(toSq(x, y));
        }
        // 易位（仅检查路径为空 + 权利存在）
        const empty = (cells: [number,number][]) => cells.every(([x,y]) => !getAt(x,y));
        if (color === 'w') {
          if (castlingRights.includes('K') && empty([[5,0],[6,0]])) moves.push('g1');
          if (castlingRights.includes('Q') && empty([[1,0],[2,0],[3,0]])) moves.push('c1');
        } else {
          if (castlingRights.includes('k') && empty([[5,7],[6,7]])) moves.push('g8');
          if (castlingRights.includes('q') && empty([[1,7],[2,7],[3,7]])) moves.push('c8');
        }
        break;
      }
      case 'b': { // 象
        pushRay(1, 1); pushRay(1, -1); pushRay(-1, 1); pushRay(-1, -1); break;
      }
      case 'r': { // 车
        pushRay(1, 0); pushRay(-1, 0); pushRay(0, 1); pushRay(0, -1); break;
      }
      case 'q': { // 后
        pushRay(1, 0); pushRay(-1, 0); pushRay(0, 1); pushRay(0, -1);
        pushRay(1, 1); pushRay(1, -1); pushRay(-1, 1); pushRay(-1, -1); break;
      }
      case 'p': { // 兵
        const dir = color === 'w' ? 1 : -1;
        const startRank = color === 'w' ? 1 : 6; // y 坐标
        // 前进一步
        if (inBoard(fx, fy + dir) && !getAt(fx, fy + dir)) moves.push(toSq(fx, fy + dir));
        // 首次前进两步
        if (fy === startRank && !getAt(fx, fy + dir) && !getAt(fx, fy + 2 * dir)) moves.push(toSq(fx, fy + 2 * dir));
        // 斜吃
        for (const dx of [-1, 1]) {
          const x = fx + dx, y = fy + dir; if (!inBoard(x, y)) continue;
          const p = getAt(x, y); if (p && p.color !== color) moves.push(toSq(x, y));
        }
        // 过路兵
        if (epTarget) {
          const [ex, ey] = toXY(epTarget);
          if (ey === fy + dir && Math.abs(ex - fx) === 1) moves.push(epTarget);
        }
        break;
      }
    }
    return moves;
  }

  /** 在当前棋盘中找到指定颜色国王的格子（如 'e4'），找不到则返回 null */
  private findKingSquare(color: 'w' | 'b'): string | null {
    const bd = this.chess.board();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = bd[r][f];
        if (p && p.type === 'k' && p.color === color) {
          return `${String.fromCharCode(97 + f)}${8 - r}`;
        }
      }
    }
    return null;
  }

  /** 简单几何校验：忽略将军，仅判断路径是否按棋子规则可达（含射线阻挡、马跳、兵斜吃一格、王一步、易位不在此校验） */
  private canReachSquareIgnoringCheck(from: string, to: string, pieceType: 'p'|'n'|'b'|'r'|'q'|'k', color: 'w'|'b'): boolean {
    if (from === to) return false;
    const fx = from.charCodeAt(0) - 97; const fy = parseInt(from[1], 10) - 1;
    const tx = to.charCodeAt(0) - 97; const ty = parseInt(to[1], 10) - 1;
    const dx = Math.sign(tx - fx); const dy = Math.sign(ty - fy);
    const get = (x: number, y: number) => this.chess.get(`${String.fromCharCode(97 + x)}${y + 1}` as any) as any;
    const inBoard = (x: number, y: number) => x>=0 && x<8 && y>=0 && y<8;
    const pathClear = (sx: number, sy: number) => {
      let x = fx + sx, y = fy + sy;
      while (x !== tx || y !== ty) {
        if (!inBoard(x,y)) return false;
        const p = get(x, y);
        if (p) return false;
        x += sx; y += sy;
      }
      return true;
    };
    switch (pieceType) {
      case 'n': {
        const ddx = Math.abs(tx - fx), ddy = Math.abs(ty - fy);
        return (ddx === 1 && ddy === 2) || (ddx === 2 && ddy === 1);
      }
      case 'k': {
        return Math.max(Math.abs(tx - fx), Math.abs(ty - fy)) === 1;
      }
      case 'b': {
        if (Math.abs(tx - fx) !== Math.abs(ty - fy)) return false;
        return pathClear(dx, dy);
      }
      case 'r': {
        if (tx !== fx && ty !== fy) return false;
        return pathClear(dx === 0 ? 0 : dx, dy === 0 ? 0 : dy);
      }
      case 'q': {
        if (tx === fx || ty === fy) return pathClear(dx === 0 ? 0 : dx, dy === 0 ? 0 : dy);
        if (Math.abs(tx - fx) === Math.abs(ty - fy)) return pathClear(dx, dy);
        return false;
      }
      case 'p': {
        const dir = color === 'w' ? 1 : -1;
        return (ty - fy === dir) && (Math.abs(tx - fx) === 1);
      }
    }
    return false;
  }

  /**
   * 检查是否可以悔棋
   */
  canUndo(playerColor: 'white' | 'black'): { canUndo: boolean; reason?: string; attemptsLeft?: number } {
    // 1. 检查是否有移动历史
    if (this.moveHistory.length === 0) {
      return { canUndo: false, reason: 'No moves to undo' };
    }

    // 2. 检查悔棋逻辑：只有刚移动完的玩家才能悔棋
    // 即：当前轮到对手时，自己可以悔棋
    const currentTurn = this.chess.turn() === 'w' ? 'white' : 'black';
    if (currentTurn === playerColor) {
      return { canUndo: false, reason: 'Cannot undo on your own turn' };
    }

    // 3. 检查悔棋尝试次数
    const moveIndex = this.moveHistory.length - 1;
    const attempts = this.undoAttempts.get(moveIndex) || 0;
    const maxAttempts = 2; // 改为2次
    
    if (attempts >= maxAttempts) {
      return { canUndo: false, reason: 'Maximum undo attempts reached for this move' };
    }

    return { canUndo: true, attemptsLeft: maxAttempts - attempts };
  }

  /**
   * 记录悔棋尝试
   */
  recordUndoAttempt(): void {
    const moveIndex = this.moveHistory.length - 1;
    const currentAttempts = this.undoAttempts.get(moveIndex) || 0;
    this.undoAttempts.set(moveIndex, currentAttempts + 1);
  }

  /**
   * 悔棋：撤销上一步移动
   */
  undoMove(): { success: boolean; gameState?: GameState; error?: string } {
    try {
      if (this.moveHistory.length === 0) {
        return { success: false, error: 'No moves to undo' };
      }

      // 撤销上一步移动历史
      const lastMove = this.moveHistory.pop();

      // 清除被撤销移动的悔棋尝试记录
      const removedMoveIndex = this.moveHistory.length; // 被撤销的移动的索引
      this.undoAttempts.delete(removedMoveIndex);

      // 重新构建棋盘状态到上一步
      this.chess.reset();
      for (const mv of this.moveHistory) {
        // 用与 makeMove 相同的几何逻辑重放（跳过合法性校验）
        this.applyGeometricMove(mv.from, mv.to, mv.piece, mv.promotion as any);
      }
      
      const fen = this.chess.fen();
      const currentPlayer = this.chess.turn() === 'w' ? 'white' : 'black';
      
      const gameState: GameState = {
        board: fen,
        currentPlayer,
        gameStatus: 'playing',
        moveHistory: this.getMoveHistory(),
        fogOfWar: this.computeFog()
      };

      return { success: true, gameState };
    } catch (error) {
      return { success: false, error: 'Failed to undo move' };
    }
  }
}
