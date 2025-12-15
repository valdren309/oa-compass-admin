import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CloudAppConfigService } from '@exlibris/exl-cloudapp-angular-lib';
import { take } from 'rxjs/operators';

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
   * Email domain that should NOT get a local OA account created.
   * Example: "iastate.edu" (no @).
   */
  disallowedEmailDomain?: string;

  /** Primary Alma field where the OA username is written */
  oaPrimaryField: OAUsernameField;

  /** Optional secondary field for the OA username */
  oaSecondaryField: OASecondaryField;
}

@Component({
  selector: 'oa-config',
  templateUrl: './config.component.html',
  styleUrls: ['./config.component.scss', './config.component.theme.scss'],
})
export class ConfigComponent implements OnInit {

  config: OACompassConfig = {
    proxyBaseUrl: '',
    oaIdTypeCode: '02',
    disallowedEmailDomain: '',
    oaPrimaryField: 'job_description',
    oaSecondaryField: 'identifier02',
  };

  loading = false;
  saving = false;
  error?: string;
  saved = false;

  // ✅ Stable option arrays (NOT getters)
  primaryFieldOptions: Array<{ value: OAUsernameField; label: string }> = [];
  secondaryFieldOptions: Array<{ value: OASecondaryField; label: string }> = [];

  constructor(
    private configService: CloudAppConfigService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this.error = undefined;
    this.saved = false;

    this.configService.get().pipe(take(1)).subscribe({
      next: (cfg: any) => {
        const stored = (cfg || {}) as Partial<OACompassConfig>;
        this.config = { ...this.config, ...stored };

        // Normalize immediately so UI + saving are consistent
        this.config.oaIdTypeCode = this.normalizeIdTypeCode(this.config.oaIdTypeCode);
        this.config.disallowedEmailDomain = (this.config.disallowedEmailDomain || '').trim();

        this.rebuildFieldOptions();
        this.loading = false;
      },
      error: (e) => {
        this.error = e?.message || 'Failed to load configuration';
        this.rebuildFieldOptions(); // still build defaults
        this.loading = false;
      },
    });
  }

  onIdTypeCodeChanged(value: string): void {
    // Allow letters + numbers; just trim and keep stable
    this.config.oaIdTypeCode = this.normalizeIdTypeCode(value);
    this.rebuildFieldOptions();
  }

  private normalizeIdTypeCode(raw: any): string {
    const s = (raw ?? '').toString().trim();
    // Allow alphanumeric + underscore + hyphen
    return s.replace(/[^a-zA-Z0-9_-]/g, '');
    }

  private rebuildFieldOptions(): void {
    const code = this.normalizeIdTypeCode(this.config.oaIdTypeCode);

    // ✅ User request: show ONLY the configured code (no "Identifier XX" label)
    const identifierLabel = code;

    // NOTE: value stays 'identifier02' because your field-choice model is still
    // "identifier02" (meaning "identifier by configured type code").
    this.primaryFieldOptions = [
      { value: 'job_description', label: 'Job description' },
      { value: 'identifier02',    label: identifierLabel },
      { value: 'user_note',       label: 'User note' },
    ];

    this.secondaryFieldOptions = [
      { value: 'none',            label: 'None' },
      { value: 'job_description', label: 'Job description' },
      { value: 'identifier02',    label: identifierLabel },
      { value: 'user_note',       label: 'User note' },
    ];
  }

  onCancel(): void {
    this.router.navigate(['']);
  }

  onSave(): void {
    if (this.saving) return;

    this.saving = true;
    this.error = undefined;
    this.saved = false;

    const toSave: OACompassConfig = {
      ...this.config,
      oaIdTypeCode: this.normalizeIdTypeCode(this.config.oaIdTypeCode),
      disallowedEmailDomain: (this.config.disallowedEmailDomain || '').trim(),
    };

    this.configService.set(toSave).pipe(take(1)).subscribe({
      next: () => {
        this.saving = false;
        this.saved = true;
        this.config = toSave;
        this.router.navigate(['']);
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
      disallowedEmailDomain: '',
      oaPrimaryField: 'job_description',
      oaSecondaryField: 'identifier02',
    };
    this.rebuildFieldOptions();
    this.error = undefined;
    this.saved = false;
  }
}
