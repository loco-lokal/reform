# Reform

**Self-hosted forms you create with one API call.**

Reform is a small open-source form service. Your backend sends a list of questions to a REST endpoint and gets back a private link. The recipient answers on a clean, accessible page, and you read the responses in a password-protected admin or export them as Markdown, ready to paste into a CRM note, a ticket or an LLM prompt.

It is built for the forms that belong to one person or one deal: onboarding questionnaires, project briefs, consultation prep, feedback after a delivery. No form builder, no accounts, no tracking.

[![CI](https://github.com/loco-lokal/reform/actions/workflows/ci.yml/badge.svg)](https://github.com/loco-lokal/reform/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Features
- **API first**: `POST /api/forms` with JSON questions → a link with an unguessable 256-bit token.
- **Ten question types**: short and long text, email, phone, number, date, single choice, multiple choice, dropdown, yes/no; with required flags, help texts and placeholders.
- **Lifetimes**: single-use links that close after the first response, expiry dates, or both. Single-use is enforced with a row lock, so two simultaneous submits can never both succeed.
- **Solid public pages**: work without JavaScript, validate every answer on the server, show errors inline, and are keyboard and screen-reader friendly. A honeypot field and per-IP rate limits keep bots out.
- **English and German** for each form (`language`), and for the admin.
- **Admin and Markdown export**: browse all forms and responses, copy them as Markdown or download a `.md` file. User input is escaped so it cannot inject headings or lists.
- **Your brand**: name, logo, favicon, colours, fonts and website are edited in the admin and apply immediately; legal links come from environment variables.
- **Easy to run**: one Next.js server plus PostgreSQL. Migrations run on startup. Docker image with a health check included.

## Contents
- [Quick start](#quick-start)
- [How it works](#how-it-works)
- [Creating a form](#creating-a-form)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Development](#development)
- [Project layout](#project-layout)
- [Security](#security)
- [Limitations](#limitations)
- [Contributing](#contributing) · [License](#license)

## Quick start
With Docker:

```bash
git clone https://github.com/loco-lokal/reform.git
cd reform
docker compose up --build
```

Then create your first form:

```bash
curl -s -X POST http://localhost:3000/api/forms \
  -H "x-api-key: change-me-api-key" \
  -H "content-type: application/json" \
  -d '{
    "title": "Hello Reform",
    "lifetime": { "singleUse": true },
    "questions": [
      { "id": "name", "type": "short_text", "label": "What is your name?", "required": true },
      { "id": "mood", "type": "single_choice", "label": "How is your day?", "options": ["Great", "Fine", "Could be better"] }
    ]
  }'
```

Open the `url` from the response, answer the form, then sign in at <http://localhost:3000/admin> with `change-me-admin-password` to see the response. Change the secrets in [`docker-compose.yml`](docker-compose.yml) before you expose the service anywhere.

## How it works
```
 your backend                    Reform                          recipient
 ────────────                    ──────                          ─────────
 POST /api/forms  ───────────▶  validate, store form
                  ◀───────────  { url: …/f/<token> }
 send the link by email, chat, CRM …  ─────────────────────────▶  opens /f/<token>
                                 validate answers   ◀──────────  submits
                                 store response, close if single-use
                                                      ──────────▶ /f/<token>/thanks
 you              ───────────▶  /admin: read, copy or download Markdown
```

1. **Creating**: `POST /api/forms` checks the API key, validates the questions and lifetime (`lib/forms.ts`), stores the form and returns `REFORM_PUBLIC_URL/f/<token>`.
2. **Answering**: `/f/<token>` renders the questions. A Server Action validates every answer on the server (`lib/answers.ts`) and returns errors inline, keeping what was typed.
3. **Closing**: a response is stored in a transaction that locks the form row (`lib/repo.ts`). Single-use forms close in the same transaction; forms past `expiresAt` reject responses. A closed link shows a friendly "no longer available" page.
4. **Reading**: `/admin` lists all forms; `/admin/forms/<id>` shows each response and the Markdown export (`lib/markdown.ts`), one `##` section per response and one `###` per question.

## Creating a form
A minimal request needs a title, a lifetime and at least one question:

```json
{
  "title": "Project brief",
  "language": "en",
  "reference": "crm-deal-4711",
  "lifetime": { "expiresAt": "2026-12-31T23:59:59+01:00" },
  "questions": [
    { "id": "goal", "type": "long_text", "label": "What should the project achieve?", "required": true },
    { "id": "budget", "type": "dropdown", "label": "Budget", "options": ["< 1k", "1–5k", "> 5k"] },
    { "id": "start", "type": "date", "label": "Preferred start date", "help": "Leave empty if you are flexible." }
  ]
}
```

- `reference` is your own id. It is shown in the admin and the export, so you can match responses to records in your system.
- Give questions stable `id`s if you process answers by key; otherwise they are numbered `q1`, `q2`, ….
- Set `singleUse: true` for personal links, `expiresAt` for links you share with a group, or both.

The [API reference](docs/API.md) documents every field, the validation rules of each question type, error codes and all routes.

### Example output
The Markdown export of a response looks like this:

```markdown
# Project brief

- Reference: crm-deal-4711
- Created: 28 Oct 2026, 09:00
- Status: open
- Responses: 1

## Response — 29 Oct 2026, 14:12

### What should the project achieve?

More enquiries from local customers  
and an easy way to update opening hours.

### Budget

1–5k

### Preferred start date

_no answer_
```

## Configuration
Reform is configured through environment variables; branding is edited in the admin (see [Branding](#branding)). For local development put them in `.env.local` (see [`.env.example`](.env.example)).

### Required
| Variable | Purpose |
|---|---|
| `REFORM_DATABASE_URL` | PostgreSQL connection URL, e.g. `postgres://reform:secret@db:5432/reform` |
| `REFORM_API_SECRET` | Expected `x-api-key` value for `POST /api/forms` |
| `REFORM_ADMIN_PASSWORD` | Password for the admin area |
| `REFORM_SESSION_SECRET` | At least 32 characters; signs admin session cookies. Changing it signs everyone out. |
| `REFORM_PUBLIC_URL` | Public base URL used in returned links, e.g. `https://forms.example.com` |

Generate secrets with `openssl rand -base64 48`.

### Optional
| Variable | Default | Purpose |
|---|---|---|
| `REFORM_SUBMIT_RATE_LIMIT_PER_HOUR` | `30` | Form submits per IP per hour |
| `REFORM_ADMIN_LANGUAGE` | `en` | Language of the admin area and 404 page: `en` or `de` |
| `REFORM_TIMEZONE` | `UTC` | IANA time zone for dates in pages and exports, e.g. `Europe/Berlin` |
| `PORT` | `3000` (`80` in the image) | HTTP port |

### Footer links
| Variable | Default | Purpose |
|---|---|---|
| `REFORM_IMPRINT_URL` | – | Adds an imprint link to the footer |
| `REFORM_PRIVACY_URL` | – | Adds a privacy policy link to the footer |

### Branding
Name, website, logo, icon, colours and typography are edited in the admin under **Branding** (`/admin/branding`) and stored in the database, so changes apply immediately without a redeploy:

- **Name**: shown in the navigation, page titles and footer.
- **Website**: the logo and the "back to the website" button link here, and `/` redirects here (otherwise to `/admin`).
- **Logo and icon**: uploaded PNG, JPEG, WebP, SVG (icon also ICO), up to 512 KB each. They are served from `/branding/logo` and `/branding/icon`; SVGs are sent with a sandboxing Content-Security-Policy.
- **Colours**: accent, text on accent, accent text, text, cards, background and muted text (hex values).
- **Typography**: heading and body font, heading weight, base font size (14–20 px, all sizes scale with it) and heading size.

A live preview shows unsaved changes; **Reset to defaults** restores the built-in branding. The fonts on offer (Anybody, Space Grotesk, Inter, Manrope, DM Sans, Bricolage Grotesque, Fraunces, Playfair Display, Lora, and system stacks) are bundled at build time, so pages make no requests to third parties. For deeper changes edit [`app/theme.css`](app/theme.css); all tokens are CSS custom properties on `.rf-root`.

## Deployment
Reform needs Node.js 22+ (or Docker) and PostgreSQL 14+. The database schema is created and migrated automatically on startup.

### Docker
Released images are published to the GitHub Container Registry:

```bash
docker run -d -p 3000:80 \
  -e REFORM_DATABASE_URL=postgres://reform:secret@db:5432/reform \
  -e REFORM_API_SECRET=… \
  -e REFORM_ADMIN_PASSWORD=… \
  -e REFORM_SESSION_SECRET=… \
  -e REFORM_PUBLIC_URL=https://forms.example.com \
  ghcr.io/loco-lokal/reform:latest
```

Or build your own with `docker build -t reform .`. The image runs as an unprivileged user, listens on port 80 and has a `HEALTHCHECK` against `/api/healthz`.

### Without Docker
```bash
npm ci
npm run build
npm start          # reads the REFORM_* variables from the environment
```

### Behind a reverse proxy
Put Reform behind a TLS-terminating proxy (Caddy, nginx, Traefik, a load balancer). The proxy must set `X-Forwarded-For`, which the rate limits use to identify clients. Example for Caddy:

```
forms.example.com {
    reverse_proxy reform:80
}
```

Reform sends `X-Robots-Tag: noindex`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` and `Referrer-Policy: same-origin` on every response.

### Health and backups
`GET /api/healthz` returns `200` when the database is reachable and `503` otherwise. All state lives in PostgreSQL (`forms` and `responses` tables), so back up the database and you have everything.

### Upgrading
Pull the new image or code and restart. Pending migrations from `lib/migrations` run at startup under a PostgreSQL advisory lock. See the [changelog](CHANGELOG.md) for breaking changes.

## Development
Requirements: Node.js 22+ and PostgreSQL.

```bash
docker run -d --name reform-pg -e POSTGRES_USER=reform -e POSTGRES_PASSWORD=reform -e POSTGRES_DB=reform -p 5432:5432 postgres:16-alpine
cp .env.example .env.local
npm install
npm run dev
```

| Command | |
|---|---|
| `npm run dev` | Development server on <http://localhost:3000> |
| `npm test` | Unit tests (Vitest) |
| `REFORM_TEST_DATABASE_URL=… npm test` | Also runs the database tests. They truncate the tables, so use a throwaway database. |
| `npm run e2e` | End-to-end tests (Playwright) against a production build on port 3100. Uses `REFORM_E2E_DATABASE_URL` (default `postgres://reform:reform@localhost:5432/reform_e2e`, created if missing and truncated on every run). Run `npx playwright install chromium` once first. |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm run build` | Production build (standalone output) |

## Project layout
```
app/
  api/forms/route.ts          POST /api/forms
  api/healthz/route.ts        health check
  f/[token]/                  public form, submit action, thank-you page
  admin/                      login, form list, response detail, Markdown export, branding
  branding/[kind]/route.ts    uploaded logo and icon
  layout.tsx, theme.css       fonts, theme tokens and styles
components/                   form fields, page shell, admin widgets
lib/
  forms.ts                    request validation and form types
  answers.ts                  answer validation
  repo.ts                     database access (locking submit)
  markdown.ts                 Markdown export with escaping
  i18n.ts                     UI strings (en, de) and date formatting
  branding.ts, brand.ts       branding settings, validation and per-request loading
  site.ts                     optional display settings (links, time zone, admin language)
  config.ts                   required settings
  session.ts, auth.ts         signed admin session cookie
  migrate.ts, migrations/     schema migrations
proxy.ts                      redirects unauthenticated /admin requests
docs/API.md                   API reference
```

Built with Next.js (App Router, Server Actions), React, PostgreSQL via `pg` and `zod` for validation; nothing else at runtime.

## Security
- **API**: `POST /api/forms` requires `x-api-key`, compared in constant time. Bodies over 256 KB are rejected.
- **Links**: tokens are 32 random bytes (base64url), so they cannot be enumerated. Treat a link as a password for that form.
- **Admin**: one shared password, compared in constant time and rate limited to 10 attempts per 15 minutes per IP. Sessions are HMAC-SHA256 signed cookies (`HttpOnly`, `SameSite=Strict`, `Secure` when `REFORM_PUBLIC_URL` is https) valid for 12 hours. Every admin page and the export check the session on the server, not only the proxy.
- **Submissions**: answers are validated on the server against the stored questions; unknown options are rejected. A honeypot field and a per-IP rate limit stop simple bots.
- **Output**: React escapes all user content in pages, and the Markdown export escapes Markdown syntax in answers.

Found a vulnerability? Please report it privately, see [SECURITY.md](SECURITY.md).

## Limitations
- **Single replica.** Rate limits are kept in memory, so run one instance (or accept per-instance limits).
- **One admin password.** There are no user accounts or roles; put the admin behind your SSO proxy if you need them.
- **No webhooks yet.** Responses are read in the admin or exported; there is no callback or read API.
- **Forms are immutable.** To change questions, create a new form.
- **Languages**: English and German. Adding one is a single block in `lib/i18n.ts`.

## Contributing
Issues and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for the setup, checks and guidelines (including how to add a question type or a language).

## License
[MIT](LICENSE) © Loco Lokal
