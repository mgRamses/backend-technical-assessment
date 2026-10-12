const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const CREDIT_CARD_CANDIDATE_PATTERN =
  /(?<![A-Z0-9])(?:\d[ -]?){12,18}\d(?![A-Z0-9])(?!-\d{2}-\d{4}(?!\d))/gi;
const NINE_DIGIT_IDENTIFIER_PATTERN = /(?<!\d)(?:\d{3}-?\d{2}-?\d{4}|\d{9})(?!\d)/g;

export const REDACTED_EMAIL = "[REDACTED: EMAIL]";
export const REDACTED_CREDIT_CARD = "[REDACTED: CREDIT_CARD]";
export const REDACTED_SSN = "[REDACTED: SSN]";

function passesLuhnCheck(value: string): boolean {
  const digits = value.replaceAll(/[ -]/g, "");
  let sum = 0;
  let shouldDouble = false;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

export function sanitizeMessage(message: string): string {
  return message
    .replace(EMAIL_PATTERN, REDACTED_EMAIL)
    .replace(CREDIT_CARD_CANDIDATE_PATTERN, (candidate) =>
      passesLuhnCheck(candidate) ? REDACTED_CREDIT_CARD : candidate,
    )
    .replace(NINE_DIGIT_IDENTIFIER_PATTERN, REDACTED_SSN);
}
