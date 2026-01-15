import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegistrationCode } from '../entities/registration-code.entity';

@Injectable()
export class RegistrationCodeService {
  constructor(
    @InjectRepository(RegistrationCode)
    private registrationCodeRepository: Repository<RegistrationCode>,
  ) {}

  /**
   * 生成随机注册码
   */
  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除容易混淆的字符
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * 创建注册码
   */
  async createCode(note?: string): Promise<RegistrationCode> {
    let code: string;
    let exists = true;
    
    // 确保生成的代码是唯一的
    while (exists) {
      code = this.generateCode();
      const existing = await this.registrationCodeRepository.findOne({
        where: { code },
      });
      if (!existing) {
        exists = false;
      }
    }

    const registrationCode = this.registrationCodeRepository.create({
      code,
      isActive: true,
      note: note || null,
    });

    return await this.registrationCodeRepository.save(registrationCode);
  }

  /**
   * 验证注册码
   */
  async validateCode(code: string): Promise<boolean> {
    const registrationCode = await this.registrationCodeRepository.findOne({
      where: { code: code.toUpperCase() },
    });

    if (!registrationCode) {
      return false;
    }

    if (!registrationCode.isActive) {
      return false;
    }

    if (registrationCode.usedBy) {
      return false; // 已被使用
    }

    return true;
  }

  /**
   * 使用注册码
   */
  async useCode(code: string, userEmail: string): Promise<void> {
    const registrationCode = await this.registrationCodeRepository.findOne({
      where: { code: code.toUpperCase() },
    });

    if (!registrationCode) {
      throw new NotFoundException('注册码不存在');
    }

    if (!registrationCode.isActive) {
      throw new BadRequestException('注册码已失效');
    }

    if (registrationCode.usedBy) {
      throw new BadRequestException('注册码已被使用');
    }

    registrationCode.usedBy = userEmail;
    registrationCode.usedAt = new Date();
    await this.registrationCodeRepository.save(registrationCode);
  }

  /**
   * 获取所有注册码
   */
  async getAllCodes(): Promise<RegistrationCode[]> {
    return await this.registrationCodeRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 删除注册码
   */
  async deleteCode(id: string): Promise<void> {
    const result = await this.registrationCodeRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('注册码不存在');
    }
  }

  /**
   * 停用/启用注册码
   */
  async toggleCodeStatus(id: string): Promise<RegistrationCode> {
    const code = await this.registrationCodeRepository.findOne({
      where: { id },
    });

    if (!code) {
      throw new NotFoundException('注册码不存在');
    }

    code.isActive = !code.isActive;
    return await this.registrationCodeRepository.save(code);
  }
}
