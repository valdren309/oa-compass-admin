# **System Design Document (SDD)**

### *OA Compass Admin — Alma + OpenAthens Provisioning Cloud App*

### **Option A — Entity-Aware Alma Cloud App Architecture**

---

# **1. Purpose of This Document**

This System Design Document (SDD) defines the **authoritative architecture**, **modules**, 
**interfaces**, **core workflows**, **data structures**, and **algorithms** for the 
OA Compass Admin Cloud App and its companion Node.js proxy.

It ensures that all contributors—human or AI—operate within the same controlled, 
well-defined boundaries.

## The SDD exists to guarantee:

1. **Consistency**  
   All components, services, models, endpoints, and behaviors must match what is 
   defined here and in the Canonical Code Registry (CCR). No new names or structures 
   may be invented without updating this document first.

2. **Stability**  
   The SDD prevents architectural drift by clearly defining component boundaries, 
   service responsibilities, workflow rules, and proxy behavior.

3. **Security**  
   All OpenAthens operations are strictly server-side. No OA credentials, tenant data, 
   or sensitive identifiers ever enter the Cloud App runtime.

4. **Maintainability**  
   The codebase must remain modular, testable, theme-aware, standards-compliant, and 
   easy to reason about for future developers.

5. **Architecture Governance**  
   The SDD overrides all prior assumptions. If code and SDD disagree, the SDD wins. 
   Any change to architecture, workflows, data models, or endpoints must be added to 
   the SDD **before** implementation.

## Scope

This document governs the **entire system**, including:

- Alma Cloud App frontend (Angular)
- Node.js OA Proxy backend
- Alma integration workflows
- OA workflow orchestration
- Data models shared across layers
- Allowed configuration and settings
- Theming, accessibility, and internationalization requirements
- Entity-aware behavior within the Alma UI

The SDD + CCR together form the **complete technical contract** for this project.

---

# **2. System Overview**

OA Compass Admin is a secure, entity-aware Alma Cloud App used to provision, modify, 
and synchronize OpenAthens accounts using Alma user data. All OpenAthens integration 
is performed through a hardened Node.js proxy, ensuring strict security boundaries 
and consistent behavior across institutions.

OpenAthens is treated as the authoritative source of OA usernames.
The Cloud App never generates, modifies, or infers OA usernames independently.
Any username returned by OpenAthens is treated as an opaque value and may be
written back into Alma only according to institution-level configuration.

The application operates in two contexts:

1. **Entity-Aware Mode**  
   When opened on an Alma User record, the app automatically loads that user via the 
   CloudAppEventsService entity context.

2. **Search Mode**  
   When no entity context is present, the app provides a smart Alma user search 
   interface that supports multiple matching strategies (email → ID → name, etc.).

## **Core Functional Responsibilities**

- Retrieve Alma users via entity context or manual search.
- Query OpenAthens accounts through the Node proxy.
- Perform OA Create, Modify, and Resend Activation workflows.
- Synchronize the OA-generated username into Alma identifiers, notes, or job 
  description fields based on institution configuration.
- Display workflow progress, errors, and sanitized proxy debug output.
- Provide user-level settings (UI preferences) and institution-level configuration 
  (OA identifier type, write-back locations, proxy URL).
- Operate with full Alma theming (Light/Dark/Wide) and internationalization support.

## **Core Architectural Rule**

> **All OpenAthens Admin API calls are made exclusively through the OA Node Proxy.  
> The Cloud App never handles OA credentials, never performs direct OA requests,  
> and never generates or modifies OA usernames.**

## **High-Level Architecture Responsibilities**

### **Frontend (Angular Cloud App)**

- Entity context detection and user selection  
- UI components (search, shell, info, provision, status, toast)  
- Workflow orchestration using `OAWorkflowService`  
- Alma integration using `AlmaUserService`  
- Global state management via `StateService`  
- Presentation-only components with no OA or Alma logic  
- Internationalized text and Alma-compliant theming  
- Settings (per-user) and configuration (per institution)

### **Backend (Node Proxy)**

- Full OA API integration using environment-stored credentials  
- CORS enforcement for allowed Alma Cloud App origins  
- Request validation and canonical error normalization  
- Group/permission mapping based on institution policy  
- No UI formatting, business logic, or username generation  
- Strict contract defined in CCR

### **OpenAthens Admin API**

- Generates authoritative OA usernames  
- Stores and manages OA accounts, permissions, and groups  
- Acts as the identity authority for all OA workflows

## **System Guarantees**

- OA usernames always originate from OpenAthens.  
- Alma updates always follow GET → modify → PUT semantics.  
- No secrets or sensitive OA data reach the frontend.  
- All modules, names, and workflows must match SDD + CCR definitions.  

---

# **3. System Architecture**

The system architecture for OA Compass Admin consists of three clearly separated layers: the **Alma Cloud App frontend (Angular)**, the **OA Node Proxy backend**, and the **OpenAthens Admin API**. Each layer has strict responsibilities and boundaries to ensure security, maintainability, and predictable behavior across all environments.

---

# **3.1 High-Level Architecture Diagram**

```
+-------------------------------------------------------+
|        Alma Cloud App Runtime (Angular 16+)           |
|-------------------------------------------------------|
|  • App Shell (AppComponent + Manifest)                |
|  • App Header                                         |
|  • Main (entity-aware root view)                      |
|  • User Search Component                              |
|  • User Shell Component                               |
|       • User Info                                     |
|       • OA Status                                     |
|       • OA Provision (Create/Sync/Resend)             |
|       • Debug Panel (optional)                        |
|  • Toast / Alerts                                     |
|  • Settings (user-level)                              |
|  • Configuration (institution-level)                  |
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
|  • Environment-based configuration                    |
|  • Hardened OA request handlers                       |
|  • Validate request payloads                          |
|  • Enforce strict CORS allowlist                      |
|  • Map Alma groups → OA groups/permissions            |
|  • Never return secrets or internal OA data           |
|  • Canonical error normalization                      |
|                                                       |
|  JSON endpoints consumed by Cloud App:                |
|   GET  /health                                        |
|   POST /v1/oa/users/get                               |
|   POST /v1/oa/users/verify                            |
|   POST /v1/oa/users/create                            |
|   POST /v1/oa/users/modify                            |
|   POST /v1/oa/users/resend-activation                 |
+-------------------------------------------------------+
                            |
                   OA Admin API (external)
                            |
+-------------------------------------------------------+
|                 OpenAthens Admin / Compass            |
|   • Generates authoritative usernames                 |
|   • Stores accounts, groups, and permissions          |
+-------------------------------------------------------+
```

---

# **3.2 Frontend Responsibilities (Angular Cloud App)**

The frontend is responsible for:

* Detecting Alma entity context and loading users automatically.
* Providing the Smart Search Algorithm when no context is available.
* Displaying user information (identifiers, expiry, contact data, group).
* Displaying OA account status and debug output.
* Initiating Create, Sync, and Resend workflows (UI triggers only).
* Persisting user-level preferences (settings) and institution-level configuration.
* Handling all workflows through **OAWorkflowService**, not components.
* Performing Alma updates through **AlmaUserService** only.
* Maintaining global UI state via **StateService**.
* Rendering theme-aware UI (Light/Dark/Wide support).
* Ensuring full internationalization via translation files.

### **Frontend Boundary Rules**

* The frontend **may not** call the OA Admin API directly.
* The frontend **never** handles OA credentials.
* The frontend **never** constructs OA usernames.
* The frontend **never** performs partial Alma updates (only GET → modify → PUT via AlmaUserService).
* All business logic lives in services, never in components.

---

# **3.3 Backend Responsibilities (Node Proxy)**

The Node proxy enforces the primary security boundary between Alma and OpenAthens.

### **Proxy Responsibilities**

* Handle all OA Admin API communication.
* Validate incoming payloads for create/modify/lookup.
* Enforce CORS allowlists to restrict access to Alma Cloud App origins.
* Map Alma group → OA groups/permissions via `GROUP_MAP` and `CODE_TO_KEY`.
* Normalize and sanitize all OA errors.
* Never expose OA API keys, tenant details, or sensitive metadata.
* Never generate usernames—OA is the authoritative source.
* Return consistent JSON responses consumed by OAWorkflowService.

### **Proxy Module Structure**

* `config.js` — Loads and validates environment variables.
* `cors.js` — Applies strict CORS policy.
* `oa-client.js` — Low-level HTTPS OA Admin API calls.
* `validators.js` — Input validation for all OA operations.
* `routes/users.js` — Implements all /v1/oa/users/* endpoints.
* `server.js` — Wires CORS, routing, health checks; contains no OA logic.

---

# **3.4 OpenAthens Admin API Responsibilities**

OpenAthens Admin API acts as the **identity authority**:

* Generates OA usernames according to tenant rules.
* Stores accounts, expiry rules, email, permissions, and groups.
* Ensures uniqueness and consistency across the tenant.
* Responds to create/modify/verify/resend requests made through the proxy.

The Cloud App and proxy must treat OA as the **single source of truth** for:

* OA usernames
* OA account existence
* OA attributes

---

# **3.5 System Guarantees**

Across the full architecture, the system guarantees:

1. **Security** — OA secrets never leave the server.
2. **Predictability** — All workflows follow strict, deterministic steps.
3. **Consistency** — Alma updates follow a mandatory GET → modify → PUT cycle.
4. **Correctness** — OA usernames always originate from OpenAthens.
5. **Compliance** — UI meets Alma theming, accessibility, and Cloud App SDK standards.
6. **Separation of Concerns** — Frontend, proxy, and OA responsibilities never overlap.

---

# **4. Cloud App Component Architecture**

OA Compass Admin is built entirely from **small, testable, theme-aware Angular components**. Each component is responsible only for rendering UI and emitting user actions—**never for business logic**. All workflows, Alma updates, and OA interactions occur in services, ensuring testability and architectural consistency.

---

## **4.1 High-Level Component List**

| Component                | Responsibility                                                   |
| ------------------------ | ---------------------------------------------------------------- |
| **AppHeaderComponent**   | Top bar, navigation (Settings/Config), status indicators         |
| **UserSearchComponent**  | Smart search UI for Alma users (fallback when no entity context) |
| **UserShellComponent**   | Wrapper for user info, OA actions, and debug output              |
| **UserInfoComponent**    | Display Alma user metadata, identifiers, expiry, group, contact  |
| **OAStatusComponent**    | Show OA workflow status + sanitized debug response               |
| **OAProvisionComponent** | Buttons for Create, Sync, Resend workflows                       |
| **ToastComponent**       | Lightweight notification display                                 |
| **SettingsComponent**    | User-level UI preferences (via CloudAppSettingsService)          |
| **ConfigComponent**      | Institution-level OA settings (via CloudAppConfigService)        |

All component names must match the **CCR** and may not be renamed without updating the SDD and CCR.

---

## **4.2 Component Hierarchy**

```
MainComponent
 ├── AppHeaderComponent
 ├── UserSearchComponent        (when no entity context)
 └── UserShellComponent         (when a user is selected or entity-aware)
       ├── UserInfoComponent
       ├── OAStatusComponent
       ├── OAProvisionComponent
       └── ToastComponent

/settings → SettingsComponent
/config   → ConfigComponent
```

This structure ensures **strict separation** between UI display and workflow logic.

---

## **4.3 Component Responsibilities (Detailed)**

### **MainComponent**

* Detect Alma entity context using EntityContextService.
* Show UserSearchComponent or UserShellComponent depending on context.
* Bind to StateService for busy state + debug output.
* Coordinate routing to Settings/Config.

### **AppHeaderComponent**

* Display the app title and theme-aware header.
* Provide navigation to Settings and Config.
* Reflect busy state when workflows are running.

### **UserSearchComponent**

* Implements the Smart Search Algorithm.
* Supports search by email, primary ID, name tokens.
* Emits selected user ID to MainComponent.
* Contains **no OA or Alma logic**.

### **UserShellComponent**

* Displays all user-focused components once a user is selected.
* Hosts the debug panel.
* Emits Create/Sync/Resend requests to OAWorkflowService.

### **UserInfoComponent**

* Displays Alma user details:

  * name
  * primary ID
  * email
  * user group
  * expiry date
  * identifiers
* Extracts OA username for display only.
* Performs **no write-back logic**.

### **OAStatusComponent**

* Shows workflow results returned from OAWorkflowService.
* Displays sanitized debug output in debug mode.
* Must never expose OA secrets.

### **OAProvisionComponent**

* Renders Create, Sync, Resend buttons.
* Emits workflow actions but never performs the workflows.
* Disables itself when `busy = true`.

### **ToastComponent**

* Displays transient success/error alerts.
* Fully theme-aware (Light/Dark/Wide).

### **SettingsComponent**

* Stores UI-only preferences via CloudAppSettingsService.
* May not contain any OA or Alma logic.

### **ConfigComponent**

* Stores institution-level OA configuration:

  * proxyBaseUrl (HTTPS required)
  * Email domain exclusion rule (skip OA provisioning)
  * oaIdTypeCode
  * primary/secondary OA username fields
* Must validate configuration input.
* May not access or display OA secrets.

---

## **4.4 Component Architecture Rules**

1. **No component may perform business logic.**

   * OAWorkflowService handles all Create/Sync/Resend logic.
   * AlmaUserService handles all Alma GET/PUT logic.

2. **Components communicate only through Inputs/Outputs + StateService.**

3. **All text must be internationalized** using CloudAppTranslateModule.

4. **All styling must be theme-aware**, using SCSS and Alma theme tokens.

5. **No inline styles or hard-coded colors allowed.**

6. **All OA and Alma operations must occur in services, never components.**

7. **Debug output must be sanitized** unless debug mode is enabled.

---

# **5. Services**

OA Compass Admin uses a **service‑centric architecture** in which *all* business logic, workflow orchestration, Alma communication, proxy interaction, and state management reside in Angular services. Components remain thin, presentational, and side‑effect free.

This section defines the authoritative responsibilities and APIs of all frontend services.

---

# **5.1 AlmaUserService**

### **Purpose**

The single, authoritative interface for interacting with the Alma Users API. Responsible for all reads and writes to Alma user records.

### **Responsibilities**

* Fetch full Alma user records (`view=full`).
* Normalize Alma structures into consistent models for UI.
* Extract identifiers, emails, expiry dates, user groups, and OA username fields.
* Validate whether an Alma user contains required fields for OA operations.
* Apply OA username write‑back rules using institution configuration.
* Perform full‑record PUT updates (no PATCH/partial updates allowed).

### **Canonical Methods** (must match CCR)

```ts
getUser(primaryId: string): Promise<AlmaUser>;
updateUser(fullUser: AlmaUser): Promise<AlmaUser>;
normalizeFullUser(user: any): AlmaUser;
validateUserForOA(user: AlmaUser): ValidationResult;
writeBackOAUsernameBoth(
  primaryId: string,
  oaUsername: string,
  idTypeCode: string,
  primaryField: OAUsernameField,
  secondaryField: OASecondaryField
): Promise<void>;
getOAUsernameFromIdentifiers(user: AlmaUser, idType: string): string | null;
```

### **Rules**

* **All Alma writes must follow GET → modify → PUT.**
* The service must gracefully handle legacy Alma structures such as:

  * `user_identifier[]`
  * `user_identifiers.user_identifier[]`
* The service may not invent or transform OA usernames.
* The service may not communicate with OpenAthens directly.

---

# **5.2 OAProxyService**

### **Purpose**

Provides all communication with the Node proxy. Wraps HTTP calls and exposes typed methods used by OAWorkflowService.

### **Responsibilities**

* POST to `/v1/oa/users/*` endpoints.
* Enforce HTTPS‑only proxy URLs.
* Load `proxyBaseUrl` from CloudAppConfigService.
* Return typed responses only.
* Never store or forward OA secrets.

### **Canonical Methods** (must match CCR)

```ts
createAccount(payload: OAAccountCreate): Promise<OAProxyCreateResponse>;
modifyAccount(payload: OAAccountModify): Promise<OAProxyModifyResponse>;
getAccount(payload: OALookupRequest): Promise<OAGetResponse>;
verify(payload: OAVerifyRequest): Promise<OAVerifyResponse>;
resendActivation(payload: OAResendRequest): Promise<OAResendResponse>;
```

### **Rules**

* The service does not contain workflow logic.
* The service must not transform usernames coming from OA.
* All errors must be returned exactly as normalized by the proxy.

---

# **5.3 EntityContextService**

### **Purpose**

Enables **entity‑aware mode**, allowing the app to load Alma users automatically when opened on a User page in Alma.

### **Responsibilities**

* Subscribe to `CloudAppEventsService.entities$`.
* Detect when the active entity is an Alma User.
* Pass the user primary ID to MainComponent or StateService.
* Provide fallback when no entity context exists.

### **Rules**

* Must never perform IO (no REST calls); only signal context changes.
* May not trigger workflows directly.

---

# **5.4 OAWorkflowService**

### **Purpose**

The central orchestrator for **Create**, **Sync**, and **Resend Activation** workflows. Coordinates AlmaUserService and OAProxyService.

### **Responsibilities**

* Validate Alma user readiness for OA.
* Build OA create/modify payloads.
* Call OAProxyService endpoints.
* Interpret OA results and errors.
* Extract authoritative OA username from OA responses.
* Write OA username back to Alma via AlmaUserService.
* Produce a canonical `OAWorkflowResult` for UI components.

### **Canonical Workflow Methods** (CCR‑governed)

```ts
createAccountWorkflow(...): Promise<OAWorkflowResult>;
syncAccountWorkflow(...): Promise<OAWorkflowResult>;
resendActivationWorkflow(...): Promise<OAWorkflowResult>;
```

### **Workflow Invariants**

* OA username must always come from OA, never generated locally.
* Sync must be idempotent (modify if exists, create if missing).
* Workflows may not run concurrently (`busy` state enforced).
* All errors must be surfaced in OAStatusComponent through StateService.

---

# **5.5 StateService**

### **Purpose**

A lightweight, global reactive state store for UI‑relevant information.

### **Responsibilities**

* Track current Alma user object.
* Track global busy state.
* Track last proxy response (for debug panel).
* Provide observable streams for component binding.

### **Canonical Methods**

```ts
setUser(user: AlmaUser | null): void;
getUser(): Observable<AlmaUser | null>;

setBusy(value: boolean): void;
getBusy(): Observable<boolean>;

setLastProxyResponse(text: string): void;
getLastProxyResponse(): Observable<string>;
```

### **Rules**

* StateService may not perform workflows.
* Must not store OA secrets — only sanitized proxy output.
* Components must subscribe via `async` pipes; no imperative polling.

---

# **6. Settings vs Configuration**

OA Compass Admin distinguishes clearly between **user-level settings** and **institution-level configuration**. This separation is critical for predictable behavior, security, and multi-staff use within the same Alma environment.

All settings and configuration are stored and retrieved using the **Alma Cloud App runtime APIs**:

* `CloudAppSettingsService` → per-user, per-app preferences
* `CloudAppConfigService` → per-institution, shared configuration

No custom Angular `SettingsService` or `ConfigService` exists; components interact directly with these Cloud App services.

## **6.1 User-Level Settings (CloudAppSettingsService)**

User-level settings are **personal UI preferences** that affect only the current Alma staff user.
They must **never** alter OpenAthens behavior, Alma data writes, or institutional policy.

User settings exist solely to control **presentation and ergonomics**, not provisioning logic.

### **Allowed User Settings**

Current allowed settings:

* Whether the OA debug / proxy response panel is shown by default
  (e.g. `showDebugPanel: boolean`)

Potential future settings (explicitly UI-only):

* Preferred initial view (entity-context vs manual search)
* Collapsed / expanded UI sections
* Visual density or layout preferences

### **User Settings Characteristics**

* Stored and retrieved via `CloudAppSettingsService`
* Loaded asynchronously at application startup
* Scoped strictly to the current Alma staff user
* Safe to reset without affecting other users or workflows

User settings **must never contain**:

* OA usernames or identifiers
* Alma identifier type codes
* Proxy URLs or OA endpoints
* Email domain rules
* Any value that affects Create, Sync, or Resend workflows

### **User Settings Contract**

All user-level settings:

* Must be explicitly documented in this SDD and the CCR
* Must be optional and backward-compatible
* Must not be required for correct application behavior

User settings are **advisory only** and may be ignored or reset without consequence.

---

## **6.2 Institution-Level Configuration (CloudAppConfigService)**

Institution-level configuration is **shared across all staff users** and defines how
OA Compass Admin behaves within a specific Alma environment.

These values directly influence OpenAthens and Alma operations and therefore must be
**centrally managed and tightly controlled**.

### **Canonical Configuration Keys**

The following keys are authoritative for OA Compass Admin:

* **`proxyBaseUrl`**
  HTTPS base URL for the OA Node.js proxy
  (e.g. `https://apps.lib.example.edu/oa-proxy`)

* **`oaIdTypeCode`**
  Alma identifier type code used when reading or writing OA usernames.
  This value is treated as an **opaque string** and may include letters or numbers.

* **`disallowedEmailDomain`**
  Optional email domain (without `@`) for which OA provisioning is skipped
  (e.g. `example.edu`).
  If empty or unset, no exclusion is applied.

* **`oaPrimaryField`**
  Primary Alma field used to store the OA username.
  Allowed values (as defined in the CCR):

  * `job_description`
  * `identifier02` (meaning “identifier using `oaIdTypeCode`”)
  * `user_note`

* **`oaSecondaryField`**
  Optional secondary Alma field for OA username storage.
  Allowed values:

  * `none`
  * `job_description`
  * `identifier02`
  * `user_note`

### **Configuration Responsibilities**

Institution-level configuration determines:

* Which Alma fields may receive OA usernames
* Which identifier type code is used for identifier-based storage
* Whether OA provisioning is skipped for specific email domains
* Which proxy endpoint is used for all OA API operations

All staff users operate under the **same configuration**.

Changes take effect immediately and apply globally.

---

### **Email Domain Exclusion Rule**

If `disallowedEmailDomain` is configured and matches a user’s email:

* OA Create is skipped
* OA Sync is skipped
* No OA username is written to Alma
* A user-visible status message explains why provisioning was skipped

This supports environments where OA access is managed entirely via
SSO or federated identity providers.

---

### **Validation Rules**

* `proxyBaseUrl`

  * Must be a valid URL
  * Must use `https://` in production

* `oaIdTypeCode`

  * Must be non-empty
  * Is not required to be numeric

* `oaPrimaryField` / `oaSecondaryField`

  * Must be one of the enumerated CCR values

If configuration is missing or invalid:

* The UI must indicate misconfiguration
* OA workflows (Create / Sync / Resend) must be disabled

---

### **Security Constraints**

The following **must never** be stored in Cloud App configuration:

* OA API keys or secrets
* OA tenant credentials
* Proxy environment variables
* Group mapping tables
* Any value required exclusively by the Node.js proxy

All sensitive values live **only on the proxy host**, outside the Cloud App runtime.

---

## **6.3 Manifest Integration**

Both user settings and institution configuration are declared in `manifest.json`:

* `settings` → user-level UI preferences
* `configuration` → institution-level OA behavior

The manifest must:

* Declare stable keys with clear labels and descriptions
* Match the keys and types defined in this SDD and the CCR
* Provide safe defaults

Any new key must be added to **all three** before use:

1. This SDD
2. CCR
3. `manifest.json`

---

## **6.4 Design Rationale**

This strict separation ensures that:

* OA behavior is predictable and institutionally consistent
* Staff users cannot accidentally alter provisioning rules
* Security-sensitive decisions are centralized
* UI preferences remain flexible and non-destructive

By enforcing these boundaries, OA Compass Admin remains:

* Auditable
* Secure
* Easy to support
* Safe for multi-staff environments

---

# **7. Detailed Data Models**

This section defines the **canonical data models** used by OA Compass Admin. All models described here must match:

* What the Angular app consumes and produces
* What the Node proxy accepts and returns
* What the OpenAthens Admin API provides
* What AlmaUserService reads and writes

No field, shape, or structure may be added, removed, or altered without updating:

1. **SDD (this section)**
2. **CCR (models and interfaces)**
3. **All affected code** (frontend + proxy)

These models intentionally use **minimal, stable subsets** of Alma and OpenAthens data.

---

# **7.1 AlmaUser (Normalized Model)**

Internally, the Cloud App works with a **normalized Alma user model** generated by `AlmaUserService.normalizeFullUser()`.

### **Required Fields** (canonical)

```
interface AlmaUser {
  primary_id: string;
  first_name: string;
  last_name: string;

  contact_info?: {
    email?: string;
  };

  user_group?: {
    value: string;
    desc?: string;
  };

  expiry_date?: string;        // Some institutions use expiry_date
  expiration_date?: string;    // Others use expiration_date (Alma duality)

  user_identifier?: Array<{
    id_type: { value: string };
    value: string;
    status?: string;
  }>;

  user_note?: Array<{
    note_text: string;
    user_viewable?: boolean;
    popup_note?: boolean;
  }>;

  job_description?: string;
}
```

### **Notes**

* `expiry_date` and `expiration_date` are treated interchangeably; the service normalizes as needed.
* Alma’s inconsistent nesting patterns (`user_identifier[]` vs `user_identifiers.user_identifier[]`) must be normalized.
* No additional Alma structures are part of the OA workflows.

---

# **7.2 OA Request Models (Canonical)**

These models describe **only** the fields required by the Node proxy.
The proxy may send additional fields to OpenAthens, but the Cloud App must never introduce fields not listed here.

---

## **7.2.1 OAAccountCreate**

```
interface OAAccountCreate {
  username?: string | null;   // Usually omitted; OA generates username
  email: string;              // Required
  first_name: string;         // Required
  last_name: string;          // Required
  expires: string;            // YYYY-MM-DD (required)
  alma_group_code?: string;   // Used for proxy mapping
}
```

---

## **7.2.2 OAAccountModify**

```
interface OAAccountModify {
  username?: string | null;   // Optional locator
  email?: string;              // Optional locator or update
  first_name?: string;
  last_name?: string;
  expires?: string;            // YYYY-MM-DD
  alma_group_code?: string;    // Mapping hint
}
```

**Rule:** At least one of `username` or `email` must be provided.

---

## **7.2.3 OALookupRequest (Proxy Lookup)**

```
interface OALookupRequest {
  username?: string | null;
  email?: string | null;
}
```

Used internally by Sync workflow.

---

## **7.2.4 OAResendRequest**

```
interface OAResendRequest {
  username?: string | null;
  email?: string | null;
}
```

Same optionality as Modify.

---

# **7.3 OA Response Models (Canonical Proxy Returns)**

All responses returned from the proxy to the Cloud App must follow stable structures.

---

## **7.3.1 OAGetResponse**

```
interface OAGetResponse {
  account?: {
    username: string;
    email: string;
    expires: string;
    groups: string[];
  };

  normalizedUsername?: string | null;  // Echo from proxy
}
```

### **Rules**

* If no account exists, `account` is omitted.
* `normalizedUsername` is informational.

---

## **7.3.2 OAProxyCreateResponse**

```
interface OAProxyCreateResponse {
  username: string;           // OA-generated authoritative username
  expires: string;            // ISO date
  email: string;
  raw?: any;                  // Sanitized proxy debug output
}
```

---

## **7.3.3 OAProxyModifyResponse**

```
interface OAProxyModifyResponse {
  username: string;           // Should match OA authoritative username
  updated: boolean;
  raw?: any;
}
```

---

## **7.3.4 OAResendResponse**

```
interface OAResendResponse {
  sent: boolean;              // Indicates whether OA accepted resend request
  raw?: any;
}
```

---

# **7.4 Workflow Result Model**

UI components consume a single workflow result type.

```
interface OAWorkflowResult {
  statusText: string;         // Human-readable (“Account created”, etc.)
  proxyDebugText?: string;    // Only when debug mode is enabled
  oaUsername?: string;
  needsReload: boolean;
}
```

---

# **7.5 Invariants Across All Models**

1. OA usernames must always be treated as opaque strings.
2. Cloud App must not generate or transform OA usernames.
3. Alma writes must use full-record PUTs.
4. Models must match both SDD and CCR.
5. No additional fields may be introduced without SDD + CCR revision.

---

# **8. Core Algorithms**

This section defines the **authoritative algorithms** used by OA Compass Admin for:

1. OA username handling
2. Alma identifier synchronization
3. Smart user search

Implementations in both the frontend and proxy **must** follow these algorithms. Any changes require updating this SDD, the CCR, and the relevant code.

---

## **8.1 OA Username Handling**

OA username **generation and policy** are the responsibility of the **OpenAthens Admin API**, *not* the Cloud App or Node proxy.

### **Source of Truth**

* The Cloud App sends create/modify requests to the proxy using `OAAccountCreate` / `OAAccountModify`.
* For **create** workflows, the Cloud App normally **omits** `username` so that OpenAthens:

  * Generates a username according to tenant policy (including prefixing and uniqueness rules).
  * Ensures global uniqueness within the OA tenant.
* The proxy forwards these requests to the OA Admin API and returns the resulting account payload.

The authoritative OA username is always taken from the OA response, e.g.:

* `account.username` (for get/verify), or
* The username field of the create/modify summary returned by the proxy.

### **Normalization Rules**

* The Node proxy **must not** construct usernames from Alma data (`prefix + primary_id`, etc.).
* Any prefixing or suffixing is configured **only in OpenAthens tenant settings**.
* The Cloud App:

  * May display the OA username returned by the proxy.
  * Must **not attempt** to generate or modify usernames locally.

If the proxy exposes a `normalizedUsername` field in responses, it is treated as an informational echo of the username actually used to query OA, *not* as an app-side transformation rule.

### **OAWorkflowService Responsibilities**

* Extract OA username from the proxy response.
* Treat the username as opaque (no transformations).
* Pass the OA username to AlmaUserService for write-back.

---

## **8.2 Alma Identifier Sync Algorithm**

After a successful OA create/modify operation, the OA-generated username is written back into Alma according to institution-configured rules.

### **Configuration Inputs (from CloudAppConfigService)**

* `oaIdTypeCode` — Alma identifier type used to store the OA username (e.g. `"02"`).
* `primaryField` — Primary storage target:

  * `job_description`
  * `identifier`
  * `user_note`
* `secondaryField` — Optional secondary storage target:

  * `none`
  * `job_description`
  * `identifier`
  * `user_note`

### **Algorithm (AlmaUserService)**

1. **Obtain OA Username**

   * OAWorkflowService passes `oaUsername` after a successful proxy call.

2. **GET Full Alma User**

   * `GET /almaws/v1/users/{primaryId}?view=full&format=json`.
   * Work with the entire user object to avoid data loss.

3. **Apply Primary Field Rule**

   * If `primaryField === 'job_description'`:

     * Set `user.job_description` to an institution-defined pattern, typically:

       * `"OpenAthens: <oaUsername>"`.

   * If `primaryField === 'identifier'`:

     * Normalize identifier structures (`user_identifier` vs `user_identifiers.user_identifier`).
     * Upsert an identifier with `id_type.value = oaIdTypeCode` and `value = oaUsername`.

   * If `primaryField === 'user_note'`:

     * Normalize `user_note` to an array.
     * Insert or update a note referencing the OA username, e.g.:

       * `"OpenAthens username: <oaUsername>"`.
     * Default `user_viewable = true`, `popup_note = false` unless existing values dictate otherwise.

4. **Apply Secondary Field Rule (if not `none`)**

   * Repeat the relevant logic from Step 3 for `secondaryField`.
   * If primary and secondary fields are the same, the operation must be idempotent.

5. **PUT Full Alma User**

   * `PUT /almaws/v1/users/{primaryId}?format=json` with the updated full user object.
   * No partial or PATCH-like updates are allowed.

6. **Refresh UI (Optional)**

   * Optionally, perform a new `GET` to refresh the UI and verify the updated values.

### **Invariants**

* OA username is always taken directly from OA.
* Alma updates must preserve unrelated data in the user record.
* The algorithm must tolerate legacy Alma record shapes.
* Writes must be deterministic and repeatable.

---

## **8.3 User Search Algorithm (Smart Search)**

The Smart Search Algorithm is used when no Alma entity context is available and the user must be located manually.

Let `q` be the trimmed search string.

### **Step 1 – Empty Input**

* If `q` is empty → show validation error, do not search.

### **Step 2 – Email Match**

* If `q` contains `"@"`, treat as an email address.
* Search Alma users by email.
* If exactly 1 user → select that user.
* If multiple → show list for selection.
* If none → proceed to Step 3.

### **Step 3 – Single Token (Likely ID)**

* If `q` is a single token (no spaces or commas):

  * First search by **primary ID**.
  * If no match, optionally search by identifiers (e.g. barcodes) if configured.
* Apply the same result handling:

  * 1 match → select.
  * > 1 matches → list.
  * 0 matches → proceed.

### **Step 4 – "Last, First" Pattern**

* If `q` contains a comma, split as `Last, First`.
* Use `Last` and `First` as name search fields.
* If any results → list; otherwise proceed.

### **Step 5 – "First Last" Pattern**

* If `q` contains spaces but no comma, treat as `First Last`.
* Split into tokens and search against name fields.
* If results → list; otherwise proceed.

### **Step 6 – Fallback Phrase / Token Search**

* Optionally perform a broader search using Alma’s general index.
* For example: phrase search or AND combinations of tokens.

### **Step 7 – No Match**

* If no results found in any step:

  * Display a clear "No users found" message for `q`.
  * Do not select a user.

### **Implementation Notes**

* All Alma calls are routed through `AlmaWsRestService` / `CloudAppRestService`.
* UserSearchComponent manages UI only; it must not perform business logic or direct REST calls.
* The algorithm is deterministic and must not depend on UI state beyond the search string and configured Alma endpoints.

---

# **9. UI Behavior Rules**

This section defines the **canonical UI behavior rules** for OA Compass Admin. These rules apply to all components and views and must be followed to maintain a consistent, accessible, and Alma-native user experience.

---

## **9.1 Theme-Aware Styling**

OA Compass Admin must fully respect Alma Cloud App theming, including **Light**, **Dark**, and **Wide** modes.

### **Rules**

1. **No inline styles**

   * All styling must be defined in component `.scss` files and, where needed, `.theme.scss` files.

2. **No hard-coded colors**

   * Use Alma theme tokens and/or Cloud App CSS variables only (e.g., `var(--color-primary)`), never raw hex values.

3. **Material Components**

   * Prefer Angular Material components (buttons, cards, forms) so that Alma themes apply automatically.

4. **Responsive Layout**

   * Layout must adapt gracefully to different Cloud App panel sizes, including **Wide Mode**.
   * Use Flexbox and CSS Grid for layout; avoid fixed pixel widths where possible.

5. **Accessibility**

   * Maintain adequate contrast in both Light and Dark themes.
   * Ensure focus outlines are visible and not suppressed.

---

## **9.2 Busy State & Interaction Locking**

When OA workflows are running, the UI must clearly indicate that the app is busy and prevent conflicting user actions.

### **Rules**

1. **Busy Indicator**

   * When `busy = true` (as exposed by StateService):

     * Show a visual busy state (spinner or progress indicator) in the main view and/or header.

2. **Disable Workflow Controls**

   * While busy:

     * Disable Create, Sync, and Resend buttons in OAProvisionComponent.
     * Prevent additional workflow requests until the current one completes.

3. **No Blocking of Core Navigation**

   * Navigation to Settings/Config may remain enabled, but workflows must not start in those views while busy.

---

## **9.3 Error Handling, Toasts, and Status Panel**

Errors and status messages must be displayed in a consistent and non-disruptive manner.

### **Status Panel (OAStatusComponent)**

* Displays the last `OAWorkflowResult`.
* Shows summary messages such as:

  * "Account created"
  * "Account synchronized"
  * "Activation email resent"
  * "OA operation failed" (with details)
* May show additional detail text when available.

### **Toasts (ToastComponent)**

* Used for transient notifications (success/error).
* Must automatically dismiss after a short duration.
* Must be fully theme-aware.

### **Error Text**

* Errors should be concise and informative.
* Technical details belong in the debug panel, not in normal user-facing messages.

---

## **9.4 Debug Panel Behavior**

The debug panel is an optional, admin-focused view showing sanitized proxy responses.

### **Rules**

1. **Opt-in Behavior**

   * Debug panel visibility is controlled by user-level settings (e.g., `showDebugPanel`).

2. **Sanitized Content**

   * Proxy responses shown in the debug panel must be sanitized by the proxy and/or OAWorkflowService:

     * No OA credentials
     * No access tokens
     * No internal stack traces
     * No sensitive user data beyond what is already visible in the UI

3. **Non-Blocking**

   * The debug panel must not interfere with normal workflows or layout.

---

## **9.5 Internationalization (i18n) Behavior**

All user-facing text must be localized.

### **Rules**

1. **No Hard-Coded Strings**

   * Components must not hard-code user-visible English text in templates or TypeScript.
   * All text must come from translation files (e.g., `assets/i18n/en.json`).

2. **Interpolation**

   * Dynamic values (user IDs, usernames, search terms) must be interpolated into translation strings rather than concatenated manually.

3. **Fallbacks**

   * Missing translations must degrade gracefully (e.g., show key or a safe default), but such cases should be avoided by maintaining translation files.

---

## **9.6 Form and Input Behavior**

User inputs (search box, config fields, etc.) must be validated and behave predictably.

### **Rules**

1. **Validation Feedback**

   * Required fields must be visually indicated and must show a clear error message when invalid or empty.

2. **Proxy URL Input**

   * In ConfigComponent, the proxy URL field must validate that input looks like a URL, and must strongly prefer `https://`.

3. **Non-Destructive Editing**

   * Changing configuration values must not immediately trigger workflows; changes are applied only after explicit save.

---

## **9.7 Collapsible Cards & Future Enhancements**

Future UI improvements may introduce collapsible cards for sections such as user info, OA status, and debug output.

### **Constraints for Future Expansion**

* Collapsible behavior must preserve keyboard accessibility.
* State (expanded/collapsed) may be remembered per user via user-level settings, not configuration.
* Visual affordances must remain clear in both Light and Dark themes.

---

## **9.8 Tooltip and Overlay Rules**

Tooltips and overlays must behave consistently with Alma Cloud App guidelines.

### **Rules**

1. **No Custom Position Overrides**

   * Tooltip positions must use Angular Material defaults; do not force custom placements that may break within the Cloud App panel.

2. **Overlay Boundaries**

   * Dialogs and menus must fit within the Cloud App container and not extend beyond it.

---

## **9.9 Summary**

UI behavior in OA Compass Admin must:

* Respect Alma theming and accessibility guidelines.
* Clearly indicate busy and error states.
* Keep workflows deterministic and understandable.
* Provide optional but safe debug visibility for administrators.
* Avoid surprises by enforcing consistent interaction patterns across all views.

---

# **10. Node Proxy Responsibilities**

The Node.js proxy is the **security and integration boundary** between the Alma Cloud App and the OpenAthens Admin API. It ensures that:

* No OA secrets enter the browser.
* All OA API interactions are validated, sanitized, and normalized.
* Institutional mapping rules (e.g., Alma → OA groups) remain server-side only.
* Cloud App requests cannot bypass security or leak sensitive information.

This section defines the authoritative behavior, constraints, and module structure of the OA Compass Admin Node Proxy.

---

# **10.1 Architectural Purpose**

The proxy has four core purposes:

1. **Security Boundary** – All OA credentials (tenant, API key) stay on the server.
2. **Request Normalization** – Cloud App → Proxy → OA requests must be validated and transformed into consistent OA Admin API calls.
3. **Error Normalization** – OA → Proxy responses must be sanitized and expressed in a predictable structure.
4. **Policy Enforcement** – Alma → OA group/permission mapping occurs only on the proxy.

The proxy must contain **no UI**, **no templating**, and **no business logic outside OA integration and mapping rules**.

---

# **10.2 Canonical Endpoints**

The proxy exposes **only** the following API endpoints to the Cloud App:

```
GET  /health
POST /v1/oa/users/get
POST /v1/oa/users/verify
POST /v1/oa/users/create
POST /v1/oa/users/modify
POST /v1/oa/users/resend-activation
```

No other endpoints may be created without updating the SDD + CCR.

### **/health**

* Used for uptime checks.
* Must return `{ ok: true }` or similar lightweight JSON.
* Must expose **no environment variables** or sensitive metadata.

### **/v1/oa/users/get, verify, create, modify, resend-activation**

These endpoints:

* Validate incoming JSON payloads.
* Map Alma group hints to OA groups/permissions.
* Call OA Admin API using tenant credentials.
* Normalize OA responses into Cloud App–compatible structures.

---

# **10.3 Module Architecture (Phase 6 Modularization)**

The proxy must consist of the following modules and only these modules:

### **config.js**

* Loads and validates environment variables.
* Exposes:

  * `PORT`
  * `ALLOWED_ORIGINS[]`
  * `OA_BASE_URL`, `OA_TENANT`, `OA_API_KEY`
  * `GROUP_MAP`, `CODE_TO_KEY`
* Rejects startup if required variables are missing.
* Never exposes credential values in error messages.

### **cors.js**

* Exports `setCors(req, res, ALLOWED_ORIGINS)`.
* Allows requests only from Alma Cloud App origins.
* Handles OPTIONS preflight requests cleanly.
* Returns 403 if origin is unrecognized.

### **oa-client.js**

* Implements low-level HTTPS calls to OA Admin API.
* Provides:

  * `httpPostJsonWithKey(url, key, payload, contentType)`
  * `httpGetJsonWithKey(url, key)`
  * `normalizeUsername(u)`
  * `queryAccount({ username, email })`
  * `resolveAccountIdOrThrow(credentials)`
* Must sanitize all OA responses before returning to route handler.
* Must not modify OA usernames.

### **validators.js**

* Input validation utilities for all inbound payloads.
* Provides structured validation responses:

  ```
  { ok: boolean, errors?: { field: string, message: string }[] }
  ```
* Includes:

  * `isValidEmail` (light format validation only)
  * `isValidDateYYYYMMDD`
  * `validateCreatePayload`
  * `validateModifyPayload`
  * Additional validators as needed by OA routes

### **routes/users.js**

* Implements the five OA-related POST endpoints.
* Provides canonical helpers:

  * `readJsonBody(req)` – max 200 KB, safe parsing
  * `sendJson(res, status, body)` – consistent JSON response format
  * `derivePolicy({ alma_group_code })` – resolves group/permission sets
  * `sendOAError(res, status, body)` – unified error return mechanism
* Must handle OA network errors gracefully and sanitize messages.
* Must not include business logic outside OA integration.

### **server.js**

* Entry point for the proxy.
* Wires CORS, routing, and health checks.
* Must contain **no OA-specific logic**.
* Must never log OA credentials.

---

# **10.4 Error Normalization Policy**

All errors returned to the Cloud App must follow a predictable structure:

```
{
  error: string,        // Short summary
  code: string | null,  // OA error code when available
  message: string,      // Sanitized details
  status: number        // HTTP status
}
```

### **Sanitization Rules**

* Remove:

  * API keys or tokens
  * OA tenant IDs
  * Internal error objects
  * Stack traces
  * Email addresses not required by the app

* Do not expose raw OA API responses unless fully sanitized.

### **Behavioral Requirements**

* If OA returns a non-2xx response, proxy must:

  1. Capture the status
  2. Extract safe error summary
  3. Construct normalized error JSON
  4. Return it with the HTTP status code

---

# **10.5 Alma → OA Group Mapping Rules**

Group mapping is performed **only on the proxy**, using environment-provided JSON:

* `CODE_TO_KEY` – maps Alma user group code → policy key
* `GROUP_MAP` – maps policy key → OA groups & permission sets

### **Algorithm Summary**

1. Extract Alma group code from payload.
2. Look up `policyKey = CODE_TO_KEY[alma_group_code]`.
3. Look up group definition in `GROUP_MAP[policyKey]`.
4. If found, attach:

   * `groups: string[]`
   * `permissionSets: string[]`
     to the OA create/modify payload.
5. If not found, omit group/permission mapping.

### **Rules**

* Mapping tables must never be sent to the browser.
* Mapping must be deterministic.
* Overriding groups must follow explicit proxy logic.

---

# **10.6 CORS & Origin Control**

Strict CORS controls are required to prevent unauthorized use of the proxy.

### **Rules**

1. Proxy must accept requests **only** from origins listed in `ALLOWED_ORIGINS`.
2. Unknown origins must receive HTTP 403.
3. Preflight requests must be responded to correctly with minimal headers.
4. The proxy must never assume Alma origin patterns; only explicit allowlists.

---

# **10.7 Logging & Security Constraints**

1. Proxy must never log OA credentials or sensitive OA data.
2. Logs may include:

   * Timestamps
   * Endpoint names
   * Success/failure state
   * Sanitized error summaries
3. Logs may not include:

   * Request payloads containing PII
   * Full OA responses
   * Environment variables
4. The proxy must operate safely behind HTTPS.

---

# **10.8 Summary**

The Node proxy ensures that OA Compass Admin runs securely by:

* Isolating OA credentials and integration logic
* Normalizing and sanitizing all OA responses
* Enforcing strict input validation and CORS rules
* Mapping Alma → OA permissions server-side
* Never exposing sensitive data to the Cloud App

These rules form the **authoritative security and behavior contract** for the proxy.

---

# **11. Manifest & Deployment Requirements (Full Publishing Specification)**

This section defines all **manifest**, **packaging**, **publishing**, and **deployment** requirements for OA Compass Admin. It consolidates Cloud App Center requirements, Alma Cloud App SDK rules, proxy hosting standards, and institution-level deployment expectations.

This is the authoritative checklist for:

* Preparing `manifest.json`
* Packaging the Cloud App for deployment or publication
* Hosting and securing the OA Node proxy
* Submitting the app to the Ex Libris Cloud App Center (if applicable)

---

# **11.1 Cloud App Manifest Requirements**

The `manifest.json` must conform to Alma Cloud App specifications and must include all of the following fields.

```
{
  "id": "oa-compass-admin",            // unique app ID
  "name": "OA Compass Admin",          // display name
  "description": "Manage OpenAthens provisioning for Alma users.",
  "publisher": "<Your Institution>",
  "version": "<SemVer>",
  "icon": "assets/icon.png",           // 96x96 recommended

  "runMode": "normal",                 // required for entity-aware apps
  "entityTypes": ["USER"],             // enables entity-aware mode

  "main": "main",                      // main Angular route

  "settings": {
    "fields": [
      {
        "key": "showDebugPanel",
        "type": "boolean",
        "default": false,
        "label": "Show Debug Panel By Default"
      }
    ]
  },

  "configuration": {
    "fields": [
      {
        "key": "proxyBaseUrl",
        "type": "text",
        "label": "Proxy Base URL (HTTPS)",
        "required": true
      },
      {
        "key": "oaIdTypeCode",
        "type": "text",
        "label": "OA Identifier Type Code",
        "required": true
      },
      {
        "key": "primaryField",
        "type": "select",
        "options": ["job_description", "identifier", "user_note"],
        "required": true
      },
      {
        "key": "secondaryField",
        "type": "select",
        "options": ["none", "job_description", "identifier", "user_note"],
        "default": "none"
      }
    ]
  },

  "permissions": {
    "rest": {
      "GET": ["/almaws/v1/users"],
      "PUT": ["/almaws/v1/users"]
    }
  },

  "i18n": ["en"],

  "network": {
    "allowedOrigins": ["<proxy-host-domain>"]
  }
}
```

### **Manifest Rules**

* `runMode` must be `"normal"` (entity-aware apps cannot be dashboard widgets).
* `entityTypes` must include `"USER"`.
* `proxyBaseUrl` **must not** embed secrets.
* Permissions must include Alma Users API **GET + PUT** only.
* Icons must follow Cloud App Center requirements (96x96 PNG minimum).
* All settings/config keys must match those defined in SDD + CCR.

---

# **11.2 File Structure Requirements**

A Cloud App package (ZIP) must include:

```
/manifest.json
/index.html
/main.js (compiled Angular bundle)
/runtime.js
/polyfills.js
/assets/**
/styles.css or theme bundles
```

### **Packaging Rules**

* **Do NOT include `node_modules/`.**
* Do NOT include TypeScript source code.
* Do NOT include environment files.
* All asset paths in manifest must exist in the ZIP.
* ZIP root must contain the manifest, not a nested folder.

---

# **11.3 Deployment Requirements for the Node Proxy**

The OA Node proxy must be deployed with strict security requirements.

### **Environment Variables (Required)**

* `OA_API_KEY`
* `OA_TENANT`
* `OA_BASE_URL`
* `PORT`
* `ALLOWED_ORIGINS`     (comma-separated list of Alma Cloud App URLs)
* `CODE_TO_KEY`          (JSON)
* `GROUP_MAP`            (JSON)

### **Hosting Requirements**

* Must run behind **HTTPS**.
* Reverse proxy strongly recommended (Nginx, Apache, AWS ALB, etc.).
* Must handle large bodies up to 200 KB (for valid JSON payloads).
* Must return JSON responses only.

### **Security Rules**

* Never log API keys or secrets.
* Remove PII from logs.
* Sanitize OA error responses.
* Enforce CORS using `ALLOWED_ORIGINS`.
* Do not expose non-essential routes.

### **Operational Rules**

* Restart should be safe and stateless.
* Health checks via `/health` must not reveal sensitive data.

---

# **11.4 Cloud App Center Publishing Requirements**

When preparing for Cloud App publication, the following items are required:

### **Metadata & Presentation**

* App Name
* Short Description
* Long Description
* Publisher Name
* Institution/Organization
* Version (semantic versioning)
* At least **3 screenshots** showing:

  * User Search view
  * User Shell view
  * OA Status + Provision panel
* 96x96 icon
* Category selection (Authentication / Identity Management)

### **Functional Requirements**

* Must pass Ex Libris automated lint checks.
* Must load without console errors.
* Must handle missing configuration gracefully.
* Must not trigger OA calls without configuration completed.
* Must support Light/Dark/Wide themes.

### **Security & Compliance**

* No OA-related secrets in client code.
* Proxy URL must use HTTPS.
* All network calls must be to Alma or the configured proxy.
* All dependencies must be license-compliant.

### **I18N Requirements**

* English (`en.json`) is required.
* Additional languages optional.
* All user-facing text must be from i18n files.

---

# **11.5 Deployment Checklist (Frontend + Proxy)**

### **Cloud App ZIP Checklist**

* [ ] `manifest.json` validated
* [ ] Angular build compiled (production mode)
* [ ] `assets/` folder complete
* [ ] Icons present
* [ ] No source code included
* [ ] No node_modules included
* [ ] Tested in Alma Sandbox

### **Proxy Deployment Checklist**

* [ ] HTTPS enabled
* [ ] Environment variables set correctly
* [ ] CORS restricted to Alma origins
* [ ] Logs sanitized
* [ ] `/health` returns safe status JSON
* [ ] OA API connectivity tested

---

# **11.6 Summary**

This section defines the complete manifest, packaging, publishing, and deployment requirements for OA Compass Admin. Following these rules ensures:

* Cloud App Center compliance
* Secure OA integration
* Predictable Alma-side behavior
* Reliable multi-institution deployment

All changes to manifest, deployment strategy, or proxy hosting must be coordinated through updates to the SDD and CCR.

---

# **12. Phase Dependencies**

This section documents the **official phase structure** for the OA Compass Admin modernization project. It defines the order of operations, cross‑phase dependencies, and the authoritative purpose of each phase. These phases govern all refactoring, development, documentation, and release activities.

The sequence is **strictly linear**: later phases may not be executed until all acceptance criteria for earlier phases are met.

---

# **12.1 Phase Overview**

| Phase | Name                                  | Purpose                                                               |
| ----- | ------------------------------------- | --------------------------------------------------------------------- |
| **0** | Codebase Realignment                  | Bring code inline with SDD + CCR, remove drift, unify structure       |
| **1** | Style Guide Compliance                | Apply Alma Cloud App Style Guide and theming rules                    |
| **2** | Full Theming + Functional Restoration | Ensure complete UI theming, restore all legacy functionality          |
| **3** | Component Refactor (Entity-Aware UI)  | Convert UI to modular components, add entity awareness & StateService |
| **4** | Configuration Layer                   | Separate settings vs configuration, add Config screen                 |
| **5** | Security & Proxy Hardening            | Harden Node proxy, validate inputs, enforce CORS, normalize errors    |
| **6** | Testing & Internationalization        | Manual testing, workflows QA, add i18n, debug verification            |
| **7** | Publishing Prep                       | Final documentation, manifests, deployment polishing                  |

These phases correspond directly to `PROJECT_PLAN.md` and the high‑level roadmap defined in the README.

---

# **12.2 Phase Dependencies (Strict Rules)**

1. **Phases may not be reordered.** Each phase depends on architecture or infrastructure established in the previous phase.

2. **No future‑phase features may be started early.** Example:

   * Entity‑aware UI (Phase 3) may not begin during Phase 1.
   * Proxy refactor (Phase 6) must not begin before Phase 5.

3. **SDD and CCR must remain accurate at all times.** Before entering a phase:

   * The SDD must describe the architecture expected during that phase.
   * The CCR must define all models, endpoints, and component names.

4. **Changes discovered mid‑phase** must be back‑ported to SDD + CCR before continuation.

5. **Each phase has explicit acceptance criteria** and may not be marked complete until:

   * All criteria are satisfied
   * Documentation is updated
   * Code and proxy behavior match SDD definitions

---

# **12.3 Phase‑to‑Phase Dependency Map**

### **Phase 0 → Phase 1**

* Component structure and naming must already conform to SDD + CCR.
* Only after the foundation matches the architecture can style guide compliance begin.

### **Phase 1 → Phase 2**

* Once style and theming foundations are stable, full functional restoration may proceed.
* Theme tokens, spacing, breakpoints, and Cloud App Material rules must already be in place.

### **Phase 2 → Phase 3**

* Entity-aware UI depends on functional clarity and restored baseline behaviors.
* Refactoring into UserShell, UserSearch, OAStatus, UserInfo, OAProvision requires stable logic.

### **Phase 3 → Phase 4**

* Configuration UI depends on the presence of modular components and StateService.
* Requires the separation between settings and configuration.

### **Phase 4 → Phase 5**

* Security hardening requires finalized configuration (proxy URL, identifier rules).
* If configuration logic changes later, all security assumptions must be reevaluated.

### **Phase 5 → Phase 6**

* Testing and i18n require:

  * Complete and stable UI
  * Complete workflows
  * Fully secured proxy behavior
* Debug panel behavior must be deterministic.

### **Phase 6 → Phase 7**

* Publishing requires:

  * Frozen functionality
  * Fully updated README, SDD, CCR, and manifest
  * Validated proxy deployment
  * Screenshots + icons
  * Full documentation consistency

---

# **12.4 Enforcement Behavior for ChatGPT (Loader Rule)**

The ChatGPT Session Loader uses the Phase value to enforce scope.

For example:

* If the user says, “We are in Phase 4,” questions about proxy hardening (Phase 5) must be postponed.
* If the user asks for new features during Phase 7, ChatGPT must reject the request.

This ensures:

* Architectural integrity
* Predictable incremental progress
* No cross‑phase contamination

---

# **12.5 Summary**

The Phase system defines the official roadmap and governs the order in which OA Compass Admin evolves. All work—frontend, backend, documentation, and testing—must adhere to this phase model to maintain consistency and prevent architectural drift.

Any modification to the Phase system itself must be recorded in:

1. SDD (this section)
2. PROJECT_PLAN.md
3. README (Phase summary)

---

# **13. Change Control**

This section defines the **governance rules** for modifying any part of the OA Compass Admin system. It is the authoritative process for controlling changes to:

* Architecture
* Data models
* Endpoints
* Component names and responsibilities
* Services
* Algorithms
* Proxy behavior
* Configuration or settings
* Manifest and deployment requirements

Because this system integrates with Alma, OpenAthens, and institutional identity workflows, **ALL changes must be deliberate, documented, and reviewed**.

---

# **13.1 Core Principles of Change Control**

1. **SDD and CCR are the single source of truth.**

   * If code and SDD/CCR disagree, **SDD/CCR take precedence**.

2. **No change may be implemented in code unless approved in the SDD first.**

   * The SDD defines what is allowed.
   * The CCR defines exact type shapes, names, endpoints, and data structures.

3. **All PRs or commits affecting architecture must reference updated SDD + CCR sections.**

4. **Nothing may be invented during development or ChatGPT-assisted work.**

   * New:

     * Models
     * Endpoints
     * Identifiers
     * Algorithms
     * Config keys
     * Components / services

     **must not be invented spontaneously.**

5. **Backward compatibility must be preserved when possible.**

   * Adding optional fields is allowed if they do not break existing workflows.
   * Removing or renaming fields/endpoints requires a major version change.

---

# **13.2 Required Documentation Steps for Any Change**

Before implementing *any* modification to system behavior, the following must occur **in order**:

### **Step 1 — Update the SDD**

* Modify the relevant section(s): architecture, workflows, algorithms, models, etc.
* Provide explicit, unambiguous definitions.

### **Step 2 — Update the CCR**

* Add or update:

  * Interfaces
  * Methods
  * Component or service names
  * Endpoints
  * Data fields
* Ensure no drift between code and documentation.

### **Step 3 — Update the README (if relevant)**

* Only needed if the change affects external behavior, deployment, configuration, or major architecture.

### **Step 4 — Update PROJECT_PLAN (if relevant)**

* Only required if the change affects a phase or introduces new project scope.

### **Step 5 — Implement code changes**

* Code must now align exactly with updated documents.

### **Step 6 — Test all affected workflows**

* Alma GET/PUT
* OA create/modify/sync/resend
* Proxy request/response shapes
* UI state transitions

### **Step 7 — Record version bump**

* **Minor** version bump for backward-compatible enhancements.
* **Major** version bump for breaking changes.

---

# **13.3 What Requires a Change-Control Update?**

### **A) Changes requiring *mandatory* SDD + CCR updates**

* New OA workflow behavior
* Changes to OA payload or response shapes
* Adding or removing component inputs/outputs
* Changing Alma write-back rules
* Adding or removing config keys
* Modifying error handling behavior
* Adding or modifying endpoints on the proxy
* Introducing new Angular services or renaming existing ones

### **B) Changes requiring README + Manifest updates**

* Adding new configuration options
* Changing Cloud App permissions
* Changing proxy URL expectations
* Adding new UI screens or routes

### **C) Changes requiring PROJECT_PLAN updates**

* New phases
* Significant change in the order of operations or responsibilities

### **D) Changes requiring Manual Testing updates**

* Any change that can affect workflows must update your manual testing procedure.

---

# **13.4 Prohibited Changes Without Documentation**

The following changes **must never** be made without explicit revision to the SDD + CCR:

* Introducing new fields into OA request/response models
* Changing OA username behavior
* Changing Alma identifier write-back logic
* Adding new proxy endpoints
* Altering group/permission mapping logic
* Modifying search algorithms
* Changing key component boundaries (e.g., moving logic into a component)
* Introducing any new business logic into UI components

Violating this rule risks:

* Breaking OA accounts
* Corrupting Alma user data
* Causing unpredictable integration behavior
* Failing Cloud App certification requirements

---

# **13.5 Versioning Rules (Semantic Versioning)**

OA Compass Admin follows **semver**:

* **MAJOR** — Breaking changes (API modifications, model changes, behavioral changes)
* **MINOR** — Backward-compatible enhancements (new optional config keys, new UI panels)
* **PATCH** — Bug fixes, documentation updates, minor UI fixes

Every release must:

* Include updated `CHANGELOG.md`
* Include SDD + CCR verification
* Include a new `version` in `manifest.json`

---

# **13.6 ChatGPT Session Loader Enforcement**

The Global Session Loader ensures:

* ChatGPT must **reject** any request that violates SDD or CCR.
* ChatGPT must enforce **phase restrictions**.
* ChatGPT must ask for clarification if a request implies a new structure.
* ChatGPT must not invent variable names, endpoints, or services.

If a user says:

> "Add a new field to OAAccountCreate"

ChatGPT must respond:

* "This requires an SDD + CCR update first. Would you like to revise Section 7?"

This prevents architecture drift and ensures consistent long-term maintainability.

---

# **13.7 Summary**

Change Control is the foundation of OA Compass Admin’s documentation-driven architecture. All architectural or behavioral changes must:

1. Update the SDD
2. Update the CCR
3. Update README/PROJECT_PLAN if needed
4. Then update the code

Nothing bypasses this process.

Any contributor—human or AI—must follow this workflow without exception.

---

