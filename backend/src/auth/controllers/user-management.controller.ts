import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import * as bcrypt from 'bcryptjs';

const ADMIN_EMAIL = 'pylzh2002@gmail.com';

@Controller('admin/users')
@UseGuards(JwtAuthGuard)
export class UserManagementController {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  // 检查是否为管理员
  private checkAdmin(req: any) {
    if (req.user?.email !== ADMIN_EMAIL) {
      throw new UnauthorizedException('无权访问：需要管理员权限');
    }
  }

  @Get()
  async getAllUsers(@Request() req: any) {
    this.checkAdmin(req);
    const users = await this.userRepository.find({
      order: { createdAt: 'DESC' },
      select: ['id', 'email', 'name', 'isActive', 'createdAt', 'updatedAt'],
    });
    return users;
  }

  @Post(':id/reset-password')
  async resetPassword(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { newPassword?: string },
  ) {
    this.checkAdmin(req);
    
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 如果没有提供新密码，生成随机密码
    let newPassword: string;
    if (body.newPassword) {
      if (body.newPassword.length < 6) {
        throw new BadRequestException('密码长度至少6位');
      }
      newPassword = body.newPassword;
    } else {
      // 生成8位随机密码
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      newPassword = '';
      for (let i = 0; i < 8; i++) {
        newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    await this.userRepository.save(user);

    return {
      message: '密码重置成功',
      newPassword: newPassword, // 返回新密码给管理员
    };
  }

  @Post(':id/toggle-status')
  async toggleUserStatus(@Request() req: any, @Param('id') id: string) {
    this.checkAdmin(req);
    
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    user.isActive = !user.isActive;
    await this.userRepository.save(user);

    return {
      message: user.isActive ? '用户已启用' : '用户已停用',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
      },
    };
  }
}
