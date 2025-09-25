/**
 * 音效管理服务
 */
class AudioService {
  private moveSound: HTMLAudioElement | null = null;
  private captureSound: HTMLAudioElement | null = null;
  private isEnabled: boolean = true;

  constructor() {
    this.initializeAudio();
  }

  /**
   * 初始化音效
   */
  private initializeAudio() {
    try {
      // 创建移动音效对象
      this.moveSound = new Audio();
      this.moveSound.preload = 'auto';
      this.moveSound.volume = 0.3; // 设置音量为30%
      this.moveSound.src = '/sounds/move.mp3';
      
      // 创建吃子音效对象
      this.captureSound = new Audio();
      this.captureSound.preload = 'auto';
      this.captureSound.volume = 0.4; // 吃子音效稍大一些
      this.captureSound.src = '/sounds/capture.mp3';
      
      // 处理加载错误
      this.moveSound.addEventListener('error', () => {
        console.warn('Move sound failed to load');
      });
      
      this.captureSound.addEventListener('error', () => {
        console.warn('Capture sound failed to load');
      });
      
      // 预加载音效
      this.moveSound.load();
      this.captureSound.load();
    } catch (error) {
      console.warn('Audio initialization failed:', error);
      this.isEnabled = false;
    }
  }

  /**
   * 播放移动音效
   */
  playMoveSound() {
    if (!this.isEnabled || !this.moveSound) return;
    this.playSound(this.moveSound, 'move');
  }

  /**
   * 播放吃子音效
   */
  playCaptureSound() {
    if (!this.isEnabled || !this.captureSound) return;
    this.playSound(this.captureSound, 'capture');
  }

  /**
   * 通用音效播放方法
   */
  private playSound(sound: HTMLAudioElement, type: string) {
    try {
      // 重置播放位置到开始
      sound.currentTime = 0;
      
      // 播放音效
      const playPromise = sound.play();
      
      // 处理播放失败
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn(`${type} sound play failed:`, error);
        });
      }
    } catch (error) {
      console.warn(`${type} sound play error:`, error);
    }
  }

  /**
   * 设置音效开关
   */
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  /**
   * 获取音效开关状态
   */
  getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * 设置音量 (0-1)
   */
  setVolume(volume: number) {
    if (this.moveSound) {
      this.moveSound.volume = Math.max(0, Math.min(1, volume));
    }
  }
}

// 导出单例实例
export const audioService = new AudioService();
