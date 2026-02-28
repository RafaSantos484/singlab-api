/**
 * Songs Feature Module
 * Exports all public APIs for song upload and management
 */

export { SongsModule } from './songs.module';
export { SongsController } from './songs.controller';
export { SongsService } from './songs.service';
export type { RawSongInfo, RawSongUrlInfo, Song } from './songs.service';
export {
  UploadSongSchema,
  UploadSongResponseSchema,
} from './dtos/upload-song.dto';
export type { UploadSongDto, UploadSongResponse } from './dtos/upload-song.dto';
export {
  UpdateSongSchema,
  UpdateSongResponseSchema,
} from './dtos/update-song.dto';
export type { UpdateSongDto, UpdateSongResponse } from './dtos/update-song.dto';

/**
 * @deprecated Use AudioConversionService from 'src/features/audio' instead.
 * This utility will be removed in v2.0.0.
 * See src/features/audio/README.md for migration guide.
 */
