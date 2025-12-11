# **Canonical Code Registry (CCR)**

### *OA Compass Admin — Alma + OpenAthens Provisioning Cloud App*

This file defines the **only permitted names, functions, interfaces, and endpoints** in the OA Compass Admin project.

If a function/model does **not** appear in this registry, it must **not** be invented by ChatGPT or added to the codebase.

---

# **1. Canonical Project Modules**

This section defines the only permitted **Angular components** in the OA Compass Admin Cloud App. These names, responsibilities, and boundaries must match the SDD exactly. No additional components may be introduced without updating the SDD, CCR, and manifest.

---

## **1.1 Angular Components (Canonical)**

| Component Name         | Description (Revised for clarity + SDD alignment)                        |
| ---------------------- | ------------------------------------------------------------------------ |
| `AppHeaderComponent`   | Header bar with app title, proxy-status indicator, settings/config links |
| `UserSearchComponent`  | Alma user search UI (manual search path)                                 |
| `UserShellComponent`   | Orchestrates selected Alma user → info → OA status → actions             |
| `UserInfoComponent`    | Displays normalized Alma user details                                    |
| `OAStatusComponent`    | Shows last OA workflow status & sanitized proxy debug output             |
| `OAProvisionComponent` | Create / Sync / Resend actions; workflow entry point                     |
| `ToastComponent`       | Temporary themed notifications                                           |
| `SettingsComponent`    | User-level settings (CloudAppSettingsService)                            |
| `ConfigComponent`      | Institution-level configuration (CloudAppConfigService)                  |

---

### **1.2 Component Boundary Rules**

The following rules are mandatory and enforce SDD alignment:

1. **Components must remain thin**. They may:

   * Accept inputs
   * Emit outputs/events
   * Bind UI elements
   * Display workflow state

   They **may NOT** perform:

   * Alma REST requests
   * OA proxy calls
   * Username logic
   * OA workflow logic
   * Data normalization

2. **All business logic lives in services** (AlmaUserService, OAProxyService, OAWorkflowService, StateService).

3. **All OA workflows must pass through OAWorkflowService**.

4. **Components must be theme-aware**, using Cloud App Material styling (no inline CSS).

5. **Entity-aware UX** must be initiated in UserShellComponent based on EntityContextService state.

---

### **1.3 Reserved Component Names**

These component names may never change without an SDD revision:

* `AppHeaderComponent`
* `UserSearchComponent`
* `UserShellComponent`
* `UserInfoComponent`
* `OAStatusComponent`
* `OAProvisionComponent`
* `ToastComponent`
* `SettingsComponent`
* `ConfigComponent`

---

# **2. Canonical Angular Services**

This section defines the **only allowed Angular services**, their canonical method signatures, responsibilities, and boundaries. These definitions must match the SDD exactly. No additional services or methods may be created without updating the SDD + CCR.

---

# **2.1 AlmaUserService (Canonical)**

Provides all Alma Users API interactions and Alma‑side normalization + write‑back logic.

## **Allowed Public Methods**

```ts
getUser(primaryId: string): Observable<AlmaUser>;
```

* Fetches the full Alma user record (`view=full`).
* Must normalize Alma structures (identifier arrays, notes, email).

```ts
updateUserIdentifiers(
  primaryId: string,
  identifiers: AlmaIdentifier[]
): Observable<AlmaUser>;
```

* Performs a full user PUT with updated identifiers.
* Must preserve unrelated Alma fields.

```ts
writeBackOAUsernameBoth(
  primaryId: string,
  oaUsername: string,
  idTypeCode: string,
  primaryField: OAUsernameField,
  secondaryField: OASecondaryField
): Promise<void>;
```

* Canonical OA username write‑back method.
* Applies institution‑configured primary + optional secondary field behavior.
* Uses the full‑record PUT pattern.

## **Responsibilities (Authoritative)**

* Normalize Alma user objects for consistent UI display.
* Extract email, name, group, expiry, identifiers.
* Apply OA username write‑back algorithm:

  * `job_description`
  * `identifier` (using configured OA ID type code)
  * `user_note`
* Always perform: **GET → modify → PUT**.
* Never perform OA logic.
* Never format or transform the OA username.

---

# **2.2 OAProxyService (Canonical)**

Responsible only for communicating with the Node proxy.
All OA operations must pass through this service.

## **Allowed Public Methods**

```ts
get(payload: { username?: string | null; email?: string | null }): Promise<OAGetResponse>;
```

```ts
verify(payload: { username?: string | null; email?: string | null }): Promise<OAGetResponse>;
```

```ts
createAccount(payload: OAAccountCreate): Promise<OAProxyCreateResponse>;
```

```ts
modifyAccount(payload: OAAccountModify): Promise<OAProxyModifyResponse>;
```

```ts
resendActivation(payload: OAResendRequest): Promise<OAResendResponse>;
```

## **Proxy Endpoints (Exact)**

```
POST /v1/oa/users/get
POST /v1/oa/users/verify
POST /v1/oa/users/create
POST /v1/oa/users/modify
POST /v1/oa/users/resend-activation
```

## **Responsibilities**

* Send typed requests to proxy.
* Enforce HTTPS for proxyBaseUrl.
* Never store or request OA credentials.
* Never generate or normalize OA usernames.
* Return sanitized, typed OA responses.

---

# **2.3 EntityContextService (Canonical)**

Supports entity-aware UX by detecting selected Alma users.

## **Allowed Public Methods**

```ts
watchEntities(): Observable<Entity[]>;
getActiveEntity(): AlmaEntityUser | null;
```

## **Responsibilities**

* Subscribe to `CloudAppEventsService.entities$`.
* Detect when a User entity is active.
* Provide entity context to UserShellComponent.

## **Constraints**

* Must not fetch Alma users directly.
* Must not perform OA logic.

---

# **2.4 OAWorkflowService (Canonical)**

Central orchestrator for OA create/sync/resend workflows.
No UI component may directly call OAProxyService or AlmaUserService.

## **Allowed Public Methods**

```ts
resendActivationWorkflow(
  user: AlmaUser | null,
  selectedUserId: string | null
): Promise<OAWorkflowResult>;
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

## **Responsibilities**

* Validate Alma users for OA operations.
* Build OA create/modify payloads.
* Call `OAProxyService` for create/modify/get/resend.
* Extract **authoritative OA username** from proxy responses.
* Call `AlmaUserService.writeBackOAUsernameBoth()`.
* Return unified `OAWorkflowResult`.

## **Workflow Invariants**

* Must not perform username normalization.
* Must not bypass Alma write-back logic.
* Must not expose raw proxy errors without sanitization.

---

# **2.5 StateService (Canonical)**

A simple reactive store for UI state.

## **Allowed Public Methods**

```ts
setUser(user: AlmaUser | null): void;
getUser(): Observable<AlmaUser | null>;

setBusy(isBusy: boolean): void;
getBusy(): Observable<boolean>;

setLastProxyResponse(text: string): void;
getLastProxyResponse(): Observable<string>;
```

## **Responsibilities**

* Hold selected Alma user.
* Hold busy flag for workflow locking.
* Hold last proxy debug response.

## **Constraints**

* Must not contain business logic.
* Must not call proxy or Alma services.

---

# **3. Canonical Data Models**

This section defines the **only permitted TypeScript interfaces** for OA Compass Admin.
All data exchanged between components, services, the proxy, and Alma must use exactly these shapes.
No fields may be added or removed without updating the SDD + CCR.

---

# **3.1 AlmaUser Models (Canonical)**

These models reflect **normalized Alma user structures** as defined in SDD Section 7.

## **AlmaUser**

```ts
export interface AlmaUser {
  primary_id: string;

  first_name?: string;
  last_name?: string;

  user_group?: {
    value?: string;
    desc?: string;
  };

  contact_info?: {
    email?: {
      email_address: string;
      preferred?: boolean;
    }[];
  };

  expiry_date?: string;        // YYYY-MM-DD or Alma format
  expiration_date?: string;    // Alma variant

  user_identifier?: AlmaIdentifier[];
  user_identifiers?: { user_identifier: AlmaIdentifier[] };

  user_note?: Array<{
    note_text: string;
    user_viewable?: boolean;
    popup_note?: boolean;
  }>;

  job_description?: string;
}
```

### **Notes**

* This model matches Alma’s `view=full` response.
* `user_identifier` and `user_identifiers.user_identifier` must be normalized by AlmaUserService.
* Optional fields reflect Alma’s inconsistent record structure.
* No additional Alma fields may be used by workflow or UI components.

---

## **AlmaIdentifier**

```ts
export interface AlmaIdentifier {
  value: string;
  id_type: { value: string; desc?: string } | string;
  note?: string;
  status?: { value: string; desc?: string };
}
```

### Notes

* Used only for OA username write-back.
* Must support upsert logic based on `id_type.value` matching configured OA ID type.

---

# **3.2 OpenAthens Models (Canonical)**

These models must match the Node proxy contract exactly.

## **OAAccountCreate**

```ts
export interface OAAccountCreate {
  email: string;         // required
  first_name: string;    // required
  last_name: string;     // required
  expires: string;       // YYYY-MM-DD
  alma_group_code?: string;  // optional mapping hint
  username?: string | null;  // optional; omitted for new accounts
}
```

### Notes

* Username is **not** generated by the Cloud App.
* If omitted, OpenAthens generates the username.

---

## **OAAccountModify**

```ts
export interface OAAccountModify {
  username?: string | null;
  email?: string;
  first_name?: string;
  last_name?: string;
  expires?: string;
  alma_group_code?: string;
}
```

### Notes

* At least one of `username` or `email` must be supplied.
* Supports partial OA updates.

---

## **OALookupRequest**

```ts
export interface OALookupRequest {
  username?: string | null;
  email?: string | null;
}
```

---

## **OAGetResponse**

```ts
export interface OAGetResponse {
  account?: {
    username: string;
    email: string;
    expires: string;
    groups: string[];
  };

  normalizedUsername?: string | null;
}
```

### Notes

* `account` is omitted if not found.
* `normalizedUsername` is informational only.

---

## **OAProxyCreateResponse**

```ts
export interface OAProxyCreateResponse {
  username: string;  // authoritative OA username
  expires: string;
  email: string;
  raw?: any;        // sanitized debug
}
```

---

## **OAProxyModifyResponse**

```ts
export interface OAProxyModifyResponse {
  username: string;
  updated: boolean;
  raw?: any;
}
```

---

## **OAResendRequest**

```ts
export interface OAResendRequest {
  username?: string | null;
  email?: string | null;
}
```

## **OAResendResponse**

```ts
export interface OAResendResponse {
  sent: boolean;
  raw?: any;
}
```

---

# **3.3 UI Models (Canonical)**

Used by UserSearch and UI rendering.

## **AlmaUserLite**

```ts
export interface AlmaUserLite {
  primary_id?: string;
  first_name?: string;
  last_name?: string;
  user_group?: string;
  user_group_desc?: string;
  expiry_date_fmt?: string;
  link?: string;
}
```

---

# **3.4 OA Workflow Result Model**

Returned by OAWorkflowService.

```ts
export interface OAWorkflowResult {
  statusText: string;
  proxyDebugText?: string;
  oaUsername?: string;
  needsReload: boolean;
}
```

---

# **3.5 Canonical Type Aliases (From SDD)**

These enforce configuration-driven Alma write-back behavior.

```ts
type OAUsernameField = 'job_description' | 'identifier' | 'user_note';
```

```ts
type OASecondaryField = 'none' | 'job_description' | 'identifier' | 'user_note';
```

### Notes

* These match the configuration schema in the SDD and manifest.
* `identifier` corresponds to the configured OA ID type code.

---

# **4. Canonical Config Structures**

This section defines the **only permitted configuration and settings structures** in OA Compass Admin.
These types appear in `CloudAppSettingsService`, `CloudAppConfigService`, and any internal logic that reads/writes settings or config.
No additional config keys or structures may be introduced without updating the SDD + CCR + manifest.

---

# **4.1 User‑Level Settings (CloudAppSettingsService)**

User settings are *per‑staff‑member preferences*. They **must not** affect OA provisioning logic, Alma write‑back behavior, or proxy configuration.

```ts
export interface OAUserSettings {
  showDebugPanel: boolean;   // Toggles visibility of debug output panel
}
```

### **Canonical Default Settings**

```ts
export const DEFAULT_OA_USER_SETTINGS: OAUserSettings = {
  showDebugPanel: false
};
```

### **Rules**

* Must contain **only UI preferences**.
* Must not contain:

  * Identifier type codes
  * Proxy URLs
  * OA username rules
  * Anything influencing workflows

---

# **4.2 Institution‑Level Configuration (CloudAppConfigService)**

Configuration applies to the entire Alma institution and affects **OA + Alma workflow behavior**.

```ts
export interface OAInstitutionConfig {
  proxyBaseUrl: string;             // HTTPS endpoint of Node proxy
  oaIdTypeCode: string;             // Alma identifier type for OA username storage
  primaryField: OAUsernameField;    // job_description | identifier | user_note
  secondaryField: OASecondaryField; // none | job_description | identifier | user_note
}
```

### **Canonical Default Config (used only when fields are absent)**

```ts
export const DEFAULT_OA_INSTITUTION_CONFIG: OAInstitutionConfig = {
  proxyBaseUrl: '',
  oaIdTypeCode: '',
  primaryField: 'job_description',
  secondaryField: 'none'
};
```

### **Rules**

* `proxyBaseUrl` **must** be HTTPS except for localhost dev.
* `oaIdTypeCode` must be a valid Alma identifier type.
* `primaryField` and `secondaryField` must match the canonical unions.
* No secrets may be stored here.

---

# **4.3 Canonical Type Aliases (SDD‑Aligned)**

These define allowed Alma write‑back targets.
Used by AlmaUserService and OAWorkflowService.

```ts
type OAUsernameField = 'job_description' | 'identifier' | 'user_note';
```

```ts
type OASecondaryField = 'none' | 'job_description' | 'identifier' | 'user_note';
```

### **Notes**

* `identifier` corresponds to the configured `oaIdTypeCode`.
* `secondaryField` must be `'none'` or a valid primary field.

---

# **4.4 Canonical Settings + Config Access Pattern**

All Angular code must use the following pattern:

### **Settings (per‑user)**

```ts
this.settingsService.get().subscribe((s: OAUserSettings) => { ... });
```

### **Config (institution‑level)**

```ts
this.configService.get().subscribe((cfg: OAInstitutionConfig) => { ... });
```

### **Rules**

* All screens that depend on config must disable OA actions until config is valid.
* UI components must never cache settings/config outside StateService.

---

# **4.5 Manifest Alignment Requirements**

The following keys must appear in `manifest.json`:

### **User Settings Keys**

* `showDebugPanel`

### **Institution Config Keys**

* `proxyBaseUrl`
* `oaIdTypeCode`
* `primaryField`
* `secondaryField`

These must match exactly in:

* SDD (Section 6)
* CCR (this section)
* Code (ConfigComponent, SettingsComponent)

---

# **5. Canonical Algorithms**

This section defines the **only permitted algorithms** for OA Compass Admin.
Every workflow, service, and integration must follow these exactly.
No deviations or implicit behaviors are allowed without updating SDD + CCR.

Algorithms here must match:

* SDD Section 8 (Core Algorithms)
* AlmaUserService responsibilities
* OAWorkflowService workflow orchestrations
* OAProxyService request/response rules

---

# **5.1 OA Username Handling (Canonical)**

### **Authoritative Rules**

1. **OA generates the username**, not the Cloud App or proxy.
2. The Cloud App **must not**:

   * Construct a username
   * Enforce or apply a prefix
   * Modify, trim, or normalize the OA username
3. The authoritative username always comes from:

   * `OAProxyCreateResponse.username`, OR
   * `OAGetResponse.account.username`
4. Workflow layers treat the username as an **opaque string**.

### **Canonical Algorithm**

1. Cloud App sends `OAAccountCreate` without `username` (unless requested for modification).
2. Proxy forwards account data to OA.
3. OA returns authoritative `username`.
4. OAWorkflowService extracts the returned `username`.
5. AlmaUserService writes it back into Alma using the configured fields.

### **No Other Username Algorithm Exists**

* No prefixing rules
* No fallback generation rules
* No normalization step beyond OA’s own behavior

---

# **5.2 Alma Identifier Sync Algorithm (Canonical)**

This algorithm controls writing the OA username back into Alma.
It is the single authoritative version.

### **Algorithm Steps**

1. **GET** `/almaws/v1/users/{primaryId}?view=full&format=json`.
2. Normalize:

   * `user_identifier` (flatten arrays)
   * `user_note` (ensure array form)
3. Determine authoritative OA username from workflow.
4. Apply **primaryField** rule:

   * `job_description` → set `user.job_description`.
   * `identifier` → upsert identifier matching `oaIdTypeCode`.
   * `user_note` → upsert a note containing OA username.
5. Apply **secondaryField** rule (if not `none`).
6. Remove legacy wrapper `user_identifiers` if present.
7. **PUT** full updated user object to Alma.
8. Optionally **GET** updated user to confirm state.

### **Invariants**

* Always use full-record PUT.
* Preserve all unrelated Alma data.
* OA username is treated as opaque.
* Rules must match institutional configuration.

---

# **5.3 Smart Alma Search Algorithm (Canonical)**

Search logic used by `UserSearchComponent`.

### **Algorithm**

1. If query contains `@` → search by email.
2. Else if single token → treat as primary_id.
3. Else if comma → treat as `last, first`.
4. Else if two tokens → treat as `first last`.
5. Try phrase search (`all~phrase`).
6. Try AND-token search.
7. If no results → display "No users found".

### **Rules**

* Stop at first match or first `next` link.
* Must use AlmaWsRestService / CloudAppRestService.
* Must not perform OA logic.

---

# **5.4 Canonical Error Normalization (Proxy ↔ Cloud App)**

All OA proxy errors must follow this exact shape:

```ts
interface OAProxyError {
  error: string;        // short summary
  code: string | null;  // OA error code when available
  message: string;      // sanitized details
  status: number;       // HTTP status
}
```

### **Rules**

* No stack traces
* No OA credentials
* No raw HTML from OA errors
* Cloud App must treat this format as authoritative
* OAWorkflowService must map this to user-facing messages

---

# **5.5 Node Proxy Alma→OA Group Mapping Algorithm (Canonical)**

Performed **only** on the proxy.

### **Algorithm**

1. Receive `alma_group_code` from Cloud App.
2. Lookup policy key: `policyKey = CODE_TO_KEY[alma_group_code]`.
3. Lookup group mapping: `GROUP_MAP[policyKey]`.
4. If found, attach:

   * `groups: string[]`
   * `permissionSets: string[]`
5. If not found, attach nothing.

### **Rules**

* Mapping tables must never be exposed to the Cloud App.
* Mapping must not be performed in Angular.
* Deterministic behavior: same Alma group → same OA group set.

---

# **5.6 Canonical Busy-State Algorithm (UI)**

Manages UI workflow locking.

### **Algorithm**

1. When workflow begins, OAWorkflowService calls `stateService.setBusy(true)`.
2. All OA action buttons disable.
3. AppHeaderComponent shows busy indicator.
4. Workflow completes:

   * `stateService.setBusy(false)`.
   * OAStatusComponent updates status panel.

### **Rules**

* UI must never trigger workflows while busy.
* StateService is the single source of busy truth.

---

# **6. Node Proxy Contract — Canonical Responsibilities & API**

This section defines the **only allowed behavior, endpoints, module exports, and response contracts** for the OA Compass Admin Node Proxy.
This contract must match SDD **Section 10** exactly. No additional endpoints, parameters, or modules may be introduced without an SDD + CCR update.

---

# **6.1 Canonical Proxy Endpoints**

The proxy exposes exactly the following routes:

```
GET  /health
POST /v1/oa/users/get
POST /v1/oa/users/verify
POST /v1/oa/users/create
POST /v1/oa/users/modify
POST /v1/oa/users/resend-activation
```

### Rules

* No other endpoints may be introduced.
* All must return **JSON only**.
* All must sanitize internal errors.
* All must validate request bodies.

---

# **6.2 Proxy Responsibilities (Canonical)**

The proxy is the **only** OA integration surface. Responsibilities include:

### **1. Security Boundary**

* OA API key is stored server-side only.
* OA tenant + base URL are never sent to the browser.
* Cloud App must never receive secrets.

### **2. Validation Layer**

* Verify required fields on create/modify:

  * email
  * first_name
  * last_name
  * expires
* Ensure `username` or `email` exists for modify/verify.
* Ensure payloads are under size limit (200 KB).

### **3. OA API Client**

* Construct OA Admin API requests.
* Use header-based API key authentication.
* Forward payloads to OA.
* Return sanitized summary results.

### **4. Policy Enforcement**

* Map Alma → OA groups via `CODE_TO_KEY` and `GROUP_MAP`.
* Apply permission sets server-side only.
* Never expose mapping tables.

### **5. Error Normalization**

Return errors in canonical shape:

```ts
{
  error: string,
  code: string | null,
  message: string,
  status: number
}
```

### **6. CORS Enforcement**

* Accept only origins defined in `ALLOWED_ORIGINS`.
* Reject unknown origins with 403.
* Handle OPTIONS preflight.

### **7. Sanitized Logging**

* Log high‑level actions only.
* **Never** log API keys.
* Never log PII coming from OA.
* Never log full OA error bodies.

---

# **6.3 Canonical Module Exports**

The proxy must implement the following modules and exports only.
These match SDD Section 10.

---

## **config.js**

Must export:

```ts
PORT: number;
ALLOWED_ORIGINS: string[];
OA_BASE_URL: string;
OA_TENANT: string;
OA_API_KEY: string;
GROUP_MAP: Record<string, any>;
CODE_TO_KEY: Record<string, string>;
```

### Rules

* Must validate required env vars.
* Must not export secrets in error messages.

---

## **cors.js**

```ts
setCors(req, res, allowedOrigins): void;
```

Must:

* Apply correct headers.
* Reject unrecognized origins.
* Support OPTIONS.

---

## **oa-client.js**

```ts
httpPostJsonWithKey(url, apiKey, payload, contentType?): Promise<{ status: number, body: any }>;
httpGetJsonWithKey(url, apiKey): Promise<{ status: number, body: any }>;
normalizeUsername(username: string | null): string | null;
queryAccount(criteria: { username?: string | null; email?: string | null }): Promise<{ status: number, body: any }>;
resolveAccountIdOrThrow(criteria: { openathensId?: string; username?: string; email?: string }): Promise<string>;
```

### Rules

* Must not normalize OA usernames beyond OA’s own behavior.
* Must sanitize OA responses.
* Must not leak OA base URL or tenant info.

---

## **validators.js**

```ts
isValidEmail(email: string): boolean;
isValidDateYYYYMMDD(str: string): boolean;
validateCreatePayload(body: any): { ok: boolean; errors?: any; normalized: any };
validateModifyPayload(body: any): { ok: boolean; errors?: any; normalized: any };
```

### Rules

* Must return structured validation results.
* Must never throw raw errors.

---

## **routes/users.js**

```ts
handleHealth(req, res): void;
handleVerify(req, res): Promise<void>;
handleGetAccount(req, res): Promise<void>;
handleCreate(req, res): Promise<void>;
handleModify(req, res): Promise<void>;
handleResendActivation(req, res): Promise<void>;
```

### Required Helper Exports

```ts
sendJson(res, status, body): void;
readJsonBody(req): Promise<any>;
derivePolicy({ alma_group_key, alma_group_code }): any | null;
sendOAError(res, status, oaErrorObj): void;
checkRequiredEnv(keys: string[]): { ok: boolean; missing: string[] };
```

### Rules

* Must sanitize OA errors before returning.
* Must limit body size.
* Must not contain business logic.

---

## **server.js**

Entry point only. Must:

* Create HTTP server.
* Wire CORS + OPTIONS handler.
* Delegate all OA routes to `routes/users.js`.
* Contain **no OA logic**.

No exports.

---

# **6.4 Canonical Response Contracts**

All success + error responses must follow stable shapes.

### **Success (Get) Example**

```ts
{
  account: {
    username: string,
    email: string,
    expires: string,
    groups: string[]
  },
  normalizedUsername?: string | null
}
```

### **Success (Create) Example**

```ts
{
  username: string,
  expires: string,
  email: string,
  raw?: any
}
```

### **Error Example (Canonical)**

```ts
{
  error: "OA create failed",
  code: "OA-400",
  message: "Invalid expiry date",
  status: 400
}
```

### Rules

* No stack traces.
* No nested OA errors.
* No HTML.
* Must be consumable by OAWorkflowService.

---

# **6.5 Canonical Proxy Invariants**

1. OA usernames are always treated as opaque.
2. Cloud App must never generate or normalize usernames.
3. Mapping must remain server-side only.
4. No additional endpoints or modules may be added.
5. Proxy must never return secrets.
6. All responses must be JSON.

---

# **7. Allowed External Dependencies (Canonical)**

This section defines the **only permitted external libraries and runtime dependencies** for OA Compass Admin — both frontend and backend.
These constraints ensure Cloud App compatibility, predictable build output, security, and maintainability.

No additional dependencies may be introduced without updating SDD + CCR + PROJECT_PLAN.

---

# **7.1 Frontend Allowed Dependencies (Angular App)**

The Cloud App may use **only** the following libraries:

### **Angular Framework**

* `@angular/core`
* `@angular/common`
* `@angular/forms`
* `@angular/router`
* `@angular/platform-browser`
* `@angular/platform-browser/animations`
* `rxjs`

### **Angular Material**

* All components from `@angular/material` are permitted.
* Must follow Alma Cloud App theming rules (no custom palette overrides).

### **Ex Libris Cloud App SDK**

* `@exlibris/exl-cloudapp-angular-lib`

  * CloudAppEventsService
  * CloudAppSettingsService
  * CloudAppConfigService
  * CloudAppRestService
  * CloudAppTranslateModule
  * MaterialModule

### **Styling**

* SCSS (Sass)
* Alma Cloud App theme mixins

### **Internationalization**

* JSON translation files only (e.g., `assets/i18n/en.json`)
* No external i18n libraries

### **Explicitly Forbidden**

* No third-party HTTP clients (Axios, etc.)
* No state management libraries (NgRx, Akita, etc.) — StateService is canonical
* No DOM manipulation libraries (jQuery)
* No custom theme engines or CSS frameworks (Tailwind, Bootstrap)
* No external OAuth or authentication libraries

---

# **7.2 Backend Allowed Dependencies (Node Proxy)**

The Node proxy must remain lightweight, secure, and dependency-minimal.

### **Allowed Built-in Modules**

* `http`
* `https`
* `fs` (only for reading configuration files if needed)
* `url`
* `crypto` (if OA API digesting is ever needed)

### **Allowed NPM Packages**

* `dotenv` (optional; only for local development)

### **Explicitly Forbidden**

* No Express / Fastify / Koa / Hapi
* No body-parser external modules
* No database clients
* No ORM libraries
* No request libraries (e.g., axios, request, superagent)
* No cookie/session libraries
* No templating engines

The proxy must remain a simple functional HTTP server defined by SDD Section 10.

---

# **7.3 Reserved Names (Canonical)**

These names must **never change** unless approved through SDD + CCR revision.
They are referenced throughout components, services, proxy, documentation, and workflows.

### **Service + Component Names**

* `AlmaUserService`
* `OAProxyService`
* `EntityContextService`
* `OAWorkflowService`
* `StateService`
* `UserShellComponent`
* `UserSearchComponent`
* `UserInfoComponent`
* `OAProvisionComponent`
* `OAStatusComponent`
* `AppHeaderComponent`
* `SettingsComponent`
* `ConfigComponent`
* `ToastComponent`

### **Models / Interfaces**

* `AlmaUser`
* `AlmaIdentifier`
* `OAAccountCreate`
* `OAAccountModify`
* `OAGetResponse`
* `OAProxyCreateResponse`
* `OAProxyModifyResponse`
* `OAResendRequest`
* `OAResendResponse`
* `OAWorkflowResult`
* `AlmaUserLite`

### **Config + Settings Types**

* `OAUserSettings`
* `OAInstitutionConfig`
* `OAUsernameField`
* `OASecondaryField`

### **Proxy Helpers**

* `sendJson`
* `readJsonBody`
* `derivePolicy`
* `sendOAError`
* `checkRequiredEnv`

### **Proxy Environment Variables**

* `OA_API_KEY`
* `OA_TENANT`
* `OA_BASE_URL`
* `PORT`
* `ALLOWED_ORIGINS`
* `GROUP_MAP`
* `CODE_TO_KEY`

### **Canonical Endpoint Paths**

```
/v1/oa/users/get
/v1/oa/users/verify
/v1/oa/users/create
/v1/oa/users/modify
/v1/oa/users/resend-activation
/health
```

### **Canonical Error Shape**

```ts
{
  error: string,
  code: string | null,
  message: string,
  status: number
}
```

---

# **7.4 Naming Invariants**

The following rules apply to preserve architectural integrity:

1. **No renaming** of canonical services, components, or endpoints.
2. **No aliasing** (e.g., `OaProxyService`, `UserShell`, etc.).
3. **No additional models** beyond those defined here.
4. **No additional config keys** beyond those defined in CCR Section 4.
5. **No additional environment variables** for proxy.
6. **No custom HTTP routes** added to the proxy.
7. **No additional NPM libraries** without architectural approval.

---