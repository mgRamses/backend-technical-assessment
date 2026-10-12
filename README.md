# Guardian Integration Gateway

Guardian Integration Gateway is a Node.js 20+/Express 5 technical-assessment service that accepts a secure inquiry, removes supported PII before a mock AI call, and records an encrypted audit trail.

## Architecture

```text
POST /secure-inquiry
  → validate userId and message
  → sanitize message
  → circuit-breaker-protected mock AI client
  → AES-256-GCM encrypt original message
  → serialized JSONL audit append
  → controlled HTTP response
```

The route is composed from independently testable services:

- `sanitizer`: replaces supported email, Luhn-valid card, and standalone nine-digit identifier matches.
- `mock-ai-client`: returns a deterministic response after a two-second production delay; tests inject failure behavior without exposing HTTP controls.
- `circuit-breaker`: protects only AI operations.
- `encryption`: uses Node's `crypto` APIs and AES-256-GCM.
- `audit-log`: serializes append operations within one Node.js process.

## Prerequisites

- Node.js 20 or later
- npm
- Docker Desktop (for container use)

## Local setup

Install dependencies and create a local secret file:

```sh
npm ci
cp .env.example .env
```

Generate a key locally and place its output after `AUDIT_ENCRYPTION_KEY=` in `.env`:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

The key must be base64 that decodes to exactly 32 bytes. `.env` is ignored by Git and the Docker build context; never commit, paste, or share it.

Run the development server:

```sh
npm run dev
```

## API

```sh
curl http://localhost:3000/health

curl -X POST http://localhost:3000/secure-inquiry \
  -H 'content-type: application/json' \
  -d '{"userId":"demo-user","message":"Contact demo@example.com"}'
```

`POST /secure-inquiry` accepts non-empty string `userId` (maximum 128 characters) and `message` (maximum 10,000 characters). The service validates but does not send `userId` to the mock AI or audit record. See [API response schemas](docs/api.md).

## Security decisions

- The message is sanitized before it reaches the AI client or plaintext audit field.
- The original message is encrypted with AES-256-GCM, using a configured 32-byte key and fresh random 12-byte IV for every record. Binary payload fields are base64-encoded.
- Original messages and encryption keys are never application-logged or written as plaintext audit fields.
- Each valid request is audit-attempted, including AI failures and circuit-open fallbacks. An audit-write failure returns HTTP 503 rather than a false success.
- `userId` is validated but intentionally omitted from AI and audit data.

## Circuit breaker

The breaker is `CLOSED` initially. Three consecutive AI failures transition it to `OPEN`. While open, requests return HTTP 503 with `Service Busy` immediately—without invoking the AI client or waiting two seconds. After the default 30-second cooldown, exactly one `HALF_OPEN` probe may run; concurrent requests are rejected. A successful probe closes and resets the counter, while a failed probe reopens the circuit and restarts the cooldown. Validation and audit errors do not count as AI failures.

## Tests and production build

```sh
npm run typecheck
npm test
npm run build
```

The test suite covers sanitization, authenticated encryption, JSONL audit writes, mock AI behavior, breaker transitions/concurrency, and HTTP integration behavior.

## Docker

With a valid local `.env` file in place:

```sh
docker compose up --build -d
docker compose ps
curl http://localhost:3000/health
docker compose down
```

The multi-stage image installs from the lockfile, compiles TypeScript, and runs only production dependencies. Compose runs the service as the unprivileged `node` user with a read-only root filesystem, dropped Linux capabilities, `no-new-privileges`, an init process, and graceful termination time. The named `audit-data` volume is mounted at `/app/data`, preserving `audit.jsonl` across container recreation.

Inspect runtime identity with `docker compose exec app id`. To remove the persistent audit volume intentionally, use `docker compose down --volumes`.

## Known limitations

- Regex/Luhn PII matching is not exhaustive and can miss unusual, encoded, international, or image-based data; it can also yield false positives.
- JSONL audit serialization is safe only within one logger instance in one Node.js process. Multi-instance deployment needs centralized durable audit storage.
- The mock delay is configured to 2,000 ms; event-loop scheduling can make wall-clock completion slightly later.

See [detailed security and detection limitations](docs/security-and-limitations.md).

## Demo preparation

Use the [demo-video checklist](docs/demo-video-checklist.md) when recording. No demo video has been recorded or uploaded as part of this repository preparation.

## Troubleshooting

- **Missing/invalid key:** startup fails with an `AUDIT_ENCRYPTION_KEY` validation error. Generate a fresh 32-byte base64 key as above.
- **Port already in use:** change the host-side `PORT` in `.env`, then restart Compose.
- **No audit record:** check `docker compose logs app`; audit persistence failures return HTTP 503.
