import React from 'react';

type ThemeColor = {
  primary: string;   // e.g. 'bg-yellow-500'
  secondary?: string; // e.g. 'from-slate-900 via-slate-800 to-slate-900'
};

type Props = {
  playerName: string;
  teamName: string;
  score: number | string;
  isDealer?: boolean;
  avatarUrl?: string;
  themeColor?: ThemeColor;
};

/**
 * 可复用的麻将玩家卡片（布局与界面3一致，支持动态队伍主题色）
 */
export const MahjongPlayerCard: React.FC<Props> = ({
  playerName,
  teamName,
  score,
  isDealer = false,
  avatarUrl,
  themeColor,
}) => {
  const primary = themeColor?.primary ?? 'bg-slate-800';
  const secondary = themeColor?.secondary ?? 'from-slate-950 via-slate-900 to-slate-950';

  return (
    <div className="relative flex w-[400px] h-[140px] rounded-xl overflow-hidden shadow-lg">
      <div className={`absolute inset-0 bg-gradient-to-r ${secondary}`} />

      {/* 左侧头像区 */}
      <div className="relative z-10 w-[120px] h-full overflow-hidden">
        {avatarUrl ? (
          <img src={avatarUrl} alt={playerName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-slate-800 flex items-center justify-center text-white text-xl font-bold">
            {playerName.slice(0, 1)}
          </div>
        )}
      </div>

      {/* 右侧信息 */}
      <div className="relative z-10 flex-1 flex flex-col justify-between items-end bg-black/20">
        <div className="pt-4 pr-4 text-right">
          <div className="font-medium tracking-wider text-gray-300 uppercase" style={{ fontSize: '21px' }}>
            {teamName || 'TEAM'}
          </div>
          <div className="font-bold text-white" style={{ fontSize: '33px' }}>{playerName || 'Player'}</div>
        </div>

        <div
          className={`w-full h-[50px] flex items-center justify-center relative ${primary} ${
            isDealer ? 'border-b-4 border-red-500' : ''
          }`}
        >
          <span className="font-black text-white tracking-widest tabular-nums" style={{ fontSize: '48px' }}>
            {typeof score === 'number' ? score.toLocaleString() : score}
          </span>
        </div>
      </div>
    </div>
  );
};

