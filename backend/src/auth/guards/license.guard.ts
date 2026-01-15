import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { LicenseService } from '../services/license.service';

@Injectable()
export class LicenseGuard implements CanActivate {
  constructor(private licenseService: LicenseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    const hasValidLicense = await this.licenseService.validateLicense(user.id);

    if (!hasValidLicense) {
      throw new UnauthorizedException('No valid license found');
    }

    return true;
  }
}
