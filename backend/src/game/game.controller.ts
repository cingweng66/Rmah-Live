import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
} from '@nestjs/common';
import { GameService } from './services/game.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LicenseGuard } from '../auth/guards/license.guard';
import { UpdateGameStateDto } from './dto/update-game-state.dto';

@Controller('game')
export class GameController {
  constructor(private gameService: GameService) {}

  @Get()
  gameInfo() {
    return {
      message: '游戏 API 端点',
      endpoints: {
        'GET /game/public/:gameId': '获取游戏状态（公开，用于显示设备）',
        'GET /game/state/:gameId': '获取游戏状态（需要认证）',
        'POST /game/state': '更新游戏状态（需要认证）',
        'GET /game/sessions': '获取游戏会话列表（需要认证）',
      },
      websocket: 'ws://localhost:3000/game',
      note: '控制操作需要 JWT 认证和有效的 License，显示设备只需房间号',
    };
  }

  /**
   * 公开端点：显示设备使用，只需房间号
   */
  @Get('public/:gameId')
  async getPublicGameState(@Param('gameId') gameId: string) {
    const state = await this.gameService.getGameState(gameId);
    if (!state) {
      return {
        gameId,
        state: null,
        message: '房间不存在或游戏未开始',
      };
    }
    return { gameId, state };
  }

  /**
   * 需要认证的端点：控制设备使用
   */
  @Get('state/:gameId')
  @UseGuards(JwtAuthGuard, LicenseGuard)
  async getGameState(@Param('gameId') gameId: string) {
    const state = await this.gameService.getGameState(gameId);
    return { gameId, state };
  }

  @Post('state')
  @UseGuards(JwtAuthGuard, LicenseGuard)
  async updateGameState(
    @Body() updateDto: UpdateGameStateDto,
    @Request() req,
  ) {
    await this.gameService.updateGameState(
      updateDto.gameId,
      req.user.id,
      updateDto.state,
    );
    return { message: 'Game state updated successfully' };
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard, LicenseGuard)
  async getUserSessions(@Request() req) {
    const sessions = await this.gameService.getUserSessions(req.user.id);
    return { sessions };
  }

  @Post('session/:gameId/delete')
  @UseGuards(JwtAuthGuard, LicenseGuard)
  async deleteSession(
    @Param('gameId') gameId: string,
    @Request() req,
  ) {
    await this.gameService.deleteSession(gameId, req.user.id);
    return { message: 'Session deleted successfully' };
  }

  /**
   * 创建新房间
   */
  @Post('room/create')
  @UseGuards(JwtAuthGuard, LicenseGuard)
  async createRoom(
    @Body() body: { roomName?: string },
    @Request() req,
  ) {
    const { gameId, session } = await this.gameService.createRoom(req.user.id, body.roomName);
    return {
      message: 'Room created successfully',
      gameId,
      session: {
        id: session.id,
        gameId: session.gameId,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    };
  }

  /**
   * 切换房间
   */
  @Post('room/switch')
  @UseGuards(JwtAuthGuard, LicenseGuard)
  async switchRoom(
    @Body() body: { gameId: string },
    @Request() req,
  ) {
    const { gameId, state } = await this.gameService.switchRoom(body.gameId, req.user.id);
    return {
      message: 'Room switched successfully',
      gameId,
      state,
    };
  }

  /**
   * 获取房间日志
   */
  @Get('room/:gameId/logs')
  @UseGuards(JwtAuthGuard, LicenseGuard)
  async getRoomLogs(
    @Param('gameId') gameId: string,
    @Request() req,
  ) {
    const logs = await this.gameService.getRoomLogs(gameId);
    return {
      gameId,
      logs: logs.map(log => ({
        id: log.id,
        stateData: log.stateData,
        timestamp: log.timestamp,
      })),
    };
  }

  /**
   * 获取所有房间列表
   */
  @Get('rooms')
  @UseGuards(JwtAuthGuard, LicenseGuard)
  async getAllRooms(@Request() req) {
    const rooms = await this.gameService.getAllRooms();
    return {
      rooms: rooms.map(room => ({
        id: room.id,
        gameId: room.gameId,
        userId: room.userId,
        userEmail: room.user?.email || 'Unknown',
        hasState: !!room.currentState,
        isGameActive: room.currentState?.isGameActive || false,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
      })),
    };
  }
}
