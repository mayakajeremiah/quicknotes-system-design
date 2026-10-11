# QuickNotes System Design

QuickNotes is a notes application project that demonstrates a browser-based API client and a proposed backend design for a service that could grow to one million registered users.

## What's included

- `index.html`, `style.css`, and `api.js`: a responsive API client that loads, creates, and deletes sample posts through the JSONPlaceholder practice API.
- `docs/api-design.md`: proposed REST endpoints, JSON examples, and error responses for a real QuickNotes backend.
- `docs/data-model.md`: relational entities, keys, relationships, schema, queries, and indexes.
- `docs/architecture.md`: functional and non-functional requirements, capacity estimates, architecture diagram, request flows, and trade-offs.

## Run the API client

1. Clone or download this repository.
2. Open the project folder in VS Code.
3. Start `index.html` with the Live Server extension, or serve the folder with any simple local HTTP server.
4. Click **Load notes** to fetch up to 10 sample posts.
5. Enter a title and optional body, then click **Create note** to test POST.
6. Click a note's **Delete** button to test DELETE.

The client uses `https://jsonplaceholder.typicode.com/posts`, a practice API. JSONPlaceholder simulates creation and deletion; it does not permanently save those changes. The created note is displayed locally after the simulated POST, but it will not reappear after reloading the list.

## Design documents

- [API design](docs/api-design.md)
- [Data model](docs/data-model.md)
- [Architecture](docs/architecture.md)

## What I learned

- How to make reusable asynchronous HTTP requests with `fetch`, check response status, and handle loading, success, empty, and error states.
- Why user-provided content should be rendered with `textContent` rather than inserted as HTML, reducing the risk of cross-site scripting.
- How REST methods and HTTP status codes communicate listing, creating, updating, deleting, and error outcomes.
- How primary keys, foreign keys, unique constraints, joins, and indexes support a reliable relational data model.
- How caching, read replicas, load balancing, queues, and multiple app servers address different scaling and availability challenges.
- Why capacity calculations depend on explicit assumptions and should be revised using real traffic measurements.
