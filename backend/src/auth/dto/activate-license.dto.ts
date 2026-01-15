import { IsString, Matches } from 'class-validator';

export class ActivateLicenseDto {
  @IsString()
  @Matches(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/, {
    message: 'License key format is invalid',
  })
  licenseKey: string;
}
