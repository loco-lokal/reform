CREATE TABLE forms (
    id          uuid PRIMARY KEY,
    token       text NOT NULL UNIQUE,
    title       text NOT NULL,
    description text NOT NULL DEFAULT '',
    language    text NOT NULL,
    questions   jsonb NOT NULL,
    single_use  boolean NOT NULL,
    expires_at  timestamptz,
    closed_at   timestamptz,
    reference   text NOT NULL DEFAULT '',
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX forms_created_at_idx ON forms (created_at DESC);

CREATE TABLE responses (
    id           uuid PRIMARY KEY,
    form_id      uuid NOT NULL REFERENCES forms (id) ON DELETE CASCADE,
    answers      jsonb NOT NULL,
    submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX responses_form_id_idx ON responses (form_id, submitted_at);
