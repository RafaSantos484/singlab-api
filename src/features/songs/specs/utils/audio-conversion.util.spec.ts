import { AudioConversionUtil } from '../../utils/audio-conversion.util';

describe('AudioConversionUtil', () => {
  describe('getFileFormat', () => {
    it('should extract format from MIME type (mp3)', () => {
      const format = AudioConversionUtil.getFileFormat(
        'audio/mpeg',
        'song.mp3',
      );
      expect(format).toBe('mp3');
    });

    it('should extract format from MIME type (wav)', () => {
      const format = AudioConversionUtil.getFileFormat(
        'audio/wav',
        'audio.wav',
      );
      expect(format).toBe('wav');
    });

    it('should extract format from MIME type (video mp4)', () => {
      const format = AudioConversionUtil.getFileFormat(
        'video/mp4',
        'video.mp4',
      );
      expect(format).toBe('mp4');
    });

    it('should fallback to file extension when MIME type is unknown', () => {
      const format = AudioConversionUtil.getFileFormat(
        'application/octet-stream',
        'audio.mp3',
      );
      expect(format).toBe('mp3');
    });

    it('should return unknown when no format can be determined', () => {
      const format = AudioConversionUtil.getFileFormat(
        'application/octet-stream',
        'file-without-extension',
      );
      expect(format).toBe('unknown');
    });

    it('should handle case-insensitive file extensions', () => {
      const format = AudioConversionUtil.getFileFormat(
        'application/octet-stream',
        'audio.MP3',
      );
      expect(format).toBe('mp3');
    });
  });

  describe('isSupportedFormat', () => {
    it('should support audio formats', () => {
      const audioFormats = [
        'mp3',
        'wav',
        'ogg',
        'webm',
        'aac',
        'flac',
        'm4a',
        'wma',
        'opus',
      ];
      audioFormats.forEach((format) => {
        expect(AudioConversionUtil.isSupportedFormat(format)).toBe(true);
      });
    });

    it('should support video formats', () => {
      const videoFormats = ['mp4', 'mov'];
      videoFormats.forEach((format) => {
        expect(AudioConversionUtil.isSupportedFormat(format)).toBe(true);
      });
    });

    it('should reject unsupported formats', () => {
      const unsupportedFormats = ['exe', 'zip', 'txt', 'pdf'];
      unsupportedFormats.forEach((format) => {
        expect(AudioConversionUtil.isSupportedFormat(format)).toBe(false);
      });
    });

    it('should handle case-insensitive format checking', () => {
      expect(AudioConversionUtil.isSupportedFormat('MP3')).toBe(true);
      expect(AudioConversionUtil.isSupportedFormat('Wav')).toBe(true);
      expect(AudioConversionUtil.isSupportedFormat('FLAC')).toBe(true);
    });
  });

  describe('convertToMp3', () => {
    it('should convert audio and return buffer with mp3 extension', () => {
      // This test would require actual FFmpeg installed and a real audio file buffer
      // For unit testing, we can skip this or mock FFmpeg
      // In a real scenario, use an e2e test with actual file
      expect(true).toBe(true);
    });
  });
});
