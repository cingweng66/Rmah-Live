import React from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { YAKU_DATA } from '../../data/yakuData';

interface ScoringTableProps {
  isDealer: boolean;
  method: 'ron' | 'tsumo';
  onSelectPoints: (han: number, fu: number, points: number) => void;
  selectedHan?: number;
  selectedFu?: number;
}

export const ScoringTable: React.FC<ScoringTableProps> = ({
  isDealer,
  method,
  onSelectPoints,
  selectedHan,
  selectedFu,
}) => {
  // 日本麻将M规点数计算函数（含切上满贯）
  const calculatePoints = (han: number, fu: number): number => {
    // 特殊役满和倍满
    if (han >= 13) return isDealer ? 48000 : 32000; // 役满
    if (han >= 11) return isDealer ? 36000 : 24000; // 三倍满
    if (han >= 8) return isDealer ? 24000 : 16000;  // 倍满
    if (han >= 6) return isDealer ? 18000 : 12000;  // 跳满
    
    // 满贯判定（M规切上满贯：4番30符起按满贯计）
    if (han >= 5 || (han === 4 && fu >= 30) || (han === 3 && fu >= 70)) {
      if (method === 'ron') {
        return isDealer ? 12000 : 8000; // 满贯荣和
      } else {
        // 满贯自摸
        if (isDealer) {
          return 4000; // 庄家自摸：4000 ALL
        } else {
          return 4000; // 子家自摸：其他子家支付4000（庄家支付2000），返回子家支付点数用于onSelectPoints
        }
      }
    }
    
    // 基础点数计算
    const basePoints = fu * Math.pow(2, han + 2);
    
    if (method === 'ron') {
      const multiplier = isDealer ? 6 : 4;
      return Math.ceil((basePoints * multiplier) / 100) * 100;
    } else {
      // 自摸时返回其他子家每人支付的点数
      if (isDealer) {
        // 庄家自摸：每人支付 base × 2
        return Math.ceil((basePoints * 2) / 100) * 100;
      } else {
        // 子家自摸：其他子家支付 base × 2，庄家支付 base × 1
        // 返回子家支付的点数（base × 2）
        return Math.ceil((basePoints * 2) / 100) * 100;
      }
    }
  };

  // 匹配特殊役种（根据番符组合）
  const matchSpecialYaku = (han: number, fu: number): string[] => {
    const matches: string[] = [];
    
    // 七对子：2番25符
    if (han === 2 && fu === 25) {
      matches.push('七对子（2番25符）');
    }
    
    // 国士无双：13番（役满）
    if (han >= 13) {
      matches.push('国士无双（役满）');
    }
    
    // 十三么：国士无双的另一种称呼
    if (han >= 13) {
      matches.push('十三么（役满）');
    }
    
    // 其他役满
    if (han >= 13) {
      const yakumanYaku = Object.entries(YAKU_DATA).filter(([_, yaku]) => yaku.han >= 13);
      if (yakumanYaku.length > 0) {
        matches.push(`役满（${yakumanYaku.length}种）`);
      }
    }
    
    return matches;
  };

  // 判断某个番符组合是否有效（M规规则）
  const isValidCombination = (han: number, fu: number): boolean => {
    // 20符：只能是门清平和自摸，至少2番，且荣和不存在20符
    if (fu === 20) {
      if (method === 'ron') return false; // 荣和不存在20符
      // 自摸：只有2-4番（没有1番20符）
      return han >= 2 && han <= 4;
    }
    // 25符：只能是七对子，至少2番（没有1番25符）
    if (fu === 25) {
      // 荣和和自摸都至少2番
      return han >= 2 && han <= 4;
    }
    // 30符、40符、50符：1-4番都有效
    return han >= 1 && han <= 4;
  };

  return (
    <div className="space-y-2">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <Badge className="bg-indigo-500 text-white text-xs">
          {method === 'ron' ? '荣和点数表' : '自摸点数表'}
        </Badge>
        <span className="text-xs text-slate-400">
          {isDealer ? '庄家' : '子家'} · 点击选择
        </span>
      </div>

      {/* 点数表格 - 纵向符数，横向番数 */}
      <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-600">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-600">
                <th className="text-left text-slate-400 pb-1 pr-2">符/番</th>
                {[1, 2, 3, 4].map((han) => (
                  <th key={han} className="text-center text-slate-400 pb-1 px-1">
                    {han}番
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[20, 25, 30, 40, 50].map((fu) => (
                <tr key={fu} className="border-b border-slate-700/50">
                  <td className="text-left text-white font-medium py-1 pr-2">
                    {fu}符
                  </td>
                  {[1, 2, 3, 4].map((han) => {
                    const isValid = isValidCombination(han, fu);
                    if (!isValid) {
                      return (
                        <td key={han} className="text-center py-1 px-1">
                          <span className="text-slate-600">-</span>
                        </td>
                      );
                    }
                    
                    // 计算点数
                    let displayText = '';
                    if (method === 'ron') {
                      const points = calculatePoints(han, fu);
                      displayText = points.toLocaleString();
                    } else {
                      // 自摸：需要显示完整信息
                      // 检查是否是满贯及以上
                      const isManganOrMore = han >= 5 || (han === 4 && fu >= 30) || (han === 3 && fu >= 70);
                      if (isManganOrMore) {
                        // 满贯及以上
                        if (isDealer) {
                          const each = han >= 13 ? 16000 : han >= 11 ? 12000 : han >= 8 ? 8000 : han >= 6 ? 6000 : 4000;
                          displayText = `${each.toLocaleString()} ALL`;
                        } else {
                          // 子家自摸满贯及以上：显示为 子家/庄家，例如 2000/4000（根据表格，子家支付2000，庄家支付4000）
                          const childPays = han >= 13 ? 8000 : han >= 11 ? 6000 : han >= 8 ? 4000 : han >= 6 ? 3000 : 2000;
                          const dealerPays = han >= 13 ? 16000 : han >= 11 ? 12000 : han >= 8 ? 8000 : han >= 6 ? 6000 : 4000;
                          displayText = `${childPays.toLocaleString()}/${dealerPays.toLocaleString()}`;
                        }
                      } else {
                        // 普通自摸
                        const basePoints = fu * Math.pow(2, han + 2);
                        if (isDealer) {
                          // 庄家自摸：每人支付 base × 2
                          const each = Math.ceil((basePoints * 2) / 100) * 100;
                          displayText = `${each.toLocaleString()} ALL`;
                        } else {
                          // 子家自摸：庄家支付 base × 2，子家支付 base × 1
                          // 显示格式：子家/庄家（例如：300/500）- 根据表格 (300/500) 表示子家支付300，庄家支付500
                          const childPays = Math.ceil(basePoints / 100) * 100;       // 子家支付（较小）
                          const dealerPays = Math.ceil((basePoints * 2) / 100) * 100;  // 庄家支付（较大）
                          displayText = `${childPays.toLocaleString()}/${dealerPays.toLocaleString()}`;
                        }
                      }
                    }
                    
                    const isSelected = selectedHan === han && selectedFu === fu;
                    const points = calculatePoints(han, fu);
                    const specialYaku = matchSpecialYaku(han, fu);
                    const hasSpecialYaku = specialYaku.length > 0;
                    
                    return (
                      <td key={han} className="text-center py-1 px-1">
                        <button
                          onClick={() => onSelectPoints(han, fu, points)}
                          className={`px-2 py-1 rounded text-xs font-medium transition-all whitespace-nowrap ${
                            isSelected
                              ? 'bg-blue-600 text-white ring-1 ring-blue-400'
                              : hasSpecialYaku
                              ? 'bg-purple-700 text-white hover:bg-purple-600'
                              : 'bg-slate-700 text-white hover:bg-slate-600'
                          }`}
                          title={hasSpecialYaku ? `特殊役种：${specialYaku.join('、')}` : ''}
                        >
                          {displayText}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* 特殊役种行 */}
              <tr>
                <td className="text-left text-white font-medium py-1 pr-2 text-slate-400">
                  特殊
                </td>
                <td colSpan={4} className="py-1 px-1">
                  <div className="grid grid-cols-5 gap-1">
                    <button
                      onClick={() => onSelectPoints(5, 0, isDealer ? 12000 : 8000)}
                      className={`px-1.5 py-1 rounded text-xs font-medium transition-all whitespace-nowrap ${
                        selectedHan === 5 && selectedFu === 0
                          ? 'bg-blue-600 text-white ring-1 ring-blue-400'
                          : 'bg-slate-700 text-white hover:bg-slate-600'
                      }`}
                    >
                      满贯
                    </button>
                    <button
                      onClick={() => onSelectPoints(6, 0, isDealer ? 18000 : 12000)}
                      className={`px-1.5 py-1 rounded text-xs font-medium transition-all whitespace-nowrap ${
                        selectedHan === 6 && selectedFu === 0
                          ? 'bg-blue-600 text-white ring-1 ring-blue-400'
                          : 'bg-slate-700 text-white hover:bg-slate-600'
                      }`}
                    >
                      跳满
                    </button>
                    <button
                      onClick={() => onSelectPoints(8, 0, isDealer ? 24000 : 16000)}
                      className={`px-1.5 py-1 rounded text-xs font-medium transition-all whitespace-nowrap ${
                        selectedHan === 8 && selectedFu === 0
                          ? 'bg-blue-600 text-white ring-1 ring-blue-400'
                          : 'bg-slate-700 text-white hover:bg-slate-600'
                      }`}
                    >
                      倍满
                    </button>
                    <button
                      onClick={() => onSelectPoints(11, 0, isDealer ? 36000 : 24000)}
                      className={`px-1.5 py-1 rounded text-xs font-medium transition-all whitespace-nowrap ${
                        selectedHan === 11 && selectedFu === 0
                          ? 'bg-blue-600 text-white ring-1 ring-blue-400'
                          : 'bg-slate-700 text-white hover:bg-slate-600'
                      }`}
                    >
                      三倍满
                    </button>
                    <button
                      onClick={() => onSelectPoints(13, 0, isDealer ? 48000 : 32000)}
                      className={`px-1.5 py-1 rounded text-xs font-medium transition-all whitespace-nowrap ${
                        selectedHan === 13 && selectedFu === 0
                          ? 'bg-blue-600 text-white ring-1 ring-blue-400'
                          : 'bg-slate-700 text-white hover:bg-slate-600'
                      }`}
                    >
                      役满
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 说明 */}
      <div className="text-xs text-slate-400 bg-slate-800/30 rounded p-1.5 space-y-0.5">
        {method === 'ron' ? (
          <>
            <div className="font-medium text-slate-300">荣和点数</div>
            <div>表格显示获胜者从放铳者获得的点数（不含本场和供托）</div>
          </>
        ) : (
          <>
            <div className="font-medium text-slate-300">自摸点数显示格式</div>
            {isDealer ? (
              <div><span className="text-blue-400 font-mono">4000 ALL</span> = 三家各支付 4000点</div>
            ) : (
              <div><span className="text-blue-400 font-mono">300/500</span> = 其余两家各支付 300点，庄家支付 500点</div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
