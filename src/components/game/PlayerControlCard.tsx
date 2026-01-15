import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Player, WaitInfo } from '../../types/game';
import { useGameStore } from '../../store/gameStore';
import { Minus, Plus, Zap, Upload, X, Trash2, ChevronDown } from 'lucide-react';

interface PlayerControlCardProps {
  player: Player;
}

export const PlayerControlCard: React.FC<PlayerControlCardProps> = React.memo(({ player }) => {
  const { 
    updatePlayerName,
    updatePlayerTeamName,
    updatePlayerScore, 
    addScore, 
    toggleRiichi,
    setPositionImage,
    updatePlayerWaitInfo
  } = useGameStore();
  
  // 只订阅当前玩家的位置图片，减少不必要的重渲染
  const positionImage = useGameStore((state) => state.positionImages?.[player.position]);

  // 所有可用的麻将牌
  const allTiles = React.useMemo(() => {
    const suits = ['m', 'p', 's'];
    const nums = Array.from({ length: 9 }, (_, i) => `${i + 1}`);
    const winds = ['ze', 'zn', 'zw', 'zs'];
    const dragons = ['zr', 'zg', 'zwh'];
    return [
      ...suits.flatMap(s => nums.map(n => `${s}${n}`)),
      ...winds,
      ...dragons,
    ];
  }, []);

  // 缓存 tileSrc 函数
  const tileSrc = React.useCallback((code: string) => {
    try {
      return new URL(`../../../img/${code}.png`, import.meta.url).href;
    } catch {
      return new URL(`../../../img/questionmark.png`, import.meta.url).href;
    }
  }, []);

  // 折叠 / 展开 状态（默认折叠，保持高度约 80px）
  const [expanded, setExpanded] = React.useState(false);

  // 待牌弹窗开关
  const [waitDialogOpen, setWaitDialogOpen] = React.useState(false);

  // 本地输入状态（用于防抖）
  const [localName, setLocalName] = React.useState(player.name);
  const [localTeamName, setLocalTeamName] = React.useState(player.teamName || '');
  
  // 同步外部更新
  React.useEffect(() => {
    setLocalName(player.name);
  }, [player.name]);
  
  React.useEffect(() => {
    setLocalTeamName(player.teamName || '');
  }, [player.teamName]);

  // 清理定时器
  React.useEffect(() => {
    return () => {
      if (nameDebounceTimerRef.current) {
        clearTimeout(nameDebounceTimerRef.current);
      }
      if (teamNameDebounceTimerRef.current) {
        clearTimeout(teamNameDebounceTimerRef.current);
      }
    };
  }, []);

  // 输入防抖处理
  const nameDebounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const teamNameDebounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalName(value); // 立即更新本地显示
    // 防抖更新状态
    if (nameDebounceTimerRef.current) {
      clearTimeout(nameDebounceTimerRef.current);
    }
    nameDebounceTimerRef.current = setTimeout(() => {
      updatePlayerName(player.id, value);
    }, 300);
  };

  const handleTeamNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalTeamName(value); // 立即更新本地显示
    // 防抖更新状态
    if (teamNameDebounceTimerRef.current) {
      clearTimeout(teamNameDebounceTimerRef.current);
    }
    teamNameDebounceTimerRef.current = setTimeout(() => {
      updatePlayerTeamName(player.id, value);
    }, 300);
  };

  const handleScoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const score = parseInt(e.target.value) || 0;
    updatePlayerScore(player.id, score);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }
    
    // 检查文件大小（限制为2MB）
    if (file.size > 2 * 1024 * 1024) {
      alert('图片大小不能超过2MB');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === 'string') {
        console.log(`PlayerControlCard: Uploading image for position ${player.position}, size: ${result.length} bytes`);
        setPositionImage(player.position, result);
        console.log(`PlayerControlCard: Image uploaded for position ${player.position}`);
      }
    };
    reader.onerror = () => {
      console.error(`PlayerControlCard: Error reading file for position ${player.position}`);
      alert('图片读取失败，请重试');
    };
    reader.readAsDataURL(file);
    
    // 重置input，允许重复上传同一文件
    e.target.value = '';
  };

  const handleRemoveImage = () => {
    setPositionImage(player.position, null);
  };

  const scoreAdjustments = [
    { label: '+8000', value: 8000, color: 'bg-emerald-500 hover:bg-emerald-600' },
    { label: '+5200', value: 5200, color: 'bg-blue-500 hover:bg-blue-600' },
    { label: '+3900', value: 3900, color: 'bg-indigo-500 hover:bg-indigo-600' },
    { label: '+2000', value: 2000, color: 'bg-green-500 hover:bg-green-600' },
    { label: '+1000', value: 1000, color: 'bg-teal-500 hover:bg-teal-600' },
    { label: '-1000', value: -1000, color: 'bg-orange-500 hover:bg-orange-600' },
    { label: '-2000', value: -2000, color: 'bg-red-500 hover:bg-red-600' },
    { label: '-3900', value: -3900, color: 'bg-rose-500 hover:bg-rose-600' },
  ];

  const getPositionColor = (position: string) => {
    switch (position) {
      case '东': return 'from-red-500 to-red-600';
      case '南': return 'from-green-500 to-green-600';
      case '西': return 'from-blue-500 to-blue-600';
      case '北': return 'from-purple-500 to-purple-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <>
      <Card className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 shadow-xl">
        {/* 顶部细条：根据方位着色 */}
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${getPositionColor(player.position)}`} />

        {/* 默认（折叠）区域 */}
        <div className="px-3 pt-3 pb-2">
          {/* 第一行：位置图标 + 方位 + 玩家名 + 角色标识 + 折叠箭头 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full bg-gradient-to-r ${getPositionColor(player.position)} flex items-center justify-center text-white text-xs font-bold`}>
                {player.position}
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-300">
                <span>{player.position} 家</span>
              </div>
              <span className="text-sm font-semibold text-white truncate max-w-[80px]">
                {player.name}
              </span>
              {player.isRiichi ? (
                <Badge className="bg-gradient-to-r from-red-500 to-orange-500 text-white border-0 text-[10px] px-1.5 py-0.5">
                  庄家
                </Badge>
              ) : (
                <Badge variant="outline" className="border-slate-500 text-slate-300 text-[10px] px-1.5 py-0.5">
                  {player.position === '东' ? '庄家' : '子家'}
                </Badge>
              )}
            </div>
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="ml-2 inline-flex items-center justify-center rounded-full bg-slate-700/80 hover:bg-slate-600 text-slate-200 w-6 h-6"
            >
              <ChevronDown
                className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {/* 第二行：分数 + 立直 & 设置待牌 */}
          <div className="mt-2 flex items-center justify-between">
            <div>
              <div className="text-lg font-bold text-blue-400 leading-tight">
                {player.score.toLocaleString()} 点
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                onClick={() => toggleRiichi(player.id)}
                className={`h-7 px-2 text-xs font-semibold border-0 ${
                  player.isRiichi
                    ? 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
              >
                {player.isRiichi ? '立直中' : '立直'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setWaitDialogOpen(true)}
                className="h-7 px-2 text-xs font-semibold bg-slate-700 border-slate-500 text-white hover:bg-slate-600"
              >
                🎯 设置待牌
              </Button>
            </div>
          </div>
        </div>

        {/* 展开区域：详细设置 */}
        {expanded && (
          <CardContent className="pt-2 pb-3 space-y-3 border-t border-slate-700/60 mt-1">
            {/* 玩家名称 + 队伍名称（可快速编辑） */}
            <div className="grid grid-cols-1 gap-2 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <span className="whitespace-nowrap">玩家名称:</span>
                <Input
                  value={localName}
                  onChange={handleNameChange}
                  placeholder="玩家名称"
                  className="h-8 bg-slate-700 border-slate-600 text-white text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="whitespace-nowrap">队伍名称:</span>
                <Input
                  value={localTeamName}
                  onChange={handleTeamNameChange}
                  placeholder="队伍名称"
                  className="h-8 bg-slate-700 border-slate-600 text-white text-xs"
                />
              </div>
            </div>

            {/* 快速调整 + 微调 */}
            <div>
              <div className="text-xs font-medium mb-1 text-slate-300">快速调整</div>
              <div className="grid grid-cols-4 gap-1.5 mb-2">
                {scoreAdjustments.map((adj) => (
                  <Button
                    key={adj.label}
                    onClick={() => addScore(player.id, adj.value)}
                    className={`text-[11px] font-bold text-white border-0 transition-all duration-200 hover:scale-105 ${adj.color} h-7 px-1.5`}
                    size="sm"
                  >
                    {adj.label}
                  </Button>
                ))}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>减少</span>
                  <span>增加</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addScore(player.id, -300)}
                    className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600 hover:border-slate-500 h-7 text-xs"
                  >
                    <Minus className="h-3 w-3 mr-1" />
                    300
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addScore(player.id, 300)}
                    className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600 hover:border-slate-500 h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    300
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addScore(player.id, -100)}
                    className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600 hover:border-slate-500 h-7 text-xs"
                  >
                    <Minus className="h-3 w-3 mr-1" />
                    100
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addScore(player.id, 100)}
                    className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600 hover:border-slate-500 h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    100
                  </Button>
                </div>
              </div>
            </div>

            {/* 位置图片缩略图 */}
            <div>
              <div className="text-xs font-medium mb-1 text-slate-300">位置图片</div>
              <div className="flex items-center gap-2">
                <div className="w-20 h-14 rounded-md bg-slate-700 border border-slate-600 flex items-center justify-center overflow-hidden">
                  {positionImage ? (
                    <img
                      src={positionImage}
                      alt={player.position}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-[11px] text-slate-400">未上传</span>
                  )}
                </div>
                <div className="flex-1 space-y-1.5">
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-7 bg-slate-700 border-slate-600 text-white hover:bg-slate-600 text-xs"
                      asChild
                    >
                      <span className="cursor-pointer flex items-center justify-center">
                        <Upload className="h-3 w-3 mr-1" />
                        {positionImage ? '更换' : '上传'}
                      </span>
                    </Button>
                  </label>
                  {positionImage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleRemoveImage}
                      className="h-6 px-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      删除图片
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 设置待牌弹窗：居中浮层 */}
      <Dialog open={waitDialogOpen} onOpenChange={setWaitDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-lg">
              <span>
                设置待牌 - {player.name}（{player.position}家）
              </span>
            </DialogTitle>
            <DialogDescription className="text-slate-400 mt-1">
              选择玩家的听牌情况，可选是否有役以及总剩余枚数。
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4 text-sm">
            {/* 当前状态：有役 + 总剩余枚数 */}
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-slate-200">
                <input
                  type="checkbox"
                  checked={player.waitInfo?.hasYaku ?? true}
                  onChange={(e) => {
                    const currentWaitInfo = player.waitInfo || { waits: [], totalCount: -1, hasYaku: true };
                    updatePlayerWaitInfo(player.id, {
                      ...currentWaitInfo,
                      hasYaku: e.target.checked
                    });
                  }}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                />
                <span>有役</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-slate-300 text-sm">总剩余枚数:</span>
                <Input
                  type="number"
                  value={player.waitInfo?.totalCount ?? -1}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || value === '-') {
                      return;
                    }
                    const count = parseInt(value, 10);
                    const finalCount = isNaN(count) ? -1 : count;
                    const currentWaitInfo = player.waitInfo || { waits: [], totalCount: -1, hasYaku: true };
                    updatePlayerWaitInfo(player.id, {
                      ...currentWaitInfo,
                      totalCount: finalCount
                    });
                  }}
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value === '' || value === '-') {
                      const currentWaitInfo = player.waitInfo || { waits: [], totalCount: -1, hasYaku: true };
                      updatePlayerWaitInfo(player.id, {
                        ...currentWaitInfo,
                        totalCount: -1
                      });
                    }
                  }}
                  className="w-24 h-8 bg-slate-700 border-slate-600 text-white text-center text-xs"
                />
              </div>
            </div>

            {/* 待牌选择区域 */}
            <div>
              <div className="text-slate-300 mb-2">选择待牌（点击切换，已选高亮）</div>
              <div className="grid grid-cols-12 gap-1 max-h-[300px] overflow-y-auto p-2 bg-slate-800/60 rounded-lg">
                {allTiles.map(code => {
                  const active = player.waitInfo?.waits?.includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        const currentWaits = player.waitInfo?.waits || [];
                        const newWaits = active
                          ? currentWaits.filter(x => x !== code)
                          : [...currentWaits, code];
                        updatePlayerWaitInfo(player.id, {
                          waits: newWaits,
                          totalCount: player.waitInfo?.totalCount ?? -1,
                          hasYaku: player.waitInfo?.hasYaku ?? true
                        });
                      }}
                      className={`rounded-md p-0.5 border transition-all ${
                        active
                          ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-500/20'
                          : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/60'
                      }`}
                    >
                      <img src={tileSrc(code)} alt={code} className="h-6 w-auto" loading="lazy" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 已选待牌列表 */}
            <div>
              <div className="text-slate-300 mb-1">已选待牌：</div>
              {player.waitInfo && player.waitInfo.waits.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {player.waitInfo.waits.map(code => (
                    <div
                      key={code}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-800 border border-slate-600 text-xs"
                    >
                      <img src={tileSrc(code)} alt={code} className="h-5 w-auto" />
                      <span className="text-slate-200">{code}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500">尚未选择待牌</div>
              )}
            </div>

            {/* 底部操作按钮 */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-700/70">
              <Button
                size="sm"
                variant="outline"
                onClick={() => updatePlayerWaitInfo(player.id, null)}
                className="h-8 px-3 text-xs bg-red-600/20 border-red-500/60 text-red-400 hover:bg-red-600/40"
              >
                清除所有
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setWaitDialogOpen(false)}
                  className="h-8 px-4 text-xs bg-slate-700 border-slate-500 text-slate-100 hover:bg-slate-600"
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={() => setWaitDialogOpen(false)}
                  className="h-8 px-4 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                >
                  确认
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数，只在玩家相关数据变化时重新渲染
  // 优化：避免使用JSON.stringify，直接比较对象属性
  const prevWait = prevProps.player.waitInfo;
  const nextWait = nextProps.player.waitInfo;
  
  const waitInfoEqual = 
    prevWait === nextWait || // 引用相等
    (prevWait === null || prevWait === undefined) === (nextWait === null || nextWait === undefined) &&
    (!prevWait || (
      prevWait.totalCount === nextWait?.totalCount &&
      prevWait.hasYaku === nextWait?.hasYaku &&
      prevWait.waits?.length === nextWait?.waits?.length &&
      (!prevWait.waits || prevWait.waits.every((w, i) => w === nextWait?.waits?.[i]))
    ));
  
  return (
    prevProps.player.id === nextProps.player.id &&
    prevProps.player.name === nextProps.player.name &&
    prevProps.player.teamName === nextProps.player.teamName &&
    prevProps.player.score === nextProps.player.score &&
    prevProps.player.isRiichi === nextProps.player.isRiichi &&
    waitInfoEqual
  );
});
