import { z } from 'zod';

/**
 * Validation schema for song update (PATCH).
 * All fields are optional, but if provided must follow same rules as upload.
 * Cannot contain file-related fields.
 */
export const UpdateSongSchema = z.object({
  title: z
    .string()
    .min(1, 'Title must not be empty')
    .max(255, 'Title must be at most 255 characters')
    .optional(),
  author: z
    .string()
    .min(1, 'Author must not be empty')
    .max(255, 'Author must be at most 255 characters')
    .optional(),
});

export type UpdateSongDto = z.infer<typeof UpdateSongSchema>;

/**
 * Schema for song update response.
 * Returned after successful update.
 */
export const UpdateSongResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string(),
});

export type UpdateSongResponse = z.infer<typeof UpdateSongResponseSchema>;
