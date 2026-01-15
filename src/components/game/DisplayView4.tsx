import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { usePublicDisplay } from '../../hooks/usePublicDisplay';
import { ScoreDiffItem } from '../../types/game';

type DisplayView4Props = {
  gameId?: string;
  readOnly?: boolean;
};

export const DisplayView4: React.FC<DisplayView4Props> = ({ 
  gameId = 'default', 
  readOnly = false 
}) => {
  // 调试信息
  React.useEffect(() => {
    if (readOnly) {
      console.log('DisplayView4: Props received:', { gameId, readOnly });
    }
  }, [gameId, readOnly]);

  // 如果是只读模式，使用公开显示 hook
  const { loading, error } = usePublicDisplay(readOnly ? gameId : '');
  
  // 性能优化：使用选择器只订阅需要的状态，减少不必要的重渲染
  const players = useGameStore((state) => state.players);
  const roundWind = useGameStore((state) => state.roundWind);
  const roundNumber = useGameStore((state) => state.roundNumber);
  const combo = useGameStore((state) => state.combo);
  const riichiSticks = useGameStore((state) => state.riichiSticks);
  const doraTiles = useGameStore((state) => state.doraTiles);
  const lastScoreDiffs = useGameStore((state) => state.lastScoreDiffs);
  const lastDiffTimestamp = useGameStore((state) => state.lastDiffTimestamp);
  const matchTitle = useGameStore((state) => state.matchTitle);
  const positionImages = useGameStore((state) => state.positionImages);
  const isGameActive = useGameStore((state) => state.isGameActive);
  const playerColors = useGameStore((state) => state.playerColors);

  const [showDiffs, setShowDiffs] = React.useState(false);
  React.useEffect(() => {
    if (lastDiffTimestamp) {
      setShowDiffs(true);
      const t = setTimeout(() => setShowDiffs(false), 3000);
      return () => clearTimeout(t);
    }
  }, [lastDiffTimestamp]);

  // 缓存tileSrc函数，避免每次渲染都创建
  const tileSrc = React.useCallback((code: string) => {
    try {
      return new URL(`../../../img/${code}.png`, import.meta.url).href;
    } catch {
      return new URL(`../../../img/questionmark.png`, import.meta.url).href;
    }
  }, []);

  const dateStr = React.useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${dd}`;
  }, []);

  const [showRiichi, setShowRiichi] = React.useState<{playerId:string; playerName: string}|null>(null);
  const lastRiichi = useGameStore((state) => state.lastRiichi);
  const riichiTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  
  // 缓存玩家映射，避免重复查找
  const playersMap = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    players.forEach(p => map.set(p.id, { id: p.id, name: p.name }));
    return map;
  }, [players]);
  
  const lastRiichiRef = React.useRef<{ playerId: string; timestamp: number } | null>(null);
  
  React.useEffect(() => {
    // 清除之前的定时器
    if (riichiTimeoutRef.current) {
      clearTimeout(riichiTimeoutRef.current);
      riichiTimeoutRef.current = null;
    }
    
    // 如果lastRiichi没有变化，跳过
    if (lastRiichi === lastRiichiRef.current) {
      return;
    }
    lastRiichiRef.current = lastRiichi;
    
    if (lastRiichi) {
      const timeSinceRiichi = Date.now() - lastRiichi.timestamp;
      const DISPLAY_DURATION = 4500; // 延长到4.5秒，让文字有更长的清晰时间
      if (timeSinceRiichi < DISPLAY_DURATION) {
        const player = playersMap.get(lastRiichi.playerId);
        if (player) {
          setShowRiichi({ playerId: player.id, playerName: player.name });
          // 4.5秒后清除显示（考虑已经过去的时间）
          const remainingTime = DISPLAY_DURATION - timeSinceRiichi;
          riichiTimeoutRef.current = setTimeout(() => {
            setShowRiichi(null);
            riichiTimeoutRef.current = null;
          }, remainingTime);
        }
      } else {
        // 如果时间已过，直接清除
        setShowRiichi(null);
      }
    } else {
      // 如果lastRiichi为null，清除显示
      setShowRiichi(null);
    }
    
    return () => {
      if (riichiTimeoutRef.current) {
        clearTimeout(riichiTimeoutRef.current);
        riichiTimeoutRef.current = null;
      }
    };
  }, [lastRiichi, playersMap]);

  // 检查游戏是否真的已开始
  const isGameStarted = React.useMemo(() => {
    if (!readOnly) return true;
    return isGameActive === true;
  }, [readOnly, isGameActive]);

  // 计算当前局的庄家位置
  const getDealerPosition = React.useCallback((roundNumber: number): string => {
    const winds: string[] = ['东', '南', '西', '北'];
    const dealerIndex = (roundNumber - 1) % 4;
    return winds[dealerIndex];
  }, []);

  const dealerPosition = React.useMemo(() => getDealerPosition(roundNumber), [getDealerPosition, roundNumber]);

  // 按 东 -> 南 -> 西 -> 北 的顺序排列玩家
  const orderedPlayers = React.useMemo(() => {
    const order: string[] = ['东', '南', '西', '北'];
    return [...players].sort((a, b) => {
      const aIndex = order.indexOf(a.position);
      const bIndex = order.indexOf(b.position);
      return aIndex - bIndex;
    });
  }, [players]);

  // 辅助函数：十六进制转RGB（缓存，避免每次渲染都创建）
  const hexToRgb = React.useCallback((hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }, []);

  // 辅助函数：获取对比色（白色或黑色）（缓存）
  const getContrastColor = React.useCallback((hex: string) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return 'text-white';
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return brightness > 128 ? 'text-black' : 'text-white';
  }, [hexToRgb]);

  // 获取玩家颜色（支持自定义颜色）
  const getPlayerColor = React.useCallback((player: { id: string; position: string }) => {
    const customColor = playerColors?.[player.id];
    
    if (customColor) {
      // 处理透明颜色
      if (customColor === 'transparent' || customColor === '') {
        // 使用默认颜色但背景透明
        switch (player.position) {
          case '东': return { bg: 'transparent', border: 'border-red-400', text: 'text-red-100' };
          case '南': return { bg: 'transparent', border: 'border-green-400', text: 'text-green-100' };
          case '西': return { bg: 'transparent', border: 'border-blue-400', text: 'text-blue-100' };
          case '北': return { bg: 'transparent', border: 'border-purple-400', text: 'text-purple-100' };
          default: return { bg: 'transparent', border: 'border-gray-400', text: 'text-gray-100' };
        }
      }
      
      // 使用自定义颜色
      const rgb = hexToRgb(customColor);
      if (rgb) {
        return {
          bg: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.9)`,
          border: customColor,
          text: getContrastColor(customColor)
        };
      }
    }
    
    // 默认颜色
    switch (player.position) {
      case '东': return { bg: 'bg-red-500/90', border: 'border-red-400', text: 'text-red-100' };
      case '南': return { bg: 'bg-green-500/90', border: 'border-green-400', text: 'text-green-100' };
      case '西': return { bg: 'bg-blue-500/90', border: 'border-blue-400', text: 'text-blue-100' };
      case '北': return { bg: 'bg-purple-500/90', border: 'border-purple-400', text: 'text-purple-100' };
      default: return { bg: 'bg-gray-500/90', border: 'border-gray-400', text: 'text-gray-100' };
    }
  }, [playerColors, hexToRgb, getContrastColor]);

  // 调试信息
  React.useEffect(() => {
    if (readOnly) {
      console.log('DisplayView4 Debug:', {
        loading,
        error,
        playersCount: players.length,
        gameId,
        readOnly,
        isGameStarted,
        positionImages: Object.keys(positionImages || {}).join(', '),
        positions: players.map(p => p.position).join(', ')
      });
      // 检查每个位置的图片状态
      players.forEach(player => {
        const hasImage = !!positionImages?.[player.position];
        console.log(`DisplayView4 - Position ${player.position} (${player.name}): Image ${hasImage ? 'EXISTS' : 'MISSING'}${hasImage ? ` (${positionImages[player.position]?.substring(0, 50)}...)` : ''}`);
      });
    }
  }, [readOnly, loading, error, players.length, gameId, isGameStarted, positionImages, players]);

  // 加载状态
  if (readOnly && loading) {
    return (
      <div className="relative flex items-center justify-center bg-[#00FF00] text-white"
        style={{ width: '1920px', height: '1080px', aspectRatio: '16/9', margin: '0 auto' }}>
        <div className="text-2xl font-bold bg-black/80 px-6 py-4 rounded-lg">加载中...</div>
      </div>
    );
  }

  // 错误状态
  if (readOnly && error && error !== '房间不存在或游戏未开始' && error !== '房间号不能为空') {
    return (
      <div className="relative flex items-center justify-center bg-[#00FF00] text-white"
        style={{ width: '1920px', height: '1080px', aspectRatio: '16/9', margin: '0 auto' }}>
        <div className="text-xl bg-black/80 px-6 py-4 rounded-lg text-center">
          <div>{error}</div>
          <div className="text-sm mt-2 opacity-75">请检查网络连接</div>
        </div>
      </div>
    );
  }

  // 如果游戏未开始，显示等待状态
  if (readOnly && !loading && !isGameStarted) {
    return (
      <div className="relative flex items-center justify-center bg-[#00FF00] text-white"
        style={{ width: '1920px', height: '1080px', aspectRatio: '16/9', margin: '0 auto' }}>
        <div className="text-xl bg-black/80 px-6 py-4 rounded-lg text-center">
          <div className="text-2xl mb-2 font-bold">等待游戏开始...</div>
          <div className="text-sm opacity-75">请在控制面板点击"游戏开始"按钮</div>
          <div className="text-xs opacity-50 mt-2">房间号: {gameId}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden bg-[#00FF00]"
      style={{ width: '1920px', height: '1080px', aspectRatio: '16/9', margin: '0 auto' }}
    >
      {/* 绿色抠像背景 - OBS 抠像用 */}
      
      {/* 顶部中央：对局信息横幅 */}
      <div className="absolute top-0 left-0 right-0 z-10">
        <div className="bg-gradient-to-r from-black/95 via-black/90 to-black/95 backdrop-blur-md border-b-2 border-white/30 shadow-2xl">
          <div className="flex items-center justify-between px-12 py-6">
            {/* 左侧：场风局数 */}
            <div className="flex items-center gap-8">
              <div className="text-white font-extrabold" style={{ fontSize: '72px', lineHeight: '1', letterSpacing: '0.05em' }}>
                {roundWind}{roundNumber}局
              </div>
              
              {/* 本场和供托 */}
              <div className="flex items-center gap-6 text-white/90" style={{ fontSize: '32px' }}>
                <div className="flex items-center gap-3 bg-yellow-500/20 px-4 py-2 rounded-lg border border-yellow-400/30">
                  <span className="text-yellow-300/80 font-semibold">本场</span>
                  <span className="text-yellow-200 font-bold">{combo}</span>
                </div>
                <div className="flex items-center gap-3 bg-orange-500/20 px-4 py-2 rounded-lg border border-orange-400/30">
                  <span className="text-orange-300/80 font-semibold">供托</span>
                  <span className="text-orange-200 font-bold">{riichiSticks}</span>
                </div>
              </div>
            </div>

            {/* 右侧：赛事信息和 LIVE */}
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-white font-bold whitespace-pre-wrap mb-1" style={{ fontSize: '28px' }}>
                  {matchTitle || '赛事直播'}
                </div>
                <div className="text-white/60" style={{ fontSize: '20px' }}>
                  {dateStr}
                </div>
              </div>
              <div className="bg-[#E31B23] rounded-lg px-5 py-2.5 shadow-lg border-2 border-red-300">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse"></div>
                  <span className="text-white font-extrabold" style={{ fontSize: '16px', letterSpacing: '1px' }}>LIVE</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 左上：宝牌指示 - 放大显示 */}
      {doraTiles && doraTiles.length > 0 && (
        <div className="absolute top-[120px] left-[48px] z-10">
          <div className="bg-black/85 backdrop-blur-md rounded-xl px-6 py-4 shadow-lg border border-white/20">
            <div className="text-white/70 text-sm font-semibold mb-2 uppercase tracking-wider">宝牌</div>
            <div className="flex items-center gap-3 flex-wrap">
              {doraTiles.map((t) => (
                <img key={t} src={tileSrc(t)} alt={t} className="h-16 w-auto drop-shadow-lg" style={{ minWidth: '48px' }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 中央：预留空间（用于OBS转播手牌） */}
      <div className="absolute top-[200px] left-[48px] right-[48px] bottom-[280px] z-10">
        {/* 这个区域留给OBS转播手牌使用 */}
      </div>

      {/* 底部：四人玩家信息条 - 紧凑横向布局（高度1.7倍） */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <div className="bg-black/95 backdrop-blur-md border-t-2 border-white/30 shadow-2xl">
          <div className="grid grid-cols-4 gap-2 px-4 py-5">
            {orderedPlayers.map((player) => {
              const isDealer = player.position === dealerPosition;
              const colors = getPlayerColor(player);
              
              return (
                <PlayerInfoBar
                  key={player.id}
                  player={player}
                  isDealer={isDealer}
                  colors={colors}
                  dealerPosition={dealerPosition}
                  showDiffs={showDiffs}
                  lastScoreDiffs={lastScoreDiffs}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* 立直全屏炫酷动画 */}
      {showRiichi && (
        <>
          <style>{`
            @keyframes riichi-explosion {
              0% {
                opacity: 0;
                transform: scale(0.5);
                filter: blur(20px);
              }
              10% {
                opacity: 1;
                transform: scale(1.2);
                filter: blur(10px);
              }
              20% {
                transform: scale(1);
                filter: blur(0px);
              }
              75% {
                opacity: 1;
                transform: scale(1);
                filter: blur(0px);
              }
              90% {
                opacity: 0.9;
                transform: scale(0.98);
                filter: blur(2px);
              }
              100% {
                opacity: 0;
                transform: scale(0.95);
                filter: blur(5px);
              }
            }
            @keyframes riichi-flash-burst {
              0%, 100% { opacity: 0; }
              5% { opacity: 1; }
              10% { opacity: 0.8; }
              15% { opacity: 1; }
              20% { opacity: 0.6; }
              25% { opacity: 1; }
              30% { opacity: 0.4; }
              35% { opacity: 0.9; }
              40% { opacity: 0.3; }
              50% { opacity: 0.7; }
              60% { opacity: 0.5; }
              70% { opacity: 0.6; }
              80% { opacity: 0.4; }
              90% { opacity: 0.2; }
            }
            @keyframes riichi-text-shake {
              0% { 
                opacity: 0;
                transform: translate(-50%, -50%) translateX(0) rotate(0deg) scale(0.8);
                filter: blur(10px);
              }
              15% {
                opacity: 1;
                transform: translate(-50%, -50%) translateX(-2px) rotate(-0.5deg) scale(1);
                filter: blur(0px);
              }
              20% { 
                transform: translate(-50%, -50%) translateX(2px) rotate(0.5deg) scale(1);
                filter: blur(0px);
              }
              25% { 
                transform: translate(-50%, -50%) translateX(-1px) rotate(-0.3deg) scale(1);
                filter: blur(0px);
              }
              30% { 
                transform: translate(-50%, -50%) translateX(1px) rotate(0.3deg) scale(1);
                filter: blur(0px);
              }
              35%, 75% { 
                opacity: 1;
                transform: translate(-50%, -50%) translateX(0) rotate(0deg) scale(1);
                filter: blur(0px);
              }
              85% {
                opacity: 0.9;
                transform: translate(-50%, -50%) translateX(0) rotate(0deg) scale(0.98);
                filter: blur(2px);
              }
              100% { 
                opacity: 0;
                transform: translate(-50%, -50%) translateX(0) rotate(0deg) scale(0.95);
                filter: blur(5px);
              }
            }
            @keyframes riichi-glow-pulse {
              0%, 100% {
                box-shadow: 0 0 30px rgba(255, 0, 0, 0.6),
                            0 0 60px rgba(255, 100, 0, 0.4),
                            0 0 90px rgba(255, 200, 0, 0.2);
              }
              50% {
                box-shadow: 0 0 50px rgba(255, 0, 0, 1),
                            0 0 100px rgba(255, 100, 0, 0.8),
                            0 0 150px rgba(255, 200, 0, 0.6);
              }
            }
            @keyframes riichi-lightning {
              0%, 100% { opacity: 0; transform: scaleY(0); }
              5% { opacity: 1; transform: scaleY(1); }
              10% { opacity: 0.8; transform: scaleY(0.95); }
              15% { opacity: 1; transform: scaleY(1.05); }
              20% { opacity: 0.9; transform: scaleY(1); }
              25% { opacity: 1; transform: scaleY(1); }
            }
            @keyframes riichi-particle {
              0% {
                opacity: 1;
                transform: translate(-50%, -50%) scale(0) rotate(0deg);
              }
              50% {
                opacity: 0.8;
                transform: translate(-50%, -50%) scale(1) rotate(180deg);
              }
              100% {
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.5) rotate(360deg);
              }
            }
          `}</style>
          
          {/* 全屏闪光背景 */}
          <div 
            className="absolute inset-0 z-40 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at center, rgba(255, 0, 0, 0.3) 0%, rgba(255, 100, 0, 0.2) 30%, transparent 70%)',
              animation: 'riichi-flash-burst 4.5s ease-out forwards',
            }}
          />
          
          {/* 中心爆炸效果 */}
          <div 
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
            style={{
              width: '800px',
              height: '400px',
              animation: 'riichi-explosion 4.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
            }}
          >
            {/* 主容器 */}
            <div className="relative w-full h-full flex flex-col items-center justify-center">
              {/* 上方闪电装饰 */}
              <div 
                className="absolute -top-20 left-1/2 -translate-x-1/2 text-yellow-300 text-6xl font-bold"
                style={{
                  textShadow: '0 0 20px rgba(255, 255, 0, 0.8), 0 0 40px rgba(255, 200, 0, 0.6)',
                  animation: 'riichi-lightning 0.5s ease-out 0.1s forwards',
                  opacity: 0,
                }}
              >
                ⚡
              </div>
              
              {/* 玩家名称 */}
              <div 
                className="text-white text-6xl font-extrabold tracking-[0.2em] text-center mb-4"
                style={{
                  fontFamily: "'Noto Sans SC', 'Microsoft YaHei', sans-serif",
                  textShadow: '0 0 20px rgba(255, 0, 0, 0.8), 0 0 40px rgba(255, 100, 0, 0.6), 0 0 60px rgba(255, 200, 0, 0.4), 0 4px 8px rgba(0, 0, 0, 0.8)',
                  animation: 'riichi-text-shake 3s ease-out forwards',
                  transform: 'translate(-50%, -50%)',
                  position: 'absolute',
                  left: '50%',
                  top: '45%',
                }}
              >
                {showRiichi.playerName}
              </div>
              
              {/* 立直主文字 */}
              <div 
                className="relative text-white text-9xl font-black tracking-[0.3em] text-center"
                style={{
                  fontFamily: "'Noto Sans SC', 'Microsoft YaHei Bold', sans-serif",
                  textShadow: '0 0 30px rgba(255, 0, 0, 1), 0 0 60px rgba(255, 100, 0, 0.8), 0 0 90px rgba(255, 200, 0, 0.6), 0 6px 12px rgba(0, 0, 0, 0.9)',
                  animation: 'riichi-text-shake 3s ease-out forwards',
                  background: 'linear-gradient(180deg, #FFFFFF 0%, #FFD700 50%, #FF6B6B 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  transform: 'translate(-50%, -50%)',
                  position: 'absolute',
                  left: '50%',
                  top: '55%',
                }}
              >
                立直
              </div>
              
              {/* 发光边框 */}
              <div 
                className="absolute inset-0 rounded-3xl border-4"
                style={{
                  borderColor: 'rgba(255, 0, 0, 0.8)',
                  animation: 'riichi-glow-pulse 1s ease-in-out infinite',
                  boxShadow: 'inset 0 0 50px rgba(255, 0, 0, 0.5), 0 0 100px rgba(255, 100, 0, 0.4)',
                }}
              />
              
              {/* 粒子效果 */}
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 bg-yellow-400 rounded-full"
                  style={{
                    left: '50%',
                    top: '50%',
                    animation: `riichi-particle 2s ease-out ${i * 0.1}s forwards`,
                    boxShadow: '0 0 10px rgba(255, 255, 0, 0.8)',
                    transform: `translate(-50%, -50%) rotate(${i * 30}deg) translateY(-150px)`,
                  }}
                />
              ))}
              
              {/* 下方闪电装饰 */}
              <div 
                className="absolute -bottom-20 left-1/2 -translate-x-1/2 text-yellow-300 text-6xl font-bold"
                style={{
                  textShadow: '0 0 20px rgba(255, 255, 0, 0.8), 0 0 40px rgba(255, 200, 0, 0.6)',
                  animation: 'riichi-lightning 0.5s ease-out 0.2s forwards',
                  opacity: 0,
                }}
              >
                ⚡
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// 玩家信息条组件 - 使用React.memo优化性能
const PlayerInfoBar: React.FC<{
  player: { id: string; name: string; teamName?: string; position: string; score: number; isRiichi: boolean };
  isDealer: boolean;
  colors: { bg: string | 'transparent'; border: string; text: string };
  dealerPosition: string;
  showDiffs: boolean;
  lastScoreDiffs: Record<string, number | ScoreDiffItem[]> | null;
}> = React.memo(({ player, isDealer, colors, dealerPosition, showDiffs, lastScoreDiffs }) => {
  const tileSrc = React.useCallback((code: string) => {
    try {
      return new URL(`../../../img/${code}.png`, import.meta.url).href;
    } catch {
      return new URL(`../../../img/questionmark.png`, import.meta.url).href;
    }
  }, []);
  
  return (
    <div
      className={`relative flex items-center gap-3 px-4 py-4 rounded-lg border ${
        isDealer ? 'border-yellow-400 bg-yellow-500/20' : colors.border
      }`}
      style={(() => {
        if (isDealer) return {};
        if (colors.bg === 'transparent') return { backgroundColor: 'transparent' };
        if (typeof colors.bg === 'string' && colors.bg.startsWith('rgba')) return { backgroundColor: colors.bg };
        return {};
      })()}
    >
      {/* 位置标识和座风显示 */}
      <div className="flex items-center gap-2 shrink-0">
        <div className={`${colors.text} font-extrabold`} style={{ fontSize: '40px', lineHeight: '1' }}>
          {player.position}
        </div>
        {isDealer && (
          <div className="bg-yellow-500 text-black text-xs font-bold px-1.5 py-0.5 rounded">
            亲
          </div>
        )}
      </div>
      
      {/* 玩家信息 */}
      <div className="flex-1 min-w-0">
        <div className="text-white font-bold truncate" style={{ fontSize: '24px' }}>
          {player.name || '鈴木 優'}
        </div>
        {player.teamName && (
          <div className="text-white/60 text-sm truncate">
            {player.teamName}
          </div>
        )}
      </div>

      {/* 立直标识 */}
      {player.isRiichi && (
        <div className="bg-red-500 text-white text-sm font-bold px-2 py-1 rounded shrink-0 animate-pulse">
          立直
        </div>
      )}

      {/* 分数显示 */}
      <div className="text-white font-extrabold tabular-nums shrink-0" style={{ fontSize: '36px', lineHeight: '1' }}>
        {player.score.toLocaleString()}
      </div>

      {/* 庄家标识 */}
      {isDealer && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-yellow-400 rounded-t-lg" />
      )}

      {/* 分数变化动画 */}
      {showDiffs && lastScoreDiffs && (() => {
        const diff = lastScoreDiffs[player.id];
        if (!diff) return null;
        
        // 支持多个变化项（数组）或单个变化（数字）
        const diffItems = Array.isArray(diff) 
          ? diff 
          : (typeof diff === 'number' ? [{ value: diff }] : []);
        const hasMultiple = Array.isArray(diff) && diff.length > 1;
        
        // 流局时：如果有标签，即使净变化为0也要显示所有变化项
        const hasLabels = diffItems.some(item => item.label);
        if (diffItems.length === 0) return null;
        // 如果有标签（流局时），始终显示，即使净变化为0
        if (hasLabels) {
          // 有标签时，只要至少有一个非零项就显示
          if (diffItems.every(item => item.value === 0)) return null;
        } else {
          // 没有标签时，按原来的逻辑
          if (hasMultiple) {
            // 多个变化项时，只要至少有一个非零项就显示
            if (diffItems.every(item => item.value === 0)) return null;
          } else {
            // 单个变化项时，如果值为0就不显示
            if (diffItems[0]?.value === 0) return null;
          }
        }
        
        return (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
            <div className="flex flex-col items-center gap-1">
              {diffItems.map((item, idx) => {
                const value = item.value;
                if (value === 0) return null;
                return (
                  <div
                    key={idx}
                    className={`${
                      value > 0 ? 'text-emerald-300' : 'text-red-300'
                    } font-extrabold drop-shadow-2xl animate-bounce flex items-center gap-1`}
                    style={{ fontSize: hasMultiple ? '20px' : '24px', textShadow: '0 0 10px rgba(0,0,0,0.8)' }}
                  >
                    {item.label && (
                      <span className="text-xs opacity-80" style={{ fontSize: hasMultiple ? '14px' : '16px' }}>
                        {item.label}
                      </span>
                    )}
                    <span>
                      {value > 0 ? '+' : value < 0 ? '-' : ''}
                      {Math.abs(value).toLocaleString()}
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
}, (prevProps, nextProps) => {
  // 自定义比较函数
  return (
    prevProps.player.id === nextProps.player.id &&
    prevProps.player.name === nextProps.player.name &&
    prevProps.player.teamName === nextProps.player.teamName &&
    prevProps.player.score === nextProps.player.score &&
    prevProps.player.isRiichi === nextProps.player.isRiichi &&
    prevProps.isDealer === nextProps.isDealer &&
    prevProps.dealerPosition === nextProps.dealerPosition &&
    prevProps.showDiffs === nextProps.showDiffs &&
    prevProps.lastScoreDiffs === nextProps.lastScoreDiffs
  );
});
PlayerInfoBar.displayName = 'PlayerInfoBar';
