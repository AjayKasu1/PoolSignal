import { env } from "cloudflare:workers";

const encoder = new TextEncoder();

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

export function reviewerAuthorization(request: Request): { configured: boolean; authorized: boolean } {
  const reviewerToken = (env as unknown as { REVIEWER_TOKEN?: string }).REVIEWER_TOKEN?.trim();
  if (!reviewerToken) return { configured: false, authorized: false };

  const authorization = request.headers.get("authorization") ?? "";
  const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  return { configured: true, authorized: constantTimeEqual(suppliedToken, reviewerToken) };
}
