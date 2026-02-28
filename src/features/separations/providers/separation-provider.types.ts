import { SeparationConfigurationError } from './separation-provider.errors';

export type SeparationProviderName = 'poyo';

export type StemSeparationStatus =
  | 'queued'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export enum SeparationModelName {
  Base = 'base',
  Enhanced = 'enhanced',
  Instrumental = 'instrumental',
}

export enum SeparationOutputType {
  General = 'general',
  Bass = 'bass',
  Drums = 'drums',
  Other = 'other',
  Piano = 'piano',
  Guitar = 'guitar',
  Vocals = 'vocals',
}

export interface StemSeparationSubmitParams {
  audioUrl: string;
  title?: string;
  modelName: SeparationModelName;
  outputType: SeparationOutputType;
  callbackUrl?: string;
}

export interface StemSeparationTask {
  taskId: string;
  status: StemSeparationStatus | string;
  createdTime?: string;
  provider: SeparationProviderName;
}

export interface StemSeparationProviderContext {
  requestId?: string;
}

export const assertHttpsUrl = (value: string, fieldName: string): string => {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') {
      throw new SeparationConfigurationError(
        `${fieldName} must use https protocol`,
      );
    }
    return parsed.toString();
  } catch (error) {
    if (error instanceof SeparationConfigurationError) {
      throw error;
    }
    throw new SeparationConfigurationError(`Invalid ${fieldName}`);
  }
};
