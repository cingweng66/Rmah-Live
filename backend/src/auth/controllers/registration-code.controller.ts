import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { RegistrationCodeService } from '../services/registration-code.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

const ADMIN_EMAIL = 'pylzh2002@gmail.com';

@Controller('admin/registration-codes')
@UseGuards(JwtAuthGuard)
export class RegistrationCodeController {
  constructor(
    private readonly registrationCodeService: RegistrationCodeService,
  ) {}

  // 检查是否为管理员
  private checkAdmin(req: any) {
    if (req.user?.email !== ADMIN_EMAIL) {
      throw new UnauthorizedException('无权访问：需要管理员权限');
    }
  }

  @Get()
  async getAllCodes(@Request() req: any) {
    this.checkAdmin(req);
    return await this.registrationCodeService.getAllCodes();
  }

  @Post()
  async createCode(@Request() req: any, @Body() body: { note?: string }) {
    this.checkAdmin(req);
    return await this.registrationCodeService.createCode(body.note);
  }

  @Delete(':id')
  async deleteCode(@Request() req: any, @Param('id') id: string) {
    this.checkAdmin(req);
    await this.registrationCodeService.deleteCode(id);
    return { message: '注册码已删除' };
  }

  @Patch(':id/toggle')
  async toggleCodeStatus(@Request() req: any, @Param('id') id: string) {
    this.checkAdmin(req);
    return await this.registrationCodeService.toggleCodeStatus(id);
  }
}
