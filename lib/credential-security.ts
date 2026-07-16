const encoder = new TextEncoder();

export const MIN_REVIEWER_TOKEN_BYTES = 32;
export const MAX_REVIEWER_TOKEN_BYTES = 256;

export function tokenLengthIsValid(value: string): boolean {
  const length = encoder.encode(value).byteLength;
  return length >= MIN_REVIEWER_TOKEN_BYTES && length <= MAX_REVIEWER_TOKEN_BYTES;
}

export function extractBearerToken(authorization: string): string {
  return authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
}

export function constantTimeEqual(actual: string, expected: string): boolean {
  const left = encoder.encode(actual);
  const right = encoder.encode(expected);
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }

  return difference === 0;
}
