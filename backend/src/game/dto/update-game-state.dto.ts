import { IsString, IsObject, IsOptional } from 'class-validator';

export class UpdateGameStateDto {
  @IsString()
  gameId: string;

  @IsObject()
  state: any;
}
