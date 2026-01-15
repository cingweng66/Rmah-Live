import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get()
  health() {
    return {
      status: 'ok',
      message: '日麻直播记分系统后端服务运行中',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      service: 'mahjong-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
