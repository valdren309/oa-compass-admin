# OA Compass Admin — Project Plan (Option A: Entity-Aware Cloud App)

This document is the **living implementation plan** for the OA Compass Admin project.  
It complements:

- `README.md` (Project Brief & contributor guide)
- `SDD.md` (System Design Document)
- `CCR.md` (Canonical Code Registry)

> **Key Direction (Option A):**  
> OA Compass Admin will be an **entity-aware Alma Cloud App** that:
> - runs as a standard Cloud App (not only a dashboard widget), and  
> - responds to the **currently selected Alma user** via `entities$`,  
> while still supporting **manual user search** as a fallback.

---

## 1. Project Goals (from README, refined)

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
5. Support **entity-awareness**:
   - When on a user page in Alma, OA Compass Admin recognizes the selected user
   - When opened on other pages / pinned to the dashboard, OA Compass Admin still works via **manual search**.

---

## 2. Authoritative Artifacts

These documents are **source of truth** for design and code structure:

- `README.md` — Project brief, architecture overview, and contributor guide
- `SDD.md` — Detailed modules, models, and data flows
- `CCR.md` — Canonical functions, classes, endpoints, configs
- `PROJECT_PLAN.md` (this file) — Phase-by-phase execution plan

> **Rule:** No code, config, or new feature may contradict or bypass these documents.  
> When behavior changes, update **README → SDD → CCR → PROJECT_PLAN** in that order.

---

## 3. Current State Snapshot (end of Phase 2, Option A pivot)

As of this plan revision:

- We have:
  - A working **MainComponent** with:
    - Manual Alma user search
    - User selection + OA actions (create/sync/verify)
    - `UserInfoComponent`, `OAStatusComponent`, `OAProvisionComponent`, `ToastComponent`
    - Inline **settings gear** that toggles `<oa-settings>`
  - `AlmaUserService` and `OAProxyService` implemented (per SDD/CCR)
  - `SettingsComponent` wired to `CloudAppConfigService` using `OACompassSettings`
  - Basic **theming tokens** and a **header** that should align with Alma’s primary color
- Remaining tech debt:
  - **MainComponent is still monolithic** (too much logic for one component)
  - The app is **not yet entity-aware** (`entities$` not used)
  - Theming is partially aligned but not yet fully consistent with
    [Cloud Apps Theming Tutorial](https://developers.exlibrisgroup.com/cloudapps/tutorials/theming/)
  - `CloudAppSettingsService` (user-level preferences) is not yet used

This plan moves us from that state to a **polished, entity-aware, themable Cloud App**.

---

## 4. Phase Overview (Option A)

We retain a 7-phase structure, but **Phase 3+ explicitly add entity-awareness and refactoring**:

1. **Phase 0 — Codebase Realignment** ✅ (complete)
2. **Phase 1 — Style Guide Compliance** ✅ (mostly complete; minor polish can roll into Phase 2/3)
3. **Phase 2 — Theming Integration & Functional Restoration** ✅/⚙ (initial pass done; final tweaks in Phase 3)
4. **Phase 3 — Entity-Aware UI & Component Refactor** 🔜 (next)
5. **Phase 4 — User Settings & Institution Config Separation**
6. **Phase 5 — Security & Deployment Hardening**
7. **Phase 6 — Testing & Internationalization**
8. **Phase 7 — Documentation & Publishing**

Below is the **detailed work plan** for each phase.

---

## 5. Phase 0 — Codebase Realignment ✅

**Goal:** Get a clean, typed, SDK-aligned foundation.

**Status:** Completed (tracked historically; listed here for context).

**What we did:**

- Introduced:
  - `AlmaUserService`
  - `OAProxyService`
  - `alma-user.model.ts`
  - `oa-account.model.ts`
- Replaced scattered REST calls with service methods (**see CCR**).
- Upgraded to a **single source of truth** for OA account flows.
- Ensured TypeScript strictness and removed legacy/unused scaffolding code where safe.

**Acceptance criteria:**

- All OA and Alma calls go through typed services.
- No direct OA API calls from components.
- App compiles under strict TypeScript.

---

## 6. Phase 1 — Style Guide Compliance ✅ / minor polish

**Goal:** Align UI with Cloud Apps **style** guidelines.

**Status:** Functionally complete, minor visual tweaks may continue in Phase 2/3.

**What we did:**

- Switched to **Angular Material** and Cloud App patterns:
  - `mat-card`, `mat-list`, `mat-form-field`, `mat-progress-bar`, `mat-button` / `mat-stroked-button`
- Introduced:
  - **Two-column layout**: left (info + OA status), right (actions)
  - `user-info`, `oa-status`, `oa-provision`, `oa-toast` components
- Simplified the layout to reduce duplication and unnecessary scrolling.

**Residual work (rolled into Phase 2/3):**

- Fine-tuning spacing and typography to better match Alma’s own cards.
- Ensuring iconography and button density stay within Cloud App style recommendations.

---

## 7. Phase 2 — Theming Integration & Functional Restoration ⚙

**Goal:** Make the app **theme-aware** and ensure **full OA/Alma functionality** is working inside Alma.

**Status:**  
- Initial theming pass in place (`styles.scss`, `main.component.theme.scss`).  
- OA flows (create/sync/verify) mostly tested and working.  
- Some Alma/OA behavior still needs **polish & verification**.

### 7.1 Theming Work

**Tasks (many already done):**

- Define global design tokens in `styles.scss`:
  - `--oa-bg`, `--oa-fg`, `--oa-border`, `--oa-accent`, status colors, etc.
- Add SCSS mixin `main-component-theme`:
  - Style `.app-header` using Alma theme primary color.
  - Keep component-specific theming out of inline styles.
- Ensure `styles.scss` is the actual global stylesheet (fixed name mismatch).

**Remaining / ongoing:**

- Remove any lingering **inline styles** in templates and centralized CSS in SCSS files.
- Confirm card and header colors respect Alma theme variations (light/dark, high contrast).
- Make sure drop-downs and overlays (mat-select, etc.) match both Alma style and accessibility expectations.

### 7.2 Functional Restoration

**Tasks (largely done, but must be verified):**

- Confirm:
  - `createOA()`  
  - `syncOA()`  
  - `verifyOA()`  
  all behave as specified in SDD.md:
  - username normalization
  - expiry date handling
  - group mapping via proxy
- Confirm **write-back to Alma**:
  - `AlmaUserService.writeBackOAUsernameBoth()` is used consistently.
  - Identifier type code (e.g., `OA_ID_TYPE = '02'`) is centralized and not duplicated.
- Ensure `OAProxyService` signatures match CCR and proxy implementation exactly.

**Acceptance criteria for Phase 2:**

- All core OA flows work when app is loaded inside Alma (manual search path).
- Basic theming is in place and does not conflict with Alma styling.
- No secrets, OA or Alma API keys, or PII leak to the browser outside of what Alma already exposes.

> From this point forward, **all new work assumes Option A: entity-awareness** and a move away from a “widget-only” mindset.

---

## 8. Phase 3 — Entity-Aware UI & Component Refactor 🔜 (NEXT)

**Goal:**  
1. Make OA Compass Admin **entity-aware** (aligned with Cloud Apps scaffolding tutorial).  
2. Break apart **MainComponent** into smaller, maintainable pieces while preserving behavior.  
3. Finalize the initial theming pass for the new, refactored layout.

### 8.1 Entity Awareness Integration

**Tasks:**

1. **Introduce an Entity Context Service**
   - New service: `EntityContextService`
     - Observes `CloudAppEventsService.entities$`
     - Exposes: `selectedUser$` (stream of Alma user entity, if any)
   - When a user entity is present:
     - Automatically set `selectedUserId`
     - Invoke `AlmaUserService.getUser(...)` using the entity’s primary ID
   - When there is **no user entity** (e.g., dashboard context):
     - Fall back to **existing manual search** UI.

2. **Update MainComponent to consume entity context**
   - On init:
     - Subscribe to `EntityContextService.selectedUser$`
     - If present:
       - Hide the manual search section by default
       - Show “context user” as the active user
     - Provide a clear **“Switch to manual search”** action.

3. **UX updates**
   - In the header:
     - Show a small indicator such as:
       - `Context: Alma user <primary_id>` or
       - `Context: None (use search)`
   - When context changes in Alma:
     - If the Cloud App remains open, update the selected user accordingly.

**Acceptance criteria:**

- When opened on a **User** page, OA Compass Admin automatically loads that user.
- When opened on other pages or the dashboard, OA Compass Admin still works via internal search.
- No breaking changes to OA flows.

### 8.2 Component Refactor (de-monolith MainComponent)

**Tasks:**

- Extract from `MainComponent`:
  - `UserSearchComponent`:
    - Encapsulates the search bar, results list, and pagination.
    - Emits `userSelected` event with `AlmaUserLite`.
  - `UserShellComponent` (or similar):
    - Wraps `UserInfoComponent`, `OAStatusComponent`, and `OAProvisionComponent`.
    - Receives fully loaded `AlmaUser`.
  - `HeaderComponent` (optional, or keep inside MainComponent but simplified):
    - Contains title, gear/settings toggle, and context indicator.

- Move heavy OA business logic out of the component into:
  - `OaOrchestratorService` (or extend existing services):
    - Methods like `createAndWriteBack(user)`, `syncAndWriteBack(user)`, `verifyAccount(user)`.

**Acceptance criteria:**

- `MainComponent` becomes a thin orchestrator:
  - Handles view mode: settings vs main
  - Wires entity context + user search + user shell
- Core business logic lives in services.
- Components are simpler, easier to test, and match SDD/CCR responsibilities.

### 8.3 Theming Clean-Up (Phase 2 residual)

**Tasks:**

- Ensure new subcomponents:
  - Define their own SCSS files with minimal, layout-focused rules.
  - Defer colors and typography to Alma theme + global tokens.
- Remove any obsolete SCSS in `main.component.ts` that migrated into child components.

---

## 9. Phase 4 — User Settings & Institution Config Separation

## **9.1 Goals**

* Move all OA-sensitive behavior into **institution-level configuration**.
* Allow **OpenAthens to generate usernames** automatically (no client-side or proxy prefixing).
* Update the app to write OA usernames back into Alma using configurable:

  * `primaryField` (job description, identifier, or user note)
  * `secondaryField` (optional)
  * `oaIdTypeCode` (identifier type for OA username)
* Remove username prefix logic from both the Cloud App and Node proxy.
* Ensure Alma identifier writes follow proper GET → modify → PUT full-object semantics.
* Update documentation across README, SDD, and CCR.

---

## **9.2 Functional Scope**

### **Cloud App**

* Add new institution-level config fields:

  * `proxyBaseUrl`
  * `oaIdTypeCode`
  * `oaPrimaryField`
  * `oaSecondaryField`
* Update `AlmaUserService` to support new OA write-back behavior.
* Update `OAProxyService` to treat `username` as optional for create operations.
* Update UI in **Config** screen to match new model.
* Update **Settings** screen to remove OA username storage options (moved to config).
* Update **MainComponent** to:

  * Pass configured `oaIdTypeCode` to Alma write-back operations.
  * Correctly surface OA username from proxy responses.
  * Refresh Alma user after writes.

### **Node Proxy**

* Remove all local username normalization logic.
* Update `/v1/oa/users/create` handler to allow missing `username` (OA generates).
* Sanitize OA error messages and remove any legacy debugging fields.
* Maintain policy mapping via `GROUP_MAP` and `CODE_TO_KEY`.

---

## **9.3 Non-Functional Requirements**

* **Security:**

  * No OA credentials or internal OA tenant data may pass to the browser.
  * Strict CORS enforcement using `ALLOWED_ORIGINS`.
  * No logging of OA API keys or sensitive error messages.

* **Stability:**

  * All Alma writes must be full-record PUTs.
  * Proxy must validate request payloads robustly.

* **Maintainability:**

  * All OA-sensitive variables stored only in proxy `.env`.
  * All client-side configurable options represented in `manifest.json`.

---

## **9.4 Deliverables**

* Updated Angular components:

  * `settings.component` (reduced to UI-only preferences)
  * `config.component` (full OA storage configuration)
  * `main.component` (updated create/modify pipeline)
* Updated TypeScript models in `oa-settings.model.ts` and `oa-account.model.ts`.
* Updated proxy implementation (`server.js`).
* Updated documentation:

  * README.md
  * SDD.md
  * CCR.md
  * PROJECT_PLAN.md (this file)
* Verified OA integration using OA-generated usernames.
* Smoke tests: Alma write-back, OA create/modify, identifier sync.

---

## **9.5 Completion Criteria**

Phase 4 is complete when:

* Cloud App uses **OA-generated usernames** exclusively.
* Config UI correctly controls:

  * Identifier type
  * Primary/secondary OA username fields
  * Proxy base URL
* Alma writes correctly store OA usernames in the configured fields.
* All legacy username prefix code has been removed.
* Proxy validates fields and passes OA errors safely.
* All documentation (README, SDD, CCR) is fully aligned.
* No runtime errors appear in browser console.
* OA → Alma round-trip behavior is consistent and predictable.

---

## **9.6 Future Notes (Phase 5+)**

* Support institution-defined note categories for OA user notes.
* Add analytics for create/modify usage.
* Add optional prefix overrides **only if OpenAthens deprecates server-side prefixing**.
* Implement enhanced debugging of Alma write-back operations.
* Add integration test suite for proxy.

## 10. PHASE 5 — Security & Deployment Hardening

The goal of Phase 5 is to ensure that the OA Compass Admin Cloud App and the OA Proxy
meet institutional security standards, follow the Ex Libris Cloud App framework,
and enforce a clean separation of responsibilities between the frontend and the proxy.

This phase includes:  
(1) **Frontend hardening**,  
(2) **Proxy hardening**, and  
(3) **Deployment hardening**,  
followed by a small **post-hardening refactor** to clean up code quality without altering behavior.

---

### **10.1 Cloud App Security Hardening**

**Implemented Changes**

- **No secrets in the Cloud App**  
  Verified that no OA keys, tokens, passwords, or sensitive URLs appear in:
  - Code
  - Templates
  - Local storage
  - User settings
  - App config

- **Strict proxy routing**  
  All OpenAthens interactions (verify, get, create, modify, resend-activation) now flow
  *only* through `OAProxyService` → the Node proxy.  
  No direct OA endpoints or OA base URLs appear in the Angular code.

- **HTTPS enforcement for proxyBaseUrl**  
  - The Cloud App now rejects any `proxyBaseUrl` configuration value that does not
    begin with `https://`.
  - Non-HTTPS values are ignored and logged as warnings.
  - Removes the risk of reconfiguration to a non-secure or malicious endpoint.

- **Removed debug endpoints and helpers**  
  - `OAProxyService.health()` and `OAProxyService.getEnv()` removed.
  - Eliminates accidental leakage of environment metadata.

- **Debug gating strengthened**  
  - `lastProxyResponse` is displayed only when `showDebugPanel` is true.
  - Raw Alma errors are no longer stored in `lastProxyResponse`; only short summaries.
  - OA responses shown only in success/debug contexts, never for errors.
  - Entity-context console logging gated behind an internal flag and debug panel visibility.

- **Console log trimming**  
  - `AlmaUserService` now logs only status + message (no PPI, no full Alma bodies).
  - No OA usernames or full identifier arrays are logged.

- **Validated configuration paths**  
  - Confirmed user-level settings cannot affect security-sensitive behaviors.
  - Institution config (via CloudAppConfigService) cannot be used to escalate scope:
    - Only affects presentation (debug panel)
    - Only accepts safe proxy URLs
    - Write-back fields fully sanitized and confined to Alma workflows

---

### **10.2 Proxy Security Hardening**

**Implemented Changes**

- **Removed `/env` endpoint**  
  Eliminates accidental exposure of:
  - Allowed Alma origins
  - OA tenant names
  - OA admin base URL
  - Presence of OA keys

- **Strict CORS control**  
  - Proxy only responds to `Access-Control-Allow-Origin` if the origin is in `ALLOWED_ORIGINS`.
  - `ALLOWED_ORIGINS` must be a comma-separated list of official Alma domains.
  - No wildcards, no localhost, no fallbacks.

- **Error sanitization**  
  - OA failures no longer return full OA bodies.
  - All error responses follow the sanitized shape:
    ```json
    {
      "error": "OA create failed",
      "code": "<OA code if present>",
      "message": "<short message>",
      "status": <HTTP status>
    }
    ```
  - Prevents OA-internal data or external identifiers from leaking to the client.

- **Success-path transparency retained**  
  - OA success responses can still include:
    - `summary` (id, username, status, groups)
    - `raw` (OA clean response object)
  - Shown only when the debug panel is enabled.

- **Username handling fully moved to OA**  
  - `/v1/oa/users/create` no longer accepts or requires `username` field.
  - Proxy does not generate usernames.
  - OA generates the canonical username (including suffixes).
  - Cloud App writes OA’s returned username back to Alma.

- **Strict JSON parsing & payload limits**  
  - JSON payload cap enforced (200 KB).
  - Any malformed JSON is rejected immediately.
  - Rejects oversized or suspicious payloads before touching OA.

- **Proxy remains isolated**  
  - Bound to `127.0.0.1` only.
  - Exposed publicly only through Apache HTTPS reverse proxy.
  - OA API keys remain server-only (`.env` or systemd).

---

### **10.3 Deployment Hardening**

**Operational Requirements**

- **systemd service isolation**
  - Runs under a dedicated service user, not `root`.
  - Logs accessible only by that user or admin (`chmod 640`).
  - `.env` or environment variables never logged or echoed.
  - Restart and memory protections enabled where possible.

- **Apache/Nginx reverse proxy configuration**
  - Only exposes HTTPS endpoints.
  - Forwards required security headers:
    - `X-Content-Type-Options: nosniff`
    - `X-Frame-Options: SAMEORIGIN`
    - `Referrer-Policy: same-origin`
    - `Content-Security-Policy` (optional tightening)
  - CORS preflight correctly routed to the backend.
  - Optional: Rate-limiting rules (e.g., mod_ratelimit or Fail2Ban filters).

- **Network restrictions**
  - Proxy host not reachable from the internet except via the Apache SSL termination.
  - No open ports beyond 443 externally and 8081 internally.

- **Logging and monitoring**
  - Ensure OA proxy logs:
    - Do not contain PPI.
    - Do not contain Alma identifiers.
    - Do not contain OA API keys or credentials.
  - Optional: Fail2Ban or WAF rules can monitor rate or signature anomalies.

---

# 11. PHASE 6 — Comprehensive Codebase Refactoring Pass

After Phase 5 is complete and the system is stable from a security standpoint, Phase 6 
introduces a **disciplined, architecture-preserving refactor** across both:

- the Angular Cloud App  
- the Node.js OA Proxy  

This refactor **does not change behavior** unless a bug fix is explicitly required.  
The goals follow the exact methodology described by the author.

---

## **11.1 Refactoring Goals (Priority Order)**

1. **Preserve behavior**
   - No functional changes unless identified as a bug.
   - API contracts must remain unchanged.

2. **Improve clarity + readability**
   - Clearer naming for components, functions, and variables.
   - Reduce unnecessary complexity in MainComponent.
   - Ensure each module has a single responsibility.

3. **Improve maintainability**
   - Extract repeated code into shared utilities.
   - Consolidate Alma/OA model types into consistent canonical structures.
   - Separate UI concerns from business logic more cleanly.

4. **Strengthen architecture**
   - Ensure the Cloud App follows Core Architectural Rules in the SDD.
   - Move OA-related logic out of MainComponent and into OAProxyService where appropriate.
   - Standardize error handling across all services.

5. **Make code more idiomatic**
   - Apply Angular and TypeScript best practices.
   - Prefer RxJS pipelines where appropriate but keep code explicit for readability.
   - Modernize proxy code (async/await, clearer routing structure).

6. **Performance — secondary goal**
   - Remove unnecessary repeated GETs.
   - Cache Alma settings/config in memory where allowed by Cloud App constraints.

---

## **11.2 Refactoring Constraints**

These remain in effect unless explicitly overridden:

- **Public API must remain stable**  
  (service interfaces, proxy endpoints, Alma update semantics)

- **Do not introduce new dependencies** unless explicitly requested.

- **No architectural rewrites**  
  (e.g., do not collapse services, do not reorganize component tree drastically)

- **No UI/UX redesign**  
  unless uncovered issues require small adjustments for correctness.

- **Security > convenience**  
  Refactor must not weaken any security boundary.

---

## **11.3 Refactoring Scope (Cloud App)**

### Components
- Break down `MainComponent` into:
  - user-loader service (optional)
  - OA workflow helpers
  - search logic extractor (shared)
- Consolidate state tracking into a formal pattern:
  - Observables for user
  - Reducer-like actions for OA create/modify/verify

### Services
- Normalize method signatures in:
  - `AlmaUserService`
  - `OAProxyService`
  - `ConfigService`
  - `SettingsService`
- Extract repeated patterns for:
  - error handling
  - Alma identifier manipulation
  - OA lookups

### Models
- Clean up OA model types to remove unused properties.
- Ensure models match OA API and proxy JSON exactly.

### UI / Theming
- Make theme-related SCSS more consistent.
- Ensure MDC overrides exist only at the global level, not per-component unless needed.

---

## **11.4 Refactoring Scope (Proxy)**

- Split `server.js` into smaller modules:
  - routes (`create`, `modify`, `get`, `verify`, `resend`)
  - utilities (`http helpers`, `mapping`, `validation`)
  - config loader
- Introduce a simple routing table instead of a giant switch.
- Improve error handling consistency.
- Remove unused or obsolete prefix logic.
- Strengthen type validation and input sanitation.

---

## **11.5 Deliverables**

- Fully refactored Angular Cloud App:
  - Cleaner `MainComponent`
  - Clearer OA workflow encapsulation
  - Unified Alma/OA utilities

- Fully modularized Node proxy:
  - Better file separation
  - Cleaner async flow
  - More testable functions

- Updated SDD & CCR (only if method signatures or module boundaries change)

- Updated README section:  
  “Refactoring & Maintenance Guidelines”

---

## **11.6 Non-Goals**

- No migration to Angular Standalone Components  
- No rewrite of routing or bootstrap logic  
- No migration from MDC to Material 3 unless required in future phases  
- No new features in this phase  

(Feature changes belong to Phase 7+)

---

## 12. Phase 6 — Testing & Internationalization

**Goal:** Raise confidence and support multiple languages.

**Tasks:**

- Add unit tests for:
  - `AlmaUserService`
  - `OAProxyService`
  - Entity context behavior
  - OA orchestration logic
- Begin i18n:
  - Extract visible strings into a translation file (e.g., via `TranslateService` or Angular i18n).
  - At least support English, with structure to add more.

**Acceptance criteria:**

- Core flows have automated tests.
- Text is not hard-coded in templates wherever translation is expected.

---

## 13. Phase 7 — Documentation & Publishing

**Goal:** Finalize documentation, versioning, and (if desired) Cloud App Center readiness.

**Tasks:**

- Ensure:
  - `README.md` fully reflects the entity-aware design.
  - `SDD.md`, `CCR.md`, and `PROJECT_PLAN.md` are current.
- Add:
  - `CHANGELOG.md` with semantic version history.
  - `CONTRIBUTING.md` (optional, for internal / community contributors).
- Prepare any screenshots and metadata required by the Cloud App Center (if publishing externally).

**Acceptance criteria:**

- All project docs are consistent and up to date.
- Release tagging process is defined (`v1.0.0`, etc.).
- App is ready for distribution within the institution and, optionally, the Alma community.

---

## 14. AI Collaboration Rules (for Future Sessions)

When using ChatGPT or another assistant:

1. **Always load:**
   - `README.md`
   - `SDD.md`
   - `CCR.md`
   - `PROJECT_PLAN.md` (this file)

2. **Never:**
   - Invent new model names, endpoints, or service responsibilities.
   - Bypass the Node proxy for OA calls.
   - Introduce inline styles or hard-coded colors that violate theming rules.
   - Remove entity-awareness or search modes without updating this plan and SDD.

3. **When in doubt:**
   - Ask to reconcile behavior with **Option A: entity-aware Cloud App** and the Cloud Apps tutorials.


