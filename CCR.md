# **Canonical Code Registry (CCR)**

### *OA Compass Admin — Alma + OpenAthens Provisioning Cloud App*

### **Option A — Entity-Aware Alma Cloud App Architecture**

This file defines the **only permitted names, functions, interfaces, and endpoints** in the OA Compass Admin project.

If a function/model does **not** appear in this registry, it must **not** be invented by ChatGPT or added to the codebase.

---

# **1. Canonical Project Modules**

These are the only modules/components/services allowed.

## **1.1 Angular Components**

| Component Name         | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `AppHeaderComponent`   | Header bar, title, settings button               |
| `UserSearchComponent`  | Alma user search UI                              |
| `UserShellComponent`   | Container for selected user + actions            |
| `UserInfoComponent`    | Alma user details panel                          |
| `OAStatusComponent`    | OA status panel                                  |
| `OAProvisionComponent` | Create / Sync / Verify OA account                |
| `ToastComponent`       | Small temporary notifications                    |
| `SettingsComponent`    | User-level settings (CloudAppSettingsService)    |
| `ConfigComponent`      | Institution-level config (CloudAppConfigService) |

### **Note**

Components **must remain “thin.”**
Business logic belongs in the services below.

---

# **2. Canonical Angular Services**

Only these services may contain application logic.

---

## 2.1 `AlmaUserService` (updated)

```ts
// Canonical AlmaUserService methods
getUser(primaryId: string): Observable<AlmaUser>;

updateUserIdentifiers(
  primaryId: string,
  identifiers: AlmaIdentifier[]
): Observable<AlmaUser>;

writeBackOAUsernameBoth(
  primaryId: string,
  oaUsername: string,
  idTypeFromCaller?: string,
  primaryField?: OAUsernameField,
  secondaryField?: OASecondaryField
): Promise<void>;
```

**Responsibilities (amended):**

* Fetch Alma user w/ `view=full`.
* Build updated Alma record for full-entity PUT.
* Manage OA username write-back to one or two fields based on `OACompassSettings`:

  * Primary: `job_description` **or** `identifier02` **or** `user_note`.
  * Secondary: `none` **or** any of the above.
* Respect the configured OA identifier type code when writing Alma identifiers.

---

## **2.2 `OAProxyService`**

Handles communication with the Node proxy.

### Methods (canonical)

```ts
get(payload: { username?: string; email?: string }): Promise<OAGetResponse>
verify(payload: { username?: string; email?: string }): Promise<any>
createAccount(payload: OAAccountCreate): Promise<any>
modifyAccount(payload: OAAccountModify): Promise<any>
resendActivation(payload: { username: string }): Promise<any>
```

### Proxy endpoints (canonical)

```
POST /v1/oa/users/get
POST /v1/oa/users/verify
POST /v1/oa/users/create
POST /v1/oa/users/modify
POST /v1/oa/users/resend-activation
```

---

## **2.3 `EntityContextService`**

Used to support Option A (entity-aware UX).

### Methods (canonical)

```ts
watchEntities(): Observable<Entity[]>
getActiveEntity(): AlmaEntityUser | null
```

### Responsibilities

* Listen to `CloudAppEventsService.entities$`
* Determine if a User is selected in Alma
* Provide context to UserShell

---

## **2.4 `StateService`** *(optional; introduced Phase 4)*

### Methods (canonical)

```ts
setUser(user: AlmaUser | null): void
getUser(): Observable<AlmaUser | null>

setBusy(isBusy: boolean): void
getBusy(): Observable<boolean>

setLastProxyResponse(text: string): void
getLastProxyResponse(): Observable<string>
```

---

# **3. Canonical Data Models**

These are the only permitted TypeScript interfaces.

## **3.1 AlmaUser Models**

### **AlmaUser**

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
  expiration_date?: string;    // Some institutions use this

  user_identifier?: AlmaIdentifier[];
  user_identifiers?: { user_identifier: AlmaIdentifier[] };
}
```

---

### **AlmaIdentifier**

```ts
export interface AlmaIdentifier {
  value: string;
  id_type: { value: string; desc?: string } | string;
  note?: string;
  status?: { value: string; desc?: string };
}
```

---

## 3.2 OpenAthens Models (updated)

```ts
export interface OAAccountCreate {
  // NOTE: username is intentionally omitted
  // OpenAthens will generate the username server-side.
  email: string;
  first_name: string;
  last_name: string;
  expires: string;          // YYYY-MM-DD
  alma_group_code: string;
}

export interface OAAccountModify {
  // For modify, username is optional and used only as a lookup hint.
  // The proxy may also locate the account by email or openathens_id.
  username?: string;

  email?: string;
  first_name?: string;
  last_name?: string;
  expires?: string;
  alma_group_code?: string;
}

export interface OAGetResponse {
  account?: {
    username: string;
    email: string;
    expires: string;
    groups: string[];
  };

  // If the proxy normalizes or echoes a username hint, it appears here.
  normalizedUsername?: string;
}
```

**Notes:**

* The frontend never generates a canonical OA username.
* `OAAccountCreate` must not include a `username` property; OA generates it.
* `OAAccountModify` fields are optional so the proxy can perform partial updates.

---

## **3.3 UI Models**

### **Search result (Lite Alma user)**

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

# **4. Canonical Config Structures**

These values appear in `/models/oa-settings.model.ts`.

## **4.1 OACompassSettings**

```ts
export interface OACompassSettings {
  oaPrimaryField: 'job_description' | 'identifier02' | 'user_note';
  oaSecondaryField: 'none' | 'job_description' | 'identifier02' | 'user_note';
  showDebugPanel: boolean;
}
```

### **DEFAULT_OA_SETTINGS**

```ts
export const DEFAULT_OA_SETTINGS: OACompassSettings = {
  oaPrimaryField: 'job_description',
  oaSecondaryField: 'identifier02',
  showDebugPanel: true
};
```

---

# **5. Canonical Algorithms**

Only these algorithms may be used.
They must match the SDD exactly.

---

## 5.1 OA Username Handling (updated)

**Old rule (remove):**

> `normalized = OA_USERNAME_PREFIX + primary_id`

**New rule:**

* The canonical OA username is generated **inside OpenAthens**, according to their platform rules.
* The Node proxy **must not** enforce a local prefix-based normalization scheme.
* The proxy simply:

  * Sends the required account attributes (email, name, expiry, groups).
  * Receives the created/updated OA account from the OA API.
  * Returns the authoritative `username` from OA in its response payload.
* The Cloud App treats the returned `username` (or `summary.username`) as canonical for display and Alma write-back.

There is no longer a single "username normalization" algorithm in this project; that behavior lives entirely in OpenAthens.

---

## 5.2 Alma Identifier Sync Algorithm (updated)

When writing an OA username back to Alma, the app **must** follow this algorithm:

1. **GET** the full Alma user record with `view=full`.
2. Normalize `user.user_identifier` into a mutable array (lifting from any wrapped `user_identifiers.user_identifier`).
3. Compute the OA username note string (e.g., `"OpenAthens: <username>"`).
4. Apply the configured **primary field** (`OACompassSettings.oaPrimaryField`):

   * `job_description` → set `user.job_description`.
   * `identifier02` → upsert an identifier using the configured OA ID type code.
   * `user_note` → add/update a `user_note` mentioning the OA username.
5. Apply the configured **secondary field** (`oaSecondaryField`), if not `'none'`, using the same rules.
6. Remove any legacy `user.user_identifiers` wrapper once `user.user_identifier` is authoritative.
7. **PUT** the entire updated user object back to Alma (`/almaws/v1/users/{primaryId}?format=json`).

The Cloud App must never send partial Alma user payloads for this operation.

---

## **5.3 Smart Alma Search Algorithm**

1. If contains “@” → search by email
2. If single token → treat as primary_id
3. If comma → treat as `last, first`
4. If two tokens → treat as `first last`
5. Search `"all~phrase"`
6. Search `AND` tokens

Stop at first match or first `next` link.

---

## 6. Node Proxy Contract — Responsibilities (updated)

The proxy exposes only these endpoints (unchanged):

```text
POST /v1/oa/users/get
POST /v1/oa/users/verify
POST /v1/oa/users/create
POST /v1/oa/users/modify
POST /v1/oa/users/resend-activation
GET  /health   (ops/monitoring only)
```

**Updated responsibilities:**

* Never return OA credentials or API keys.
* Never accept OA API configuration (tenant, base URL, org identifiers, API key) from the browser.
* **Do not** require or enforce a client-supplied username prefix.
* Allow OpenAthens to generate usernames for new accounts; echo the OA-generated value in responses.
* Validate required fields for create/modify requests:

  * email
  * first_name
  * last_name
  * expiry (YYYY-MM-DD)
* Map Alma group code → OA group / permission sets using `CODE_TO_KEY` and `GROUP_MAP`.
* Sanitize OA errors before returning them to the Cloud App.
* Enforce a strict CORS allowlist based on `ALLOWED_ORIGINS`.

The Cloud App must treat the proxy as the **only** integration surface with OpenAthens.

---

# **7. Allowed External Dependencies**

Frontend:

* Angular
* Angular Material
* CloudApp SDK
* RxJS
* TypeScript
* SCSS

Backend:

* Node.js (no frameworks)
* `dotenv` (optional)
* `https` / `http` modules
* No Express / Koa / Fastify (by design)

---

## 8. Reserved Names (updated)

These names must **never** be changed in the TypeScript / Node codebase:

* `OACompassSettings`
* `DEFAULT_OA_SETTINGS`
* `writeBackOAUsernameBoth`
* `normalizedUsername`
* All proxy endpoint paths:

  * `/v1/oa/users/get`
  * `/v1/oa/users/verify`
  * `/v1/oa/users/create`
  * `/v1/oa/users/modify`
  * `/v1/oa/users/resend-activation`
  * `/health`

The previous hard-coded constant `OA_ID_TYPE = "02"` and `OA_USERNAME_PREFIX` are no longer part of the canonical registry; OA ID type and any username prefixing behavior are now driven by configuration and/or the upstream OpenAthens platform rather than fixed code constants.
