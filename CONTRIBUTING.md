# Contributing to Reform

Thanks for helping! Bug reports, fixes, new question types and translations are all welcome.

## Before you start
- For anything bigger than a small fix, open an issue first so we can agree on the approach.
- Security problems go to a [private advisory](https://github.com/loco-lokal/reform/security/advisories/new), not a public issue (see [SECURITY.md](SECURITY.md)).

## Development setup
You need Node.js 22+ and a PostgreSQL 14+ database.

```bash
docker run -d --name reform-pg -e POSTGRES_USER=reform -e POSTGRES_PASSWORD=reform -e POSTGRES_DB=reform -p 5432:5432 postgres:16-alpine
cp .env.example .env.local
npm install
npm run dev
```

The schema is migrated automatically when the server starts.

## Checks
```bash
npm run lint
npm run typecheck
npm test                                                    # unit tests
REFORM_TEST_DATABASE_URL=postgres://reform:reform@localhost:5432/reform npm test   # plus database tests
npm run build
```

The database tests **truncate** the `forms` table, so point them at a throwaway database. CI runs all of the above on every pull request.

## Guidelines
- **Keep it small.** Reform does one job; dependencies are limited to Next.js, `pg` and `zod`. Please discuss before adding new ones.
- **Validate on the server.** Every answer is checked in `lib/answers.ts`; the public form must keep working without JavaScript.
- **API changes** need an update to [docs/API.md](docs/API.md) and a test in `test/forms.test.ts`. Avoid breaking existing request bodies.
- **Schema changes** go into a new numbered file in `lib/migrations/` (never edit an applied one).
- **UI strings** live in `lib/i18n.ts` and need every language. German copy uses the informal "du".
- **Markdown export**: user input must stay escaped (`lib/markdown.ts`), so answers cannot inject headings or lists.

### Adding a question type
1. Add it to `QUESTION_TYPES` in `lib/forms.ts` (and the options rules if it is a choice type).
2. Validate it in `checkValue` in `lib/answers.ts`.
3. Render it in `components/QuestionField.tsx` and, if it needs formatting, in `lib/markdown.ts` and the admin detail page.
4. Add tests and document it in `docs/API.md`.

### Adding a language
Add the code to `LANGUAGES` in `lib/forms.ts` and a full message set to `lib/i18n.ts`; TypeScript reports missing keys.

## Commits and pull requests
Use short, imperative commit messages (`Add rating question type`). Keep pull requests focused on one change and fill in the checklist in the template.

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
