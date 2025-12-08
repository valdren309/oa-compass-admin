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

# **1. Purpose & Goals**

### Goals

1. Replace the legacy PHP OA provisioning tool with a **secure, maintainable Alma Cloud App**.
2. Ensure **all OpenAthens (OA)** calls go through a **Node.js proxy**, with **no secrets in the Cloud App**.
3. Provide a librarian-facing UI to:
   - Inspect Alma users
   - Create/sync/verify OA accounts
   - Push the OA username back into Alma identifiers
4. Fully align with:
   - Alma **Cloud App SDK** patterns
   - Cloud App **styling + theming** tutorials
   - Type-safe, service-based Angular architecture
5. Rely on **OA-generated usernames**, and **write them back into Alma** using configurable fields (identifier, job description, user note).


This rewrite:

### ✔ Runs inside Alma as a first-class Cloud App

### ✔ Uses a secure backend proxy for all OA requests

### ✔ Implements full theming + Cloud App design standards

### ✔ Normalizes OA username generation

### ✔ Allows configurable mappings and storage rules

### ✔ Uses strict TypeScript + modular architecture

### ✔ Requires zero secrets in the browser

---

# **2. High-Level Requirements**

## **Functional**

- Search Alma users (ID, name, email, barcode)  
- Support entity-aware mode when launched from an Alma User page  
- Display Alma user summary, group, and expiry information  
- **Create OA accounts without specifying a username** (OA generates it)  
- Retrieve the OA-generated username from the proxy response  
- Modify existing OA accounts (names, expiry, email, policy mapping)  
- Verify whether an OA account exists (username or email based)  
- Resend OA activation links  
- **Write OA-generated username back into Alma** using admin-configured:  
  - Primary field (identifier / job description / user note)  
  - Optional secondary field  
- Reflect OA account status, actions, and errors clearly in the UI  
- Provide institutional configuration for:  
  - Proxy base URL  
  - OA identifier type code (for Alma write-back)  
  - Primary/secondary Alma write-back fields  

## **Non-Functional**

- **Zero OA secrets in the browser** (all secrets remain on the proxy server)  
- All OA calls flow: **Cloud App → Node proxy → OA Admin API**  
- Proxy enforces strict validation, CORS, hostname restrictions  
- Strict TypeScript types and canonical data models  
- Responsive, theme-aware UI (Alma Light / Dark / Wide modes)  
- Modular Angular architecture aligned with Cloud App guidelines  
- Clear separation of concerns between search, user shell, actions, and config  
- Fully compliant with Alma Cloud App security and UX standards  
- Minimal required proxy configuration (OA_BASE_URL, OA_TENANT, OA_API_KEY, OA_CREATE_URL) stored server-side  

---

# **3. Architecture Overview**

```
   +------------------------------------------------------+
   |                    Alma Cloud App                    |
   |           (Angular + Ex Libris CloudApp SDK)         |
   +-------------------------+----------------------------+
                             |
                             | Alma REST API
                             v
                  +------------------------+
                  |       Alma Users       |
                  +------------------------+

                             HTTPS
                             |
                             v

   +-----------------------------------------------------+
   |                    Node.js Proxy                    |
   |     (Secure middleware for all OA Admin API calls)  |
   +--------------------------+---------------------------+
                              |
                              | OA Admin API
                              v
                  +-----------------------------+
                  |    OpenAthens Admin API     |
                  | (OA-generated usernames)    |
                  +-----------------------------+
```

### **Key Principles**

- **Frontend never sends secrets and never contacts OA directly**  
  All OA communication flows through the hardened proxy.

- **OA generates usernames automatically**  
  The Cloud App no longer constructs or prefixes usernames.

- **Proxy handles validation, normalization, prefixing, and CORS**  
  Ensures safe access to OA Admin API and prevents direct exposure.

- **Alma Cloud App SDK handles routing, theming, entity context, and storage**  
  Fully aligned with Ex Libris Cloud App guidelines.

- **Full Alma user updates use PUT with canonical normalization**  
  Including identifier upserts, user_note updates, and job_description updates.

- **Institution-level configuration defines write-back behavior**  
  Primary and secondary OA storage fields are centrally controlled in `/config`.

---

# **4. Frontend Design**

The frontend is a modular Angular Alma Cloud App built using the **Ex Libris CloudApp SDK**, with a strict separation between:

* **UI components**
* **Alma business logic**
* **OpenAthens workflow orchestration**
* **Application state management**
* **Internationalization (i18n)**

All visible UI text is externalized through the Cloud App translation system (`CloudAppTranslateModule`) using JSON files under `assets/i18n/`.

---

## **Core Components**

* **`oa-app-header`**
  Unified top bar showing OA status text, busy indicator, and settings/config buttons; fully localized.

* **`oa-user-search`**
  Full Alma user search (ID, name, email, barcode) with paging and debounced input; all strings translated.

* **`oa-user-shell`**
  Primary container for a selected user:

  * `user-info` panel
  * OA provisioning controls
  * Debug panel (optional, user-toggleable)

* **`user-info`**
  Clean display of Alma demographics, group, expiry, and OA username (derived via AlmaUserService).

* **`oa-status`**
  Displays current OA action status and messages (now driven by i18n + `StateService`).

* **`oa-provision`**
  Action button bar for OA workflows.
  *Verify has been removed (redundant with Sync).*

* **`toast`**
  Alma Cloud App–style ephemeral notifications.

* **`settings`**
  Per-user Cloud App preferences (currently debug panel visibility).

* **`config`**
  **Institution-level configuration**: proxy base URL, OA identifier type, primary/secondary storage fields.

---

## **Core Services**

* **`AlmaUserService`**

  * Typed GET/PUT for Alma user endpoints
  * Identifier normalization
  * Username extraction helpers
  * **Centralized OA username write-back logic**
  * Validation helpers (`validateUserForOA`), now used by workflow service

* **`OAProxyService`**

  * Typed, HTTPS-enforced calls to the hardened Node proxy
  * `get`, `createAccount`, `modifyAccount`, `resendActivation`
  * Error normalization
  * *Does not generate usernames—OA does.*

* **`OAWorkflowService`** *(Phase 6 addition)*

  * **Primary orchestrator** for Create + Sync + Resend workflows
  * Builds payloads, handles OA/Alma sequencing, reload triggers
  * Translates all status messages through i18n
  * Produces structured workflow results consumed by MainComponent

* **`EntityContextService`**

  * Watches Alma “User” entity context
  * Enables seamless “Option A” mode when invoked from Alma User pages

* **`StateService`** *(Phase 6 addition)*

  * Central reactive application state
  * `busy$`, `lastProxyResponse$`, and selected user signals
  * Reduces MainComponent complexity and synchronizes UI state across components

* **`CloudAppSettingsService` / `CloudAppConfigService`**

  * Persist user-level vs institution-level settings separately
  * Used during startup to initialize UI/preferences

---

## **Internationalization (i18n)**

All user-visible strings are externalized into:

```
/assets/i18n/en.json
```

The app bootstraps translation via:

```ts
CloudAppTranslateModule.forRoot()
translate.use('en')
```

Components rely on:

* `{{ 'oa.some.key' | translate }}`
* `translate.instant('oa.key', { params })` in workflow/services

Debug output stays raw for diagnostic value (per project rules).

---

## **Routing**

* **`/` — Main UI**

  * Search mode
  * Entity-context mode
  * OA actions (Create / Sync)
  * Debug panel (optional)

* **`/settings` — Per-user preferences**

  * Debug panel default state

* **`/config` — Institution-level configuration**

  * Proxy base URL
  * OA identifier type code
  * Primary/secondary OA username write-back fields
  * Future extensibility for policy mapping

---

### **5. Node Proxy Architecture (Updated for Phase 6 Modularization)**

The OA Compass Admin Proxy is a secure Node.js service that mediates all communication between the Cloud App and the OpenAthens Admin API. As of Phase 6, the proxy has been modularized for clarity, maintainability, and improved security auditing.

### **5.1 Core Principles**

* All secrets remain server-side (OA API key, tenant, base URL).
* All Cloud App → OA requests flow **exclusively** through the proxy.
* The proxy exposes a stable, minimal set of endpoints defined in the CCR.
* Request validation, CORS control, and error normalization are now centralized.

### **5.2 File Structure**

The proxy now consists of the following modules:

```
server/
  server.js               → Minimal entrypoint, wires HTTP server + routing
  config.js               → Loads validated environment variables
  cors.js                 → Origin validation + Access-Control headers
  oa-client.js            → Low-level OA HTTPS helpers (GET/POST)
  validators.js           → Input validation helpers for create/modify
  routes/
    users.js              → Handlers for all /v1/oa/users/* endpoints
  package.json
  .env                    → Deployment-only environment file (not committed)

### **5.3 Request Flow**

1. Cloud App calls OAProxyService → `https://yourproxy/...`.
2. `server.js` checks CORS and dispatches request.
3. `routes/users.js` parses JSON (200 KB limit) and performs validation.
4. OA HTTPS calls are made through `oa-client.js`.
5. Outputs are normalized into the canonical proxy error/success structure.

### **5.4 Standardized Error Shape**

All non-2xx OA responses return:

```
{
  "error": "OA create failed",
  "code": "OA_ERROR_CODE",   // if provided
  "message": "Descriptive message",
  "status": 400
}
```

### **5.5 Behavior Preservation Guarantee**

The Phase 6 modularization does **not change** any functional behavior: existing front-end components and workflows continue to function identically.

---

# **6. Security Model**

OA Compass Admin is designed so that **all sensitive operations** occur on the
server-side OA Proxy, not in the Alma Cloud App.

**Cloud App**

- Never stores or transmits OA API keys, passwords, or secrets.
- Communicates only with:
  - Alma via `CloudAppRestService` (within Ex Libris’ platform).
  - The OA Proxy via `OAProxyService` over **HTTPS**.
- Reads `proxyBaseUrl` from Cloud App configuration, but:
  - Rejects any value that does not start with `https://`.
  - Falls back to a compiled default if the configured URL is invalid.
- Does not call proxy debug/diagnostic endpoints from the UI.
- Shows detailed OA responses only in the debug panel, and only on success.
- Logs are trimmed to status + message; they do not include PII or full Alma/OA
  payloads.

**OA Proxy**

- Runs on a campus-controlled host, bound to `127.0.0.1`, and is exposed only
  through an institutional HTTPS reverse proxy.
- OA Admin API credentials (`OA_API_KEY` and related settings) live only in
  server environment variables or `.env` files and are **never** sent to the
  browser.
- Exposes a minimal API surface to the Cloud App:

  - `POST /v1/oa/users/verify`
  - `POST /v1/oa/users/get`
  - `POST /v1/oa/users/create`
  - `POST /v1/oa/users/modify`
  - `POST /v1/oa/users/resend-activation`
  - `GET  /health` (ops/monitoring only)

- Enforces strict CORS using `ALLOWED_ORIGINS` (Alma domains only).
- Sanitizes OA error responses to avoid leaking internal details or identifiers.
- Delegates **username generation** to OpenAthens; the Cloud App only consumes
  the generated username and writes it back into Alma using configurable fields.

**Alma Integration**

- All Alma writes follow the **full GET + PUT** pattern:
  - Fetch full user (`view=full`).
  - Update identifiers and/or configured fields.
  - PUT the complete user record back.
- OA usernames are stored according to institution-configurable rules:
  - Identifier type code (e.g. `oaIdTypeCode = "02"`).
  - Primary/secondary write-back targets:
    - `job_description`
    - the configured identifier type
    - `user_note`

---

# **7. Cloud App Integration**

This app follows **all** principles from:

* Cloud App Style Guide
* Cloud App Theming Guide
* Cloud App Routing + Settings tutorials
* Angular Material requirements

### **Modes**

✔ Dashboard widget
✔ Entity-aware mode (recommended)
✔ Full settings screen
✔ Full configuration screen

---

# **8. Folder Structure**

```
/
│ README.md
│ PROJECT_PLAN.md
│ SDD.md
│ CCR.md
│ LOADER.md
│ config.json
│
├── server/
│   ├── server.js          # Minimal HTTP entrypoint + routing
│   ├── config.js          # Loads env vars, validates OA/port/origin settings
│   ├── cors.js            # CORS allowlist + headers
│   ├── oa-client.js       # Low-level OA HTTPS helpers
│   ├── validators.js      # Input validation helpers (create/modify payloads)
│   ├── routes/
│   │   └── users.js       # /v1/oa/users/* handlers (verify/get/create/modify/resend)
│   ├── package.json
│   └── .env               # Not committed; stored only on deployment server
│
└── src/
├── main.scss # Global theme + overrides injected by Cloud App host
├── assets/
├── i18n/
│
└── app/
├── app.module.ts
├── app-routing.module.ts
├── app.component.ts
├── app.component.html
├── manifest.json
│
├── main/
│ └── main.component.* # Entity-aware root UI logic
│
├── components/
│ ├── app-header/ # Combined status + actions header
│ ├── config/ # Institution-wide configuration screen
│ ├── provision/ # Create / Sync / Verify actions
│ ├── settings/ # User-level settings
│ ├── status/ # OA status panel
│ ├── toast/ # Cloud App-style notifications
│ ├── user-info/ # User summary card
│ ├── user-search/ # Search component (ID/name/email/etc.)
│ └── user-shell/ # Wrapper for user actions + debug panel
│
├── services/
│ ├── alma-user.service.ts # Alma user GET/PUT + identifier logic
│ ├── al­maws-rest.service.ts # Low-level Alma REST client (your wrapper)
│ ├── entity-context.service.ts # Watches Alma entity context
│ ├── oa-proxy.service.ts # Proxy calls (verify, get, create, modify)
│ ├── settings.service.ts # CloudAppSettingsService wrapper (Future)
│ └── config.service.ts # CloudAppConfigService wrapper (Future)
│
└── models/
├── alma-user.model.ts
├── oa-account.model.ts
└── oa-settings.model.ts
```

---

# **9. Coding Standards**

* Follow Angular Style Guide strictly
* Services own business logic
* Components remain thin
* No inline styles
* Strict TypeScript: no implicit `any`
* All API payloads use typed models
* Naming conventions:

  * Files: `kebab-case`
  * Classes: `PascalCase`
  * Functions/vars: `camelCase`
  * Models: `*.model.ts`

---

# **10. System Design Summary**

A full version exists in `SDD.md`.

### **Core Modules**

* Alma integration
* OA proxy integration
* State management
* Settings + configuration management
* UI components

### **Key Data Structures**

* `AlmaUser`
* `AlmaIdentifier`
* `OAAccount*`
* `OACompassSettings`

### **Algorithms**

* OA username handling & Alma write-back (OA-generated username → Alma fields)
* OA account resolution (identifier → email → primary ID)
* Alma full-record PUT updates
* Group mapping via proxy policies

---

# **11. Canonical Code Registry Summary**

See `CCR.md` for authoritative definitions.

### **Registered Classes**

* `AlmaUserService`
* `OAProxyService`
* `StateService`
* Component classes

### **Registered Functions**

* Alma:
  * `getUser`
  * `updateUserIdentifiers`
  * `writeBackOAUsernameBoth`

* OA (via OAProxyService):
  * `verify`
  * `createAccount`
  * `modifyAccount`
  * `resendActivation`
  * `getAccount` (wrapper for `/v1/oa/users/get`)

### **Config Items**

* Proxy environment (Node `.env` or systemd env vars):
  * `OA_BASE_URL`
  * `OA_TENANT`
  * `OA_API_KEY`
  * `OA_CREATE_URL`
  * `ALLOWED_ORIGINS`
  * `GROUP_MAP` / `CODE_TO_KEY`

* Cloud App configuration (via CloudAppConfigService):
  * `proxyBaseUrl`
  * `oaIdTypeCode`
  * `oaPrimaryField`
  * `oaSecondaryField`

---

# **12. Development**

### Install Frontend

```
npm install
```

### Install Proxy

```
cd server
npm install
```

---

# **13. Environment Variables**

Environment variables for the Node.js proxy are defined in a secure location  
(e.g. `server/.env`, `/opt/oa-proxy/.env`, or via the systemd service unit).

Typical configuration:

```bash
PORT=8081

# Comma-separated list of allowed Alma Cloud App origins
ALLOWED_ORIGINS=https://sandbox.alma.exlibrisgroup.com,https://na02.alma.exlibrisgroup.com

# OpenAthens Admin API configuration
OA_BASE_URL=https://admin.openathens.net/api
OA_TENANT=iastate.edu
OA_API_KEY=REDACTED

# Account creation endpoint used by the proxy
OA_CREATE_URL=https://admin.openathens.net/api/v1/iastate.edu/account

# NOTE:
# - There is NO OA_USERNAME_PREFIX here anymore.
# - Username generation is handled entirely by OpenAthens.
# - The Cloud App does not construct or prefix usernames.

---

# **14. Running**

### Start proxy

```
cd server
node server.js
```

### Start Angular Cloud App

```
ng serve --open
```

---

# **15. Theming & Styling**

Fully theme-aware:

* Uses Alma’s Material theme tokens
* No hard-coded colors
* All UI components styled via SCSS mixins
* Light/Dark/Wide modes supported
* Overlay fixes included

See:

* Cloud App Styling Guide
* Cloud App Theming Guide

---

# **16. ChatGPT Collaboration Rules**

For any AI-driven task:

* Use SDD.md and CCR.md as authoritative definitions
* Do not invent API endpoints, fields, or models
* All code must follow Angular and Cloud App rules
* Never embed secrets
* Changes must be incremental and reversible

Reusable prompt included in `README.md` under **Session Starter Prompt**.

---

# **17. Roadmap**

Full roadmap in `PROJECT_PLAN.md`.

### ✔ Phase 0 – Codebase Realignment

### ✔ Phase 1 – Style Guide Compliance

### ✔ Phase 2 – Theming + Functional Restoration

### 🔥 **Phase 3 — Entity-Aware Mode + Modular Refactor (Next)**

* Split monolithic logic into services/components
* Add real routing
* Add settings screen
* Add configuration screen
* Implement entity-aware mode

### Phase 4 — Institutional Configuration

### Phase 5 — Security + Deployment Hardening

### Phase 6 — Testing + Internationalization

### Phase 7 — Publishing Prep

---

# **18. License**

Internal development project. Not for distribution.

