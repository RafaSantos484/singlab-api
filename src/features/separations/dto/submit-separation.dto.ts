import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import {
  SeparationModelName,
  SeparationOutputType,
} from '../providers/separation-provider.types';

export class SubmitSeparationDto {
  @IsOptional()
  @IsString({ message: 'title must be a string' })
  @MaxLength(255, { message: 'title must be at most 255 characters' })
  title?: string;

  @IsOptional()
  @IsEnum(SeparationModelName, {
    message: `modelName must be one of: ${Object.values(SeparationModelName).join(', ')}`,
  })
  @Transform(({ value }) => value ?? SeparationModelName.Base)
  modelName: SeparationModelName = SeparationModelName.Base;

  @IsOptional()
  @IsEnum(SeparationOutputType, {
    message: `outputType must be one of: ${Object.values(
      SeparationOutputType,
    ).join(', ')}`,
  })
  @Transform(({ value }) => value ?? SeparationOutputType.General)
  outputType: SeparationOutputType = SeparationOutputType.General;

  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'callbackUrl must be a valid URL' })
  @MaxLength(500, { message: 'callbackUrl must be at most 500 characters' })
  callbackUrl?: string;
}
