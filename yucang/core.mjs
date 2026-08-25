export const LICENSE_LABELS = Object.freeze({
  personal: "仅个人使用",
  commercial: "允许商业使用",
  commercial_client: "允许商业使用及客户项目",
});

export const CONTENT_TYPE_LABELS = Object.freeze({
  image: "图像",
  video: "视频",
  text_office: "文字与办公",
  programming: "编程",
});

export function normalizeVariables(value) {
  if (!Array.isArray(value)) return [];
  const names = new Set();
  return value
    .map((item) => ({
      name: String(item?.name || "").trim(),
      defaultValue: String(item?.defaultValue ?? item?.default ?? "").trim(),
      description: String(item?.description || "").trim(),
    }))
    .filter((item) => item.name && !names.has(item.name) && names.add(item.name));
}

export function parseKeyValueLines(value) {
  const result = {};
  String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const index = line.search(/[:=：]/);
      if (index < 1) return;
      const key = line.slice(0, index).trim();
      const itemValue = line.slice(index + 1).trim();
      if (key) result[key] = itemValue;
    });
  return result;
}

export function formatKeyValueLines(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return Object.entries(value)
    .map(([key, itemValue]) => `${key}=${itemValue ?? ""}`)
    .join("\n");
}

export function parseTags(value) {
  return [...new Set(
    String(value || "")
      .split(/[,，\n]/)
      .map((item) => item.trim())
      .filter(Boolean),
  )].slice(0, 20);
}

export function renderPromptTemplate(template, variables, values = {}) {
  const normalized = normalizeVariables(variables);
  const replacements = new Map(
    normalized.map((item) => [item.name, String(values[item.name] ?? item.defaultValue)]),
  );
  const braceRendered = String(template || "").replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, rawName) => {
    const name = String(rawName).trim();
    return replacements.has(name) ? replacements.get(name) : match;
  });
  return [...normalized].sort((a, b) => b.name.length - a.name.length).reduce((result, item) => {
    const escapedName = item.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return result.replace(new RegExp(`@${escapedName}`, "g"), replacements.get(item.name));
  }, braceRendered);
}

export function snapshotToViewModel(snapshot = {}) {
  return {
    work_id: snapshot.workId || snapshot.work_id || "",
    version_id: snapshot.versionId || snapshot.version_id || "",
    version_no: Number(snapshot.versionNo || snapshot.version_no || 0),
    title: snapshot.title || "",
    summary: snapshot.summary || "",
    content_type: snapshot.contentType || snapshot.content_type || "image",
    prompt_text: snapshot.prompt || snapshot.prompt_text || "",
    variables: normalizeVariables(snapshot.variables),
    model_name: snapshot.model || snapshot.model_name || "",
    model_version: snapshot.modelVersion || snapshot.model_version || "",
    parameters: snapshot.parameters || {},
    tags: Array.isArray(snapshot.tags) ? snapshot.tags : [],
    license_code: snapshot.licenseCode || snapshot.license_code || "personal",
    author_nickname: snapshot.authorNickname || snapshot.author_nickname || "",
  };
}
