import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    // 立即输出，确保日志可见
    console.log('🚀 正在启动应用...');
    console.error('🚀 正在启动应用...'); // 同时输出到 stderr
    process.stdout.write('🚀 正在启动应用...\n');
    
    console.log('📋 环境变量检查:');
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || '未设置'}`);
    console.log(`   PORT: ${process.env.PORT || '3000'}`);
    console.log(`   DB_HOST: ${process.env.DB_HOST || '未设置'}`);
    console.log(`   DB_PORT: ${process.env.DB_PORT || '5432'}`);
    console.log(`   DB_DATABASE: ${process.env.DB_DATABASE || '未设置'}`);
    console.log(`   DB_USERNAME: ${process.env.DB_USERNAME || '未设置'}`);
    console.log(`   DB_PASSWORD: ${process.env.DB_PASSWORD ? '已设置' : '未设置'}`);
    console.log(`   FRONTEND_URL: ${process.env.FRONTEND_URL || '未设置'}`);
    console.log('');
    console.log('📦 正在创建 NestJS 应用...');
    
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });
    
    console.log('✅ NestJS 应用创建成功');
    console.log('🔌 正在连接数据库（这可能需要几秒钟）...');

    // 启用 CORS
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    console.log(`🌐 CORS 配置: 允许来源 ${frontendUrl}`);
    
    // 支持多个来源（用逗号分隔）
    const allowedOrigins = frontendUrl.split(',').map(url => url.trim());
    
    app.enableCors({
      origin: (origin, callback) => {
        // 允许没有 origin 的请求（如移动应用、Postman 等）
        if (!origin) {
          return callback(null, true);
        }
        
        // 检查是否在允许列表中
        if (allowedOrigins.includes(origin) || allowedOrigins.some(allowed => origin.startsWith(allowed))) {
          return callback(null, true);
        }
        
        // 开发环境允许所有来源
        if (process.env.NODE_ENV !== 'production') {
          return callback(null, true);
        }
        
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['Authorization'],
    });

    // 全局验证管道
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    const port = process.env.PORT || 3000;
    await app.listen(port);
    console.log(`✅ Server is running on: http://localhost:${port}`);
    console.log(`📡 API endpoints:`);
    console.log(`   - Health: http://localhost:${port}/health`);
    console.log(`   - Auth Info: http://localhost:${port}/auth`);
    console.log(`   - Game Info: http://localhost:${port}/game`);
    console.log(`   - WebSocket: ws://localhost:${port}/game`);
    console.log(`\n💡 提示: 访问 /auth 或 /game 查看可用端点`);
  } catch (error) {
    console.error('❌ 应用启动失败:');
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);
    process.exit(1);
  }
}

bootstrap();
