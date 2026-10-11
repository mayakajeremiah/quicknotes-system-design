# QuickNotes Data Model

## Entities and columns

### `users`
Stores each account. `id` is the primary key; `email` is required and unique.

### `notes`
Stores note content and timestamps. Each note belongs to one user through `user_id`, a foreign key to `users.id`.

### `tags`
Stores reusable tag labels owned by a user. A user can create multiple tags; tag names are unique per user.

### `note_tags`
Join table that links notes and tags. Its composite primary key prevents attaching the same tag to the same note more than once. Foreign keys enforce valid references.

## Relationships

- **One-to-many:** one user can own many notes, but each note belongs to one user (`users` → `notes`).
- **One-to-many:** one user can create many tags, but each tag belongs to one user (`users` → `tags`).
- **Many-to-many:** a note can have many tags and a tag can label many notes. `note_tags` implements this relationship because a relational table cannot represent an arbitrary list of tag references cleanly while maintaining referential integrity.

## SQLite schema

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 100),
    body TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE tags (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 50),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, name),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE note_tags (
    note_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (note_id, tag_id),
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX idx_notes_user_updated
    ON notes(user_id, updated_at DESC);

CREATE INDEX idx_note_tags_tag
    ON note_tags(tag_id);
```

`password_hash` stores a secure password hash, never a plaintext password. Production systems should use an established password-hashing algorithm and appropriate account-security controls.

## Example SQL queries

### 1. List the most recently updated notes for a user

```sql
SELECT id, title, body, created_at, updated_at
FROM notes
WHERE user_id = 1
ORDER BY updated_at DESC
LIMIT 20;
```

### 2. Join notes to their owner

```sql
SELECT notes.title, notes.body, users.name AS owner
FROM notes
JOIN users ON users.id = notes.user_id
WHERE notes.id = 10;
```

### 3. Find tags attached to a note (two joins)

```sql
SELECT tags.name
FROM note_tags
JOIN tags ON tags.id = note_tags.tag_id
JOIN notes ON notes.id = note_tags.note_id
WHERE notes.id = 10
  AND notes.user_id = 1;
```

### 4. Count notes per user

```sql
SELECT users.id, users.name, COUNT(notes.id) AS note_count
FROM users
LEFT JOIN notes ON notes.user_id = users.id
GROUP BY users.id, users.name;
```

## Index and reason

`idx_notes_user_updated` indexes `(user_id, updated_at DESC)` because listing a user's notes by most recent update is a frequent feed-like query. It helps the database find the user's rows and return them in the requested order with less scanning. The `idx_note_tags_tag` index supports finding notes associated with a particular tag; the composite primary key already supports lookups starting with `note_id`.

## SQL or NoSQL?

I would choose a relational SQL database such as PostgreSQL for QuickNotes. Users, notes, tags, and note-tag associations have clear relationships, and foreign keys and transactions help keep these relationships consistent. SQL also supports joins, constraints, indexes, and flexible reporting queries. PostgreSQL can scale through indexing, read replicas, partitioning where justified, and connection pooling. A NoSQL database could be useful for specialized high-volume access patterns, but it is not necessary for the initial core data model.
