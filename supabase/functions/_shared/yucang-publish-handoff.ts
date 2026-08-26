export const YUCANG_WEB_ORIGIN = "https://zaiye.art";
export const PUBLICATION_MODES = ["private", "free_public", "paid"] as const;

export class HandoffError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/;
const CONTENT_TYPES = new Set(["image", "video", "text_office", "programming"]);
const LICENSES = new Set(["personal", "commercial", "commercial_client"]);
const FORBIDDEN_KEYS = ["apikey", "secret", "token", "password", "authorization", "accesstoken", "refreshtoken", "clientsecret"];

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, allowed: string[], label: string) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new HandoffError(422, "invalid_payload", `${label} contains unsupported fields.`);
}

function rejectCredentialFields(value: unknown, label = "content") {
  if (Array.isArray(value)) return value.forEach((item, index) => rejectCredentialFields(item, `${label}[${index}]`));
  if (!object(value)) return;
  for (const [key, item] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (FORBIDDEN_KEYS.some((blocked) => normalized === blocked || normalized.startsWith(blocked) || normalized.endsWith(blocked))) {
      throw new HandoffError(422, "sensitive_field_not_allowed", `${label}.${key} is not allowed.`);
    }
    rejectCredentialFields(item, `${label}.${key}`);
  }
}

function safeStructuredLocation(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^(data|file):/i.test(trimmed) || /^[a-z]:[\\/]/i.test(trimmed) || /^\\\\/.test(trimmed) || /^\/(?!\/)/.test(trimmed)) {
    throw new HandoffError(422, "unsafe_location", `${label} must not reference inline data or a local file path.`);
  }
  let url: URL;
  try { url = new URL(trimmed); } catch { throw new HandoffError(422, "unsafe_location", `${label} must be an absolute HTTP(S) URL.`); }
  const hostname = url.hostname.toLowerCase();
  if (!/^https?:$/.test(url.protocol) || hostname === "localhost" || hostname.endsWith(".localhost") || /^127\./.test(hostname) || ["::1", "[::1]"].includes(hostname)) {
    throw new HandoffError(422, "unsafe_location", `${label} must be a non-local HTTP(S) URL.`);
  }
  return trimmed;
}

function requiredString(value: unknown, max: number, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new HandoffError(422, "invalid_payload", `${label} is required and must be at most ${max} characters.`);
  }
  return value;
}

function optionalString(value: unknown, max: number, label: string): string {
  if (value == null) return "";
  if (typeof value !== "string" || value.length > max) {
    throw new HandoffError(422, "invalid_payload", `${label} must be at most ${max} characters.`);
  }
  return value;
}

function simpleObject(value: unknown, label: string): Record<string, unknown> {
  if (!object(value)) throw new HandoffError(422, "invalid_payload", `${label} must be an object.`);
  if (Object.keys(value).length > 50) throw new HandoffError(422, "invalid_payload", `${label} has too many fields.`);
  for (const item of Object.values(value)) {
    if (item !== null && !["string", "number", "boolean"].includes(typeof item)) {
      throw new HandoffError(422, "invalid_payload", `${label} values must be scalar.`);
    }
  }
  return value;
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (object(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function validateHandoffBody(input: unknown) {
  if (!object(input)) throw new HandoffError(400, "invalid_request", "A JSON object is required.");
  exactKeys(input, ["protocolVersion", "requestId", "handoffId", "publicationMode", "targetWorkId", "payloadHash", "content"], "request");
  if (input.protocolVersion !== 1) throw new HandoffError(422, "unsupported_protocol", "protocolVersion must be 1.");
  if (typeof input.requestId !== "string" || !UUID.test(input.requestId)) throw new HandoffError(422, "invalid_request", "requestId must be a UUID.");
  if (typeof input.handoffId !== "string" || !UUID.test(input.handoffId)) throw new HandoffError(422, "invalid_request", "handoffId must be a UUID.");
  if (!PUBLICATION_MODES.includes(input.publicationMode as typeof PUBLICATION_MODES[number])) {
    throw new HandoffError(422, "invalid_publication_mode", "publicationMode is invalid.");
  }
  if (input.publicationMode === "private") throw new HandoffError(422, "private_stays_in_vault", "Private content stays in Prompt Vault and is not uploaded.");
  if (input.publicationMode === "paid") throw new HandoffError(422, "paid_not_available", "Paid publication is not available in this MVP.");
  if (input.targetWorkId !== null && (typeof input.targetWorkId !== "string" || !UUID.test(input.targetWorkId))) {
    throw new HandoffError(422, "invalid_request", "targetWorkId must be null or a UUID.");
  }
  if (typeof input.payloadHash !== "string" || !HASH.test(input.payloadHash)) throw new HandoffError(422, "invalid_payload_hash", "payloadHash must be a lowercase SHA-256 hex value.");
  if (!object(input.content)) throw new HandoffError(422, "invalid_payload", "content must be an object.");
  const content = input.content;
  rejectCredentialFields(content);
  exactKeys(content, ["title", "summary", "contentType", "prompt", "negativePrompt", "variables", "model", "parameters", "dependencies", "tags", "licenseCode", "instructions", "images"], "content");

  const images = content.images ?? [];
  if (!Array.isArray(images)) throw new HandoffError(422, "invalid_payload", "images must be an array.");
  if (images.length) throw new HandoffError(422, "media_not_supported_yet", "Media handoff is not supported yet.");
  const computedHash = await sha256Hex(stableStringify(content));
  if (computedHash !== input.payloadHash) throw new HandoffError(409, "payload_hash_mismatch", "payloadHash does not match the canonical content.");
  if (!CONTENT_TYPES.has(String(content.contentType))) throw new HandoffError(422, "invalid_payload", "contentType is invalid.");
  if (!LICENSES.has(String(content.licenseCode))) throw new HandoffError(422, "invalid_payload", "licenseCode is invalid.");

  const variables = content.variables ?? [];
  if (!Array.isArray(variables) || variables.length > 50) throw new HandoffError(422, "invalid_payload", "variables must contain at most 50 items.");
  const normalizedVariables = variables.map((item, index) => {
    if (!object(item)) throw new HandoffError(422, "invalid_payload", `variables[${index}] must be an object.`);
    exactKeys(item, ["name", "defaultValue", "description"], `variables[${index}]`);
    return {
      name: requiredString(item.name, 80, `variables[${index}].name`).trim(),
      defaultValue: optionalString(item.defaultValue, 2000, `variables[${index}].defaultValue`),
      description: optionalString(item.description, 500, `variables[${index}].description`),
    };
  });
  if (new Set(normalizedVariables.map((item) => item.name)).size !== normalizedVariables.length) {
    throw new HandoffError(422, "invalid_payload", "Variable names must be unique.");
  }

  const model = content.model ?? {};
  if (!object(model)) throw new HandoffError(422, "invalid_payload", "model must be an object.");
  exactKeys(model, ["name", "version"], "model");
  const dependencies = content.dependencies ?? [];
  if (!Array.isArray(dependencies) || dependencies.length > 20) throw new HandoffError(422, "invalid_payload", "dependencies must contain at most 20 items.");
  const normalizedDependencies = dependencies.map((item, index) => {
    if (!object(item)) throw new HandoffError(422, "invalid_payload", `dependencies[${index}] must be an object.`);
    exactKeys(item, ["kind", "name", "version", "url", "notes"], `dependencies[${index}]`);
    return {
      kind: optionalString(item.kind, 80, `dependencies[${index}].kind`),
      name: requiredString(item.name, 160, `dependencies[${index}].name`).trim(),
      version: optionalString(item.version, 120, `dependencies[${index}].version`),
      url: safeStructuredLocation(optionalString(item.url, 1000, `dependencies[${index}].url`), `dependencies[${index}].url`),
      notes: optionalString(item.notes, 1000, `dependencies[${index}].notes`),
    };
  });
  const tags = content.tags ?? [];
  if (!Array.isArray(tags) || tags.length > 20 || tags.some((tag) => typeof tag !== "string" || !tag.trim() || tag.length > 40)) {
    throw new HandoffError(422, "invalid_payload", "tags must contain at most 20 non-empty strings of 40 characters or less.");
  }

  const parameters = simpleObject(content.parameters ?? {}, "parameters");
  for (const [key, value] of Object.entries(parameters)) {
    if (/(^|[_-])(url|uri|path)($|[_-])/i.test(key) && typeof value === "string" && value.trim()) safeStructuredLocation(value, `parameters.${key}`);
  }
  const normalizedContent = {
    title: requiredString(content.title, 120, "title").trim(),
    summary: optionalString(content.summary, 300, "summary").trim(),
    contentType: String(content.contentType),
    prompt: requiredString(content.prompt, 50000, "prompt"),
    negativePrompt: optionalString(content.negativePrompt, 20000, "negativePrompt"),
    variables: normalizedVariables,
    model: {
      name: optionalString(model.name, 120, "model.name").trim(),
      version: optionalString(model.version, 120, "model.version").trim(),
    },
    parameters,
    dependencies: normalizedDependencies,
    tags: [...new Set((tags as string[]).map((tag) => tag.trim()))],
    licenseCode: String(content.licenseCode),
    instructions: optionalString(content.instructions, 10000, "instructions"),
    images: [],
  };
  return {
    protocolVersion: 1,
    requestId: input.requestId,
    handoffId: input.handoffId,
    publicationMode: "free_public" as const,
    targetWorkId: input.targetWorkId as string | null,
    payloadHash: input.payloadHash,
    content: normalizedContent,
  };
}
