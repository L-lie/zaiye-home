export const YUCANG_PROFILE_ORIGINS = new Set([
  "https://zaiye.art",
  "chrome-extension://fapladhajicfoiadhcpmbmfkodekkckg",
  "chrome-extension://idiemjhonlahnlnalpanhplbgjcfbpnl",
]);

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export class ProfileError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function validateDisplayName(value: unknown) {
  if (typeof value !== "string") throw new ProfileError(422, "invalid_display_name", "Display name is required.");
  const name = value.trim();
  if (name.length < 1 || name.length > 40) {
    throw new ProfileError(422, "invalid_display_name", "Display name must contain 1 to 40 characters.");
  }
  return name;
}

export function detectAvatarMime(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", extension: "jpg" };
  }
  if (
    bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return { mime: "image/png", extension: "png" };
  }
  if (
    bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return { mime: "image/webp", extension: "webp" };
  }
  throw new ProfileError(422, "invalid_avatar_type", "Avatar must be a real JPEG, PNG, or WebP image.");
}

export function profileCorsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
