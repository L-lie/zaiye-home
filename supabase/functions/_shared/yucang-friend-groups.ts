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

const SHARE_MEDIA_ITEM_LIMIT = 4;
const SHARE_MEDIA_ITEM_BYTES = 5 * 1024 * 1024;
const SHARE_MEDIA_TOTAL_BYTES = 10 * 1024 * 1024;

function decodeShareImage(value: string, label: string) {
  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=]+)$/i);
  if (!match) throw new FriendGroupError(422, "invalid_media", `${label} must be an embedded JPEG, PNG, or WebP image.`);
  let binary = "";
  try { binary = atob(match[2]); } catch {
    throw new FriendGroupError(422, "invalid_media", `${label} is not valid base64.`);
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (!bytes.length || bytes.length > SHARE_MEDIA_ITEM_BYTES) {
    throw new FriendGroupError(422, "media_too_large", `${label} must be between 1 byte and 5 MB.`);
  }
  const png = bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((item, index) => bytes[index] === item);
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const webp = bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  const actualMime = png ? "image/png" : jpeg ? "image/jpeg" : webp ? "image/webp" : "";
  if (!actualMime || actualMime !== match[1].toLowerCase()) {
    throw new FriendGroupError(422, "invalid_media", `${label} must contain real image bytes matching its MIME type.`);
  }
  return bytes.length;
}

export function shareMedia(value: { image?: unknown; examples?: unknown; references?: unknown }) {
  const image = value.image == null || value.image === "" ? "" : value.image;
  if (typeof image !== "string") throw new FriendGroupError(422, "invalid_media", "image must be an embedded image.");
  const examples = value.examples ?? [];
  const references = value.references ?? [];
  if (!Array.isArray(examples) || !Array.isArray(references)) {
    throw new FriendGroupError(422, "invalid_media", "examples and references must be arrays.");
  }
  const items = [
    ...(image ? [{ value: image, label: "image" }] : []),
    ...examples.map((item, index) => ({ value: item, label: `examples[${index}]` })),
    ...references.map((item, index) => ({ value: item, label: `references[${index}]` })),
  ];
  if (items.length > SHARE_MEDIA_ITEM_LIMIT) {
    throw new FriendGroupError(422, "too_many_media", `A shared Prompt may contain at most ${SHARE_MEDIA_ITEM_LIMIT} images.`);
  }
  let totalBytes = 0;
  for (const item of items) {
    if (typeof item.value !== "string") throw new FriendGroupError(422, "invalid_media", `${item.label} must be an embedded image.`);
    totalBytes += decodeShareImage(item.value, item.label);
  }
  if (totalBytes > SHARE_MEDIA_TOTAL_BYTES) {
    throw new FriendGroupError(422, "media_too_large", "Combined shared images must not exceed 10 MB.");
  }
  return { image, examples, references };
}

