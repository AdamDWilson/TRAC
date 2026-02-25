# Security Review — TRAC Template Letter Generator

**Date:** 2026-02-24
**Scope:** `template-letters/` — client-side static web application
**Stack:** HTML5, JavaScript (ES6), SurveyJS, Nunjucks, Marked, Google Analytics (GA4)

---

## Summary

The application is a pure client-side letter generator. It collects personal and financial information from tenants via forms and renders that data into Nunjucks/Markdown templates, displaying the output as HTML. No data is sent to any backend.

The architecture is mostly sound for its purpose, but there are **two critical issues** that must be resolved before production deployment, plus several medium and low priority items.

---

## Critical Issues

### 1. XSS — Nunjucks `autoescape: false` + `innerHTML`

**File:** `js/renderer.js:4`, `js/app.js:201`
**Severity:** Critical
**Status:** ✅ Fixed (2026-02-24)

Nunjucks is configured with autoescaping explicitly disabled:

```js
const nunjucksEnv = nunjucks.configure({ autoescape: false });
```

User form input (free-text fields like `violation_description`, `repair_description`, addresses, names) flows directly into Nunjucks templates, through `marked.parse()`, and into the DOM via `innerHTML`:

```js
letterContent.innerHTML = html;   // app.js:201
```

This creates a full XSS chain: a user (or someone tricking a user) can enter `<img src=x onerror="alert(1)">` in any text field, and it will execute in the browser. While in normal use this is self-inflicted, it becomes more dangerous if:

- The page is framed or embedded anywhere
- A future feature pre-populates form fields via URL parameters
- A third party links users to the page with pre-filled state

**Fix:**
```js
// renderer.js:4 — enable autoescaping
const nunjucksEnv = nunjucks.configure({ autoescape: true });
```

With autoescaping on, test that `&nbsp;` in templates still renders correctly (it's a template literal, not user data, so it should be fine — but verify). The `marked.parse()` step also needs to receive trusted input; with autoescaping enabled, Nunjucks will HTML-encode user strings before the markdown step, which is correct.

---

### 2. CDN Dependencies Without Subresource Integrity (SRI)

**File:** `index.html:80–83`
**Severity:** Critical (supply chain)
**Status:** ✅ Fixed (2026-02-24) — all five CDN resources (CSS + 4 scripts) pinned to specific versions with SHA-384 integrity hashes and `crossorigin="anonymous"`

All external scripts are loaded without SRI hashes:

```html
<script src="https://unpkg.com/survey-core/survey.core.min.js"></script>
<script src="https://unpkg.com/survey-js-ui/survey-js-ui.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/nunjucks@3.2.4/browser/nunjucks.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
```

If any of these CDNs are compromised, arbitrary code runs in your users' browsers with full access to form data (names, addresses, financial details). `marked` is not version-pinned (`latest`), meaning the served file can change at any time. SurveyJS on `unpkg.com` is also unpinned.

**Fix:**
1. Pin all library versions in the URL (e.g. `marked@14.x.x`)
2. Generate SRI hashes and add `integrity` + `crossorigin` attributes:
   ```html
   <script src="https://cdn.jsdelivr.net/npm/nunjucks@3.2.4/browser/nunjucks.min.js"
           integrity="sha384-<hash>"
           crossorigin="anonymous"></script>
   ```
   Use [srihash.org](https://www.srihash.org) or `openssl dgst -sha384 -binary file.js | openssl base64 -A` to generate hashes.

Alternatively, vendor all libraries into the repo under `js/vendor/` and load them locally — this eliminates CDN availability dependency too.

---

## Medium Issues

### 3. No HTTP Security Headers

**Severity:** Low (for this app)
**Note:** Requires web server configuration; not possible in static files alone.

`tenants.bc.ca` already sets two headers by default (checked 2026-02-24):
- `content-security-policy: upgrade-insecure-requests;` — present but minimal; only upgrades HTTP requests to HTTPS, does not restrict scripts or resources
- `referrer-policy: no-referrer-when-downgrade` — present; this is also the browser default, so effectively no change from baseline

Not set: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Permissions-Policy`.

These are standard web hygiene and worth applying when configuring the server (low effort at that point), but they address limited real-world risk for this specific application:

- **CSP** — a backup defence against XSS. With autoescape fixed and SRI in place, the actual XSS risk is already addressed. CSP matters most when there are auth cookies or session tokens to steal; this app has none.
- **X-Frame-Options** — prevents clickjacking (embedding the page in a hidden iframe to trick users into clicking things). The actions in this app are "generate letter," "copy," and "email" — none are consequential enough to be worth attacking this way.
- **X-Content-Type-Options: nosniff** — prevents MIME-type confusion. Only relevant if a server might serve user-uploaded files with ambiguous types; this app serves only static developer-controlled files.
- **Referrer-Policy** — limits URL leakage in the `Referer` header. The URLs here (`?template=notice-to-end-tenancy`) are not sensitive.

When served from a web server, the following headers should be set:

| Header | Recommended Value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' cdn.jsdelivr.net unpkg.com https://www.googletagmanager.com; style-src 'self' unpkg.com; img-src 'self' https://www.google-analytics.com; connect-src 'self' https://www.google-analytics.com; frame-ancestors 'none'` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `geolocation=(), camera=(), microphone=()` |

The GA4 inline script in `index.html` will require a `nonce` or `unsafe-inline` in the CSP `script-src`. Prefer using a `nonce`.

---

### 4. Google Analytics Tracks Sensitive Usage Patterns

**File:** `index.html:8–15`, `js/app.js`
**Severity:** Medium (privacy)

GA4 is configured to track:
- Which letter templates are used (`letter_start`, `letter_generate`)
- Form field names that failed validation (`letter_error` with `error_fields`)
- Whether the user copied or emailed the letter (`letter_action`)

The template a user selects reveals their personal situation (e.g., selecting "Loss of Quiet Enjoyment" or "Notice to End Tenancy"). This is sensitive information being sent to Google.

Additionally, GA4 sets cookies (`_ga`, `_ga_*`) which persist across sessions and can be used to build profiles of returning users.

**Considerations:**
- PIPEDA (Canadian federal privacy law) and BC's PIPA require meaningful consent before collecting personal information. Tracking which legal templates a tenant accesses may qualify as personal information in context.
- The existing Privacy Policy link in the footer (`tenants.bc.ca/Privacy-policy/`) should clearly describe the analytics collection and purpose.
- Consider whether event parameters like `error_fields` are necessary — they reveal which fields a user struggled with and could be considered behavioural data.

**Recommended actions:**
- Remove `error_fields` from the `letter_error` GA event, or aggregate it (e.g., just count failures, not which fields)
- Add a brief privacy notice on the page (e.g., "This tool uses analytics to improve the service. No letter content or personal details are transmitted.") — this is accurate since form data never leaves the browser
- Review whether GA4 cookie consent is required under applicable law for the intended deployment

---

### 5. Template Card Renders Developer-Controlled Data via `innerHTML`

**File:** `js/app.js:127–129`
**Severity:** Low–Medium (depends on future changes)

```js
card.innerHTML = `
    <h2>${template.name}</h2>
    <p>${template.description}</p>
`;
```

`template.name` and `template.description` come from `templates/index.js`, a static file committed to the repo. At present this is safe — developers control the content. However, if template data ever comes from a user-configurable or external source, this becomes an XSS vector. Consider using `textContent` or creating DOM nodes explicitly.

---

## Low / Informational

### 6. `marked` Not Version-Pinned

**File:** `index.html:83`
**Severity:** Low

`https://cdn.jsdelivr.net/npm/marked/marked.min.js` resolves to the latest published version of `marked`. Major version changes can introduce breaking changes or remove security protections. Pin to a specific version (`marked@14.x.x`).

---

### 7. Template ID Validated but Only After Fetch Attempt Begins

**File:** `js/app.js:77`
**Severity:** Informational

The template ID from the URL is validated against the `TEMPLATES` array before any fetch is made — this is good. The current code structure handles this correctly, so path traversal is not possible. No action needed, but worth noting that the validation should remain before any file operations if the code is refactored.

---

### 8. `execCommand('copy')` Fallback

**File:** `js/app.js:316–336`
**Severity:** Informational

`document.execCommand('copy')` is deprecated. It works in most current browsers but may be removed in future versions. The modern `navigator.clipboard.writeText` is already the primary path. The fallback can remain for now but should be monitored.

---

### 9. HTTPS Not Enforced at Application Level

**Severity:** Informational
**Note:** Enforce HTTPS at the web server / hosting level (HSTS header, redirect HTTP → HTTPS). The application itself cannot enforce this.

---

## Data Privacy Summary

| Data Type | Collected | Stored Server-Side | Transmitted | Notes |
|---|---|---|---|---|
| Tenant name | Yes (form) | No | No | Browser memory only |
| Tenant address | Yes (form) | No | No | Browser memory only |
| Landlord name/address | Yes (form) | No | No | Browser memory only |
| Email address | Yes (form) | No | No | Only used in `mailto:` |
| Financial amounts (rent, deposit) | Yes (form) | No | No | Browser memory only |
| Repair/violation descriptions | Yes (form) | No | No | Browser memory only |
| Template usage | Yes (GA4) | Yes (Google) | Yes | Sent to Google Analytics |
| User agent / IP | Implicit | Yes (Google) | Yes | Standard GA4 data |

All personal form data stays in the user's browser and is cleared when they navigate away or close the tab. The only external transmission is via GA4 event data (which template was used, whether a letter was generated, etc.) and the `mailto:` link (which opens the user's own email client).

---

## TODO List

### Critical (before production deployment)
- [x] **Enable Nunjucks autoescaping** — changed `autoescape: false` to `autoescape: true` in `js/renderer.js:4`. *(Fixed 2026-02-24)*
- [x] **Add SRI hashes to all CDN resources** in `index.html` — SurveyJS CSS, SurveyJS core, SurveyJS UI, Nunjucks, Marked. SHA-384 hashes added with `crossorigin="anonymous"`. *(Fixed 2026-02-24)*
- [x] **Pin all CDN library versions** — SurveyJS pinned to `@2.5.12`, Marked pinned to `@15.0.12`, Nunjucks was already `@3.2.4`. *(Fixed 2026-02-24)*

### Medium priority
- [ ] **Review GA4 privacy obligations** under PIPEDA/PIPA for BC deployment — determine if a cookie consent notice is required.
- [ ] **Remove `error_fields` from GA `letter_error` event** or replace with a count to avoid transmitting field names.
- [ ] **Add a brief privacy notice** to the page stating that form data stays in the browser and only anonymised usage events are sent to analytics.

### Low priority / future
- [ ] **Configure HTTP security headers** on the web server — CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy. Low actual risk for this app (see issue #3), but low effort to add when configuring the server.
- [ ] **Vendor critical JS libraries** locally (SurveyJS, Nunjucks, Marked) to eliminate CDN dependency and supply chain risk.
- [ ] **Replace `innerHTML`** in `showDirectoryView()` template card rendering with DOM node creation or sanitised insertion.
- [ ] **Enforce HTTPS** at the hosting level with HSTS.
- [ ] **Add automated security tests** — at minimum, test that script tags in form fields are not executed in the rendered output.
- [ ] **Monitor `execCommand('copy')` deprecation** and remove fallback when no longer needed.
