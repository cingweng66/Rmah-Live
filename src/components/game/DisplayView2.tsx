import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { usePublicDisplay } from '../../hooks/usePublicDisplay';

type DisplayView2Props = {
  gameId?: string;
  readOnly?: boolean;
};

export const DisplayView2: React.FC<DisplayView2Props> = ({ 
  gameId = 'default', 
  readOnly = false 
}) => {
  // 如果是只读模式，使用公开显示 hook
  const { loading, error } = usePublicDisplay(readOnly ? gameId : '');
  const {
    players,
    roundWind,
    roundNumber,
    combo,
    riichiSticks,
    doraTiles,
    lastScoreDiffs,
    lastDiffTimestamp,
    matchTitle,
    positionImages,
    playerColors
  } = useGameStore();

  const [showDiffs, setShowDiffs] = React.useState(false);
  React.useEffect(() => {
    if (lastDiffTimestamp) {
      setShowDiffs(true);
      const t = setTimeout(() => setShowDiffs(false), 3000);
      return () => clearTimeout(t);
    }
  }, [lastDiffTimestamp]);

  const tileSrc = (code: string) => {
    try {
      return new URL(`../../../img/${code}.png`, import.meta.url).href;
    } catch {
      return new URL(`../../../img/questionmark.png`, import.meta.url).href;
    }
  };

  const dateStr = React.useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${dd}`;
  }, []);

  const [showRiichi, setShowRiichi] = React.useState<{playerId:string}|null>(null);
  const lastRiichi = useGameStore((state) => state.lastRiichi);
  React.useEffect(() => {
    if (lastRiichi && Date.now() - lastRiichi.timestamp < 3000) {
      setShowRiichi({ playerId: lastRiichi.playerId });
      const t = setTimeout(() => setShowRiichi(null), 2000);
      return () => clearTimeout(t);
    }
  }, [lastRiichi]);

  // 加载状态
  if (readOnly && loading) {
    return (
      <div className="w-screen h-screen bg-[#00FF00] flex items-center justify-center">
        <div className="text-white text-2xl">加载中...</div>
      </div>
    );
  }

  // 错误状态
  if (readOnly && error) {
    return (
      <div className="w-screen h-screen bg-[#00FF00] flex items-center justify-center">
        <div className="text-white text-xl bg-black/80 px-6 py-4 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  // 计算当前局的庄家位置
  const getDealerPosition = (roundNumber: number): string => {
    const winds: string[] = ['东', '南', '西', '北'];
    const dealerIndex = (roundNumber - 1) % 4;
    return winds[dealerIndex];
  };

  const dealerPosition = getDealerPosition(roundNumber);

  // 按 东 -> 南 -> 西 -> 北 的顺序排列玩家
  const orderedPlayers = React.useMemo(() => {
    const order: string[] = ['东', '南', '西', '北'];
    return [...players].sort((a, b) => {
      const aIndex = order.indexOf(a.position);
      const bIndex = order.indexOf(b.position);
      return aIndex - bIndex;
    });
  }, [players]);

  // 队伍主题色
  // 获取玩家颜色（支持自定义颜色）
  const getPlayerColor = React.useCallback((player: { id: string; position: string }) => {
    const customColor = playerColors?.[player.id];
    
    if (customColor) {
      // 处理透明颜色
      if (customColor === 'transparent' || customColor === '') {
        // 使用默认颜色但背景透明
        switch (player.position) {
          case '东': return { gradient: 'from-red-500/20 to-red-600/20', style: { background: 'transparent' } };
          case '南': return { gradient: 'from-green-500/20 to-green-600/20', style: { background: 'transparent' } };
          case '西': return { gradient: 'from-blue-500/20 to-blue-600/20', style: { background: 'transparent' } };
          case '北': return { gradient: 'from-purple-500/20 to-purple-600/20', style: { background: 'transparent' } };
          default: return { gradient: 'from-gray-500/20 to-gray-600/20', style: { background: 'transparent' } };
        }
      }
      
      // 使用自定义颜色
      const rgb = hexToRgb(customColor);
      if (rgb) {
        return {
          gradient: `from-[${customColor}]/20 to-[${customColor}]/20`,
          style: { background: `linear-gradient(to right, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2), rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2))` }
        };
      }
    }
    
    // 默认颜色
    switch (player.position) {
      case '东': return { gradient: 'from-red-500/20 to-red-600/20', style: {} };
      case '南': return { gradient: 'from-green-500/20 to-green-600/20', style: {} };
      case '西': return { gradient: 'from-blue-500/20 to-blue-600/20', style: {} };
      case '北': return { gradient: 'from-purple-500/20 to-purple-600/20', style: {} };
      default: return { gradient: 'from-gray-500/20 to-gray-600/20', style: {} };
    }
  }, [playerColors]);

  // 辅助函数：十六进制转RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  return (
    <div
      className="relative overflow-hidden bg-[#00FF00] text-white"
      style={{ width: '1920px', height: '1080px', aspectRatio: '16/9', margin: '0 auto' }}
    >
      {/* Layer 0: 绿色抠像背景 */}
      
      {/* Layer 1: 左上对局信息卡 */}
      <div className="absolute top-[40px] left-[48px] z-10">
        <div className="bg-black/90 backdrop-blur-md rounded-[14px] px-8 py-6 shadow-lg border border-white/20" style={{ minWidth: '400px' }}>
          <div className="flex items-center gap-6">
            {/* 场风+局数 */}
            <div className="text-white font-bold" style={{ fontSize: '64px', lineHeight: '1' }}>
              {roundWind}{roundNumber}局
            </div>
            
            {/* 小型计数区 */}
            <div className="flex items-center gap-4 text-white/90" style={{ fontSize: '36px' }}>
              <div className="flex items-center gap-2">
                <span className="text-white/70">本场</span>
                <span className="font-bold">{combo}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/70">供托</span>
                <span className="font-bold">{riichiSticks}</span>
              </div>
            </div>
            
            {/* 宝牌指示 - 直接显示在胶囊中同一行右侧 */}
            {doraTiles && doraTiles.length > 0 && (
              <div className="flex items-center gap-2">
                {doraTiles.map((t) => (
                  <img key={t} src={tileSrc(t)} alt={t} className="h-8 w-auto" style={{ height: '64px' }} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Layer 2: 右上赛事信息 */}
      <div className="absolute top-[40px] right-[48px] z-10">
        <div className="flex flex-col items-end gap-2">
          {/* 赛事信息 */}
          <div className="bg-black/90 backdrop-blur-md rounded-lg px-4 py-2 shadow-lg border border-white/20">
            <div className="text-white font-bold text-right whitespace-pre-wrap" style={{ fontSize: '18px' }}>
              {matchTitle || '赛事直播'}
            </div>
            <div className="text-white/70 text-right" style={{ fontSize: '14px' }}>
              {dateStr}
            </div>
          </div>
          
          {/* LIVE badge */}
          <div className="bg-[#E31B23] rounded-md px-4 py-1.5 shadow-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="text-white font-bold" style={{ fontSize: '14px', letterSpacing: '0.5px' }}>LIVE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Layer 3: 底部四人计分条 */}
      <div className="absolute bottom-[56px] left-[48px] right-[48px] z-10">
        <div className="grid grid-cols-4 gap-2">
          {orderedPlayers.map((player) => {
            const isDealer = player.position === dealerPosition;
            return (
              <div 
                key={player.id} 
                className={`relative bg-gradient-to-r ${getPlayerColor(player).gradient} bg-black/90 backdrop-blur-md rounded-xl p-2 shadow-lg border ${isDealer ? 'border-yellow-400/50' : 'border-white/20'}`}
                style={{ height: '140px', ...getPlayerColor(player).style }}
              >
                {/* 庄家标识 */}
                {isDealer && (
                  <div className="absolute top-1 right-1 bg-yellow-400 text-black text-xs font-bold px-1.5 py-0.5 rounded">
                    庄
                  </div>
                )}
                
                {/* 立直标识 */}
                {player.isRiichi && (
                  <div className="absolute top-1 left-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded animate-pulse">
                    立直
                  </div>
                )}
                
                <div className="flex items-center justify-between gap-2 h-full">
                  {/* 左侧：头像和信息 */}
                  <div className="flex items-start gap-2 flex-1">
                    {/* 头像区域 - 显示上传的位置图片或默认文字 */}
                    <div className="w-[90px] h-[90px] bg-white/10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                      {positionImages?.[player.position] ? (
                        <img 
                          src={positionImages[player.position]} 
                          alt={player.position}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-white font-bold text-3xl">{player.position}</div>
                      )}
                    </div>
                    
                    {/* 信息区域 */}
                    <div className="flex flex-col justify-center gap-0.5">
                      {/* 队名（预留，暂时显示位置） */}
                      <div className="text-white/70" style={{ fontSize: '18px' }}>
                        {player.position}家
                      </div>
                      
                      {/* 选手姓名 */}
                      <div className="text-white font-bold" style={{ fontSize: '36px', lineHeight: '1.2', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                        {player.name}
                      </div>
                    </div>
                  </div>
                  
                  {/* 右侧：点数 */}
                  <div className="text-white font-bold tabular-nums text-right shrink-0" style={{ fontSize: '56px', lineHeight: '1', textShadow: '0 3px 6px rgba(0,0,0,0.9)' }}>
                    {player.score.toLocaleString()}
                  </div>
                </div>
                
                {/* 分数变化动画 */}
                {showDiffs && lastScoreDiffs && (() => {
                  const diff = lastScoreDiffs[player.id];
                  if (!diff) return null;
                  const diffItems = Array.isArray(diff) 
                    ? diff 
                    : (typeof diff === 'number' ? [{ value: diff }] : []);
                  if (diffItems.length === 0) return null;
                  const hasMultiple = Array.isArray(diff) && diff.length > 1;
                  // 流局时：如果有标签，即使净变化为0也要显示所有变化项
                  const hasLabels = diffItems.some(item => item.label);
                  if (hasLabels) {
                    // 有标签时，只要至少有一个非零项就显示
                    if (diffItems.every(item => item.value === 0)) return null;
                  } else {
                    // 没有标签时，按原来的逻辑
                    if (hasMultiple) {
                      if (diffItems.every(item => item.value === 0)) return null;
                    } else {
                      if (diffItems[0]?.value === 0) return null;
                    }
                  }
                  return (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                      <div className="flex flex-col items-center gap-0.5">
                        {diffItems.map((item, idx) => {
                          const value = item.value;
                          if (value === 0) return null;
                          return (
                            <div
                              key={idx}
                              className={`${value > 0 ? 'text-emerald-400' : 'text-red-400'} font-bold drop-shadow-md animate-score-delta flex items-center gap-1`}
                              style={{ fontSize: hasMultiple ? '18px' : '20px' }}
                            >
                              {item.label && (
                                <span className="text-xs opacity-80" style={{ fontSize: '14px' }}>
                                  {item.label}
                                </span>
                              )}
                              <span>
                                {value > 0 ? '+' : value < 0 ? '-' : ''}{Math.abs(value).toLocaleString()}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>

      {/* 立直全屏特效 */}
      {showRiichi && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="riichi-flash rounded-3xl px-10 py-6 text-white text-4xl font-extrabold tracking-widest">立直</div>
        </div>
      )}
    </div>
  );
};
