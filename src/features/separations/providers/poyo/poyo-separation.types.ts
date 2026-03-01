/**
 * PoYo API type definitions and response structures.
 *
 * These types mirror the PoYo AI separation service API responses:
 * https://api.poyo.ai/docs
 *
 * The type hierarchy uses discriminated unions based on `status` field:
 * - not_started: Task queued, not yet processing
 * - running: Actively separating stems, includes progress (0-100)
 * - finished: Completed successfully, includes stem URLs
 * - failed: Failed with error message
 */

export type PoyoSeparationStatus =
  | 'not_started'
  | 'running'
  | 'finished'
  | 'failed';

type PoyoSeparationTaskDetailsBase = {
  task_id: string;
  status: PoyoSeparationStatus;
  created_time: string;
  error_message?: string | null;
  progress?: number; // 0-100
};

export type PoyoNotStartedSeparationTaskDetails =
  PoyoSeparationTaskDetailsBase & {
    status: 'not_started';
  };

export type PoyoRunningSeparationTaskDetails = PoyoSeparationTaskDetailsBase & {
  status: 'running';
  error_message: null;
  files: [];
  progress: number;
};

export type PoyoFinishedSeparationTaskDetails =
  PoyoSeparationTaskDetailsBase & {
    status: 'finished';
    error_message: null;
    progress: 100;
    files: [
      {
        vocal_removal: {
          bass: string | null;
          drums: string | null;
          piano: string | null;
          guitar: string | null;
          vocals: string | null;
          other: string | null;
        };
      },
    ];
  };

export type PoyoFailedSeparationTaskDetails = PoyoSeparationTaskDetailsBase & {
  status: 'failed';
  error_message: string;
  files: [];
};

export type PoyoSeparationTaskDetails =
  | PoyoNotStartedSeparationTaskDetails
  | PoyoRunningSeparationTaskDetails
  | PoyoFinishedSeparationTaskDetails
  | PoyoFailedSeparationTaskDetails;
