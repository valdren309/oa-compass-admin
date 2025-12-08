# **System Design Document (SDD)**

### *OA Compass Admin — Alma + OpenAthens Provisioning Cloud App*

### **Option A — Entity-Aware Alma Cloud App Architecture**

---

# **1. Purpose of This Document**

This SDD defines the **authoritative system architecture**, **modules**, **interfaces**, **data structures**, and **core algorithms** for the OA Compass Admin Cloud App.
It exists to ensure:

1. **Consistency** — all contributors and AI assistants follow the same structure.
2. **Stability** — no accidental invention of new endpoints, fields, or models.
3. **Security** — all OA operations remain server-side only.
4. **Maintainability** — code is structured, theme-aware, and Cloud-App compliant.

The SDD **overrides all prior architectural assumptions**.

---

# **2. System Overview**

OA Compass Admin is an **entity-aware Alma Cloud App** that streamlines provisioning and synchronizing OpenAthens accounts based on Alma user data.

### Core functional responsibilities:

* Load Alma users through entity context or manual search
* Query OpenAthens accounts (via proxy)
* Create, modify, or validate OA accounts
* Sync OA username back to Alma user identifiers
* Provide settings for user preferences and institutional configuration
* Display debugging or workflow information based on admin preferences

### Core architectural rule:

> **All OpenAthens API calls are exclusively made through the local Node proxy.
> No OA credentials or PII ever enter the Cloud App runtime.**

---

# **3. System Architecture**

```
+-------------------------------------------------------+
|        Alma Cloud App Runtime (Angular 16+)           |
|-------------------------------------------------------|
|  • App Shell (AppComponent + Manifest)                |
|  • App Header (status, busy, settings/config icons)   |
|  • Main (entity-aware root view)                      |
|  • User Search Component                              |
|  • User Shell Component (info + actions + debug)      |
|  • User Info Component                                |
|  • OA Status Component                                |
|  • Toast / Alerts                                     |
|  • Settings (user-level via CloudAppSettingsService)  |
|  • Configuration (institution-level via               |
|       CloudAppConfigService)                          |
|                                                       |
|  Communicates with:                                   |
|    • Alma REST APIs (via AlmaWsRestService /          |
|      CloudAppRestService)                             |
|    • Node Proxy (via OAProxyService)                  |
+---------------------------↑---------------------------+
                            |
                      HTTPS (Secure)
                            |
+-------------------------------------------------------+
|                OA Compass Node Proxy                  |
|-------------------------------------------------------|
|  • Environment variable–controlled configuration      |
|  • Hardened OA request handlers                       |
|  • NO username generation (OA generates usernames)    |
|  • Map Alma group → OA groups / permission sets       |
|  • Validate required fields (email, name, expiry,     |
|    Alma group hints)                                  |
|  • Enforce strict CORS allowlist                      |
|  • Handle errors safely (sanitized responses)         |
|                                                       |
|  Exposes endpoints to Cloud App only (JSON):          |
|   GET  /health              (ops/monitoring only)     |
|   POST /v1/oa/users/verify                            |
|   POST /v1/oa/users/get                               |
|   POST /v1/oa/users/create                            |
|   POST /v1/oa/users/modify                            |
|   POST /v1/oa/users/resend-activation                 |
+-------------------------------------------------------+
                            |
                   OA Admin API (external)
                            |
+-------------------------------------------------------+
|                 OpenAthens Admin / Compass            |
|   • Generates usernames according to tenant policy    |
|   • Stores accounts, groups, permission sets          |
+-------------------------------------------------------+
```

---

# **4. Cloud App Component Architecture**

All major UI elements are split into **Small, Testable, Theme-Aware Angular Components**.

## **4.1 High-Level Components**

| Component                | Responsibility                                          |
| ------------------------ | ------------------------------------------------------- |
| **AppHeaderComponent**   | Top-level header, settings button, theme-aware styling  |
| **UserSearchComponent**  | Search box, results list, “Load more”, search logic     |
| **UserShellComponent**   | Orchestrates selected user → info → OA status → actions |
| **UserInfoComponent**    | Displays Alma user details                              |
| **OAStatusComponent**    | Shows OA status & last proxy response                   |
| **OAProvisionComponent** | Buttons for Create, Sync, Verify                        |
| **ToastComponent**       | Small notifications                                     |
| **SettingsComponent**    | User preferences (CloudAppSettingsService)              |
| **ConfigComponent**      | Institution configuration (CloudAppConfigService)       |

These are referenced in the CCR.

---

### **4.4 Node Proxy Architecture (Phase 6 Modularized Design)**

The Node proxy is a required security layer that performs all OpenAthens Admin API interactions. Phase 6 formalizes the proxy into a clean module architecture with strict behavioral guarantees.

### **4.4.1 Module Overview**

#### **config.js**

* Loads and validates environment variables.
* Exposes:

  * `PORT`
  * `ALLOWED_ORIGINS[]`
  * `OA_BASE_URL`, `OA_TENANT`, `OA_API_KEY`, `OA_USERNAME_PREFIX`, `OA_CREATE_URL`
  * `GROUP_MAP` and `CODE_TO_KEY` (Alma → OA mappings)
* Ensures OA credentials are never exposed to the client.

#### **cors.js**

* Exports `setCors(req, res, ALLOWED_ORIGINS)`.
* Applies Access-Control headers only when `Origin` matches allowlist.

#### **oa-client.js**

* Low-level HTTPS utilities:

  * `httpPostJsonWithKey(url, apiKey, payload, contentType)`
  * `httpGetJsonWithKey(url, apiKey)`
  * `normalizeUsername(u)`
  * `queryAccount({ username, email })`
  * `resolveAccountIdOrThrow(credentials)`
* Encapsulates all OA API request construction, parsing, and error mapping.

#### **validators.js**

* Input validators for proxy endpoints:

  * `isValidEmail(email)`
  * `isValidDateYYYYMMDD(str)`
  * `validateCreatePayload(body)`
* Returns structured `{ ok: boolean, errors?: {...} }` objects.

#### **routes/users.js**

Handles all OA user endpoints:

* `/v1/oa/users/verify`
* `/v1/oa/users/get`
* `/v1/oa/users/create`
* `/v1/oa/users/modify`
* `/v1/oa/users/resend-activation`

Provides canonical helpers:

* `readJsonBody(req)` (200 KB cap + unified parse error)
* `sendJson(res, status, body)`
* `derivePolicy({ alma_group_key, alma_group_code })`
* `sendOAError(res, status, body)`
* `checkRequiredEnv(params)`

#### **server.js**

* Creates HTTP server.
* Wires CORS, OPTIONS preflight, health check.
* Dispatches to handlers in `routes/users.js`.
* Contains **no OA logic**.

### **4.4.2 Error Normalization Policy**

All OA errors are transformed into a canonical structure that the Cloud App depends on:

```
{
  error: string,
  code: string | null,
  message: string,
  status: number
}
```

This ensures stable behavior regardless of future OA API changes.

### **4.4.3 Behavior Preservation**

This modularization shall not modify:

* Allowed routes
* Request/response contracts
* Group mapping behavior
* Username normalization logic
* Activation email workflow

Only code structure, readability, testability, and maintainability are affected.

---

# **5. Services**

## **5.1 AlmaUserService**

Authoritative interface for interacting with the Alma Users API.

### **Responsibilities**

* Fetch full Alma user records (`view=full`), including identifiers, notes, contact info, and group data.
* Update Alma users via full-record PUT operations.
* Extract identifiers, user notes, emails, names, expiry dates, and derived fields.
* Normalize Alma data for consistent UI display.
* Apply OA username write-back rules based on institution configuration:

  * Primary storage field (job description, identifier type, or user note)
  * Optional secondary storage field
  * Configurable OA identifier type code

### **Key Methods (canonical, see CCR)**

* `getUser(primaryId)` – Fetch full Alma user JSON.
* `updateUserIdentifiers(primaryId, identifiers)` – Replace identifier array and PUT full user.
* `writeBackOAUsernameBoth(primaryId, oaUsername, idTypeCode, primaryField, secondaryField)` – Unified OA username updater applying institution-configured storage rules.
* `getOAUsernameFromIdentifiers(user, idTypeCode)` – Extract OA username from Alma identifiers.
* `validateUserForOA(user)` – Produce required-field validation for OA create/modify requests.
* `normalizeFullUser(user)` – Normalize Alma user for UI display (expiry date, group desc, etc.).

---

## **5.2 OAProxyService**

Wrapper around the Node proxy.

### Responsibilities

* Send typed requests to the Node proxy
* Validate minimal required fields before sending
* Return typed responses only (never `any`)
* Read `proxyBaseUrl` from `CloudAppConfigService`, with:
  * HTTPS-only enforcement (`https://` required)
  * Fallback to the compiled default if config is missing or invalid
* Never call any diagnostic/debug endpoints on the proxy
  (only the `/v1/oa/users/*` routes are used by the Cloud App)

### Endpoints (absolute canonical)

* `POST /v1/oa/users/get`
* `POST /v1/oa/users/verify`
* `POST /v1/oa/users/create`
* `POST /v1/oa/users/modify`
* `POST /v1/oa/users/resend-activation`

---

## **5.3 EntityContextService (NEW)**

Required for Option A.

### Responsibilities

* Listen to CloudAppEventsService.entities$
* Detect Alma user context while browsing Alma UI
* If user selected → auto-load that user into the app
* Provide fallback to search if no context exists

This service enables the shift from a Dashboard Widget → true entity-aware Cloud App.

---

## **5.4 OAWorkflowService (New Module)**

### **Purpose**

Handles all high‑level OpenAthens workflows by orchestrating Alma and OA proxy operations. Centralizes business logic currently in `MainComponent`, reducing component complexity and improving testability.

### **Responsibilities**

* Validate Alma users for OA operations.
* Build OA create & modify payloads (username omitted on create).
* Call `OAProxyService` for `createAccount`, `modifyAccount`, and `resendActivation` operations.
* Interpret OA responses (created, already exists, not found, failure).
* Extract authoritative OA username from OA responses.
* Write OA username back into Alma using `AlmaUserService.writeBackOAUsernameBoth`.
* Return workflow results in a normalized format.

### **Exclusions**

* Does **not** directly call Alma REST endpoints.
* Does **not** store state (delegated to StateService).
* Does **not** implement Verify flow (handled implicitly through Sync).

### **Public API**

```ts
interface OAWorkflowResult {
  statusText: string;
  proxyDebugText?: string;
  oaUsername?: string;
  needsReload: boolean;
}
```

```ts
resendActivationWorkflow(
    user: AlmaUser | null,
    selectedUserId: string | null
): Promise<OAWorkflowResult>
```

```ts
createAccountWorkflow(
  user: AlmaUser | null,
  selectedUserId: string | null,
  oaIdTypeCode: string,
  primaryField: OAUsernameField,
  secondaryField: OASecondaryField
): Promise<OAWorkflowResult>;
```

```ts
syncAccountWorkflow(
  user: AlmaUser | null,
  selectedUserId: string | null,
  oaIdTypeCode: string,
  primaryField: OAUsernameField,
  secondaryField: OASecondaryField
): Promise<OAWorkflowResult>;
```

### **Internal Dependencies**

* `AlmaUserService`
* `OAProxyService`

---

## **5.5 StateService (New Module, Canonicalized)**

### **Purpose**

Provides a shared, reactive store for UI‑relevant state: current user, busy flag, proxy debug output. Reduces cross‑component wiring and removes UI state from `MainComponent`.

### **Responsibilities**

* Maintain global `busy` state.
* Store last proxy response for debug panel.
* Optionally store the currently loaded Alma user.
* Provide observable streams for UI binding.

### **Public API**

```ts
setUser(user: AlmaUser | null): void;
getUser(): Observable<AlmaUser | null>;

setBusy(isBusy: boolean): void;
getBusy(): Observable<boolean>;

setLastProxyResponse(text: string): void;
getLastProxyResponse(): Observable<string>;
```

### **Internal Notes**

* Uses `BehaviorSubject` internally.
* UI binds using `async` pipe.

---

# **6. Settings vs Configuration (Important Option A Requirement)**

OA Compass Admin distinguishes between **user-level settings** (per Alma staff member using the app) and **institution-level configuration** (shared across the entire Alma environment). This separation is critical for Option A behavior and for safe multi-tenant deployment.

## **6.1 User-level Settings (CloudAppSettingsService)**

Persisted **per Alma staff user** by the Cloud App runtime.

Intended for UI and workflow preferences that do **not** affect business logic or OA semantics.

Examples:

* Whether the OA debug panel is shown by default
* Future: default search behavior (e.g., open search vs. rely on entity context)
* Future: optional UI density / layout preferences

**Not allowed** at the user level:

* OA username format rules
* Alma write-back field choices
* Proxy endpoints
* OA tenant or credential-related values

These must remain institution-level to avoid divergent behavior between staff.

## **6.2 Institution-level Configuration (CloudAppConfigService)**

Persisted **once per institution** and shared by all OA Compass Admin users.

Intended for operational and policy decisions that must be consistent across staff.

Examples:

* **Proxy endpoint URL** (`proxyBaseUrl`)

  * The HTTPS base URL for the OA Node proxy (e.g. `https://app.lib.example.edu/oa-proxy`).

* **OA identifier type code** (`oaIdTypeCode`)

  * Alma identifier type used to store the OpenAthens username (e.g. `"02"`).

* **Primary OA username storage field**

  * Where the OA-generated username is written first:

    * Job description
    * Identifier (e.g. identifier type `oaIdTypeCode`)
    * User note

* **Secondary OA username storage field (optional)**

  * A second location to mirror the OA username, or `none`.

* **Feature flags (future)**

  * Enable/disable advanced behaviors (e.g. resend activation, extra debug tools).

* **Default Alma-to-OA group policy hints (future)**

  * Optional mappings that complement the proxy’s server-side group/permission logic.

> **Removed in Phase 4:**
>
> * OA username prefix override.
>
>   * Username prefixes and generation rules are now handled exclusively by OpenAthens
>     tenant configuration and the OA Admin API. The Cloud App and proxy no longer
>     construct or override OA usernames.

Both user-level settings and institution-level configuration continue to be declared
in `manifest.json` under the Cloud App `settings` and `configuration` sections, but
**all OA-sensitive behavior now lives in the configuration layer, never in user settings.**
---

# **7. Detailed Data Models (Authoritative)**

All models are defined in `/src/app/models` and must match exactly what is described here.

## **7.1 AlmaUser**

Matches Alma Users API structure.

Fields used:

```
primary_id
first_name
last_name
contact_info.email
user_group (value + desc)
expiry_date OR expiration_date
user_identifier (array)
```

No additional fields may be added.

---

## **7.2 OA Models**

The OA request/response models used by the Angular app **must match** the Node proxy and OpenAthens Admin API expectations. These shapes are canonical for the Cloud App and must not be changed without updating the SDD, CCR, and proxy together.

### `OAAccountCreate`

Minimal payload for creating a new OA account via the proxy.

```ts
interface OAAccountCreate {
  /**
   * Optional username hint.
   *
   * In Phase 4, the Cloud App normally **omits** this field so that
   * OpenAthens generates the username according to tenant policy.
   * The proxy must accept a missing `username`.
   */
  username?: string | null;

  /** Email address (required, must be valid). */
  email: string;

  /** Given name (required). */
  first_name: string;

  /** Surname (required). */
  last_name: string;

  /** Expiry date in ISO date-only form: 'YYYY-MM-DD' (required). */
  expires: string;

  /** Alma user group code (used for policy mapping in proxy; optional). */
  alma_group_code?: string;
}
```

### `OAAccountModify`

Payload for modifying an existing OA account via the proxy.

```ts
interface OAAccountModify {
  /**
   * Optional username hint. At least one of `username` or `email`
   * must be supplied so the proxy can locate the account.
   */
  username?: string | null;

  /** Optional email for lookup and/or update. */
  email?: string;

  /** Optional first name update. */
  first_name?: string;

  /** Optional last name update. */
  last_name?: string;

  /** Optional expiry date update, 'YYYY-MM-DD'. */
  expires?: string;

  /** Optional Alma group code hint for policy mapping. */
  alma_group_code?: string;
}
```

### `OAGetResponse`

Canonical response wrapper for OA account lookups performed via the proxy.

```ts
interface OAGetResponse {
  account?: {
    username: string;
    email: string;
    expires: string;
    groups: string[];
  };

  /**
   * Normalized username used by the proxy when querying OA
   * (for example, after internal prefix handling). In Phase 4,
   * this is primarily an echo of whatever the proxy sent to OA.
   */
  normalizedUsername?: string | null;
}
```

> These models are intentionally small and stable.
>
> * Do **not** add ad-hoc fields in TypeScript without updating this section and the CCR.
> * Any changes must be coordinated with `server.js` and the OA Admin API contract.

---

# **8. Core Algorithms (Authoritative Reference)**

## **8.1 OA Username Handling (Phase 4)**

OA username **generation** is now the responsibility of the **OpenAthens Admin API**, not the Cloud App or Node proxy.

### Source of Truth

* The Cloud App sends create/modify requests to the proxy using `OAAccountCreate` / `OAAccountModify`.
* For **create**, the Cloud App normally **omits** `username` so that OpenAthens:

  * Generates a username according to tenant policy (including prefix rules and numeric suffixes).
  * Ensures uniqueness within the OpenAthens tenant.
* The proxy forwards these requests to the OA Admin API and returns the resulting account payload.

The authoritative OA username is taken from the proxy response:

* `res.summary.username` (when present), or
* The `account.username` field from a subsequent `get`/`verify` call.

### Normalization Rules

* The Node proxy **no longer constructs or enforces** a username using `OA_USERNAME_PREFIX + alma_primary_id`.
* Any prefixing or format enforcement is defined by OpenAthens tenant configuration.
* The Cloud App:

  * May **display** whatever username OA returns.
  * Must **not attempt** to generate or "fix" usernames locally.

If the proxy exposes a `normalizedUsername` field in responses, it is treated as an informational echo of the username actually used to query OA, not as an app-side transformation rule.

---

## **8.2 Alma Identifier Sync Algorithm**

After a successful OA create/modify operation, the Cloud App writes the OA-generated username back into Alma using **institution-configured** rules.

### Configuration Inputs

From `CloudAppConfigService` (institution-level):

* `oaIdTypeCode` – Alma identifier type used for OA username (e.g. `"02"`).
* `primaryField` – Required primary storage target:

  * `job_description`
  * `identifier02` (conceptually: "identifier with type = oaIdTypeCode")
  * `user_note`
* `secondaryField` – Optional secondary storage target (`none` or one of the above).

### Write-Back Steps

1. **Obtain OA Username**

   * From the OA proxy response after create/modify or from a follow-up `get` call.

2. **GET Full Alma User**

   * Request: `GET /almaws/v1/users/{primaryId}?view=full&format=json`.
   * This ensures we are working with the **entire** Alma user object.

3. **Apply Primary Field Rule**

   * If `primaryField === 'job_description'`:

     * Set `user.job_description = "OpenAthens: <oaUsername>"`.
   * If `primaryField === 'identifier02'`:

     * Normalize `user.user_identifier` to an array (flatten any `user_identifiers.user_identifier`).
     * Upsert an identifier with `id_type.value = oaIdTypeCode` and `value = oaUsername`.
     * Ensure sensible defaults (e.g., `segment_type = 'Internal'`, `status = ''`).
   * If `primaryField === 'user_note'`:

     * Normalize `user.user_note` to an array.
     * Insert or update a note whose `note_text` references OpenAthens
       (e.g. `"OpenAthens username: <oaUsername>"`).
     * Ensure `user_viewable = true` and `popup_note = false` by default unless existing values dictate otherwise.

4. **Apply Secondary Field Rule (If Not `none`)**

   * Repeat the same logic as in step 3, but targeting the secondary field.
   * If primary and secondary are the same field, the operation is idempotent.

5. **PUT Full Alma User Back**

   * Request: `PUT /almaws/v1/users/{primaryId}?format=json` with the full modified user object.
   * The Cloud App **never** sends partial objects or PATCHes—full-user PUT is required.

6. **Refresh UI Representation**

   * After a successful PUT, the app may perform a fresh `GET` for the same user to:

     * Confirm persisted values.
     * Update UI fields (identifier display, job description, notes) and OA username display.

### Invariants

* The Cloud App must:

  * **Not** modify Alma users using partial payloads.
  * **Not** attempt to infer OA username from Alma fields; OA is the source of truth.
  * Always treat the OA username as an opaque string supplied by OA.

* Alma writes must be resilient to legacy structures:

  * Handle both `user_identifier` and `user_identifiers.user_identifier` representations.
  * Preserve unrelated user data during the GET → modify → PUT cycle.

## **8.3 User Search Algorithm**

Smart fallback search:

1. If input contains `@` → search by email
2. If single token → assume primary ID
3. If comma → last_name + first_name
4. If two tokens → first + last
5. Try `all~"phrase"`
6. Try AND tokens

Stop at first match or first “next” link.

---

# **9. UI Behavior Rules**

## **9.1 Theme-Aware Styling**

All colors must use:

* Alma theme mixins
* Custom CSS vars (`--oa-*`)
* No inline CSS
* No hard-coded colors except in tokens

## **9.2 Collapsible Cards**

Planned for Phase 3.

## **9.3 No Tooltip Position Overrides**

Tooltip is now removed per user instruction.

---

# **10. Node Proxy Responsibilities**

The Node proxy is the **only** component that interacts directly with the OpenAthens Admin API. It owns all OA secrets and enforces the security boundary between the Alma Cloud App and OA.

### **Absolute Rules**

* **Never return OA credentials**

  * API keys, tenant secrets, and internal URLs must never be exposed in responses.

* **Do not generate or enforce OA usernames**

  * The proxy must not construct usernames from Alma data (e.g. `prefix + primary_id`).
  * Username generation and any prefix rules are handled **entirely by OpenAthens**.
  * The proxy may **echo** the username returned by OA, but not invent or reshape it.

* **Validate required fields for create/modify**

  For `POST /v1/oa/users/create`, the proxy must ensure at minimum:

  * `email` – present and syntactically valid
  * `first_name` – non-empty
  * `last_name` – non-empty
  * `expires` – non-empty, date-like (e.g. `YYYY-MM-DD`)

  For `POST /v1/oa/users/modify`, it must ensure:

  * At least one locator (`username` or `email`) is present
  * Any provided `email`, `first_name`, `last_name`, and `expires` are syntactically reasonable

* **Enforce group mapping (policy)**

  When Alma hints are present (e.g. `alma_group_code` / `alma_group_key`), the proxy may derive OA groups and permission sets using:

  ```
  CODE_TO_KEY -> GROUP_MAP -> OA groups / permissionSets
  ```

  * If explicit `groups` / `permissionSets` are provided in the payload, they may override derived values (as per proxy design).
  * The mapping table and policies live **only** on the proxy.

* **Sanitize all errors**

  * Responses must not include raw OA error pages, stack traces, or internal headers.
  * Error bodies returned to the Cloud App should:

    * Use neutral messages (e.g. `"OA create failed"`, `"OA query failed"`).
    * Optionally include a structured `details` object that omits secrets and unnecessary internals.

* **Enforce strict CORS and origin checks**

  * Only the configured Alma Cloud App origins may call the proxy.
  * Preflight (OPTIONS) requests should be handled cleanly.

### **Authority Boundary**

The Cloud App must treat the proxy as **authoritative** for:

* Whether an OA account exists
* The OA username assigned to a user
* The allowed set of groups and permission sets
* Interpretations of OA errors and HTTP status codes

The Cloud App:

* Sends only the minimum Alma-derived data required for OA operations.
* Never attempts to bypass or replicate proxy logic.
* Uses the proxy’s responses as the single source of truth for OA-related state.
---

# **11. Manifest & Deployment Requirements**

* Must register entity awareness
* Must expose settings + configuration routes
* Must define required permissions for Alma Users API
* Must define allowed network origins for proxy
* Must set `"runMode": "normal"` (not a dashboard widget)

---

# **12. Phase Dependencies (from PROJECT_PLAN)**

| Phase | Description                                           |
| ----- | ----------------------------------------------------- |
| **0** | Codebase realignment with SDD + CCR                   |
| **1** | Style Guide compliance                                |
| **2** | Full theming + functional restoration                 |
| **3** | Component refactor (Search, Shell, Header) + Settings |
| **4** | Config screen + institutional settings                |
| **5** | Security hardening                                    |
| **6** | Testing + internationalization                        |
| **7** | Publishing prep                                       |

SDD is the permanent reference for these phases.

---

# **13. Change Control**

Any alteration to:

* Models
* Endpoints
* Identifiers
* Services
* Algorithms

**must be first added to SDD, then CCR, then implemented in code**.

