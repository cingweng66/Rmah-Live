import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { websocketService } from '../services/websocket.service';
import api from '../services/api';

/**
 * Hook for public display mode (read-only)
 * Fetches initial state from API and connects via WebSocket in read-only mode
 */
export const usePublicDisplay = (gameId: string) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setState = useGameStore((state) => state.setState);

  useEffect(() => {
    if (!gameId) {
      console.warn('usePublicDisplay: gameId is empty');
      setError('房间号不能为空');
      setLoading(false);
      return;
    }

    console.log('usePublicDisplay: Starting for gameId:', gameId);

    // 1. 从 API 获取初始状态
    const fetchInitialState = async () => {
      try {
        console.log('usePublicDisplay: Fetching game state from API...');
        const response = await api.get(`/game/public/${gameId}`);
        console.log('usePublicDisplay: API response:', response.data);
        
        if (response.data?.state) {
          console.log('usePublicDisplay: Game state found, setting state');
          setState(response.data.state);
          setError(null); // 清除错误
        } else if (response.data?.message) {
          // 房间不存在或游戏未开始，但不一定是错误
          console.log('usePublicDisplay: Game state not found:', response.data.message);
          // 不设置错误，让页面显示等待状态
          setError(null);
        } else {
          // 没有状态，但不设置错误（等待游戏开始）
          console.log('usePublicDisplay: No state in response');
          setError(null);
        }
      } catch (err: any) {
        console.error('usePublicDisplay: Failed to fetch game state:', err);
        console.error('usePublicDisplay: Error details:', {
          status: err.response?.status,
          message: err.response?.data?.message,
          url: err.config?.url
        });
        
        // 如果是 404 或 401，说明房间不存在或未开始，但不阻止显示
        if (err.response?.status === 404 || err.response?.status === 401) {
          console.log('usePublicDisplay: Room not found or not started, waiting for game to start...');
          setError(null); // 不设置错误，让页面显示等待状态
        } else {
          // 只有真正的连接错误才显示错误
          const errorMessage = err.response?.data?.message || err.message || '无法连接到服务器';
          console.error('usePublicDisplay: Setting error:', errorMessage);
          setError(errorMessage);
        }
      } finally {
        console.log('usePublicDisplay: Setting loading to false');
        setLoading(false);
      }
    };

    // 2. 连接 WebSocket（只读模式）
    const connectWebSocket = () => {
      console.log('usePublicDisplay: Connecting WebSocket in read-only mode for gameId:', gameId);
      
      // 先断开现有连接（如果有）
      if (websocketService.isConnected()) {
        console.log('usePublicDisplay: Disconnecting existing WebSocket connection');
        websocketService.disconnect();
        // 等待断开完成
        setTimeout(() => {
          websocketService.connect(gameId, true); // readOnly = true
          setupWebSocketListeners();
        }, 100);
      } else {
        websocketService.connect(gameId, true); // readOnly = true
        setupWebSocketListeners();
      }
    };

    const setupWebSocketListeners = () => {
      websocketService.on('game-state', (state: any) => {
        console.log('usePublicDisplay: Received game state via WebSocket:', {
          hasState: !!state,
          isGameActive: state?.isGameActive,
          playersCount: state?.players?.length,
          roundWind: state?.roundWind,
          roundNumber: state?.roundNumber
        });
        if (state) {
          console.log('usePublicDisplay: Updating game state in store');
          setState(state);
        } else {
          console.log('usePublicDisplay: Received null state, game not started yet');
        }
      });

      websocketService.on('error', (err: any) => {
        console.error('usePublicDisplay: WebSocket error:', err);
        setError(err.message || 'WebSocket 连接错误');
      });
    };

    fetchInitialState();
    connectWebSocket();

    // 清理函数
    const handleGameStateUpdate = (state: any) => {
      if (state) {
        setState(state);
      }
    };
    
    const handleErrorUpdate = (err: any) => {
      console.error('WebSocket error:', err);
      setError(err.message || 'WebSocket 连接错误');
    };

    websocketService.on('game-state', handleGameStateUpdate);
    websocketService.on('error', handleErrorUpdate);

    return () => {
      websocketService.off('game-state', handleGameStateUpdate);
      websocketService.off('error', handleErrorUpdate);
      // 只在公开显示页面断开连接，控制面板页面不断开
      if (window.location.hash.includes('display-public')) {
        console.log('usePublicDisplay: Cleaning up WebSocket connection (public display page)');
        websocketService.disconnect();
      }
    };
  }, [gameId, setState]);

  return { loading, error };
};
