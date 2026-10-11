# QuickNotes REST API Design

## Overview

This document describes the **real QuickNotes backend API**, not the JSONPlaceholder practice service used by the browser demo. The production API uses JSON over HTTPS, requires authentication for private note data, and returns consistent status codes.

Base URL: `https://api.quicknotes.example/v1`

## Endpoints

| Method | Path | Description | Success status |
|---|---|---|---|
| GET | `/notes` | List the authenticated user's notes; supports `?limit=20&cursor=...` | `200 OK` |
| GET | `/notes/{noteId}` | Retrieve one note owned by the authenticated user | `200 OK` |
| POST | `/notes` | Create a note for the authenticated user | `201 Created` |
| PATCH | `/notes/{noteId}` | Update supplied fields of an existing note | `200 OK` |
| DELETE | `/notes/{noteId}` | Delete a note owned by the authenticated user | `204 No Content` |
| GET | `/tags` | List tags available to the authenticated user | `200 OK` |
| PUT | `/notes/{noteId}/tags/{tagId}` | Attach a tag to a note | `204 No Content` |
| DELETE | `/notes/{noteId}/tags/{tagId}` | Remove a tag from a note | `204 No Content` |

All note endpoints operate within the authenticated user's permissions. The server must never trust a client-supplied `userId` to determine ownership.

## Create a note

Request: `POST /v1/notes`

Headers:

```http
Authorization: Bearer <access-token>
Content-Type: application/json
```

Request JSON:

```json
{
  "title": "Plan the week",
  "body": "Finish the project proposal and revise SQL."
}
```

Response: `201 Created`

```json
{
  "data": {
    "id": "note_8f31",
    "userId": "user_42",
    "title": "Plan the week",
    "body": "Finish the project proposal and revise SQL.",
    "createdAt": "2026-10-10T10:00:00Z",
    "updatedAt": "2026-10-10T10:00:00Z",
    "tags": []
  }
}
```

The server assigns the ID and user ownership. A successful creation returns `201 Created` and may include a `Location: /v1/notes/note_8f31` header.

## List notes

Request: `GET /v1/notes?limit=20`

Response: `200 OK`

```json
{
  "data": [
    {
      "id": "note_8f31",
      "userId": "user_42",
      "title": "Plan the week",
      "body": "Finish the project proposal and revise SQL.",
      "createdAt": "2026-10-10T10:00:00Z",
      "updatedAt": "2026-10-10T10:00:00Z",
      "tags": []
    }
  ],
  "pagination": {
    "limit": 20,
    "nextCursor": null
  }
}
```

An empty collection returns `200 OK` with `"data": []`, not a 404. Pagination limits prevent clients from accidentally requesting an unbounded number of rows.

## Error status codes

| Status | Meaning | Typical cause |
|---|---|---|
| `400 Bad Request` | Request is invalid | Missing title, malformed JSON, invalid pagination limit |
| `401 Unauthorized` | Authentication is missing or invalid | Missing, expired, or invalid access token |
| `403 Forbidden` | Authenticated user lacks permission | Attempt to access a resource that policy forbids |
| `404 Not Found` | Resource does not exist or is not visible to this user | Unknown note ID |
| `409 Conflict` | Request conflicts with current state | Duplicate tag association or version conflict |
| `422 Unprocessable Entity` | JSON is syntactically valid but fails business validation | Title exceeds the allowed length |
| `429 Too Many Requests` | Rate limit exceeded | Too many requests in a short period |
| `500 Internal Server Error` | Unexpected server-side failure | Unhandled application or infrastructure error |
| `503 Service Unavailable` | Service is temporarily unavailable | Planned maintenance or overloaded dependency |

Example error body (`400 Bad Request`):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The title field is required.",
    "details": [
      { "field": "title", "issue": "required" }
    ],
    "requestId": "req_a17c"
  }
}
```

## API conventions and security

- Use HTTPS for all requests and JSON for request and response bodies.
- Require a valid bearer token for private user data; return `401` for missing or invalid authentication.
- Validate input on the server even when the client also validates it.
- Enforce ownership checks on reads, updates, deletes, and tag operations.
- Use parameterized SQL queries to avoid SQL injection.
- Apply rate limits, request IDs, structured logs, and pagination.
- Do not expose stack traces, secrets, or internal database details in error responses.
