import assert from "node:assert/strict";
import test from "node:test";

import {
  constantTimeEqual,
  extractBearerToken,
  tokenLengthIsValid,
} from "../lib/credential-security.ts";

test("reviewer credentials enforce bounded byte length", () => {
  assert.equal(tokenLengthIsValid("a".repeat(31)), false);
  assert.equal(tokenLengthIsValid("a".repeat(32)), true);
  assert.equal(tokenLengthIsValid("a".repeat(256)), true);
  assert.equal(tokenLengthIsValid("a".repeat(257)), false);
  assert.equal(tokenLengthIsValid("é".repeat(16)), true);
});

test("reviewer credentials require a bearer scheme and exact secret", () => {
  const secret = "0123456789abcdef0123456789abcdef";
  assert.equal(extractBearerToken(`Bearer ${secret}`), secret);
  assert.equal(extractBearerToken(`bearer ${secret}`), secret);
  assert.equal(extractBearerToken(`Basic ${secret}`), "");
  assert.equal(constantTimeEqual(secret, secret), true);
  assert.equal(constantTimeEqual(secret, `${secret}x`), false);
  assert.equal(constantTimeEqual(secret, "x".repeat(secret.length)), false);
});
