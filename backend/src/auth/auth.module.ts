import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { RegistrationCodeController } from './controllers/registration-code.controller';
import { UserManagementController } from './controllers/user-management.controller';
import { AuthService } from './services/auth.service';
import { LicenseService } from './services/license.service';
import { RegistrationCodeService } from './services/registration-code.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from './entities/user.entity';
import { License } from './entities/license.entity';
import { RegistrationCode } from './entities/registration-code.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, License, RegistrationCode]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET') || 'your-secret-key',
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN') || '7d',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, RegistrationCodeController, UserManagementController],
  providers: [AuthService, LicenseService, RegistrationCodeService, JwtStrategy],
  exports: [AuthService, LicenseService, RegistrationCodeService],
})
export class AuthModule {}
