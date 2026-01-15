import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { usePublicDisplay } from '../../hooks/usePublicDisplay';
import { Wind } from '../../types/game';
import { getYakuInfo } from '../../data/yakuData';

type DisplayView3Props = {
  gameId?: string;
  readOnly?: boolean;
};

export const DisplayView3: React.FC<DisplayView3Props> = ({ 
  gameId = 'default', 
  readOnly = false 
}) => {
  // 调试信息
  React.useEffect(() => {
    if (readOnly) {
      console.log('DisplayView3: Props received:', { gameId, readOnly });
    }
  }, [gameId, readOnly]);

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
    isGameActive,
    playerColors
  } = useGameStore();

  const [showDiffs, setShowDiffs] = React.useState(false);
  // 跟踪每个玩家的旧分数，用于滚动动画（使用 ref 避免依赖项循环）
  const previousScoresRef = React.useRef<Record<string, number>>({});
  const [displayScores, setDisplayScores] = React.useState<Record<string, number>>({});
  const [isScrolling, setIsScrolling] = React.useState<Record<string, boolean>>({});
  // 存储每个玩家的滚动interval，用于在役种显示时停止滚动
  const scoreScrollIntervalsRef = React.useRef<Record<string, NodeJS.Timeout>>({});
  
  // 跟踪待牌状态
  const previousWaitCountsRef = React.useRef<Record<string, number>>({});
  const previousRoundRef = React.useRef<{ roundWind: Wind; roundNumber: number }>({ roundWind, roundNumber });
  const [displayWaitCounts, setDisplayWaitCounts] = React.useState<Record<string, number>>({});
  const [isWaitCountScrolling, setIsWaitCountScrolling] = React.useState<Record<string, boolean>>({});
  const [waitTilesVisible, setWaitTilesVisible] = React.useState<Record<string, boolean>>({});
  // 存储每个玩家的滚动interval，用于取消之前的动画
  const waitCountIntervalsRef = React.useRef<Record<string, NodeJS.Timeout>>({});

  React.useEffect(() => {
    if (lastDiffTimestamp) {
      setShowDiffs(true);
      // 分数变化动画显示 2.2 秒（与 CSS 动画时间一致）
      const t = setTimeout(() => setShowDiffs(false), 2200);
      return () => clearTimeout(t);
    }
  }, [lastDiffTimestamp]);

  // 初始化显示分数（只在组件首次加载时）
  React.useEffect(() => {
    if (Object.keys(displayScores).length === 0 && players.length > 0) {
      const initialScores: Record<string, number> = {};
      const initialPrevious: Record<string, number> = {};
      players.forEach(player => {
        initialScores[player.id] = player.score;
        initialPrevious[player.id] = player.score;
      });
      setDisplayScores(initialScores);
      previousScoresRef.current = initialPrevious;
    }
  }, [players.length, displayScores]); // 只在玩家数量变化且未初始化时初始化

  // 检测分数变化并触发滚动动画
  React.useEffect(() => {
    // 如果没有 lastDiffTimestamp，说明是正常更新，直接同步分数
    if (!lastDiffTimestamp) {
      players.forEach(player => {
        setDisplayScores(prev => ({ ...prev, [player.id]: player.score }));
        previousScoresRef.current[player.id] = player.score;
      });
      return;
    }

    // 有分数变化时，触发动画
    // 使用 lastScoreDiffs 来计算旧分数，确保动画正确触发
    if (!lastScoreDiffs || Object.keys(lastScoreDiffs).length === 0) {
      // 如果没有 lastScoreDiffs，直接同步
      players.forEach(player => {
        setDisplayScores(prev => ({ ...prev, [player.id]: player.score }));
        previousScoresRef.current[player.id] = player.score;
      });
      return;
    }

    const timeouts: NodeJS.Timeout[] = [];
    const intervals: NodeJS.Timeout[] = [];

    players.forEach(player => {
      // 检查是否有和牌信息（役种），用于控制滚动行为
      const hasHandResult = player.handResult && player.handResult.yakuList && player.handResult.yakuList.length > 0;
      // 使用 lastScoreDiffs 计算旧分数
      const diff = lastScoreDiffs[player.id];
      const currentScore = player.score;
      // 计算总变化量（支持数组或单个数字）
      let totalDiff = 0;
      if (diff !== undefined && diff !== null) {
        if (Array.isArray(diff)) {
          totalDiff = diff.reduce((sum, item) => sum + item.value, 0);
        } else if (typeof diff === 'number') {
          totalDiff = diff;
        }
      }
      const prevScore = currentScore - totalDiff; // 从当前分数减去变化量得到旧分数
      
      // 只有当分数真正变化时才触发动画
      if (totalDiff !== 0 && prevScore !== currentScore) {
        // 清除该玩家之前的滚动interval（如果有）
        if (scoreScrollIntervalsRef.current[player.id]) {
          clearInterval(scoreScrollIntervalsRef.current[player.id]);
          delete scoreScrollIntervalsRef.current[player.id];
        }
        
        // 先等待分数变化动画完成（2.2秒），然后开始滚动
        const scrollTimeout = setTimeout(() => {
          setIsScrolling(prev => ({ ...prev, [player.id]: true }));
          
          // 计算滚动步数
          const scoreDiff = currentScore - prevScore;
          const steps = Math.min(Math.abs(scoreDiff), 100); // 最多100步
          const stepSize = scoreDiff / steps;
          let currentStep = 0;
          
          // 检查是否有和牌信息（役种），如果有，需要在4.2秒时停止滚动
          const hasHandResult = player.handResult && player.handResult.yakuList && player.handResult.yakuList.length > 0;
          const scrollDuration = hasHandResult ? 2000 : steps * 20; // 有役种时滚动2秒，否则正常完成
          const stepInterval = hasHandResult ? Math.max(20, scrollDuration / steps) : 20;
          
          const scrollInterval = setInterval(() => {
            currentStep++;
            if (currentStep >= steps) {
              setDisplayScores(prev => ({ ...prev, [player.id]: currentScore }));
              setIsScrolling(prev => ({ ...prev, [player.id]: false }));
              // 动画完成后才更新 previousScoresRef
              previousScoresRef.current[player.id] = currentScore;
              clearInterval(scrollInterval);
              delete scoreScrollIntervalsRef.current[player.id];
            } else {
              setDisplayScores(prev => ({
                ...prev,
                [player.id]: Math.round(prevScore + stepSize * currentStep)
              }));
            }
          }, stepInterval);
          
          // 存储interval引用，以便在役种显示时停止
          scoreScrollIntervalsRef.current[player.id] = scrollInterval;
          intervals.push(scrollInterval);
          
          // 如果有役种，在4.2秒时停止滚动（2.2秒开始 + 2秒滚动 = 4.2秒）
          if (hasHandResult) {
            const stopScrollTimeout = setTimeout(() => {
              if (scoreScrollIntervalsRef.current[player.id]) {
                clearInterval(scoreScrollIntervalsRef.current[player.id]);
                delete scoreScrollIntervalsRef.current[player.id];
              }
              setIsScrolling(prev => ({ ...prev, [player.id]: false }));
              // 更新到当前滚动到的分数（不一定是最终分数，因为被提前停止了）
              // 但为了确保显示正确，我们更新到最终分数
              setDisplayScores(prev => ({ ...prev, [player.id]: currentScore }));
              previousScoresRef.current[player.id] = currentScore;
            }, 2000); // 滚动开始后2秒停止（即4.2秒总时间）
            timeouts.push(stopScrollTimeout);
          }
        }, 2200); // 等待分数变化动画完成
        
        timeouts.push(scrollTimeout);
      } else {
        // 如果没有变化，直接更新
        setDisplayScores(prev => ({ ...prev, [player.id]: currentScore }));
        previousScoresRef.current[player.id] = currentScore;
      }
    });

    return () => {
      timeouts.forEach(clearTimeout);
      intervals.forEach(clearInterval);
      // 清理所有滚动interval
      Object.values(scoreScrollIntervalsRef.current).forEach(interval => {
        clearInterval(interval);
      });
      scoreScrollIntervalsRef.current = {};
    };
  }, [players.map(p => `${p.id}:${p.score}`).join(','), lastDiffTimestamp, JSON.stringify(lastScoreDiffs)]); // 使用字符串化的依赖避免引用变化

  // 检测新局开始，隐藏待牌（结算、流局时清除）
  React.useEffect(() => {
    const currentRound = { roundWind, roundNumber };
    const prevRound = previousRoundRef.current;
    
    // 如果局数或场风变化，说明新局开始
    if (prevRound.roundNumber !== roundNumber || prevRound.roundWind !== roundWind) {
      // 触发所有玩家的待牌消失动画
      // 即使 waitInfo 还在，也要先显示消失动画
      players.forEach(player => {
        // 如果有待牌数据，确保先显示（如果还没显示），然后触发消失动画
        if (player.waitInfo && player.waitInfo.waits && player.waitInfo.waits.length > 0) {
          // 先确保显示（如果之前隐藏了）
          setWaitTilesVisible(prev => {
            if (!prev[player.id]) {
              return { ...prev, [player.id]: true };
            }
            return prev;
          });
          
          // 立即触发消失动画
          setTimeout(() => {
            setWaitTilesVisible(prev => ({ ...prev, [player.id]: false }));
          }, 10);
        } else {
          // 如果没有待牌数据，直接隐藏
          setWaitTilesVisible(prev => {
            const newState = { ...prev };
            delete newState[player.id];
            return newState;
          });
        }
      });
      
      // 延迟后清除待牌显示状态和计数（动画完成后）
      const timer = setTimeout(() => {
        players.forEach(player => {
          // 清除待牌显示状态
          setWaitTilesVisible(prev => {
            const newState = { ...prev };
            delete newState[player.id];
            return newState;
          });
          // 重置计数
          previousWaitCountsRef.current[player.id] = undefined;
          setDisplayWaitCounts(prev => {
            const newState = { ...prev };
            delete newState[player.id];
            return newState;
          });
          setIsWaitCountScrolling(prev => {
            const newState = { ...prev };
            delete newState[player.id];
            return newState;
          });
        });
      }, 350); // 等待消失动画完成（300ms动画 + 50ms缓冲）
      
      previousRoundRef.current = currentRound;
      return () => clearTimeout(timer);
    }
  }, [roundWind, roundNumber, players]);

  // 优化：使用ref追踪待牌信息变化，避免JSON.stringify的性能开销
  const previousWaitInfoRef = React.useRef<Record<string, { waits: string[]; totalCount: number; hasYaku: boolean } | null>>({});
  
  // 初始化待牌显示状态（当有新待牌时）
  React.useEffect(() => {
    players.forEach(player => {
      const currentWaitInfo = player.waitInfo;
      const prevWaitInfo = previousWaitInfoRef.current[player.id];
      
      // 检查待牌信息是否真的变化了（避免不必要的更新）
      const waitsChanged = !prevWaitInfo || 
        prevWaitInfo.waits?.length !== currentWaitInfo?.waits?.length ||
        (prevWaitInfo.waits && currentWaitInfo?.waits && 
         prevWaitInfo.waits.join(',') !== currentWaitInfo.waits.join(','));
      const countChanged = prevWaitInfo?.totalCount !== currentWaitInfo?.totalCount;
      const hasYakuChanged = prevWaitInfo?.hasYaku !== currentWaitInfo?.hasYaku;
      
      if (!waitsChanged && !countChanged && !hasYakuChanged && currentWaitInfo === prevWaitInfo) {
        return; // 没有变化，跳过
      }
      
      // 更新ref
      previousWaitInfoRef.current[player.id] = currentWaitInfo ? {
        waits: currentWaitInfo.waits || [],
        totalCount: currentWaitInfo.totalCount,
        hasYaku: currentWaitInfo.hasYaku
      } : null;
      
      if (currentWaitInfo && currentWaitInfo.waits && currentWaitInfo.waits.length > 0) {
        // 如果之前没有显示，说明是新添加的待牌
        setWaitTilesVisible(prev => {
          if (!prev[player.id]) {
            return { ...prev, [player.id]: true };
          }
          return prev;
        });
        const count = currentWaitInfo.totalCount;
        if (previousWaitCountsRef.current[player.id] === undefined) {
          previousWaitCountsRef.current[player.id] = count;
          setDisplayWaitCounts(prev => ({ ...prev, [player.id]: count }));
        }
      } else {
        // 如果没有待牌，确保隐藏
        setWaitTilesVisible(prev => {
          if (prev[player.id]) {
            const newState = { ...prev };
            delete newState[player.id];
            return newState;
          }
          return prev;
        });
      }
    });
  }, [players]);

  // 优化：检测待牌枚数变化，添加滚动动画（使用更精确的依赖追踪）
  const waitCountDepsRef = React.useRef<Record<string, number>>({});
  
  React.useEffect(() => {
    players.forEach(player => {
      if (!player.waitInfo || !player.waitInfo.waits || player.waitInfo.waits.length === 0) {
        // 如果没有待牌，清除显示计数和动画
        if (waitCountIntervalsRef.current[player.id]) {
          clearInterval(waitCountIntervalsRef.current[player.id]);
          delete waitCountIntervalsRef.current[player.id];
        }
        if (displayWaitCounts[player.id] !== undefined) {
          setDisplayWaitCounts(prev => {
            const newState = { ...prev };
            delete newState[player.id];
            return newState;
          });
        }
        waitCountDepsRef.current[player.id] = -1; // 标记为无待牌
        return;
      }

      const currentCount = player.waitInfo.totalCount;
      const prevCount = previousWaitCountsRef.current[player.id];
      const prevDep = waitCountDepsRef.current[player.id];
      
      // 如果依赖没有变化，跳过（避免不必要的重新计算）
      if (prevDep === currentCount && prevCount !== undefined) {
        return;
      }
      waitCountDepsRef.current[player.id] = currentCount;
      
      // 如果之前没有记录，直接设置（首次显示）
      if (prevCount === undefined) {
        previousWaitCountsRef.current[player.id] = currentCount;
        setDisplayWaitCounts(prev => ({ ...prev, [player.id]: currentCount }));
        return;
      }
      
      // 如果枚数发生变化，触发滚动动画
      if (prevCount !== currentCount) {
        // 取消之前的动画（如果存在）
        if (waitCountIntervalsRef.current[player.id]) {
          clearInterval(waitCountIntervalsRef.current[player.id]);
          delete waitCountIntervalsRef.current[player.id];
        }
        
        // 计算滚动步数
        const countDiff = currentCount - prevCount;
        const absDiff = Math.abs(countDiff);
        
        // 如果变化很小（1-3），逐步滚动；否则直接跳转（避免卡顿）
        if (absDiff <= 3) {
          // 小变化：逐步滚动，每步变化1
          let currentValue = displayWaitCounts[player.id] ?? prevCount;
          const direction = countDiff > 0 ? 1 : -1;
          
          const scrollInterval = setInterval(() => {
            currentValue += direction;
            
            if ((direction > 0 && currentValue >= currentCount) || 
                (direction < 0 && currentValue <= currentCount)) {
              // 到达目标值
              setDisplayWaitCounts(prev => ({ ...prev, [player.id]: currentCount }));
              setIsWaitCountScrolling(prev => ({ ...prev, [player.id]: false }));
              previousWaitCountsRef.current[player.id] = currentCount;
              clearInterval(scrollInterval);
              delete waitCountIntervalsRef.current[player.id];
            } else {
              // 逐步更新数字
              setDisplayWaitCounts(prev => ({
                ...prev,
                [player.id]: currentValue
              }));
            }
          }, 60); // 每60ms更新一次，快速响应
          
          waitCountIntervalsRef.current[player.id] = scrollInterval;
          setIsWaitCountScrolling(prev => ({ ...prev, [player.id]: true }));
        } else {
          // 大变化：直接设置，不滚动（避免卡顿）
          setDisplayWaitCounts(prev => ({ ...prev, [player.id]: currentCount }));
          setIsWaitCountScrolling(prev => ({ ...prev, [player.id]: false }));
          previousWaitCountsRef.current[player.id] = currentCount;
        }
      }
    });

    return () => {
      // 清理所有interval
      Object.values(waitCountIntervalsRef.current).forEach(interval => {
        clearInterval(interval);
      });
      waitCountIntervalsRef.current = {};
    };
  }, [players]); // 移除displayWaitCounts依赖，使用ref追踪避免循环依赖

  const tileSrc = React.useCallback((code: string) => {
    try {
      return new URL(`../../../img/${code}.png`, import.meta.url).href;
    } catch {
      return new URL(`../../../img/questionmark.png`, import.meta.url).href;
    }
  }, []);

  // 优化：缓存dora图片URL，避免重复计算
  const doraImageUrls = React.useMemo(() => {
    if (!doraTiles || doraTiles.length === 0) return [];
    return doraTiles.map(t => ({
      tile: t,
      url: tileSrc(t),
      key: t
    }));
  }, [doraTiles, tileSrc]);

  // 待牌显示组件（优化性能）
  const WaitTilesDisplay = React.useMemo(() => {
    const Component = React.memo(({ 
      waitInfo, 
      tileSrc, 
      displayCount, 
      isScrolling, 
      isVisible 
    }: { 
      waitInfo: { waits: string[]; totalCount: number; hasYaku: boolean }; 
      tileSrc: (code: string) => string;
      displayCount: number;
      isScrolling: boolean;
      isVisible: boolean;
    }) => {
      if (!waitInfo || !waitInfo.waits || waitInfo.waits.length === 0 || !isVisible) return null;

      const waitTilesContent = (
        <>
          <div className="flex flex-wrap items-center" style={{ fontSize: '11.2px', gap: '4.8px' }}>
            {waitInfo.waits.map((tile, idx) => (
              <div 
                key={`${tile}-${idx}`} 
                className="flex items-center animate-wait-tile-in" 
                style={{ 
                  lineHeight: '1',
                  animationDelay: `${idx * 30}ms`,
                  animationFillMode: 'both'
                }}
              >
                <img 
                  src={tileSrc(tile)} 
                  alt={tile} 
                  className="w-auto" 
                  style={{ height: '31.68px', display: 'block' }} 
                  loading="lazy"
                />
              </div>
            ))}
            {displayCount < 0 ? (
              <>
                <div 
                  className="bg-white/70 animate-wait-tile-in"
                  style={{ 
                    width: '1px', 
                    height: '31.68px',
                    marginLeft: '3.2px',
                    marginRight: '3.2px',
                    animationDelay: `${waitInfo.waits.length * 30}ms`,
                    animationFillMode: 'both'
                  }}
                />
                <span 
                  className="text-white font-bold flex items-center justify-center animate-wait-tile-in" 
                  style={{ 
                    fontSize: '11.2px', 
                    height: '31.68px',
                    writingMode: 'vertical-rl',
                    textOrientation: 'upright',
                    letterSpacing: '0.12em',
                    animationDelay: `${waitInfo.waits.length * 30 + 30}ms`,
                    animationFillMode: 'both'
                  }}
                >
                  待牌
                </span>
              </>
            ) : (
              <>
                <div 
                  className="bg-white/70 animate-wait-tile-in"
                  style={{ 
                    width: '1px', 
                    height: '31.68px',
                    marginLeft: '3.2px',
                    marginRight: '3.2px',
                    animationDelay: `${waitInfo.waits.length * 30}ms`,
                    animationFillMode: 'both'
                  }}
                />
                <span 
                  className="text-white font-bold tabular-nums"
                  style={{ 
                    fontSize: '24px', 
                    lineHeight: '31.68px',
                    display: 'inline-block',
                    minWidth: '20px',
                    textAlign: 'center'
                  }}
                >
                  {displayCount}
                </span>
              </>
            )}
          </div>
          
          {/* 无役听牌时的灰色遮罩 */}
          {!waitInfo.hasYaku && (
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundColor: 'rgba(51, 51, 51, 0.65)',
                zIndex: 10
              }}
            />
          )}
        </>
      );

      return (
        <div 
          className={`rounded relative ${isVisible ? 'animate-wait-container-in' : 'animate-wait-container-out'}`}
          style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            padding: '4.8px 8px',
            overflow: 'hidden',
            maxWidth: '240px'
          }}
        >
          {waitTilesContent}
        </div>
      );
    }, (prevProps, nextProps) => {
      // 优化：避免JSON.stringify，直接比较关键属性
      const waitInfoEqual = 
        prevProps.waitInfo?.waits?.length === nextProps.waitInfo?.waits?.length &&
        prevProps.waitInfo?.waits?.join(',') === nextProps.waitInfo?.waits?.join(',') &&
        prevProps.waitInfo?.totalCount === nextProps.waitInfo?.totalCount &&
        prevProps.waitInfo?.hasYaku === nextProps.waitInfo?.hasYaku;
      
      return (
        waitInfoEqual &&
        prevProps.tileSrc === nextProps.tileSrc &&
        prevProps.displayCount === nextProps.displayCount &&
        prevProps.isScrolling === nextProps.isScrolling &&
        prevProps.isVisible === nextProps.isVisible
      );
    });
    Component.displayName = 'WaitTilesDisplay';
    return Component;
  }, []);

  const dateStr = React.useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${dd}`;
  }, []);

  const [showRiichi, setShowRiichi] = React.useState<{playerId:string; playerName: string; position: string}|null>(null);
  const lastRiichi = useGameStore((state) => state.lastRiichi);
  const riichiTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  
  // 优化：缓存玩家查找结果，避免重复查找
  const playersMap = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; position: string }>();
    players.forEach(p => map.set(p.id, { id: p.id, name: p.name, position: p.position }));
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
          setShowRiichi({ playerId: player.id, playerName: player.name, position: player.position });
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

  // 役种显示状态 - 简化版本，只使用简单的显示/隐藏状态
  const [showYaku, setShowYaku] = React.useState<{playerId: string; playerName: string; handResult: any} | null>(null);
  const [yakuVisible, setYakuVisible] = React.useState(false); // 简单的显示/隐藏状态
  const [yakuContentVisible, setYakuContentVisible] = React.useState(false); // 内容显示状态
  const [shouldMovePlayerCard, setShouldMovePlayerCard] = React.useState(false); // 控制玩家卡片“移回原位”的时机
  // 胡牌玩家卡片移动阶段：idle -> entering(从原位置滑到第一个位置) -> atYaku(停在第一个位置)
  const [playerMovePhase, setPlayerMovePhase] = React.useState<'idle' | 'entering' | 'atYaku'>('idle');
  const previousHandResultsRef = React.useRef<Record<string, number>>({});
  const yakuTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const yakuHideTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const yakuShowTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const yakuPhaseTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const playerMoveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  
  // 优化：检测和牌信息变化（使用更精确的依赖追踪）
  const handResultDepsRef = React.useRef<Record<string, number>>({});
  
  React.useEffect(() => {
    // 清除之前的定时器
    if (yakuTimeoutRef.current) {
      clearTimeout(yakuTimeoutRef.current);
      yakuTimeoutRef.current = null;
    }
    if (yakuHideTimeoutRef.current) {
      clearTimeout(yakuHideTimeoutRef.current);
      yakuHideTimeoutRef.current = null;
    }
    if (yakuShowTimeoutRef.current) {
      clearTimeout(yakuShowTimeoutRef.current);
      yakuShowTimeoutRef.current = null;
    }
    if (yakuPhaseTimeoutRef.current) {
      clearTimeout(yakuPhaseTimeoutRef.current);
      yakuPhaseTimeoutRef.current = null;
    }
    if (playerMoveTimeoutRef.current) {
      clearTimeout(playerMoveTimeoutRef.current);
      playerMoveTimeoutRef.current = null;
    }
    
    players.forEach(player => {
      const timestamp = player.handResult?.timestamp || 0;
      const prevDep = handResultDepsRef.current[player.id];
      
      // 如果时间戳没有变化，跳过（避免不必要的重新计算）
      if (prevDep === timestamp && timestamp !== 0) {
        return;
      }
      handResultDepsRef.current[player.id] = timestamp;
      
      if (player.handResult && player.handResult.yakuList && player.handResult.yakuList.length > 0) {
        const lastTimestamp = previousHandResultsRef.current[player.id];
        const currentTimestamp = player.handResult.timestamp;
        
        // 如果是新的和牌（时间戳不同），延迟显示役种（让点数滚动先播放）
        if (lastTimestamp !== currentTimestamp) {
          // 时间线：
          // 0秒：分数变化动画开始
          // 2.2秒：分数变化动画结束，开始点数滚动
          // 4.2秒：点数停止滚动
          // 6.2秒：开始显示役种（2.2秒分数变化动画 + 2秒滚动 + 2秒等待）
          yakuShowTimeoutRef.current = setTimeout(() => {
            setShowYaku({
              playerId: player.id,
              playerName: player.name,
              handResult: player.handResult,
            });
            
            // 重置移动状态
            setShouldMovePlayerCard(false);
            setPlayerMovePhase('idle');
            
            // 确保点数滚动已停止（应该在4.2秒时已停止，这里做双重保险）
            if (scoreScrollIntervalsRef.current[player.id]) {
              clearInterval(scoreScrollIntervalsRef.current[player.id]);
              delete scoreScrollIntervalsRef.current[player.id];
            }
            setIsScrolling(prev => ({ ...prev, [player.id]: false }));
            // 确保显示最终分数
            setDisplayScores(prev => ({ ...prev, [player.id]: player.score }));
            previousScoresRef.current[player.id] = player.score;
            
            // 显示胶囊框
            setYakuVisible(true);
            // 开始“从原位置滑到第一个位置”的动画：先用原位置偏移渲染一帧，再平滑滑到0
            setPlayerMovePhase('entering');
            if (playerMoveTimeoutRef.current) {
              clearTimeout(playerMoveTimeoutRef.current);
            }
            playerMoveTimeoutRef.current = setTimeout(() => {
              setPlayerMovePhase('atYaku');
            }, 30);
            
            // 延迟显示内容（让胶囊先出现，进入动画更慢）
            yakuPhaseTimeoutRef.current = setTimeout(() => {
              setYakuContentVisible(true);
              
              // 5秒后开始隐藏
              yakuTimeoutRef.current = setTimeout(() => {
                // 先隐藏内容
                setYakuContentVisible(false);
                
                // 延迟隐藏胶囊框（让内容退出动画播完）
                yakuPhaseTimeoutRef.current = setTimeout(() => {
                  setYakuVisible(false);
                  
                  // 等待胶囊退出动画完成（2s transition + buffer）后再移动玩家卡片
                  yakuPhaseTimeoutRef.current = setTimeout(() => {
                    setShouldMovePlayerCard(true); // 允许玩家卡片移动回原位置
                    setPlayerMovePhase('atYaku'); // 保证此时固定在第一个位置，再开始回位动画
                    
                    // 等待玩家卡片移动动画完成（2s transition + buffer）后再清除状态
                    yakuPhaseTimeoutRef.current = setTimeout(() => {
                      setShowYaku(null);
                      setShouldMovePlayerCard(false); // 重置移动状态
                      setPlayerMovePhase('idle');
                    }, 2300); // 2s + 0.3s buffer
                  }, 2300); // 等待胶囊消失动画完成（2s + buffer）
                }, 2600); // 2.5s + 0.1s buffer：内容退出动画
              }, 5000); // 显示5秒
            }, 2000); // 胶囊出现后延迟（与2s进入动画匹配）
          }, 6200); // 延迟6.2秒显示役种（2.2秒分数变化动画 + 2秒滚动 + 2秒等待）
          
          previousHandResultsRef.current[player.id] = currentTimestamp;
        }
      } else {
        // 如果没有和牌信息或役种列表为空，清除显示
        if (showYaku?.playerId === player.id) {
          setYakuContentVisible(false);
          setYakuVisible(false);
          setTimeout(() => {
            setShouldMovePlayerCard(true); // 允许移动回原位置
            setTimeout(() => {
              setShowYaku(null);
              setShouldMovePlayerCard(false); // 重置移动状态
              setPlayerMovePhase('idle');
            }, 2300); // 等待卡片移动动画完成（2s + buffer）
          }, 2300); // 等待胶囊消失动画完成（2s + buffer）
        }
        previousHandResultsRef.current[player.id] = 0;
      }
    });
    
    return () => {
      if (yakuTimeoutRef.current) {
        clearTimeout(yakuTimeoutRef.current);
        yakuTimeoutRef.current = null;
      }
      if (yakuHideTimeoutRef.current) {
        clearTimeout(yakuHideTimeoutRef.current);
        yakuHideTimeoutRef.current = null;
      }
      if (yakuShowTimeoutRef.current) {
        clearTimeout(yakuShowTimeoutRef.current);
        yakuShowTimeoutRef.current = null;
      }
      if (yakuPhaseTimeoutRef.current) {
        clearTimeout(yakuPhaseTimeoutRef.current);
        yakuPhaseTimeoutRef.current = null;
      }
      if (playerMoveTimeoutRef.current) {
        clearTimeout(playerMoveTimeoutRef.current);
        playerMoveTimeoutRef.current = null;
      }
    };
  }, [players, lastDiffTimestamp]); // 添加lastDiffTimestamp依赖，确保在分数变化时触发

  // 检查游戏是否真的已开始
  // 注意：所有 Hooks 必须在条件渲染之前，遵守 React Hooks 规则
  const isGameStarted = React.useMemo(() => {
    if (!readOnly) return true; // 控制面板总是显示
    // 使用 isGameActive 标志来判断游戏是否已开始
    // 如果 isGameActive 为 true，说明游戏已开始（即使玩家名称还是默认值）
    return isGameActive === true;
  }, [readOnly, isGameActive]);

  // 计算当前局的庄家位置（必须在条件渲染之前）
  const getDealerPosition = React.useCallback((roundNumber: number): string => {
    const winds: string[] = ['东', '南', '西', '北'];
    const dealerIndex = (roundNumber - 1) % 4;
    return winds[dealerIndex];
  }, []);

  const dealerPosition = React.useMemo(() => getDealerPosition(roundNumber), [getDealerPosition, roundNumber]);

  // 按 东 -> 南 -> 西 -> 北 的顺序排列玩家（必须在条件渲染之前）
  const orderedPlayers = React.useMemo(() => {
    const order: string[] = ['东', '南', '西', '北'];
    return [...players].sort((a, b) => {
      const aIndex = order.indexOf(a.position);
      const bIndex = order.indexOf(b.position);
      return aIndex - bIndex;
    });
  }, [players]);

  // 辅助函数：十六进制转RGB
  const hexToRgb = React.useCallback((hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }, []);

  // 队伍主题色（必须在条件渲染之前）
  const getTeamColor = React.useCallback((position: string) => {
    switch (position) {
      case '东': return 'from-red-500/20 to-red-600/20';
      case '南': return 'from-green-500/20 to-green-600/20';
      case '西': return 'from-blue-500/20 to-blue-600/20';
      case '北': return 'from-purple-500/20 to-purple-600/20';
      default: return 'from-gray-500/20 to-gray-600/20';
    }
  }, []);

  // 调试信息（开发环境）
  React.useEffect(() => {
    if (readOnly) {
      console.log('DisplayView3 Debug:', {
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
        console.log(`Position ${player.position} (${player.name}): Image ${hasImage ? 'EXISTS' : 'MISSING'}${hasImage ? ` (${positionImages[player.position]?.substring(0, 50)}...)` : ''}`);
      });
    }
  }, [readOnly, loading, error, players.length, gameId, isGameStarted, positionImages, players]);

  // 加载状态
  if (readOnly && loading) {
    return (
      <div className="relative flex items-center justify-center bg-[#00FF00] text-white"
        style={{ width: '1920px', height: '1080px', aspectRatio: '16/9', margin: '0 auto' }}>
        <div className="text-2xl font-bold">加载中...</div>
      </div>
    );
  }

  // 错误状态（只有真正的连接错误才显示，游戏未开始不算错误）
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
    <>
      <style>{`
        @keyframes wait-container-in {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes wait-tile-in {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes wait-container-out {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateY(-10px) scale(0.9);
          }
        }
        @keyframes wait-count-scroll {
          0% {
            transform: translateY(0) scale(1);
            opacity: 1;
            color: rgb(255, 255, 255);
          }
          25% {
            transform: translateY(-12px) scale(1.2);
            opacity: 0.6;
            color: rgb(255, 200, 100);
          }
          50% {
            transform: translateY(-8px) scale(1.25);
            opacity: 0.8;
            color: rgb(255, 220, 150);
          }
          75% {
            transform: translateY(-4px) scale(1.15);
            opacity: 0.9;
            color: rgb(255, 240, 200);
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
            color: rgb(255, 255, 255);
          }
        }
        .animate-wait-count-scroll {
          animation: wait-count-scroll 0.8s ease-out;
        }
        .animate-wait-container-in {
          animation: wait-container-in 0.3s ease-out forwards;
        }
        .animate-wait-container-out {
          animation: wait-container-out 0.3s ease-out forwards;
        }
        .animate-wait-tile-in {
          animation: wait-tile-in 0.2s ease-out forwards;
          opacity: 0;
        }
        @keyframes player-card-fade-out {
          from {
            opacity: 1;
            transform: scale(1);
          }
          to {
            opacity: 0;
            transform: scale(0.9);
          }
        }
        @keyframes player-card-fade-in {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        /* 使用简单的CSS transition代替复杂的keyframes */
        .yaku-capsule {
          transition: opacity 2s ease-out, transform 2s cubic-bezier(0.12, 1.15, 0.25, 1);
          transform: translateZ(0);
          will-change: transform, opacity;
        }
        .yaku-capsule.yaku-capsule-enter-active {
          opacity: 1;
          transform: translate3d(0, 0, 0) scale(1);
        }
        .yaku-capsule.yaku-capsule-exit-active {
          opacity: 0;
          transform: translate3d(50px, 0, 0) scale(0.9);
        }
        
        .yaku-content {
          transition: opacity 2.5s ease-out, transform 2.5s cubic-bezier(0.12, 1.15, 0.25, 1);
          transform: translateZ(0);
          will-change: transform, opacity;
        }
        .yaku-content.yaku-content-enter-active {
          opacity: 1;
          transform: translate3d(0, 0, 0) scale(1);
        }
        .yaku-content.yaku-content-exit-active {
          opacity: 0;
          transform: translate3d(0, 20px, 0) scale(0.95);
        }
        
        .yaku-item {
          transition: opacity 1.5s ease-out;
          transform: translateZ(0);
          will-change: opacity;
        }
        
        /* 名牌移动 - 使用CSS transition：2s，具有明显但不过分的 easing */
        .player-card-move {
          transition: transform 2s cubic-bezier(0.16, 0.9, 0.25, 1);
          transform: translateZ(0);
          will-change: transform;
          backface-visibility: hidden;
        }
        .animate-player-card-fade-out {
          animation: player-card-fade-out 0.5s ease-out forwards;
        }
      `}</style>
      <div
        className="relative overflow-hidden bg-[#00FF00]"
        style={{ width: '1920px', height: '1080px', aspectRatio: '16/9', margin: '0 auto' }}
      >
      {/* Layer 0: 绿色抠像背景 */}
      
      {/* Layer 1: 左上对局信息卡 */}
      <div className="absolute top-[40px] left-[48px] z-10">
        <div className="bg-black/90 backdrop-blur-md rounded-[10px] shadow-lg border border-white/20" style={{ 
          padding: '16.8px 22.4px'
        }}>
          <div className="flex items-center" style={{ gap: '16.8px' }}>
            {/* 场风+局数 */}
            <div className="text-white font-bold" style={{ fontSize: '44.8px', lineHeight: '1' }}>
              {roundWind}{roundNumber}局
            </div>
            
            {/* 小型计数区 - 上下排列，左对齐 */}
            <div className="flex flex-col justify-center text-white/90" style={{ fontSize: '25.2px', gap: '5.6px' }}>
              {/* 本场 - 上方 */}
              <div className="flex items-center" style={{ gap: '5.6px' }}>
                <img 
                  src={tileSrc('combo_short')} 
                  alt="本场" 
                  className="w-auto" 
                  style={{ height: '25.2px' }} 
                />
                <span className="font-bold text-white">{combo}</span>
              </div>
              {/* 供托 - 下方 */}
              <div className="flex items-center" style={{ gap: '5.6px' }}>
                <img 
                  src={tileSrc('riichiStick_short')} 
                  alt="供托" 
                  className="w-auto" 
                  style={{ height: '25.2px' }} 
                />
                <span className="font-bold text-white">{riichiSticks}</span>
              </div>
            </div>
            
            {/* 宝牌指示 - 显示在右侧 */}
            {doraImageUrls.length > 0 && (
              <div className="flex items-center" style={{ gap: '5.6px' }}>
                {doraImageUrls.map(({ tile, url, key }) => (
                  <img key={key} src={url} alt={tile} className="w-auto" style={{ height: '44.8px' }} loading="lazy" />
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
            <div className="text-white font-bold text-right whitespace-pre-wrap" style={{ fontSize: '27px' }}>
              {matchTitle || '赛事直播'}
            </div>
            <div className="text-white/70 text-right" style={{ fontSize: '21px' }}>
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

      {/* Layer 3: 底部四人计分条 - 新布局 */}
      <div className="absolute bottom-[56px] left-[48px] right-[48px] z-10">
        <div className="grid grid-cols-4 gap-2 relative">
          {(() => {
            // 如果正在显示役种，重新排列玩家顺序
            const isShowingYaku = showYaku && yakuVisible;
            const winnerPlayer = isShowingYaku 
              ? orderedPlayers.find(p => p.id === showYaku.playerId)
              : null;
            
            // 计算胜家原本的位置索引（用于计算移动距离）
            const winnerOriginalIndex = winnerPlayer 
              ? orderedPlayers.findIndex(p => p.id === winnerPlayer.id)
              : -1;
            
            // 显示役种时的布局：胡牌人在最左侧，其他三个位置合并显示役种
            if (showYaku && winnerPlayer) {
              return (
                <>
                  {/* 胡牌人 - 移到最左侧 */}
                  {(() => {
                    const isDealer = winnerPlayer.position === dealerPosition;
                    // 计算需要移动的距离（从原位置到左侧第一个位置）
                    // grid布局：grid-cols-4 gap-2 (8px)
                    // 在grid中，每个卡片宽度 = (100% - 3*8px) / 4 = (100% - 24px) / 4
                    // 从当前位置移动到第一个位置，需要向左移动：index * (卡片宽度 + gap)
                    // 精确计算：在grid布局中，每个卡片占据的空间 = (100% - 3*gap) / 4
                    // 相邻两列之间的距离 = 卡片宽度 + gap = (100% - 3*gap) / 4 + gap
                    // 简化：相邻两列之间的距离 = (100% - 3*gap + 4*gap) / 4 = (100% + gap) / 4
                    // 在grid-cols-4 gap-2中：gap = 8px
                    // 相邻两列之间的距离 = (100% + 8px) / 4 = 25% + 2px
                    // 从第n列移动到第1列，需要向左移动 winnerOriginalIndex * (25% + 2px)
                    // 但为了精确对齐，我们使用calc来计算
                    const gap = 8; // gap-2 = 8px
                    // 移动距离 = winnerOriginalIndex * ((100% + gap) / 4)
                    // 简化：移动距离 = winnerOriginalIndex * (25% + gap/4) = winnerOriginalIndex * (25% + 2px)
                    const moveDistance = winnerOriginalIndex > 0 
                      ? `calc(-${winnerOriginalIndex} * 25% - ${winnerOriginalIndex * 2}px)`
                      : '0';
                    
                    // 确定transform值：
                    // - 正在显示yaku且处于“entering”阶段：从原位置平滑滑到第一个位置（使用 moveDistance）
                    // - 显示yaku且已到位：固定对齐到第一个卡片位置（transform 为 0）
                    // - yaku结束后 shouldMovePlayerCard 为 true：从第一个位置平滑滑回原来的格子
                    const getTransform = () => {
                      if (isShowingYaku) {
                        // 显示yaku时：先从原位置（moveDistance）滑到第一个位置（0）
                        if (playerMovePhase === 'entering') {
                          return `translate3d(${moveDistance}, 0, 0) translateZ(0)`;
                        }
                        return 'translate3d(0, 0, 0) translateZ(0)';
                      } else if (shouldMovePlayerCard) {
                        // yaku动画完成后，移动回原位置
                        // 由于gridColumn仍然是'1'，我们需要反向移动来回到原位置
                        // 原位置是第winnerOriginalIndex+1列，现在在第1列，需要向右移动
                        if (winnerOriginalIndex > 0) {
                          const reverseMoveDistance = `calc(${winnerOriginalIndex} * 25% + ${winnerOriginalIndex * 2}px)`;
                          return `translate3d(${reverseMoveDistance}, 0, 0) translateZ(0)`;
                        }
                        return 'translate3d(0, 0, 0) translateZ(0)';
                      } else if (showYaku) {
                        // yaku 正在消失但动画未完成，也保持对齐在第一个位置
                        return 'translate3d(0, 0, 0) translateZ(0)';
                      }
                      // 正常状态，原位置
                      return 'translate3d(0, 0, 0) translateZ(0)';
                    };
                    
                    return (
                      <div
                        key={winnerPlayer.id}
                        className={`relative flex h-40 w-full overflow-visible rounded-lg shadow-lg border player-card-move ${
                          isDealer ? 'border-yellow-400/50' : 'border-white/20'
                        }`}
                        style={(() => {
                          const customColor = playerColors?.[winnerPlayer.id];
                          const baseStyle: React.CSSProperties = {
                            gridColumn: '1',
                            transform: getTransform(),
                          };
                          if (customColor) {
                            if (customColor === 'transparent' || customColor === '') {
                              return { ...baseStyle, backgroundColor: 'transparent' };
                            }
                            const rgb = hexToRgb(customColor);
                            if (rgb) {
                              return { ...baseStyle, backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.9)` };
                            }
                          }
                          return { ...baseStyle, backgroundColor: 'rgb(15 23 42)' };
                        })()}
                      >
                        {/* 玩家卡片内容 */}
                        <div className="relative z-10 shrink-0 overflow-hidden bg-slate-800" style={{ width: '120px', height: '160px' }}>
                          {positionImages?.[winnerPlayer.position] ? (
                            <img
                              src={positionImages[winnerPlayer.position]}
                              alt={winnerPlayer.position}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white font-bold text-3xl">
                              {winnerPlayer.position}
                            </div>
                          )}
                        </div>
                        <div className="relative flex-1 flex flex-col justify-between text-left z-10">
                          <div className="p-2 flex flex-col gap-0.5 relative">
                            <div className="flex items-center justify-between">
                              <div className="uppercase text-white/70 tracking-[0.2em] font-semibold" style={{ fontSize: '25px' }}>
                                {winnerPlayer.teamName || `${winnerPlayer.position} TEAM`}
                              </div>
                            </div>
                            <div className="text-white font-extrabold leading-tight" style={{ fontSize: '35px' }}>
                              {winnerPlayer.name || '鈴木 優'}
                            </div>
                          </div>
                          <div className="h-20 bg-black/70 flex items-center justify-start px-8 py-3 overflow-hidden">
                            <span
                              className="text-white font-extrabold tabular-nums"
                              style={{ fontSize: '50px', lineHeight: '1' }}
                            >
                              {(displayScores[winnerPlayer.id] ?? winnerPlayer.score).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        {isDealer && <div className="absolute -bottom-3 left-2 right-2 h-2 bg-red-500 z-30 rounded-full shadow-lg" />}
                        {winnerPlayer.isRiichi && (
                          <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded animate-pulse z-20">
                            立直
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  
                  {/* 右侧三个位置合并显示役种 */}
                  <div 
                    className="col-span-3 h-40 rounded-lg shadow-lg border border-white/20 bg-black/90 backdrop-blur-md flex items-center justify-center yaku-capsule"
                    style={{
                      opacity: yakuVisible ? 1 : 0,
                      transform: yakuVisible 
                        ? 'translate3d(0, 0, 0) scale(1) translateZ(0)' 
                        : 'translate3d(50px, 0, 0) scale(0.9) translateZ(0)',
                    }}
                  >
                    {showYaku.handResult.yakuList && showYaku.handResult.yakuList.length > 0 ? (
                      <div 
                        className="flex flex-col items-center w-full px-8 yaku-content" 
                        style={{ 
                          gap: '8px',
                          opacity: yakuContentVisible ? 1 : 0,
                          transform: yakuContentVisible 
                            ? 'translate3d(0, 0, 0) scale(1) translateZ(0)' 
                            : 'translate3d(0, 20px, 0) scale(0.95) translateZ(0)',
                        }}
                      >
                        {/* 役种列表 - 不显示番数 */}
                        <div className="flex flex-wrap items-center justify-center" style={{ gap: '12px' }}>
                          {showYaku.handResult.yakuList.map((yaku, idx) => (
                            <div
                              key={idx}
                              className="yaku-item"
                              style={{
                                opacity: yakuContentVisible ? 1 : 0,
                                transitionDelay: `${idx * 0.05}s`,
                              }}
                            >
                              <span
                                className="text-white font-bold"
                                style={{ fontSize: '40px', textShadow: '0 2px 4px rgba(0, 0, 0, 0.8)', lineHeight: '1' }}
                              >
                                {yaku.name}
                              </span>
                            </div>
                          ))}
                        </div>
                        {/* ドラ/里ドラ显示 */}
                        {(showYaku.handResult.dora > 0 || (showYaku.handResult.uradora && showYaku.handResult.uradora > 0)) && (
                          <div 
                            className="flex items-center text-yellow-400 yaku-item" 
                            style={{ 
                              fontSize: '28px', 
                              gap: '16px', 
                              lineHeight: '1',
                              opacity: yakuContentVisible ? 1 : 0,
                              transitionDelay: `${showYaku.handResult.yakuList.length * 0.05 + 0.1}s`,
                            }}
                          >
                            {showYaku.handResult.dora > 0 && (
                              <span>ドラ{showYaku.handResult.dora}</span>
                            )}
                            {showYaku.handResult.uradora && showYaku.handResult.uradora > 0 && (
                              <span>里ドラ{showYaku.handResult.uradora}</span>
                            )}
                          </div>
                        )}
                        {/* 点数显示 */}
                        <div
                          className="text-green-500 font-bold yaku-item"
                          style={{ 
                            fontSize: '48px', 
                            lineHeight: '1',
                            opacity: yakuContentVisible ? 1 : 0,
                            transitionDelay: `${showYaku.handResult.yakuList.length * 0.05 + 0.15}s`,
                          }}
                        >
                          {showYaku.handResult.points.toLocaleString()}点
                        </div>
                      </div>
                    ) : null}
                  </div>
                </>
              );
            }
            
            // 正常布局：显示所有玩家
            return orderedPlayers.map((player) => {
              const isDealer = player.position === dealerPosition;
              const isWinner = isShowingYaku && player.id === showYaku?.playerId;
              const shouldHide = isShowingYaku && !isWinner;
              
              // 如果应该隐藏，不渲染这个玩家卡片
              if (shouldHide) {
                return null;
              }
              
              return (
                <div
                  key={player.id}
                  className={`relative flex h-40 w-full overflow-visible rounded-lg shadow-lg border player-card-move ${
                    isDealer ? 'border-yellow-400/50' : 'border-white/20'
                  }`}
                  style={(() => {
                    const customColor = playerColors?.[player.id];
                    const baseStyle: React.CSSProperties = {
                      transform: 'translateZ(0)', // 强制GPU加速
                    };
                    if (customColor) {
                      if (customColor === 'transparent' || customColor === '') {
                        return { ...baseStyle, backgroundColor: 'transparent' };
                      }
                      const rgb = hexToRgb(customColor);
                      if (rgb) {
                        return { ...baseStyle, backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.9)` };
                      }
                    }
                    return { ...baseStyle, backgroundColor: 'rgb(15 23 42)' };
                  })()}
                >
                {/* 悬浮待牌显示区域 - 超过5张时显示在信息区上方 */}
                {player.waitInfo && player.waitInfo.waits && player.waitInfo.waits.length > 0 && player.waitInfo.waits.length > 5 && (
                  (waitTilesVisible[player.id] !== false) && (
                    <div 
                      className="absolute z-30"
                      style={{ 
                        top: '8px',
                        left: '136px', // 头像宽度120px + padding 16px
                        pointerEvents: 'none'
                      }}
                    >
                      <WaitTilesDisplay 
                        waitInfo={player.waitInfo} 
                        tileSrc={tileSrc}
                        displayCount={displayWaitCounts[player.id] ?? player.waitInfo.totalCount}
                        isScrolling={isWaitCountScrolling[player.id] ?? false}
                        isVisible={waitTilesVisible[player.id] !== false}
                      />
                    </div>
                  )
                )}

                {/* 悬浮待牌显示区域 - 5张及以下时显示在右上角 */}
                {player.waitInfo && player.waitInfo.waits && player.waitInfo.waits.length > 0 && player.waitInfo.waits.length <= 5 && (
                  (waitTilesVisible[player.id] !== false) && (
                    <div 
                      className="absolute z-30"
                      style={{ 
                        top: '8px',
                        right: '8px',
                        pointerEvents: 'none'
                      }}
                    >
                      <WaitTilesDisplay 
                        waitInfo={player.waitInfo} 
                        tileSrc={tileSrc}
                        displayCount={displayWaitCounts[player.id] ?? player.waitInfo.totalCount}
                        isScrolling={isWaitCountScrolling[player.id] ?? false}
                        isVisible={waitTilesVisible[player.id] !== false}
                      />
                    </div>
                  )
                )}

                {/* 左：头像 - 3:4比例（竖版） */}
                <div className="relative z-10 shrink-0 overflow-hidden bg-slate-800" style={{ width: '120px', height: '160px' }}>
                  {positionImages?.[player.position] ? (
                    <img
                      src={positionImages[player.position]}
                      alt={player.position}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white font-bold text-3xl">
                      {player.position}
                    </div>
                  )}
                </div>

                {/* 右：信息区 */}
                <div className="relative flex-1 flex flex-col justify-between text-left z-10">
                  {/* 文本内容 */}
                  <div className="p-2 flex flex-col gap-0.5 relative">
                    <div className="flex items-center justify-between">
                      <div className="uppercase text-white/70 tracking-[0.2em] font-semibold" style={{ fontSize: '25px' }}>
                        {player.teamName || `${player.position} TEAM`}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-white font-extrabold leading-tight" style={{ fontSize: '35px' }}>
                        {player.name || '鈴木 優'}
                      </div>
                      {/* 分数变化显示在名字右侧 */}
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
                          <div className="flex flex-col items-start gap-0.5">
                            {diffItems.map((item, idx) => {
                              const value = item.value;
                              if (value === 0) return null;
                              return (
                                <div
                                  key={idx}
                                  className={`font-bold drop-shadow-md animate-score-delta flex items-center gap-1 ${
                                    value > 0 ? 'text-emerald-300' : 'text-red-300'
                                  }`}
                                  style={{ fontSize: hasMultiple ? '24px' : '28px', lineHeight: '1' }}
                                >
                                  {item.label && (
                                    <span className="text-xs opacity-80" style={{ fontSize: hasMultiple ? '18px' : '20px' }}>
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
                        );
                      })()}
                    </div>
                  </div>

                  {/* 底部分数条 */}
                  <div className="h-20 bg-black/70 flex items-center justify-start px-8 py-3 overflow-hidden">
                    <span
                      className={`text-white font-extrabold tabular-nums transition-all duration-200 ${
                        isScrolling[player.id] ? 'scale-105' : 'scale-100'
                      }`}
                      style={{ fontSize: '50px', lineHeight: '1' }}
                    >
                      {(displayScores[player.id] ?? player.score).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* 庄家底部红线 - 与胶囊保持距离 */}
                {isDealer && <div className="absolute -bottom-3 left-2 right-2 h-2 bg-red-500 z-30 rounded-full shadow-lg" />}

                {/* 立直标识 */}
                {player.isRiichi && (
                  <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded animate-pulse z-20">
                    立直
                  </div>
                )}

              </div>
              );
            });
          })()}
        </div>
      </div>

      {/* 立直全屏炫酷动画 - 适配OBS绿色抠像 */}
      {showRiichi && (() => {
        // 根据玩家座风获取颜色
        const getPositionColor = (position: string) => {
          switch (position) {
            case '东': return { primary: '#EF4444', secondary: '#DC2626', gradient: 'from-red-500 via-red-400 to-red-600' }; // 红色
            case '南': return { primary: '#10B981', secondary: '#059669', gradient: 'from-green-500 via-green-400 to-green-600' }; // 绿色
            case '西': return { primary: '#3B82F6', secondary: '#2563EB', gradient: 'from-blue-500 via-blue-400 to-blue-600' }; // 蓝色
            case '北': return { primary: '#A855F7', secondary: '#9333EA', gradient: 'from-purple-500 via-purple-400 to-purple-600' }; // 紫色
            default: return { primary: '#EF4444', secondary: '#DC2626', gradient: 'from-red-500 via-red-400 to-red-600' };
          }
        };
        const colors = getPositionColor(showRiichi.position);
        return (
        <>
          <style>{`
            @keyframes riichi-shockwave {
              0% {
                opacity: 1;
                transform: translate(-50%, -50%) scale(0);
                border-width: 4px;
              }
              50% {
                opacity: 0.6;
                transform: translate(-50%, -50%) scale(1.5);
                border-width: 2px;
              }
              100% {
                opacity: 0;
                transform: translate(-50%, -50%) scale(2.5);
                border-width: 1px;
              }
            }
            @keyframes riichi-sparkle {
              0%, 100% { opacity: 0; transform: scale(0) rotate(0deg); }
              20% { opacity: 1; transform: scale(1.2) rotate(180deg); }
              40% { opacity: 0.8; transform: scale(0.8) rotate(360deg); }
              60% { opacity: 1; transform: scale(1.1) rotate(540deg); }
              80% { opacity: 0.6; transform: scale(0.9) rotate(720deg); }
            }
          `}</style>
          
          <div className="absolute inset-0 z-50 pointer-events-none" style={{ willChange: 'contents' }}>
            {/* 使用绿色背景以适配OBS抠像 */}
            <div className="absolute inset-0 bg-[#00FF00] animate-riichi-fullscreen-bg" style={{ willChange: 'opacity' }}></div>
            
            {/* 冲击波效果 - 使用玩家座风颜色 */}
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 rounded-full"
                style={{
                  width: '600px',
                  height: '300px',
                  borderColor: colors.primary,
                  borderWidth: '4px',
                  animation: `riichi-shockwave 1.5s ease-out ${i * 0.3}s forwards`,
                  transform: 'translate(-50%, -50%)',
                  willChange: 'transform, opacity',
                }}
              />
            ))}
            
            {/* 中心内容区域 - 使用GPU加速 */}
            <div 
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-riichi-fullscreen-scale"
              style={{ willChange: 'transform, opacity', transform: 'translate(-50%, -50%)' }}
            >
              <div className="relative flex flex-col items-center">
                {/* 上方闪电装饰 - 使用玩家座风颜色 */}
                <div 
                  className="text-7xl font-bold mb-4"
                  style={{
                    color: colors.primary,
                    textShadow: `0 0 30px ${colors.primary}, 0 0 60px ${colors.secondary}`,
                    animation: 'riichi-sparkle 1s ease-in-out 0.2s forwards',
                    opacity: 0,
                  }}
                >
                  ⚡
                </div>
                
                {/* 上方装饰线 - 使用玩家座风颜色 */}
                <div 
                  className={`h-[3px] bg-gradient-to-r from-transparent via-${colors.gradient.split(' ')[1]} via-white via-${colors.gradient.split(' ')[1]} to-transparent mb-8 animate-riichi-line-expand`}
                  style={{ 
                    width: '700px', 
                    willChange: 'width, opacity',
                    boxShadow: `0 0 20px ${colors.primary}`,
                    background: `linear-gradient(to right, transparent, ${colors.primary}, white, ${colors.primary}, transparent)`,
                  }}
                />
                
                {/* 玩家名称 - 增强效果 */}
                <div 
                  className="text-white text-7xl font-light tracking-[0.15em] text-center animate-riichi-text-reveal mb-2"
                  style={{
                    fontFamily: "'Noto Sans SC', 'Microsoft YaHei', sans-serif",
                    letterSpacing: '0.2em',
                    lineHeight: '1.2',
                    textShadow: '0 0 20px rgba(255, 255, 255, 0.8), 0 0 40px rgba(255, 200, 0, 0.6), 0 0 60px rgba(255, 100, 0, 0.4), 0 4px 8px rgba(0, 0, 0, 0.8)',
                    willChange: 'transform, opacity',
                    transform: 'translateZ(0)', // 强制GPU加速
                  }}
                >
                  {showRiichi.playerName}
                </div>
                
                {/* 立直文字 - 使用玩家座风颜色 */}
                <div 
                  className="text-center mt-6 animate-riichi-text-reveal relative"
                  style={{
                    fontFamily: "'Noto Sans SC', 'Microsoft YaHei Bold', sans-serif",
                    fontSize: '8rem',
                    fontWeight: 900,
                    letterSpacing: '0.3em',
                    lineHeight: '1',
                    background: `linear-gradient(180deg, #FFFFFF 0%, ${colors.primary} 30%, ${colors.secondary} 60%, ${colors.primary} 100%)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    textShadow: `0 0 30px ${colors.primary}, 0 0 60px ${colors.secondary}`,
                    willChange: 'transform, opacity',
                    transform: 'translateZ(0)', // 强制GPU加速
                    filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.8))',
                  }}
                >
                  {/* 文字发光效果 */}
                  <div 
                    className="absolute inset-0 text-center"
                    style={{
                      fontFamily: "'Noto Sans SC', 'Microsoft YaHei Bold', sans-serif",
                      fontSize: '8rem',
                      fontWeight: 900,
                      letterSpacing: '0.3em',
                      background: `linear-gradient(180deg, ${colors.primary} 0%, ${colors.secondary} 50%, ${colors.primary} 100%)`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      filter: 'blur(8px)',
                      opacity: 0.6,
                      zIndex: -1,
                    }}
                  >
                    立直
                  </div>
                  立直
                </div>
                
                {/* 下方装饰线 - 使用玩家座风颜色 */}
                <div 
                  className="h-[3px] mt-8 animate-riichi-line-expand"
                  style={{ 
                    width: '700px', 
                    willChange: 'width, opacity',
                    boxShadow: `0 0 20px ${colors.primary}`,
                    background: `linear-gradient(to right, transparent, ${colors.primary}, white, ${colors.primary}, transparent)`,
                  }}
                />
                
                {/* 下方闪电装饰 - 使用玩家座风颜色 */}
                <div 
                  className="text-7xl font-bold mt-4"
                  style={{
                    color: colors.primary,
                    textShadow: `0 0 30px ${colors.primary}, 0 0 60px ${colors.secondary}`,
                    animation: 'riichi-sparkle 1s ease-in-out 0.4s forwards',
                    opacity: 0,
                  }}
                >
                  ⚡
                </div>
              </div>
            </div>
          </div>
        </>
        );
      })()}

      </div>
    </>
  );
};
