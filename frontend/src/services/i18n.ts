import { ref } from 'vue';

export type Lang = 'zh' | 'en';

const STORAGE_KEY = 'fogchess_lang';

const initial = ((): Lang => {
  try {
    const v = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (v === 'zh' || v === 'en') return v;
  } catch {}
  // Default: zh
  return 'zh';
})();

export const currentLang = ref<Lang>(initial);

export function setLang(lang: Lang) {
  currentLang.value = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
}

export function toggleLang() {
  setLang(currentLang.value === 'zh' ? 'en' : 'zh');
}

type Dict = Record<string, { zh: string; en: string }>

const dict: Dict = {
  'app.title': { zh: '迷雾国际象棋', en: 'Fog of War Chess' },
  'home.subtitle': { zh: '体验全新的迷雾战争模式', en: 'Experience Fog of War Chess' },
  'home.hero.title': { zh: '在线迷雾战争象棋', en: 'Play Fog of War Chess Online' },
  'home.hero.description': { zh: '体验古代策略与现代智能的融合。与对手对战，掌握象棋艺术，每一步都训练你的思维。', en: 'Experience the fusion of ancient strategy and modern intelligence. Play against opponents, master the art of chess, and train your mind with every move.' },
  'home.hero.startButton': { zh: '开始游戏', en: 'Start Game' },
  'home.create.title': { zh: '创建房间', en: 'Create Room' },
  'home.create.desc': { zh: '创建新房间，邀请朋友对战', en: 'Create a new room and invite friends' },
  'home.create.button': { zh: '创建房间', en: 'Create' },
  'home.join.title': { zh: '加入房间', en: 'Join Room' },
  'home.join.desc': { zh: '输入房间ID加入朋友的对战', en: 'Enter room ID to join a room' },
  'home.join.button': { zh: '加入房间', en: 'Join' },
  'home.lobby.title': { zh: '大厅', en: 'Lobby' },
  'home.lobby.desc': { zh: '查看所有可加入的房间', en: 'View all available rooms' },
  'home.lobby.button': { zh: '进入大厅', en: 'Enter Lobby' },
  'home.profile.title': { zh: '个人资料', en: 'Profile' },
  'home.profile.desc': { zh: '查看你的个人资料，回看对局记录', en: 'View your profile, review game history' },
  'home.rules.title': { zh: '规则', en: 'Rules' },
  'home.rules.desc': { zh: '学习迷雾象棋的玩法', en: 'Learn how to play Fog of War Chess' },

  // Rules Page
  'rules.title': { zh: '游戏规则', en: 'Game Rules' },
  'rules.tab.standard': { zh: '标准国际象棋', en: 'Standard Chess' },
  'rules.tab.fog': { zh: '迷雾象棋', en: 'Fog Chess' },
  
  // Standard Rules
  'rules.std.basic.title': { zh: '基本规则', en: 'Basic Rules' },
  'rules.std.basic.desc': { zh: '双人对弈（白方先手，黑方后手），在8x8的棋盘上进行。目标是将死对方的国王。', en: 'Two players (White first, then Black) play on an 8x8 board. The goal is to checkmate the opponent\'s King.' },
  
  'rules.std.move.title': { zh: '棋子移动', en: 'Movement' },
  'rules.std.move.desc': { zh: '兵向前走；马走"日"字；象走斜线；车走直线；后走米字（直线+斜线）；王走周围一格。', en: 'Pawns move forward; Knights move in an "L" shape; Bishops diagonally; Rooks horizontally/vertically; Queens in all directions; Kings move one square in any direction.' },
  
  'rules.std.capture.title': { zh: '吃子', en: 'Capture' },
  'rules.std.capture.desc': { zh: '当你的棋子移动到对手棋子所在的格子时，对手棋子被吃掉并移出棋盘。兵是唯一吃子方向（斜前方）与移动方向不同的棋子。', en: 'When you move to a square occupied by an opponent\'s piece, that piece is captured and removed. Pawns capture diagonally forward, unlike their movement.' },
  
  'rules.std.special.title': { zh: '特殊规则', en: 'Special Moves' },
  'rules.std.special.desc': { zh: '过路兵：敌方兵刚好从起始位置前进两格经过你的兵时，你可以斜吃它（仅限当回合）。\n王车易位：国王和车都未移动过且之间无棋子、国王不在被将军状态且经过和到达的格子都不被攻击时，国王向车方向移动两格，车跳过国王到其旁边。\n升变：兵走到对方底线时，可以升变为后、车、象或马。', en: 'En Passant: If an enemy pawn advances 2 squares from start and lands beside your pawn, you may capture it diagonally (only on the next turn).\nCastling: If King and Rook haven\'t moved, no pieces between them, King is not in check and doesn\'t pass through or land on an attacked square, King moves 2 squares toward Rook, and Rook jumps to the other side of the King.\nPromotion: When a pawn reaches the opponent\'s back rank, it can be promoted to a Queen, Rook, Bishop, or Knight.' },
  
  'rules.std.check.title': { zh: '将军与将死', en: 'Check & Checkmate' },
  'rules.std.check.desc': { zh: '如果国王受到攻击（将军），必须立即解围。国王不可以走到直接受攻击的格子。如果无法解围，则是"将死"，游戏结束。', en: 'If the King is under attack (Check), you must save it immediately. The King cannot move to a square under attack. If you cannot save it, it is "Checkmate" and the game ends.' },
  
  'rules.std.end.title': { zh: '游戏结束', en: 'Ending' },
  'rules.std.end.desc': { zh: '游戏通过将死、认输或超时结束。', en: 'Game ends by Checkmate, Resignation, or Timeout.' },
  
  // Rules Demo
  'rules.demo.title': { zh: '试试看', en: 'Try it out' },
  'rules.demo.reset': { zh: '重置棋盘', en: 'Reset Board' },
  'rules.demo.currentMove': { zh: '当前回合', en: 'Current move' },
  'rules.demo.white': { zh: '白方', en: 'White' },
  'rules.demo.black': { zh: '黑方', en: 'Black' },
  'rules.demo.whiteWins': { zh: '白方获胜', en: 'White wins' },
  'rules.demo.blackWins': { zh: '黑方获胜', en: 'Black wins' },
  'rules.demo.promotion': { zh: '选择升变棋子', en: 'Choose Promotion' },

  'login.required.title': { zh: '尚未登录', en: 'Not Logged In' },
  'login.required.message': { zh: '尚未登录，无法进行游戏，请先从主页登录', en: 'You are not logged in and cannot play. Please return to the main site to log in first.' },
  'login.required.button': { zh: '回到主页登录', en: 'Return to Homepage to Log In' },

  'dialog.notStarted.title': { zh: '游戏未开始', en: 'Game Not Started' },
  'dialog.notStarted.message': { zh: '等待对手加入', en: 'Waiting for the opponent to join' },
  'dialog.finished.title': { zh: '对局结束', en: 'Game Finished' },
  'dialog.gameOver.title': { zh: '游戏结束', en: 'Game Over' },
  'dialog.gameOver.message': { zh: '对局已结束，请开始新游戏', en: 'Game has ended, please start a new game' },
  
  // Game over results
  'gameOver.victory': { zh: '胜利', en: 'Victory' },
  'gameOver.defeat': { zh: '失败', en: 'Defeat' },
  'gameOver.draw': { zh: '平局', en: 'Draw' },
  'gameOver.kingCaptured.win': { zh: '恭喜你，吃掉了对面国王！', en: 'Congratulations! You captured the opponent\'s king!' },
  'gameOver.kingCaptured.lose': { zh: '很抱歉，你被吃掉了国王！', en: 'Sorry, your king was captured!' },
  'gameOver.timeout.win': { zh: '恭喜你，对手超时了！', en: 'Congratulations! Your opponent ran out of time!' },
  'gameOver.timeout.lose': { zh: '很抱歉，你超时了！', en: 'Sorry, you ran out of time!' },
  'gameOver.surrender.win': { zh: '恭喜你，你赢了！', en: 'Congratulations! You won!' },
  'gameOver.surrender.lose': { zh: '很抱歉，你输了！', en: 'Sorry, you lost!' },
  'gameOver.noMoves.win': { zh: '恭喜你，AI无棋可走！', en: 'Congratulations! AI has no legal moves!' },
  'gameOver.noMoves.lose': { zh: '很抱歉，你无棋可走！', en: 'Sorry, you have no legal moves!' },
  'gameOver.draw.message': { zh: '平局！', en: 'It\'s a draw!' },
  'dialog.cannotUndo.title': { zh: '无法悔棋', en: 'Cannot Undo' },
  'dialog.cannotMove.title': { zh: '无法移动', en: 'Cannot Move' },
  'dialog.notYourTurn': { zh: '不是你的回合', en: 'Not your turn' },
  'dialog.undo.accepted': { zh: '对手同意了悔棋请求', en: 'Opponent accepted the undo request' },
  'dialog.undo.rejected': { zh: '对手拒绝了悔棋请求', en: 'Opponent rejected the undo request' },

  // Generic buttons
  'btn.ok': { zh: '确定', en: 'OK' },
  'btn.cancel': { zh: '取消', en: 'Cancel' },
  'btn.confirm': { zh: '确认', en: 'Confirm' },
  'btn.thinkAgain': { zh: '我再想想', en: 'Let me think' },
  'btn.agree': { zh: '同意', en: 'Agree' },
  'btn.disagree': { zh: '不同意', en: 'Disagree' },

  // Move history
  'history.title': { zh: '移动历史', en: 'Move History' },
  'history.round': { zh: '回合数', en: 'Round' },
  'history.white': { zh: '白方', en: 'White' },
  'history.black': { zh: '黑方', en: 'Black' },
  'history.hidden': { zh: '?', en: '?' },

  // Game actions
  'actions.undo': { zh: '悔棋', en: 'Undo' },
  'actions.waitingApproval': { zh: '等待对手同意...', en: 'Waiting for approval...' },
  'actions.surrender': { zh: '认输', en: 'Resign' },
  'actions.draw': { zh: '和棋', en: 'Offer Draw' },
  'actions.exportPGN': { zh: '导出PGN', en: 'Export PGN' },
  'actions.downloadFEN': { zh: '下载FEN', en: 'Export FEN' },
  'actions.sound': { zh: '音效', en: 'Sound' },
  'actions.leave': { zh: '离开游戏', en: 'Leave Game' },

  // Status card
  'status.title': { zh: '游戏状态', en: 'Game Status' },
  'status.currentPlayer': { zh: '当前玩家:', en: 'Current Player:' },
  'status.white': { zh: '白方', en: 'White' },
  'status.black': { zh: '黑方', en: 'Black' },
  'status.gameStatus': { zh: '游戏状态:', en: 'Status:' },
  'status.winner': { zh: '获胜者:', en: 'Winner:' },
  'status.waiting': { zh: '等待中', en: 'Waiting' },
  'status.waitingPlayers': { zh: '等待玩家', en: 'Waiting for players' },
  'status.playing': { zh: '游戏中', en: 'Playing' },
  'status.finished': { zh: '游戏结束', en: 'Finished' },
  'status.unknown': { zh: '未知状态', en: 'Unknown' },

  // Replay controls titles
  'replay.toStart': { zh: '回到开始', en: 'Go to start' },
  'replay.stepBack': { zh: '回退一步', en: 'Step back' },
  'replay.stepForward': { zh: '前进一步', en: 'Step forward' },
  'replay.toEnd': { zh: '跳到最新', en: 'Go to latest' },

  // Room join
  'room.join.title': { zh: '加入房间', en: 'Join Room' },
  'room.join.roomId': { zh: '房间ID:', en: 'Room ID:' },
  'room.join.roomId.ph': { zh: '输入房间ID', en: 'Enter room ID' },
  'room.join.name': { zh: '你的昵称:', en: 'Your name:' },
  'room.join.name.ph': { zh: '输入你的昵称', en: 'Enter your name' },
  'room.join.joining': { zh: '加入中...', en: 'Joining...' },
  'room.join.button': { zh: '加入房间', en: 'Join Room' },
  'room.join.fail': { zh: '加入房间失败，请检查房间ID', en: 'Failed to join. Check the room ID.' },
  'room.join.error': { zh: '加入房间时发生错误', en: 'An error occurred while joining.' },
  'room.join.availableRooms': { zh: '可用房间', en: 'Available Rooms' },
  'room.join.players': { zh: '玩家', en: 'players' },
  'room.join.full': { zh: '已满', en: 'Full' },
  'room.join.available': { zh: '可加入', en: 'Available' },
  'room.join.ai': { zh: 'AI对战', en: 'AI Game' },
  'room.join.aiFull': { zh: 'AI对战', en: 'AI Game' },

  // Room create
  'room.create.title': { zh: '创建新房间', en: 'Create New Room' },
  'room.create.roomName': { zh: '房间名称:', en: 'Room Name:' },
  'room.create.roomName.ph': { zh: '输入房间名称', en: 'Enter room name' },
  'room.create.name': { zh: '你的昵称:', en: 'Your name:' },
  'room.create.name.ph': { zh: '使用主页用户名', en: 'Using homepage username' },
  'room.create.nameReadonlyHint': { zh: '自动使用主页用户名，无需填写', en: 'Using your username automatically' },
  'room.create.timer': { zh: '计时模式:', en: 'Timer Mode:' },
  'room.create.timer.unlimited': { zh: '无限时练习', en: 'Unlimited practice' },
  'room.create.timer.classical': { zh: '慢棋30分钟+30秒增秒', en: 'Classical 30m + 30s' },
  'room.create.timer.rapid': { zh: '快棋10分钟+10秒增秒', en: 'Rapid 10m + 10s' },
  'room.create.timer.bullet': { zh: '超快2分钟+5秒增秒', en: 'Bullet 2m + 5s' },
  'room.create.timer.aiOnlyUnlimited': { zh: 'AI对战是不限时的', en: 'AI matches are unlimited time' },
  'room.create.gameMode': { zh: '游戏模式:', en: 'Game Mode:' },
  'room.create.gameMode.normal': { zh: '正常对战', en: 'Normal Game' },
  'room.create.gameMode.ai': { zh: 'AI对战', en: 'AI Game' },
  'room.create.creating': { zh: '创建中...', en: 'Creating...' },
  'room.create.button': { zh: '创建房间', en: 'Create Room' },
  'room.create.fail': { zh: '创建房间失败，请重试', en: 'Failed to create room. Please retry.' },
  'room.create.error': { zh: '创建房间时发生错误', en: 'An error occurred while creating.' },

  // Header
  'header.roomTitle': { zh: '游戏房间', en: 'Game Room' },
  'header.inviteLink': { zh: '邀请链接:', en: 'Invite Link:' },
  'header.clickCopy': { zh: '点击复制', en: 'Copy' },
  'header.inviteTooltip': { zh: '从浏览器直接加入！', en: 'Join directly from the browser!' },
  'header.roomAddress': { zh: '房间地址:', en: 'Room Address:' },
  'header.roomTooltip': { zh: '从主菜单加入房间！', en: 'Join from the main menu!' },
  'header.you': { zh: '你', en: 'You' },
  'header.opponent': { zh: '对方', en: 'Opponent' },
  'header.aiOpponent': { zh: '电脑', en: 'Computer' },
  'header.aiTurn': { zh: '轮到AI移动', en: 'AI to move' },
  'header.currentTurn': { zh: '(当前回合)', en: '(Current turn)' },

  // Draw & undo dialogs (titles/messages)
  'dialogs.leave.title': { zh: '离开游戏', en: 'Leave Game' },
  'dialogs.leave.msg': { zh: '确定要离开游戏吗？', en: 'Are you sure you want to leave?' },
  'dialogs.resign.title': { zh: '认输', en: 'Resign' },
  'dialogs.resign.msg': { zh: '确定认输吗？', en: 'Are you sure you want to resign?' },
  'dialogs.downloadFen.title': { zh: '下载FEN', en: 'Download FEN' },
  'dialogs.downloadFen.msg': { zh: '确定下载对局代码吗？', en: 'Download the current position (FEN)?' },
  'dialogs.exportPgn.title': { zh: '导出PGN', en: 'Export PGN' },
  'dialogs.exportPgn.msg': { zh: '确定导出本局PGN吗？', en: 'Export PGN for this game?' },
  'dialogs.draw.title': { zh: '申请和棋', en: 'Offer Draw' },
  'dialogs.draw.msg': { zh: '确定申请和棋吗？', en: 'Offer a draw?' },
  'dialogs.undo.request.title': { zh: '请求悔棋', en: 'Request Undo' },
  'dialogs.undo.request.msg': { zh: '确定要请求悔棋吗？', en: 'Request to undo the last move?' },
  'dialogs.undo.fromOpponent': { zh: '对手请求悔棋', en: 'Opponent requests undo' },
  'dialogs.undo.fromOpponent.msg': { zh: '{name} 请求悔棋，是否同意？{attempts}', en: '{name} requests an undo. Accept?{attempts}' },
  'dialogs.draw.fromOpponent': { zh: '对手申请和棋', en: 'Opponent offers a draw' },
  'dialogs.draw.fromOpponent.msg': { zh: '{name} 申请和棋，是否同意？', en: '{name} offers a draw. Accept?' },
  'dialogs.draw.result': { zh: '和棋结果', en: 'Draw Result' },
  'dialogs.draw.accepted': { zh: '对手同意了和棋请求', en: 'Opponent accepted the draw offer' },
  'dialogs.draw.rejected': { zh: '对手拒绝了和棋请求', en: 'Opponent rejected the draw offer' },
  
  // Cannot undo message
  'dialogs.cannotUndo.msg': { zh: '不能悔棋，请先下棋', en: 'Cannot undo, please make a move first' },

  // Promotion
  'promotion.title': { zh: '请选择升变', en: 'Choose promotion' },
  'pieces.queen': { zh: '后', en: 'Queen' },
  'pieces.knight': { zh: '马', en: 'Knight' },
  'pieces.rook': { zh: '车', en: 'Rook' },
  'pieces.bishop': { zh: '象', en: 'Bishop' },

  // Lobby
  'lobby.title': { zh: '大厅', en: 'Lobby' },
  'lobby.playerName': { zh: '你的昵称', en: 'Your name' },
  'lobby.playerNamePlaceholder': { zh: '已使用主页用户名', en: 'Using homepage username' },
  'lobby.search': { zh: '搜索', en: 'Search' },
  'lobby.searchPlaceholder': { zh: '搜索房间名称、ID或玩家', en: 'Search room name, ID or players' },
  'lobby.refresh': { zh: '刷新', en: 'Refresh' },
  'lobby.loading': { zh: '加载房间中...', en: 'Loading rooms...' },
  'lobby.noRooms': { zh: '暂无房间', en: 'No rooms yet' },
  'lobby.roomName': { zh: '房间', en: 'Room' },
  'lobby.waitingPlayers': { zh: '等待玩家...', en: 'Waiting for players...' },
  'lobby.timerMode.unlimited': { zh: '无限时', en: 'Unlimited' },
  'lobby.timerMode.classical': { zh: '慢棋', en: 'Classical' },
  'lobby.timerMode.rapid': { zh: '快棋', en: 'Rapid' },
  'lobby.timerMode.bullet': { zh: '超快', en: 'Bullet' },
  'lobby.status.waiting': { zh: '等待中', en: 'Waiting' },
  'lobby.status.playing': { zh: '游戏中', en: 'Playing' },
  'lobby.status.finished': { zh: '已结束', en: 'Finished' },
  'lobby.join': { zh: '加入', en: 'Join' },
  'lobby.full': { zh: '已满', en: 'Full' },
  'lobby.backToHome': { zh: '返回主界面', en: 'Back to Home' },

  // Game view
  'home.backToPortal': { zh: '返回游戏总主页', en: 'Back to Main Portal' },

  // Profile
  'profile.username': { zh: '用户名', en: 'Username' },
  'profile.totalGames': { zh: '总对局数', en: 'Total Games' },
  'profile.winRate': { zh: '胜率', en: 'Win Rate' },
  'profile.rating': { zh: '评分', en: 'Rating' },
  'profile.gameHistory': { zh: '对局记录', en: 'Game History' },
  'profile.loading': { zh: '加载中...', en: 'Loading...' },
  'profile.noGames': { zh: '暂无对局记录', en: 'No games yet' },
  'profile.win': { zh: '胜利', en: 'Win' },
  'profile.loss': { zh: '失败', en: 'Loss' },
  'profile.draw': { zh: '平局', en: 'Draw' },
  'profile.timeout': { zh: '超时', en: 'Timeout' },

  // Review
  'review.title': { zh: '对局回顾', en: 'Game Review' },
  'review.viewMode.white': { zh: '白方视野', en: 'White View' },
  'review.viewMode.black': { zh: '黑方视野', en: 'Black View' },
  'review.viewMode.alternating': { zh: '交替视野', en: 'Alternating View' },
  'review.viewMode.god': { zh: '上帝视野', en: 'God View' },
  'review.board.primary': { zh: '迷雾视角', en: 'Fog View' },
  'review.board.god': { zh: '上帝视角', en: 'God View' },

  // Chat
  'chat.title': { zh: '聊天', en: 'Chat' },
  'chat.placeholder': { zh: '输入', en: 'input' },
  'chat.send': { zh: '发送', en: 'send' },
  'chat.empty': { zh: '暂无消息', en: 'No messages yet' },
};

export function t(key: keyof typeof dict): string {
  const item = dict[key];
  if (!item) return key;
  return item[currentLang.value];
}


