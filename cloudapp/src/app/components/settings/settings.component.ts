// src/app/components/settings/settings.component.ts
import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import {
  CloudAppSettingsService,
  CloudAppConfigService,
} from '@exlibris/exl-cloudapp-angular-lib';
import {
  OACompassSettings,
  DEFAULT_OA_SETTINGS,
} from '../../models/oa-settings.model';
import { Router } from '@angular/router';

@Component({
  selector: 'oa-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss', './settings.component.theme.scss'],
})
export class SettingsComponent implements OnInit {

  @Output() settingsChanged = new EventEmitter<OACompassSettings>();

  /**
   * Local view model used for:
   * - Displaying institution-level OA storage config (read-only)
   * - Editing per-user debug preference
   */
  settings: OACompassSettings = { ...DEFAULT_OA_SETTINGS };

  loading = false;
  saving = false;
  error?: string;
  saved = false;

  constructor(
    private settingsService: CloudAppSettingsService,
    private configService: CloudAppConfigService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this.error = undefined;
    this.saved = false;

    // 1) Load institution-level config to show current OA storage rules
    this.configService.get().subscribe({
      next: (cfg: any) => {
        this.settings = {
          ...DEFAULT_OA_SETTINGS,
          ...(cfg || {}),
        } as OACompassSettings;

        this.loading = false;

        // 2) Overlay user-specific debug preference
        this.loadUserPreferences();
      },
      error: () => {
        this.settings = { ...DEFAULT_OA_SETTINGS };
        this.loading = false;

        // Still allow user-level debug preference even if config failed
        this.loadUserPreferences();
      },
    });
  }

  /**
   * Load per-user preferences (currently just showDebugPanel).
   */
  private loadUserPreferences(): void {
    this.settingsService.get().subscribe({
      next: (userSettings: any) => {
        if (userSettings && typeof userSettings.showDebugPanel === 'boolean') {
          this.settings.showDebugPanel = userSettings.showDebugPanel;
        }
      },
      error: () => {
        // Ignore; keep institution/default debug behavior
      },
    });
  }

  /**
   * Cancel: discard unsaved changes and return to main state.
   */
  onCancel(): void {
    this.router.navigate(['']);
  }

  /**
   * Save per-user debug preference only, then return to main state.
   * Institution-level OA storage is edited in the Config UI.
   */
  onSave(): void {
    if (this.saving) return;
    this.saving = true;
    this.error = undefined;
    this.saved = false;

    const userPrefs = {
      showDebugPanel: this.settings.showDebugPanel,
    };

    this.settingsService.set(userPrefs).subscribe({
      next: () => {
        this.saving = false;
        this.saved = true;
        // Emit full settings so MainComponent can refresh debug panel state (if used)
        this.settingsChanged.emit({ ...this.settings });
        // Return to main state
        this.router.navigate(['']);
      },
      error: (e) => {
        this.saving = false;
        this.error = e?.message || 'Failed to save user preferences';
      },
    });
  }

  toggleDebug(): void {
    // ngModel already updated settings.showDebugPanel
    this.saved = false;
  }

  resetToDefaults(): void {
    // Only reset local view to defaults; requires Save to persist user pref
    const currentPrimary = this.settings.oaPrimaryField;
    const currentSecondary = this.settings.oaSecondaryField;

    this.settings = {
      ...DEFAULT_OA_SETTINGS,
      oaPrimaryField: currentPrimary,
      oaSecondaryField: currentSecondary,
    };

    this.error = undefined;
    this.saved = false;
  }
}
