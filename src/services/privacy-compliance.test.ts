import {
  checkTextForPII,
  redactPII,
  sanitizeForLLM,
  isTextSafeForLLM,
  validateDraftCompliance,
} from "@/services/privacy-compliance";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("PrivacyComplianceService", () => {
  // ─── checkTextForPII ─────────────────────────────────────────────────────

  describe("checkTextForPII", () => {
    // ─── Email Detection ─────────────────────────────────────────────────

    describe("email detection", () => {
      it("detects a standard email address", () => {
        const result = checkTextForPII("Contact me at john.doe@gmail.com please");
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("email");
      });

      it("detects email with subdomain", () => {
        const result = checkTextForPII("My email is user@mail.example.co.uk");
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("email");
      });

      it("detects email with plus addressing", () => {
        const result = checkTextForPII("Send to sarah+test@outlook.com");
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("email");
      });

      it("detects multiple email addresses", () => {
        const result = checkTextForPII(
          "Email me at john@gmail.com or jane@yahoo.com"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("email");
      });

      it("does not flag stockland business email as PII", () => {
        const result = checkTextForPII(
          "Contact our team at info@stockland.com.au"
        );
        expect(result.hasPII).toBe(false);
      });

      it("does not flag example.com email as PII", () => {
        const result = checkTextForPII("Test email: user@example.com");
        expect(result.hasPII).toBe(false);
      });

      it("does not flag test.com email as PII", () => {
        const result = checkTextForPII("Test email: user@test.com");
        expect(result.hasPII).toBe(false);
      });
    });

    // ─── Phone Number Detection ──────────────────────────────────────────

    describe("phone number detection", () => {
      it("detects Australian mobile number (04XX XXX XXX)", () => {
        const result = checkTextForPII("Call me on 0412 345 678");
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("phone_number");
      });

      it("detects Australian mobile number without spaces", () => {
        const result = checkTextForPII("My number is 0412345678");
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("phone_number");
      });

      it("detects Australian mobile with +61 prefix", () => {
        const result = checkTextForPII("Reach me at +61412345678");
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("phone_number");
      });

      it("detects Australian landline number (0X XXXX XXXX)", () => {
        const result = checkTextForPII("Home phone: 02 9876 5432");
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("phone_number");
      });

      it("detects Australian landline with brackets ((0X) XXXX XXXX)", () => {
        const result = checkTextForPII("Office: (02) 9876 5432");
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("phone_number");
      });

      it("detects 1300 numbers", () => {
        const result = checkTextForPII("Call 1300 123 456 for info");
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("phone_number");
      });

      it("detects 1800 numbers", () => {
        const result = checkTextForPII("Freecall 1800 654 321");
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("phone_number");
      });

      it("detects 13XX numbers", () => {
        const result = checkTextForPII("Dial 1345 67 for support");
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("phone_number");
      });

      it("detects phone number with dashes", () => {
        const result = checkTextForPII("My mobile: 0412-345-678");
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("phone_number");
      });

      it("detects phone number with dots", () => {
        const result = checkTextForPII("Phone: 0412.345.678");
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("phone_number");
      });
    });

    // ─── TFN Detection ───────────────────────────────────────────────────

    describe("TFN (Tax File Number) detection", () => {
      it("detects TFN with context keyword 'tfn'", () => {
        const result = checkTextForPII("My tfn is 123 456 789");
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("tax_file_number");
      });

      it("detects TFN with context keyword 'tax file number'", () => {
        const result = checkTextForPII(
          "My tax file number is 987 654 321"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("tax_file_number");
      });

      it("detects TFN with dashes", () => {
        const result = checkTextForPII("TFN: 123-456-789");
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("tax_file_number");
      });

      it("does not detect TFN-like numbers without context", () => {
        const result = checkTextForPII(
          "The reference number is 123 456 789"
        );
        // Without TFN context keywords, should not flag as TFN
        expect(result.detectedTypes).not.toContain("tax_file_number");
      });

      it("detects TFN with 'tax number' context", () => {
        const result = checkTextForPII(
          "Here is my tax number: 111 222 333"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("tax_file_number");
      });
    });

    // ─── Medicare Number Detection ───────────────────────────────────────

    describe("Medicare number detection", () => {
      it("detects Medicare number with context keyword 'medicare'", () => {
        const result = checkTextForPII(
          "My medicare number is 2123 45678 1"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("medicare_number");
      });

      it("detects Medicare number with 'health card' context", () => {
        const result = checkTextForPII(
          "Health card: 2123 45678 12"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("medicare_number");
      });

      it("does not detect Medicare-like numbers without context", () => {
        const result = checkTextForPII(
          "Order number 2123 45678 1 confirmed"
        );
        expect(result.detectedTypes).not.toContain("medicare_number");
      });
    });

    // ─── Credit Card Detection ───────────────────────────────────────────

    describe("credit card detection", () => {
      it("detects Visa card number", () => {
        const result = checkTextForPII(
          "My card is 4111 1111 1111 1111"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("credit_card");
      });

      it("detects Mastercard number", () => {
        const result = checkTextForPII(
          "Card: 5500 0000 0000 0004"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("credit_card");
      });

      it("detects Amex card number", () => {
        const result = checkTextForPII(
          "Amex: 3782 822463 10005"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("credit_card");
      });

      it("detects credit card with dashes", () => {
        const result = checkTextForPII(
          "Card number: 4111-1111-1111-1111"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("credit_card");
      });
    });

    // ─── Bank Account Detection ──────────────────────────────────────────

    describe("bank account detection", () => {
      it("detects BSB and account number with 'bsb' context", () => {
        const result = checkTextForPII(
          "My BSB is 062-000-12345678"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("bank_account");
      });

      it("detects bank account with 'bank account' context", () => {
        const result = checkTextForPII(
          "Bank account: 032-001-987654"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("bank_account");
      });

      it("detects bank account with 'account number' context", () => {
        const result = checkTextForPII(
          "Account number 062 000 12345678"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("bank_account");
      });

      it("does not detect BSB-like numbers without context", () => {
        const result = checkTextForPII(
          "Reference: 062-000-12345678"
        );
        expect(result.detectedTypes).not.toContain("bank_account");
      });
    });

    // ─── Passport Number Detection ───────────────────────────────────────

    describe("passport number detection", () => {
      it("detects Australian passport number with context", () => {
        const result = checkTextForPII(
          "My passport number is PA1234567"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("passport_number");
      });

      it("does not detect passport-like strings without context", () => {
        const result = checkTextForPII(
          "The code is PA1234567"
        );
        expect(result.detectedTypes).not.toContain("passport_number");
      });
    });

    // ─── Street Address Detection ────────────────────────────────────────

    describe("street address detection", () => {
      it("detects a street address with Street suffix", () => {
        const result = checkTextForPII(
          "I live at 42 Smith Street"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("street_address");
      });

      it("detects a street address with Road suffix", () => {
        const result = checkTextForPII(
          "My address is 123 Main Road"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("street_address");
      });

      it("detects a street address with Avenue suffix", () => {
        const result = checkTextForPII(
          "We're at 7 Park Avenue"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("street_address");
      });

      it("detects a street address with Drive suffix", () => {
        const result = checkTextForPII(
          "Located at 55 Sunset Drive"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("street_address");
      });

      it("detects a street address with abbreviated suffix", () => {
        const result = checkTextForPII(
          "Address: 10 George St"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("street_address");
      });

      it("detects a street address with Crescent suffix", () => {
        const result = checkTextForPII(
          "We live at 8 Elm Crescent"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("street_address");
      });
    });

    // ─── Date of Birth Detection ─────────────────────────────────────────

    describe("date of birth detection", () => {
      it("detects date of birth with 'date of birth' context", () => {
        const result = checkTextForPII(
          "My date of birth is 15/03/1990"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("date_of_birth");
      });

      it("detects DOB with 'dob' context", () => {
        const result = checkTextForPII("DOB: 25-12-1985");
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("date_of_birth");
      });

      it("detects DOB with 'born on' context", () => {
        const result = checkTextForPII(
          "I was born on 1.6.1992"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("date_of_birth");
      });

      it("detects DOB with month name and 'birthday' context", () => {
        const result = checkTextForPII(
          "My birthday is 5 March 1988"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("date_of_birth");
      });

      it("does not detect dates without DOB context", () => {
        const result = checkTextForPII(
          "The event is on 15/03/2025"
        );
        expect(result.detectedTypes).not.toContain("date_of_birth");
      });
    });

    // ─── PII Keyword Detection ───────────────────────────────────────────

    describe("PII keyword detection", () => {
      it("detects 'my address is' keyword", () => {
        const result = checkTextForPII(
          "My address is somewhere in Sydney"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("pii_keyword");
      });

      it("detects 'i live at' keyword", () => {
        const result = checkTextForPII(
          "I live at a place near the park"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("pii_keyword");
      });

      it("detects 'full name is' keyword", () => {
        const result = checkTextForPII(
          "My full name is John Smith"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("pii_keyword");
      });

      it("detects 'social security' keyword", () => {
        const result = checkTextForPII(
          "My social security number is important"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("pii_keyword");
      });

      it("detects 'home address' keyword", () => {
        const result = checkTextForPII(
          "Can I give you my home address?"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("pii_keyword");
      });
    });

    // ─── Multiple PII Types ─────────────────────────────────────────────

    describe("multiple PII types", () => {
      it("detects both email and phone number", () => {
        const result = checkTextForPII(
          "Email me at john@gmail.com or call 0412 345 678"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("email");
        expect(result.detectedTypes).toContain("phone_number");
      });

      it("detects email, phone, and address", () => {
        const result = checkTextForPII(
          "Contact john@gmail.com, call 0412 345 678, or visit 42 Smith Street"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("email");
        expect(result.detectedTypes).toContain("phone_number");
        expect(result.detectedTypes).toContain("street_address");
      });

      it("detects credit card and bank account together", () => {
        const result = checkTextForPII(
          "Card: 4111 1111 1111 1111, BSB: 062-000-12345678"
        );
        expect(result.hasPII).toBe(true);
        expect(result.detectedTypes).toContain("credit_card");
        expect(result.detectedTypes).toContain("bank_account");
      });
    });

    // ─── No PII Cases ───────────────────────────────────────────────────

    describe("no PII cases", () => {
      it("returns hasPII false for clean text", () => {
        const result = checkTextForPII(
          "Hi! I'm interested in the Aura community in Calleya. We're a young family with a budget around $500-550k."
        );
        expect(result.hasPII).toBe(false);
        expect(result.detectedTypes).toHaveLength(0);
      });

      it("returns hasPII false for empty string", () => {
        const result = checkTextForPII("");
        expect(result.hasPII).toBe(false);
        expect(result.detectedTypes).toHaveLength(0);
      });

      it("returns hasPII false for whitespace-only string", () => {
        const result = checkTextForPII("   ");
        expect(result.hasPII).toBe(false);
        expect(result.detectedTypes).toHaveLength(0);
      });

      it("returns hasPII false for typical DM inquiry", () => {
        const result = checkTextForPII(
          "Hello! My husband and I are first home buyers. We've been pre-approved for $620k and are interested in the Elara estate in Marsden Park. Do you have any 3-bed homes with a study?"
        );
        expect(result.hasPII).toBe(false);
      });

      it("returns hasPII false for DM with budget and location only", () => {
        const result = checkTextForPII(
          "Looking at Willowdale, budget under $400k. What's the rental yield?"
        );
        expect(result.hasPII).toBe(false);
      });

      it("returns hasPII false for DM with emojis and casual language", () => {
        const result = checkTextForPII(
          "Love what you're doing at Cloverton! 😍 Budget is around $700k for house and land. Are there any premium corner lots still available?"
        );
        expect(result.hasPII).toBe(false);
      });

      it("returns hasPII false for text with dollar amounts", () => {
        const result = checkTextForPII(
          "Budget is $500,000 to $550,000. Looking for 4-bedroom options."
        );
        expect(result.hasPII).toBe(false);
      });

      it("returns hasPII false for text with Instagram handles", () => {
        const result = checkTextForPII(
          "Follow me @sarah_m_designs on Instagram!"
        );
        expect(result.hasPII).toBe(false);
      });
    });

    // ─── Sanitized Content ───────────────────────────────────────────────

    describe("sanitized content", () => {
      it("returns sanitized content with email redacted", () => {
        const result = checkTextForPII(
          "Email me at john@gmail.com please"
        );
        expect(result.hasPII).toBe(true);
        expect(result.sanitizedContent).toContain("[REDACTED]");
        expect(result.sanitizedContent).not.toContain("john@gmail.com");
      });

      it("returns sanitized content with phone redacted", () => {
        const result = checkTextForPII(
          "Call me on 0412 345 678"
        );
        expect(result.hasPII).toBe(true);
        expect(result.sanitizedContent).toContain("[REDACTED]");
        expect(result.sanitizedContent).not.toContain("0412 345 678");
      });

      it("preserves original content in originalContent field", () => {
        const original = "Email me at john@gmail.com please";
        const result = checkTextForPII(original);
        expect(result.originalContent).toBe(original);
      });

      it("returns same text as sanitizedContent when no PII", () => {
        const text = "Hi, I'm interested in Elara!";
        const result = checkTextForPII(text);
        expect(result.sanitizedContent).toBe(text);
      });
    });
  });

  // ─── redactPII ───────────────────────────────────────────────────────────

  describe("redactPII", () => {
    it("redacts email addresses", () => {
      const result = redactPII("Contact john@gmail.com for details");
      expect(result).toContain("[REDACTED]");
      expect(result).not.toContain("john@gmail.com");
    });

    it("redacts phone numbers", () => {
      const result = redactPII("Call 0412 345 678 now");
      expect(result).toContain("[REDACTED]");
      expect(result).not.toContain("0412 345 678");
    });

    it("redacts credit card numbers", () => {
      const result = redactPII("Card: 4111 1111 1111 1111");
      expect(result).toContain("[REDACTED]");
      expect(result).not.toContain("4111 1111 1111 1111");
    });

    it("redacts street addresses", () => {
      const result = redactPII("I live at 42 Smith Street");
      expect(result).toContain("[REDACTED]");
      expect(result).not.toContain("42 Smith Street");
    });

    it("redacts multiple PII types in one text", () => {
      const result = redactPII(
        "Email john@gmail.com, call 0412 345 678, at 42 Smith Street"
      );
      expect(result).not.toContain("john@gmail.com");
      expect(result).not.toContain("0412 345 678");
      expect(result).not.toContain("42 Smith Street");
      // Should have multiple [REDACTED] placeholders
      const redactedCount = (result.match(/\[REDACTED\]/g) || []).length;
      expect(redactedCount).toBeGreaterThanOrEqual(3);
    });

    it("returns original text when no PII detected", () => {
      const text = "Hi! I'm interested in the Aura community.";
      const result = redactPII(text);
      expect(result).toBe(text);
    });

    it("returns empty string for empty input", () => {
      const result = redactPII("");
      expect(result).toBe("");
    });

    it("preserves non-PII content around redacted values", () => {
      const result = redactPII("Please email john@gmail.com for more info");
      expect(result).toContain("Please email");
      expect(result).toContain("for more info");
      expect(result).toContain("[REDACTED]");
    });

    it("redacts TFN when context keyword is present", () => {
      const result = redactPII("My TFN is 123 456 789");
      expect(result).toContain("[REDACTED]");
      expect(result).not.toContain("123 456 789");
    });

    it("redacts Medicare number when context keyword is present", () => {
      const result = redactPII("Medicare number: 2123 45678 1");
      expect(result).toContain("[REDACTED]");
      expect(result).not.toContain("2123 45678 1");
    });

    it("redacts BSB and account number when context keyword is present", () => {
      const result = redactPII("BSB: 062-000-12345678");
      expect(result).toContain("[REDACTED]");
      expect(result).not.toContain("062-000-12345678");
    });

    it("redacts passport number when context keyword is present", () => {
      const result = redactPII("My passport number is PA1234567");
      expect(result).toContain("[REDACTED]");
      expect(result).not.toContain("PA1234567");
    });

    it("redacts date of birth when context keyword is present", () => {
      const result = redactPII("My date of birth is 15/03/1990");
      expect(result).toContain("[REDACTED]");
      expect(result).not.toContain("15/03/1990");
    });
  });

  // ─── sanitizeForLLM ──────────────────────────────────────────────────────

  describe("sanitizeForLLM", () => {
    it("removes email addresses from text before sending to LLM", () => {
      const result = sanitizeForLLM(
        "Hi, my email is sarah@hotmail.com and I want a 3BR home"
      );
      expect(result).not.toContain("sarah@hotmail.com");
      expect(result).toContain("[REDACTED]");
      expect(result).toContain("3BR home");
    });

    it("removes phone numbers from text before sending to LLM", () => {
      const result = sanitizeForLLM(
        "Call me at 0412 345 678, I'm looking at Elara"
      );
      expect(result).not.toContain("0412 345 678");
      expect(result).toContain("[REDACTED]");
      expect(result).toContain("Elara");
    });

    it("removes all PII types from text before sending to LLM", () => {
      const result = sanitizeForLLM(
        "Email john@gmail.com, call 0412 345 678, visit 42 Smith Street. Budget $500k."
      );
      expect(result).not.toContain("john@gmail.com");
      expect(result).not.toContain("0412 345 678");
      expect(result).not.toContain("42 Smith Street");
      expect(result).toContain("$500k");
    });

    it("returns clean text unchanged", () => {
      const text =
        "I'm interested in the Aura community in Calleya. Budget around $500-550k.";
      const result = sanitizeForLLM(text);
      expect(result).toBe(text);
    });

    it("handles empty string", () => {
      const result = sanitizeForLLM("");
      expect(result).toBe("");
    });

    it("preserves property inquiry details while removing PII", () => {
      const result = sanitizeForLLM(
        "Hi! I'm Sarah, email sarah@yahoo.com. Looking for a 4-bed at Aura Calleya, budget $500-550k, move-in by March."
      );
      expect(result).not.toContain("sarah@yahoo.com");
      expect(result).toContain("4-bed");
      expect(result).toContain("Aura Calleya");
      expect(result).toContain("$500-550k");
      expect(result).toContain("March");
    });
  });

  // ─── isTextSafeForLLM ────────────────────────────────────────────────────

  describe("isTextSafeForLLM", () => {
    it("returns true for text without PII", () => {
      const result = isTextSafeForLLM(
        "Looking for a 3-bedroom home in Elara, budget $620k"
      );
      expect(result).toBe(true);
    });

    it("returns false for text with email", () => {
      const result = isTextSafeForLLM(
        "Contact me at john@gmail.com"
      );
      expect(result).toBe(false);
    });

    it("returns false for text with phone number", () => {
      const result = isTextSafeForLLM(
        "My number is 0412 345 678"
      );
      expect(result).toBe(false);
    });

    it("returns false for text with credit card", () => {
      const result = isTextSafeForLLM(
        "Card: 4111 1111 1111 1111"
      );
      expect(result).toBe(false);
    });

    it("returns false for text with street address", () => {
      const result = isTextSafeForLLM(
        "I live at 42 Smith Street"
      );
      expect(result).toBe(false);
    });

    it("returns true for empty string", () => {
      const result = isTextSafeForLLM("");
      expect(result).toBe(true);
    });

    it("returns true for typical DM content", () => {
      const result = isTextSafeForLLM(
        "Hey there, I saw your ad about the new land release at Willowdale. I'm an investor looking at blocks under $400k. What's the expected rental yield in that area?"
      );
      expect(result).toBe(true);
    });
  });

  // ─── validateDraftCompliance ──────────────────────────────────────────────

  describe("validateDraftCompliance", () => {
    it("returns compliant for clean draft content", () => {
      const result = validateDraftCompliance(
        "Hi Sarah! Thanks for your interest in Aura at Calleya. We have 4-bedroom options in your budget range. Would you like to visit our display village?"
      );
      expect(result.isCompliant).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it("returns non-compliant when draft contains email PII", () => {
      const result = validateDraftCompliance(
        "Hi Sarah! Please email us at sarah@personal.com to arrange a visit."
      );
      expect(result.isCompliant).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0]).toContain("PII detected");
    });

    it("returns non-compliant when draft contains phone PII", () => {
      const result = validateDraftCompliance(
        "Hi Sarah! Call us on 0412 345 678 to book a tour."
      );
      expect(result.isCompliant).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0]).toContain("PII detected");
    });

    it("returns non-compliant when draft contains street address", () => {
      const result = validateDraftCompliance(
        "Visit us at 42 Smith Street for a tour!"
      );
      expect(result.isCompliant).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it("returns non-compliant when draft exceeds 2000 characters", () => {
      const longContent = "A".repeat(2001);
      const result = validateDraftCompliance(longContent);
      expect(result.isCompliant).toBe(false);
      expect(result.issues).toContain(
        "Draft exceeds maximum length of 2000 characters."
      );
    });

    it("returns non-compliant when draft is empty", () => {
      const result = validateDraftCompliance("");
      expect(result.isCompliant).toBe(false);
      expect(result.issues).toContain("Draft content cannot be empty.");
    });

    it("returns non-compliant when draft is whitespace only", () => {
      const result = validateDraftCompliance("   ");
      expect(result.isCompliant).toBe(false);
      expect(result.issues).toContain("Draft content cannot be empty.");
    });

    it("returns multiple issues when draft has PII and exceeds length", () => {
      const longContentWithPII =
        "Contact john@gmail.com " + "A".repeat(2000);
      const result = validateDraftCompliance(longContentWithPII);
      expect(result.isCompliant).toBe(false);
      expect(result.issues.length).toBeGreaterThanOrEqual(2);
    });

    it("includes piiCheck result in the response", () => {
      const result = validateDraftCompliance(
        "Email john@gmail.com for details"
      );
      expect(result.piiCheck).toBeDefined();
      expect(result.piiCheck.hasPII).toBe(true);
      expect(result.piiCheck.detectedTypes).toContain("email");
    });

    it("returns compliant piiCheck when no PII in draft", () => {
      const result = validateDraftCompliance(
        "Hi Sarah! We'd love to help you explore Aura at Calleya."
      );
      expect(result.piiCheck).toBeDefined();
      expect(result.piiCheck.hasPII).toBe(false);
      expect(result.piiCheck.detectedTypes).toHaveLength(0);
    });

    it("returns compliant for draft at exactly 2000 characters", () => {
      const exactContent = "A".repeat(2000);
      const result = validateDraftCompliance(exactContent);
      // Should not have length issue (exactly at limit)
      const hasLengthIssue = result.issues.some((issue) =>
        issue.includes("exceeds maximum length")
      );
      expect(hasLengthIssue).toBe(false);
    });

    it("returns compliant for typical AI-generated draft", () => {
      const draft =
        "Hi Sarah! 👋 Thanks so much for your interest in Aura at Calleya — it's a beautiful community and perfect for young families!\n\nGreat news — we do have 4-bedroom options available in your budget range. For $500-550k, I'd recommend looking at our Aspire series which starts from $499k for a 4-bed, 2-bath home.\n\nRegarding your March timeline, we have several homes in the final stages of construction that could work. I'd love to arrange a time for you to visit our display village and chat with our sales team about what's available.\n\nWould Saturday or Sunday this week work for a visit? 🏡";
      const result = validateDraftCompliance(draft);
      expect(result.isCompliant).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  // ─── Edge Cases ──────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles null-like inputs gracefully for checkTextForPII", () => {
      // Empty string should not throw
      expect(() => checkTextForPII("")).not.toThrow();
    });

    it("handles very long text without crashing", () => {
      const longText = "This is a test. ".repeat(10000);
      expect(() => checkTextForPII(longText)).not.toThrow();
      const result = checkTextForPII(longText);
      expect(result.hasPII).toBe(false);
    });

    it("handles text with special characters", () => {
      const text = "Budget: $500k–$550k (AUD) — looking for 3BR 🏡✨";
      const result = checkTextForPII(text);
      expect(result.hasPII).toBe(false);
    });

    it("handles text with unicode characters", () => {
      const text = "こんにちは! Looking for a home at Elara. Budget $600k.";
      const result = checkTextForPII(text);
      expect(result.hasPII).toBe(false);
    });

    it("handles text with newlines and tabs", () => {
      const text =
        "Hi!\n\nI'm interested in Aura.\n\tBudget: $500k\n\nThanks!";
      const result = checkTextForPII(text);
      expect(result.hasPII).toBe(false);
    });

    it("does not flag social media handles as email", () => {
      const result = checkTextForPII(
        "Follow @sarah_m_designs on Instagram"
      );
      expect(result.hasPII).toBe(false);
    });

    it("does not flag dollar amounts as PII", () => {
      const result = checkTextForPII(
        "Budget is $500,000 to $1,000,000"
      );
      expect(result.hasPII).toBe(false);
    });

    it("does not flag community addresses from knowledge base as personal PII", () => {
      // Community display village addresses are public info, not personal PII
      // However, the pattern matcher may still detect them as street addresses
      // This test documents the current behavior
      const result = checkTextForPII(
        "Visit our display village at Elara Boulevard"
      );
      // "Elara Boulevard" doesn't match the address pattern (no street number)
      expect(result.detectedTypes).not.toContain("street_address");
    });

    it("handles text with only PII keywords but no actual PII values", () => {
      const result = checkTextForPII(
        "I don't want to share my home address or bank account details via DM"
      );
      expect(result.hasPII).toBe(true);
      expect(result.detectedTypes).toContain("pii_keyword");
      // Keywords are detected but no actual values are redacted
      // The sanitized content should still contain the text since keywords themselves aren't redacted
    });

    it("redactPII does not redact PII keyword text itself", () => {
      const text = "I don't want to share my home address via DM";
      const result = redactPII(text);
      // PII keywords are contextual triggers, not values to redact
      // The text should remain unchanged since there are no actual PII values
      expect(result).toBe(text);
    });

    it("handles mixed case PII keywords", () => {
      const result = checkTextForPII(
        "My Home Address is somewhere private"
      );
      expect(result.hasPII).toBe(true);
      expect(result.detectedTypes).toContain("pii_keyword");
    });

    it("handles drivers licence context detection", () => {
      const result = checkTextForPII(
        "My drivers licence number is AB12345"
      );
      expect(result.hasPII).toBe(true);
      expect(result.detectedTypes).toContain("drivers_licence");
    });

    it("does not flag drivers licence pattern without context", () => {
      const result = checkTextForPII(
        "Reference code: AB12345"
      );
      expect(result.detectedTypes).not.toContain("drivers_licence");
    });
  });

  // ─── Deduplication ─────────────────────────────────────────────────────

  describe("deduplication", () => {
    it("does not duplicate detected types for same PII type appearing multiple times", () => {
      const result = checkTextForPII(
        "Email john@gmail.com or jane@yahoo.com"
      );
      expect(result.hasPII).toBe(true);
      // detectedTypes should contain "email" only once
      const emailCount = result.detectedTypes.filter(
        (t) => t === "email"
      ).length;
      expect(emailCount).toBe(1);
    });

    it("does not duplicate detected types for same phone pattern", () => {
      const result = checkTextForPII(
        "Call 0412 345 678 or 0498 765 432"
      );
      expect(result.hasPII).toBe(true);
      const phoneCount = result.detectedTypes.filter(
        (t) => t === "phone_number"
      ).length;
      expect(phoneCount).toBe(1);
    });
  });

  // ─── Real-World DM Scenarios ───────────────────────────────────────────

  describe("real-world DM scenarios", () => {
    it("handles Sarah M. DM (no PII expected)", () => {
      const result = checkTextForPII(
        "Hi! I've been looking at the Aura community in Calleya. We're a young family with a budget around $500-550k. Could you tell me more about the 4-bedroom options and what's available for move-in by March? We're currently renting in Cockburn and really love the area."
      );
      expect(result.hasPII).toBe(false);
    });

    it("handles James M. DM (no PII expected)", () => {
      const result = checkTextForPII(
        "Hey there, I saw your ad about the new land release at Willowdale. I'm an investor looking at blocks under $400k. What's the expected rental yield in that area? Also interested in any house and land packages you might have."
      );
      expect(result.hasPII).toBe(false);
    });

    it("handles Priya B. DM (no PII expected)", () => {
      const result = checkTextForPII(
        "Hello! My husband and I are first home buyers. We've been pre-approved for $620k and are interested in the Elara estate in Marsden Park. Do you have any 3-bed homes with a study? We both work from home. When is the next display home open day?"
      );
      expect(result.hasPII).toBe(false);
    });

    it("handles Tom R. DM (no PII expected)", () => {
      const result = checkTextForPII(
        "Just wondering about the retirement living options at Cardinal Freeman. My mum is looking to downsize from her 4-bed house. She'd want a 2-bed unit with parking. Budget is flexible but probably around $800k-1M. Is there a waitlist?"
      );
      expect(result.hasPII).toBe(false);
    });

    it("handles Anika J. DM (no PII expected)", () => {
      const result = checkTextForPII(
        "Love what you're doing at Cloverton! 😍 We're thinking of building our dream home there. Budget is around $700k for house and land. Are there any premium corner lots still available? We want north-facing if possible. Happy to chat more!"
      );
      expect(result.hasPII).toBe(false);
    });

    it("flags DM with personal email included", () => {
      const result = checkTextForPII(
        "Hi! I'm interested in Elara. My email is sarah.jones@hotmail.com. Budget is $600k."
      );
      expect(result.hasPII).toBe(true);
      expect(result.detectedTypes).toContain("email");
    });

    it("flags DM with personal phone included", () => {
      const result = checkTextForPII(
        "Looking at Aura Calleya. Call me on 0412 987 654 to discuss. Budget $500k."
      );
      expect(result.hasPII).toBe(true);
      expect(result.detectedTypes).toContain("phone_number");
    });

    it("flags DM with home address included", () => {
      const result = checkTextForPII(
        "We currently live at 15 Oak Avenue in Cockburn. Looking to move to Aura."
      );
      expect(result.hasPII).toBe(true);
      expect(result.detectedTypes).toContain("street_address");
    });

    it("correctly sanitizes DM with PII for LLM consumption", () => {
      const original =
        "Hi! Email me at sarah@hotmail.com or call 0412 987 654. I'm looking at Elara, budget $620k.";
      const sanitized = sanitizeForLLM(original);
      expect(sanitized).not.toContain("sarah@hotmail.com");
      expect(sanitized).not.toContain("0412 987 654");
      expect(sanitized).toContain("Elara");
      expect(sanitized).toContain("$620k");
    });
  });
});