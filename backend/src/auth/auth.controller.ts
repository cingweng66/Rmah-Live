import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { LicenseService } from './services/license.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ActivateLicenseDto } from './dto/activate-license.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LicenseGuard } from './guards/license.guard';

@Controller('auth')
export class AuthController {
  @Get()
  authInfo() {
    return {
      message: '认证 API 端点',
      endpoints: {
        'POST /auth/register': '用户注册',
        'POST /auth/login': '用户登录',
        'POST /auth/activate-license': '激活 License（需要认证）',
        'GET /auth/license': '获取 License 信息（需要认证）',
        'GET /auth/profile': '获取用户信息（需要认证和 License）',
      },
    };
  }
  constructor(
    private authService: AuthService,
    private licenseService: LicenseService,
  ) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('activate-license')
  @UseGuards(JwtAuthGuard)
  async activateLicense(
    @Body() activateLicenseDto: ActivateLicenseDto,
    @Request() req,
  ) {
    return this.authService.activateLicense(
      activateLicenseDto.licenseKey,
      req.user.id,
    );
  }

  @Get('license')
  @UseGuards(JwtAuthGuard)
  async getLicenseInfo(@Request() req) {
    return this.authService.getLicenseInfo(req.user.id);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard, LicenseGuard)
  async getProfile(@Request() req) {
    return {
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
      },
    };
  }
}
