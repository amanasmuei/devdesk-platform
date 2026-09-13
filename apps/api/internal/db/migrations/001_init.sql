CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text UNIQUE NOT NULL,
    password_hash text NOT NULL,
    is_admin boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid REFERENCES users(id),
    email text NOT NULL,
    name text NOT NULL,
    service text,
    urgency text,
    details text,
    status text NOT NULL DEFAULT 'submitted'
        CHECK (status IN ('submitted', 'quoted', 'in_progress', 'delivered', 'declined')),
    quote_price numeric,
    quote_date date,
    admin_notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_requests_email ON requests (email);
CREATE INDEX IF NOT EXISTS idx_requests_client_id ON requests (client_id);
