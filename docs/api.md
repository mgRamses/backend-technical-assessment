# HTTP API

## `GET /health`

Returns `200 OK` with `{ "status": "ok" }`.

## `POST /secure-inquiry`

Request body:

```json
{ "userId": "user-123", "message": "Contact me at name@example.com" }
```

`userId` and `message` must be non-empty strings. `userId` is limited to 128 characters and `message` to 10,000 characters. The service validates `userId` but does not send it to the mock AI or audit file.

Responses:

- `200 OK`: `{ "requestId": "uuid", "answer": "Mock AI response: ..." }`
- `400 Bad Request`: `{ "error": "Invalid request payload" }`
- `502 Bad Gateway`: `{ "requestId": "uuid", "error": "AI service unavailable" }` for an AI-call failure.
- `503 Service Unavailable`: `{ "requestId": "uuid", "error": "Service Busy" }` while the circuit is open; these requests do not invoke the AI client.
- `503 Service Unavailable`: `{ "requestId": "uuid", "error": "Audit persistence failed" }` when required audit persistence cannot complete. A successful AI result is intentionally not reported as successful without its audit record.

The mock client waits two seconds in normal server configuration. Its injectable failure controls are only construction-time test dependencies and are not exposed as HTTP inputs.
