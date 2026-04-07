import { PIICheckResult } from "@/types";

// Australian phone number patterns
// Matches: 04XX XXX XXX, +614XXXXXXXX, 0X XXXX XXXX, (0X) XXXX XXXX, 13XX XX, 1300 XXX XXX, 1800 XXX XXX
const PHONE_PATTERNS: RegExp[] = [
  /(?:\+?61|0)4\d{2}[\s.-]?\d{3}[\s.-]?\d{3}/g,
  /(?:\+?61|0)[2-9]\d[\s.-]?\d{4}[\s.-]?\d{4}/g,
  /\(0[2-9]\d?\)\s?\d{4}\s?\d{4}/g,
  /13\d{2}[\s.-]?\d{2}/g,
  /1[38]00[\s.-]?\d{3}[\s.-]?\d{3}/g,
];

// Email pattern
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Australian Tax File Number (TFN): 8 or 9 digits, sometimes with spaces or dashes
const TFN_PATTERNS: RegExp[] = [
  /\b\d{3}[\s.-]?\d{3}[\s.-]?\d{2,3}\b/g,
];

// Australian Medicare number: 10 or 11 digits (10 digits + optional 1 digit IRN)
const MEDICARE_PATTERNS: RegExp[] = [
  /\b\d{4}[\s.-]?\d{5}[\s.-]?\d{1,2}\b/g,
];

// Australian drivers licence patterns (state-specific, typically 6-10 alphanumeric)
const DRIVERS_LICENCE_PATTERNS: RegExp[] = [
  /\b[A-Z]{0,2}\d{5,9}\b/gi,
];

// Australian BSB + Account number pattern
const BSB_ACCOUNT_PATTERN = /\b\d{3}[\s.-]?\d{3}[\s.-]?\d{5,10}\b/g;

// Credit card patterns (Visa, Mastercard, Amex)
const CREDIT_CARD_PATTERNS: RegExp[] = [
  /\b4\d{3}[\s.-]?\d{4}[\s.-]?\d{4}[\s.-]?\d{4}\b/g,
  /\b5[1-5]\d{2}[\s.-]?\d{4}[\s.-]?\d{4}[\s.-]?\d{4}\b/g,
  /\b3[47]\d{2}[\s.-]?\d{6}[\s.-]?\d{5}\b/g,
];

// Australian passport number: 2 letters followed by 7 digits
const PASSPORT_PATTERN = /\b[A-Z]{2}\d{7}\b/gi;

// Full street address pattern (number + street name + street type)
const ADDRESS_PATTERN = /\b\d{1,5}\s+[A-Za-z]+\s+(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Boulevard|Blvd|Lane|Ln|Court|Ct|Place|Pl|Crescent|Cres|Terrace|Tce|Way|Close|Cl|Circuit|Cct|Parade|Pde)\b/gi;

// Date of birth patterns
const DOB_PATTERNS: RegExp[] = [
  /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g,
  /\b(?:0?[1-9]|[12]\d|3[01])\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{2,4}\b/gi,
];

// PII keyword indicators (contextual triggers)
const PII_KEYWORDS: string[] = [
  "tax file number",
  "tfn",
  "medicare number",
  "medicare card",
  "drivers licence",
  "driver licence",
  "drivers license",
  "driver license",
  "licence number",
  "license number",
  "passport number",
  "bank account",
  "account number",
  "bsb",
  "credit card",
  "card number",
  "date of birth",
  "dob",
  "social security",
  "ssn",
  "my address is",
  "i live at",
  "home address",
  "residential address",
  "full name is",
];

const REDACTION_PLACEHOLDER = "[REDACTED]";

interface PIIDetection {
  type: string;
  match: string;
  index: number;
}

function detectPhoneNumbers(text: string): PIIDetection[] {
  const detections: PIIDetection[] = [];
  for (const pattern of PHONE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      detections.push({
        type: "phone_number",
        match: match[0],
        index: match.index,
      });
    }
  }
  return detections;
}

function detectEmails(text: string): PIIDetection[] {
  const detections: PIIDetection[] = [];
  const regex = new RegExp(EMAIL_PATTERN.source, EMAIL_PATTERN.flags);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    // Exclude common business/generic email domains that are likely not personal PII
    const email = match[0].toLowerCase();
    const isBusinessEmail =
      email.endsWith("@stockland.com.au") ||
      email.endsWith("@example.com") ||
      email.endsWith("@test.com");
    if (!isBusinessEmail) {
      detections.push({
        type: "email",
        match: match[0],
        index: match.index,
      });
    }
  }
  return detections;
}

function detectTFNs(text: string): PIIDetection[] {
  const detections: PIIDetection[] = [];
  const lowerText = text.toLowerCase();
  const hasTFNContext =
    lowerText.includes("tfn") ||
    lowerText.includes("tax file") ||
    lowerText.includes("tax number");

  if (!hasTFNContext) {
    return detections;
  }

  for (const pattern of TFN_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      detections.push({
        type: "tax_file_number",
        match: match[0],
        index: match.index,
      });
    }
  }
  return detections;
}

function detectMedicareNumbers(text: string): PIIDetection[] {
  const detections: PIIDetection[] = [];
  const lowerText = text.toLowerCase();
  const hasMedicareContext =
    lowerText.includes("medicare") ||
    lowerText.includes("health card");

  if (!hasMedicareContext) {
    return detections;
  }

  for (const pattern of MEDICARE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      detections.push({
        type: "medicare_number",
        match: match[0],
        index: match.index,
      });
    }
  }
  return detections;
}

function detectCreditCards(text: string): PIIDetection[] {
  const detections: PIIDetection[] = [];
  for (const pattern of CREDIT_CARD_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      detections.push({
        type: "credit_card",
        match: match[0],
        index: match.index,
      });
    }
  }
  return detections;
}

function detectBSBAccounts(text: string): PIIDetection[] {
  const detections: PIIDetection[] = [];
  const lowerText = text.toLowerCase();
  const hasBankContext =
    lowerText.includes("bsb") ||
    lowerText.includes("bank account") ||
    lowerText.includes("account number");

  if (!hasBankContext) {
    return detections;
  }

  const regex = new RegExp(BSB_ACCOUNT_PATTERN.source, BSB_ACCOUNT_PATTERN.flags);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    detections.push({
      type: "bank_account",
      match: match[0],
      index: match.index,
    });
  }
  return detections;
}

function detectPassportNumbers(text: string): PIIDetection[] {
  const detections: PIIDetection[] = [];
  const lowerText = text.toLowerCase();
  const hasPassportContext = lowerText.includes("passport");

  if (!hasPassportContext) {
    return detections;
  }

  const regex = new RegExp(PASSPORT_PATTERN.source, PASSPORT_PATTERN.flags);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    detections.push({
      type: "passport_number",
      match: match[0],
      index: match.index,
    });
  }
  return detections;
}

function detectDriversLicence(text: string): PIIDetection[] {
  const detections: PIIDetection[] = [];
  const lowerText = text.toLowerCase();
  const hasLicenceContext =
    lowerText.includes("licence") ||
    lowerText.includes("license") ||
    lowerText.includes("driver");

  if (!hasLicenceContext) {
    return detections;
  }

  for (const pattern of DRIVERS_LICENCE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      detections.push({
        type: "drivers_licence",
        match: match[0],
        index: match.index,
      });
    }
  }
  return detections;
}

function detectAddresses(text: string): PIIDetection[] {
  const detections: PIIDetection[] = [];
  const regex = new RegExp(ADDRESS_PATTERN.source, ADDRESS_PATTERN.flags);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    detections.push({
      type: "street_address",
      match: match[0],
      index: match.index,
    });
  }
  return detections;
}

function detectDatesOfBirth(text: string): PIIDetection[] {
  const detections: PIIDetection[] = [];
  const lowerText = text.toLowerCase();
  const hasDOBContext =
    lowerText.includes("date of birth") ||
    lowerText.includes("dob") ||
    lowerText.includes("born on") ||
    lowerText.includes("birthday");

  if (!hasDOBContext) {
    return detections;
  }

  for (const pattern of DOB_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      detections.push({
        type: "date_of_birth",
        match: match[0],
        index: match.index,
      });
    }
  }
  return detections;
}

function detectPIIKeywords(text: string): PIIDetection[] {
  const detections: PIIDetection[] = [];
  const lowerText = text.toLowerCase();

  for (const keyword of PII_KEYWORDS) {
    const index = lowerText.indexOf(keyword);
    if (index !== -1) {
      detections.push({
        type: "pii_keyword",
        match: keyword,
        index,
      });
    }
  }
  return detections;
}

function getAllDetections(text: string): PIIDetection[] {
  const allDetections: PIIDetection[] = [
    ...detectPhoneNumbers(text),
    ...detectEmails(text),
    ...detectTFNs(text),
    ...detectMedicareNumbers(text),
    ...detectCreditCards(text),
    ...detectBSBAccounts(text),
    ...detectPassportNumbers(text),
    ...detectDriversLicence(text),
    ...detectAddresses(text),
    ...detectDatesOfBirth(text),
    ...detectPIIKeywords(text),
  ];

  // Deduplicate by match string and index
  const seen = new Set<string>();
  const unique: PIIDetection[] = [];
  for (const detection of allDetections) {
    const key = `${detection.type}:${detection.match}:${detection.index}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(detection);
    }
  }

  return unique;
}

/**
 * Check text for PII (Personally Identifiable Information).
 * Returns a PIICheckResult indicating whether PII was found,
 * what types were detected, and a sanitized version of the content.
 */
export function checkTextForPII(text: string): PIICheckResult {
  if (!text || text.trim().length === 0) {
    return {
      hasPII: false,
      detectedTypes: [],
      sanitizedContent: text,
      originalContent: text,
    };
  }

  const detections = getAllDetections(text);

  if (detections.length === 0) {
    return {
      hasPII: false,
      detectedTypes: [],
      sanitizedContent: text,
      originalContent: text,
    };
  }

  const detectedTypes = [...new Set(detections.map((d) => d.type))];
  const sanitizedContent = redactDetections(text, detections);

  return {
    hasPII: true,
    detectedTypes,
    sanitizedContent,
    originalContent: text,
  };
}

/**
 * Redact all detected PII from the given text.
 * Returns the text with PII replaced by [REDACTED] placeholders.
 */
export function redactPII(text: string): string {
  if (!text || text.trim().length === 0) {
    return text;
  }

  const detections = getAllDetections(text);

  if (detections.length === 0) {
    return text;
  }

  return redactDetections(text, detections);
}

function redactDetections(text: string, detections: PIIDetection[]): string {
  // Filter out keyword-only detections (we don't redact the keyword itself,
  // only the actual PII values). Keywords are used for contextual detection only.
  const valueDetections = detections.filter((d) => d.type !== "pii_keyword");

  if (valueDetections.length === 0) {
    return text;
  }

  // Sort detections by index descending so we can replace from end to start
  // without affecting earlier indices
  const sorted = [...valueDetections].sort((a, b) => b.index - a.index);

  let result = text;
  for (const detection of sorted) {
    const before = result.substring(0, detection.index);
    const after = result.substring(detection.index + detection.match.length);
    result = before + REDACTION_PLACEHOLDER + after;
  }

  return result;
}

/**
 * Validate that text is safe to send to an LLM (no PII detected).
 * Returns true if the text is safe (no PII), false otherwise.
 */
export function isTextSafeForLLM(text: string): boolean {
  const result = checkTextForPII(text);
  return !result.hasPII;
}

/**
 * Prepare text for LLM by redacting any PII found.
 * Returns the sanitized text safe for LLM consumption.
 */
export function sanitizeForLLM(text: string): string {
  return redactPII(text);
}

/**
 * Validate outbound draft content for compliance.
 * Checks that the draft does not contain PII and meets content guidelines.
 * Returns a result object with validation status and any issues found.
 */
export function validateDraftCompliance(draftContent: string): {
  isCompliant: boolean;
  issues: string[];
  piiCheck: PIICheckResult;
} {
  const issues: string[] = [];
  const piiCheck = checkTextForPII(draftContent);

  if (piiCheck.hasPII) {
    issues.push(
      `PII detected in draft: ${piiCheck.detectedTypes.join(", ")}. Please remove personal information before sending.`
    );
  }

  if (draftContent.length > 2000) {
    issues.push("Draft exceeds maximum length of 2000 characters.");
  }

  if (draftContent.trim().length === 0) {
    issues.push("Draft content cannot be empty.");
  }

  return {
    isCompliant: issues.length === 0,
    issues,
    piiCheck,
  };
}