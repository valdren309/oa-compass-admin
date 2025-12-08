// src/app/services/oa-workflow.service.ts
import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { AlmaUser } from '../models/alma-user.model';
import { AlmaUserService } from './alma-user.service';
import { OAProxyService } from './oa-proxy.service';
import {
  OAAccountCreate,
  OAAccountModify,
  OAGetResponse,
  OAResendRequest,
  OAResendResponse
} from '../models/oa-account.model';
import {
  OASecondaryField,
  OAUsernameField
} from '../models/oa-settings.model';

export interface OAWorkflowResult {
  statusText: string;
  proxyDebugText?: string;
  oaUsername?: string;
  needsReload: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class OAWorkflowService {

  constructor(
    private translate: TranslateService,
    private alma: AlmaUserService,
    private oa: OAProxyService
  ) {}

  // -----------------------------
  // RESEND WORKFLOW
  // -----------------------------
  async resendActivationWorkflow(
    user: AlmaUser | null,
    selectedUserId: string | null
  ): Promise<OAWorkflowResult> {
    // Same guard pattern as other workflows
    if (!user && !selectedUserId) {
      return {
        statusText: '',
        needsReload: false
      };
    }

    // Use email as the canonical handle for resend
    const email = this.alma.getEmail(user) ?? '';

    if (!email) {
      return {
        statusText: this.translate.instant('oa.status.resendMissingEmail'),
        proxyDebugText: this.translate.instant('oa.status.almaFieldsMissingModify'),
        needsReload: false
      };
    }

    const payload: OAResendRequest = { email };

    try {
      // Your typed wrapper:
      // resendActivation(payload: OAResendRequest): Promise<OAResendResponse>
      const resp: OAResendResponse = await this.oa.resendActivation(payload);

      return {
        statusText: this.translate.instant('oa.status.resendSuccess'),
        proxyDebugText: JSON.stringify(resp, null, 2),
        needsReload: false
      };

    } catch (err: any) {
      const handled = this.handleNotFoundLikeError(err);
      if (handled) {
        // e.g., “No OA account found”
        return handled;
      }

      const errBody = err?.error;
      return {
        statusText: this.translate.instant('oa.status.resendFailed'),
        proxyDebugText: errBody
          ? JSON.stringify(errBody, null, 2)
          : (err?.message || String(err)),
        needsReload: false
      };
    }
  }

  // -----------------------------
  // CREATE WORKFLOW
  // -----------------------------
  async createAccountWorkflow(
    user: AlmaUser | null,
    selectedUserId: string | null,
    oaIdTypeCode: string,
    primaryField: OAUsernameField,
    secondaryField: OASecondaryField
  ): Promise<OAWorkflowResult> {
    const pid = user?.primary_id || selectedUserId || '';

    // Mirror existing guard in MainComponent (caller also checks)
    if (!user && !selectedUserId) {
      return {
        statusText: '',
        needsReload: false
      };
    }

    // 1) Validate Alma user fields needed for OA
    const validation = this.alma.validateUserForOA(user);

    if (!validation.ok) {
      const missingList = (validation.missing || []).join(', ');
      return {
        statusText: this.translate.instant('oa.status.createBlocked', {
          fields: missingList
        }),
        proxyDebugText: this.translate.instant('oa.status.almaFieldsMissingCreate'),
        needsReload: false
      };
    }

    // 2) Build OA CREATE payload WITHOUT username (OA generates it)
    const payload: OAAccountCreate = {
      email:           validation.email!,
      first_name:      validation.first_name!,
      last_name:       validation.last_name!,
      expires:         validation.expires!,
      alma_group_code: validation.alma_group_code!
    };

    try {
      const res = await this.oa.createAccount(payload);
      let debug = JSON.stringify(res, null, 2);

      // OA now returns the actual username it generated
      let oaUsername =
        (res as any)?.summary?.username ||
        (res as any)?.raw?.username ||
        pid;

      let status: string;

      if ((res as any).created) {
        // Created successfully
        if (oaUsername) {
          status = this.translate.instant('oa.status.createSuccessWithUser', {
            username: oaUsername
          });
        } else {
          status = this.translate.instant('oa.status.createSuccess');
        }
      } else if ((res as any).alreadyExists) {
        // Already exists branch
        const reason =
          (res as any).reason ||
          'An account already exists for this user.'; // keep as raw English reason

        if (oaUsername) {
          status = this.translate.instant('oa.status.createAlreadyExistsWithUser', {
            username: oaUsername
          });
        } else {
          status = this.translate.instant('oa.status.createAlreadyExists');
        }

        if (reason) {
          status += ` — ${reason}`;
        }
      } else {
        // Generic “not created” branch
        const reason =
          (res as any).reason ||
          this.translate.instant('oa.status.createFailed');

        status = this.translate.instant('oa.status.createNotCreated', {
          reason
        });
      }

      let needsReload = false;

      // 4) If we have an OA username, try to write it back to Alma
      if (oaUsername && pid) {
        try {
          await this.alma.writeBackOAUsernameBoth(
            pid,
            oaUsername,
            oaIdTypeCode,
            primaryField,
            secondaryField
          );
          status += ' ' + this.translate.instant('oa.status.suffixSavedToAlma');
          needsReload = true;
        } catch (almaErr: any) {
          // Keep the OA success message, annotate Alma failure, and append error to debug text.
          const msg =
            almaErr?.message ||
            this.translate.instant('oa.status.almaUpdateFailed');
          status += ' ' + this.translate.instant('oa.status.suffixOAOkAlmaFailed');
          debug += `\n\n[Alma write-back error]\n${msg}`;
        }
      }

      return {
        statusText: status,
        proxyDebugText: debug,
        oaUsername,
        needsReload
      };

    } catch (e: any) {
      // Only OA/proxy-level failures should end up here.
      const statusCode = e?.status;
      const errBody = e?.error;
      const rawMsg = errBody
        ? JSON.stringify(errBody)
        : (e?.message || String(e) || '');

      const lower = rawMsg.toLowerCase();

      // Mirror “already exists” heuristic from previous MainComponent
      if (
        (statusCode === 400 || statusCode === 409) &&
        (lower.includes('already exist') ||
         lower.includes('duplicate') ||
         lower.includes('uniqueemail') ||
         lower.includes('unique email'))
      ) {
        return {
          statusText: this.translate.instant('oa.status.oaAlreadyExists'),
          proxyDebugText: rawMsg,
          needsReload: false
        };
      }

      return {
        statusText: this.translate.instant('oa.status.createFailed'),
        proxyDebugText: errBody
          ? JSON.stringify(errBody, null, 2)
          : (e?.message || String(e)),
        needsReload: false
      };
    }
  }

  // -----------------------------
  // SYNC WORKFLOW
  // -----------------------------
  async syncAccountWorkflow(
    user: AlmaUser | null,
    selectedUserId: string | null,
    oaIdTypeCode: string,
    primaryField: OAUsernameField,
    secondaryField: OASecondaryField
  ): Promise<OAWorkflowResult> {
    const pid = user?.primary_id || selectedUserId || '';

    // Mirror existing guard: caller also checks this.
    if (!user && !selectedUserId) {
      return {
        statusText: '',
        needsReload: false
      };
    }

    try {
      // 1) Try to find an existing OA account by known identifiers
      let got = await this.findOAAccount(user);
      let oaUsername =
        got?.account?.username ||
        got?.normalizedUsername ||
        '';

      // 2) If nothing found, attempt a modify using Alma data to (re)sync OA
      if (!oaUsername) {
        const missing: string[] = [];
        const email = this.alma.getEmail(user) ?? '';
        const first_name = String(user?.first_name ?? '').trim();
        const last_name  = String(user?.last_name  ?? '').trim();

        const rawExp =
          (user as any)?.expiry_date ??
          (user as any)?.expiration_date ??
          '';
        const expires = String(rawExp).slice(0, 10);

        if (!email)      missing.push('email');
        if (!first_name) missing.push('first name');
        if (!last_name)  missing.push('last name');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(expires)) {
          missing.push('expiry (YYYY-MM-DD)');
        }

        if (missing.length) {
          return {
            statusText: this.translate.instant('oa.status.syncBlocked', {
              fields: missing.join(', ')
            }),
            proxyDebugText: this.translate.instant('oa.status.almaFieldsMissingModify'),
            needsReload: false
          };
        }

        const alma_group_code =
          (user?.user_group as any)?.value ??
          (user as any)?.user_group ??
          '';

        const modifyPayload: OAAccountModify = {
          username: pid,
          email,
          first_name,
          last_name,
          expires,
          alma_group_code
        };

        // Handle 404 / OA_NOT_FOUND specially
        try {
          const modRes = await this.oa.modifyAccount(modifyPayload);
          // Keep entire modify response for debugging
          const debug = JSON.stringify(modRes, null, 2);
          // After modify, re-query OA to confirm the account
          got = await this.findOAAccount(user);
          oaUsername =
            got?.account?.username ||
            got?.normalizedUsername ||
            '';
          if (!oaUsername) {
            return {
              statusText: this.translate.instant('oa.status.noOAFound'),
              proxyDebugText: debug,
              needsReload: false
            };
          }
        } catch (err: any) {
          const handled = this.handleNotFoundLikeError(err);
          if (handled) {
            return handled;
          }
          // Anything else -> treat as generic sync failure
          throw err;
        }
      }

      // 3) If we still have no OA account, report clearly and stop
      if (!oaUsername) {
        return {
          statusText: this.translate.instant('oa.status.noOAFound'),
          proxyDebugText: JSON.stringify(
            got ?? { found: false },
            null,
            2
          ),
          needsReload: false
        };
      }

      // 4) OA account is confirmed — now attempt Alma write-back
      let status = this.translate.instant('oa.status.syncSuccessWithUser', {
        username: oaUsername
      });
      let debug = JSON.stringify(
        { account: got?.account },
        null,
        2
      );
      let needsReload = false;

      try {
        await this.alma.writeBackOAUsernameBoth(
          pid,
          oaUsername,
          oaIdTypeCode,
          primaryField,
          secondaryField
        );
        status += ' ' + this.translate.instant('oa.status.suffixSavedToAlma');
        needsReload = true;
      } catch (almaErr: any) {
        status += ' ' + this.translate.instant('oa.status.suffixOAOkAlmaFailed');
        const msg =
          almaErr?.message ||
          this.translate.instant('oa.status.almaUpdateFailed');
        debug += `\n\n[Alma write-back error]\n${msg}`;
      }

      return {
        statusText: status,
        proxyDebugText: debug,
        oaUsername,
        needsReload
      };

    } catch (e: any) {
      // Generic OA/proxy-level errors that weren’t handled specially
      const statusCode = e?.status;
      const errBody = e?.error;
      const rawMsg = errBody
        ? JSON.stringify(errBody)
        : (e?.message || String(e) || '');

      const lower = rawMsg.toLowerCase();
      if (
        (statusCode === 400 || statusCode === 409) &&
        (lower.includes('already exist') ||
         lower.includes('duplicate') ||
         lower.includes('uniqueemail') ||
         lower.includes('unique email'))
      ) {
        return {
          statusText: this.translate.instant('oa.status.oaAlreadyExists'),
          proxyDebugText: rawMsg,
          needsReload: false
        };
      }

      return {
        statusText: this.translate.instant('oa.status.syncFailed'),
        proxyDebugText: errBody
          ? JSON.stringify(errBody, null, 2)
          : (e?.message || String(e)),
        needsReload: false
      };
    }
  }

  // -----------------------------
  // Private helpers
  // -----------------------------

  private async findOAAccount(
    user: AlmaUser | null
  ): Promise<OAGetResponse | null> {
    // Reuse existing helper on OAProxyService, as in your MainComponent.
    // If that method’s signature ever changes, adjust here.
    return this.oa.findAccountByAlmaUser(user, this.alma);
  }

  /**
   * Map OA 404 / OA_NOT_FOUND style errors to a result,
   * or return null if the error should be handled generically.
   */
  private handleNotFoundLikeError(err: any): OAWorkflowResult | null {
    const statusCode = err?.status;
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
      statusCode === 404 ||
      code === 'OA_NOT_FOUND' ||
      bodyError.includes('not found') ||
      lower.includes('not found')
    ) {
      return {
        statusText: this.translate.instant('oa.status.noOAFound'),
        proxyDebugText: errBody
          ? JSON.stringify(errBody, null, 2)
          : rawMsg,
        needsReload: false
      };
    }

    return null;
  }
}
