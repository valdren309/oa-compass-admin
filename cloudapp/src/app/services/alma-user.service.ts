// src/app/services/alma-user.service.ts
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AlmaWsRestService, RestError } from './almaws-rest.service';
import { AlmaUser, AlmaIdentifier, AlmaUserLite } from '../models/alma-user.model';
import { OAUsernameField, OASecondaryField } from '../models/oa-settings.model';

@Injectable({
  providedIn: 'root'
})
export class AlmaUserService {

  constructor(
    private api: AlmaWsRestService
  ) {}

  /**
   * Internal helper: Get a FULL Alma user record (raw JSON).
   *
   * - view=full
   * - expand=none
   * - format=json
   */
  private async getFullUserRaw(primaryId: string): Promise<any> {
    return firstValueFrom(
      this.api.get<any>(
        `/almaws/v1/users/${encodeURIComponent(primaryId)}`,
        {
          view: 'full',
          expand: 'none',
          format: 'json'
        }
      )
    );
  }

  /**
   * Get a FULL Alma user record (including identifiers) as JSON.
   */
  async getUser(primaryId: string): Promise<AlmaUser> {
    const user = await this.getFullUserRaw(primaryId);
    return user as AlmaUser;
  }

  /**
   * Update the identifiers for a user via full GET + full PUT.
   *
   * Callers are expected to pass an Alma-compatible identifiers array
   * (typically the `user_identifier` list from Alma).
   */
  async updateUserIdentifiers(
    primaryId: string,
    identifiers: AlmaIdentifier[]
  ): Promise<AlmaUser> {
    // 1) GET full user
    const user: any = await this.getFullUserRaw(primaryId);

    // 2) Replace the top-level identifiers array
    user.user_identifier = identifiers ?? [];

    // 3) PUT full user back
    try {
      return await firstValueFrom(
        this.api.put<AlmaUser>(
          `/almaws/v1/users/${encodeURIComponent(primaryId)}?format=json`,
          user
        )
      );
    } catch (e) {
      const err = e as RestError;
      console.error('[ALMA] Failed to update user identifiers', {
        primaryId,
        status: err?.status,
        message: err?.message,
      });
      throw e;
    }
  }

  // ============================================================
  // Alma-display / normalization helpers
  // ============================================================

  getUserGroupDisplay(user: AlmaUser | null): string {
    const u: any = user;
    return (
      u?.user_group_desc ||
      u?.user_group_code ||
      u?.user_group ||
      '—'
    );
  }

  getExpiryDisplay(user: AlmaUser | null): string {
    const u: any = user;
    return (
      u?.expiry_date_fmt ||
      u?.expiry_date ||
      '—'
    );
  }

  displayName(user: AlmaUser | null): string {
    const first = user?.first_name?.trim();
    const last  = user?.last_name?.trim();

    if (first && last) return `${first} ${last}`;
    return first ?? last ?? '—';
  }

  getEmail(user: AlmaUser | null): string | undefined {
    const u: any = user;
    const emails = u?.contact_info?.email || [];
    const preferred = emails.find((e: any) => e.preferred);
    return preferred?.email_address || emails[0]?.email_address;
  }

  getOAUsernameFromIdentifiers(user: AlmaUser | null, oaIdType: string): string | undefined {
    if (!user) return undefined;
    const u: any = user;

    const topLevel = u.user_identifier;
    const legacy = u.user_identifiers?.user_identifier;

    const raw = topLevel ?? legacy ?? [];
    const list = Array.isArray(raw) ? raw : [raw].filter(Boolean);

    const hit = list.find((x: any) => {
      const code =
        typeof x?.id_type === 'string'
          ? x.id_type
          : x?.id_type?.value;
      return code === oaIdType;
    });

    return hit?.value;
  }

  normalizeFullUser(u: any): AlmaUser {
    const { code, desc } = this.getCodeAndDesc(u?.user_group);
    return {
      ...u,
      user_group_code: code,
      user_group_desc: desc,
      expiry_date_fmt: this.formatDate(u?.expiry_date ?? u?.expiration_date),
    } as AlmaUser;
  }

  toLite(u: any): AlmaUserLite {
    const { code: groupCode, desc: groupDesc } = this.getCodeAndDesc(u?.user_group);

    const linkField = u?.link;
    const links = Array.isArray(linkField) ? linkField : (linkField ? [linkField] : []);
    const selfHref = links.find((l: any) => l['@rel'] === 'self')?.['@href'] || '';

    return {
      primary_id: u?.primary_id,
      first_name: u?.first_name,
      last_name: u?.last_name,
      user_group: groupCode,
      user_group_desc: groupDesc,
      expiry_date_fmt: this.formatDate(u?.expiry_date),
      link: selfHref || undefined,
    };
  }

  private getCodeAndDesc(x: any): { code?: string; desc?: string } {
    if (!x) return {};
    if (typeof x === 'string') return { code: x };
    const code = x.value ?? x.code ?? x.toString?.();
    const desc = x['@desc'] ?? x.desc;
    return { code, desc };
  }

  private formatDate(raw: any): string {
    if (!raw) return '';
    let s = String(raw);
    if (/^\d{4}-\d{2}-\d{2}Z$/.test(s)) s = s.replace(/Z$/, 'T00:00:00Z');
    const d = new Date(s);
    if (isNaN(d.getTime())) return String(raw).replace(/Z$/, '');
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  // ============================================================
  // Search helpers
  // ============================================================

  async searchUsersRaw(
    qExpr: string,
    offset: number,
    limit: number
  ): Promise<{ items: AlmaUserLite[]; resp: any }> {
    const resp: any = await firstValueFrom(
      this.api.get<any>(
        '/almaws/v1/users',
        {
          limit,
          offset,
          q: qExpr
        }
      )
    );

    const rawUsers = Array.isArray(resp?.user)
      ? resp.user
      : (resp?.user ? [resp.user] : []);

    const items: AlmaUserLite[] = rawUsers.map((u: any) => this.toLite(u));

    return { items, resp };
  }

  /**
   * Smart Alma user search heuristic:
   *
   * - If term contains '@'      → try email search first.
   * - If it looks like an ID    → try primary_id search.
   * - If it contains a comma    → treat as "Last, First".
   * - If it has 2+ tokens       → treat as "First Last" variants.
   * - Always fall back to:
   *   - all~"<term>"
   *   - AND-combined all~token queries
   *
   * The method tries each query in order until:
   * - It finds any results, OR
   * - The response indicates more results exist via a 'next' link.
   */
  async searchUsersSmart(
    termRaw: string,
    offset: number,
    limit: number
  ): Promise<{ items: AlmaUserLite[]; resp: any; queryUsed: string }> {
    const attempts: string[] = [];
    const hasAt = termRaw.includes('@');
    const hasComma = termRaw.includes(',');
    const tokens = termRaw.split(/\s+/).filter(Boolean);
    const looksLikeId = !hasAt && !hasComma && tokens.length === 1;

    if (hasAt) attempts.push(`email~${termRaw}`);
    if (looksLikeId) attempts.push(`primary_id~${termRaw}`);
    if (hasComma) {
      const [last, first] = termRaw.split(',').map(s => s.trim()).filter(Boolean);
      if (last) {
        attempts.push(
          first
            ? `last_name~${last} AND first_name~${first}`
            : `last_name~${last}`
        );
      }
    } else if (tokens.length >= 2) {
      const [first, last] = [tokens[0], tokens.slice(1).join(' ')];
      attempts.push(`last_name~${last} AND first_name~${first}`);
    }
    attempts.push(`all~"${termRaw}"`);
    if (tokens.length > 1) {
      attempts.push(tokens.map(t => `all~${t}`).join(' AND '));
    } else if (!hasAt && !looksLikeId) {
      attempts.push(`all~${termRaw}`);
    }

    for (const q of attempts) {
      const r = await this.searchUsersRaw(q, offset, limit);
      if (r.items.length || this.hasNextLink(r.resp)) {
        return { ...r, queryUsed: q };
      }
    }

    const fallback = await this.searchUsersRaw(attempts[0], offset, limit);
    return { ...fallback, queryUsed: attempts[0] };
  }

  private hasNextLink(resp: any): boolean {
    if (!resp) return false;
    const link = resp.link;
    const links = Array.isArray(link) ? link : (link ? [link] : []);
    return !!links.find((l: any) => l['@rel'] === 'next');
  }

  // ============================================================
  // OA-required-field validation for create/sync
  // ============================================================

  validateUserForOA(user: AlmaUser | null): {
    ok: boolean;
    missing: string[];
    email?: string;
    first_name?: string;
    last_name?: string;
    expires?: string;
    alma_group_code?: string;
  } {
    if (!user) {
      return { ok: false, missing: ['user'] };
    }

    const u: any = user;

    // Email (preferred or first) via canonical helper
    const email = this.getEmail(user) ?? '';

    // Names
    const first_name = String(u?.first_name ?? '').trim();
    const last_name  = String(u?.last_name ?? '').trim();

    // Expiry as YYYY-MM-DD from either expiry_date or expiration_date
    const rawExp = u?.expiry_date ?? u?.expiration_date ?? '';
    const expiresRaw = String(rawExp || '').slice(0, 10);
    const expiresValid = /^\d{4}-\d{2}-\d{2}$/.test(expiresRaw);
    const expires = expiresValid ? expiresRaw : '';

    // Group code (mirrors existing OA payload logic)
    const alma_group_code =
      (u?.user_group as any)?.value ??
      (u as any)?.user_group ??
      '';

    const missing: string[] = [];
    if (!email)      missing.push('email');
    if (!first_name) missing.push('first name');
    if (!last_name)  missing.push('last name');
    if (!expiresValid) {
      missing.push('expiry (YYYY-MM-DD)');
    }

    return {
      ok: missing.length === 0,
      missing,
      email: email || undefined,
      first_name: first_name || undefined,
      last_name: last_name || undefined,
      expires: expires || undefined,
      alma_group_code: alma_group_code || undefined,
    };
  }

  // ============================================================
  // Identifier upsert helpers
  // ============================================================

  private ensureIdentifierArray(user: any): any[] {
    if (!user) {
      return [];
    }

    // If Alma returned wrapped identifiers (user_identifiers.user_identifier),
    // normalize into top-level user_identifier when not already present.
    const wrapped = user.user_identifiers?.user_identifier;
    if (wrapped && !user.user_identifier) {
      user.user_identifier = Array.isArray(wrapped) ? wrapped : [wrapped];
    }

    const current = user.user_identifier;

    if (!current) {
      user.user_identifier = [];
    } else if (!Array.isArray(current)) {
      user.user_identifier = [current];
    }

    return user.user_identifier;
  }

  private upsertIdentifierOnUserObject(
    user: any,
    idTypeCode: string,
    value: string
  ): void {
    const identifiers = this.ensureIdentifierArray(user);

    // Find an existing identifier by type code, regardless of how id_type is represented
    let existing = identifiers.find((id: any) => {
      const code =
        typeof id?.id_type === 'object'
          ? id.id_type?.value
          : id?.id_type;
      return code === idTypeCode;
    });

    // Ensure id_type is in Alma's canonical object form: { value: code }
    const setIdTypeObject = (id: any) => {
      const current = id.id_type;
      if (current && typeof current === 'object') {
        id.id_type = { ...(current || {}), value: idTypeCode };
      } else {
        id.id_type = { value: idTypeCode };
      }
    };

    const setSegmentTypeInternal = (id: any) => {
      if (!id.segment_type) {
        id.segment_type = 'Internal';
      }
    };

    const setStatusIfMissing = (id: any) => {
      if (id.status === undefined || id.status === null) {
        id.status = '';
      }
    };

    if (existing) {
      existing.value = value;
      setIdTypeObject(existing);
      setSegmentTypeInternal(existing);
      setStatusIfMissing(existing);
    } else {
      const newIdentifier: any = {
        segment_type: 'Internal',
        id_type: { value: idTypeCode },
        value,
        status: ''
      };
      identifiers.push(newIdentifier);
    }

    user.user_identifier = identifiers;

    if (user.user_identifiers) {
      delete user.user_identifiers;
    }
  }

  /**
   * OA username write-back (Phase 4 aware):
   *
   * - GET full user
   * - Update one or two fields based on configured primary/secondary:
   *   - 'job_description' → sets job_description = "OpenAthens: <username>"
   *   - 'identifier02'   → upserts identifier of the given type (default "02")
   *   - 'user_note'      → adds/updates a user_note containing the OA username
   * - PUT the full user back once
   */
  async writeBackOAUsernameBoth(
    primaryId: string,
    oaUsername: string,
    idTypeFromCaller?: any,
    primaryField: OAUsernameField = 'job_description',
    secondaryField: OASecondaryField = 'identifier02'
  ): Promise<void> {
    const idTypeCode =
      typeof idTypeFromCaller === 'string' && idTypeFromCaller.trim()
        ? idTypeFromCaller.trim()
        : '02';

    const user: any = await this.getFullUserRaw(primaryId);

    const oaNote = `OpenAthens: ${oaUsername}`;

    const writeJobDescription = () => {
      user.job_description = oaNote;
    };

    const writeIdentifier = () => {
      this.upsertIdentifierOnUserObject(user, idTypeCode, oaUsername);
    };

    const ensureNoteArray = (): any[] => {
      if (!user.user_note) {
        user.user_note = [];
      } else if (!Array.isArray(user.user_note)) {
        user.user_note = [user.user_note];
      }
      return user.user_note;
    };

    const writeUserNote = () => {
      const notes = ensureNoteArray();
      const noteText = `OpenAthens username: ${oaUsername}`;

      // See if we already have an OA-related note
      let existing = notes.find(
        (n: any) =>
          typeof n?.note_text === 'string' &&
          n.note_text.toLowerCase().includes('openathens')
      );

      // Try to reuse an existing note_type if any note has one
      const templateType =
        notes.find((n: any) => !!n?.note_type)?.note_type || null;

      if (existing) {
        existing.note_text = noteText;
        existing.user_viewable = existing.user_viewable ?? true;
        existing.popup_note = existing.popup_note ?? false;

        if (!existing.note_type && templateType) {
          existing.note_type = templateType;
        }
      } else {
        const newNote: any = {
          note_text: noteText,
          user_viewable: true,
          popup_note: false,
        };

        if (templateType) {
          newNote.note_type = templateType;
        }

        notes.push(newNote);
      }

      user.user_note = notes;
    };

    // Apply primary field
    switch (primaryField) {
      case 'job_description':
        writeJobDescription();
        break;
      case 'identifier02':
        writeIdentifier();
        break;
      case 'user_note':
        writeUserNote();
        break;
    }

    // Apply secondary field (if any)
    if (secondaryField && secondaryField !== 'none') {
      switch (secondaryField) {
        case 'job_description':
          writeJobDescription();
          break;
        case 'identifier02':
          writeIdentifier();
          break;
        case 'user_note':
          writeUserNote();
          break;
      }
    }

    try {
      await firstValueFrom(
        this.api.put(
          `/almaws/v1/users/${encodeURIComponent(primaryId)}?format=json`,
          user
        )
      );
    } catch (e) {
      const err = e as RestError;
      console.error(
        '[ALMA] Failed to PUT updated user with OA username',
        {
          primaryId,
          idTypeCode,
          primaryField,
          secondaryField,
          status: err?.status,
          message: err?.message,
        }
      );
      throw e;
    }
  }
}
