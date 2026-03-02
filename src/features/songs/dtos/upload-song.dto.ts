import { z } from 'zod';

/**
 * Validation schema for song registration.
 * The client is responsible for uploading the raw audio file to Cloud Storage
 * at `users/:userId/songs/:songId/raw.mp3` BEFORE calling this endpoint.
 * The `songId` provided here must match the one used for the storage upload.
 */
export const UploadSongSchema = z.object({
  songId: z
    .string()
    .min(1, 'Song ID is required')
    .max(128, 'Song ID must be at most 128 characters'),
  title: z
    .string()
    .min(1, 'Title is required')
    .max(255, 'Title must be at most 255 characters'),
  author: z
    .string()
    .min(1, 'Author is required')
    .max(255, 'Author must be at most 255 characters'),
});

export type UploadSongDto = z.infer<typeof UploadSongSchema>;
