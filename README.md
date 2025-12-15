# **📘 OA Compass Admin — Secure Alma ↔ OpenAthens Provisioning Cloud App**

> A **modern, secure, theme-aware Cloud App** for Alma that synchronizes user records with OpenAthens (Compass) using a hardened Node.js backend proxy.

This project replaces the legacy PHP OpenAthens provisioning tool with a **fully secure, well-architected, maintainable Angular Cloud App** that runs **directly inside the Alma UI**, following Ex Libris' best practices.

The app supports:

* Searching & selecting Alma users (entity-aware)
* Viewing Alma user details
* Creating and managing OpenAthens accounts (using OA-generated usernames)
* Verifying, creating, modifying, and resending OA accounts
* Writing back OA username into Alma user identifiers
* Group → permission mapping enforced by the secure backend
* Full Alma theming & Cloud App style compliance

Sensitive OA operations occur **only in the Node.js proxy**.
**No secrets ever reach the browser.**

---

# **📑 Table of Contents**

1. [Purpose & Goals](#purpose--goals)
2. [High-Level Requirements](#high-level-requirements)
3. [Architecture Overview](#architecture-overview)
4. [Frontend Design](#frontend-design)
5. [Backend Proxy Design](#backend-proxy-design)
6. [Security Model](#security-model)
7. [Cloud App Integration](#cloud-app-integration)
8. [Folder Structure](#folder-structure)
9. [Coding Standards](#coding-standards)
10. [System Design Summary](#system-design-summary)
11. [Canonical Code Registry Summary](#canonical-code-registry-summary)
12. [Development](#development)
13. [Environment Variables](#environment-variables)
14. [Running](#running)
15. [Theming & Styling](#theming--styling)
16. [ChatGPT Collaboration Rules](#chatgpt-collaboration-rules)
17. [Roadmap](#roadmap)
18. [License](#license)

---

## **1. Purpose & Goals**

The OA Compass Admin project provides a **secure, maintainable, entity-aware Alma Cloud App** for synchronizing Alma users with OpenAthens (Compass). It replaces the legacy PHP tool with a modern, standards-compliant Angular application backed by a hardened Node.js proxy.

### **Primary Goals**

1. Replace the legacy OA provisioning tool with a **secure Alma-native Cloud App**.
2. Ensure **all OpenAthens API calls** flow exclusively through a **Node.js proxy**, keeping all OA secrets server-side.
3. Provide an intuitive UI for library staff to:
   * Inspect Alma users (entity-aware or manual search)
   * Create OA accounts (OA-generated usernames)
   * Sync existing OA accounts (including verification)
   * Resend activation emails
   * Write OA usernames back into Alma identifiers or notes
4. Maintain strict compliance with:
   * **Cloud App SDK** design patterns
   * **Cloud App styling & theming** guidelines
   * **Angular service-based architecture** with strong typing
5. Support **institution-configured** OA username write-back rules:
   * Identifier type code
   * Job description
   * User notes
   * Optional secondary storage field
6. Utilize **OA-generated usernames** as the authoritative identity, eliminating custom prefix logic.
7. Provide a **hardened Node proxy** with modularized routing, CORS enforcement, OA error sanitization, and environment-based configuration.

### **What this rewrite delivers**

✔ Runs as a first-class Alma Cloud App (dashboard & entity-aware modes)
✔ Uses a secure backend proxy for all OA communication
✔ Follows Alma theming, accessibility, and UI guidelines
✔ Relies on OA’s canonical username generation
✔ Provides configurable Alma write-back fields
✔ Implements modular Angular architecture with dedicated workflow and state services
✔ Requires zero secrets in the browser

---

# **2. High-Level Requirements**

## **Functional Requirements**

* Search Alma users by ID, name, email, or barcode.
* Support **entity-aware mode** when launched from an Alma User page.
* Display Alma user details, including name, group, expiry, identifiers, and contact info.
* **Create OpenAthens accounts without specifying a username** (OA generates canonical usernames).
* Retrieve the OA-generated username from the Node proxy response.
* **Sync OA accounts**, which includes:
  * Modify existing OA user attributes (name, email, expiry)
  * Verify whether an OA account exists (lookup by username or email)
  * Create missing accounts when appropriate
* Resend OpenAthens activation emails.
* **Write OA-generated usernames back to Alma** using institution-configured rules:
  * Primary field: identifier, job description, or user note
  * Optional secondary field
  * Configurable identifier type code
* Provide clear status messages, workflow results, and optional debug output.
* Provide an institution-level configuration UI for:
  * `proxyBaseUrl` (HTTPS-only)
  * OA identifier type code
  * Primary/secondary write-back fields

---

## **Non-Functional Requirements**

* **Zero OA secrets in the browser**: OA API key, tenant, and base URLs remain server-side.
* All OA calls flow exclusively through the **Node proxy** using:
  `Cloud App → OAProxyService → Node Proxy → OpenAthens Admin API`
* Proxy enforces:
  * Strict CORS allowlist
  * Sanitized OA error responses
  * JSON body limits
  * Origin validation
  * Modularized routing and validation (Phase 6)
* Cloud App uses:
  * Strict TypeScript models (per CCR)
  * Angular modular architecture and service-driven workflows
  * `StateService` and `OAWorkflowService` for consistent state and logic
* UI adheres to:
  * Alma theming (light/dark/wide modes)
  * Cloud App style and accessibility guidelines
* Alma writes use **full-record GET → modify → PUT** semantics.
* Only minimal, deployment-side proxy configuration is required:
  * `OA_BASE_URL`, `OA_TENANT`, `OA_API_KEY`, `OA_CREATE_URL`, `ALLOWED_ORIGINS`, `GROUP_MAP`, etc.

---

# **3. Architecture Overview**

The OA Compass Admin system consists of three cooperating layers:

1. **The Alma Cloud App** (Angular + CloudApp SDK)
2. **The Node.js OA Proxy** (secure server-side integration layer)
3. **The OpenAthens Admin API** (identity provider)

The Cloud App runs inside Alma, retrieves Alma users, and performs provisioning workflows.
All OpenAthens communication is routed exclusively through the secure proxy.
OpenAthens is the authoritative source of OA usernames.
The Cloud App never generates, modifies, or stores usernames independently.

```
+------------------------------------------------------+
|                  Alma Cloud App                      |
|      (Angular • Cloud App SDK • Entity-Aware)        |
|------------------------------------------------------|
|  • User Search & Entity Context                      |
|  • User Shell (Info + Status + Provision)            |
|  • OAWorkflowService (create/sync + write-back)      |
|  • StateService (busy, user, debug output)           |
|  • Settings (per user)                               |
|  • Configuration (institution-level)                 |
+---------------------------↑--------------------------+
                            |
                            | Alma REST API (GET/PUT)
                            v
                    +------------------------+
                    |      Alma Users        |
                    +------------------------+

                            HTTPS
                            |
                            v

+------------------------------------------------------+
|                    Node.js Proxy                     |
| (Secure middleware for all OA Admin API operations)  |
|------------------------------------------------------|
|  • Environment-driven configuration                  |
|  • Strict CORS allowlist                             |
|  • JSON schema validation                            |
|  • Modularized endpoints (Phase 6):                  |
|        config.js, cors.js, oa-client.js,             |
|        validators.js, routes/users.js                |
|  • Sends requests to OA Admin API                    |
|  • Returns sanitized, canonical responses            |
+---------------------------↓--------------------------+
                            |
                            | OA Admin API
                            v
                +-----------------------------+
                |    OpenAthens Admin API     |
                | (Authoritative usernames)   |
                +-----------------------------+
```

---

## **Key Architectural Principles**

### 🔒 **Security Boundary**
* The Cloud App **never** sends OA credentials and never contacts OA directly.
* All OA secrets remain on the Node proxy (`OA_API_KEY`, tenant, base URL, group map).
* Proxy enforces strict CORS based on `ALLOWED_ORIGINS`.

---

### 🧠 **OpenAthens Username Source of Truth**
* The Cloud App submits minimal user data to the proxy.
* OpenAthens **generates the canonical username**.
* The username returned by OA is written back to Alma via institution-configured rules.

---

### 🏛 **Cloud App Responsibilities**
* Search for Alma users or load them from entity context
* Display user info + OA status
* Trigger OA workflows via OAWorkflowService
* Write OA usernames back into Alma (full GET → modify → PUT)
* Manage UI state via StateService
* Apply Alma theming and accessibility rules

---

### 🛡 **Node Proxy Responsibilities**
* Validate incoming payloads
* Map Alma group codes to OA policies
* Call OA Admin API using server-only credentials
* Return sanitized responses (canonical error model)
* Keep secrets and tenant configuration isolated from the frontend

---

### ⚙️ **Institution-Level Configuration**
Stored via `CloudAppConfigService`:
* Proxy Base URL (HTTPS required)
* OA Identifier Type Code
* Primary/Secondary write-back fields
These settings determine how OA usernames appear in Alma.

---

# **4. Frontend Design**

The OA Compass Admin frontend is a modular Angular application built using the **Ex Libris CloudApp SDK**, designed to operate both as a **dashboard app** and an **entity-aware user tool** inside Alma. The UI follows the Cloud App Style & Theming Guidelines and separates concerns across distinct components and services.

The application architecture is structured around:
* **UI presentation components**
* **Alma integration logic (AlmaUserService)**
* **OpenAthens workflow orchestration (OAWorkflowService)**
* **Reactive application state management (StateService)**
* **Entity-awareness (EntityContextService)**
* **Settings vs Configuration layers**
* **Internationalization (i18n)**

All visible text is externalized through `CloudAppTranslateModule` and translation files under `assets/i18n/`.

---

## **4.1 Component Overview**

OA Compass Admin uses a series of small, theme-aware, testable Angular components. These components correspond to the canonical list defined in the CCR.

### **Root Experience**

* **Main Component**
  The core entrypoint that orchestrates:
  * *Entity-aware mode* (auto-loading Alma User entities)
  * *Manual search mode*
  * Routing to Settings and Config views
  * Display of busy state and dynamic status messages
  * Debug panel visibility

---

## **4.2 Core UI Components**

### **AppHeaderComponent**
* Alma-themed top bar
* Displays title, status, and action buttons
* Provides quick access to Settings and Configuration screens

### **UserSearchComponent**
* Full Alma user search workflow
* Supports ID, name, email, and barcode queries
* Implements the **smart search algorithm**
* Used whenever no Alma entity context is present

### **UserShellComponent**
* Encapsulates all UI for a selected user
* Contains:
  * `UserInfoComponent`
  * `OAStatusComponent`
  * `OAProvisionComponent`
  * Optional debug panel

### **UserInfoComponent**

* Presents Alma user summary:
  * Name, group, expiry, identifiers, email
* Indicates extracted OA username (when present)

### **OAStatusComponent**
* Displays current workflow outcomes
* Shows sanitized OA proxy responses when debug mode is active

### **OAProvisionComponent**

* Action panel for:
  * Create account
  * Sync account (modify + verify)
  * Resend activation
* Uses OAWorkflowService for all logic

### **ToastComponent**

* Cloud App-style notification system
* Provides ephemeral success/error messages

### **SettingsComponent**

*(Per-user preferences)*
* Controls UI-only behaviors (e.g., debug panel visibility)

### **ConfigComponent**

*(Institution-level settings)*
* Controls all **OA-sensitive configuration**, including:
  * Proxy Base URL (HTTPS-required)
  * Email domain exclusion rule (skip OA account creation)
  * OA Identifier Type Code
  * Primary/Secondary write-back fields
* Values are stored centrally using `CloudAppConfigService`

---

## **4.3 Frontend Services**

### **AlmaUserService**
* Fetches full Alma user records
* Performs GET → modify → PUT updates
* Applies write-back rules for OA usernames

### **OAProxyService**
* Handles all OA proxy communications
* Enforces HTTPS
* Returns typed results
* Never exposes secrets

### **OAWorkflowService**
* Orchestrates Create, Sync, and Resend workflows
  (includes verify logic internally)
* Extracts authoritative OA username from proxy responses
* Updates Alma via AlmaUserService
* Formats user-facing status messages

### **StateService**
* Tracks busy state, debug output, and selected user
* Provides reactive streams to simplify component logic

### **EntityContextService**
* Listens to Cloud App `entities$`
* Auto-loads Alma user when the app is opened on a User page

---

## **4.4 Theming & Accessibility**

The UI conforms to all Alma Cloud App style rules:
* No inline styles
* Theme tokens applied via SCSS
* Proper spacing, density, and typography
* Support for:
  * Light mode
  * Dark mode
  * Wide display mode

All components use Angular Material in Cloud App-compliant form.

---

## **4.5 Internationalization**

The app uses the built-in Cloud App translation system:
* Translation keys defined in `assets/i18n/en.json`
* UI uses pipes (`{{ 'key' | translate }}`) and service methods
* All user-visible text is localizable

---

# **5. Backend Proxy Design**

The backend component of OA Compass Admin is a **secure Node.js proxy** that performs all communication with the OpenAthens Admin API. The proxy enforces strict security boundaries: **no OA credentials or sensitive configuration ever reach the browser**, and the proxy is the *only* path through which the Cloud App interacts with OpenAthens.

As of Phase 6, the proxy is fully modularized for clarity, maintainability, and security auditing.

---

## **5.1 Core Principles**

* **All OA secrets remain server-side**, including:
  * API key
  * Tenant identifier
  * Base URLs
  * Group/permission mapping
* The Cloud App **never** calls OA directly — only the proxy.
* The proxy exposes only the **canonical endpoints** defined in the CCR.
* Strict CORS enforcement ensures only Alma-hosted origins can invoke the proxy.
* Requests undergo consistent JSON parsing, validation, size checks, and sanitization.
* OA Admin API responses are normalized to a **canonical success/error structure**.
* The proxy performs **no username construction or normalization**; OpenAthens is the authoritative source of usernames.

---

## **5.2 Modular File Structure**

```
server/
  server.js               → Minimal entry point; HTTP server + CORS + routing
  config.js               → Loads and validates environment variables
  cors.js                 → Strict CORS allowlist enforcement
  oa-client.js            → Low-level OA HTTPS functions (GET/POST with API key)
  validators.js           → Input validation for create/modify workflows
  routes/
    users.js              → Handlers for /v1/oa/users/* routes
  package.json
  .env                    → Deployment-only configuration (never committed)
```

The modular design isolates OA networking, validation, routing, and configuration responsibilities for easier testing and auditing.

---

## **5.3 Canonical API Endpoints**

The proxy exposes only the following stable, versioned endpoints:

```
GET  /health
POST /v1/oa/users/get
POST /v1/oa/users/verify
POST /v1/oa/users/create
POST /v1/oa/users/modify
POST /v1/oa/users/resend-activation
```

All additional logic resides behind these endpoints and must not be expanded without updating the SDD and CCR.

---

## **5.4 Request Flow**

1. The Cloud App calls `OAProxyService` at the configured `proxyBaseUrl` over HTTPS.
2. `server.js` validates the request origin and handles preflight CORS logic.
3. `routes/users.js`:

   * Reads JSON body (200 KB limit)
   * Performs payload validation
   * Calls `oa-client.js` to perform the actual OA Admin API request
4. OA responses are sanitized and transformed into the canonical structure.
5. The proxy returns a JSON response with no internal OA secrets exposed.

---

## **5.5 Validation & Payload Rules**

### **Account Creation**

Proxy validates:

* `email` (required, syntactically valid)
* `first_name` (non-empty)
* `last_name` (non-empty)
* `expires` (valid YYYY-MM-DD)
* `alma_group_code` (optional; used for group mapping)

### **Account Modification / Sync**

Proxy requires:

* At least one locator: `username` or `email`
* Optional updates to:

  * `first_name`
  * `last_name`
  * `email`
  * `expires`

### **Group Mapping**

When Alma group hints are present, the proxy performs:

```
alma_group_code → CODE_TO_KEY → GROUP_MAP → OA groups / permission sets
```

Mappings exist only on the proxy and are not sent to the client.

---

## **5.6 Standardized Error Shape**

All OA errors returned to the Cloud App use a stable format:

```
{
  "error": "OA create failed",
  "code": "OA_ERROR_CODE" | null,
  "message": "Short descriptive message",
  "status": 400
}
```

This consistent structure enables frontend components to handle error states predictably.

---

## **5.7 Security Guarantees**

* No OA credentials, tenant details, or sensitive headers ever appear in responses.
* Proxy accepts requests only from Alma Cloud App origins listed in `ALLOWED_ORIGINS`.
* JSON body parsing is capped, preventing malicious payloads.
* Internal OA error bodies are never returned directly.
* Username generation occurs **inside OpenAthens**, never in Node.
* Logs must not contain OA secrets or Alma PII.

---

## **5.8 Behavior Preservation Guarantee**

Phase 6 proxy modularization does **not** alter any functional behavior.
All endpoints, input requirements, and response structures remain fully compatible with existing frontend logic.

---

# **6. Security Model**

OA Compass Admin is designed using a strict, defense-in-depth security model.
All sensitive operations are performed exclusively on the **Node.js OA Proxy**, and the Alma Cloud App holds **no OA secrets of any kind**.

---

## **6.1 Cloud App Security**

* The frontend **never stores or transmits OA API keys**, OAuth tokens, secrets, or tenant configuration.
* All OA traffic flows through `OAProxyService` → **HTTPS** → Node proxy.
* The app loads `proxyBaseUrl` from **institution-level configuration**, and:
  * Rejects values not starting with `https://`
  * Falls back to a compiled default if invalid
* The Cloud App communicates with Alma only through the Cloud App SDK (`CloudAppRestService`), staying entirely within the Ex Libris security perimeter.
* Detailed proxy responses are shown **only when the debug panel is enabled** and never for sensitive failure cases.
* Logs follow strict privacy rules:
  * **No PII, usernames, identifiers, or OA payloads** are logged.
  * Success summaries may be logged only when debug mode is active.
  * StateService ensures debug output is isolated and user-controlled.
* Components use Angular and Cloud App SDK best practices:
  * No inline secrets
  * No insecure global state
  * No storage of sensitive values in LocalStorage or IndexedDB

---

## **6.2 Node Proxy Security**

The Node proxy is the **exclusive integration surface** between Alma and OpenAthens.

### **Server Configuration**

* Runs on a secured institutional host.
* Bound to `127.0.0.1` (localhost) when possible.
* Exposed externally *only* via institutional HTTPS reverse proxy (e.g., Apache/Nginx).
* OA secrets (API key, tenant, base URLs, group mapping) reside only in:
  * `.env` files (not committed)
  * systemd environment variables

### **Strict CORS Enforcement**
* Allowed origins are pulled from `ALLOWED_ORIGINS`
* Only Alma Cloud App domains are permitted
* Requests from unknown origins are rejected early

### **Canonical Endpoint Surface**

```
GET  /health
POST /v1/oa/users/get
POST /v1/oa/users/verify
POST /v1/oa/users/create
POST /v1/oa/users/modify
POST /v1/oa/users/resend-activation
```

### **Request Handling & Validation**

* JSON body limit: **200 KB**
* Input validation ensures:
  * Valid email
  * Required fields for creation (`first_name`, `last_name`, `expires`)
  * At least one locator for modify/verify (`username` or `email`)
* Username **must not** be required for creation; OA generates all usernames.

### **Group Mapping Policy**

* Alma group hints are mapped to OA groups and permission sets via:

  ```
  CODE_TO_KEY → GROUP_MAP → OA policy
  ```
* Mapping rules are server-side only.

### **Error Sanitization**

All OA error responses are transformed into a single canonical shape:

```json
{
  "error": "OA create failed",
  "code": "OA_ERROR_CODE",
  "message": "Short descriptive message",
  "status": 400
}
```

Sensitive fields, OA-internal identifiers, and stack traces are removed.

---

## **6.3 Alma Integration Security**

* All user writes follow **full GET → modify → PUT** workflow.
* OA usernames written into Alma use admin-configured rules:
  * Identifier type
  * Job description
  * User notes
  * Optional secondary field
* The Cloud App never writes partial Alma user objects.
* No sensitive Alma identifiers or user data are logged.
* Only minimal user attributes required for OA workflows are sent to the proxy.

---

## **6.4 Security Guarantees**

* **No OA credentials in the browser** — ever.
* **No OA Admin API requests made directly from the frontend.**
* **No PII logged or transmitted unnecessarily.**
* **All OA usernames come from OpenAthens**, not from client logic.
* **Only Alma-approved origins may call the proxy.**
* **The app is safe-by-default even when debug mode is enabled** (sanitized responses).

---

# **7. Cloud App Integration**

OA Compass Admin is implemented as a fully compliant **Ex Libris Alma Cloud App**, following all requirements from the Cloud App SDK, Style Guide, Theming Guide, and Settings/Configuration tutorials. The application integrates tightly with Alma’s UI, user entities, and theming system.

---

## **7.1 Cloud App Runtime Features**

The app supports all major Cloud App modes:

### ✔ **Entity-Aware Mode (Recommended)**

* When opened from an Alma **User** page, the app automatically detects the selected user via `CloudAppEventsService.entities$`.
* The app loads this user immediately without requiring search input.

### ✔ **Dashboard/Search Mode**

* When launched from the Alma dashboard or areas without user context, the app falls back to **manual search** using the Smart Search Algorithm.

### ✔ **Settings Screen (User-Level Preferences)**

Uses `CloudAppSettingsService` to persist preferences such as:

* Debug panel visibility
* Future UI-only preferences

### ✔ **Configuration Screen (Institution-Level Settings)**

Uses `CloudAppConfigService` to store:
* Proxy Base URL (HTTPS-only)
* Email domain exclusion rule (skip OA account creation)
* OA Identifier Type Code
* Primary/Secondary OA Username Write-Back Fields

**All OA-sensitive configuration must be stored at the institution level**, not per user.

---

## **7.2 Manifest Integration**

The Cloud App `manifest.json` declares:
* Application name, description, icon, and author
* Required Alma permissions (Users API)
* Entity types consumed (`"USER"`)
* Settings schema for user-level preferences
* Configuration schema for institution-level OA behavior
* Routing entries for:
  * Main UI
  * Settings
  * Configuration
* Theme registration (CloudAppThemeService)

This ensures Alma recognizes the app in all supported modes.

---

## **7.3 SDK Integration Details**

OA Compass Admin uses the following Cloud App SDK features:

### **CloudAppEventsService**

* Drives entity-awareness
* Responds to context changes when the user navigates within Alma

### **CloudAppRestService**

* Used for Alma User GET/PUT operations
* Operates inside the Ex Libris security sandbox

### **CloudAppTranslateModule**

* Full internationalization support
* All UI text stored in `/assets/i18n/*.json`

### **CloudAppSettingsService / CloudAppConfigService**

* Strict separation of user-level vs institution-level storage
* Enforced in the architecture and documented in SDD + CCR

---

## **7.4 UI & Theming Integration**

The app uses:
* Angular Material components styled to Alma standards
* Cloud App theming tokens (light, dark, wide mode)
* Global SCSS theming with no inline styles
* Component-level `.scss` files for layout, spacing, and structure
* Automatic adaptation to Alma layout changes

Theming is applied consistently across search, shell, header, settings, and config screens.

---

## **7.5 Application Structure and Routing**

The application uses simple Cloud App routing:
* `/` – Main user workflow
  * Entity-aware or search mode
  * Displays User Shell once a user is selected
* `/settings` – User preference screen
* `/config` – Institution-level OA configuration

Navigation is driven by standard Cloud App UI patterns and header actions.

---

## **7.6 Reactive State Integration**

### **StateService**

Provides reactive global state for:
* Busy indicator
* Last proxy response
* Currently loaded user

### **OAWorkflowService**

Centralizes Create/Sync/Resend operations, reducing component logic and enabling:
* Consistent error handling
* Predictable Alma write-back
* Clear UX messaging

---

## **7.7 Compliance with Cloud App Guidelines**

OA Compass Admin complies with:
* Cloud App Style Guide
* Cloud App Theming Guide
* Cloud App Accessibility expectations
* No secrets in frontend
* No direct external calls
* No inline styles
* Minimal and safe logging
* Proper routing structure
* Strict separation between:
  * View components
  * Business logic services
  * Backend proxy responsibilities

---

# **8. Folder Structure**

The OA Compass Admin project is organized into clearly separated frontend and backend layers. The structure below reflects the final architecture defined in the SDD and CCR.

```
root/
│ README.md
│ PROJECT_PLAN.md
│ SDD.md
│ CCR.md
│ LOADER.md
│ config.json
│
├── server/                         # Hardened OA Proxy (Node.js)
│   ├── server.js                   # Entrypoint: HTTP server + routing
│   ├── config.js                   # Environment variable loader & validator
│   ├── cors.js                     # Strict CORS allowlist enforcement
│   ├── oa-client.js                # OA Admin API HTTPS helpers
│   ├── validators.js               # Input validation (create/modify payloads)
│   ├── routes/
│   │   └── users.js                # /v1/oa/users/* handlers (get, verify, create, modify, resend)
│   ├── package.json
│   └── .env                        # Deployment-only environment config (never committed)
│
└── src/                            # Angular Alma Cloud App
    ├── main.scss                   # Global theme + Alma style overrides
    ├── assets/
    │   └── i18n/                   # Translation files (e.g., en.json)
    │
    └── app/
        ├── manifest.json           # Cloud App metadata, permissions, settings/config schemas
        ├── app.module.ts           
        ├── app-routing.module.ts
        ├── app.component.ts
        ├── app.component.html
        │
        ├── main/                   # Root UI logic
        │   └── main.component.*    # Entity-aware workflow container
        │
        ├── components/             # UI components (presentation-only)
        │   ├── app-header/         # Header bar + navigation actions
        │   ├── user-search/        # Smart Alma user search UI
        │   ├── user-shell/         # User info + OA status + action panel
        │   ├── user-info/          # Alma user summary card
        │   ├── status/             # OA status + proxy debug output
        │   ├── provision/          # OA workflow buttons (Create, Sync, Resend)
        │   ├── toast/              # Notifications
        │   ├── settings/           # User-level settings screen
        │   └── config/             # Institution-level configuration screen
        │
        ├── services/               # Business logic + backend integration
        │   ├── alma-user.service.ts        # Alma GET/PUT + identifier write-back logic
        │   ├── almaws-rest.service.ts      # Wrapper around CloudAppRestService
        │   ├── oa-proxy.service.ts         # Secure proxy calls to OA endpoints
        │   ├── oa-workflow.service.ts      # Orchestration for Create/Sync/Resend
        │   ├── entity-context.service.ts   # Entity-aware Alma user detection
        │   ├── state.service.ts            # Reactive global state (busy, user, debug output)
        │   ├── settings.service.ts         # CloudAppSettingsService wrapper
        │   └── config.service.ts           # CloudAppConfigService wrapper
        │
        └── models/                 # Canonical TypeScript interfaces (CCR-defined)
            ├── alma-user.model.ts
            ├── oa-account.model.ts
            └── oa-settings.model.ts
```

---

# **9. Coding Standards**

OA Compass Admin follows strict coding, naming, and architectural rules to ensure consistency, maintainability, and security. The following standards reflect the authoritative definitions in the **SDD**, **CCR**, and **Project Plan**.

---

## **9.1 Angular & Cloud App Architecture**

* Follow the **Angular Style Guide** in all files and patterns.
* Components remain **thin** and contain **no business logic**.
* All OA workflows (Create, Sync, Resend) must run through:
  * `OAWorkflowService` (workflow orchestration)
  * `OAProxyService` (API communication)
  * `AlmaUserService` (GET/PUT + identifier management)
* No component may call Alma REST or OA endpoints directly.
* No new components/services/models may be introduced unless added to the **CCR**.

---

## **9.2 Code Structure Rules**

* **Services own all business logic.**
* **Components own only presentation logic.**
* All data flow is unidirectional and observable where appropriate.
* Use `StateService` for:
  * Busy indicators
  * Selected user
  * Debug panel output

---

## **9.3 Security & Proxy Standards**

* The frontend must **never** contain OA credentials, tenant values, or keys.
* Proxy URLs must be HTTPS-only; invalid URLs must be ignored.
* All OA calls must be routed exclusively through `OAProxyService`.
* No username generation logic is allowed in the frontend or proxy — OA is authoritative.
* Logs must follow the Phase-5 hardening rules:
  * No PII
  * No OA usernames except in debug mode
  * No full payload dumps

---

## **9.4 Theming & Styling**

* **No inline styles** or inline `style=` attributes.
* **No hard-coded colors**; use Alma theme tokens and SCSS variables.
* Every component must have its own `.scss` file and (if needed) `.theme.scss` file.
* All styling must follow:
  * Alma Cloud App Style Guide
  * Cloud App Theming Guide

---

## **9.5 TypeScript Standards**

* Strict TypeScript mode: **no implicit `any`**.
* Use **canonical models** defined in `/models` (from CCR).
* Do not create ad-hoc types; update CCR if new models are required.
* Prefer typed Observables and Promises consistently.

---

## **9.6 Internationalization (i18n)**

* All user-visible strings must appear in `/assets/i18n/*.json`.
* Use translation pipes and service calls consistently:
  * `{{ 'oa.key' | translate }}`
  * `translate.instant('oa.key')`
* No hard-coded English strings allowed in templates.

---

## **9.7 Naming Conventions**

* **Files**: `kebab-case`
* **Classes & Components**: `PascalCase`
* **Functions & Variables**: `camelCase`
* **Models**: `*.model.ts`
* **Services**: `*.service.ts`
* **SCSS**: BEM-influenced block/element modifiers where appropriate

---

## **9.8 Alma Data Handling Rules**

* Alma writes must always follow the **full GET → modify → PUT** workflow.
* Only `AlmaUserService` may update identifiers, notes, or job descriptions.
* All identifier array handling must follow the canonical algorithm in the SDD.
* The app must never mutate Alma user objects outside this service.

---

## **9.9 Allowed & Forbidden Practices**

### **Allowed**

✔ Use Observables for state
✔ Encapsulate workflows in services
✔ Modular SCSS with Alma themes
✔ CloudApp events for entity context
✔ Schema-driven configuration

### **Forbidden**

✘ New endpoints or services not defined in CCR
✘ Direct OA calls from frontend
✘ Inline CSS or manually colored elements
✘ Adding new models without SDD/CCR updates
✘ Storing sensitive values in LocalStorage/SessionStorage
✘ Logging PII or unfiltered OA/Alma payloads

---

# **10. System Design Summary**

This section summarizes the architectural model of OA Compass Admin.
A full, authoritative reference is available in **SDD.md**, which governs all modules, algorithms, and data structures in this project.

---

## **10.1 Core Modules**

### **Frontend Modules**

* **Main Component (Entity-Aware Root)**
  Handles routing between search mode, entity context mode, settings, and configuration.

* **UI Components**
  Modular, presentation-only components for:

  * Header
  * Search
  * User Shell
  * User Info
  * OA Status
  * Provision Actions (Create, Sync, Resend)
  * Settings
  * Configuration
  * Toast notifications

* **AlmaUserService**
  Full Alma user integration: GET → modify → PUT.

* **OAProxyService**
  Typed interface to the hardened Node proxy.

* **OAWorkflowService**
  Centralized workflow engine for Create, Sync, and Resend workflows.

* **StateService**
  Reactive global state (busy indicator, user info, debug output).

* **EntityContextService**
  Listens to CloudAppEventsService to support entity-aware mode.

* **Cloud App Layers**

  * User-level settings (`CloudAppSettingsService`)
  * Institution-level configuration (`CloudAppConfigService`)

---

## **10.2 Backend Modules (Node Proxy)**

* **server.js** – Entry point, routing dispatcher, CORS enforcement
* **config.js** – Environment variable loading & validation
* **cors.js** – Alma-only CORS allowlist
* **oa-client.js** – OA Admin API HTTPS requests (GET/POST with API key)
* **validators.js** – Payload validation for create/modify workflows
* **routes/users.js** – Canonical endpoint handlers:

  * `/v1/oa/users/get`
  * `/v1/oa/users/verify`
  * `/v1/oa/users/create`
  * `/v1/oa/users/modify`
  * `/v1/oa/users/resend-activation`
  * `/health`

---

## **10.3 Key Data Structures**

### **Alma Data Models**

* `AlmaUser`
* `AlmaIdentifier`
* `AlmaUserLite`

### **OpenAthens Models**

* `OAAccountCreate`
* `OAAccountModify`
* `OAGetResponse`
* `OAResendRequest` / `OAResendResponse`
* `OAWorkflowResult`

### **Settings & Configuration**

* `OACompassSettings`
* Institution-level config:

  * `proxyBaseUrl`
  * `oaIdTypeCode`
  * Primary/secondary write-back fields

All models are defined in `/models` and governed by the **CCR**.

---

## **10.4 Core Algorithms**

### **OA Username Handling**

* OA generates all usernames.
* Proxy returns the authoritative username.
* Cloud App never constructs or prefixes usernames.

### **OA Sync Workflow**

* Lookup account (via username or email)
* Modify attributes if account exists
* Create if not found
* Write authoritative OA username back to Alma

### **Identifier Write-Back Algorithm**

1. GET full Alma user
2. Normalize identifier arrays
3. Apply write-back rules:

   * Identifier type code
   * Job description
   * User note
4. Apply optional secondary location
5. PUT full updated user record

### **Smart Search Algorithm**

1. Email search if input contains `@`
2. Primary ID if single token
3. Name parsing for 2-token or `last, first`
4. Phrase search
5. AND token fallback

### **Proxy Canonical Error Normalization**

Every OA error is transformed to:

```json
{
  "error": "<message>",
  "code": "<OA error code or null>",
  "message": "<sanitized short description>",
  "status": <http_status>
}
```

### **Validation & Security Algorithms**

* CORS allowlist enforcement
* JSON body size limit (200 KB)
* Field-level validation for create/modify
* Group mapping (CODE_TO_KEY → GROUP_MAP)

---

## **10.5 System Behavior Summary**

* Cloud App manages UI, workflows, theming, and Alma updates.
* Proxy manages OA integration, CORS, security, and error normalization.
* OpenAthens Admin API is the authoritative identity provider.
* Architecture follows the separation of concerns enforced by **SDD** and **CCR**.

---

# **11. Canonical Code Registry Summary**

The **Canonical Code Registry (CCR)** defines all allowed modules, services, components, data structures, endpoints, and function signatures for OA Compass Admin.
No code may introduce new names or structures unless the CCR is updated accordingly.

For full details, see **`CCR.md`**.

---

## **11.1 Registered Angular Components**

* **AppHeaderComponent** — Application header bar
* **UserSearchComponent** — Alma smart search interface
* **UserShellComponent** — Container for user actions + debug panel
* **UserInfoComponent** — Alma user summary view
* **OAStatusComponent** — Status + debug display
* **OAProvisionComponent** — Create / Sync / Resend actions
* **ToastComponent** — Notification system
* **SettingsComponent** — User-level preferences
* **ConfigComponent** — Institution-level configuration UI

All components are *presentation-only* and must not contain business logic.

---

## **11.2 Registered Angular Services**

### **Alma Integration**

* `AlmaUserService`
* `AlmaWsRestService` (low-level Alma REST wrapper)

### **OpenAthens Integration**

* `OAProxyService` — Canonical interface to Node proxy
* `OAWorkflowService` — Create / Sync / Resend workflow orchestration

### **Application State & Context**

* `StateService` — Global reactive state
* `EntityContextService` — Entity-aware Alma user detection

### **Cloud App Layer**

* `SettingsService` — Wrapper for CloudAppSettingsService
* `ConfigService` — Wrapper for CloudAppConfigService

---

## **11.3 Registered Functions (Selected)**

### **AlmaUserService**

* `getUser(primaryId: string): Observable<AlmaUser>`
* `updateUserIdentifiers(primaryId: string, identifiers: AlmaIdentifier[]): Observable<AlmaUser>`
* `writeBackOAUsernameBoth(primaryId: string, username: string, idType: string, primaryField: OAUsernameField, secondaryField: OASecondaryField): Promise<void>`

### **OAProxyService**

* `get(payload): Promise<OAGetResponse>`
* `verify(payload): Promise<any>`
* `createAccount(payload: OAAccountCreate): Promise<any>`
* `modifyAccount(payload: OAAccountModify): Promise<any>`
* `resendActivation(payload: OAResendRequest): Promise<OAResendResponse>`

### **OAWorkflowService**

* `createAccountWorkflow(...)`
* `syncAccountWorkflow(...)`
* `resendActivationWorkflow(...)`

Each returns a typed `OAWorkflowResult`.

---

## **11.4 Registered Data Models**

### **Alma Models**

* `AlmaUser`
* `AlmaIdentifier`
* `AlmaUserLite`

### **OpenAthens Models**

* `OAAccountCreate`
* `OAAccountModify`
* `OAGetResponse`
* `OAResendRequest`
* `OAResendResponse`
* `OAWorkflowResult`

### **Settings & Config**

* `OACompassSettings`
* Defaults: `DEFAULT_OA_SETTINGS`

All models reside under `/models` and must match CCR definitions.

---

## **11.5 Canonical Proxy Endpoints**

The Node proxy exposes *only* these endpoints:

```
GET  /health
POST /v1/oa/users/get
POST /v1/oa/users/verify
POST /v1/oa/users/create
POST /v1/oa/users/modify
POST /v1/oa/users/resend-activation
```

No additional endpoints may be added without updating the CCR.

---

## **11.6 Canonical Error Shape**

All backend OA errors must be returned in this normalized structure:

```json
{
  "error": "<summary>",
  "code": "<OA error code or null>",
  "message": "<sanitized message>",
  "status": <http_status>
}
```

This contract is required for OAWorkflowService and OAStatusComponent.

---

## **11.7 Reserved Names**

The following identifiers must never be renamed or removed:

* `OACompassSettings`
* `DEFAULT_OA_SETTINGS`
* `writeBackOAUsernameBoth`
* `normalizedUsername`
* All canonical proxy endpoint paths
* All canonical service class names

---

## **11.8 Allowed External Dependencies**

### **Frontend**

* Angular
* Angular Material
* Cloud App SDK
* RxJS
* SCSS theme tokens

### **Backend**

* Node.js
* `https` / `http`
* `dotenv`

**No Express, Koa, Fastify, Axios, or other frameworks are permitted.**

---

# **12. Development**

This section describes how to set up a complete development environment for OA Compass Admin, including both the **Angular Cloud App frontend** and the **Node.js OA Proxy**.
The Cloud App runs inside Alma’s Cloud App framework, while the proxy runs locally or in a secured institutional environment.

---

## **12.1 Requirements**

### **Frontend**

* Node.js LTS (18.x or 20.x)
* Angular CLI (v16+)
* Alma Cloud App SDK
* Google Chrome or Firefox

### **Backend Proxy**

* Node.js LTS (18.x or 20.x)
* Ability to run on `localhost` with HTTPS reverse proxy (optional in dev)
* `.env` file containing OA Admin API secrets (not checked into git)

---

## **12.2 Install Frontend Dependencies**

```bash
npm install
```

This installs all Angular and Cloud App dependencies.

---

## **12.3 Install Proxy Dependencies**

```bash
cd server
npm install
```

The proxy is a standalone Node.js service with no external frameworks.

---

## **12.4 Running the Cloud App in Development Mode**

The Cloud App can be run locally using the Angular CLI:

```bash
ng serve --open
```

This starts a development server with live reload.
To load it inside Alma:

1. Open **Alma Sandbox**
2. Open **Cloud App Console**
3. Click **Load from URL**
4. Enter:

   ```
   http://localhost:4200
   ```

Alma will load the app directly from your local environment.

---

## **12.5 Running the OA Proxy in Development Mode**

```bash
cd server
node server.js
```

Create a `.env` file in `/server` to store OA settings:

```
PORT=8081
ALLOWED_ORIGINS=http://localhost:4200
OA_BASE_URL=https://admin.openathens.net/api
OA_TENANT=<your-tenant>
OA_API_KEY=<your-key>
OA_CREATE_URL=<your-create-url>
```

> ⚠️ **Never commit `.env` files to version control.**

For local development, Alma Cloud App Console must also trust the proxy origin.

---

## **12.6 Frontend → Proxy Configuration**

In the Cloud App’s **Configuration Screen**, set:

```
Proxy Base URL = https://<your-local-proxy-endpoint>
```

For local development without HTTPS, you may temporarily allow:

```
http://localhost:8081
```

However, **production must use HTTPS only.**

---

## **12.7 Build the Cloud App for Deployment**

To generate the Cloud App artifacts:

```bash
npm run build
```

This produces a production build under:

```
dist/cloudapp
```

To test the production build locally:

```bash
npx http-server dist/cloudapp
```

Then load the new URL in the Alma Cloud App Console.

---

## **12.8 Linting and Formatting**

The project adheres to Angular and TypeScript best practices.
To run linting:

```bash
npm run lint
```

Formatting is controlled by Prettier/TSLint configs if included.

---

## **12.9 Debugging Tools**

### **Frontend**

* Enable the **debug panel** in Settings
* Monitor OAProxyService network calls
* Watch OAWorkflowService logging
* Observe StateService busy/debug streams

### **Proxy**

* Use console logging (sanitized)
* Enable Node inspector:

  ```bash
  node --inspect server.js
  ```

### **Alma**

* Use Network tab to inspect Cloud App REST calls
* Enable Alma Developer Mode in Cloud App Console

---

## **12.10 Testing Notes**

While automated test suites are optional, recommended areas include:

* OAWorkflowService unit tests
* AlmaUserService PUT workflow tests
* Proxy validators.js tests
* Proxy endpoint integration tests

Manual testing via Alma Sandbox is typically sufficient for this project.

---

# **13. Environment Variables**

The OA Compass Admin Proxy is configured entirely through **environment variables**.
These values must be stored **only on the proxy server** (never in the frontend, repository, or Cloud App configuration).

Environment variables may be supplied via:

* `server/.env` file (for local development only)
* Systemd service environment file (recommended for production)
* Secure institutional secrets manager

> ⚠️ **Never commit `.env` files to version control.**
> ⚠️ **Never store OA secrets in CloudAppConfigService.**

---

## **13.1 Required Proxy Environment Variables**

Below is a standard `.env` layout:

```bash
# Port the proxy listens on
PORT=8081

# Comma-separated list of allowed Alma Cloud App origins
# These must match the Alma region(s) used by your institution.
ALLOWED_ORIGINS=https://sandbox.alma.exlibrisgroup.com,https://na02.alma.exlibrisgroup.com

# OpenAthens Admin API configuration
OA_BASE_URL=https://admin.openathens.net/api
OA_TENANT=<your-tenant>
OA_API_KEY=<your-api-key>

# Account creation endpoint for your OA tenant
OA_CREATE_URL=https://admin.openathens.net/api/v1/<your-tenant>/account
```

---

## **13.2 Group Mapping Variables**

The proxy uses Alma group codes to determine OpenAthens group assignments and permission sets. These rules exist only on the server:

```bash
# Example:
GROUP_MAP={"faculty": {"groups": ["staff"], "permissions": ["x1"]}}
CODE_TO_KEY={"01": "faculty", "02": "students"}
```

* `CODE_TO_KEY` maps Alma group codes → internal policy keys.
* `GROUP_MAP` maps internal keys → OA group & permission definitions.

These mappings are **not visible to the Cloud App** and must not be exposed.

---

## **13.3 Development vs Production**

### **Development (`server/.env`)**

* You may allow the local frontend via:

  ```
  ALLOWED_ORIGINS=http://localhost:4200
  ```
* OA_API_KEY should still be stored only in `.env`, not in code.
* Username prefix is not used — OA generates all usernames.

### **Production**

* Run proxy behind institutional HTTPS reverse proxy
* Bind Node to localhost:

  ```
  PORT=8081
  ```
* Use systemd or secrets manager to store:

  * OA_API_KEY
  * OA_TENANT
  * GROUP_MAP
  * CODE_TO_KEY
* Recommended:

  ```
  NODE_ENV=production
  ```

---

## **13.4 Security Requirements**

* OA credentials **must never appear in frontend logs or responses**.
* `.env` file must have restricted permissions (`0600`).
* OA_BASE_URL, OA_TENANT, and mapping rules must not be configurable from Cloud App UI.
* ALLOWED_ORIGINS must include *only* Alma Cloud App domains.
* Username generation is handled exclusively by OpenAthens; no prefix variables are allowed.

---

## **13.5 Example Production `.env` (Sanitized)**

```bash
PORT=8081
NODE_ENV=production

ALLOWED_ORIGINS=https://na02.alma.exlibrisgroup.com

OA_BASE_URL=https://admin.openathens.net/api
OA_TENANT=myuniversity.edu
OA_API_KEY=<REDACTED>

OA_CREATE_URL=https://admin.openathens.net/api/v1/myuniversity.edu/account

CODE_TO_KEY={"01": "faculty", "02": "students"}
GROUP_MAP={"faculty": {"groups": ["libstaff"], "permissions": ["fed-login"]}}
```

---

# **14. Running**

OA Compass Admin consists of two parts:

1. **Angular Cloud App frontend** (runs inside Alma)
2. **Node.js OA Proxy backend** (secure server controlled by your institution)

Both must be running and correctly configured in order to use OA functionality.

---

# **14.1 Running the OA Proxy (Backend)**

From the project root:

```bash
cd server
node server.js
```

The proxy loads environment variables from:

* `server/.env` (development)
* `/opt/oa-proxy/.env` or systemd environment file (production)

When the proxy starts successfully, you should see:

```
OA Proxy listening on port 8081
Allowed origins: [...]
```

### **Proxy Health Check**

```
GET https://<your-proxy>/health
```

Returns:

```json
{ "status": "ok" }
```

If this endpoint does not respond, OA workflows will fail.

---

# **14.2 Running the Cloud App Frontend (Development Mode)**

Start the Angular dev server:

```bash
ng serve --open
```

This launches the app at:

```
http://localhost:4200
```

To run it inside Alma:

1. Open **Alma Sandbox**
2. Open the **Cloud App Console**
3. Select **Load from URL**
4. Enter:

   ```
   http://localhost:4200
   ```

Alma will render your local development build inside a real Cloud App frame.

---

# **14.3 Configure the Proxy URL in Alma**

After loading the app in Alma:

1. Open **Configuration** (gear icon in app header)
2. Set **Proxy Base URL** to your local proxy:

   ```
   http://localhost:8081
   ```
3. Save

> ⚠️ In production this must be `https://`.

OA workflows (Create, Sync, Resend) will not function until this is configured.

---

# **14.4 Running Both Processes Together**

You will need **two terminal windows**:

### Terminal 1 — Proxy

```bash
cd server
node server.js
```

### Terminal 2 — Frontend

```bash
ng serve --open
```

Then load the frontend into Alma via Cloud App Console.

---

# **14.5 Running a Production Build**

Build the Cloud App:

```bash
npm run build
```

The production app is output to:

```
dist/cloudapp/
```

To test the production build locally:

```bash
npx http-server dist/cloudapp
```

Then in Alma Cloud App Console:

```
http://localhost:8080
```

(or whatever port http-server reports)

---

# **14.6 Deploying the Proxy in Production**

Typical steps:

1. Copy `server/` files to a secure institutional host
2. Install Node.js (LTS)
3. Create a production `.env` (never checked into git)
4. Run behind institutional HTTPS reverse proxy (Apache/Nginx)
5. Bind Node to localhost:

   ```
   PORT=8081
   ```
6. Start via systemd:

Example unit:

```
[Unit]
Description=OA Compass Admin Proxy
After=network.target

[Service]
EnvironmentFile=/opt/oa-proxy/.env
WorkingDirectory=/opt/oa-proxy
ExecStart=/usr/bin/node server.js
Restart=always
User=proxyuser
Group=proxygrp

[Install]
WantedBy=multi-user.target
```

---

# **14.7 Testing End-to-End**

### Test 1 — Alma User Retrieval

Search or open an Alma user → User info displays.

### Test 2 — Proxy Connectivity

Trigger **Sync** → proxy receives request → OA returns username.

### Test 3 — Write-Back

OA username appears in Alma:

* Identifier
* Job description
* User note
  (depending on configuration)

### Test 4 — Debug Mode

Enable debug panel → proxy responses appear as sanitized JSON.

---

# **15. Theming & Styling**

OA Compass Admin is fully compliant with the **Alma Cloud App Style Guide** and **Theming Guide**.
All UI elements adapt automatically to Alma's **Light**, **Dark**, and **Wide** display modes and use the Material theme tokens provided by the Cloud App host.

---

## **15.1 Cloud App Theme Integration**

The app relies on the CloudApp SDK theme engine:

* Alma injects theme variables into the app at runtime
* Angular Material components automatically reflect Alma’s theme
* No custom theme switching is required—only theme-friendly SCSS rules

Global theme styles reside in:

```
src/main.scss
```

Each component may also include a `.theme.scss` file for theme-specific overrides.

---

## **15.2 Styling Rules**

OA Compass Admin obeys all official Cloud App styling requirements:

### **No inline styles**

All styling must be written in SCSS.
No component may use `style=` attributes.

### **No hard-coded colors**

Only Alma theme tokens may be used:

```scss
color: var(--color-primary);
background: var(--color-surface);
```

### **BEM-inspired SCSS structure**

Component styles follow a predictable structure:

```scss
.component {
  &__element { … }
  &--modifier { … }
}
```

### **No layout-breaking CSS**

* Avoid absolute positioning
* Avoid fixed pixel dimensions except where required

---

## **15.3 Material Component Guidelines**

All UI elements use **Angular Material** components styled through Alma tokens:

* `<mat-card>` for content grouping
* `<mat-form-field>` for inputs
* `<mat-button>` for actions
* `<mat-progress-bar>` and `<mat-spinner>` for loading states
* `<mat-icon>` for consistent iconography

Component density, spacing, and typography all follow Material defaults unless overridden by Alma’s theme.

---

## **15.4 Responsive Layout & Wide Mode Support**

The app gracefully adjusts to:

* **Standard Alma sidebar width**
* **Wide Mode**, providing expanded space for user info and provisioning controls
* **Small window sizes**, including narrow Cloud App panels

Layouts rely on:

* CSS Grid
* Flexbox
* Fluid spacing tokens

---

## **15.5 Light/Dark Mode Support**

All components must validate their appearance in:

### **Light Mode**

Default Alma UI experience

* Ensure shadows and card backgrounds maintain readability

### **Dark Mode**

High-contrast appearance

* Use Alma-provided dark palette tokens
* Avoid hard-coded borders or backgrounds

### **Focus & accessibility**

Focus outlines must always remain visible in both modes.

---

## **15.6 Overlays, Menus, and Popups**

Cloud Apps impose constraints on overlays. OA Compass Admin complies by:

* Using Angular Material overlay positioning with Alma adjustments
* Ensuring popups never extend outside Cloud App boundaries
* Applying Cloud App safe-zone padding

---

## **15.7 Accessibility**

The app follows WCAG-compliant patterns:

* High contrast in both modes
* Clear focus indicators
* Proper ARIA labels for buttons and icons
* Semantic HTML for info panels and action groups
* Meaningful text alternatives for icon-only buttons

---

## **15.8 Iconography**

* Uses Angular Material icons or Alma-approved icon sets
* No raster images except screenshots or branding assets
* Icons should reflect action hierarchy:

  * Add = create
  * Sync = refresh
  * Email = resend activation
  * Info = OA status

---

## **15.9 Recommended Component Styling Pattern**

Each component folder should contain:

```
my-component.component.ts
my-component.component.html
my-component.component.scss
my-component.theme.scss (optional)
```

`*.theme.scss` files contain:

* Color overrides
* Dark mode adjustments
* Alma token references

---

## **15.10 Summary**

The OA Compass Admin Cloud App:

✔ Fully adapts to Alma Light, Dark, and Wide modes
✔ Uses SCSS and Alma theme tokens exclusively
✔ Implements Cloud App Style Guide layout and spacing rules
✔ Uses Angular Material responsibly and consistently
✔ Ensures accessibility and clarity across user groups
✔ Provides a polished, native Alma visual experience

---

# **16. ChatGPT Collaboration Rules**

OA Compass Admin uses a rigorous, architecture-aware collaboration model to prevent the introduction of incorrect code, invalid endpoints, or undocumented structures.
These rules govern all ChatGPT interactions related to this project.

---

## **16.1 Authoritative Sources (Must Always Be Loaded)**

Before ChatGPT answers *any* question, it must load and internalize:

* **README.md** — Project overview, architecture, theming, security
* **SDD.md** — System Design Document (canonical architecture + algorithms)
* **CCR.md** — Canonical Code Registry (allowed names, structures, services)
* **PROJECT_PLAN.md** — Phase roadmap and scope boundaries

These files are the *only* source of truth for the project.

---

## **16.2 No Invention Rule**

ChatGPT must **never** create:

* New services
* New components
* New models
* New fields
* New endpoints
* New environment variables
* New OA/Alma workflows

unless first added to the **CCR** by human instruction.

If a user requests something outside CCR, ChatGPT must respond:

> “This name or structure does not appear in the CCR.
> It must be added there (and to the SDD) before it can be used.”

---

## **16.3 Strict Architecture Compliance (SDD Enforcement)**

All logic must conform to the SDD, including:

* Only **OAWorkflowService** may run OA workflows
* Only **AlmaUserService** may update Alma records
* Only **OAProxyService** may call the Node proxy
* Entity-aware mode must always be respected
* Alma writes must follow **GET → modify → PUT**
* Identifier write-back must follow canonical SDD algorithms

No deviations are allowed.

---

## **16.4 Security Model Enforcement**

ChatGPT must:

* Never output OA secrets
* Never prompt the user to store secrets in CloudAppConfigService
* Never generate OA usernames
* Never create code that bypasses proxy-only OA access
* Ensure all proxy URLs use **HTTPS** unless explicitly in dev mode
* Enforce CORS + proxy constraints described in the SDD/README

Any suggestion that violates this model must be rejected.

---

## **16.5 Theming + Styling Enforcement**

ChatGPT must ensure:

* No inline CSS
* No hard-coded colors
* All SCSS uses Alma theme tokens
* Components have `.scss` and optional `.theme.scss` files
* Light/Dark/Wide modes are always supported

---

## **16.6 Cloud App SDK Compliance**

ChatGPT must adhere to:

* Correct use of CloudAppEventsService
* Correct use of CloudAppSettingsService vs CloudAppConfigService
* Correct routing patterns
* Proper entity-aware UX
* Cloud App style and accessibility rules

---

## **16.7 Phase-Aware Behavior (Project Plan Enforcement)**

Every task belongs to a specific phase in PROJECT_PLAN.md.

ChatGPT must:

1. Identify the active phase
2. Load that phase’s goals and scope
3. Reject or postpone any request outside that phase

Example:

> “That task belongs to Phase 6.
> We are currently in Phase 4.
> Please confirm if you wish to switch phases.”

---

## **16.8 Output Rules**

* Use **full-file outputs** unless the user explicitly asks for diffs
* Code must be self-contained and compile
* Ask clarifying questions when the request is ambiguous
* Maintain existing naming and structure exactly

---

## **16.9 Documentation Update Consistency**

If ChatGPT updates:

* README.md
* SDD.md
* CCR.md
* PROJECT_PLAN.md

It must ensure **all four documents remain consistent**.

If inconsistencies arise, ChatGPT should warn:

> “This change requires updates to SDD and CCR to remain consistent.”

---

## **16.10 Debugging, Logging, and Output Safety**

ChatGPT must enforce:

* No logs containing PII or secrets
* Debug output only in debug mode
* Cloud App safe logging practices (status-only logs)
* OA error responses must follow canonical error shape

---

## **16.11 The Forever Loader (Session Bootstrap)**

ChatGPT must follow the reusable session loader included in this repository(LOADER.MD):

* Load all project files
* Enforce CCR + SDD constraints
* Enforce phase scope
* Apply architectural and security rules
* Ask for the first task only after confirming the active phase

---

# **17. Roadmap**

The full project roadmap is defined in **`PROJECT_PLAN.md`** and reflects the complete modernization of the OA Compass Admin Cloud App and Proxy.

---

## **✔ Phase 0 — Codebase Realignment**

* Upgrade Angular
* Stabilize legacy Cloud App structure
* Remove obsolete code paths
* Re-establish build + run workflow

---

## **✔ Phase 1 — Style Guide Compliance**

* Adopt Alma Cloud App Style & UX guidelines
* Replace noncompliant UI elements
* Introduce consistent SCSS structure
* Remove inline styling and obsolete markup

---

## **✔ Phase 2 — Theming & Functional Restoration**

* Implement Alma Light/Dark/Wide theme support
* Restore all broken legacy functionality
* Reintroduce correct Alma search and user loading
* Normalize UI layout and spacing

---

## **✔ Phase 3 — Entity-Aware Mode & Modular Refactor**

* Introduce clean routing structure
* Add Settings and Configuration screens
* Implement EntityContextService (auto-load Alma users)
* Split monolithic logic into services and UI components
* Refactor provisioning UI into UserShell + subcomponents

---

## **✔ Phase 4 — Institutional Configuration**

* Implement CloudAppConfigService integration
* Add configurable:
  * Proxy Base URL
  * OA Identifier Type Code
  * Primary/Secondary write-back fields
* Remove all hard-coded OA settings
* Finalize configuration UI and schema

---

## **✔ Phase 5 — Security & Deployment Hardening**

* Enforce HTTPS-only proxy usage
* Validate and sanitize all proxy inputs
* Restrict proxy CORS to Alma domains
* Harden error-handling and logging
* Add comprehensive environment variable validation
* Prepare proxy for institutional deployment (systemd, reverse proxy)

---

## **✔ Phase 6 — Testing, State Management, & Internationalization**

* Add OAWorkflowService (Create / Sync / Resend orchestration)
* Add StateService (busy state, debug output, selected user)
* Modularize proxy:
  * server.js
  * cors.js
  * config.js
  * oa-client.js
  * validators.js
  * routes/users.js
* Add full i18n support via CloudAppTranslateModule
* Simplify component logic and ensure deterministic UI state
* Manual testing and UX refinement

---

## **🔥 Phase 7 — Documentation & Publishing (Current Phase)**

**Goal:** Produce the final, polished release package for OA Compass Admin.

Includes:

* Removal of obsolete or misleading configuration references
* Clarification of OA username handling and settings boundaries
* Full documentation alignment (README, SDD, CCR, PROJECT_PLAN)
* CHANGELOG.md creation
* CONTRIBUTING.md (optional but recommended)
* Version tagging (v1.0.0)
* Final QA and usability review
* **App Listing Polish** per Ex Libris Cloud App Center requirements:
  * App name, summary, long description
  * Screenshots
  * App icon
  * Support contact
  * Metadata for submission

Once Phase 7 is complete, the application is ready for institutional deployment and/or submission to the **Ex Libris Cloud App Center**.

---

# **18. License**

Copyright © 2025 <Institution Iowa State Univeristy>

Licensed under the **Apache License, Version 2.0** (the "License");
you may not use this file or the OA Compass Admin project except in compliance with the License.

You may obtain a copy of the License at:

```
http://www.apache.org/licenses/LICENSE-2.0
```

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an **"AS IS" BASIS**,
**WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND**, either express or implied.

See the License for the specific language governing permissions and
limitations under the License.

---