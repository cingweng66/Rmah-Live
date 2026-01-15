/**
 * 创建管理员账户和 License 的脚本
 * 运行: npx ts-node scripts/create-admin.ts
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/services/auth.service';
import { LicenseService } from '../src/auth/services/license.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../src/auth/entities/user.entity';
import * as bcrypt from 'bcryptjs';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const userRepository = app.get(getRepositoryToken(User));
  const licenseService = app.get(LicenseService);

  const email = process.argv[2] || 'admin@example.com';
  const password = process.argv[3] || 'admin123';
  const name = process.argv[4] || 'Admin';

  try {
    // 检查用户是否已存在
    let user = await userRepository.findOne({ where: { email } });
    
    if (user) {
      console.log(`用户 ${email} 已存在`);
    } else {
      // 创建用户
      const passwordHash = await bcrypt.hash(password, 10);
      user = userRepository.create({
        email,
        passwordHash,
        name,
        isActive: true,
      });
      user = await userRepository.save(user);
      console.log(`✅ 用户创建成功: ${email}`);
    }

    // 创建 License
    const license = await licenseService.createLicense(user.id, 365);
    console.log(`✅ License 创建成功:`);
    console.log(`   License Key: ${license.licenseKey}`);
    console.log(`   过期时间: ${license.expiresAt.toLocaleString()}`);
    
    // 激活 License
    await licenseService.activateLicense(license.licenseKey, user.id);
    console.log(`✅ License 已激活`);

    console.log('\n📝 登录信息:');
    console.log(`   邮箱: ${email}`);
    console.log(`   密码: ${password}`);
    console.log(`   License Key: ${license.licenseKey}`);

  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await app.close();
  }
}

bootstrap();
