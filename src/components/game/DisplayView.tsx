import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { usePublicDisplay } from '../../hooks/usePublicDisplay';

type DisplayViewProps = {
  gameId?: string;
  readOnly?: boolean;
};

export const DisplayView: React.FC<DisplayViewProps> = ({ 
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
    positionImages
  } = useGameStore();

  const [showDiffs, setShowDiffs] = React.useState(false);
  React.useEffect(() => {
    if (lastDiffTimestamp) {
      setShowDiffs(true);
      const t = setTimeout(() => setShowDiffs(false), 3000);
      return () => clearTimeout(t);
    }
  }, [lastDiffTimestamp]);

  const getPositionColor = (position: string) => {
    switch (position) {
      case '东': return 'text-red-400';
      case '南': return 'text-green-400';
      case '西': return 'text-blue-400';
      case '北': return 'text-purple-400';
      default: return 'text-white';
    }
  };

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
  const { lastRiichi } = useGameStore.getState();
  React.useEffect(() => {
    const state = useGameStore.getState();
    const e = state.lastRiichi;
    if (e && Date.now() - e.timestamp < 3000) {
      setShowRiichi({ playerId: e.playerId });
      const t = setTimeout(() => setShowRiichi(null), 2000);
      return () => clearTimeout(t);
    }
  }, [lastDiffTimestamp]);

  // 加载状态
  if (readOnly && loading) {
    return (
      <div className="relative flex items-center justify-center bg-[#00FF00] text-white"
        style={{ width: '1920px', height: '1080px', aspectRatio: '16/9', margin: '0 auto' }}>
        <div className="text-2xl">加载中...</div>
      </div>
    );
  }

  // 错误状态
  if (readOnly && error) {
    return (
      <div className="relative flex items-center justify-center bg-[#00FF00] text-white"
        style={{ width: '1920px', height: '1080px', aspectRatio: '16/9', margin: '0 auto' }}>
        <div className="text-xl bg-black/80 px-6 py-4 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden bg-[#00FF00] flex flex-col"
      style={{ width: '1920px', height: '1080px', aspectRatio: '16/9', margin: '0 auto' }}
    >
      {showRiichi && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="riichi-flash rounded-3xl px-10 py-6 text-white text-4xl font-extrabold tracking-widest">立直</div>
        </div>
      )}

      <div className="flex justify-between items-start p-8 z-10">
        <div className="flex items-center space-x-4">
          <div className="bg-black/90 border-2 border-black rounded-xl px-6 py-3 shadow-xl">
            <div className="flex items-center space-x-3">
              <div className="text-white text-3xl font-extrabold">{roundWind}{roundNumber}局</div>
              <div className="flex items-center space-x-2">
                <div className="text-sm text-gray-300">本场</div>
                <div className="text-white text-3xl font-extrabold">{combo}</div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="text-sm text-gray-300">供托</div>
                <div className="text-white text-3xl font-extrabold">{riichiSticks}</div>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2 bg-black/90 border-2 border-black rounded-xl px-4 py-3 h-[60px]">
            {doraTiles && doraTiles.length > 0 ? (
              doraTiles.map((t) => (
                <img key={t} src={tileSrc(t)} alt={t} className="h-12 w-auto" />
              ))
            ) : (
              <img src={tileSrc('questionmark')} alt="?" className="h-12 w-auto" />
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="text-white bg-black/70 rounded-xl px-4 py-3 text-lg font-bold shadow-xl max-w-md text-right whitespace-pre-wrap">{matchTitle || '赛事直播'}</div>
          <div className="text-white bg-black/70 rounded-xl px-4 py-2 text-sm font-medium shadow-xl">{dateStr}</div>
          <div className="inline-flex items-center bg-black/80 backdrop-blur-md rounded-full px-4 py-2 shadow-xl">
            <div className="w-3 h-3 bg-gradient-to-r from-red-400 to-orange-400 rounded-full mr-2 animate-pulse"></div>
            <span className="text-white/90 text-xs font-medium">LIVE</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-end pb-6 z-10">
        <div className="w-full px-6">
          <div className="grid grid-cols-4 gap-2">
            {players.map((player) => (
              <div key={player.id} className="relative">
                <div className="absolute -top-3 -left-3 z-10">
                  {positionImages?.[player.position] ? (
                    <img 
                      src={positionImages[player.position]} 
                      alt={player.position}
                      className="w-12 h-12 object-cover rounded shadow-md border-2 border-black"
                    />
                  ) : (
                    <div className="bg-black text-white text-lg font-bold rounded px-2 py-1 shadow-md border-2 border-black">
                      {player.position}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-center justify-center px-4 py-3 bg-black border-4 border-black rounded-lg shadow-2xl"> 
                  <div className="relative mb-3 w-full flex justify-center">
                    <div className="relative inline-block">
                      <div className={`display-name text-2xl text-white relative z-10 px-4 py-2 ${player.isRiichi ? 'bg-red-900/80' : 'bg-gray-900/80'} rounded-md`} style={{ textShadow: '0 1px 1px rgba(0,0,0,0.5)' }}>{player.name}</div>
                      {player.isRiichi && (
                        <>
                          <div className="absolute -inset-1 border-2 border-red-500 rounded-lg riichi-effect"></div>
                          <div className="absolute -top-3 right-0 text-xs text-red-400 font-bold z-20 animate-pulse bg-black px-1 rounded">立直</div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="w-full flex flex-col items-center relative">
                    <div className={`display-score text-5xl text-white font-extrabold relative z-10 tabular-nums ${player.isRiichi ? 'riichi-effect' : ''}`} style={{ textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 0 8px rgba(255,255,255,0.2)' }}>
                      {player.score.toLocaleString()}
                    </div>
                  </div>
                </div>
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
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                      <div className="flex flex-col items-center gap-0.5">
                        {diffItems.map((item, idx) => {
                          const value = item.value;
                          if (value === 0) return null;
                          return (
                            <div
                              key={idx}
                              className={`${value > 0 ? 'text-emerald-400' : 'text-red-400'} font-bold drop-shadow-md animate-score-delta flex items-center gap-1`}
                              style={{ fontSize: hasMultiple ? '16px' : '18px' }}
                            >
                              {item.label && (
                                <span className="text-xs opacity-80" style={{ fontSize: '12px' }}>
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
            ))}
          </div>
        </div>
      </div>

      <div className="pb-2" />
    </div>
  );
};
