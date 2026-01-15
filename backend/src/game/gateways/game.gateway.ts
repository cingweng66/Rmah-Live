import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { GameService } from '../services/game.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    credentials: true,
  },
  namespace: '/game',
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private jwtService: JwtService;
  private gameService: GameService;

  constructor(jwtService: JwtService, gameService: GameService) {
    this.jwtService = jwtService;
    this.gameService = gameService;
  }

  /**
   * 处理 WebSocket 连接
   * 支持两种模式：
   * 1. 认证模式（控制设备）：需要 JWT token，可以更新游戏状态
   * 2. 匿名模式（显示设备）：只需房间号，只能接收状态更新
   */
  async handleConnection(client: Socket) {
    try {
      console.log('WebSocket connection attempt:', {
        id: client.id,
        auth: client.handshake.auth,
        query: client.handshake.query,
        headers: Object.keys(client.handshake.headers),
      });

      // 从查询参数或授权头获取 token
      const token =
        client.handshake.auth?.token ||
        client.handshake.query?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      console.log('Token found:', !!token, token ? `${token.substring(0, 20)}...` : 'none');

      if (token) {
        // 认证模式：控制设备
        try {
          const payload = this.jwtService.verify(token);
          client.data.userId = payload.sub;
          client.data.userEmail = payload.email;
          client.data.isReadOnly = false; // 可以更新状态
          console.log(`Control client connected: ${client.id} (User: ${payload.email})`);
        } catch (error) {
          console.error('Invalid token:', error);
          console.error('Token verification failed:', error.message);
          client.emit('error', { message: 'Invalid token', error: error.message });
          client.disconnect();
          return;
        }
      } else {
        // 匿名模式：显示设备（只读）
        client.data.isReadOnly = true;
        console.log(`Display client connected: ${client.id} (Read-only)`);
      }
    } catch (error) {
      console.error('WebSocket connection error:', error);
      console.error('Error details:', error.message, error.stack);
      client.emit('error', { message: 'Connection error', error: error.message });
      client.disconnect();
    }
  }

  /**
   * 处理 WebSocket 断开连接
   */
  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    // 清理房间
    const rooms = Array.from(client.rooms);
    rooms.forEach((room) => {
      if (room !== client.id) {
        client.leave(room);
      }
    });
  }

  /**
   * 加入游戏房间
   * 支持认证和匿名两种模式
   */
  @SubscribeMessage('join-game')
  async handleJoinGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string },
  ) {
    const room = `game-${data.gameId}`;
    await client.join(room);

    // 发送当前游戏状态
    const currentState = await this.gameService.getGameState(data.gameId);
    if (currentState) {
      client.emit('game-state', currentState);
    } else {
      client.emit('game-state', null);
    }

    if (client.data.isReadOnly) {
      console.log(`Display client ${client.id} joined room: ${room}`);
    } else {
      console.log(`Control client ${client.data.userId} joined room: ${room}`);
    }
  }

  /**
   * 离开游戏房间
   */
  @SubscribeMessage('leave-game')
  async handleLeaveGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string },
  ) {
    const room = `game-${data.gameId}`;
    await client.leave(room);
    console.log(`User ${client.data.userId} left room: ${room}`);
  }

  /**
   * 更新游戏状态
   * 只有认证的控制设备可以更新
   */
  @SubscribeMessage('game-update')
  async handleGameUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; state: any },
  ) {
    // 只读客户端不能更新状态
    if (client.data.isReadOnly || !client.data.userId) {
      client.emit('error', { message: 'Unauthorized: Read-only clients cannot update game state' });
      return;
    }

    try {
      // 保存游戏状态
      await this.gameService.updateGameState(
        data.gameId,
        client.data.userId,
        data.state,
      );

      // 广播给房间内所有客户端（包括只读的显示设备）
      const room = `game-${data.gameId}`;
      this.server.to(room).emit('game-state', data.state);

      console.log(`Game state updated for room: ${room} by user ${client.data.userId}`);
    } catch (error) {
      console.error('Error updating game state:', error);
      client.emit('error', { message: 'Failed to update game state' });
    }
  }
}
