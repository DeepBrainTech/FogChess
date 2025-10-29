export interface Player {
  id: string;
  name: string;
  color: 'white' | 'black';
  socketId: string;
}

export interface Room {
  id: string;
  name: string;
  players: Player[];
  gameState: GameState;
  createdAt: Date;
  isFull: boolean;
  timerMode?: 'unlimited' | 'classical' | 'rapid' | 'bullet';
  gameMode?: 'normal' | 'ai';
}

export interface GameState {
  board: string; // FEN notation
  currentPlayer: 'white' | 'black';
  gameStatus: 'waiting' | 'playing' | 'finished';
  winner?: 'white' | 'black' | 'draw';
  moveHistory: Move[];
  fogOfWar: FogOfWarState;
  timeout?: boolean;
  clocks?: {
    white: number; // seconds left
    black: number; // seconds left
    increment: number; // seconds per move
    mode: 'unlimited' | 'classical' | 'rapid' | 'bullet';
  };
}

export interface Move {
  from: string;
  to: string;
  piece: string;
  captured?: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
  timestamp: Date;
  player: 'white' | 'black';
}

export interface FogOfWarState {
  whiteVisible: string[]; // 白方可见的格子
  blackVisible: string[]; // 黑方可见的格子
  lastKnownPositions: {
    white: { [key: string]: string }; // 白方最后已知的棋子位置
    black: { [key: string]: string }; // 黑方最后已知的棋子位置
  };
}

export interface SocketEvents {
  // 客户端发送的事件
  'join-room': { roomId: string; playerName: string };
  'create-room': { roomName: string; playerName: string; timerMode?: 'unlimited' | 'classical' | 'rapid' | 'bullet'; gameMode?: 'normal' | 'ai' };
  'make-move': { roomId: string; move: Move };
  'get-legal-moves': { roomId: string; square: string };
  'leave-room': { roomId: string };
  'request-undo': { roomId: string };
  'respond-undo': { roomId: string; accepted: boolean };
  'surrender': { roomId: string };
  'report-timeout': { roomId: string; player: 'white' | 'black' };
  'request-draw': { roomId: string };
  'respond-draw': { roomId: string; accepted: boolean };
  
  // 服务端发送的事件
  'room-created': { room: Room };
  'room-joined': { room: Room; player: Player };
  'player-joined': { player: Player };
  'player-left': { playerId: string };
  'game-updated': { gameState: GameState };
  'move-made': { move: Move; gameState: GameState };
  'legal-moves': { square: string; moves: string[] };
  'undo-requested': { fromPlayer: string; attemptsLeft?: number };
  'undo-response': { accepted: boolean };
  'undo-executed': { gameState: GameState };
  'draw-requested': { fromPlayer: string };
  'draw-response': { accepted: boolean };
  'error': { message: string };
}
