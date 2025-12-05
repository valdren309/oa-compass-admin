import { Component, OnInit } from '@angular/core';
import { CloudAppConfigService } from '@exlibris/exl-cloudapp-angular-lib';

import {
  OAUsernameField,
  OASecondaryField,
} from '../../models/oa-settings.model';

export interface OACompassConfig {
  /** Base URL of your OA proxy (Apache → Node) */
  proxyBaseUrl: string;

  /** Alma identifier type code used to store the OA username (e.g. "02") */
  oaIdTypeCode: string;

  /**
   * Primary Alma field where the OA username is written when
   * accounts are created/synced.
   */
  oaPrimaryField: OAUsernameField;

  /**
   * Optional secondary field for the OA username. Use "none"
   * to disable the secondary location.
   */
  oaSecondaryField: OASecondaryField;
}

@Component({
  selector: 'oa-config',
  templateUrl: './config.component.html',
  styleUrls: ['./config.component.scss', './config.component.theme.scss'],
})
export class ConfigComponent implements OnInit {

  /**
   * Institution-level configuration object.
   *
   * NOTE:
   * - We intentionally do NOT include anything OA-secret here.
   * - Tenant ID, API key, OA_BASE_URL, etc. live in the proxy's
   *   environment (.env / systemd), not in the Cloud App.
   */
  config: OACompassConfig = {
    proxyBaseUrl: '',
    oaIdTypeCode: '02',
    oaPrimaryField: 'job_description',
    oaSecondaryField: 'identifier02',
  };

  loading = false;
  saving = false;
  error?: string;
  saved = false;

  // Options for the OA username storage selects
  primaryFieldOptions: Array<{ value: OAUsernameField; label: string }> = [
    { value: 'job_description', label: 'Job description' },
    { value: 'identifier02',   label: 'Identifier 02' },
    { value: 'user_note',      label: 'User note' },
  ];

  secondaryFieldOptions: Array<{ value: OASecondaryField; label: string }> = [
    { value: 'none',            label: 'None' },
    { value: 'job_description', label: 'Job description' },
    { value: 'identifier02',    label: 'Identifier 02' },
    { value: 'user_note',       label: 'User note' },
  ];

  constructor(
    private configService: CloudAppConfigService,
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this.error = undefined;
    this.saved = false;

    this.configService.get().subscribe({
      next: (cfg: any) => {
        // Merge stored config with defaults. Any legacy keys
        // like "usernamePrefix" will simply be ignored.
        this.config = {
          ...this.config,
          ...(cfg || {}),
        };
        this.loading = false;
      },
      error: (e) => {
        this.error = e?.message || 'Failed to load configuration';
        this.loading = false;
      },
    });
  }

  save(): void {
    if (this.saving) return;
    this.saving = true;
    this.error = undefined;
    this.saved = false;

    const toSave: OACompassConfig = {
      ...this.config,
    };

    this.configService.set(toSave).subscribe({
      next: () => {
        this.saving = false;
        this.saved = true;
        this.config = toSave;
      },
      error: (e) => {
        this.saving = false;
        this.error = e?.message || 'Failed to save configuration';
      },
    });
  }

  resetToDefaults(): void {
    this.config = {
      proxyBaseUrl: '',
      oaIdTypeCode: '02',
      oaPrimaryField: 'job_description',
      oaSecondaryField: 'identifier02',
    };
    this.error = undefined;
    this.saved = false;
  }
}
