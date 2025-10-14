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
  'app.title': { zh: '迷雾国际象棋', en: 'FogChess' },
  'home.subtitle': { zh: '体验全新的迷雾战争模式', en: 'Experience Fog of War Chess' },
  'home.create.title': { zh: '创建房间', en: 'Create Room' },
  'home.create.desc': { zh: '创建新房间，邀请朋友对战', en: 'Create a new room and invite friends' },
  'home.create.button': { zh: '创建房间', en: 'Create' },
  'home.join.title': { zh: '加入房间', en: 'Join Room' },
  'home.join.desc': { zh: '输入房间ID加入朋友的对战', en: 'Enter room ID to join a room' },
  'home.join.button': { zh: '加入房间', en: 'Join' },

  'dialog.notStarted.title': { zh: '游戏未开始', en: 'Game Not Started' },
  'dialog.notStarted.message': { zh: '等待对手加入', en: 'Waiting for the opponent to join' },
  'dialog.finished.title': { zh: '对局结束', en: 'Game Finished' },
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

  // Room create
  'room.create.title': { zh: '创建新房间', en: 'Create New Room' },
  'room.create.roomName': { zh: '房间名称:', en: 'Room Name:' },
  'room.create.roomName.ph': { zh: '输入房间名称', en: 'Enter room name' },
  'room.create.name': { zh: '你的昵称:', en: 'Your name:' },
  'room.create.name.ph': { zh: '输入你的昵称', en: 'Enter your name' },
  'room.create.timer': { zh: '计时模式:', en: 'Timer Mode:' },
  'room.create.timer.unlimited': { zh: '无限时练习', en: 'Unlimited practice' },
  'room.create.timer.classical': { zh: '慢棋30分钟+30秒增秒', en: 'Classical 30m + 30s' },
  'room.create.timer.rapid': { zh: '快棋10分钟+10秒增秒', en: 'Rapid 10m + 10s' },
  'room.create.timer.bullet': { zh: '超快2分钟+5秒增秒', en: 'Bullet 2m + 5s' },
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
};

export function t(key: keyof typeof dict): string {
  const item = dict[key];
  if (!item) return key;
  return item[currentLang.value];
}


