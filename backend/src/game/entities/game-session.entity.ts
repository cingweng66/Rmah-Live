import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { GameState } from './game-state.entity';

@Entity('game_sessions')
export class GameSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, (user) => user.gameSessions)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  gameId: string; // 游戏房间ID

  @Column({ type: 'jsonb', nullable: true })
  currentState: any; // 当前游戏状态

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => GameState, (state) => state.session)
  states: GameState[];
}
