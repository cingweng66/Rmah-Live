import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { PlayerControlCard } from '../game/PlayerControlCard';
import { ScoringTable } from '../game/ScoringTable';
import { HandResult, YakuItem } from '../../types/game';
import { YakuSelectionDialog } from './YakuSelectionDialog';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { RotateCcw, SkipForward, Eye, Shuffle, Wind, Target, Zap, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Undo2, History, Settings, Plus, RefreshCw, Trash2, Shield } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { websocketService } from '../../services/websocket.service';
import { useToast } from '../../hooks/use-toast';
import api from '../../services/api';
import { authService } from '../../services/auth.service';

export const ControlPanel: React.FC = () => {
  // 性能优化：使用选择器只订阅需要的状态，减少不必要的重渲染
  const players = useGameStore((state) => state.players);
  const roundWind = useGameStore((state) => state.roundWind);
  const roundNumber = useGameStore((state) => state.roundNumber);
  const combo = useGameStore((state) => state.combo);
  const riichiSticks = useGameStore((state) => state.riichiSticks);
  const doraTiles = useGameStore((state) => state.doraTiles);
  const matchTitle = useGameStore((state) => state.matchTitle);
  const playerColors = useGameStore((state) => state.playerColors);
  const operationHistory = useGameStore((state) => state.operationHistory);
  
  // Actions是稳定的引用，不需要优化
  const setCombo = useGameStore((state) => state.setCombo);
  const setRiichiSticks = useGameStore((state) => state.setRiichiSticks);
  const nextRound = useGameStore((state) => state.nextRound);
  const prevRound = useGameStore((state) => state.prevRound);
  const jumpToRound = useGameStore((state) => state.jumpToRound);
  const resetGame = useGameStore((state) => state.resetGame);
  const drawRound = useGameStore((state) => state.drawRound);
  const setDoraTiles = useGameStore((state) => state.setDoraTiles);
  const applyTransfer = useGameStore((state) => state.applyTransfer);
  const applyMultiple = useGameStore((state) => state.applyMultiple);
  const setMatchTitle = useGameStore((state) => state.setMatchTitle);
  const toggleRiichi = useGameStore((state) => state.toggleRiichi);
  const startGame = useGameStore((state) => state.startGame);
  const setPlayerColor = useGameStore((state) => state.setPlayerColor);
  const setPlayerHandResult = useGameStore((state) => state.setPlayerHandResult);
  const updatePlayerWaitInfoStore = useGameStore((state) => state.updatePlayerWaitInfo);
  const undo = useGameStore((state) => state.undo);
  const clearHistory = useGameStore((state) => state.clearHistory);
  const setState = useGameStore((state) => state.setState);
  
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // 检查是否为管理员
  const isAdmin = React.useMemo(() => {
    const user = authService.getCurrentUser();
    return user?.email === 'pylzh2002@gmail.com';
  }, []);

  // 生成或获取6位数字房间号（响应房间变化）
  const [roomId, setRoomId] = React.useState(() => {
    const stored = localStorage.getItem('mahjong-room-id');
    if (stored && /^\d{6}$/.test(stored)) {
      return stored;
    }
    // 生成新的6位数字房间号
    const newRoomId = String(Math.floor(100000 + Math.random() * 900000));
    localStorage.setItem('mahjong-room-id', newRoomId);
    return newRoomId;
  });

  // 监听房间变化事件
  React.useEffect(() => {
    const handleRoomChange = () => {
      const stored = localStorage.getItem('mahjong-room-id');
      if (stored && /^\d{6}$/.test(stored)) {
        setRoomId(stored);
      }
    };

    window.addEventListener('room-changed', handleRoomChange);
    return () => {
      window.removeEventListener('room-changed', handleRoomChange);
    };
  }, []);

  // 房间管理相关状态
  interface Room {
    id: string;
    gameId: string;
    userId: string;
    userEmail: string;
    hasState: boolean;
    isGameActive: boolean;
    createdAt: string;
    updatedAt: string;
  }

  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = React.useState(false);
  const [currentRoomId, setCurrentRoomId] = React.useState<string | null>(() => {
    const stored = localStorage.getItem('mahjong-room-id');
    return stored && /^\d{6}$/.test(stored) ? stored : roomId;
  });

  // 同步 roomId 变化到 currentRoomId
  React.useEffect(() => {
    setCurrentRoomId(roomId);
  }, [roomId]);

  // 加载房间列表
  const loadRooms = async () => {
    setRoomsLoading(true);
    try {
      const response = await api.get('/game/rooms');
      setRooms(response.data.rooms || []);
    } catch (error: any) {
      console.error('Failed to load rooms:', error);
      toast({
        title: '加载失败',
        description: error.response?.data?.message || '无法加载房间列表',
        variant: 'destructive',
      });
    } finally {
      setRoomsLoading(false);
    }
  };

  // 创建新房间
  const handleCreateRoom = async () => {
    setRoomsLoading(true);
    try {
      const response = await api.post('/game/room/create', {});
      const { gameId } = response.data;
      
      // 保存到 localStorage
      localStorage.setItem('mahjong-room-id', gameId);
      setRoomId(gameId);
      setCurrentRoomId(gameId);
      
      // 触发房间变化事件
      window.dispatchEvent(new Event('room-changed'));
      
      // 重新连接 WebSocket
      if (websocketService.isConnected()) {
        websocketService.disconnect();
      }
      setTimeout(() => {
        websocketService.connect(gameId, false);
      }, 100);

      toast({
        title: '房间创建成功',
        description: `房间号: ${gameId}`,
      });

      // 重新加载房间列表
      loadRooms();
    } catch (error: any) {
      console.error('Failed to create room:', error);
      toast({
        title: '创建失败',
        description: error.response?.data?.message || '无法创建房间',
        variant: 'destructive',
      });
    } finally {
      setRoomsLoading(false);
    }
  };

  // 切换房间
  const handleSwitchRoom = async (gameId: string) => {
    if (gameId === currentRoomId) {
      toast({
        title: '提示',
        description: '当前已在此房间',
      });
      return;
    }

    setRoomsLoading(true);
    try {
      const response = await api.post('/game/room/switch', { gameId });
      const { state } = response.data;
      
      // 保存到 localStorage
      localStorage.setItem('mahjong-room-id', gameId);
      setRoomId(gameId);
      setCurrentRoomId(gameId);
      
      // 触发房间变化事件
      window.dispatchEvent(new Event('room-changed'));
      
      // 加载房间状态
      if (state) {
        setState(state);
      } else {
        // 如果房间没有状态，重置为初始状态
        setState({
          players: [
            { id: '1', name: '玩家1', score: 25000, isRiichi: false, position: '东' },
            { id: '2', name: '玩家2', score: 25000, isRiichi: false, position: '南' },
            { id: '3', name: '玩家3', score: 25000, isRiichi: false, position: '西' },
            { id: '4', name: '玩家4', score: 25000, isRiichi: false, position: '北' },
          ],
          roundWind: '东',
          roundNumber: 1,
          combo: 0,
          riichiSticks: 0,
          isGameActive: false,
          handStartScores: {},
          lastScoreDiffs: {},
          lastDiffTimestamp: null,
          doraTiles: [],
          matchTitle: '赛事直播',
          lastRiichi: null,
          positionImages: {},
        });
      }

      // 重新连接 WebSocket
      if (websocketService.isConnected()) {
        websocketService.disconnect();
      }
      setTimeout(() => {
        websocketService.connect(gameId, false);
      }, 100);

      toast({
        title: '切换成功',
        description: `已切换到房间: ${gameId}`,
      });

      // 重新加载房间列表
      loadRooms();
    } catch (error: any) {
      console.error('Failed to switch room:', error);
      toast({
        title: '切换失败',
        description: error.response?.data?.message || '无法切换房间',
        variant: 'destructive',
      });
    } finally {
      setRoomsLoading(false);
    }
  };

  // 删除房间
  const handleDeleteRoom = async (gameId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`确定要删除房间 ${gameId} 吗？`)) {
      return;
    }

    setRoomsLoading(true);
    try {
      await api.post(`/game/session/${gameId}/delete`);
      toast({
        title: '删除成功',
        description: `房间 ${gameId} 已删除`,
      });
      loadRooms();
    } catch (error: any) {
      console.error('Failed to delete room:', error);
      toast({
        title: '删除失败',
        description: error.response?.data?.message || '无法删除房间',
        variant: 'destructive',
      });
    } finally {
      setRoomsLoading(false);
    }
  };

  // 查看房间日志
  const handleViewLogs = async (gameId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await api.get(`/game/room/${gameId}/logs`);
      const logs = response.data.logs || [];
      
      // 显示日志对话框
      const logText = logs.map((log: any, index: number) => {
        const date = new Date(log.timestamp).toLocaleString('zh-CN');
        return `${index + 1}. [${date}] 状态已更新`;
      }).join('\n');

      alert(`房间 ${gameId} 的日志 (最近 ${logs.length} 条):\n\n${logText || '暂无日志'}`);
    } catch (error: any) {
      console.error('Failed to load logs:', error);
      toast({
        title: '加载失败',
        description: error.response?.data?.message || '无法加载日志',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 缓存tileSrc函数，避免每次渲染都创建
  const tileSrc = React.useCallback((code: string) => {
    try {
      return new URL(`../../../img/${code}.png`, import.meta.url).href;
    } catch {
      return new URL(`../../../img/questionmark.png`, import.meta.url).href;
    }
  }, []);

  // 缓存allTiles数组，避免每次渲染都重新计算
  const allTiles = React.useMemo(() => {
    const suits = ['m','p','s'];
    const nums = Array.from({length:9},(_,i)=>`${i+1}`);
    const winds = ['ze','zn','zw','zs'];
    const dragons = ['zr','zg','zwh'];
    return [
      ...suits.flatMap(s=>nums.map(n=>`${s}${n}`)),
      ...winds,
      ...dragons,
    ];
  }, []);

  // 缓存getDealerPosition函数，避免重复定义
  const getDealerPositionMemo = React.useCallback((roundWind: string, roundNumber: number): string => {
    const winds: string[] = ['东', '南', '西', '北'];
    const dealerIndex = (roundNumber - 1) % 4;
    return winds[dealerIndex];
  }, []);

  // 缓存当前庄家位置
  const dealerPosition = React.useMemo(() => getDealerPositionMemo(roundWind, roundNumber), [roundWind, roundNumber, getDealerPositionMemo]);


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900">
      
      
      <div className="relative z-10 p-4">
        <div className="max-w-7xl mx-auto">
          {/* 标题栏 - 紧凑版 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden bg-white/10 border border-white/10">
                <img
                  src={`${import.meta.env.BASE_URL}img/zr.png`}
                  alt="logo"
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                  日麻直播记分系统
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button
                  onClick={() => navigate('/admin')}
                  className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white border-0 px-4 py-2 text-sm font-medium"
                >
                  <Shield className="h-4 w-4 mr-1" />
                  管理
                </Button>
              )}
              <Button
                onClick={() => {
                  const href = `${window.location.origin}${window.location.pathname}#/display`;
                  window.open(href, 'mahjong-display');
                }}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 px-4 py-2 text-sm font-medium"
              >
                <Eye className="h-4 w-4 mr-1" />
                布局1
              </Button>
              <Button
                onClick={() => {
                  const href = `${window.location.origin}${window.location.pathname}#/display2`;
                  window.open(href, 'mahjong-display2');
                }}
                className="bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white border-0 px-4 py-2 text-sm font-medium"
              >
                <Eye className="h-4 w-4 mr-1" />
                布局2
              </Button>
              <Button
                onClick={() => {
                  const href = `${window.location.origin}${window.location.pathname}#/display3`;
                  window.open(href, 'mahjong-display3');
                }}
                className="bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700 text-white border-0 px-4 py-2 text-sm font-medium"
              >
                <Eye className="h-4 w-4 mr-1" />
                布局3
              </Button>
              <Button
                onClick={() => {
                  const href = `${window.location.origin}${window.location.pathname}#/display4`;
                  window.open(href, 'mahjong-display4');
                }}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white border-0 px-4 py-2 text-sm font-medium"
              >
                <Eye className="h-4 w-4 mr-1" />
                布局4
              </Button>
            </div>
          </div>

          {/* 游戏状态信息 - 三列布局 */}
          <div className="mb-4">
            {/* 点棒总和校验显示 */}
            <div className="mb-2">
              {(() => {
                const totalScore = players.reduce((sum, p) => sum + p.score, 0);
                const expectedTotal = 100000;
                const diff = totalScore - expectedTotal;
                const isValid = diff === 0;
                return (
                  <div className={`text-xs px-3 py-1.5 rounded-lg ${
                    isValid 
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    <span className="font-semibold">点棒总和：</span>
                    <span className="font-mono">{totalScore.toLocaleString()}</span>
                    {!isValid && (
                      <span className="ml-2">
                        （偏差：{diff > 0 ? '+' : ''}{diff.toLocaleString()}，应为 {expectedTotal.toLocaleString()}）
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-r from-slate-800/95 to-slate-900/95 border-slate-700 backdrop-blur-sm shadow-2xl">
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-base font-bold text-white flex items-center space-x-2">
                    <Wind className="w-4 h-4 text-blue-400" />
                    <span>局数信息</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Button size="icon" variant="outline" onClick={prevRound} className="h-10 w-10 bg-slate-700 border-slate-600 text-white shrink-0">
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      
                      <Select 
                        value={`${roundWind}-${roundNumber}`} 
                        onValueChange={(val) => {
                          const [w, n] = val.split('-');
                          jumpToRound(w as any, parseInt(n));
                        }}
                      >
                        <SelectTrigger className="flex-1 bg-slate-700 border-slate-600 text-white h-10 font-bold text-lg justify-center">
                          <SelectValue placeholder="选择局数" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700 text-white max-h-[300px]">
                          {['东','南','西','北'].map(w => (
                            [1,2,3,4].map(n => (
                              <SelectItem key={`${w}-${n}`} value={`${w}-${n}`}>
                                {w}{n}局
                              </SelectItem>
                            ))
                          ))}
                        </SelectContent>
                      </Select>

                      <Button size="icon" variant="outline" onClick={() => nextRound()} className="h-10 w-10 bg-slate-700 border-slate-600 text-white shrink-0">
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-slate-700/50 rounded-xl">
                        <div className="text-2xl font-bold text-red-400 mb-1">{roundWind}</div>
                        <div className="text-xs text-slate-400">场风</div>
                      </div>
                      <div className="text-center p-3 bg-slate-700/50 rounded-xl">
                        <div className="text-2xl font-bold text-blue-400 mb-1">{roundNumber}</div>
                        <div className="text-xs text-slate-400">局数</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-slate-800/95 to-slate-900/95 border-slate-700 backdrop-blur-sm shadow-2xl">
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-base font-bold text-white">本场</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="text-center mb-3">
                    <div className="text-3xl font-bold text-yellow-400 mb-2">{combo}</div>
                    <div className="text-xs text-slate-400">当前本场数</div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-6 gap-1.5">
                      {[0, 1, 2, 3, 4, 5].map(num => (
                        <Button
                          key={num}
                          size="sm"
                          variant={combo === num ? "default" : "outline"}
                          onClick={() => setCombo(num)}
                          className={`${
                            combo === num
                              ? num === 0
                                ? 'bg-slate-600 hover:bg-slate-700 text-white border-0'
                                : 'bg-yellow-500 hover:bg-yellow-600 text-white border-0'
                              : 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600'
                          } text-xs py-1.5 h-8`}
                        >
                          {num}
                        </Button>
                      ))}
                    </div>
                    <div className="grid grid-cols-6 gap-1.5">
                      {[6, 7, 8, 9, 10].map(num => (
                        <Button
                          key={num}
                          size="sm"
                          variant={combo === num ? "default" : "outline"}
                          onClick={() => setCombo(num)}
                          className={`${
                            combo === num
                              ? num === 0
                                ? 'bg-slate-600 hover:bg-slate-700 text-white border-0'
                                : 'bg-yellow-500 hover:bg-yellow-600 text-white border-0'
                              : 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600'
                          } text-xs py-1.5 h-8`}
                        >
                          {num}
                        </Button>
                      ))}
                      <Input
                        type="number"
                        value={combo > 10 ? combo : ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          if (val >= 0) setCombo(val);
                        }}
                        placeholder="自定义"
                        className="bg-slate-700 border-slate-600 text-white text-xs h-8 px-1"
                        min="0"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-slate-800/95 to-slate-900/95 border-slate-700 backdrop-blur-sm shadow-2xl">
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-base font-bold text-white">立直棒</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="text-center mb-3">
                    <div className="text-3xl font-bold text-orange-400 mb-2">{riichiSticks}</div>
                    <div className="text-xs text-slate-400">当前立直棒数</div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-6 gap-1.5">
                      {[0, 1, 2, 3, 4, 5].map(num => (
                        <Button
                          key={num}
                          size="sm"
                          variant={riichiSticks === num ? "default" : "outline"}
                          onClick={() => setRiichiSticks(num)}
                          className={`${
                            riichiSticks === num
                              ? num === 0
                                ? 'bg-slate-600 hover:bg-slate-700 text-white border-0'
                                : 'bg-orange-500 hover:bg-orange-600 text-white border-0'
                              : 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600'
                          } text-xs py-1.5 h-8`}
                        >
                          {num}
                        </Button>
                      ))}
                    </div>
                    <div className="grid grid-cols-6 gap-1.5">
                      {[6, 7, 8, 9, 10].map(num => (
                        <Button
                          key={num}
                          size="sm"
                          variant={riichiSticks === num ? "default" : "outline"}
                          onClick={() => setRiichiSticks(num)}
                          className={`${
                            riichiSticks === num
                              ? num === 0
                                ? 'bg-slate-600 hover:bg-slate-700 text-white border-0'
                                : 'bg-orange-500 hover:bg-orange-600 text-white border-0'
                              : 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600'
                          } text-xs py-1.5 h-8`}
                        >
                          {num}
                        </Button>
                      ))}
                      <Input
                        type="number"
                        value={riichiSticks > 10 ? riichiSticks : ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          if (val >= 0) setRiichiSticks(val);
                        }}
                        placeholder="自定义"
                        className="bg-slate-700 border-slate-600 text-white text-xs h-8 px-1"
                        min="0"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* 房间管理（位置下移，靠近局数和标题，支持折叠） */}
          <Collapsible defaultOpen={false}>
            <Card className="mb-4 bg-gradient-to-r from-blue-800/90 to-indigo-800/90 border-blue-500/50 backdrop-blur-sm shadow-2xl">
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-2 pt-3 cursor-pointer hover:bg-blue-800/50 transition-colors group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-bold text-white">房间管理</CardTitle>
                      <div className="text-lg font-bold text-white font-mono tracking-widest">
                        {roomId}
                      </div>
                      <div className="text-xs text-blue-100">
                        {roundWind}{roundNumber}局{matchTitle ? ` · ${matchTitle}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Dialog>
                        <DialogTrigger asChild onClick={(e) => { e.stopPropagation(); loadRooms(); }}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-slate-700/50 border-slate-600 text-white hover:bg-slate-600"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Settings className="h-4 w-4 mr-1" />
                            管理房间
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="text-white">房间管理</DialogTitle>
                            <DialogDescription className="text-slate-400">
                              创建、切换和管理房间
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 mt-4">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs text-slate-300">
                                显示房间号：{currentRoomId || '未选择'}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={loadRooms}
                                  variant="outline"
                                  size="sm"
                                  disabled={roomsLoading}
                                  className="bg-slate-700 border-slate-600 text-white"
                                >
                                  <RefreshCw className={`h-4 w-4 mr-1 ${roomsLoading ? 'animate-spin' : ''}`} />
                                  刷新
                                </Button>
                                <Button
                                  onClick={handleCreateRoom}
                                  variant="default"
                                  size="sm"
                                  disabled={roomsLoading}
                                  className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white"
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  新建房间
                                </Button>
                              </div>
                            </div>
                            {roomsLoading && rooms.length === 0 ? (
                              <div className="text-center py-8 text-slate-400">加载中...</div>
                            ) : rooms.length === 0 ? (
                              <div className="text-center py-8 text-slate-400">
                                <p className="mb-4">暂无房间</p>
                                <Button
                                  onClick={handleCreateRoom}
                                  variant="outline"
                                  className="bg-slate-700 border-slate-600 text-white"
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  创建第一个房间
                                </Button>
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                {rooms.map((room) => (
                                  <div
                                    key={room.id}
                                    className={`p-3 rounded-lg border transition-all cursor-pointer ${
                                      room.gameId === currentRoomId
                                        ? 'bg-blue-500/20 border-blue-500/50'
                                        : 'bg-slate-700/50 border-slate-600 hover:bg-slate-700'
                                    }`}
                                    onClick={() => handleSwitchRoom(room.gameId)}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="font-mono text-lg font-bold text-white tracking-widest">
                                            {room.gameId}
                                          </span>
                                          {room.gameId === currentRoomId && (
                                            <Badge className="bg-blue-500 text-white">当前房间</Badge>
                                          )}
                                          {room.isGameActive && (
                                            <Badge className="bg-green-500 text-white">游戏中</Badge>
                                          )}
                                          {!room.hasState && (
                                            <Badge variant="outline" className="border-slate-500 text-slate-400">
                                              空房间
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="text-xs text-slate-400 space-y-1">
                                          <div>创建者: {room.userEmail}</div>
                                          <div>更新时间: {formatDate(room.updatedAt)}</div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 ml-4">
                                        <Button
                                          onClick={(e) => handleViewLogs(room.gameId, e)}
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                                          title="查看日志"
                                        >
                                          <History className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          onClick={(e) => handleDeleteRoom(room.gameId, e)}
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                                          title="删除房间"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                      <ChevronDown className="h-4 w-4 text-blue-300 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down transition-all">
                <CardContent className="pt-2 pb-3">
                  <div className="flex flex-col gap-3">
                    <div className="text-xs text-blue-200">
                      当前比赛标题：
                      <span className="ml-1 text-white font-medium">
                        {matchTitle || '未设置'}
                      </span>
                    </div>
                    <div>
                      <div className="text-xs text-blue-200 mb-2">显示设备访问地址：</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-white/80 font-mono">
                        <div>/#/display-public?room={roomId}</div>
                        <div>/#/display-public2?room={roomId}</div>
                        <div>/#/display-public3?room={roomId}</div>
                        <div>/#/display-public4?room={roomId}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* 玩家信息显示 */}
          <Card className="mb-4 bg-gradient-to-r from-slate-800/80 to-slate-900/80 border-slate-700 backdrop-blur-sm shadow-2xl">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-base font-bold text-white">玩家信息</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {players.map((player) => {
                  const isDealer = player.position === dealerPosition;
                  return (
                    <div
                      key={player.id}
                      className={`p-3 rounded-lg border ${
                        isDealer
                          ? 'bg-gradient-to-r from-yellow-900/50 to-orange-900/50 border-yellow-500/50'
                          : 'bg-slate-700/50 border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white">{player.name}</span>
                        {isDealer && (
                          <Badge className="bg-yellow-500 text-white text-xs">庄家</Badge>
                        )}
                        {!isDealer && (
                          <Badge variant="outline" className="border-slate-500 text-slate-400 text-xs">子家</Badge>
                        )}
                      </div>
                      <div className="text-lg font-bold text-blue-400">
                        {player.score.toLocaleString()} 点
                      </div>
                      <div className="text-xs text-slate-400 mt-1">位置: {player.position}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Dora设置、快速立直、其他操作 - 三列并排 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Dora设置 */}
            <Card className="bg-gradient-to-r from-slate-800/95 to-slate-900/95 border-slate-700 backdrop-blur-sm shadow-2xl">
              <CardHeader className="pb-2 pt-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold text-white">Dora设置</CardTitle>
                  <Button variant="outline" onClick={() => setDoraTiles([])} className="bg-slate-700 border-slate-600 text-white text-xs h-7 px-2">清空</Button>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {doraTiles && doraTiles.length > 0 ? (
                    doraTiles.map(t => (
                      <img key={t} src={tileSrc(t)} alt={t} className="h-7 w-auto" />
                    ))
                  ) : (
                    <span className="text-slate-400 text-xs">未选择</span>
                  )}
                </div>
                <div className="grid grid-cols-12 gap-1 max-h-[200px] overflow-y-auto">
                  {allTiles.map(code => {
                    const active = doraTiles?.includes(code);
                    return (
                      <button
                        key={code}
                        onClick={() => {
                          const next = active ? doraTiles.filter(x=>x!==code) : [...(doraTiles||[]), code];
                          setDoraTiles(next);
                        }}
                        className={`rounded-md p-0.5 border transition-all ${
                          active 
                            ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-500/20' 
                            : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/50'
                        }`}
                      >
                        <img src={tileSrc(code)} alt={code} className="h-5 w-auto" loading="lazy" />
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* 快速立直 - 高频使用 */}
            <Card className="bg-gradient-to-r from-red-800/90 to-orange-800/90 border-red-500/50 backdrop-blur-sm shadow-2xl">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-base font-bold text-white flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span>快速立直</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="grid grid-cols-2 gap-2">
                  {players.map(player => (
                    <Button
                      key={player.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (toggleRiichi) {
                          toggleRiichi(player.id);
                        } else {
                          console.error('toggleRiichi is not defined');
                        }
                      }}
                      className={`${
                        player.isRiichi 
                          ? 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600' 
                          : 'bg-slate-700 hover:bg-slate-600'
                      } text-white py-2 text-sm font-medium transition-all duration-200`}
                    >
                      <Zap className="h-3 w-3 mr-1" />
                      {player.name}
                      {player.isRiichi && ' ✓'}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 其他操作 */}
            <Card className="bg-gradient-to-r from-slate-800/80 to-slate-900/80 border-slate-700 backdrop-blur-sm shadow-2xl">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-base font-bold text-white">其他操作</CardTitle>
              </CardHeader>
              <CardContent className="pt-2 space-y-1.5">
                {/* 局数和本场显示 */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="text-center p-2 bg-slate-700/50 rounded-lg">
                    <div className="text-xl font-bold text-blue-400 mb-1">{roundWind}{roundNumber}局</div>
                    <div className="text-xs text-slate-400">局数</div>
                  </div>
                  <div className="text-center p-2 bg-slate-700/50 rounded-lg">
                    <div className="text-xl font-bold text-yellow-400 mb-1">{combo}</div>
                    <div className="text-xs text-slate-400">本场</div>
                  </div>
                </div>
                
                {/* 第一行：流局、下一局 */}
                <div className="grid grid-cols-2 gap-1.5">
                  <DrawRoundDialog 
                    players={players} 
                    onDrawRound={(tenpaiPlayerIds, isRenchan) => {
                      drawRound(isRenchan);
                    }} 
                    applyMultiple={applyMultiple} 
                    roundWind={roundWind}
                    roundNumber={roundNumber}
                  />
                  
                  <Button
                    onClick={() => nextRound()}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-1.5 px-2 text-xs font-medium h-8"
                  >
                    <SkipForward className="h-3 w-3 mr-1" />
                    下一局
                  </Button>
                </div>
                
                {/* 第三行：重置、回退、历史 */}
                <div className="grid grid-cols-3 gap-1.5">
                  <Button
                    onClick={resetGame}
                    className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white py-1.5 px-2 text-xs font-medium h-8"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    重置
                  </Button>
                  <Button
                    onClick={undo}
                    disabled={!operationHistory || operationHistory.length === 0}
                    className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white py-1.5 px-2 text-xs font-medium h-8 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={operationHistory && operationHistory.length > 0 ? `回退：${operationHistory[operationHistory.length - 1]?.description}` : '没有可回退的操作'}
                  >
                    <Undo2 className="h-3 w-3 mr-1" />
                    回退
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600 py-1.5 px-2 text-xs font-medium h-8"
                      >
                        <History className="h-3 w-3 mr-1" />
                        历史
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-white">操作历史</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-2">
                        {operationHistory && operationHistory.length > 0 ? (
                          <>
                            <div className="flex justify-between items-center mb-4">
                              <span className="text-sm text-slate-400">
                                共 {operationHistory.length} 条操作记录
                              </span>
                              <Button
                                onClick={clearHistory}
                                variant="outline"
                                size="sm"
                                className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                              >
                                清空历史
                              </Button>
                            </div>
                            <div className="space-y-2">
                              {[...operationHistory].reverse().map((op, index) => (
                                <div
                                  key={op.id}
                                  className="p-3 bg-slate-700/50 rounded-lg border border-slate-600"
                                >
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <div className="font-medium text-white mb-1">
                                        {op.operation}
                                      </div>
                                      <div className="text-sm text-slate-300 mb-2">
                                        {op.description}
                                      </div>
                                      <div className="text-xs text-slate-400">
                                        {new Date(op.timestamp).toLocaleString('zh-CN')}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-8 text-slate-400">
                            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>暂无操作历史</p>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 结算操作和预览 - 左右布局 */}
          <Card className="mb-4 bg-gradient-to-r from-slate-800/80 to-slate-900/80 border-slate-700 backdrop-blur-sm shadow-2xl">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-base font-bold text-white">结算操作</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <SettlementCalculator
                players={players}
                combo={combo}
                riichiSticks={riichiSticks}
                roundWind={roundWind}
                roundNumber={roundNumber}
                onApplyTransfer={applyTransfer}
                onApplyMultiple={applyMultiple}
                onApplyHonba={(v)=>setCombo(Math.max(0, v))}
                onSetHandResult={setPlayerHandResult}
                onClearWaitInfo={(playerId) => updatePlayerWaitInfoStore(playerId, null)}
                onConsumeRiichi={(winnerId)=>{
                  // 结算时立直棒处理（新规则）：
                  // 1. 先扣所有立直玩家的1000点（立直棒）
                  // 2. 若立直者自摸或荣和：取回自己下注的立直棒（+1000点），同时获得桌上其他供托棒
                  // 3. 若他家和牌：所有桌面立直棒全部由首家荣和者获得
                  const state = useGameStore.getState();
                  const riichiStickOwners = state.riichiStickOwners || [];
                  const extras: Record<string, number> = {};
                  
                  // 先扣所有立直玩家的1000点（立直棒）
                  riichiStickOwners.forEach(ownerId => {
                    extras[ownerId] = (extras[ownerId] ?? 0) - 1000;
                  });
                  
                  if (riichiSticks > 0) {
                    const winnerIsRiichiOwner = riichiStickOwners.includes(winnerId);
                    
                    if (winnerIsRiichiOwner) {
                      // 立直者和牌：取回自己下注的立直棒（+1000点），同时获得桌上其他供托棒
                      const ownSticks = riichiStickOwners.filter(id => id === winnerId).length;
                      const otherSticks = riichiSticks - ownSticks;
                      // 取回自己的立直棒：+1000点（抵消刚才扣的）
                      extras[winnerId] = (extras[winnerId] ?? 0) + ownSticks * 1000;
                      // 获得其他供托棒
                      if (otherSticks > 0) {
                        extras[winnerId] = (extras[winnerId] ?? 0) + otherSticks * 1000;
                      }
                    } else {
                      // 他家和牌：所有桌面立直棒全部由首家荣和者获得
                      extras[winnerId] = (extras[winnerId] ?? 0) + riichiSticks * 1000;
                    }
                  }
                  
                  // 清零立直棒和归属记录（供托被取走）
                  setRiichiSticks(0);
                  useGameStore.setState({ 
                    riichiStickOwners: [],
                    riichiConfirmed: {}
                  });
                  
                  if (Object.keys(extras).length > 0) {
                    applyMultiple([], extras);
                  }
                }}
                onNextRound={nextRound}
              />
            </CardContent>
          </Card>

          {/* 玩家控制区域 */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
            {players.map((player) => (
              <PlayerControlCard key={player.id} player={player} />
            ))}
          </div>

          {/* 设置区域 - 比赛标题和玩家颜色 */}
          <div className="grid grid-cols-1 lg:grid-cols-1 gap-4 mb-4">
            {/* 比赛标题 */}
            <Card className="bg-gradient-to-r from-slate-800/80 to-slate-900/80 border-slate-700 backdrop-blur-sm shadow-2xl">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-base font-bold text-white">比赛标题</CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <Textarea 
                  value={matchTitle||''} 
                  onChange={(e)=>setMatchTitle(e.target.value)} 
                  placeholder="输入比赛标题（可换行）" 
                  className="bg-slate-700 border-slate-600 text-white min-h-[100px] resize-none text-sm" 
                />
              </CardContent>
            </Card>

            {/* 玩家颜色设置 */}
            <Collapsible defaultOpen={false}>
              <Card className="bg-gradient-to-r from-slate-800/95 to-slate-900/95 border-slate-700 backdrop-blur-sm shadow-2xl">
                <CollapsibleTrigger asChild>
                  <CardHeader className="pb-2 pt-3 cursor-pointer hover:bg-slate-800/50 transition-colors group">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-bold text-white">玩家颜色设置</CardTitle>
                      <ChevronDown className="h-4 w-4 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down transition-all">
                  <CardContent className="pt-2">
                    <div className="grid grid-cols-4 gap-4">
                      {players.map(player => {
                        const currentColor = playerColors?.[player.id] || '';
                        // 预设颜色选项
                        const presetColors = [
                          { name: '默认', value: '', color: 'default', border: 'border-slate-500', bgClass: 'bg-slate-700' },
                          { name: '黑色', value: '#000000', color: '#000000', border: 'border-gray-600' },
                          { name: '透明', value: 'transparent', color: 'transparent', border: 'border-slate-400' },
                          { name: '红色', value: '#ef4444', color: '#ef4444', border: 'border-red-500' },
                          { name: '绿色', value: '#22c55e', color: '#22c55e', border: 'border-green-500' },
                          { name: '蓝色', value: '#3b82f6', color: '#3b82f6', border: 'border-blue-500' },
                          { name: '紫色', value: '#a855f7', color: '#a855f7', border: 'border-purple-500' },
                          { name: '橙色', value: '#f97316', color: '#f97316', border: 'border-orange-500' },
                          { name: '黄色', value: '#eab308', color: '#eab308', border: 'border-yellow-500' },
                          { name: '青色', value: '#06b6d4', color: '#06b6d4', border: 'border-cyan-500' },
                          { name: '粉色', value: '#ec4899', color: '#ec4899', border: 'border-pink-500' },
                        ];

                        return (
                          <div key={player.id} className="space-y-2">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-semibold text-white">{player.name} ({player.position})</span>
                              {currentColor && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setPlayerColor(player.id, '')}
                                  className="bg-slate-700 border-slate-600 text-white text-xs h-6 px-2"
                                >
                                  重置
                                </Button>
                              )}
                            </div>
                            
                            {/* 预设颜色选择 */}
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium text-slate-300 block">预设颜色</label>
                              <div className="grid grid-cols-3 gap-1.5">
                                {presetColors.map(preset => {
                                  const isSelected = currentColor === preset.value || (!currentColor && preset.value === '');
                                  const isTransparent = preset.color === 'transparent';
                                  const isDefault = preset.color === 'default';
                                  
                                  return (
                                    <button
                                      key={preset.value}
                                      onClick={() => setPlayerColor(player.id, preset.value)}
                                      className={`relative h-8 rounded-md border-2 transition-all ${
                                        isSelected 
                                          ? `${preset.border} ring-1 ring-offset-1 ring-offset-slate-800 ring-white/50 shadow-md` 
                                          : 'border-slate-600 hover:border-slate-500 hover:shadow-sm'
                                      } ${isDefault ? preset.bgClass : ''}`}
                                      style={(() => {
                                        if (isDefault) return {};
                                        if (isTransparent) {
                                          return {
                                            backgroundColor: 'transparent',
                                            backgroundImage: 'linear-gradient(45deg, #1e293b 25%, transparent 25%), linear-gradient(-45deg, #1e293b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e293b 75%), linear-gradient(-45deg, transparent 75%, #1e293b 75%)',
                                            backgroundSize: '6px 6px',
                                            backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0px'
                                          };
                                        }
                                        return { backgroundColor: preset.color };
                                      })()}
                                      title={preset.name}
                                    >
                                      {isSelected && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                          <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-sm">
                                            <div className="w-1.5 h-1.5 bg-slate-800 rounded-full"></div>
                                          </div>
                                        </div>
                                      )}
                                      {!isSelected && isDefault && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                          <span className="text-[10px] text-slate-400 font-medium">默认</span>
                                        </div>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* 自定义颜色选择 */}
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium text-slate-300 block">自定义</label>
                              <div className="flex items-center gap-1.5">
                                <Input
                                  type="color"
                                  value={currentColor && currentColor !== 'transparent' ? (currentColor.startsWith('#') ? currentColor : `#${currentColor}`) : '#000000'}
                                  onChange={(e) => setPlayerColor(player.id, e.target.value)}
                                  className="w-12 h-8 p-0.5 bg-slate-700 border-slate-600 rounded cursor-pointer"
                                />
                                <Input
                                  type="text"
                                  value={currentColor || ''}
                                  onChange={(e) => setPlayerColor(player.id, e.target.value)}
                                  placeholder="#000000"
                                  className="flex-1 bg-slate-800 border-slate-600 text-white text-xs h-8"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>

          {/* 使用说明 - 可折叠 */}
          <Card className="mt-4 bg-gradient-to-r from-slate-800/60 to-slate-900/60 border-slate-700 backdrop-blur-sm">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm font-bold text-white">💡 使用说明</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300 text-xs space-y-2 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <p className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                    <span>在控制面板调整玩家信息和分数</span>
                  </p>
                  <p className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                    <span>点击布局按钮打开 broadcast 页面</span>
                  </p>
                </div>
                <div>
                  <p className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full"></span>
                    <span>显示页面具有纯绿色背景，适合OBS抠图</span>
                  </p>
                  <p className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 bg-orange-400 rounded-full"></span>
                    <span>两个页面状态实时同步，无需刷新</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

type BasicPlayer = { id: string; name: string; position?: string; score: number; isRiichi?: boolean };

// 计算当前局的庄家位置
// 局数1=东，局数2=南，局数3=西，局数4=北
// 东1局：东（玩家1），东2局：南（玩家2），东3局：西（玩家3），东4局：北（玩家4）
// 南1局：东（玩家1），南2局：南（玩家2），南3局：西（玩家3），南4局：北（玩家4）
const getDealerPosition = (roundWind: string, roundNumber: number): string => {
  const winds: string[] = ['东', '南', '西', '北'];
  // 局数直接对应位置：1=东，2=南，3=西，4=北
  const dealerIndex = (roundNumber - 1) % 4;
  return winds[dealerIndex];
};

// 流局对话框组件
const DrawRoundDialog: React.FC<{
  players: BasicPlayer[];
  onDrawRound: (tenpaiPlayerIds: string[], isRenchan: boolean) => void;
  applyMultiple: (transfers: Array<{ fromId: string; toId: string; points: number }>, extraDiffs?: Record<string, number>, isDrawRound?: boolean) => void;
  roundWind: string;
  roundNumber: number;
}> = ({ players, onDrawRound, applyMultiple, roundWind, roundNumber }) => {
  const [open, setOpen] = React.useState(false);
  const [tenpaiPlayers, setTenpaiPlayers] = React.useState<string[]>([]);

  // 按 东 -> 南 -> 西 -> 北 的顺序排列玩家
  const orderedPlayers = React.useMemo(() => {
    const order: string[] = ['东', '南', '西', '北'];
    return [...players].sort((a, b) => {
      const aIndex = order.indexOf(a.position || '');
      const bIndex = order.indexOf(b.position || '');
      return aIndex - bIndex;
    });
  }, [players]);

  // 计算当前局的庄家位置
  const dealerPosition = getDealerPosition(roundWind, roundNumber);
  const dealer = orderedPlayers.find(p => p.position === dealerPosition) || orderedPlayers[0];
  const dealerIsTenpai = dealer ? tenpaiPlayers.includes(dealer.id) : false;

  const handleConfirm = () => {
    const tenpaiCount = tenpaiPlayers.length;
    const notenCount = 4 - tenpaiCount;

    // 计算罚符（不听罚符）
    const transfers: Array<{ fromId: string; toId: string; points: number }> = [];
    
    if (tenpaiCount > 0 && tenpaiCount < 4 && notenCount > 0) {
      const notenPlayers = orderedPlayers.filter(p => !tenpaiPlayers.includes(p.id));
      const tenpaiPlayerObjects = orderedPlayers.filter(p => tenpaiPlayers.includes(p.id));
      
      let pointsPerTenpai: number; // 每个听牌者获得的点数
      
      if (tenpaiCount === 1 && notenCount === 3) {
        // 1人听牌，3人不听：不听者每人支付1000 → 听牌者独得3000
        pointsPerTenpai = 3000; // 听牌者总共获得3000，从3个不听者那里每人1000
      } else if (tenpaiCount === 2 && notenCount === 2) {
        // 2人听牌，2人不听：不听者每人支付1500 → 听牌者每人得1500
        pointsPerTenpai = 1500; // 每个听牌者获得1500，每个不听者支付1500（共3000，分配给2人）
      } else if (tenpaiCount === 3 && notenCount === 1) {
        // 3人听牌，1人不听：不听者独付3000 → 听牌者每人得1000
        pointsPerTenpai = 1000; // 每个听牌者获得1000，不听者支付3000（共3000，分配给3人）
      } else {
        // 其他情况（理论上不应该发生，但保险起见）
        pointsPerTenpai = Math.floor(3000 / tenpaiCount);
      }
      
      // 计算罚符分配
      // 总共3000点从不听者流向听牌者
      if (tenpaiCount === 1 && notenCount === 3) {
        // 1人听牌，3人不听：不听者每人支付1000 → 听牌者独得3000
        const tenpai = tenpaiPlayerObjects[0];
        for (const noten of notenPlayers) {
          transfers.push({
            fromId: noten.id,
            toId: tenpai.id,
            points: 1000 // 每个不听者支付1000给听牌者
          });
        }
      } else if (tenpaiCount === 2 && notenCount === 2) {
        // 2人听牌，2人不听：不听者每人支付1500 → 听牌者每人得1500
        // 每个不听者向每个听牌者支付：1500/2 = 750
        for (const noten of notenPlayers) {
          for (const tenpai of tenpaiPlayerObjects) {
            transfers.push({
              fromId: noten.id,
              toId: tenpai.id,
              points: 750 // 每个不听者支付750给每个听牌者，总共1500
            });
          }
        }
      } else if (tenpaiCount === 3 && notenCount === 1) {
        // 3人听牌，1人不听：不听者独付3000 → 听牌者每人得1000
        const noten = notenPlayers[0];
        for (const tenpai of tenpaiPlayerObjects) {
          transfers.push({
            fromId: noten.id,
            toId: tenpai.id,
            points: 1000 // 不听者支付1000给每个听牌者，总共3000
          });
        }
      }
    }

    // 流局时立直棒处理：扣所有立直玩家的1000点（立直棒），立直棒保留到下一局
    const state = useGameStore.getState();
    const riichiStickOwners = state.riichiStickOwners || [];
    const extras: Record<string, number> = {};
    
    // 扣所有立直玩家的1000点（立直棒）
    riichiStickOwners.forEach(ownerId => {
      extras[ownerId] = (extras[ownerId] ?? 0) - 1000;
    });

    // 应用罚符和立直扣分
    // 注意：为了同时显示多个变化项，我们需要在 applyMultiple 中特殊处理流局情况
    // 流局时显示：-1000（立直棒）和+1500/+1000（罚符）
    if (transfers.length > 0 || Object.keys(extras).length > 0) {
      applyMultiple(transfers, extras, true); // 第三个参数表示是流局结算，需要分别显示变化
    }
    
    // 判断连庄或过庄
    // 庄家听牌：连庄（Renchan），本场+1，局数不变
    // 庄家不听：过庄（Oya-nagare），进入下一局
    const isRenchan = dealerIsTenpai;
    
    // 调用流局处理函数
    onDrawRound(tenpaiPlayers, isRenchan);
    setOpen(false);
    setTenpaiPlayers([]);
  };

  const togglePlayer = (playerId: string) => {
    setTenpaiPlayers(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  const tenpaiCount = tenpaiPlayers.length;
  const notenCount = 4 - tenpaiCount;

  // 计算罚符说明
  const getPenaltyInfo = () => {
    if (tenpaiCount === 0 || tenpaiCount === 4) {
      return '无资金流动（全部听牌或全部不听）';
    }
    if (tenpaiCount === 1 && notenCount === 3) {
      return '不听者每人支付 1000点 → 听牌者独得 3000点';
    }
    if (tenpaiCount === 2 && notenCount === 2) {
      return '不听者每人支付 1500点 → 听牌者每人得 1500点';
    }
    if (tenpaiCount === 3 && notenCount === 1) {
      return '不听者独付 3000点 → 听牌者每人得 1000点';
    }
    return '将计算罚符';
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white border-0 py-1.5 px-2 text-xs font-medium h-8 w-full">
          <Shuffle className="h-3 w-3 mr-1" />
          流局
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">听牌宣言（按顺序）</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="text-xs text-slate-400 bg-slate-700/50 p-2 rounded">
            <div>庄家：{dealer.name} ({dealer.position})</div>
            <div className="mt-1">{getPenaltyInfo()}</div>
            {tenpaiCount > 0 && tenpaiCount < 4 && (
              <div className="mt-1">
                庄家{dealerIsTenpai ? '听牌 → 连庄' : '不听 → 过庄'}
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-300">按顺序选择听牌玩家（可多选，包括庄家）：</div>
            {orderedPlayers.map((player, index) => {
              const isTenpai = tenpaiPlayers.includes(player.id);
              const isDealer = player.position === dealerPosition;
              return (
                <Button
                  key={player.id}
                  onClick={() => togglePlayer(player.id)}
                  className={`w-full justify-between ${
                    isTenpai 
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : 'bg-slate-700 hover:bg-slate-600'
                  } text-white ${isDealer ? 'ring-2 ring-yellow-400' : ''}`}
                >
                  <span>
                    {index + 1}. {player.name} ({player.position})
                    {isDealer && ' [庄]'}
                  </span>
                  {isTenpai ? (
                    <span className="font-bold">✓ 听牌</span>
                  ) : (
                    <span className="text-slate-400 text-xs">不听</span>
                  )}
                </Button>
              );
            })}
          </div>
          
          <div className="flex gap-2 pt-2 border-t border-slate-600">
            <Button
              onClick={handleConfirm}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              确认流局
            </Button>
            <Button
              onClick={() => {
                setOpen(false);
                setTenpaiPlayers([]);
              }}
              variant="outline"
              className="flex-1 bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
            >
              取消
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const SettlementCalculator: React.FC<{
  players: BasicPlayer[];
  combo: number;
  riichiSticks: number;
  roundWind: string;
  roundNumber: number;
  onApplyTransfer: (fromId: string, toId: string, points: number) => void;
  onApplyMultiple: (transfers: Array<{ fromId: string; toId: string; points: number }>, extraDiffs?: Record<string, number>) => void;
  onApplyHonba: (v: number) => void;
  onSetHandResult: (playerId: string, handResult: HandResult | null) => void;
  onConsumeRiichi: (winnerId: string) => void;
  onNextRound: (isRenchan: boolean) => void;
  onClearWaitInfo: (playerId: string) => void;
}> = ({ players, combo, riichiSticks, roundWind, roundNumber, onApplyTransfer, onApplyMultiple, onApplyHonba, onSetHandResult, onConsumeRiichi, onNextRound, onClearWaitInfo }) => {
  const { toast } = useToast();
  const [winnerId, setWinnerId] = React.useState(players[0]?.id || '1');
  const [method, setMethod] = React.useState<'ron'|'tsumo'>('ron');
  const [fromId, setFromId] = React.useState(players[1]?.id || '2');
  const [han, setHan] = React.useState(3);
  const [fu, setFu] = React.useState(40);
  const [directPoints, setDirectPoints] = React.useState(3900);
  const [customPoints, setCustomPoints] = React.useState('');
  const [autoAdvance, setAutoAdvance] = React.useState(true);
  const [inputMode, setInputMode] = React.useState<'quick' | 'table' | 'manual'>('quick'); // 输入模式
  const [showYakuDialog, setShowYakuDialog] = React.useState(false);
  const [pendingSettlement, setPendingSettlement] = React.useState<{
    winnerId: string;
    method: 'ron' | 'tsumo';
    points: number;
    basePoints: number;
    honbaBonus: number;
    riichiBonus: number;
    han?: number; // 番数（用于特殊役种匹配）
    fu?: number; // 符数（用于特殊役种匹配）
  } | null>(null);

  const winner = players.find(p => p.id === winnerId);
  // 判断胜者是否是庄家：胜者的位置应该等于当前局的庄家位置
  const dealerPosition = getDealerPosition(roundWind, roundNumber);
  const winnerIsDealer = winner?.position === dealerPosition;

  function calcBase(h: number, f: number) {
    const P = f * Math.pow(2, h + 2);
    return P;
  }

  function capType(h: number, f: number) {
    if (h >= 13) return 'yakuman';
    if (h >= 11) return 'sanbaiman';
    if (h >= 8) return 'baiman';
    if (h >= 6) return 'haneman';
    // M规切上满贯：4番30符起按满贯计
    if (h >= 5 || (h === 4 && f >= 30) || (h === 3 && f >= 70)) return 'mangan';
    return 'normal';
  }

  function ceil100(x: number) { return Math.ceil(x / 100) * 100; }

  function calcRon(h: number, f: number, dealer: boolean) {
    const cap = capType(h, f);
    if (cap !== 'normal') {
      if (cap === 'mangan') return dealer ? 12000 : 8000;
      if (cap === 'haneman') return dealer ? 18000 : 12000;
      if (cap === 'baiman') return dealer ? 24000 : 16000;
      if (cap === 'sanbaiman') return dealer ? 36000 : 24000;
      return dealer ? 48000 : 32000;
    }
    const P = calcBase(h, f);
    return dealer ? ceil100(P * 6) : ceil100(P * 4);
  }

  function calcTsumo(h: number, f: number, dealer: boolean) {
    const cap = capType(h, f);
    if (cap !== 'normal') {
      if (dealer) {
        const each = cap === 'mangan' ? 4000 : cap === 'haneman' ? 6000 : cap === 'baiman' ? 8000 : cap === 'sanbaiman' ? 12000 : 16000;
        return { each: each, dealerPays: each, othersPay: each };
      }
      // 子家自摸满贯及以上：庄家支付2倍，子家支付1倍
      // 满贯：2000/4000（子家支付2000，庄家支付4000），跳满：3000/6000，倍满：4000/8000，三倍满：6000/12000，役满：8000/16000
      const pair = cap === 'mangan' ? { dealerPays: 4000, othersPay: 2000 } : cap === 'haneman' ? { dealerPays: 6000, othersPay: 3000 } : cap === 'baiman' ? { dealerPays: 8000, othersPay: 4000 } : cap === 'sanbaiman' ? { dealerPays: 12000, othersPay: 6000 } : { dealerPays: 16000, othersPay: 8000 };
      return { each: 0, dealerPays: pair.dealerPays, othersPay: pair.othersPay };
    }
    const P = calcBase(h, f);
    if (dealer) {
      // 庄家自摸：三家各支付 base × 2
      const each = ceil100(P * 2);
      return { each, dealerPays: each, othersPay: each };
    } else {
      // 子家自摸：庄家支付 base × 2，其他子家支付 base × 1
      // 根据M规表格：(300/500) 表示子家支付300，庄家支付500
      const dealerPays = ceil100(P * 2);  // 庄家支付基础点数×2（更多）
      const othersPay = ceil100(P * 1);    // 子家支付基础点数×1（较少）
      return { each: 0, dealerPays, othersPay };
    }
  }

  function applyRon() {
    // 判断是否使用直接输入的点数
    const hasCustomInput = customPoints && parseInt(customPoints) > 0;
    const total = hasCustomInput ? parseInt(customPoints) : calcRon(han, fu, !!winnerIsDealer);
    const honbaBonus = combo * 300;
    const transfers: Array<{fromId:string;toId:string;points:number}> = [{ fromId, toId: winnerId, points: total + honbaBonus }];
    // 立直棒处理在 onConsumeRiichi 中进行
    onApplyMultiple(transfers);
  }

  function applyTsumo() {
    const hasCustomInput = customPoints && parseInt(customPoints) > 0;
    const r = calcTsumo(han, fu, !!winnerIsDealer);
    const transfers: Array<{fromId:string;toId:string;points:number}> = [];
    const extras: Record<string, number> = {};
    const honbaEach = 100 * combo;
    
      if (hasCustomInput) {
        // 使用直接输入的点数（customPoints是子家支付的点数）
        const othersPay = parseInt(customPoints);
        // 根据M规，庄家支付 = 基础点数 × 2，子家支付 = 基础点数 × 1
        // 如果子家支付是othersPay，那么基础点数 = othersPay
        // 庄家支付 = ceil100(基础点数 × 2) = ceil100(othersPay × 2)
        const dealerPays = Math.ceil(othersPay * 2 / 100) * 100;
        
        for (const p of players) {
          if (p.id === winnerId) continue;
          const payerIsDealer = p.position === dealerPosition;
          // 庄家支付更多，子家支付较少
          const pay = payerIsDealer && !winnerIsDealer ? dealerPays + honbaEach : othersPay + honbaEach;
          transfers.push({ fromId: p.id, toId: winnerId, points: pay });
        }
      } else {
      // 使用番符计算的点数
      for (const p of players) {
        if (p.id === winnerId) continue;
        const payerIsDealer = p.position === dealerPosition;
        const pay = payerIsDealer ? r.dealerPays + honbaEach : (winnerIsDealer ? r.each + honbaEach : r.othersPay + honbaEach);
        transfers.push({ fromId: p.id, toId: winnerId, points: pay });
      }
    }
    
    // 立直棒处理在 onConsumeRiichi 中进行
    onApplyMultiple(transfers);
  }

  // 计算结算后的玩家分数
  const calculateFinalScores = () => {
    const finalScores: Record<string, number> = {};
    players.forEach(p => {
      finalScores[p.id] = p.score;
    });

    // 判断是否使用直接输入点数
    const hasCustomInput = customPoints && parseInt(customPoints) > 0;

    if (method === 'ron') {
      const total = hasCustomInput ? parseInt(customPoints) : calcRon(han, fu, !!winnerIsDealer);
      const honbaBonus = combo * 300;
      finalScores[fromId] -= (total + honbaBonus);
      finalScores[winnerId] += (total + honbaBonus);
      // 立直棒处理在 onConsumeRiichi 中进行，这里不计算
    } else {
      // 自摸
      const honbaEach = 100 * combo;
      
      if (hasCustomInput) {
        // 使用直接输入的点数（customPoints是子家支付的点数）
        const othersPay = parseInt(customPoints);
        // 根据M规，庄家支付 = ceil100(基础点数 × 2)，子家支付 = ceil100(基础点数 × 1)
        // 如果子家支付是othersPay，那么基础点数 = othersPay
        // 庄家支付 = ceil100(othersPay × 2)
        const dealerPays = Math.ceil(othersPay * 2 / 100) * 100;
        
        players.forEach(p => {
          if (p.id === winnerId) return;
          const payerIsDealer = p.position === dealerPosition;
          // 庄家支付更多，子家支付较少
          const pay = payerIsDealer && !winnerIsDealer ? dealerPays + honbaEach : othersPay + honbaEach;
          finalScores[p.id] -= pay;
          finalScores[winnerId] += pay;
        });
      } else {
        // 使用番符计算
        const r = calcTsumo(han, fu, !!winnerIsDealer);
        players.forEach(p => {
          if (p.id === winnerId) return;
          const payerIsDealer = p.position === dealerPosition;
          const pay = payerIsDealer ? r.dealerPays + honbaEach : (winnerIsDealer ? r.each + honbaEach : r.othersPay + honbaEach);
          finalScores[p.id] -= pay;
          finalScores[winnerId] += pay;
        });
      }
      
      // 立直棒处理在 onConsumeRiichi 中进行，这里不计算
    }

    return finalScores;
  };

  const handleConfirmSettlement = () => {
    // 计算总点数（包含本场和供托）
    const basePoints = method === 'ron' 
      ? calcRon(han, fu, !!winnerIsDealer)
      : (winnerIsDealer ? calcTsumo(han, fu, true).each * 3 : calcTsumo(han, fu, false).dealerPays + calcTsumo(han, fu, false).othersPay * 2);
    const honbaBonus = method === 'ron' ? combo * 300 : combo * 100 * 3;
    const riichiBonus = riichiSticks * 1000;
    const totalPoints = basePoints + honbaBonus + riichiBonus;

    // 如果是快捷结算或表格模式，先弹出役种选择对话框
    if (inputMode === 'quick' || inputMode === 'table') {
      setPendingSettlement({
        winnerId,
        method,
        points: totalPoints,
        basePoints,
        honbaBonus,
        riichiBonus,
        han, // 传递番数
        fu,  // 传递符数
      });
      setShowYakuDialog(true);
    } else {
      // 其他模式直接结算，不显示役种
      finalizeSettlement(winnerId, method, totalPoints, [], basePoints, honbaBonus, riichiBonus);
    }
  };

  const finalizeSettlement = (
    winnerId: string,
    method: 'ron' | 'tsumo',
    totalPoints: number,
    selectedYaku: YakuItem[],
    basePoints?: number,
    honbaBonus?: number,
    riichiBonus?: number
  ) => {
    // 先执行结算
    if (method === 'ron') {
      applyRon();
    } else {
      applyTsumo();
    }

    // 清除所有玩家的待牌信息
    players.forEach(player => {
      onClearWaitInfo(player.id);
    });

    // 创建和牌信息（不包含番和符数）
    const handResult: HandResult = {
      yakuList: selectedYaku,
      fu: 0, // 不再使用
      han: selectedYaku.reduce((sum, y) => sum + y.han, 0), // 只计算役种翻数
      dora: 0, // ドラ数量（可以在对话框中输入）
      uradora: 0, // 里ドラ数量（可选）
      points: totalPoints,
      timestamp: Date.now(),
    };
    
    // 保存和牌信息（如果没有选择役种，yakuList为空数组）
    onSetHandResult(winnerId, handResult);
    
    onConsumeRiichi(winnerId);
    onNextRound(winnerIsDealer);

    // 简单浮窗提示（toast），显示3秒
    toast({
      title: '结算完成',
      description: `${players.find(p => p.id === winnerId)?.name || '玩家'} · ${method === 'ron' ? '荣和' : '自摸'} 已应用`,
      duration: 3000,
    });
  };

  const handleYakuDialogConfirm = (selectedYaku: YakuItem[]) => {
    if (pendingSettlement) {
      finalizeSettlement(
        pendingSettlement.winnerId,
        pendingSettlement.method,
        pendingSettlement.points,
        selectedYaku,
        pendingSettlement.basePoints,
        pendingSettlement.honbaBonus,
        pendingSettlement.riichiBonus
      );
      setPendingSettlement(null);
    }
    setShowYakuDialog(false);
  };

  const ronResult = calcRon(han, fu, !!winnerIsDealer);
  const tsumoResult = calcTsumo(han, fu, !!winnerIsDealer);

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 左侧：操作区域 */}
      <div className="lg:col-span-2 space-y-3">
        {/* 基本信息区域 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium mb-1.5 block text-slate-300">胜者</label>
          <select 
            value={winnerId} 
            onChange={(e) => {
              setWinnerId(e.target.value);
              if (method === 'ron' && fromId === e.target.value) {
                const otherPlayers = players.filter(p => p.id !== e.target.value);
                if (otherPlayers.length > 0) {
                  setFromId(otherPlayers[0].id);
                }
              }
            }} 
            className="w-full bg-slate-700 border-slate-600 text-white rounded-md p-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {players.map(p => (<option key={p.id} value={p.id}>{p.name} ({p.position}) {p.position === dealerPosition ? '[庄]' : ''}</option>))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium mb-1.5 block text-slate-300">和牌方式</label>
          <div className="flex gap-2">
            <Button 
              variant={method==='ron'?'default':'outline'} 
              onClick={() => {
                setMethod('ron');
                if (!fromId || fromId === winnerId) {
                  const otherPlayers = players.filter(p => p.id !== winnerId);
                  if (otherPlayers.length > 0) {
                    setFromId(otherPlayers[0].id);
                  }
                }
              }} 
              className={`${method==='ron'?"bg-blue-600 text-white border-0":"bg-slate-700 text-white border-slate-600"} text-sm py-1.5 flex-1`}
            >
              荣和
            </Button>
            <Button 
              variant={method==='tsumo'?'default':'outline'} 
              onClick={() => setMethod('tsumo')} 
              className={`${method==='tsumo'?"bg-blue-600 text-white border-0":"bg-slate-700 text-white border-slate-600"} text-sm py-1.5 flex-1`}
            >
              自摸
            </Button>
          </div>
        </div>
        {method==='ron' && (
          <div>
            <label className="text-xs font-medium mb-1.5 block text-slate-300">放铳者</label>
            <select 
              value={fromId} 
              onChange={(e)=>setFromId(e.target.value)} 
              className="w-full bg-slate-700 border-slate-600 text-white rounded-md p-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              {players.filter(p=>p.id!==winnerId).map(p => (<option key={p.id} value={p.id}>{p.name} ({p.position})</option>))}
            </select>
          </div>
        )}
      </div>

      {/* 输入模式切换 */}
      <div className="flex items-center gap-2 bg-slate-800/30 rounded-lg p-2 border border-slate-600/50">
        <Badge className="bg-indigo-500 text-white text-xs">结算方式</Badge>
        <div className="flex gap-2 flex-1">
          <Button 
            size="sm" 
            onClick={() => setInputMode('quick')} 
            className={`${inputMode === 'quick' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'} text-xs flex-1`}
          >
            快捷点数
          </Button>
          <Button 
            size="sm" 
            onClick={() => setInputMode('table')} 
            className={`${inputMode === 'table' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'} text-xs flex-1`}
          >
            点数表
          </Button>
          <Button 
            size="sm" 
            onClick={() => setInputMode('manual')} 
            className={`${inputMode === 'manual' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'} text-xs flex-1`}
          >
            番符计算
          </Button>
        </div>
      </div>

      {/* 不同输入模式的UI */}
      {inputMode === 'quick' && (
        <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-600/50 space-y-3">
          <div className="flex items-center gap-2">
            <Badge className="bg-purple-500 text-white text-xs">快捷点数</Badge>
            <span className="text-slate-300 text-xs">
              {method === 'ron' 
                ? `荣和点数 ${winnerIsDealer ? '（庄家）' : '（子家）'}` 
                : `自摸 ${winnerIsDealer ? '（庄家）' : '（子家）'}`}
            </span>
          </div>
          {method === 'ron' && (
            <div className="space-y-2">
              <div className="grid grid-cols-5 gap-2">
                {(winnerIsDealer 
                  ? [
                      { points: 1500, han: 1, fu: 30, label: '1番30符' },
                      { points: 2400, han: 2, fu: 25, label: '2番25符' },
                      { points: 2900, han: 2, fu: 30, label: '2番30符' },
                      { points: 5800, han: 3, fu: 30, label: '3番30符' },
                      { points: 12000, han: 4, fu: 30, label: '满贯' }
                    ]
                  : [
                      { points: 1000, han: 1, fu: 30, label: '1番30符' },
                      { points: 1600, han: 2, fu: 25, label: '2番25符' },
                      { points: 2000, han: 2, fu: 30, label: '2番30符' },
                      { points: 3900, han: 3, fu: 30, label: '3番30符' },
                      { points: 8000, han: 4, fu: 30, label: '满贯' }
                    ]
                ).map(({ points: v, han: h, fu: f, label }) => (
                  <Button 
                    key={v} 
                    size="sm" 
                    onClick={() => {
                      setDirectPoints(v);
                      setCustomPoints('');
                      setHan(h);
                      setFu(f);
                    }} 
                    className={`${directPoints === v && !customPoints ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600'} text-xs`}
                    title={label}
                  >
                    {v.toLocaleString()}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {method === 'tsumo' && (
            <div className="grid grid-cols-5 gap-2">
              {winnerIsDealer ? (
                // 庄家自摸
                [
                  { each: 500, han: 1, fu: 30, label: '1番30符' },
                  { each: 800, han: 2, fu: 25, label: '2番25符' },
                  { each: 1000, han: 2, fu: 30, label: '2番30符' },
                  { each: 2000, han: 3, fu: 30, label: '3番30符' },
                  { each: 4000, han: 4, fu: 30, label: '满贯' }
                ].map(({ each: v, han: h, fu: f, label }) => (
                  <Button 
                    key={`${v}-${h}-${f}`} 
                    size="sm" 
                    onClick={() => {
                      setDirectPoints(v);
                      setCustomPoints('');
                      setHan(h);
                      setFu(f);
                    }} 
                    className={`${directPoints === v && han === h && fu === f && !customPoints ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600'} text-xs`}
                    title={label}
                  >
                    {v.toLocaleString()} ALL
                  </Button>
                ))
              ) : (
                // 子家自摸（显示为 子家/庄家，例如 300/500）- 根据表格 (300/500) 表示子家支付300，庄家支付500
                [
                  { childPay: 300, dealerPay: 500, han: 1, fu: 30, label: '1番30符' },     // 300/500
                  { childPay: 800, dealerPay: 1600, han: 2, fu: 25, label: '2番25符' },    // 800/1600
                  { childPay: 500, dealerPay: 1000, han: 2, fu: 30, label: '2番30符' },    // 500/1000
                  { childPay: 1000, dealerPay: 2000, han: 3, fu: 30, label: '3番30符' },   // 1000/2000
                  { childPay: 2000, dealerPay: 4000, han: 4, fu: 30, label: '满贯' }       // 2000/4000
                ].map(({ childPay, dealerPay, han: h, fu: f, label }) => (
                  <Button 
                    key={`${childPay}-${h}-${f}`} 
                    size="sm" 
                    onClick={() => {
                      // 存储子家支付的点数（用于计算）
                      setDirectPoints(childPay);
                      setCustomPoints('');
                      setHan(h);
                      setFu(f);
                    }} 
                    className={`${directPoints === childPay && han === h && fu === f && !customPoints ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600'} text-xs`}
                    title={label}
                  >
                    {childPay.toLocaleString()}/{dealerPay.toLocaleString()}
                  </Button>
                ))
              )}
            </div>
          )}
          <div className="text-xs text-slate-400 bg-slate-800/30 rounded p-2">
            {method === 'ron' && (
              <div>荣和点数：获胜者从放铳者获得的点数（不含本场和供托）</div>
            )}
            {method === 'tsumo' && !winnerIsDealer && (
              <div><span className="text-blue-400 font-mono">300/500</span> = 其余两家各支付 300点，庄家支付 500点</div>
            )}
            {method === 'tsumo' && winnerIsDealer && (
              <div><span className="text-blue-400 font-mono">4000 ALL</span> = 三家各支付 4000点（共12000点）</div>
            )}
          </div>
        </div>
      )}

      {inputMode === 'table' && (
        <ScoringTable
          isDealer={!!winnerIsDealer}
          method={method}
          onSelectPoints={(h, f, points) => {
            setHan(h);
            setFu(f);
            setDirectPoints(points);
            setCustomPoints('');
          }}
          selectedHan={han}
          selectedFu={fu}
        />
      )}

      {inputMode === 'manual' && (
        <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-600/50 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-orange-500 text-white text-xs">番符计算</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1.5 block text-slate-300">番数</label>
              <input 
                type="number" 
                value={han} 
                onChange={(e)=>{
                  const h = Math.max(1, parseInt(e.target.value)||1);
                  setHan(h);
                  // 重新计算点数
                  const points = method === 'ron' ? calcRon(h, fu, !!winnerIsDealer) : (winnerIsDealer ? calcTsumo(h, fu, true).each : calcTsumo(h, fu, false).othersPay);
                  setDirectPoints(points);
                  setCustomPoints('');
                }} 
                min="1"
                className="w-full bg-slate-700 border-slate-600 text-white rounded-md p-2 text-sm text-center focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                placeholder="番"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block text-slate-300">符数</label>
              <input 
                type="number" 
                value={fu} 
                onChange={(e)=>{
                  const f = Math.max(20, parseInt(e.target.value)||20);
                  setFu(f);
                  // 重新计算点数
                  const points = method === 'ron' ? calcRon(han, f, !!winnerIsDealer) : (winnerIsDealer ? calcTsumo(han, f, true).each : calcTsumo(han, f, false).othersPay);
                  setDirectPoints(points);
                  setCustomPoints('');
                }} 
                min="20"
                step="10"
                className="w-full bg-slate-700 border-slate-600 text-white rounded-md p-2 text-sm text-center focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                placeholder="符"
              />
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-400 mb-1">计算结果</div>
            <div className="text-2xl font-bold text-blue-400">
              {method === 'ron' ? (
                <span>{calcRon(han, fu, !!winnerIsDealer).toLocaleString()} 点</span>
              ) : (
                winnerIsDealer ? (
                  <span>{calcTsumo(han, fu, true).each.toLocaleString()} × 3</span>
                ) : (
                  <span>{calcTsumo(han, fu, false).othersPay.toLocaleString()} / {calcTsumo(han, fu, false).dealerPays.toLocaleString()}</span>
                )
              )}
            </div>
          </div>
        </div>
      )}

        {/* 结算按钮区域 */}
        <div>
          <Button 
            onClick={handleConfirmSettlement} 
            disabled={!winnerId || (method === 'ron' && (!fromId || winnerId === fromId))}
            className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed w-full py-3 text-base font-bold"
          >
            确认结算
          </Button>
        </div>
      </div>

      {/* 右侧：预览区域 */}
      <div className="space-y-3">
        {/* 计算结果预览 */}
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-600">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 text-xs font-medium">基础点数：</span>
              {method === 'ron' ? (
                <span className="text-white font-bold text-sm">
                  {ronResult.toLocaleString()} 点
                </span>
              ) : (
                <div className="text-right">
                  <span className="text-white font-bold text-sm">
                    {winnerIsDealer 
                      ? `${tsumoResult.each.toLocaleString()} × 3 = ${(tsumoResult.each * 3).toLocaleString()} 点`
                      : `${tsumoResult.dealerPays.toLocaleString()} + ${tsumoResult.othersPay.toLocaleString()} × 2 = ${(tsumoResult.dealerPays + tsumoResult.othersPay * 2).toLocaleString()} 点`
                    }
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300 text-xs font-medium">本场追加：</span>
              <span className="text-yellow-400 font-medium text-xs">
                {method === 'ron' ? `+${combo * 300}` : `每人 +${100 * combo}`}
              </span>
            </div>
            {riichiSticks > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-300 text-xs font-medium">供托奖励：</span>
                <Badge className="bg-orange-500 text-white text-xs">
                  +{riichiSticks * 1000} 点（{riichiSticks} 根）
                </Badge>
              </div>
            )}
            <div className="flex items-center justify-between pt-1.5 border-t border-slate-600">
              <span className="text-slate-300 text-xs font-medium">结算后：</span>
              <Badge className={`${winnerIsDealer ? 'bg-green-500' : 'bg-blue-500'} text-white text-xs`}>
                {winnerIsDealer ? `连庄（本场+1）` : `过庄（本场重置为0）`}
              </Badge>
            </div>
          </div>
        </div>

        {/* 结算预览区域 */}
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-600">
          <div className="text-sm font-medium text-slate-300 mb-3">结算预览：</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-3">
            {(() => {
              const finalScores = calculateFinalScores();
              return players.map((player) => {
                const isDealer = player.position === dealerPosition;
                const scoreDiff = finalScores[player.id] - player.score;
                return (
                  <div
                    key={player.id}
                    className={`p-2 rounded-lg border ${
                      isDealer
                        ? 'bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border-yellow-500/30'
                        : 'bg-slate-700/30 border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-white">{player.name}</span>
                      {isDealer ? (
                        <Badge className="bg-yellow-500 text-white text-xs h-4 px-1.5">庄家</Badge>
                      ) : (
                        <Badge variant="outline" className="border-slate-500 text-slate-400 text-xs h-4 px-1.5">子家</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-400">
                        {player.score.toLocaleString()}
                      </span>
                      {scoreDiff !== 0 && (
                        <span className={`text-xs font-medium ${scoreDiff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {scoreDiff > 0 ? '+' : ''}{scoreDiff.toLocaleString()}
                        </span>
                      )}
                      <span className="text-xs text-slate-300">→</span>
                      <span className="text-sm font-bold text-blue-400">
                        {finalScores[player.id].toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </div>

    {/* 役种选择对话框 */}
    {showYakuDialog && pendingSettlement && (
      <YakuSelectionDialog
        open={showYakuDialog}
        onClose={() => {
          // 关闭对话框时，如果不选择役种，直接结算
          finalizeSettlement(
            pendingSettlement.winnerId,
            pendingSettlement.method,
            pendingSettlement.points,
            [],
            pendingSettlement.basePoints,
            pendingSettlement.honbaBonus,
            pendingSettlement.riichiBonus
          );
          setPendingSettlement(null);
          setShowYakuDialog(false);
        }}
        onConfirm={handleYakuDialogConfirm}
        dora={0}
        uradora={0}
        totalPoints={pendingSettlement.points}
        basePoints={pendingSettlement.basePoints}
        honbaBonus={pendingSettlement.honbaBonus}
        riichiBonus={pendingSettlement.riichiBonus}
        han={pendingSettlement.han}
        fu={pendingSettlement.fu}
      />
    )}
    </>
  );
};
