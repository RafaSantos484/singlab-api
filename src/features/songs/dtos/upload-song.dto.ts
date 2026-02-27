import { z } from 'zod';

/**
 * Schema de validação para upload de música.
 * Define os campos obrigatórios e suas regras de validação.
 */
export const UploadSongSchema = z.object({
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

/**
 * Schema para resposta de upload de música.
 * Retornado após o processamento bem-sucedido.
 */
export const UploadSongResponseSchema = z.object({
  songId: z.string(),
  title: z.string(),
  author: z.string(),
  rawSongUrl: z.string().url(),
  uploadedAt: z.string().datetime(),
});

export type UploadSongResponse = z.infer<typeof UploadSongResponseSchema>;
