import assert from "node:assert/strict";
import test from "node:test";

import {
  REDACTED_CREDIT_CARD,
  REDACTED_EMAIL,
  REDACTED_SSN,
  sanitizeMessage,
} from "../../src/services/sanitizer.js";

test("redacts email addresses surrounded by punctuation", () => {
  assert.equal(
    sanitizeMessage("Contact jane.doe+work@example.com, please."),
    `Contact ${REDACTED_EMAIL}, please.`,
  );
});

test("redacts Luhn-valid credit cards before nine-digit identifiers", () => {
  assert.equal(
    sanitizeMessage("Cards: 4111 1111 1111 1111 and 3782-822463-10005."),
    `Cards: ${REDACTED_CREDIT_CARD} and ${REDACTED_CREDIT_CARD}.`,
  );
});

test("keeps invalid credit card candidates", () => {
  assert.equal(
    sanitizeMessage("Candidate 4111 1111 1111 1112 is not valid."),
    "Candidate 4111 1111 1111 1112 is not valid.",
  );
});

test("redacts plain and formatted standalone nine-digit identifiers", () => {
  assert.equal(
    sanitizeMessage("IDs: 123456789; SSN: (123-45-6789)."),
    `IDs: ${REDACTED_SSN}; SSN: (${REDACTED_SSN}).`,
  );
});

test("does not redact nine digits embedded in longer numeric sequences", () => {
  assert.equal(
    sanitizeMessage("Keep 01234567890 and 1234567890 unchanged."),
    "Keep 01234567890 and 1234567890 unchanged.",
  );
});

test("redacts multiple sensitive values in one message", () => {
  assert.equal(
    sanitizeMessage("a@b.co 4111111111111111 987-65-4321 second@example.org"),
    `${REDACTED_EMAIL} ${REDACTED_CREDIT_CARD} ${REDACTED_SSN} ${REDACTED_EMAIL}`,
  );
});
