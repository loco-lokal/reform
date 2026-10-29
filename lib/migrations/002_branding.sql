-- Branding edited in the admin. One settings row; images are stored here so no shared volume is needed.
CREATE TABLE branding (
    id         boolean PRIMARY KEY DEFAULT true CHECK (id),
    settings   jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE branding_assets (
    kind         text PRIMARY KEY CHECK (kind IN ('logo', 'icon')),
    content_type text NOT NULL,
    data         bytea NOT NULL,
    updated_at   timestamptz NOT NULL DEFAULT now()
);
