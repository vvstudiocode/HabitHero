/**
 * Stable public type entrypoint.
 *
 * Keep this facade while consumers migrate to domain-owned type modules. It
 * intentionally contains no declarations or runtime imports.
 */
export type * from './types/primitives';
export type * from './types/database-rows';
export type * from './types/write-inputs';
export type * from './types/view-models';
export type * from './types/legacy-models';
