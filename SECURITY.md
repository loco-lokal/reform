# Security policy

## Reporting a vulnerability
Please **do not** open a public issue. Report it privately through [GitHub security advisories](https://github.com/loco-lokal/reform/security/advisories/new).

Include what is affected, how to reproduce it and the impact you expect. We aim to reply within a week and will credit you in the release notes unless you prefer otherwise.

## Supported versions
Security fixes are made for the latest release.

## Hardening notes for operators
- Use long random values for `REFORM_API_SECRET`, `REFORM_ADMIN_PASSWORD` and `REFORM_SESSION_SECRET` (e.g. `openssl rand -base64 48`).
- Serve Reform over HTTPS only; the admin cookie is marked `Secure` in production.
- Run it behind a reverse proxy that sets `X-Forwarded-For`; the rate limits key on that header.
- Keep `POST /api/forms` for trusted callers: anyone with the API key can create forms on your domain.
