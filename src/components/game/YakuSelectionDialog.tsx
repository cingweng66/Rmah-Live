import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { YAKU_DATA, YakuInfo } from '../../data/yakuData';
import { YakuItem } from '../../types/game';

interface YakuSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (selectedYaku: YakuItem[]) => void;
  dora?: number;
  uradora?: number;
  totalPoints?: number;
  basePoints?: number;
  honbaBonus?: number;
  riichiBonus?: number;
  han?: number; // 番数（用于特殊役种匹配）
  fu?: number; // 符数（用于特殊役种匹配）
}

export const YakuSelectionDialog: React.FC<YakuSelectionDialogProps> = ({
  open,
  onClose,
  onConfirm,
  dora = 0,
  uradora = 0,
  totalPoints = 0,
  basePoints = 0,
  honbaBonus = 0,
  riichiBonus = 0,
  han,
  fu,
}) => {
  const [selectedYaku, setSelectedYaku] = React.useState<string[]>([]);
  
  // 根据基础点数或番符组合估算可能的番数范围（用于过滤役种）
  const estimatedHanRange = React.useMemo(() => {
    // 如果提供了番数和符数，优先使用这些信息
    if (han !== undefined) {
      // 特殊役种匹配
      if (han >= 13) return { min: 13, max: 13 }; // 役满
      if (han >= 11) return { min: 11, max: 12 }; // 三倍满
      if (han >= 8) return { min: 8, max: 10 }; // 倍满
      if (han >= 6) return { min: 6, max: 7 }; // 跳满
      if (han === 5) return { min: 5, max: 5 }; // 满贯
      
      // 普通番数
      if (fu === 25) {
        // 25符固定对应七对子，至少2番
        return { min: 2, max: 4 };
      }
      
      // 其他情况，允许上下浮动1番
      return { 
        min: Math.max(1, han - 1), 
        max: Math.min(13, han + 1) 
      };
    }
    
    // 如果没有提供番数，根据基础点数估算
    if (basePoints === 0) return { min: 1, max: 13 }; // 如果没有基础点数，显示所有
    
    // 根据点数反推可能的番数范围
    // 满贯及以上
    if (basePoints >= 8000) {
      if (basePoints >= 32000) return { min: 13, max: 13 }; // 役满
      if (basePoints >= 24000) return { min: 11, max: 12 }; // 三倍满
      if (basePoints >= 16000) return { min: 8, max: 10 }; // 倍满
      if (basePoints >= 12000) return { min: 6, max: 7 }; // 跳满
      return { min: 5, max: 5 }; // 满贯
    }
    
    // 根据基础点数估算番数（简化算法）
    let estimatedHan = 1;
    if (basePoints >= 5800) estimatedHan = 3;
    else if (basePoints >= 2900) estimatedHan = 2;
    else if (basePoints >= 1500) estimatedHan = 1;
    
    // 允许上下浮动1-2番
    return { 
      min: Math.max(1, estimatedHan - 1), 
      max: Math.min(13, estimatedHan + 2) 
    };
  }, [basePoints, han, fu]);
  
  // 识别特殊役种并高亮匹配
  const specialYakuMatch = React.useMemo(() => {
    if (han === undefined || fu === undefined) return null;
    
    // 七对子：25符，至少2番
    if (fu === 25 && han >= 2 && han <= 4) {
      return { key: 'chiitoitsu', name: '七对子', han: 2 };
    }
    
    // 役满：13番及以上
    if (han >= 13) {
      // 返回所有役满役种
      return { type: 'yakuman', han: 13 };
    }
    
    // 三倍满：11-12番
    if (han >= 11 && han <= 12) {
      return { type: 'sanbaiman', han: 11 };
    }
    
    // 倍满：8-10番
    if (han >= 8 && han <= 10) {
      return { type: 'baiman', han: 8 };
    }
    
    // 跳满：6-7番
    if (han >= 6 && han <= 7) {
      return { type: 'haneman', han: 6 };
    }
    
    // 满贯：5番，或4番30符及以上，或3番70符及以上
    if (han === 5 || (han === 4 && fu >= 30) || (han === 3 && fu >= 70)) {
      return { type: 'mangan', han: 5 };
    }
    
    return null;
  }, [han, fu]);

  // 常见役种（1-2番）的key列表，优先显示
  const commonYakuKeys = React.useMemo(() => [
    'riichi', // 立直
    'tanyao', // 断幺九
    'pinfu', // 平和
    'yakuhai', // 役牌
    'iipeikou', // 一杯口
    'menzenchin_tsumohou', // 门前清自摸和
    'ippatsu', // 一发
    'toitoi', // 对对和
    'sanankou', // 三暗刻
    'double_riichi', // 双立直
  ], []);

  // 按翻数分组役种，同时保存key映射，常见役种优先，并根据点数过滤
  const yakuByHan = React.useMemo(() => {
    const grouped: Record<number, Array<YakuInfo & { key: string; isCommon?: boolean; isMatched?: boolean }>> = {};
    Object.entries(YAKU_DATA).forEach(([key, yaku]) => {
      // 根据估算的番数范围过滤役种
      if (yaku.han >= estimatedHanRange.min && yaku.han <= estimatedHanRange.max) {
        if (!grouped[yaku.han]) {
          grouped[yaku.han] = [];
        }
        
        // 检查是否匹配特殊役种
        let isMatched = false;
        if (specialYakuMatch) {
          if (specialYakuMatch.key && specialYakuMatch.key === key) {
            // 精确匹配（如七对子）
            isMatched = true;
          } else if (specialYakuMatch.type === 'yakuman' && yaku.han >= 13) {
            // 役满匹配
            isMatched = true;
          } else if (specialYakuMatch.type && yaku.han >= specialYakuMatch.han) {
            // 其他特殊役种（满贯、跳满、倍满、三倍满）
            isMatched = true;
          }
        }
        
        grouped[yaku.han].push({ 
          ...yaku, 
          key,
          isCommon: commonYakuKeys.includes(key) && (yaku.han === 1 || yaku.han === 2),
          isMatched
        });
      }
    });
    
    // 对每个翻数组内的役种排序：匹配的役种优先，然后常见役种
    Object.keys(grouped).forEach(hanStr => {
      grouped[parseInt(hanStr)].sort((a, b) => {
        if (a.isMatched && !b.isMatched) return -1;
        if (!a.isMatched && b.isMatched) return 1;
        if (a.isCommon && !b.isCommon) return -1;
        if (!a.isCommon && b.isCommon) return 1;
        return 0;
      });
    });
    
    return grouped;
  }, [commonYakuKeys, estimatedHanRange, specialYakuMatch]);

  const toggleYaku = (yakuKey: string) => {
    setSelectedYaku(prev => {
      if (prev.includes(yakuKey)) {
        return prev.filter(k => k !== yakuKey);
      } else {
        return [...prev, yakuKey];
      }
    });
  };

  const handleConfirm = () => {
    const yakuItems: YakuItem[] = selectedYaku.map(key => {
      const yaku = YAKU_DATA[key];
      if (!yaku) {
        // 如果找不到，返回null（会被过滤掉）
        return null;
      }
      return {
        name: yaku.name,
        han: yaku.han,
        closedOnly: yaku.closedOnly,
      } as YakuItem;
    }).filter((item): item is YakuItem => item !== null);
    onConfirm(yakuItems);
    setSelectedYaku([]);
  };

  const handleSkip = () => {
    onConfirm([]);
    setSelectedYaku([]);
  };

  // 计算总翻数
  const totalHan = selectedYaku.reduce((sum, key) => {
    const yaku = YAKU_DATA[key];
    return sum + (yaku?.han || 0);
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-white text-xl">选择役种</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4 mt-4 pr-2">
          {/* 点数组成信息 */}
          {totalPoints > 0 && (
            <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
              <div className="text-base font-bold text-white mb-3">点数组成</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">基础点数：</span>
                  <span className="text-base font-bold text-white">{basePoints.toLocaleString()}点</span>
                </div>
                {honbaBonus > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">本场追加：</span>
                    <span className="text-base font-bold text-yellow-400">+{honbaBonus.toLocaleString()}点</span>
                  </div>
                )}
                {riichiBonus > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">供托奖励：</span>
                    <span className="text-base font-bold text-orange-400">+{riichiBonus.toLocaleString()}点</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-slate-600">
                  <span className="text-base font-bold text-white">总计：</span>
                  <span className="text-2xl font-bold text-green-500">{totalPoints.toLocaleString()}点</span>
                </div>
              </div>
            </div>
          )}

          {/* 已选择信息 */}
          {selectedYaku.length > 0 && (
            <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
              <div className="text-base font-bold text-slate-300 mb-2">已选择：</div>
              <div className="flex flex-wrap gap-2">
                {selectedYaku.map(key => {
                  const yaku = YAKU_DATA[key];
                  return (
                    <Badge
                      key={key}
                      className="bg-blue-600 text-white text-sm px-3 py-1.5"
                    >
                      {yaku.name} {yaku.han}翻
                    </Badge>
                  );
                })}
              </div>
              <div className="mt-2 text-base font-bold text-yellow-400">
                总翻数：{totalHan}翻
                {dora > 0 && <span className="ml-2">+ ドラ{dora}</span>}
                {uradora > 0 && <span className="ml-2">+ 里ドラ{uradora}</span>}
              </div>
            </div>
          )}

          {/* 特殊役种提示 */}
          {specialYakuMatch && (
            <div className="bg-purple-700/30 rounded-lg p-3 border-2 border-purple-500/50">
              <div className="text-base font-bold text-purple-300 mb-1">
                {specialYakuMatch.key ? `匹配特殊役种：${specialYakuMatch.name}` : 
                 specialYakuMatch.type === 'yakuman' ? '匹配：役满' :
                 specialYakuMatch.type === 'sanbaiman' ? '匹配：三倍满' :
                 specialYakuMatch.type === 'baiman' ? '匹配：倍满' :
                 specialYakuMatch.type === 'haneman' ? '匹配：跳满' :
                 specialYakuMatch.type === 'mangan' ? '匹配：满贯' : '特殊役种'}
              </div>
              <div className="text-sm text-purple-200">
                {han !== undefined && fu !== undefined && (
                  <span>{han}番{fu > 0 ? `${fu}符` : ''} - 以下役种已高亮显示</span>
                )}
              </div>
            </div>
          )}

          {/* 役种列表 - 按翻数分组，1-2番优先显示 */}
          <div className="space-y-4">
            {(() => {
              const hanKeys = Object.keys(yakuByHan).map(k => parseInt(k));
              // 先显示1-2番，然后按翻数从高到低
              const sortedHanKeys = [
                ...hanKeys.filter(h => h === 1 || h === 2).sort((a, b) => a - b),
                ...hanKeys.filter(h => h !== 1 && h !== 2).sort((a, b) => b - a)
              ];
              
              return sortedHanKeys.map(han => {
                const yakus = yakuByHan[han];
                return (
                  <div key={han} className="space-y-2">
                    <div className="text-base font-bold text-slate-300 border-b border-slate-600 pb-2">
                      {han}翻役
                      {(han === 1 || han === 2) && (
                        <span className="ml-2 text-xs text-blue-400">（常见役种优先显示）</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {yakus.map((yaku) => {
                        const yakuKey = yaku.key;
                        const isSelected = selectedYaku.includes(yakuKey);
                        return (
                          <Button
                            key={yakuKey}
                            onClick={() => toggleYaku(yakuKey)}
                            className={`min-h-[80px] py-2.5 px-3 text-left transition-all flex flex-col justify-between ${
                              isSelected
                                ? 'bg-blue-600 text-white border-2 border-blue-400'
                                : yaku.isMatched
                                ? 'bg-purple-700 text-white hover:bg-purple-600 border-2 border-purple-400 ring-2 ring-purple-500/50'
                                : yaku.isCommon
                                ? 'bg-slate-700 text-white hover:bg-slate-600 border-2 border-blue-500/30'
                                : 'bg-slate-700 text-white hover:bg-slate-600 border border-slate-600'
                            }`}
                          >
                            <div className="flex items-start justify-between w-full gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium leading-tight break-words">{yaku.name}</div>
                                <div className="text-xs text-slate-400 mt-0.5 leading-tight break-words">
                                  {yaku.nameJa}
                                </div>
                              </div>
                              <div className="text-xs font-bold text-yellow-400 ml-1 shrink-0">
                                {yaku.han}翻
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1.5">
                              {yaku.isMatched && (
                                <div className="text-[10px] text-purple-300 leading-tight font-bold">匹配</div>
                              )}
                              {yaku.closedOnly && (
                                <div className="text-[10px] text-blue-300 leading-tight">门清</div>
                              )}
                              {yaku.isCommon && (
                                <div className="text-[10px] text-green-400 leading-tight">常见</div>
                              )}
                            </div>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </div>

        </div>
        
        {/* 操作按钮 - 固定在底部 */}
        <div className="flex-shrink-0 flex gap-3 pt-4 border-t border-slate-600 mt-4">
          <Button
            onClick={handleSkip}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-base py-3"
          >
            跳过（不显示役种）
          </Button>
          <Button
            onClick={handleConfirm}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-base py-3 font-bold"
            disabled={selectedYaku.length === 0}
          >
            确认（{selectedYaku.length > 0 ? `${totalHan}翻` : '未选择'}）
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
