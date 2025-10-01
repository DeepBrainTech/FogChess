export interface TimerState {
  white: number; // seconds left
  black: number; // seconds left
  increment: number; // seconds per move
  mode: 'unlimited' | 'classical' | 'rapid' | 'bullet';
  currentPlayer: 'white' | 'black';
  turnStartedAt: number; // timestamp
}

export class TimerService {
  private timers: Map<string, TimerState> = new Map();

  /**
   * 初始化房间计时器
   */
  initializeTimer(roomId: string, timerMode: 'unlimited' | 'classical' | 'rapid' | 'bullet'): TimerState {
    const config = this.getTimerConfig(timerMode);
    const timer: TimerState = {
      white: config.initialTime,
      black: config.initialTime,
      increment: config.increment,
      mode: timerMode,
      currentPlayer: 'white',
      turnStartedAt: Date.now()
    };
    
    this.timers.set(roomId, timer);
    return timer;
  }

  /**
   * 获取计时器配置
   */
  private getTimerConfig(mode: 'unlimited' | 'classical' | 'rapid' | 'bullet') {
    const configs = {
      unlimited: { initialTime: 0, increment: 0 },
      classical: { initialTime: 30 * 60, increment: 30 }, // 30分钟 + 30秒
      rapid: { initialTime: 10 * 60, increment: 10 },     // 10分钟 + 10秒
      bullet: { initialTime: 2 * 60, increment: 5 }       // 2分钟 + 5秒
    };
    return configs[mode];
  }

  /**
   * 处理移动，更新计时器
   */
  processMove(roomId: string, currentPlayer: 'white' | 'black'): { 
    success: boolean; 
    clocks?: TimerState; 
    timeout?: boolean; 
    winner?: 'white' | 'black';
    error?: string;
  } {
    const timer = this.timers.get(roomId);
    if (!timer) {
      return { success: false, error: 'Timer not initialized' };
    }

    const now = Date.now();
    const elapsed = Math.floor((now - timer.turnStartedAt) / 1000);

    // 扣除当前玩家的时间
    if (currentPlayer === 'white') {
      timer.white = Math.max(0, timer.white - elapsed);
    } else {
      timer.black = Math.max(0, timer.black - elapsed);
    }

    // 检查超时
    if (timer.white <= 0 || timer.black <= 0) {
      const winner = timer.white <= 0 ? 'black' : 'white';
      return { 
        success: true, 
        timeout: true, 
        winner,
        clocks: { ...timer }
      };
    }

    // 给移动方加时
    if (currentPlayer === 'white') {
      timer.white += timer.increment;
    } else {
      timer.black += timer.increment;
    }

    // 切换玩家
    timer.currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
    timer.turnStartedAt = now;

    return { 
      success: true, 
      clocks: { ...timer },
      timeout: false
    };
  }

  /**
   * 获取当前剩余时间（考虑正在进行的回合）
   */
  getCurrentTimes(roomId: string): TimerState | null {
    const timer = this.timers.get(roomId);
    if (!timer) return null;

    const now = Date.now();
    const elapsed = Math.floor((now - timer.turnStartedAt) / 1000);

    let whiteTime = timer.white;
    let blackTime = timer.black;

    // 只有当前正在走的玩家才扣除时间
    if (timer.currentPlayer === 'white') {
      whiteTime = Math.max(0, whiteTime - elapsed);
    } else {
      blackTime = Math.max(0, blackTime - elapsed);
    }

    return {
      ...timer,
      white: whiteTime,
      black: blackTime
    };
  }

  /**
   * 获取计时器状态（用于游戏开始时的初始化）
   */
  getTimerState(roomId: string): TimerState | null {
    return this.timers.get(roomId) || null;
  }

  /**
   * 清理计时器
   */
  cleanupTimer(roomId: string): void {
    this.timers.delete(roomId);
  }

  /**
   * 清理所有计时器
   */
  cleanupAllTimers(): void {
    this.timers.clear();
  }
}
