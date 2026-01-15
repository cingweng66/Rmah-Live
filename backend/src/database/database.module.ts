import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../auth/entities/user.entity';
import { License } from '../auth/entities/license.entity';
import { RegistrationCode } from '../auth/entities/registration-code.entity';
import { GameSession } from '../game/entities/game-session.entity';
import { GameState } from '../game/entities/game-state.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const dbHost = configService.get('DB_HOST', 'localhost');
        const isAzurePostgres = dbHost.includes('.postgres.database.azure.com');
        
        const dbConfig = {
          type: 'postgres' as const,
          host: dbHost,
          port: parseInt(configService.get('DB_PORT', '5432'), 10),
          username: configService.get('DB_USERNAME', 'postgres'),
          password: configService.get('DB_PASSWORD', 'postgres'),
          database: configService.get('DB_DATABASE', 'mahjong_db'),
          entities: [User, License, RegistrationCode, GameSession, GameState],
          synchronize: configService.get('NODE_ENV') !== 'production', // 生产环境设为 false
          logging: configService.get('NODE_ENV') === 'development',
          // 连接重试配置
          retryAttempts: 3,
          retryDelay: 3000,
          // Azure PostgreSQL 需要 SSL
        };
        
        if (isAzurePostgres) {
          // Azure PostgreSQL SSL 配置
          dbConfig['ssl'] = {
            rejectUnauthorized: false, // Azure 使用自签名证书
          };
          dbConfig['extra'] = {
            ssl: {
              rejectUnauthorized: false,
            },
          };
          console.log(`🔌 配置 Azure PostgreSQL 连接: ${dbHost} (SSL enabled)`);
        } else {
          console.log(`🔌 配置本地 PostgreSQL 连接: ${dbHost}`);
        }
        
        return dbConfig;
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
