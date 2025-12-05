// src/app/main/main.component.ts
import { Component, OnInit } from '@angular/core';
import {
  CloudAppRestService,
  CloudAppConfigService,
  CloudAppSettingsService,
} from '@exlibris/exl-cloudapp-angular-lib';
import { EntityContextService } from '../services/entity-context.service';
import {
  OACompassSettings,
  DEFAULT_OA_SETTINGS,
  OAUsernameField,
  OASecondaryField,
} from '../models/oa-settings.model';
import {
  OAGetResponse,
  OAAccountCreate,
  OAAccountModify,
} from '../models/oa-account.model';
import { AlmaUser, AlmaUserLite } from '../models/alma-user.model';
import { AlmaUserService } from '../services/alma-user.service';
import { OAProxyService } from '../services/oa-proxy.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss', './main.component.theme.scss']
})
export class MainComponent implements OnInit {

  // Optional dev-only flag to completely disable entity debug logging.
  // Leave this as false in production.
  private readonly enableEntityDebugLog = false;

  // ==== settings/config ====
  settings: OACompassSettings = DEFAULT_OA_SETTINGS;
  showDebugPanel = DEFAULT_OA_SETTINGS.showDebugPanel;
  showSettings = false;
  showConfig = false;
  searchCollapsed = false;
  userCollapsed = false;
  // Removed unused proxyBase (all proxy usage is via OAProxyService)
  oaIdTypeCode = '02'; // default, overridden by config.oaIdTypeCode

  // ==== entity state ====
  useEntityContext = false;
  entityContextUserId: string | null = null;

  // ==== search state ====
  searchTerm = '';
  searching = false;
  showSearch = true;
  searchError?: string;
  results: AlmaUserLite[] = [];
  nextLink?: string;          // now acts as a "has more" flag for the template
  moreAvailable = false;
  private pageSize = 20;
  private currentOffset = 0;  // offset for the *next* page
  private lastQueryExpr = '';

  trackUser = (_: number, r: AlmaUserLite) => r.primary_id;

  // ==== selection + user state ====
  selectedUserId: string | null = null;
  lastSelfLink?: string;
  showResults = false;
  user: AlmaUser | null = null;
  loading = false;
  loadingUser = false;
  error?: string;

  // ==== action state ====
  busy = false;
  actionStatus = '';
  lastProxyResponse = '';

  // ==== OA state ====
  oaUsername: string | null = null;

  constructor(
    private rest: CloudAppRestService,
    private config: CloudAppConfigService,
    private settingsService: CloudAppSettingsService,
    private entityContext: EntityContextService,
    private oa: OAProxyService,
    private alma: AlmaUserService
  ) {}

  onSettingsChanged(newSettings: OACompassSettings): void {
    this.settings = {
      ...this.settings,
      ...newSettings,
    };
    this.showDebugPanel = this.settings.showDebugPanel;
  }

  ngOnInit(): void {
    // Load institution-level config first (primary/secondary fields + default debug)
    this.loadSettingsAndPreferences();

    // Watch entity context to enable Option A behavior
    this.entityContext.watchEntities().subscribe(entities => {
      if (this.enableEntityDebugLog && this.showDebugPanel) {
        const count = (entities || []).filter(e => (e as any).type === 'USER').length;
        console.log('CloudApp entities$ emitted (USER count):', count);
      }

      // Filter down to USER entities
      const userEntities = (entities || []).filter(e => (e as any).type === 'USER');

      if (userEntities.length === 1) {
        const userEntity = userEntities[0];
        const primaryId = this.extractPrimaryIdFromEntity(userEntity);

        if (primaryId) {
          this.useEntityContext = true;
          this.entityContextUserId = primaryId;

          // Load the Alma user based on context
          this.loadUserFromEntity(primaryId);
          return;
        }
      }

      // Anything else (0 or >1 USER entities) → treat as no context and show search
      this.useEntityContext = false;
      this.entityContextUserId = null;

      this.user = null;
      this.selectedUserId = null;
      this.actionStatus = '';
      this.lastProxyResponse = '';

      this.showSearch = true;
      this.showResults = false;
    });
  }

  /**
   * Phase 4 settings/config load:
   * - Institution-level config provides oaPrimaryField / oaSecondaryField
   *   and default showDebugPanel.
   * - Per-user settings can override showDebugPanel only.
   */
  private loadSettingsAndPreferences(): void {
    this.config.get().subscribe({
      next: (cfg: any) => {
        const cfgAny = cfg || {};

        this.settings = {
          ...DEFAULT_OA_SETTINGS,
          ...cfgAny,
        } as OACompassSettings;

        // Default for debug panel comes from institution config
        this.showDebugPanel = this.settings.showDebugPanel;

        // New: OA identifier type code from config (with fallback)
        this.oaIdTypeCode = (cfgAny.oaIdTypeCode || '02').toString();

        // Then overlay user-level preferences
        this.loadUserPreferences();
      },
      error: () => {
        // If config fails, fall back to hardcoded defaults
        this.settings = DEFAULT_OA_SETTINGS;
        this.showDebugPanel = DEFAULT_OA_SETTINGS.showDebugPanel;
        this.oaIdTypeCode = '02';

        // Still allow user-level override for debug
        this.loadUserPreferences();
      },
    });
  }

  private loadUserPreferences(): void {
    this.settingsService.get().subscribe({
      next: (stored: any) => {
        if (stored && typeof stored.showDebugPanel === 'boolean') {
          this.showDebugPanel = stored.showDebugPanel;
        }
        // If other keys end up in user settings later, we ignore them here.
      },
      error: () => {
        // Ignore errors; keep institution/default debug behavior
      },
    });
  }

  // ---------------------------
  // Search (dashboard-friendly)
  // ---------------------------

  clearSearch() {
    this.results = [];
    this.searchTerm = '';
    this.nextLink = undefined;
    this.moreAvailable = false;
    this.searchError = undefined;
    this.showResults = false;
    this.currentOffset = 0;
    this.lastQueryExpr = '';
  }

  async searchUsers() {
    this.results = [];
    this.showResults = true;
    this.nextLink = undefined;
    this.moreAvailable = false;
    this.searchError = undefined;
    this.currentOffset = 0;
    this.lastQueryExpr = '';

    const termRaw = (this.searchTerm || '').trim();
    if (!termRaw) return;

    this.searching = true;
    try {
      const { items, resp, queryUsed } =
        await this.alma.searchUsersSmart(termRaw, this.currentOffset, this.pageSize);

      if (!items.length) this.searchError = 'No results found.';

      this.results = items;
      this.lastQueryExpr = queryUsed || this.lastQueryExpr;

      // Compute whether more pages exist and update offset
      this.setNextLinkFromResponse(resp, items.length);
    } catch (e: any) {
      this.searchError = e?.message || 'Search failed';
    } finally {
      this.searching = false;
    }
  }

  async loadMore() {
    if (this.searching) return;
    if (!this.nextLink || !this.lastQueryExpr) return;

    this.searching = true;
    try {
      const offsetForThisPage = this.currentOffset;

      const { items, resp } = await this.alma.searchUsersRaw(
        this.lastQueryExpr,
        offsetForThisPage,
        this.pageSize
      );

      this.results = [...this.results, ...items];

      // Update offset and "has more" flag based on total_record_count
      this.setNextLinkFromResponse(resp, items.length);
    } catch (e: any) {
      this.searchError = e?.message || 'Load more failed';
    } finally {
      this.searching = false;
    }
  }

  // URL helpers

  private toRelative(href: string): string {
    try {
      if (href.startsWith('http')) {
        const u = new URL(href);
        return u.pathname + (u.search || '');
      }
    } catch {}
    return href;
  }

  private withParam(url: string, key: string, value: string): string {
    const hasQ = url.includes('?');
    return url + (hasQ ? '&' : '?') + `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  }

  private setNextLinkFromResponse(resp: any, itemsReturned: number, totalHint?: number) {
    const total = Number(resp?.total_record_count ?? totalHint ?? 0);
    const nextOffset = this.currentOffset + itemsReturned;

    if (total && nextOffset < total) {
      // There are more records beyond what we've just loaded
      this.currentOffset = nextOffset;
      this.moreAvailable = true;
      // We don't actually need a URL anymore; the template just checks truthiness
      this.nextLink = 'has-more';
    } else {
      this.moreAvailable = false;
      this.nextLink = undefined;
    }
  }

  // Derived OA username for display

  get oaUsernameDisplay(): string | null {
    const fromOA = this.oaUsername || '';
    const fromAlma = this.getOAUsernameFromIdentifiers() || '';
    const value = fromOA || fromAlma;
    return value || null;
  }

  getUserGroupDisplay(): string {
    return this.alma.getUserGroupDisplay(this.user);
  }

  getExpiryDisplay(): string {
    return this.alma.getExpiryDisplay(this.user);
  }

  /**
   * Resolve the OA username from Alma based on configured primary/secondary fields.
   *
   * - Primary is tried first (job_description, identifier02, or user_note)
   * - Secondary is tried next (unless 'none')
   * - Finally, we fall back to the legacy identifier02 lookup for safety
   */
  getOAUsernameFromIdentifiers(): string | undefined {
    if (!this.user) return undefined;
    const u: any = this.user;

    const primaryField: OAUsernameField =
      this.settings?.oaPrimaryField ?? DEFAULT_OA_SETTINGS.oaPrimaryField;

    const secondaryField: OASecondaryField =
      this.settings?.oaSecondaryField ?? DEFAULT_OA_SETTINGS.oaSecondaryField;

    const tryField = (field: OAUsernameField | 'none'): string | undefined => {
      if (!field || field === 'none') return undefined;

      switch (field) {
        case 'identifier02':
          // Use the canonical helper in AlmaUserService
          return this.alma.getOAUsernameFromIdentifiers(this.user, this.oaIdTypeCode);

        case 'job_description': {
          const jdRaw = (u.job_description ?? '').toString().trim();
          if (!jdRaw) return undefined;

          // Expect formats like "OpenAthens: username" or similar
          if (!/openathens/i.test(jdRaw)) return undefined;

          // Take everything after the last colon as the username, if present
          const parts = jdRaw.split(':');
          const candidate = parts.length > 1 ? parts[parts.length - 1] : jdRaw;
          const value = candidate.trim();
          return value || undefined;
        }

        case 'user_note': {
          const notesRaw = u.user_note;
          if (!notesRaw) return undefined;

          const notes = Array.isArray(notesRaw) ? notesRaw : [notesRaw];
          const hit = notes.find(
            (n: any) =>
              typeof n?.note_text === 'string' &&
              n.note_text.toLowerCase().includes('openathens')
          );

          if (!hit || !hit.note_text) return undefined;

          const text = hit.note_text.toString().trim();
          // Expect formats like "OpenAthens username: value"
          const parts = text.split(':');
          const candidate = parts.length > 1 ? parts[parts.length - 1] : text;
          const value = candidate.trim();
          return value || undefined;
        }
      }

      return undefined;
    };

    // Try primary field first
    let value = tryField(primaryField);

    // Then secondary, if configured
    if (!value && secondaryField && secondaryField !== 'none') {
      value = tryField(secondaryField as OAUsernameField);
    }

    // Final safety fallback: legacy identifier lookup
    if (!value) {
      value = this.alma.getOAUsernameFromIdentifiers(this.user, this.oaIdTypeCode);
    }

    return value;
  }

  selectUser(u: AlmaUserLite) {
    this.selectedUserId = u.primary_id ?? null;
    this.actionStatus = '';
    this.lastProxyResponse = '';
    this.lastSelfLink = u.link;

    // These are mostly legacy flags from when the search UI lived here,
    // but keeping them consistent does no harm.
    this.showResults = false;
    this.results = [];
    this.showSearch = false;

    if (u.link) {
      this.fetchUserByLink(u.link);
    } else if (u.primary_id) {
      this.fetchUserByIdNoType(u.primary_id);
    }
  }

  // Load / refresh selected user
  async fetchUserByLink(link: string): Promise<void> {
    this.loadingUser = true;
    this.actionStatus = 'Loading user…';

    try {
      const rel = this.toRelative(link);
      const url = rel.includes('?') ? `${rel}&view=full` : `${rel}?view=full`;

      const data = await firstValueFrom(
        this.rest.call<AlmaUser>(url)
      );

      this.user = this.alma.normalizeFullUser(data as any);

      // Derive OA username from Alma using configured ID type (e.g. "02")
      const idType = (this.oaIdTypeCode || '02').toString();
      const oaFromAlma = this.alma.getOAUsernameFromIdentifiers(
        this.user,
        idType
      );

      this.actionStatus = oaFromAlma
        ? `User loaded — OA username in Alma: ${oaFromAlma}`
        : 'User loaded.';
    } catch (e: any) {
      this.actionStatus = e?.message || 'Failed to load user';
    } finally {
      this.loadingUser = false;
    }
  }

  async fetchUserByIdNoType(primaryId: string): Promise<void> {
    this.loadingUser = true;
    this.actionStatus = 'Loading user…';

    try {
      const data = await this.alma.getUser(primaryId);
      this.user = this.alma.normalizeFullUser(data as any);

      // Derive OA username from Alma using configured ID type (e.g. "02")
      const idType = (this.oaIdTypeCode || '02').toString();
      const oaFromAlma = this.alma.getOAUsernameFromIdentifiers(
        this.user,
        idType
      );

      this.actionStatus = oaFromAlma
        ? `User loaded — OA username in Alma: ${oaFromAlma}`
        : 'User loaded.';
    } catch (e: any) {
      this.actionStatus = e?.message || 'Failed to load user';
    } finally {
      this.loadingUser = false;
    }
  }

  reload() {
    this.actionStatus = '';
    this.lastProxyResponse = '';

    if (this.lastSelfLink) {
      const url = this.withParam(this.lastSelfLink, '_', Date.now().toString());
      this.fetchUserByLink(url);
      return;
    }
    if (this.selectedUserId) {
      this.fetchUserByIdNoType(this.selectedUserId);
      return;
    }
    this.error = 'No user selected to refresh.';
  }

  private async refreshAlmaUserSilently(): Promise<void> {
    const savedStatus = this.actionStatus;
    const savedProxy = this.lastProxyResponse;

    try {
      if (this.lastSelfLink) {
        const url = this.withParam(this.lastSelfLink, '_', Date.now().toString());
        await this.fetchUserByLink(url);
      } else if (this.selectedUserId) {
        await this.fetchUserByIdNoType(this.selectedUserId);
      }
    } finally {
      this.actionStatus = savedStatus;
      this.lastProxyResponse = savedProxy;
    }
  }

  // Helpers

  newSearch() {
    this.user = null;
    this.selectedUserId = null;
    this.actionStatus = '';
    this.lastProxyResponse = '';
    this.clearSearch();
    this.showSearch = true;
  }

  displayName(): string {
    return this.alma.displayName(this.user);
  }

  toggleSettings(): void {
    this.showSettings = !this.showSettings;
    if (this.showSettings) {
      this.showConfig = false;
    }
  }

  closeSettings(): void {
    this.showSettings = false;
  }

  toggleConfig(): void {
    this.showConfig = !this.showConfig;
    if (this.showConfig) {
      this.showSettings = false;
    }
  }

  closeConfig(): void {
    this.showConfig = false;
  }

  getEmail(): string | undefined {
    return this.alma.getEmail(this.user);
  }

  private async findOAAccount(): Promise<OAGetResponse | null> {
    return this.oa.findAccountByAlmaUser(this.user, this.alma);
  }

  /**
   * Load an Alma user based on the Alma entity context (Option A).
   * Reuses the existing fetchUserByIdNoType() logic so behavior
   * stays consistent with manual selection.
   */
  private async loadUserFromEntity(primaryId: string): Promise<void> {
    this.selectedUserId = primaryId;
    this.actionStatus = '';
    this.lastProxyResponse = '';

    this.showSearch = false;
    this.showResults = false;
    this.results = [];

    await this.fetchUserByIdNoType(primaryId);
  }

  /**
   * Extract the Alma primary_id from an entity.
   * In your environment, entity.link looks like '/users/anakintest',
   * so we pull 'anakintest' out of the path. If that fails, we fall
   * back to entity.id as a last resort.
   */
  private extractPrimaryIdFromEntity(entity: any): string {
    if (!entity) return '';

    const link: string | undefined = (entity as any).link;
    if (link && typeof link === 'string') {
      const parts = link.split('/');
      const last = parts[parts.length - 1];
      if (last && last !== 'users') {
        return decodeURIComponent(last);
      }
    }

    const id = (entity as any).id;
    return typeof id === 'string' ? id : '';
  }

  private getOAUsernameFromAlmaForStatus(): string | null {
    if (!this.user) return null;

    // 1) Prefer OA username from identifiers (canonical store)
    const fromId = this.alma.getOAUsernameFromIdentifiers(this.user, this.oaIdTypeCode);
    if (fromId) return fromId;

    // 2) Fallback: try to parse from job_description (legacy style "OpenAthens: <username>")
    const u: any = this.user;
    const jd = (u?.job_description || '').toString();
    const prefix = 'OpenAthens:';
    const idx = jd.indexOf(prefix);
    if (idx !== -1) {
      const val = jd.slice(idx + prefix.length).trim();
      if (val) return val;
    }

    // 3) Fallback: try to find "OpenAthens username: <username>" in user_note
    const notes = (u?.user_note && Array.isArray(u.user_note))
      ? u.user_note
      : (u?.user_note ? [u.user_note] : []);

    for (const n of notes) {
      const text = (n?.note_text || '').toString();
      const lower = text.toLowerCase();
      const marker = 'openathens username:';
      const idx2 = lower.indexOf(marker);
      if (idx2 !== -1) {
        const raw = text.slice(idx2 + marker.length).trim();
        if (raw) return raw;
      }
    }

    return null;
  }

  async createOA(): Promise<void> {
    if (!this.user && !this.selectedUserId) return;

    this.busy = true;
    this.actionStatus = 'Creating…';
    this.lastProxyResponse = '';

    try {
      // 1) Validate Alma user fields needed for OA
      const validation = this.alma.validateUserForOA(this.user);

      if (!validation.ok) {
        this.actionStatus =
          `Create blocked: missing ${validation.missing.join(', ')}`;
        this.lastProxyResponse =
          'Alma record lacks required fields for OA create.';
        return;
      }

      const pid = this.user?.primary_id || this.selectedUserId!;

      /**
       * 2) Build OA CREATE payload WITHOUT username.
       *
       * OA will generate the username itself (e.g. prefix + suffix),
       * instead of us forcing Alma primary_id as the username.
       */
      const payload: OAAccountCreate = {
        // username: <omitted on purpose so OA can generate it>
        email:       validation.email!,
        first_name:  validation.first_name!,
        last_name:   validation.last_name!,
        expires:     validation.expires!,
        alma_group_code: validation.alma_group_code!,
      };

      // 3) Call OA /create (no modify here)
      const res = await this.oa.createAccount(payload);
      this.lastProxyResponse = JSON.stringify(res, null, 2);

      // OA now returns the ACTUAL username it generated (with suffix)
      const oaUsername =
        res?.summary?.username ||
        (res as any)?.raw?.username ||
        pid; // last-resort fallback

      if (res.created) {
        this.actionStatus =
          `OpenAthens account created${oaUsername ? `: ${oaUsername}` : ''}`;
      } else if ((res as any).alreadyExists) {
        const reason = (res as any).reason || 'An account already exists for this user.';
        this.actionStatus =
          `OpenAthens account already exists${oaUsername ? `: ${oaUsername}` : ''}`;
        if (reason) {
          this.actionStatus += ` — ${reason}`;
        }
      } else {
        const reason = (res as any).reason || 'See debug panel for details.';
        this.actionStatus = `OpenAthens account not created — ${reason}`;
      }

      // 4) If we have an OA username, try to write it back to Alma
      //    using config-driven fields and ID type.
      if (oaUsername && pid) {
        try {
          await this.alma.writeBackOAUsernameBoth(
            pid,
            oaUsername,
            this.oaIdTypeCode,             // config: OA ID type (e.g. "02")
            this.settings.oaPrimaryField,  // config: primary storage field
            this.settings.oaSecondaryField // config: secondary storage field
          );
          this.actionStatus += ' — saved to Alma';
          await this.refreshAlmaUserSilently();
        } catch (almaErr: any) {
          // Keep the OA success message, just append Alma failure info.
          this.actionStatus += ' — OA ok, but Alma update failed';
          const msg = almaErr?.message || 'Alma update failed. See Alma logs for details.';
          this.lastProxyResponse += `\n\n[Alma write-back error]\n${msg}`;
        }
      }

    } catch (e: any) {
      // Only OA/proxy-level failures should end up here.

      const status = e?.status;
      const errBody = e?.error;
      const rawMsg = errBody
        ? JSON.stringify(errBody)
        : (e?.message || String(e) || '');

      const lower = rawMsg.toLowerCase();

      // Heuristic for "already exists" returned as 400/409 from proxy/OA
      if (
        (status === 400 || status === 409) &&
        (lower.includes('already exist') ||
         lower.includes('duplicate') ||
         lower.includes('uniqueemail') ||
         lower.includes('unique email'))
      ) {
        this.actionStatus = 'OpenAthens account already exists';
        this.lastProxyResponse = rawMsg;
        return;
      }

      this.actionStatus = 'Create failed';
      this.lastProxyResponse = errBody
        ? JSON.stringify(errBody, null, 2)
        : (e?.message || String(e));
    } finally {
      this.busy = false;
    }
  }

  async syncOA(): Promise<void> {
    if (!this.user && !this.selectedUserId) return;

    this.busy = true;
    this.actionStatus = 'Syncing…';
    this.lastProxyResponse = '';

    try {
      const pid = this.user?.primary_id || this.selectedUserId!;

      // 1) Try to find an existing OA account by known identifiers
      let got = await this.findOAAccount();
      let oaUsername = got?.account?.username || got?.normalizedUsername;

      // 2) If nothing found, attempt a modify using Alma data to (re)sync OA
      if (!oaUsername) {
        const email = this.getEmail() ?? '';
        const first_name = String(this.user?.first_name ?? '').trim();
        const last_name  = String(this.user?.last_name  ?? '').trim();
        const rawExp =
          (this.user as any)?.expiry_date ??
          (this.user as any)?.expiration_date ??
          '';
        const expires = String(rawExp).slice(0, 10);

        const missing: string[] = [];
        if (!email)      missing.push('email');
        if (!first_name) missing.push('first name');
        if (!last_name)  missing.push('last name');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(expires)) {
          missing.push('expiry (YYYY-MM-DD)');
        }

        if (missing.length) {
          this.actionStatus =
            `Cannot update OA: missing ${missing.join(', ')}`;
          this.lastProxyResponse =
            'Alma record lacks required fields for OA modify.';
          return;
        }

        const alma_group_code =
          (this.user?.user_group as any)?.value ??
          (this.user as any)?.user_group ??
          '';

        const modifyPayload: OAAccountModify = {
          username: pid,
          email,
          first_name,
          last_name,
          expires,
          alma_group_code,
        };

        // --- critical bit: handle 404 / OA_NOT_FOUND here ---
        try {
          const modRes = await this.oa.modifyAccount(modifyPayload);
          this.lastProxyResponse = JSON.stringify(modRes, null, 2);
        } catch (err: any) {
          const status = err?.status;
          const errBody = err?.error;
          const rawMsg = errBody
            ? JSON.stringify(errBody)
            : (err?.message || String(err) || '');

          const code = errBody?.code;
          const bodyError =
            typeof errBody?.error === 'string'
              ? errBody.error.toLowerCase()
              : '';
          const lower = rawMsg.toLowerCase();

          if (
            status === 404 ||
            code === 'OA_NOT_FOUND' ||
            bodyError.includes('not found') ||
            lower.includes('not found')
          ) {
            this.actionStatus = 'No OA account found';
            this.lastProxyResponse = errBody
              ? JSON.stringify(errBody, null, 2)
              : rawMsg;
            return;
          }

          // Anything else -> let the outer catch handle it as "Sync failed"
          throw err;
        }

        // After modify, re-query OA to confirm the account
        got = await this.findOAAccount();
        oaUsername = got?.account?.username || got?.normalizedUsername;
      }

      // 3) If we still have no OA account, report clearly and stop
      if (!oaUsername) {
        this.actionStatus = 'No OA account found';
        this.lastProxyResponse = JSON.stringify(
          got ?? { found: false },
          null,
          2
        );
        return;
      }

      // 4) OA account is confirmed — now attempt Alma write-back.
      this.actionStatus = `Synced — OA username: ${oaUsername}`;
      this.lastProxyResponse = JSON.stringify(
        { account: got?.account },
        null,
        2
      );

      try {
        await this.alma.writeBackOAUsernameBoth(
          pid,
          oaUsername,
          this.oaIdTypeCode,             // ← config-driven ID type code
          this.settings.oaPrimaryField,  // ← config-driven primary target
          this.settings.oaSecondaryField // ← config-driven secondary target
        );
        this.actionStatus += ' — saved to Alma';
        await this.refreshAlmaUserSilently();
      } catch (almaErr: any) {
        // Keep the good OA status; just annotate Alma failure.
        this.actionStatus += ' — OA ok, but Alma update failed';
        const msg = almaErr?.message || 'Alma update failed. See Alma logs for details.';
        this.lastProxyResponse += `\n\n[Alma write-back error]\n${msg}`;
      }

    } catch (e: any) {
      // Only OA/proxy-level errors that we didn't specially handle above land here.
      const status = e?.status;
      const errBody = e?.error;
      const rawMsg = errBody
        ? JSON.stringify(errBody)
        : (e?.message || String(e) || '');

      const lower = rawMsg.toLowerCase();
      if (
        (status === 400 || status === 409) &&
        (lower.includes('already exist') ||
         lower.includes('duplicate') ||
         lower.includes('uniqueemail') ||
         lower.includes('unique email'))
      ) {
        this.actionStatus = 'OpenAthens account already exists';
        this.lastProxyResponse = rawMsg;
        return;
      }

      this.actionStatus = 'Sync failed';
      this.lastProxyResponse = errBody
        ? JSON.stringify(errBody, null, 2)
        : (e?.message || String(e));
    } finally {
      this.busy = false;
    }
  }

  async verifyOA(): Promise<void> {
    this.busy = true;
    this.actionStatus = 'Verifying…';
    this.lastProxyResponse = '';

    try {
      const got = await this.findOAAccount();
      const found = !!got?.account;
      const oaUsername = got?.account?.username || got?.normalizedUsername || '';

      if (found) {
        this.actionStatus = `Exists in OA${oaUsername ? `: ${oaUsername}` : ''}`;
        this.lastProxyResponse = JSON.stringify(got, null, 2);
      } else {
        this.actionStatus = 'No OA account found';
        this.lastProxyResponse = JSON.stringify(
          got ?? { found: false },
          null,
          2
        );
      }
    } catch (e: any) {
      const status = e?.status;
      const errBody = e?.error;
      const rawMsg = errBody
        ? JSON.stringify(errBody)
        : (e?.message || String(e) || '');

      const code = errBody?.code;
      const bodyError =
        typeof errBody?.error === 'string'
          ? errBody.error.toLowerCase()
          : '';
      const lower = rawMsg.toLowerCase();

      // Treat OA 404 / OA_NOT_FOUND as "no account", not a hard failure
      if (
        status === 404 ||
        code === 'OA_NOT_FOUND' ||
        bodyError.includes('not found') ||
        lower.includes('not found')
      ) {
        this.actionStatus = 'No OA account found';
        this.lastProxyResponse = errBody
          ? JSON.stringify(errBody, null, 2)
          : rawMsg;
      } else {
        this.actionStatus = 'Verify failed';
        this.lastProxyResponse = errBody
          ? JSON.stringify(errBody, null, 2)
          : rawMsg;
      }
    } finally {
      this.busy = false;
    }
  }

  /**
   * Top-level Reset button
   * - Clears current OA status + debug
   * - Resets search state
   * - If we have an entity-context user, reloads that user
   * - Otherwise, returns to a blank search state
   */
  onReset(): void {
    // Clear status/debug
    this.actionStatus = '';
    this.lastProxyResponse = '';
    this.error = undefined;
    this.searchError = undefined;
    this.oaUsername = null;

    // Reset search pagination state
    this.results = [];
    this.nextLink = undefined;
    this.moreAvailable = false;
    this.currentOffset = 0;
    this.lastQueryExpr = '';
    this.searchTerm = '';

    // If we’re in entity context, reload that user
    if (this.useEntityContext && this.entityContextUserId) {
      this.user = null;
      this.selectedUserId = this.entityContextUserId;
      this.showSearch = false;
      this.showResults = false;
      this.loadUserFromEntity(this.entityContextUserId);
    } else {
      // Fall back to plain “new search” reset
      this.newSearch();
    }
  }
}
