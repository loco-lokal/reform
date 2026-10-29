# API reference

Reform has one write endpoint for creating forms, public pages for answering them, an admin area for reading responses and a health check.

## `POST /api/forms`
Creates a form and returns its public link. Meant for trusted server-side callers (your backend, a CRM workflow, n8n, Zapier, a script), never for browsers.

**Headers**

| Header | Value |
|---|---|
| `x-api-key` | the value of `REFORM_API_SECRET` |
| `content-type` | `application/json` |

The body may be at most 256 KB.

### Example
```bash
curl -X POST https://forms.example.com/api/forms \
  -H "x-api-key: $REFORM_API_SECRET" \
  -H "content-type: application/json" \
  -d '{
    "title": "Project kick-off questionnaire",
    "description": "A few questions so we can prepare for our first meeting.",
    "language": "en",
    "reference": "crm-deal-4711",
    "lifetime": { "singleUse": true, "expiresAt": "2026-12-01T23:59:59+01:00" },
    "questions": [
      { "id": "company", "type": "short_text", "label": "What is your company called?", "required": true },
      { "id": "goals", "type": "multiple_choice", "label": "What should the website do?", "options": ["Generate leads", "Take bookings", "Sell products"] },
      { "type": "yes_no", "label": "Do you already own a domain?" }
    ]
  }'
```

### Body
| Field | Type | Rules |
|---|---|---|
| `title` | string | required, 1–200 characters |
| `description` | string | optional, ≤5000 characters; line breaks are kept |
| `language` | `"en"` \| `"de"` | default `"en"`; language of buttons, messages and the export |
| `reference` | string | optional, ≤256 characters; your own id (e.g. a CRM record), shown in the admin and the export |
| `lifetime.singleUse` | boolean | the form closes after the first submitted response |
| `lifetime.expiresAt` | RFC 3339 date-time with offset | the form closes at this time; must be in the future |
| `questions` | array | 1–100 questions |

At least one of `lifetime.singleUse: true` or `lifetime.expiresAt` is required. With both, whichever happens first closes the form. Without `singleUse`, a form accepts any number of responses until it expires.

### Questions
| Field | Rules |
|---|---|
| `id` | optional, matches `[a-z0-9][a-z0-9_-]{0,63}`, unique within the form; generated as `q1`, `q2`, … when missing. Use stable ids if you process answers by key. |
| `type` | one of the types below |
| `label` | required, ≤500 characters |
| `help` | optional hint under the label, ≤1000 characters |
| `placeholder` | optional, ≤200 characters (text inputs; first entry of a dropdown) |
| `required` | default `false` |
| `options` | required for `single_choice`, `multiple_choice` and `dropdown`: 2–50 unique strings (≤200 characters each); not allowed for other types |

### Question types
| Type | Input | Answer is valid when | Stored as |
|---|---|---|---|
| `short_text` | single-line text | ≤500 characters | string |
| `long_text` | text area | ≤10000 characters | string (line breaks kept) |
| `email` | email input | looks like `name@domain.tld` | string |
| `phone` | tel input | digits, spaces and `+()/.-`, at least 4 digits | string |
| `number` | decimal input | integer or decimal with `.` or `,` | string, as entered |
| `date` | date picker | a real calendar date | `YYYY-MM-DD` |
| `single_choice` | radio buttons | one of `options` | string |
| `multiple_choice` | checkboxes | a subset of `options` | array, in option order |
| `dropdown` | select | one of `options` | string |
| `yes_no` | two radio buttons | `yes` or `no` | `"yes"` / `"no"` |

Empty optional answers are left out of the stored response.

### Responses
`201 Created`
```json
{
  "id": "1b7c0d1e-…",
  "url": "https://forms.example.com/f/Xk3…",
  "expiresAt": "2026-12-01T22:59:59.000Z",
  "singleUse": true
}
```

`url` is built from `REFORM_PUBLIC_URL` and contains a 256-bit random token, so links cannot be guessed. Send it to the person who should answer. `id` identifies the form in the admin (`/admin/forms/{id}`).

Errors have the shape `{ "code": "…", "message": "…" }`:

| Status | `code` | When |
|---|---|---|
| 400 | `invalid_json` | the body is not JSON |
| 400 | `invalid_request` | validation failed; the response also has `issues: [{ "path": "questions[2].options", "message": "…" }]` |
| 401 | `unauthorized` | missing or wrong `x-api-key` |
| 413 | `too_large` | the body is over 256 KB |

## Public pages
| Path | |
|---|---|
| `GET /f/{token}` | The form. Closed or expired forms show "This form is no longer available"; unknown tokens return 404. |
| `GET /f/{token}/thanks` | Thank-you page after submitting. |
| `GET /branding/logo`, `GET /branding/icon` | Uploaded logo and favicon (404 when none is set). Cached for a year; pages link them with a `?v=` version. |
| `GET /` | Redirects to the website set under Branding in the admin, or to `/admin` when none is set. |

Submitting is a Next.js Server Action on the form page; there is no separate submit API.

## Admin
Protected by `REFORM_ADMIN_PASSWORD`.

| Path | |
|---|---|
| `/admin/login` | Sign in (10 attempts per 15 minutes per IP). |
| `/admin` | All forms, newest first, with status and response count. |
| `/admin/forms/{id}` | Responses, Markdown preview and copy button. |
| `GET /admin/forms/{id}/export` | All responses as a `text/markdown` attachment. Returns 401 JSON without a session. |
| `/admin/branding` | Name, website, logo, icon, colours and typography, with live preview and reset. |

## `GET /api/healthz`
`200 {"status":"ok"}` when the database is reachable, otherwise `503`.
