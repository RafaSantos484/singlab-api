/**
 * Songs Feature Module
 * Exports all public APIs for song upload and management
 */

export { SongsModule } from './songs.module';
export { SongsController } from './songs.controller';
export { SongsService } from './songs.service';
export {
  UploadSongSchema,
  UploadSongResponseSchema,
} from './dtos/upload-song.dto';
export type { UploadSongDto, UploadSongResponse } from './dtos/upload-song.dto';
export { AudioConversionUtil } from './utils/audio-conversion.util';
