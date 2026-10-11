# QuickNotes System Architecture

## 1. Functional requirements

- Users can register, authenticate, and access only their own notes.
- Users can create, list, read, update, and delete notes.
- Users can create tags and attach multiple tags to notes.
- Users can search and paginate through their notes.
- The API validates input and returns consistent JSON responses and HTTP status codes.
- The system records operational errors and supports background jobs for work that does not need to block an API response.

## 2. Non-functional requirements

- **Availability:** deploy multiple application instances across separate failure domains and monitor health.
- **Performance:** aim for p95 list-note API latency below 300 ms under normal load, excluding client network time.
- **Scalability:** scale application instances horizontally and scale database reads with a replica and cache.
- **Security:** use HTTPS, authenticated requests, authorization checks, input validation, rate limiting, and encrypted backups.
- **Durability:** commit note writes to durable database storage and back up data regularly.
- **Maintainability:** use automated tests, structured logs, metrics, alerts, and documented API contracts.

## 3. Capacity assumptions for 1 million users

These are planning assumptions, not measurements:

- 1,000,000 registered users.
- 10% are daily active: 100,000 daily active users.
- Each active user opens the notes list 20 times per day.
- Each active user creates 2 notes per day.
- Each note averages 2 KB of stored text and metadata, excluding indexes and backups.
- 86,400 seconds per day and 365 days per year.
- Peak request rate is estimated at 5 times the daily average.

### Reads per second

Daily reads = 100,000 active users × 20 list requests = 2,000,000 reads/day.

Average reads per second = 2,000,000 ÷ 86,400 ≈ **23.15 reads/second**.

Estimated peak reads = 23.15 × 5 ≈ **115.74 reads/second**.

### Writes per second

Daily writes = 100,000 active users × 2 created notes = 200,000 writes/day.

Average writes per second = 200,000 ÷ 86,400 ≈ **2.31 writes/second**.

Estimated peak writes = 2.31 × 5 ≈ **11.57 writes/second**.

These write estimates count note creation only; edits, deletes, tags, sessions, and background jobs would add more writes. A read request may also generate several database queries, so request rates are not the same as SQL query rates.

### Storage per year

Annual notes = 200,000 notes/day × 365 = 73,000,000 notes/year.

Raw note data = 73,000,000 × 2 KB = 146,000,000 KB ≈ **146 GB/year** using decimal units.

This estimate excludes user records, tags, indexes, replicas, backups, logs, and growth in note size. With overhead, actual provisioned capacity should be higher and monitored over time.

## 4. Architecture diagram

```text
                       +--------------------+
                       | Browser / Mobile   |
                       |      Client        |
                       +---------+----------+
                                 |
                                 v
                       +--------------------+
                       |        DNS         |
                       | Resolve API domain |
                       +---------+----------+
                                 |
                                 v
                       +--------------------+
                       |        CDN         |
                       | Static assets      |
                       +---------+----------+
                                 |
                                 v
                       +--------------------+
                       |   Load Balancer    |
                       +---------+----------+
                                 |
                    +------------+------------+
                    |                         |
                    v                         v
             +--------------+          +--------------+
             | App Server A |          | App Server B |
             +------+-------+          +------+-------+
                    |                         |
                    +------------+------------+
                                 |
                       +---------+---------+
                       |                   |
                       v                   v
                +-------------+     +----------------+
                |    Cache    |     | Primary DB     |
                | Hot note    |     | Writes / source|
                | lists       |     +-------+--------+
                +-------------+             |
                                            | replication
                                            v
                                    +----------------+
                                    | Read Replica   |
                                    | Read queries   |
                                    +----------------+

                App servers also publish background jobs:
                                 |
                                 v
                         +---------------+
                         | Queue / Broker|
                         +-------+-------+
                                 |
                                 v
                         +---------------+
                         | Worker         |
                         | Email, cleanup,|
                         | export jobs    |
                         +-------+-------+
                                 |
                                 v
                         +---------------+
                         | Database /     |
                         | external service|
                         +---------------+
```

The CDN primarily caches versioned static frontend assets; authenticated, user-specific note API responses should not be publicly cached. The cache can hold private note-list results only with user-aware keys and careful invalidation.

## 5. What each component solves

- **Client:** provides the browser or mobile interface where users create and manage notes.
- **DNS:** maps the API hostname to the service's network entry point.
- **CDN:** serves static JavaScript, CSS, and other cacheable assets close to users, reducing latency and origin traffic.
- **Load balancer:** distributes requests across healthy application instances and removes unhealthy instances from rotation.
- **App servers:** validate requests, authenticate users, enforce permissions, execute business logic, and coordinate database and queue operations.
- **Cache:** speeds up repeated reads and reduces database load for frequently requested note lists or metadata.
- **Primary database:** stores authoritative user, note, tag, and relationship records and handles writes.
- **Read replica:** handles eligible read queries to reduce primary-database read load, with the understanding that replication can lag.
- **Queue:** buffers asynchronous tasks so temporary traffic spikes do not block user-facing requests.
- **Worker:** processes queued jobs such as email notifications, exports, and cleanup outside the request-response path.

## 6. GET /notes request flow

1. The client resolves the API hostname through DNS and sends an HTTPS request to `GET /v1/notes` with an access token.
2. The load balancer selects a healthy application server.
3. The app server validates the token and confirms the user identity and permissions.
4. The server checks the cache using a key scoped to that user and the requested pagination parameters.
5. On a cache hit, it returns the user's cached note list after confirming the cache policy is safe for the data's freshness requirements.
6. On a cache miss, the app server queries the read replica when replica freshness is acceptable; otherwise it queries the primary database.
7. The server formats the paginated JSON response and returns `200 OK`.
8. The cache is populated or refreshed according to the expiration policy. Cache failures should fall back to the database rather than make the service unavailable.

## 7. POST /notes request flow

1. The client sends `POST /v1/notes` with an access token and JSON containing the title and optional body.
2. The load balancer forwards the request to a healthy app server.
3. The app server authenticates the user, validates the title and body, enforces request limits, and derives ownership from the authenticated identity.
4. The server inserts the note into the primary database using a parameterized query and a transaction where needed.
5. After the write succeeds, the server invalidates or updates the affected user's cached note-list entries.
6. If a notification or other asynchronous action is needed, the app server publishes a job to the queue; the API should not wait for nonessential background work.
7. The server returns `201 Created` with the new note representation and its identifier. The new note should be read from the primary briefly if immediate read-after-write consistency is required.
8. A worker consumes queued jobs, retries transient failures safely, and sends failures that exceed retry limits to a dead-letter queue for investigation.

## 8. Trade-offs

### Cache speed versus freshness

Caching makes repeated reads faster and lowers database load, but a stale cache can temporarily show outdated notes. Use short, measured TTLs, targeted invalidation after writes, user-scoped cache keys, and database fallback when the cache is unavailable.

### Read replicas versus immediate consistency

Read replicas increase read capacity, but replication lag can mean a recently created note is not immediately visible on a replica. Route read-after-write requests to the primary for a short period or until the replica has caught up, and use replica reads for less time-sensitive requests.

### Asynchronous jobs versus operational complexity

A queue keeps email, exports, and cleanup work from slowing down API responses, but it introduces retries, monitoring, duplicate-delivery risks, and eventual completion. Make jobs idempotent, set retry limits, monitor queue age, and use a dead-letter queue.

### More app servers versus operational cost

Multiple application instances improve capacity and resilience but add deployment and monitoring complexity. Autoscale based on measured CPU, latency, and request rate, and set sensible minimum and maximum instance counts.

## 9. Avoiding single points of failure

- Run at least two app servers across separate availability zones or failure domains, with health checks and automated replacement.
- Use a highly available load-balancer service and redundant DNS infrastructure.
- Deploy the cache with replication or managed failover; application code must tolerate cache loss by falling back to the database.
- Configure database backups and point-in-time recovery, monitor the replica, and use a tested managed failover plan for primary-database failure.
- Use a durable, replicated queue and workers in multiple instances; retry transient errors and preserve failed jobs for investigation.
- Monitor all critical components with alerts, test restore and failover procedures, and avoid claiming high availability until those procedures have been tested.

## 10. Conclusion

For one million registered users, the assumptions in this plan yield approximately 23 average list reads per second, 2.31 note creations per second, and 146 GB of raw note data per year. A CDN for static assets, multiple app servers, a user-aware cache, a primary database with a read replica, and a durable queue-worker system provide a practical starting architecture. Capacity should be adjusted using production measurements rather than estimates alone.
