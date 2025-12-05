import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'oa-app-header',
  templateUrl: './app-header.component.html',
  styleUrls: ['./app-header.component.scss', './app-header.component.theme.scss'],
})
export class AppHeaderComponent {

  /**
   * Whether the per-user settings panel is currently open.
   * Used for aria-pressed on the settings gear.
   */
  @Input() settingsOpen = false;

  /**
   * Whether the app is currently bound to an Alma USER entity (Option A).
   */
  @Input() useEntityContext = false;

  /**
   * When entity context is active, the Alma user identifier
   * for display (e.g., primary_id).
   */
  @Input() entityContextUserId: string | null = null;

  /**
   * Text describing current OA status (e.g., "User not loaded", "Synced…").
   */
  @Input() statusText: string | null = null;

  /**
   * Whether OA-related operations are in progress.
   */
  @Input() busy = false;

  /**
   * Fired when the settings gear is clicked.
   * MainComponent should toggle its own showSettings flag.
   */
  @Output() toggleSettings = new EventEmitter<void>();

  /**
   * Fired when the config (tune) button is clicked.
   * MainComponent should navigate to /config.
   */
  @Output() toggleConfig = new EventEmitter<void>();
}
