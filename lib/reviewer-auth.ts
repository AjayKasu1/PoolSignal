import { env } from "cloudflare:workers";
import { constantTimeEqual, extractBearerToken, tokenLengthIsValid } from "./credential-security";

export function reviewerAuthorization(request: Request): { configured: boolean; authorized: boolean } {
  const reviewerToken = (env as unknown as { REVIEWER_TOKEN?: string }).REVIEWER_TOKEN?.trim();
  if (!reviewerToken || !tokenLengthIsValid(reviewerToken)) return { configured: false, authorized: false };

  const authorization = request.headers.get("authorization") ?? "";
  const suppliedToken = extractBearerToken(authorization);
  if (!tokenLengthIsValid(suppliedToken)) return { configured: true, authorized: false };
  return { configured: true, authorized: constantTimeEqual(suppliedToken, reviewerToken) };
}
