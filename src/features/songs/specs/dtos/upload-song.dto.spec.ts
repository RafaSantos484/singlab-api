import { UploadSongSchema } from '../../dtos/upload-song.dto';

describe('UploadSongDTO', () => {
  describe('UploadSongSchema validation', () => {
    it('should validate correct input', () => {
      const validInput = {
        title: 'Amazing Song',
        author: 'John Doe',
      };

      const result = UploadSongSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Amazing Song');
        expect(result.data.author).toBe('John Doe');
      }
    });

    it('should reject empty title', () => {
      const invalidInput = {
        title: '',
        author: 'John Doe',
      };

      const result = UploadSongSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject empty author', () => {
      const invalidInput = {
        title: 'Song Title',
        author: '',
      };

      const result = UploadSongSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject title exceeding max length', () => {
      const invalidInput = {
        title: 'A'.repeat(256),
        author: 'John Doe',
      };

      const result = UploadSongSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject missing title', () => {
      const invalidInput = {
        author: 'John Doe',
      };

      const result = UploadSongSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject missing author', () => {
      const invalidInput = {
        title: 'Song Title',
      };

      const result = UploadSongSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject non-string title', () => {
      const invalidInput = {
        title: 123,
        author: 'John Doe',
      };

      const result = UploadSongSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject non-string author', () => {
      const invalidInput = {
        title: 'Song Title',
        author: { name: 'John Doe' },
      };

      const result = UploadSongSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should accept title with max length', () => {
      const validInput = {
        title: 'A'.repeat(255),
        author: 'John Doe',
      };

      const result = UploadSongSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept author with max length', () => {
      const validInput = {
        title: 'Song Title',
        author: 'A'.repeat(255),
      };

      const result = UploadSongSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });
});
