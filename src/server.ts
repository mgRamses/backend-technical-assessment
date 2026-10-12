import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { AuditLogger } from "./services/audit-log.js";
import { CircuitBreaker } from "./services/circuit-breaker.js";
import { EncryptionService } from "./services/encryption.js";
import { MockAiClient } from "./services/mock-ai-client.js";

const config = loadConfig();
const app = createApp({
  inquiryDependencies: {
    aiClient: new MockAiClient(),
    circuitBreaker: new CircuitBreaker(),
    encryptionService: new EncryptionService(config.auditEncryptionKey),
    auditLogger: new AuditLogger("data/audit.jsonl"),
  },
});

const server = app.listen(config.port, () => {
  console.info(`Guardian Integration Gateway listening on port ${config.port}`);
});

let shuttingDown = false;
function shutdown(): void {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.info("Guardian Integration Gateway shutting down");
  server.close((error) => {
    if (error) {
      console.error("Server shutdown encountered an error");
      process.exitCode = 1;
    }
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
