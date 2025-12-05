// src/app/models/oa-settings.model.ts

export type OAUsernameField =
  | 'job_description'
  | 'identifier02'
  | 'user_note';

export type OASecondaryField =
  | 'none'
  | OAUsernameField;

/**
 * Institution-level defaults for OA Compass behavior.
 *
 * NOTE (Phase 4):
 * - oaPrimaryField / oaSecondaryField are institution-wide decisions.
 * - showDebugPanel acts as the default; individual users may override this
 *   via CloudAppSettingsService.
 */
export interface OACompassSettings {
  /** Where to store the OA username primarily */
  oaPrimaryField: OAUsernameField;

  /** Optional second place to also store the OA username */
  oaSecondaryField: OASecondaryField;

  /** Default for whether to show the OA debug / proxy response panel */
  showDebugPanel: boolean;
}

/** Safe defaults that preserve legacy behavior */
export const DEFAULT_OA_SETTINGS: OACompassSettings = {
  oaPrimaryField: 'job_description',
  oaSecondaryField: 'identifier02', // mirrors your existing behavior
  showDebugPanel: true,
};
