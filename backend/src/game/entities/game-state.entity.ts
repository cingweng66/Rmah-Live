import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { GameSession } from './game-session.entity';

@Entity('game_states')
export class GameState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  sessionId: string;

  @ManyToOne(() => GameSession, (session) => session.states)
  @JoinColumn({ name: 'sessionId' })
  session: GameSession;

  @Column({ type: 'jsonb' })
  stateData: any; // 游戏状态数据

  @CreateDateColumn()
  timestamp: Date;
}
