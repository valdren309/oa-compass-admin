// src/app/services/oa-proxy.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import {
  OAVerifyRequest,
  OAVerifyResponse,
  OAGetRequest,
  OAGetResponse,
  OAAccountCreate,
  OAAccountCreateResponse,
  OAAccountModify,
  OAAccountModifyResponse,
  OAResendRequest,
  OAResendResponse
} from '../models/oa-account.model';

import { AlmaUser } from '../models/alma-user.model';
import { AlmaUserService } from './alma-user.service';
import { CloudAppConfigService } from '@exlibris/exl-cloudapp-angular-lib';

@Injectable({
  providedIn: 'root'
})
export class OAProxyService {

  /**
   * Default proxy base URL.
   *
   * Phase 4+: this is treated as a fallback. The real value should be
   * configured in the Cloud App "Configuration" view as proxyBaseUrl.
   */
  private baseUrl = 'https://app.lib.iastate.edu/oa-proxy';

  private json() {
    return { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) };
  }

  constructor(
    private http: HttpClient,
    private configService: CloudAppConfigService,
  ) {
    // Load proxyBaseUrl from Cloud App config, with fallback to the default.
    this.configService.get().subscribe({
      next: (cfg: any) => {
        const url = (cfg?.proxyBaseUrl || '').toString().trim();
        if (url && url.startsWith('https://')) {
          this.baseUrl = url;
        } else if (url) {
          // Non-HTTPS overrides are ignored for security reasons.
          // If needed, this can be surfaced in a debug/config view.
          console.warn('OAProxyService: Ignoring non-HTTPS proxyBaseUrl from config.');
        }
      },
      error: () => {
        // Ignore errors; keep default baseUrl
      },
    });
  }

  // ============================================================
  // Low-level proxy wrapper methods
  // ============================================================

  verify(payload: OAVerifyRequest): Promise<OAVerifyResponse> {
    return firstValueFrom(
      this.http.post<OAVerifyResponse>(
        `${this.baseUrl}/v1/oa/users/verify`,
        payload,
        this.json()
      )
    );
  }

  get(payload: OAGetRequest): Promise<OAGetResponse> {
    return firstValueFrom(
      this.http.post<OAGetResponse>(
        `${this.baseUrl}/v1/oa/users/get`,
        payload,
        this.json()
      )
    );
  }

  createAccount(payload: OAAccountCreate): Promise<OAAccountCreateResponse> {
    return firstValueFrom(
      this.http.post<OAAccountCreateResponse>(
        `${this.baseUrl}/v1/oa/users/create`,
        payload,
        this.json()
      )
    );
  }

  modifyAccount(payload: OAAccountModify): Promise<OAAccountModifyResponse> {
    return firstValueFrom(
      this.http.post<OAAccountModifyResponse>(
        `${this.baseUrl}/v1/oa/users/modify`,
        payload,
        this.json()
      )
    );
  }

  resendActivation(payload: OAResendRequest): Promise<OAResendResponse> {
    return firstValueFrom(
      this.http.post<OAResendResponse>(
        `${this.baseUrl}/v1/oa/users/resend-activation`,
        payload,
        this.json()
      )
    );
  }

  // ============================================================
  // Higher-level OA orchestration helpers (used by Main)
  // ============================================================

  /**
   * Find an OA account corresponding to an Alma user by:
   *   1) OA username stored in Alma identifiers (type code, default "02")
   *   2) Email address from Alma user
   *   3) Alma primary_id
   *
   * This mirrors the lookup chain previously implemented in MainComponent.
   */
  async findAccountByAlmaUser(
    user: AlmaUser | null,
    alma: AlmaUserService,
    oaIdTypeCode: string = '02'
  ): Promise<OAGetResponse | null> {

    if (!user) return null;

    const email = alma.getEmail(user);
    const pid = user.primary_id;

    // 1) Try OA username from Alma identifiers
    const knownUsername = alma.getOAUsernameFromIdentifiers(user, oaIdTypeCode);
    if (knownUsername) {
      const byId = await this.get({ username: knownUsername }).catch(() => null);
      if (byId?.account) {
        return byId;
      }
    }

    // 2) Try email
    if (email) {
      const byEmail = await this.get({ email }).catch(() => null);
      if (byEmail?.account) {
        return byEmail;
      }
    }

    // 3) Try Alma primary_id as OA username
    if (pid) {
      const byPid = await this.get({ username: pid }).catch(() => null);
      if (byPid?.account) {
        return byPid;
      }
    }

    return null;
  }
}
