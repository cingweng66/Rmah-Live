import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameSession } from '../entities/game-session.entity';
import { GameState } from '../entities/game-state.entity';

@Injectable()
export class GameService {
  constructor(
    @InjectRepository(GameSession)
    private gameSessionRepository: Repository<GameSession>,
    @InjectRepository(GameState)
    private gameStateRepository: Repository<GameState>,
  ) {}

  /**
   * 获取或创建游戏会话
   */
  async getOrCreateSession(gameId: string, userId: string): Promise<GameSession> {
    let session = await this.gameSessionRepository.findOne({
      where: { gameId, userId, isActive: true },
    });

    if (!session) {
      session = this.gameSessionRepository.create({
        gameId,
        userId,
        isActive: true,
      });
      session = await this.gameSessionRepository.save(session);
    }

    return session;
  }

  /**
   * 获取游戏状态
   */
  async getGameState(gameId: string): Promise<any | null> {
    const session = await this.gameSessionRepository.findOne({
      where: { gameId, isActive: true },
      order: { updatedAt: 'DESC' },
    });

    return session?.currentState || null;
  }

  /**
   * 更新游戏状态
   */
  async updateGameState(
    gameId: string,
    userId: string,
    state: any,
  ): Promise<void> {
    // 获取或创建会话
    const session = await this.getOrCreateSession(gameId, userId);

    // 更新会话的当前状态
    session.currentState = state;
    await this.gameSessionRepository.save(session);

    // 保存状态历史（可选，用于回放）
    const stateRecord = this.gameStateRepository.create({
      sessionId: session.id,
      stateData: state,
    });
    await this.gameStateRepository.save(stateRecord);
  }

  /**
   * 获取游戏会话列表
   */
  async getUserSessions(userId: string): Promise<GameSession[]> {
    return await this.gameSessionRepository.find({
      where: { userId, isActive: true },
      order: { updatedAt: 'DESC' },
    });
  }

  /**
   * 删除游戏会话
   */
  async deleteSession(gameId: string, userId: string): Promise<void> {
    await this.gameSessionRepository.update(
      { gameId, userId },
      { isActive: false },
    );
  }

  /**
   * 创建新房间（生成6位数字房间号）
   */
  async createRoom(userId: string, roomName?: string): Promise<{ gameId: string; session: GameSession }> {
    let gameId: string;
    let exists = true;
    
    // 生成唯一的6位数字房间号
    while (exists) {
      gameId = String(Math.floor(100000 + Math.random() * 900000));
      const existing = await this.gameSessionRepository.findOne({
        where: { gameId, isActive: true },
      });
      exists = !!existing;
    }

    // 创建新会话
    const session = this.gameSessionRepository.create({
      gameId,
      userId,
      isActive: true,
      currentState: null, // 初始状态为空
    });
    
    const savedSession = await this.gameSessionRepository.save(session);
    return { gameId, session: savedSession };
  }

  /**
   * 切换房间（加载房间状态）
   */
  async switchRoom(gameId: string, userId: string): Promise<{ gameId: string; state: any }> {
    const session = await this.gameSessionRepository.findOne({
      where: { gameId, isActive: true },
      order: { updatedAt: 'DESC' },
    });

    if (!session) {
      throw new Error('房间不存在');
    }

    // 如果会话不属于当前用户，创建一个新的会话记录（但使用相同的 gameId）
    if (session.userId !== userId) {
      // 检查用户是否已有该房间的会话
      let userSession = await this.gameSessionRepository.findOne({
        where: { gameId, userId, isActive: true },
      });

      if (!userSession) {
        // 创建新会话，但使用相同的 gameId（共享房间）
        userSession = this.gameSessionRepository.create({
          gameId,
          userId,
          isActive: true,
          currentState: session.currentState, // 复制当前状态
        });
        await this.gameSessionRepository.save(userSession);
      }
    }

    return {
      gameId,
      state: session.currentState,
    };
  }

  /**
   * 获取房间日志（状态历史）
   */
  async getRoomLogs(gameId: string, limit: number = 100): Promise<GameState[]> {
    const session = await this.gameSessionRepository.findOne({
      where: { gameId, isActive: true },
      order: { updatedAt: 'DESC' },
    });

    if (!session) {
      return [];
    }

    return await this.gameStateRepository.find({
      where: { sessionId: session.id },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * 获取所有房间列表（包括其他用户的房间，用于显示）
   */
  async getAllRooms(): Promise<GameSession[]> {
    return await this.gameSessionRepository.find({
      where: { isActive: true },
      order: { updatedAt: 'DESC' },
      relations: ['user'],
    });
  }
}
