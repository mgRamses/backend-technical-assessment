import { randomUUID } from "node:crypto";

import { type Request, type RequestHandler, type Response } from "express";

import type { AuditLogger, AuditRecord } from "../services/audit-log.js";
import { CircuitBreaker, CircuitBreakerOpenError } from "../services/circuit-breaker.js";
import { EncryptionService } from "../services/encryption.js";
import type { AiClient } from "../services/mock-ai-client.js";
import { sanitizeMessage } from "../services/sanitizer.js";

const MAX_USER_ID_LENGTH = 128;
const MAX_MESSAGE_LENGTH = 10_000;

export interface InquiryDependencies {
  aiClient: AiClient;
  circuitBreaker: CircuitBreaker;
  encryptionService: EncryptionService;
  auditLogger: Pick<AuditLogger, "append">;
  now?: () => Date;
  requestIdFactory?: () => string;
}

interface ValidInquiry {
  userId: string;
  message: string;
}

function parseInquiry(body: unknown): ValidInquiry | undefined {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return undefined;
  }

  const { userId, message } = body as Record<string, unknown>;
  if (
    typeof userId !== "string" ||
    typeof message !== "string" ||
    userId.trim().length === 0 ||
    message.trim().length === 0 ||
    userId.length > MAX_USER_ID_LENGTH ||
    message.length > MAX_MESSAGE_LENGTH
  ) {
    return undefined;
  }

  return { userId, message };
}

function createAuditRecord(
  requestId: string,
  sanitizedMessage: string,
  encryptedOriginalMessage: AuditRecord["encryptedOriginalMessage"],
  now: () => Date,
): AuditRecord {
  return {
    timestamp: now().toISOString(),
    requestId,
    sanitizedMessage,
    encryptedOriginalMessage,
  };
}

export function createInquiryHandler(dependencies: InquiryDependencies): RequestHandler {
  const now = dependencies.now ?? (() => new Date());
  const requestIdFactory = dependencies.requestIdFactory ?? randomUUID;

  return async (request: Request, response: Response): Promise<void> => {
    const inquiry = parseInquiry(request.body);
    if (!inquiry) {
      response.status(400).json({ error: "Invalid request payload" });
      return;
    }

    // userId is validated for the API contract but deliberately not sent to AI or audit logs.
    void inquiry.userId;
    const requestId = requestIdFactory();
    const sanitizedMessage = sanitizeMessage(inquiry.message);
    let encryptedOriginalMessage: AuditRecord["encryptedOriginalMessage"];

    try {
      encryptedOriginalMessage = dependencies.encryptionService.encrypt(inquiry.message);
    } catch {
      response.status(503).json({ requestId, error: "Service unavailable" });
      return;
    }

    const audit = async (): Promise<boolean> => {
      try {
        await dependencies.auditLogger.append(
          createAuditRecord(requestId, sanitizedMessage, encryptedOriginalMessage, now),
        );
        return true;
      } catch {
        return false;
      }
    };

    try {
      const answer = await dependencies.circuitBreaker.execute(() =>
        dependencies.aiClient.generateAnswer(sanitizedMessage),
      );
      if (!(await audit())) {
        response.status(503).json({ requestId, error: "Audit persistence failed" });
        return;
      }
      response.status(200).json({ requestId, answer });
    } catch (error) {
      const auditSucceeded = await audit();
      if (!auditSucceeded) {
        response.status(503).json({ requestId, error: "Audit persistence failed" });
        return;
      }
      if (error instanceof CircuitBreakerOpenError) {
        response.status(503).json({ requestId, error: "Service Busy" });
        return;
      }
      response.status(502).json({ requestId, error: "AI service unavailable" });
    }
  };
}
