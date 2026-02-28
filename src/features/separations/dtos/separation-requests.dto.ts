import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SeparationSongParamsDto {
  @IsString()
  @IsNotEmpty()
  songId!: string;
}

export class SeparationProviderQueryDto {
  @IsOptional()
  @IsString()
  provider?: string;
}
