# Security and detection limitations

`sanitizeMessage` is a lightweight, regex-based safeguard for the assessment. It detects conventional email addresses, digit-only or space/hyphen-separated 13–19 digit payment-card candidates that pass the Luhn check, and standalone nine-digit identifiers (including `123-45-6789`). It is not a complete PII-detection system.

It can miss unusual email syntax, other card separators or identifiers, values split across lines, images, encoded content, and international identifiers. Luhn-valid number sequences can also be false positives. Production use should combine stronger validation, context-aware detection, monitoring, and a reviewed data-classification policy.

Audit payload binary values (`iv`, `authTag`, and `ciphertext`) are base64 strings. AES-256-GCM authenticates the ciphertext: modified ciphertext or authentication tags fail decryption. JSONL audit writes are serialized only within one `AuditLogger` instance in one Node.js process; separate processes require a centralized audit store or inter-process coordination.
