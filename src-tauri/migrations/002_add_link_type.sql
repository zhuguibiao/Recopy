-- Add 'link' to content_type CHECK constraint.
-- SQLite does not support ALTER CHECK, so we recreate the table.

CREATE TABLE clipboard_items_new (
    id              TEXT PRIMARY KEY NOT NULL,
    content_type    TEXT NOT NULL CHECK(content_type IN ('plain_text', 'rich_text', 'image', 'file', 'link')),
    plain_text      TEXT NOT NULL DEFAULT '',
    rich_content    BLOB,
    thumbnail       BLOB,
    image_path      TEXT,
    file_path       TEXT,
    file_name       TEXT NOT NULL DEFAULT '',
    source_app      TEXT NOT NULL DEFAULT '',
    source_app_name TEXT NOT NULL DEFAULT '',
    content_size    INTEGER NOT NULL DEFAULT 0,
    content_hash    TEXT NOT NULL,
    is_favorited    BOOLEAN NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO clipboard_items_new SELECT * FROM clipboard_items;

DROP TABLE clipboard_items;

ALTER TABLE clipboard_items_new RENAME TO clipboard_items;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_clipboard_items_created_at ON clipboard_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clipboard_items_content_type ON clipboard_items(content_type);
CREATE INDEX IF NOT EXISTS idx_clipboard_items_content_hash ON clipboard_items(content_hash);
CREATE INDEX IF NOT EXISTS idx_clipboard_items_is_favorited ON clipboard_items(is_favorited);
