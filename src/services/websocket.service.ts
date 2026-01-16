import { io, Socket } from 'socket.io-client';
import { GameState } from '../types/game';

// 自动检测协议：如果 VITE_WS_URL 未设置，从 VITE_API_URL 推断，或使用默认值
const getWebSocketUrl = () => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  // 如果设置了 API URL，自动转换为 WebSocket URL
  if (import.meta.env.VITE_API_URL) {
    const apiUrl = import.meta.env.VITE_API_URL;
    // 将 http:// 转换为 ws://，https:// 转换为 wss://
    if (apiUrl.startsWith('https://')) {
      return apiUrl.replace('https://', 'wss://');
    } else if (apiUrl.startsWith('http://')) {
      return apiUrl.replace('http://', 'ws://');
    }
    return apiUrl; // 如果已经包含协议，直接返回
  }
  // 默认值使用 ws:// 协议
  return 'ws://localhost:3000';
};

const WS_URL = getWebSocketUrl();

class WebSocketService {
  private socket: Socket | null = null;
  private gameId: string = 'default';
  private readOnly: boolean = false;
  private listeners: Map<string, Set<Function>> = new Map();

  /**
   * 初始化 WebSocket 连接
   * @param gameId 游戏房间ID
   * @param readOnly 是否为只读模式（显示设备使用，不需要认证）
   */
  connect(gameId: string = 'default', readOnly: boolean = false): void {
    // 如果已经连接到相同的 gameId 和模式，不重新连接
    if (this.socket?.connected && this.gameId === gameId && this.readOnly === readOnly) {
      console.log('WebSocket already connected with same parameters, skipping reconnect');
      return;
    }

    // 如果已连接但参数不同，先断开并清理
    if (this.socket) {
      console.log('WebSocket parameters changed or reconnecting, disconnecting old connection');
      // 移除所有事件监听器
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.gameId = gameId;
    this.readOnly = readOnly;
    const token = localStorage.getItem('authToken');

    // 只读模式不需要 token
    if (!readOnly && !token) {
      console.error('No auth token found for control mode');
      return;
    }

    const socketOptions: any = {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    };

    // 只读模式：添加 readOnly 查询参数，不需要 token
    if (readOnly) {
      socketOptions.query = { readOnly: 'true', gameId: this.gameId };
    } else if (token) {
      // 控制模式：需要 token
      socketOptions.auth = { token };
      socketOptions.query = { gameId: this.gameId };
    }

    console.log('Creating new WebSocket connection...', { gameId, readOnly, hasToken: !!token });
    this.socket = io(`${WS_URL}/game`, socketOptions);

    // 连接成功
    this.socket.on('connect', () => {
      console.log(`WebSocket connected (${readOnly ? 'Read-only' : 'Control'} mode)`, {
        socketId: this.socket?.id,
        gameId: this.gameId
      });
      // 加入游戏房间
      if (this.socket?.connected) {
        this.socket.emit('join-game', { gameId: this.gameId });
      }
    });

    // 断开连接
    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected', { reason, gameId: this.gameId });
    });

    // 连接错误
    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    // 监听游戏状态更新
    this.socket.on('game-state', (state: GameState | null) => {
      this.emit('game-state', state);
    });

    // 监听错误
    this.socket.on('error', (error: any) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    });
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.emit('leave-game', { gameId: this.gameId });
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * 发送游戏状态更新
   */
  updateGameState(state: GameState): void {
    // 只读模式不能更新状态
    if (this.readOnly) {
      console.warn('Attempted to update game state in read-only mode, ignoring');
      return;
    }
    
    if (this.socket?.connected) {
      this.socket.emit('game-update', {
        gameId: this.gameId,
        state,
      });
    } else {
      console.warn('WebSocket not connected, cannot update game state');
    }
  }

  /**
   * 订阅事件
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  /**
   * 取消订阅
   */
  off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * 触发事件
   */
  private emit(event: string, data: any): void {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * 获取当前 gameId
   */
  getGameId(): string {
    return this.gameId;
  }

  /**
   * 检查是否为只读模式
   */
  isReadOnlyMode(): boolean {
    return this.readOnly;
  }
}

export const websocketService = new WebSocketService();
