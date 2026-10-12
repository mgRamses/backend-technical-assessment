# Guardian Integration Gateway

Secure Express middleware for a technical assessment. It accepts an inquiry, sanitizes supported PII before the mock AI request, encrypts the original message with AES-256-GCM, and appends an audit record to JSONL.

## Prerequisites

- Node.js 20 or later
- npm
- Docker Desktop (for containers)

## Local setup

Install dependencies and copy the environment template:

```sh
npm ci
cp .env.example .env
```

Generate a key locally and place its output after `AUDIT_ENCRYPTION_KEY=` in `.env`:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

The key must be base64 that decodes to exactly 32 bytes. Treat `.env` as a secret: it is ignored by Git and Docker build context; never commit or share it. Start locally with:

```sh
npm run dev
```

## API

```sh
curl http://localhost:3000/health
curl -X POST http://localhost:3000/secure-inquiry \
  -H 'content-type: application/json' \
  -d '{"userId":"demo-user","message":"Contact jane@example.com"}'
```

See [API response schemas](docs/api.md). The normal mock AI response is deliberately delayed by two seconds.

## Tests and build

```sh
npm run typecheck
npm test
npm run build
```

## Docker

With a valid local `.env` file in place:

```sh
docker compose up --build -d
docker compose ps
curl http://localhost:3000/health
docker compose down
```

The Compose service runs as the image's unprivileged `node` user with a read-only root filesystem, dropped Linux capabilities, and `no-new-privileges`. Its named `audit-data` volume is mounted at `/app/data`, keeping `audit.jsonl` across container recreation. Inspect the container identity with `docker compose exec app id` and the audit file with `docker compose exec app cat /app/data/audit.jsonl`.

To stop and remove the persistent audit volume too, use `docker compose down --volumes`.

## Audit and security notes

Each valid request is audited with a timestamp, request ID, plaintext sanitized message, and encrypted original message. The original message and encryption key are not logged. The local JSONL approach serializes writes within one Node.js process only; use a centralized audit store for multi-process production deployments.

PII matching is deliberately regex-based and imperfect. Its scope and limitations are documented in [security-and-limitations.md](docs/security-and-limitations.md).

## Troubleshooting

- **Missing/invalid key:** the process exits at startup with an `AUDIT_ENCRYPTION_KEY` validation error. Generate a fresh 32-byte base64 key as above.
- **Port already in use:** change the host-side `PORT` in `.env`, then restart Compose.
- **No audit record:** check `docker compose logs app`; an audit write failure returns HTTP 503 instead of a false success.
