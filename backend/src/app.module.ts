import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { AuthModule } from './auth/auth.module';
import { GameModule } from './game/game.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './common/controllers/health.controller';

@Module({
  imports: [
    // 配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // 数据库模块
    DatabaseModule,
    // 缓存模块 (Redis) - 简化配置，如果 Redis 不可用则使用内存缓存
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get('REDIS_HOST', '');
        const redisPort = configService.get('REDIS_PORT', 6379);
        const redisPassword = configService.get('REDIS_PASSWORD') || undefined;
        
        // 如果 REDIS_HOST 为空，直接使用内存缓存
        if (!redisHost || redisHost.trim() === '') {
          console.log('ℹ️  Redis 未配置，使用内存缓存');
          return {
            ttl: 3600 * 1000,
          };
        }
        
        // 尝试连接 Redis，最多重试 3 次
        let store = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            store = await redisStore({
              socket: {
                host: redisHost,
                port: redisPort,
                reconnectStrategy: (retries) => {
                  if (retries > 3) {
                    return new Error('Redis connection failed after 3 retries');
                  }
                  return Math.min(retries * 100, 1000);
                },
              },
              password: redisPassword,
            });
            
            // 测试连接
            await store.client.ping();
            console.log(`✅ Redis connected: ${redisHost}:${redisPort}`);
            break;
          } catch (error) {
            if (attempt === 3) {
              console.warn(`⚠️  Redis connection failed after ${attempt} attempts, using memory cache`);
              console.warn(`    Error: ${error.message}`);
              console.warn(`    Redis will be disabled. License checks will still work but caching will be in-memory only.`);
              store = null;
            } else {
              console.log(`⏳ Redis connection attempt ${attempt}/3 failed, retrying...`);
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
          }
        }
        
        if (store) {
          return {
            store: () => store,
            ttl: 3600 * 1000, // 1 hour in milliseconds
          };
        } else {
          // 使用内存缓存
          return {
            ttl: 3600 * 1000,
          };
        }
      },
      inject: [ConfigService],
    }),
    // 业务模块
    AuthModule,
    GameModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
