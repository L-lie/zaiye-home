export const FRIEND_GROUP_ORIGINS = new Set([
  "https://zaiye.art",
  "chrome-extension://fapladhajicfoiadhcpmbmfkodekkckg",
  "chrome-extension://idiemjhonlahnlnalpanhplbgjcfbpnl",
]);

export class FriendGroupError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function exactObject(value: unknown, allowed: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new FriendGroupError(400, "invalid_request", "A JSON object is required.");
  }
  const item = value as Record<string, unknown>;
  if (Object.keys(item).some((key) => !allowed.includes(key))) {
    throw new FriendGroupError(422, "unknown_field", "The request contains an unsupported field.");
  }
  return item;
}

export function requiredString(value: unknown, code: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new FriendGroupError(422, code, "A required value is invalid.");
  }
  return value.trim();
}

export function uuid(value: unknown, code: string) {
  const item = requiredString(value, code, 64);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item)) {
    throw new FriendGroupError(422, code, "A required identifier is invalid.");
  }
  return item;
}

export function email(value: unknown) {
  const item = requiredString(value, "invalid_email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)) {
    throw new FriendGroupError(422, "invalid_email", "The email address is invalid.");
  }
  return item;
}

