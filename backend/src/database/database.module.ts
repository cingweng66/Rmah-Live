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
        const isZeaburPostgres = dbHost.includes('.zeabur.app') || dbHost.includes('.zeabur.com');
        const nodeEnv = configService.get('NODE_ENV', 'development');
        // 允许通过环境变量强制启用 synchronize（用于 Zeabur 等云平台首次部署）
        const forceSynchronize = configService.get('DB_SYNCHRONIZE', 'false') === 'true';
        
        const dbConfig = {
          type: 'postgres' as const,
          host: dbHost,
          port: parseInt(configService.get('DB_PORT', '5432'), 10),
          username: configService.get('DB_USERNAME', 'postgres'),
          password: configService.get('DB_PASSWORD', 'postgres'),
          database: configService.get('DB_DATABASE', 'mahjong_db'),
          entities: [User, License, RegistrationCode, GameSession, GameState],
          // 生产环境默认关闭 synchronize，但可以通过 DB_SYNCHRONIZE=true 强制启用
          synchronize: nodeEnv !== 'production' || forceSynchronize,
          logging: nodeEnv === 'development',
          // 连接重试配置
          retryAttempts: 3,
          retryDelay: 3000,
        };
        
        // 云数据库（Azure 或 Zeabur）需要 SSL
        if (isAzurePostgres || isZeaburPostgres) {
          // 云 PostgreSQL SSL 配置
          dbConfig['ssl'] = {
            rejectUnauthorized: false, // 云服务使用自签名证书
          };
          dbConfig['extra'] = {
            ssl: {
              rejectUnauthorized: false,
            },
          };
          const provider = isAzurePostgres ? 'Azure' : 'Zeabur';
          console.log(`🔌 配置 ${provider} PostgreSQL 连接: ${dbHost} (SSL enabled)`);
        } else {
          console.log(`🔌 配置本地 PostgreSQL 连接: ${dbHost}`);
        }
        
        if (forceSynchronize && nodeEnv === 'production') {
          console.warn('⚠️  警告: 在生产环境启用了数据库自动同步 (DB_SYNCHRONIZE=true)');
          console.warn('   建议在生产环境使用数据库迁移而不是自动同步');
        }
        
        return dbConfig;
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
