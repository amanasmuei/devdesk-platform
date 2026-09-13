-- v2 workflow: full status ladder + client decisions + delivery preview link.
ALTER TABLE requests DROP CONSTRAINT requests_status_check;
ALTER TABLE requests ADD CONSTRAINT requests_status_check CHECK (
    status IN ('submitted', 'quoted', 'accepted', 'declined', 'in_progress', 'delivered', 'paid')
);
ALTER TABLE requests ADD COLUMN preview_url text;
