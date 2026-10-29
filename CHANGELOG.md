# Changelog

All notable changes are documented here. The project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- `POST /api/forms` to create single-use and/or expiring forms with ten question types.
- Public form pages in English and German that work without JavaScript, with server-side validation, honeypot and rate limiting.
- Password-protected admin with response view and Markdown copy/download.
- Branding page in the admin (`/admin/branding`): name, website, uploaded logo and favicon, seven colours, heading and body font, heading weight, base font size and heading size, with a live preview and reset. Stored in the database and applied without a redeploy.
- Imprint and privacy links, time zone and admin language through environment variables.

### Removed
- **Breaking:** `REFORM_BRAND_NAME`, `REFORM_SITE_URL`, `REFORM_LOGO_URL`, `REFORM_ACCENT_COLOR`, `REFORM_ON_ACCENT_COLOR` and `REFORM_ACCENT_TEXT_COLOR` are no longer read. Set these in the admin under Branding instead.
- Docker image, Docker Compose quick start and CI.
