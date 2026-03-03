import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

/**
 * Body payload for submitting a separation task.
 *
 * The frontend sends the public audio URL and song title directly.
 * The backend forwards these to the configured stem separation provider.
 */
export class SubmitSeparationDto {
  /** Public URL of the audio file to separate. */
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  audioUrl!: string;

  /** Song title for provider metadata. */
  @IsString()
  @IsNotEmpty()
  title!: string;

  /** Provider identifier (defaults to 'poyo'). */
  @IsOptional()
  @IsString()
  provider?: string;
}

/**
 * Query parameters with optional provider override.
 */
export class SeparationProviderQueryDto {
  /** Provider identifier (defaults to 'poyo'). */
  @IsOptional()
  @IsString()
  provider?: string;
}

/**
 * Query parameters for separation status checks.
 */
export class SeparationStatusQueryDto {
  /** Provider task ID — required for status checks. */
  @IsString()
  @IsNotEmpty()
  taskId!: string;

  /** Provider identifier (defaults to 'poyo'). */
  @IsOptional()
  @IsString()
  provider?: string;
}
