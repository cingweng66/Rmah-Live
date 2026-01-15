// 麻将游戏相关的TypeScript类型定义

export type Position = '东' | '南' | '西' | '北';
export type Wind = '东' | '南' | '西' | '北';

export interface WaitInfo {
  waits: string[]; // 待牌列表，如 ['m1', 'p7', 's9']
  totalCount: number; // 总剩余枚数
  hasYaku: boolean; // 是否有役（true=正常显示，false=加灰色遮罩）
}

// 役种信息
export interface YakuItem {
  name: string; // 役种名称（中文）
  han: number; // 翻数
  closedOnly?: boolean; // 是否门前限定
}

// 和牌信息
export interface HandResult {
  yakuList: YakuItem[]; // 役种列表
  fu: number; // 符数
  han: number; // 总翻数（包含ドラ）
  dora: number; // ドラ数量
  uradora?: number; // 里ドラ数量（可选）
  points: number; // 点数
  timestamp: number; // 和牌时间戳
}

export interface Player {
  id: string;
  name: string;
  score: number;
  isRiichi: boolean;
  position: Position;
  teamName?: string; // 队伍名称，可选
  waitInfo?: WaitInfo; // 待牌信息，可选
  handResult?: HandResult; // 和牌信息，可选
}

export interface OperationHistory {
  id: string;
  timestamp: number;
  operation: string; // 操作类型，如 "修改玩家姓名"、"增加分数"、"下一局" 等
  description: string; // 操作描述，如 "将玩家1的姓名改为张三"、"玩家1增加8000分" 等
  previousState: GameState; // 操作前的状态快照
}

// 分数变化项，支持显示多个变化
export interface ScoreDiffItem {
  value: number; // 分数变化值
  label?: string; // 可选的标签（如"立直扣分"、"听牌奖励"等）
}

export interface GameState {
  players: Player[];
  roundWind: Wind;
  roundNumber: number;
  combo: number; // 本场
  riichiSticks: number; // 立直棒
  riichiStickOwners?: string[]; // 立直棒所属玩家ID列表（用于取消立直时归还点棒和结算时判断归属）
  riichiConfirmed?: Record<string, boolean>; // 立直是否正式成立（key: playerId, value: 是否已正式成立）
  isGameActive: boolean;
  handStartScores?: Record<string, number>;
  lastScoreDiffs?: Record<string, number | ScoreDiffItem[]>; // 支持单个数字或数组（多个变化项）
  lastDiffTimestamp?: number | null;
  doraTiles?: string[];
  matchTitle?: string;
  lastRiichi?: { playerId: string; timestamp: number } | null;
  positionImages?: Partial<Record<Position, string>>; // 位置图片（base64）
  playerColors?: Record<string, string>; // 玩家颜色 { playerId: hexColor }
  operationHistory?: OperationHistory[]; // 操作历史记录（仅前端使用，不保存到数据库）
}

export interface GameActions {
  updatePlayerName: (playerId: string, name: string) => void;
  updatePlayerTeamName: (playerId: string, teamName: string) => void;
  updatePlayerScore: (playerId: string, score: number) => void;
  addScore: (playerId: string, points: number) => void;
  toggleRiichi: (playerId: string) => void;
  confirmRiichi: (playerId: string) => void; // 确认立直正式成立
  setCombo: (combo: number) => void;
  setRiichiSticks: (sticks: number) => void;
  nextRound: (isRenchan?: boolean) => void;
  prevRound: () => void;
  jumpToRound: (wind: Wind, number: number) => void;
  resetGame: () => void;
  startGame: () => void; // 开始游戏（初始化并广播状态）
  drawRound: (isRenchan?: boolean) => void; // 流局，isRenchan: 是否连庄
  setDoraTiles: (tiles: string[]) => void;
  applyTransfer: (fromId: string, toId: string, points: number) => void;
  applyMultiple: (transfers: Array<{ fromId: string; toId: string; points: number }>, extraDiffs?: Record<string, number>, isDrawRound?: boolean) => void;
  setMatchTitle: (title: string) => void;
  setPositionImage: (position: Position, imageData: string | null) => void; // 设置位置图片
  setState: (state: Partial<GameState>) => void; // 设置游戏状态（用于公开显示）
  setPlayerColor: (playerId: string, color: string) => void; // 设置玩家颜色
  updatePlayerWaitInfo: (playerId: string, waitInfo: WaitInfo | null) => void; // 更新玩家待牌信息
  setPlayerHandResult: (playerId: string, handResult: HandResult | null) => void; // 设置玩家和牌信息
  undo: () => void; // 回退到上一个操作
  clearHistory: () => void; // 清空操作历史
}

export type GameStore = GameState & GameActions;
