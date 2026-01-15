import { create } from 'zustand';
import { GameStore, Player, Wind, GameState, Position, OperationHistory, ScoreDiffItem, WaitInfo } from '../types/game';
import { websocketService } from '../services/websocket.service';
import { authService } from '../services/auth.service';

// 初始玩家数据
const createInitialPlayers = (): Player[] => [
  { id: '1', name: '玩家1', score: 25000, isRiichi: false, position: '东' },
  { id: '2', name: '玩家2', score: 25000, isRiichi: false, position: '南' },
  { id: '3', name: '玩家3', score: 25000, isRiichi: false, position: '西' },
  { id: '4', name: '玩家4', score: 25000, isRiichi: false, position: '北' },
];

const STORAGE_KEY = 'mahjong-game-state-v1';
const GAME_ID = 'default'; // 默认游戏ID，可以后续扩展为多游戏支持

// 注意：WebSocket 连接由 App.tsx 中的 ProtectedRoute 处理
// 这里不再自动连接，避免重复连接导致的问题

const loadStateFromStorage = (): GameState | null => {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const saveStateToStorage = (state: GameState) => {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
};

// 创建操作历史记录的辅助函数
// 优化：手动深拷贝，避免structuredClone无法克隆函数的问题
const deepCloneState = (state: GameState): GameState => {
  // 手动克隆所有可序列化的字段，不包含函数
  return {
    players: state.players.map(p => ({ ...p })),
    roundWind: state.roundWind,
    roundNumber: state.roundNumber,
    combo: state.combo,
    riichiSticks: state.riichiSticks,
    isGameActive: state.isGameActive,
    handStartScores: { ...state.handStartScores },
    lastScoreDiffs: state.lastScoreDiffs ? (() => {
      // 深拷贝 lastScoreDiffs，支持数组格式
      const cloned: Record<string, number | ScoreDiffItem[]> = {};
      Object.keys(state.lastScoreDiffs).forEach(key => {
        const value = state.lastScoreDiffs[key];
        if (Array.isArray(value)) {
          cloned[key] = value.map(item => ({ ...item }));
        } else {
          cloned[key] = value;
        }
      });
      return cloned;
    })() : {},
    lastDiffTimestamp: state.lastDiffTimestamp,
    doraTiles: [...(state.doraTiles || [])],
    matchTitle: state.matchTitle,
    lastRiichi: state.lastRiichi ? { ...state.lastRiichi } : null,
    positionImages: { ...state.positionImages },
    playerColors: { ...state.playerColors },
    riichiStickOwners: [...(state.riichiStickOwners || [])],
    riichiConfirmed: { ...(state.riichiConfirmed || {}) },
  };
};

const createHistoryEntry = (
  operation: string,
  description: string,
  previousState: GameState
): OperationHistory => ({
  id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  timestamp: Date.now(),
  operation,
  description,
  previousState: deepCloneState(previousState), // 优化的深拷贝
});

export const useGameStore = create<GameStore>((set, get) => {
  // 防抖定时器
  let broadcastTimer: NodeJS.Timeout | null = null;
  const BROADCAST_DELAY = 100; // 100ms 防抖延迟

  const broadcastState = () => {
    // 检查是否在只读模式（公开显示页面）
    if (typeof window !== 'undefined' && window.location.hash.includes('display-public')) {
      // 只读模式不广播状态
      return;
    }

    // 清除之前的定时器
    if (broadcastTimer) {
      clearTimeout(broadcastTimer);
    }

    // 设置新的防抖定时器
    broadcastTimer = setTimeout(() => {
      const s = get();
      const serializable: GameState = {
        players: s.players,
        roundWind: s.roundWind,
        roundNumber: s.roundNumber,
        combo: s.combo,
        riichiSticks: s.riichiSticks,
        riichiStickOwners: s.riichiStickOwners,
        riichiConfirmed: s.riichiConfirmed,
        isGameActive: s.isGameActive,
        handStartScores: s.handStartScores,
        lastScoreDiffs: s.lastScoreDiffs,
        lastDiffTimestamp: s.lastDiffTimestamp ?? null,
        doraTiles: s.doraTiles,
        matchTitle: s.matchTitle,
        lastRiichi: s.lastRiichi ?? null,
        positionImages: s.positionImages,
        playerColors: s.playerColors,
      };
      
      // 只在开发环境输出调试信息
      if (process.env.NODE_ENV === 'development') {
        // 调试信息已移除，减少性能开销
      }
      
      saveStateToStorage(serializable);
      
      // 通过 WebSocket 发送状态更新（只在控制模式）
      if (authService.isAuthenticated() && websocketService.isConnected()) {
        websocketService.updateGameState(serializable);
      }
      
      broadcastTimer = null;
    }, BROADCAST_DELAY);
  };

  const cached = loadStateFromStorage();
  return {
    players: cached?.players ?? createInitialPlayers(),
    roundWind: cached?.roundWind ?? ('东' as Wind),
    roundNumber: cached?.roundNumber ?? 1,
    combo: cached?.combo ?? 0,
    riichiSticks: cached?.riichiSticks ?? 0,
    riichiStickOwners: cached?.riichiStickOwners ?? [],
    riichiConfirmed: cached?.riichiConfirmed ?? {},
    isGameActive: cached?.isGameActive ?? true,
    handStartScores: cached?.handStartScores ?? (cached?.players
      ? Object.fromEntries(cached.players.map(p => [p.id, p.score]))
      : Object.fromEntries(createInitialPlayers().map(p => [p.id, p.score]))),
    lastScoreDiffs: cached?.lastScoreDiffs ?? {},
    lastDiffTimestamp: cached?.lastDiffTimestamp ?? null,
    doraTiles: cached?.doraTiles ?? [],
    matchTitle: cached?.matchTitle ?? '赛事直播',
    lastRiichi: cached?.lastRiichi ?? null,
    positionImages: cached?.positionImages ?? {},
    playerColors: cached?.playerColors ?? {},
    operationHistory: [], // 操作历史记录（不保存到localStorage，每次刷新清空）

    // Actions
    updatePlayerName: (playerId: string, name: string) => {
      const currentState = get();
      const player = currentState.players.find(p => p.id === playerId);
      const oldName = player?.name || '';
      
      // 保存操作历史
      const history = createHistoryEntry(
        '修改玩家姓名',
        `将${player?.position}家（${oldName}）的姓名改为${name}`,
        currentState
      );
      
      set((state) => ({
        ...state,
        players: state.players.map(player =>
          player.id === playerId ? { ...player, name } : player
        ),
        operationHistory: [...(state.operationHistory || []), history].slice(-50) // 最多保存50条
      }));
      broadcastState();
    },

    updatePlayerTeamName: (playerId: string, teamName: string) => {
      const currentState = get();
      const player = currentState.players.find(p => p.id === playerId);
      
      const history = createHistoryEntry(
        '修改队伍名称',
        `将${player?.position}家（${player?.name}）的队伍名称改为${teamName || '无'}`,
        currentState
      );
      
      set((state) => ({
        ...state,
        players: state.players.map(player =>
          player.id === playerId ? { ...player, teamName: teamName || undefined } : player
        ),
        operationHistory: [...(state.operationHistory || []), history].slice(-50)
      }));
      broadcastState();
    },

    updatePlayerScore: (playerId: string, score: number) => {
      const currentState = get();
      const player = currentState.players.find(p => p.id === playerId);
      const oldScore = player?.score || 0;
      
      const history = createHistoryEntry(
        '修改玩家点数',
        `将${player?.position}家（${player?.name}）的点数从${oldScore.toLocaleString()}改为${score.toLocaleString()}`,
        currentState
      );
      
      set((state) => ({
        ...state,
        players: state.players.map(player =>
          player.id === playerId ? { ...player, score } : player
        ),
        operationHistory: [...(state.operationHistory || []), history].slice(-50)
      }));
      broadcastState();
    },

    addScore: (playerId: string, points: number) => {
      const currentState = get();
      const player = currentState.players.find(p => p.id === playerId);
      
      const history = createHistoryEntry(
        '增加分数',
        `${player?.position}家（${player?.name}）${points >= 0 ? '增加' : '减少'}${Math.abs(points).toLocaleString()}分`,
        currentState
      );
      
      set((state) => {
        const updatedPlayers = state.players.map(player =>
          player.id === playerId
            ? { ...player, score: player.score + points } // 允许负数
            : player
        );
        
        // 确保总数保持100000分（M-League规则）
        const total = updatedPlayers.reduce((sum, p) => sum + p.score, 0);
        if (total !== 100000) {
          const diff = 100000 - total;
          // 从其他玩家中平均扣除或增加
          const otherPlayers = updatedPlayers.filter(p => p.id !== playerId);
          if (otherPlayers.length > 0) {
            const perPlayer = Math.floor(diff / otherPlayers.length);
            const remainder = diff % otherPlayers.length;
            otherPlayers.forEach((p, idx) => {
              p.score += perPlayer + (idx < remainder ? 1 : 0);
            });
          }
        }
        
        return {
          ...state,
          players: updatedPlayers,
          lastScoreDiffs: { [playerId]: points },
          lastDiffTimestamp: Date.now(),
          operationHistory: [...(state.operationHistory || []), history].slice(-50)
        };
      });
      broadcastState();
    },

    toggleRiichi: (playerId: string) => {
      const currentState = get();
      const player = currentState.players.find(p => p.id === playerId);
      
      const history = createHistoryEntry(
        player?.isRiichi ? '取消立直' : '立直',
        `${player?.position}家（${player?.name}）${player?.isRiichi ? '取消立直' : '立直'}`,
        currentState
      );
      
      set((state) => {
        const player = state.players.find(p => p.id === playerId);
        if (!player) return state;

        // 立直棒处理逻辑：
        // - 立直时：不立即扣点，只记录立直棒+1，记录到riichiStickOwners，标记为未正式成立
        // - 取消立直时：如果还没正式成立，移除记录；如果已正式成立，不退点
        let newRiichiSticks = state.riichiSticks;
        let newRiichiStickOwners = [...(state.riichiStickOwners || [])];
        let newRiichiConfirmed = { ...(state.riichiConfirmed || {}) };
        
        if (!player.isRiichi) {
          // 玩家立直：不立即扣点，只记录立直棒+1，记录所属玩家，标记为未正式成立
          // 点数扣减在结算或流局时再处理
          newRiichiSticks += 1;
          newRiichiStickOwners.push(playerId);
          newRiichiConfirmed[playerId] = false; // 初始状态：未正式成立
        } else {
          // 取消立直：如果还没正式成立，移除记录；如果已正式成立，不退点
          const isConfirmed = newRiichiConfirmed[playerId] === true;
          if (newRiichiSticks > 0 && newRiichiStickOwners.includes(playerId)) {
            newRiichiSticks -= 1;
            newRiichiStickOwners = newRiichiStickOwners.filter(id => id !== playerId);
            delete newRiichiConfirmed[playerId];
            // 如果还没正式成立，不需要退点（因为本来就没扣）
            // 如果已正式成立，不退点
          }
        }

        return {
          ...state,
          riichiSticks: newRiichiSticks,
          riichiStickOwners: newRiichiStickOwners,
          riichiConfirmed: newRiichiConfirmed,
          players: state.players.map(p =>
            p.id === playerId 
              ? { 
                  ...p, 
                  isRiichi: !p.isRiichi
                }
              : p
          ),
          lastRiichi: !player.isRiichi ? { playerId, timestamp: Date.now() } : state.lastRiichi ?? null,
          operationHistory: [...(state.operationHistory || []), history].slice(-50)
        };
      });
      broadcastState();
    },

    // 确认立直正式成立（选牌/横置弃牌后调用）
    confirmRiichi: (playerId: string) => {
      set((state) => {
        const newRiichiConfirmed = { ...(state.riichiConfirmed || {}) };
        if (state.riichiStickOwners?.includes(playerId)) {
          newRiichiConfirmed[playerId] = true; // 标记为正式成立
        }
        return {
          ...state,
          riichiConfirmed: newRiichiConfirmed
        };
      });
      broadcastState();
    },

    setCombo: (combo: number) => {
      const currentState = get();
      const oldCombo = currentState.combo;
      
      const history = createHistoryEntry(
        '设置本场数',
        `将本场数从${oldCombo}改为${combo}`,
        currentState
      );
      
      set((state) => ({
        ...state,
        combo: Math.max(0, combo),
        operationHistory: [...(state.operationHistory || []), history].slice(-50)
      }));
      broadcastState();
    },

    setRiichiSticks: (sticks: number) => {
      const currentState = get();
      const oldSticks = currentState.riichiSticks;
      
      const history = createHistoryEntry(
        '设置立直棒',
        `将立直棒从${oldSticks}根改为${sticks}根`,
        currentState
      );
      
      set((state) => ({
        ...state,
        riichiSticks: Math.max(0, sticks),
        operationHistory: [...(state.operationHistory || []), history].slice(-50)
      }));
      broadcastState();
    },

    nextRound: (isRenchan: boolean = false) => {
      const currentState = get();
      
      const history = createHistoryEntry(
        '下一局',
        `进入${isRenchan ? '连庄' : '下一局'}，当前${currentState.roundWind}${currentState.roundNumber}局`,
        currentState
      );
      
      set((state) => {
        const diffs = Object.fromEntries(state.players.map(p => [p.id, p.score - (state.handStartScores?.[p.id] ?? p.score)]));
        let newRoundNumber = state.roundNumber;
        let newRoundWind = state.roundWind;
        let newCombo = state.combo;

        if (isRenchan) {
          newCombo += 1;
        } else {
          newCombo = 0;
        if (newRoundNumber === 4) {
          newRoundNumber = 1;
          const winds: Wind[] = ['东', '南', '西', '北'];
          const currentIndex = winds.indexOf(newRoundWind);
          newRoundWind = winds[(currentIndex + 1) % 4];
        } else {
          newRoundNumber += 1;
          }
        }

        return {
          ...state,
          roundWind: newRoundWind,
          roundNumber: newRoundNumber,
          combo: newCombo,
          doraTiles: [], // 清空Dora
          players: state.players.map(player => ({ 
            ...player, 
            isRiichi: false,
            waitInfo: undefined, // 清空待牌信息
            handResult: undefined // 清空和牌信息
          })),
          lastScoreDiffs: diffs,
          lastDiffTimestamp: Date.now(),
          handStartScores: Object.fromEntries(state.players.map(p => [p.id, p.score])),
          operationHistory: [...(state.operationHistory || []), history].slice(-50)
        };
      });
      broadcastState();
    },

    prevRound: () => {
      const currentState = get();
      
      const history = createHistoryEntry(
        '上一局',
        `返回上一局，当前${currentState.roundWind}${currentState.roundNumber}局`,
        currentState
      );
      
      set((state) => {
        let newRoundNumber = state.roundNumber;
        let newRoundWind = state.roundWind;
        
        if (newRoundNumber === 1) {
          if (newRoundWind !== '东') {
            newRoundNumber = 4;
            const winds: Wind[] = ['东', '南', '西', '北'];
            const currentIndex = winds.indexOf(newRoundWind);
            // Index: 东0, 南1, 西2, 北3. 
            // Prev: (index + 3) % 4? No. (index - 1 + 4) % 4.
            // 东(0) -> -1 -> 3(北). Correct.
            // 南(1) -> 0(东). Correct.
            newRoundWind = winds[(currentIndex - 1 + 4) % 4];
          }
        } else {
          newRoundNumber -= 1;
        }

        return {
          ...state,
          roundWind: newRoundWind,
          roundNumber: newRoundNumber,
          operationHistory: [...(state.operationHistory || []), history].slice(-50)
        };
      });
      broadcastState();
    },

    jumpToRound: (wind: Wind, number: number) => {
      const currentState = get();
      
      const history = createHistoryEntry(
        '跳转到指定局',
        `从${currentState.roundWind}${currentState.roundNumber}局跳转到${wind}${number}局`,
        currentState
      );
      
      set((state) => ({
        ...state,
        roundWind: wind,
        roundNumber: number,
        operationHistory: [...(state.operationHistory || []), history].slice(-50)
      }));
      broadcastState();
    },

    drawRound: (isRenchan: boolean = false) => {
      const currentState = get();
      
      const history = createHistoryEntry(
        '流局',
        `流局${isRenchan ? '（连庄）' : '（过庄）'}，当前${currentState.roundWind}${currentState.roundNumber}局`,
        currentState
      );
      
      set((state) => {
        const diffs = Object.fromEntries(state.players.map(p => [p.id, p.score - (state.handStartScores?.[p.id] ?? p.score)]));
        
        // 流局结算逻辑
        let newRoundNumber = state.roundNumber;
        let newRoundWind = state.roundWind;
        
        if (isRenchan) {
          // 连庄（Renchan）：庄家听牌，本场+1，局数不变，场风不变
          return {
            ...state,
            combo: state.combo + 1, // 本场+1
            roundWind: newRoundWind,
            roundNumber: newRoundNumber, // 局数不变
            doraTiles: [], // 清空Dora
            players: state.players.map(player => ({ 
              ...player, 
              isRiichi: false,
              waitInfo: undefined, // 清空待牌信息
              handResult: undefined // 清空和牌信息
            })),
            lastScoreDiffs: diffs,
            lastDiffTimestamp: Date.now(),
            handStartScores: Object.fromEntries(state.players.map(p => [p.id, p.score]))
            // 立直棒（riichiSticks）和归属记录保持不变，带到下一局
            // riichiStickOwners 和 riichiConfirmed 也保持不变
          };
        } else {
          // 过庄（Oya-nagare）：庄家不听，进入下一局
          // 流局时如果庄家不听：过庄，本场+1，庄家变成下一个玩家
          if (newRoundNumber === 4) {
            // 如果已经是第4局，进入下一场
            newRoundNumber = 1;
            const winds: Wind[] = ['东', '南', '西', '北'];
            const currentIndex = winds.indexOf(newRoundWind);
            newRoundWind = winds[(currentIndex + 1) % 4];
          } else {
            newRoundNumber += 1;
          }
          
        return {
          ...state,
            combo: state.combo + 1, // 流局时庄家不听：过庄，本场+1
            roundWind: newRoundWind,
            roundNumber: newRoundNumber,
            doraTiles: [], // 清空Dora
          players: state.players.map(player => ({ 
            ...player, 
            isRiichi: false,
            waitInfo: undefined, // 清空待牌信息
            handResult: undefined // 清空和牌信息
          })),
          lastScoreDiffs: diffs,
          lastDiffTimestamp: Date.now(),
          handStartScores: Object.fromEntries(state.players.map(p => [p.id, p.score])),
          operationHistory: [...(state.operationHistory || []), history].slice(-50)
            // 立直棒（riichiSticks）和归属记录保持不变，带到下一局
            // riichiStickOwners 和 riichiConfirmed 也保持不变
        };
        }
      });
      broadcastState();
    },

    resetGame: () => {
      set({
        players: createInitialPlayers(),
        roundWind: '东' as Wind,
        roundNumber: 1,
        combo: 0,
        riichiSticks: 0,
        riichiStickOwners: [],
        riichiConfirmed: {},
        isGameActive: true,
        handStartScores: Object.fromEntries(createInitialPlayers().map(p => [p.id, p.score])),
        lastScoreDiffs: {},
        lastDiffTimestamp: null,
        doraTiles: []
      });
      broadcastState();
    },

    startGame: () => {
      set((state) => {
        // 如果游戏已经活跃，则不重新开始
        if (state.isGameActive && state.players.length > 0 && state.players[0].name !== '玩家1') {
          console.log('Game already active, not restarting.');
          return state;
        }
        const initialPlayers = createInitialPlayers();
        return {
          ...state,
          players: initialPlayers,
          roundWind: '东' as Wind,
          roundNumber: 1,
          combo: 0,
          riichiSticks: 0,
          isGameActive: true,
          handStartScores: Object.fromEntries(initialPlayers.map(p => [p.id, p.score])),
          lastScoreDiffs: {},
          lastDiffTimestamp: null,
          doraTiles: [],
          matchTitle: '赛事直播',
          lastRiichi: null,
          positionImages: {},
        };
      });
      // 立即广播状态
      broadcastState();
      // 再次确保通过 WebSocket 发送
      setTimeout(() => {
        const state = useGameStore.getState();
        if (websocketService.isConnected()) {
          const serializable: any = {
            players: state.players,
            roundWind: state.roundWind,
            roundNumber: state.roundNumber,
            combo: state.combo,
            riichiSticks: state.riichiSticks,
            riichiStickOwners: state.riichiStickOwners ?? [],
            riichiConfirmed: state.riichiConfirmed ?? {},
            isGameActive: true,
            handStartScores: state.handStartScores,
            lastScoreDiffs: state.lastScoreDiffs,
            lastDiffTimestamp: state.lastDiffTimestamp ?? null,
            doraTiles: state.doraTiles,
            matchTitle: state.matchTitle,
            lastRiichi: state.lastRiichi ?? null,
            positionImages: state.positionImages,
            playerColors: state.playerColors,
          };
          websocketService.updateGameState(serializable);
        }
      }, 100);
    },

    setDoraTiles: (tiles: string[]) => {
      const currentState = get();
      
      const history = createHistoryEntry(
        '设置宝牌',
        `设置${tiles.length}张宝牌`,
        currentState
      );
      
      set((state) => ({
        ...state,
        doraTiles: tiles,
        operationHistory: [...(state.operationHistory || []), history].slice(-50)
      }));
      broadcastState();
    },

    applyTransfer: (fromId: string, toId: string, points: number) => {
      const currentState = get();
      const fmtPlayer = (id: string) => {
        const p = currentState.players.find(x => x.id === id);
        return `${p?.position ?? ''}家（${p?.name ?? '未知'}）`;
      };
      const fromPlayer = fmtPlayer(fromId);
      const toPlayer = fmtPlayer(toId);
      
      const history = createHistoryEntry(
        '点数转移',
        `${fromPlayer} → ${toPlayer} ${Math.abs(points).toLocaleString()} 点`,
        currentState
      );
      
      set((state) => {
        if (fromId === toId || points === 0) return state;
        const absPoints = Math.abs(points);
        const updatedPlayers = state.players.map(p => {
          if (p.id === fromId) {
            return { ...p, score: p.score - absPoints }; // 允许负数
          }
          if (p.id === toId) {
            return { ...p, score: p.score + absPoints };
          }
          return p;
        });
        
        // 确保总数保持100000分（M-League规则）
        const total = updatedPlayers.reduce((sum, p) => sum + p.score, 0);
        if (total !== 100000) {
          const diff = 100000 - total;
          const toPlayer = updatedPlayers.find(p => p.id === toId);
          if (toPlayer) {
            toPlayer.score += diff;
          }
        }
        
        const diffs: Record<string, number> = {
          [fromId]: -absPoints,
          [toId]: absPoints
        };
        return {
          ...state,
          players: updatedPlayers,
          lastScoreDiffs: diffs,
          lastDiffTimestamp: Date.now(),
          operationHistory: [...(state.operationHistory || []), history].slice(-50)
        };
      });
      broadcastState();
    },

    applyMultiple: (transfers: Array<{ fromId: string; toId: string; points: number }>, extraDiffs?: Record<string, number>, isDrawRound?: boolean) => {
      const currentState = get();
      const fmtPlayer = (id: string) => {
        const p = currentState.players.find(x => x.id === id);
        return `${p?.position ?? ''}家（${p?.name ?? '未知'}）`;
      };
      const transferDetails = transfers
        .filter(t => t.points !== 0 && t.fromId !== t.toId)
        .map(t => `${fmtPlayer(t.fromId)} → ${fmtPlayer(t.toId)} ${Math.abs(t.points).toLocaleString()} 点`)
        .join('；');
      const extraDetails = extraDiffs
        ? Object.entries(extraDiffs)
            .map(([pid, val]) => `${fmtPlayer(pid)} ${val >= 0 ? '+' : ''}${val.toLocaleString()} 点`)
            .join('；')
        : '';
      
      const history = createHistoryEntry(
        '结算',
        [
          transferDetails || '无点数转移',
          extraDetails ? `额外调整：${extraDetails}` : ''
        ].filter(Boolean).join('；'),
        currentState
      );
      
      set((state) => {
        const diffs: Record<string, number | ScoreDiffItem[]> = {};
        const updatedPlayers = state.players.map(p => ({ ...p }));
        
        // 如果是流局结算，需要分别记录听牌奖励和立直扣分
        if (isDrawRound) {
          // 先处理转账（听牌奖励）
          const tenpaiRewards: Record<string, number> = {};
          const notenPenalties: Record<string, number> = {};
          
          for (const t of transfers) {
            if (t.fromId === t.toId || t.points === 0) continue;
            const absPoints = Math.abs(t.points);
            const from = updatedPlayers.find(p => p.id === t.fromId);
            const to = updatedPlayers.find(p => p.id === t.toId);
            if (from) {
              from.score = from.score - absPoints;
              notenPenalties[from.id] = (notenPenalties[from.id] ?? 0) - absPoints;
            }
            if (to) {
              to.score = to.score + absPoints;
              tenpaiRewards[to.id] = (tenpaiRewards[to.id] ?? 0) + absPoints;
            }
          }
          
          // 处理立直扣分（流局时）
          const riichiPenalties: Record<string, number> = {};
          if (extraDiffs) {
            for (const k of Object.keys(extraDiffs)) {
              const player = updatedPlayers.find(p => p.id === k);
              if (player && extraDiffs[k] < 0) { // 只处理负数（扣分）
                player.score = player.score + extraDiffs[k];
                // 判断是否是立直扣分（-1000）
                if (extraDiffs[k] === -1000) {
                  riichiPenalties[k] = extraDiffs[k];
                }
                // 注意：不听罚符已经在transfers中处理，不会出现在extraDiffs中
                // extraDiffs只包含立直扣分
              }
            }
          }
          
          // 构建包含多个变化项的 diffs
          // 处理所有玩家（包括听牌者、不听者和立直者）
          const allPlayerIds = new Set([
            ...Object.keys(tenpaiRewards),
            ...Object.keys(notenPenalties),
            ...Object.keys(riichiPenalties)
          ]);
          
          for (const playerId of allPlayerIds) {
            const items: ScoreDiffItem[] = [];
            
            // 听牌奖励
            if (tenpaiRewards[playerId] && tenpaiRewards[playerId] > 0) {
              items.push({ value: tenpaiRewards[playerId], label: '听牌奖励' });
            }
            
            // 不听罚符
            if (notenPenalties[playerId] && notenPenalties[playerId] < 0) {
              items.push({ value: notenPenalties[playerId], label: '不听罚符' });
            }
            
            // 立直扣分（流局时）
            if (riichiPenalties[playerId] && riichiPenalties[playerId] < 0) {
              items.push({ value: riichiPenalties[playerId], label: '立直棒' });
            }
            
            if (items.length > 0) {
              // 流局时始终返回数组格式，这样UI可以显示所有变化项的标签
              // 即使只有一个变化项，也要显示标签（如"立直棒-1000"或"听牌奖励+1500"）
              diffs[playerId] = items;
            }
          }
        } else {
          // 非流局结算，使用原来的逻辑
          // 处理转账
          for (const t of transfers) {
            if (t.fromId === t.toId || t.points === 0) continue;
            const absPoints = Math.abs(t.points);
            const from = updatedPlayers.find(p => p.id === t.fromId);
            const to = updatedPlayers.find(p => p.id === t.toId);
            if (from) {
              from.score = from.score - absPoints; // 允许负数
              diffs[from.id] = ((diffs[from.id] as number) ?? 0) - absPoints;
            }
            if (to) {
              to.score = to.score + absPoints;
              diffs[to.id] = ((diffs[to.id] as number) ?? 0) + absPoints;
            }
          }
          
          // 处理额外差异（如供托奖励）
          if (extraDiffs) {
            for (const k of Object.keys(extraDiffs)) {
              const player = updatedPlayers.find(p => p.id === k);
              if (player) {
                player.score = player.score + extraDiffs[k];
                diffs[k] = ((diffs[k] as number) ?? 0) + extraDiffs[k];
              }
            }
          }
        }
        
        // 确保总数保持100000分（M-League规则）
        const total = updatedPlayers.reduce((sum, p) => sum + p.score, 0);
        if (total !== 100000) {
          const diff = 100000 - total;
          // 将差额分配给得分最多的玩家（通常是胜者）
          const winner = updatedPlayers.reduce((max, p) => p.score > max.score ? p : max, updatedPlayers[0]);
          if (winner) {
            winner.score += diff;
            const currentDiff = diffs[winner.id];
            if (Array.isArray(currentDiff)) {
              // 如果已经是数组，添加新的变化项
              currentDiff.push({ value: diff, label: '总分调整' });
            } else {
              diffs[winner.id] = ((currentDiff as number) ?? 0) + diff;
            }
          }
        }
        
        return {
          ...state,
          players: updatedPlayers,
          lastScoreDiffs: diffs,
          lastDiffTimestamp: Date.now(),
          operationHistory: [...(state.operationHistory || []), history].slice(-50)
        };
      });
      broadcastState();
    },

    setMatchTitle: (title: string) => {
      const currentState = get();
      const oldTitle = currentState.matchTitle || '赛事直播';
      
      const history = createHistoryEntry(
        '修改赛事标题',
        `将赛事标题从"${oldTitle}"改为"${title}"`,
        currentState
      );
      
      set((state) => ({
        ...state,
        matchTitle: title,
        operationHistory: [...(state.operationHistory || []), history].slice(-50)
      }));
      broadcastState();
    },

    setPositionImage: (position: Position, imageData: string | null) => {
      const currentState = get();
      
      const history = createHistoryEntry(
        imageData ? '上传头像' : '删除头像',
        `${imageData ? '为' : '删除'}${position}家${imageData ? '上传头像' : '的头像'}`,
        currentState
      );
      
      console.log(`GameStore.setPositionImage: Setting image for position ${position}, hasData: ${!!imageData}, dataLength: ${imageData?.length || 0}`);
      set((state) => {
        const newPositionImages = {
          ...state.positionImages,
          [position]: imageData || undefined
        };
        // 移除 undefined 值
        if (!imageData) {
          delete newPositionImages[position];
        }
        console.log(`GameStore.setPositionImage: Updated positionImages keys:`, Object.keys(newPositionImages).join(', '));
        return {
          ...state,
          positionImages: newPositionImages,
          operationHistory: [...(state.operationHistory || []), history].slice(-50)
        };
      });
      setTimeout(() => {
        console.log(`GameStore.setPositionImage: Broadcasting state after setting image for ${position}`);
        broadcastState();
      }, 10);
    },

    setPlayerColor: (playerId: string, color: string) => {
      const currentState = get();
      const player = currentState.players.find(p => p.id === playerId);
      
      const history = createHistoryEntry(
        '修改玩家颜色',
        `将${player?.position}家（${player?.name}）的颜色改为${color}`,
        currentState
      );
      
      set((state) => ({
        ...state,
        playerColors: {
          ...state.playerColors,
          [playerId]: color
        },
        operationHistory: [...(state.operationHistory || []), history].slice(-50)
      }));
      broadcastState();
    },

    updatePlayerWaitInfo: (playerId: string, waitInfo: WaitInfo | null) => {
      const currentState = get();
      const player = currentState.players.find(p => p.id === playerId);
      
      const history = createHistoryEntry(
        '修改待牌信息',
        `更新${player?.position}家（${player?.name}）的待牌信息`,
        currentState
      );
      
      set((state) => ({
        ...state,
        players: state.players.map(player =>
          player.id === playerId ? { ...player, waitInfo: waitInfo || undefined } : player
        ),
        operationHistory: [...(state.operationHistory || []), history].slice(-50)
      }));
      broadcastState();
    },

    setPlayerHandResult: (playerId: string, handResult: any | null) => {
      const currentState = get();
      const player = currentState.players.find(p => p.id === playerId);
      
      const history = createHistoryEntry(
        handResult ? '设置和牌信息' : '清除和牌信息',
        `${player?.position}家（${player?.name}）${handResult ? '和牌' : '清除和牌信息'}`,
        currentState
      );
      
      set((state) => ({
        ...state,
        players: state.players.map(player =>
          player.id === playerId ? { ...player, handResult: handResult || undefined } : player
        ),
        operationHistory: [...(state.operationHistory || []), history].slice(-50)
      }));
      broadcastState();
    },

    setState: (newState: Partial<GameState>) => {
      // 检查是否在只读模式（公开显示页面）
      const isReadOnly = typeof window !== 'undefined' && window.location.hash.includes('display-public');
      
      set((state) => {
        // 确保所有字段都被正确合并，特别是 positionImages 和 playerColors
        const mergedState = {
          ...state,
          ...newState,
          // 如果 newState 中有这些字段，确保它们被正确设置
          positionImages: newState.positionImages !== undefined ? newState.positionImages : state.positionImages,
          playerColors: newState.playerColors !== undefined ? newState.playerColors : state.playerColors,
          players: newState.players !== undefined ? newState.players : state.players,
        };
        return mergedState;
      });
      
      // 只读模式下不广播状态，只保存到本地存储
      if (isReadOnly) {
        const s = get();
        const serializable: GameState = {
          players: s.players,
          roundWind: s.roundWind,
          roundNumber: s.roundNumber,
          combo: s.combo,
        riichiSticks: s.riichiSticks,
        riichiStickOwners: s.riichiStickOwners,
        riichiConfirmed: s.riichiConfirmed,
        isGameActive: s.isGameActive,
        handStartScores: s.handStartScores,
          lastScoreDiffs: s.lastScoreDiffs,
          lastDiffTimestamp: s.lastDiffTimestamp ?? null,
          doraTiles: s.doraTiles,
          matchTitle: s.matchTitle,
          lastRiichi: s.lastRiichi ?? null,
          positionImages: s.positionImages,
          playerColors: s.playerColors,
        };
        saveStateToStorage(serializable);
        return; // 不广播状态
      }
      
      // 控制模式下才广播状态
      if (authService.isAuthenticated()) {
        broadcastState();
      }
    },

    undo: () => {
      const state = get();
      const history = state.operationHistory || [];
      
      if (history.length === 0) {
        console.warn('No operation history to undo');
        return;
      }
      
      // 获取最后一个操作的历史状态
      const lastOperation = history[history.length - 1];
      const previousState = lastOperation.previousState;
      
      // 恢复状态（不包括操作历史本身，避免循环）
      set({
        ...previousState,
        operationHistory: history.slice(0, -1) // 移除已回退的操作
      });
      
      broadcastState();
    },

    clearHistory: () => {
      set((state) => ({
        ...state,
        operationHistory: []
      }));
    },
  };
});
