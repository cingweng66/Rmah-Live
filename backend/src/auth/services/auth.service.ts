import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { LicenseService } from './license.service';
import { RegistrationCodeService } from './registration-code.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private licenseService: LicenseService,
    private registrationCodeService: RegistrationCodeService,
  ) {}

  /**
   * 用户注册
   * 需要有效的注册码
   * 自动创建并激活 License
   */
  async register(registerDto: RegisterDto) {
    // 验证注册码
    const isValidCode = await this.registrationCodeService.validateCode(
      registerDto.registrationCode,
    );

    if (!isValidCode) {
      throw new BadRequestException('无效的注册码');
    }

    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new BadRequestException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    const user = this.userRepository.create({
      email: registerDto.email,
      passwordHash,
      name: registerDto.name,
    });

    const savedUser = await this.userRepository.save(user);

    // 标记注册码为已使用
    try {
      await this.registrationCodeService.useCode(
        registerDto.registrationCode,
        registerDto.email,
      );
    } catch (error) {
      // 如果注册码使用失败，删除已创建的用户
      await this.userRepository.delete(savedUser.id);
      throw new BadRequestException('注册码验证失败，请重试');
    }

    // 自动创建并激活 License（免费版，永久有效）
    try {
      await this.licenseService.autoCreateAndActivateLicense(savedUser.id);
    } catch (error) {
      // License 创建失败不影响注册，但记录错误
      console.error('Failed to auto-create license for user:', savedUser.id, error);
    }

    // 生成 JWT Token
    const payload = { sub: savedUser.id, email: savedUser.email };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: savedUser.id,
        email: savedUser.email,
        name: savedUser.name,
      },
    };
  }

  /**
   * 用户登录
   * 如果没有 License，自动创建一个
   */
  async login(loginDto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    // 检查是否有有效的 License，如果没有则自动创建一个
    const hasValidLicense = await this.licenseService.validateLicense(user.id);
    if (!hasValidLicense) {
      // 自动创建并激活 License（免费版，永久有效）
      try {
        await this.licenseService.autoCreateAndActivateLicense(user.id);
        console.log(`Auto-created license for user: ${user.id}`);
      } catch (error) {
        // License 创建失败不影响登录，但记录错误
        console.error('Failed to auto-create license for user:', user.id, error);
      }
    }

    // 生成 JWT Token
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  /**
   * 验证用户
   */
  async validateUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return user;
  }

  /**
   * 激活 License
   */
  async activateLicense(licenseKey: string, userId: string) {
    const license = await this.licenseService.activateLicense(
      licenseKey,
      userId,
    );

    return {
      message: 'License activated successfully',
      license: {
        licenseKey: license.licenseKey,
        expiresAt: license.expiresAt,
      },
    };
  }

  /**
   * 获取用户 License 信息
   */
  async getLicenseInfo(userId: string) {
    const license = await this.licenseService.getUserLicense(userId);

    if (!license) {
      return {
        hasLicense: false,
        message: 'No active license found',
      };
    }

    return {
      hasLicense: true,
      licenseKey: license.licenseKey,
      expiresAt: license.expiresAt,
      isExpired: license.expiresAt < new Date(),
    };
  }
}
