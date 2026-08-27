export const YUCANG_FEEDBACK_ORIGINS = new Set([
  "https://zaiye.art",
  "chrome-extension://fapladhajicfoiadhcpmbmfkodekkckg",
  "chrome-extension://idiemjhonlahnlnalpanhplbgjcfbpnl",
]);

export class FeedbackError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

const TYPES = new Set(["bug", "suggestion", "experience", "other"]);
const KEYS = new Set([
  "requestId", "type", "title", "description", "reproductionSteps",
  "expectedResult", "extensionVersion", "surface", "locale",
]);

function text(value: unknown, name: string, min: number, max: number) {
  if (typeof value !== "string") throw new FeedbackError(422, "invalid_payload", `${name} must be text.`);
  const clean = value.trim();
  if (clean.length < min || clean.length > max) {
    throw new FeedbackError(422, "invalid_payload", `${name} has an invalid length.`);
  }
  return clean;
}

export function validateFeedbackBody(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new FeedbackError(422, "invalid_payload", "Feedback must be a JSON object.");
  }
  const item = raw as Record<string, unknown>;
  if (Object.keys(item).some((key) => !KEYS.has(key))) {
    throw new FeedbackError(422, "invalid_payload", "Feedback contains an unsupported field.");
  }
  const requestId = text(item.requestId, "requestId", 36, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    throw new FeedbackError(422, "invalid_request_id", "requestId must be a UUID.");
  }
  const type = text(item.type, "type", 1, 32);
  if (!TYPES.has(type)) throw new FeedbackError(422, "invalid_feedback_type", "Unsupported feedback type.");
  return {
    requestId,
    type,
    title: text(item.title, "title", 1, 120),
    description: text(item.description, "description", 1, 4000),
    reproductionSteps: text(item.reproductionSteps ?? "", "reproductionSteps", 0, 3000),
    expectedResult: text(item.expectedResult ?? "", "expectedResult", 0, 2000),
    extensionVersion: text(item.extensionVersion, "extensionVersion", 1, 40),
    surface: text(item.surface, "surface", 1, 64),
    locale: text(item.locale, "locale", 1, 32),
  };
}

export function feedbackCorsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export async function feedbackHash(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map((item) => item.toString(16).padStart(2, "0")).join("");
}
