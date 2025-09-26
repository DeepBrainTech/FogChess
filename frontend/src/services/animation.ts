import { chessService } from './chess';

export interface AnimationOptions {
  duration?: number; // 动画持续时间（毫秒）
  easing?: string; // 缓动函数
  onComplete?: () => void; // 动画完成回调
}

export class AnimationService {
  private static instance: AnimationService;
  private activeAnimations = new Set<string>();

  static getInstance(): AnimationService {
    if (!AnimationService.instance) {
      AnimationService.instance = new AnimationService();
    }
    return AnimationService.instance;
  }

  /**
   * 移动棋子动画
   */
  async animateMove(
    fromSquare: string, 
    toSquare: string, 
    options: AnimationOptions = {}
  ): Promise<void> {
    const {
      duration = 200,
      easing = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      onComplete
    } = options;

    // 性能检测：低端设备使用更短的动画时间
    const isLowEndDevice = this.detectLowEndDevice();
    const actualDuration = isLowEndDevice ? Math.min(duration, 100) : duration;

    const animationId = `${fromSquare}-${toSquare}-${Date.now()}`;
    
    // 防止重复动画
    if (this.activeAnimations.has(animationId)) {
      return;
    }
    
    this.activeAnimations.add(animationId);

    try {
      // 获取起点和终点的坐标
      const fromCoords = chessService.getSquareCoordinates(fromSquare);
      const toCoords = chessService.getSquareCoordinates(toSquare);
      
      if (!fromCoords || !toCoords) {
        throw new Error('Invalid square coordinates');
      }

      // 计算像素偏移
      const squareSize = 78; // 与CSS中的square尺寸一致
      const deltaX = (toCoords.col - fromCoords.col) * squareSize;
      const deltaY = (toCoords.row - fromCoords.row) * squareSize;

      // 找到要移动的棋子元素
      const pieceElement = this.findPieceElement(fromSquare);
      if (!pieceElement) {
        throw new Error('Piece element not found');
      }

      // 设置动画
      pieceElement.style.transition = `transform ${actualDuration}ms ${easing}`;
      pieceElement.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
      pieceElement.style.zIndex = '1000'; // 确保在最上层

      // 等待动画完成
      await this.waitForAnimation(pieceElement, actualDuration);

      // 重置样式
      pieceElement.style.transition = '';
      pieceElement.style.transform = '';
      pieceElement.style.zIndex = '';

      onComplete?.();

    } catch (error) {
      // Animation failed, continue silently
    } finally {
      this.activeAnimations.delete(animationId);
    }
  }

  /**
   * 批量移动动画（用于历史回放）
   */
  async animateMoves(
    moves: Array<{ from: string; to: string }>,
    options: AnimationOptions = {}
  ): Promise<void> {
    const { duration = 150 } = options; // 历史回放时稍快一些

    for (const move of moves) {
      await this.animateMove(move.from, move.to, { duration });
      // 短暂停顿，让用户能看清每一步
      await this.delay(50);
    }
  }

  /**
   * 查找棋子DOM元素
   */
  private findPieceElement(square: string): HTMLElement | null {
    const coords = chessService.getSquareCoordinates(square);
    if (!coords) {
      return null;
    }

    // 通过棋盘结构查找棋子元素
    const boardContainer = document.querySelector('.board-container');
    if (!boardContainer) {
      return null;
    }

    const rows = boardContainer.querySelectorAll('.board-row');
    if (coords.row >= rows.length) {
      return null;
    }

    const row = rows[coords.row];
    const squares = row.querySelectorAll('.square');
    if (coords.col >= squares.length) {
      return null;
    }

    const squareElement = squares[coords.col];
    const pieceElement = squareElement.querySelector('.chess-piece') as HTMLElement;
    
    return pieceElement;
  }

  /**
   * 等待动画完成
   */
  private waitForAnimation(element: HTMLElement, duration: number): Promise<void> {
    return new Promise((resolve) => {
      const handleTransitionEnd = () => {
        element.removeEventListener('transitionend', handleTransitionEnd);
        resolve();
      };

      element.addEventListener('transitionend', handleTransitionEnd);
      
      // 备用超时
      setTimeout(() => {
        element.removeEventListener('transitionend', handleTransitionEnd);
        resolve();
      }, duration + 50);
    });
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 停止所有动画
   */
  stopAllAnimations(): void {
    this.activeAnimations.clear();
    
    // 重置所有棋子的动画状态
    const pieceElements = document.querySelectorAll('.chess-piece');
    pieceElements.forEach(element => {
      const piece = element as HTMLElement;
      piece.style.transition = '';
      piece.style.transform = '';
      piece.style.zIndex = '';
    });
  }

  /**
   * 检查是否有动画正在进行
   */
  isAnimating(): boolean {
    return this.activeAnimations.size > 0;
  }

  /**
   * 检测是否为低端设备
   */
  private detectLowEndDevice(): boolean {
    // 检测设备性能
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) return true; // 不支持WebGL，可能是低端设备
    
    // 检测内存（如果支持）
    const memory = (navigator as any).deviceMemory;
    if (memory && memory <= 2) return true; // 2GB以下内存
    
    // 检测CPU核心数
    const cores = navigator.hardwareConcurrency;
    if (cores && cores <= 2) return true; // 2核以下CPU
    
    // 检测用户代理（移动设备通常性能较低）
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    return isMobile;
  }
}

export const animationService = AnimationService.getInstance();
