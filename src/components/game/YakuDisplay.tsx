import React from 'react';
import { HandResult } from '../../types/game';
import { getYakuInfo } from '../../data/yakuData';

interface YakuDisplayProps {
  handResult: HandResult;
  playerName?: string;
  position?: 'center' | 'player'; // 显示位置：屏幕中央或玩家头像上方
  onClose?: () => void; // 关闭回调
}

export const YakuDisplay: React.FC<YakuDisplayProps> = ({
  handResult,
  playerName,
  position = 'center',
  onClose,
}) => {
  const { yakuList, fu, han, dora, uradora, points } = handResult;

  // 计算役种总翻数（不含ドラ）
  const yakuHan = yakuList.reduce((sum, yaku) => sum + yaku.han, 0);
  
  // 如果没有役种，不显示
  if (yakuList.length === 0) {
    return null;
  }

  // 获取役种详细信息
  const yakuDetails = yakuList.map(yaku => {
    const info = getYakuInfo(yaku.name);
    return {
      ...yaku,
      info,
      displayName: info?.name || yaku.name,
      displayNameJa: info?.nameJa || yaku.name,
    };
  });

  // 根据位置决定样式
  const isCenter = position === 'center';
  
  const containerStyle: React.CSSProperties = {
    position: isCenter ? 'fixed' : 'absolute',
    top: isCenter ? '50%' : 'auto',
    left: isCenter ? '50%' : 'auto',
    transform: isCenter ? 'translate(-50%, -50%)' : 'none',
    zIndex: 1000,
    animation: 'yaku-fade-in 0.4s ease-out forwards',
  };

  const contentStyle: React.CSSProperties = {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(10px)',
    borderRadius: '12px',
    padding: isCenter ? '32px 40px' : '20px 24px',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
    minWidth: isCenter ? '600px' : '400px',
    maxWidth: isCenter ? '800px' : '500px',
  };

  return (
    <>
      <style>{`
        @keyframes yaku-fade-in {
          from {
            opacity: 0;
            transform: ${isCenter ? 'translate(-50%, -50%) scale(0.9)' : 'translateY(-10px) scale(0.9)'};
          }
          to {
            opacity: 1;
            transform: ${isCenter ? 'translate(-50%, -50%) scale(1)' : 'translateY(0) scale(1)'};
          }
        }
        @keyframes yaku-item-in {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .yaku-item {
          animation: yaku-item-in 0.3s ease-out forwards;
          opacity: 0;
        }
      `}</style>
      
      {/* 背景遮罩（仅中央显示时） */}
      {isCenter && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            zIndex: 999,
            animation: 'yaku-fade-in 0.4s ease-out forwards',
          }}
          onClick={onClose}
        />
      )}

      <div style={containerStyle}>
        <div style={contentStyle}>
          {/* 玩家名称（如果有） */}
          {playerName && (
            <div
              style={{
                fontSize: isCenter ? '28px' : '20px',
                fontWeight: 'bold',
                color: '#FFD700',
                marginBottom: '16px',
                textAlign: 'center',
              }}
            >
              {playerName}
            </div>
          )}

          {/* 役种列表 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginBottom: '20px',
            }}
          >
            {yakuDetails.map((yaku, index) => (
              <div
                key={index}
                className="yaku-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  animationDelay: `${index * 0.1}s`,
                }}
              >
                {/* 役种名称 */}
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span
                    style={{
                      fontSize: isCenter ? '24px' : '18px',
                      fontWeight: 'bold',
                      color: '#FFFFFF',
                      textShadow: '0 2px 4px rgba(0, 0, 0, 0.8)',
                    }}
                  >
                    {yaku.displayName}
                  </span>
                  {yaku.closedOnly && (
                    <span
                      style={{
                        fontSize: isCenter ? '14px' : '12px',
                        color: '#FFD700',
                        backgroundColor: 'rgba(255, 215, 0, 0.2)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      门清
                    </span>
                  )}
                </div>

                {/* 翻数 */}
                <div
                  style={{
                    fontSize: isCenter ? '20px' : '16px',
                    fontWeight: 'bold',
                    color: '#FFD700',
                    minWidth: '40px',
                    textAlign: 'right',
                  }}
                >
                  {yaku.han}翻
                </div>
              </div>
            ))}
          </div>

          {/* 分隔线 */}
          <div
            style={{
              height: '1px',
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
              margin: '16px 0',
            }}
          />

          {/* 符/翻/ドラ/点数信息 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: isCenter ? '20px' : '16px',
              color: '#FFFFFF',
            }}
          >
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <span>
                <span style={{ color: '#AAAAAA' }}>符</span>
                <span style={{ fontWeight: 'bold', marginLeft: '4px' }}>{fu}</span>
              </span>
              <span>
                <span style={{ color: '#AAAAAA' }}>翻</span>
                <span style={{ fontWeight: 'bold', marginLeft: '4px' }}>{han}</span>
              </span>
              {dora > 0 && (
                <span>
                  <span style={{ color: '#FFD700' }}>ドラ</span>
                  <span style={{ fontWeight: 'bold', marginLeft: '4px', color: '#FFD700' }}>
                    {dora}
                  </span>
                </span>
              )}
              {uradora !== undefined && uradora > 0 && (
                <span>
                  <span style={{ color: '#FFD700' }}>里ドラ</span>
                  <span style={{ fontWeight: 'bold', marginLeft: '4px', color: '#FFD700' }}>
                    {uradora}
                  </span>
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: isCenter ? '28px' : '22px',
                fontWeight: 'bold',
                color: '#FFD700',
              }}
            >
              {points.toLocaleString()}点
            </div>
          </div>

          {/* 关闭按钮（仅中央显示时） */}
          {isCenter && onClose && (
            <div
              style={{
                marginTop: '20px',
                textAlign: 'center',
              }}
            >
              <button
                onClick={onClose}
                style={{
                  padding: '8px 24px',
                  fontSize: '16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                关闭
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
