import type {
  SeparationProviderName,
  StemSeparationProviderContext,
  StemSeparationSubmitParams,
  StemSeparationTask,
} from './separation-provider.types';

export interface StemSeparationProvider {
  readonly name: SeparationProviderName;
  validateConfiguration(): void;
  submitTask(
    params: StemSeparationSubmitParams,
    context: StemSeparationProviderContext,
  ): Promise<StemSeparationTask>;
}
