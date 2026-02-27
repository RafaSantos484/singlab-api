import { z } from 'zod';

/**
 * Regex allowing only printable ASCII characters for passwords.
 * Blocks control characters and whitespace while permitting
 * letters, digits, and all common special characters.
 */
const VALID_PASSWORD_CHARS = /^[\x21-\x7E]+$/;

/**
 * Zod validation schema for user creation.
 * Enforces field constraints and format rules.
 */
export const CreateUserSchema = z.object({
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .max(255, 'Name must be at most 255 characters'),
  email: z
    .email('Invalid e-mail format')
    .max(255, 'E-mail must be at most 255 characters'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(255, 'Password must be at most 255 characters')
    .regex(
      VALID_PASSWORD_CHARS,
      'Password must contain only printable characters (no spaces or control characters)',
    ),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;
