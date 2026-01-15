import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { createHash, randomBytes } from 'crypto';
import { License } from '../entities/license.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class LicenseService {
  constructor(
    @InjectRepository(License)
    private licenseRepository: Repository<License>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * 生成 License Key
   * 格式: XXXX-XXXX-XXXX-XXXX
   */
  generateLicenseKey(userId?: string, expiresInDays: number = 365): string {
    const timestamp = Date.now();
    const random = randomBytes(8).toString('hex');
    const data = `${userId || 'auto'}-${timestamp}-${random}`;
    const hash = createHash('sha256').update(data).digest('hex');
    
    // 格式化为 XXXX-XXXX-XXXX-XXXX
    const formatted = hash
      .substring(0, 16)
      .toUpperCase()
      .match(/.{1,4}/g)
      .join('-');
    
    return formatted;
  }

  /**
   * 自动创建并激活 License（用于新用户注册或登录时自动创建）
   * 创建永久有效的免费 License
   */
  async autoCreateAndActivateLicense(userId: string): Promise<License> {
    // 先检查是否已有有效的 License
    const existingLicense = await this.licenseRepository.findOne({
      where: {
        userId,
        isActive: true,
      },
      order: { expiresAt: 'DESC' },
    });

    if (existingLicense && existingLicense.expiresAt > new Date()) {
      return existingLicense;
    }

    // 创建永久有效的 License（设置过期时间为 100 年后）
    const licenseKey = this.generateLicenseKey(userId, 36500);
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 100); // 100年后过期

    const license = this.licenseRepository.create({
      licenseKey,
      userId,
      expiresAt,
      isActive: true,
      activatedAt: new Date(), // 立即激活
    });

    const savedLicense = await this.licenseRepository.save(license);

    // 更新缓存
    const cacheKey = `license:user:${userId}`;
    await this.cacheManager.set(cacheKey, true, 3600);

    return savedLicense;
  }

  /**
   * 创建 License
   */
  async createLicense(
    userId: string,
    expiresInDays: number = 365,
  ): Promise<License> {
    const licenseKey = this.generateLicenseKey(userId, expiresInDays);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const license = this.licenseRepository.create({
      licenseKey,
      userId,
      expiresAt,
      isActive: true,
    });

    return await this.licenseRepository.save(license);
  }

  /**
   * 激活 License
   */
  async activateLicense(licenseKey: string, userId: string): Promise<License> {
    // 检查缓存
    const cacheKey = `license:${licenseKey}`;
    let license = await this.cacheManager.get<License>(cacheKey);

    if (!license) {
      license = await this.licenseRepository.findOne({
        where: { licenseKey },
        relations: ['user'],
      });
    }

    if (!license) {
      throw new NotFoundException('License key not found');
    }

    if (!license.isActive) {
      throw new BadRequestException('License is inactive');
    }

    if (license.expiresAt < new Date()) {
      throw new BadRequestException('License has expired');
    }

    // 检查是否已被其他用户激活
    if (license.userId !== userId && license.activatedAt) {
      throw new BadRequestException('License has been activated by another user');
    }

    // 激活 License
    license.userId = userId;
    license.activatedAt = new Date();
    license = await this.licenseRepository.save(license);

    // 更新缓存
    await this.cacheManager.set(cacheKey, license, 3600);

    return license;
  }

  /**
   * 验证 License
   */
  async validateLicense(userId: string): Promise<boolean> {
    const cacheKey = `license:user:${userId}`;
    const cached = await this.cacheManager.get<boolean>(cacheKey);
    
    if (cached !== undefined) {
      return cached;
    }

    const license = await this.licenseRepository.findOne({
      where: {
        userId,
        isActive: true,
      },
      order: { expiresAt: 'DESC' },
    });

    if (!license) {
      await this.cacheManager.set(cacheKey, false, 300); // 缓存5分钟
      return false;
    }

    const isValid = license.expiresAt > new Date();
    await this.cacheManager.set(cacheKey, isValid, 3600); // 缓存1小时

    return isValid;
  }

  /**
   * 获取用户的 License 信息
   */
  async getUserLicense(userId: string): Promise<License | null> {
    return await this.licenseRepository.findOne({
      where: {
        userId,
        isActive: true,
      },
      order: { expiresAt: 'DESC' },
    });
  }
}
