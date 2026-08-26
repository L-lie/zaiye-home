const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const tr = (locale, zh, en) => locale === "en" ? en : zh;

export function normalizeProfile(value, fallback = {}) {
  const row = Array.isArray(value) ? value[0] : value;
  return {
    nickname: String(row?.nickname || fallback.nickname || "").trim(),
    avatarUrl: String(row?.avatar_url || fallback.avatarUrl || "").trim(),
  };
}

export async function loadAccountProfile(client, fallback = {}) {
  const { data, error } = await client.rpc("yucang_get_my_profile");
  if (error) throw error;
  return normalizeProfile(data, fallback);
}

export async function prepareAvatar(file) {
  if (!(file instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("avatar_type");
  }
  if (file.size > MAX_AVATAR_BYTES) throw new Error("avatar_size");
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(512, side);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { alpha: false });
  context.drawImage(
    bitmap,
    Math.floor((bitmap.width - side) / 2),
    Math.floor((bitmap.height - side) / 2),
    side,
    side,
    0,
    0,
    size,
    size,
  );
  bitmap.close();
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("avatar_encode")), "image/webp", .88);
  });
  if (blob.size > MAX_AVATAR_BYTES) throw new Error("avatar_size");
  return new File([blob], "avatar.webp", { type: "image/webp" });
}

export function profileAvatarMarkup(profile, locale = "zh", size = "normal") {
  if (profile?.avatarUrl) {
    return `<img class="account-avatar ${escapeHtml(size)}" src="${escapeHtml(profile.avatarUrl)}" alt="${tr(locale, "账号头像", "Account avatar")}" />`;
  }
  const initial = String(profile?.nickname || tr(locale, "语", "Y")).trim().slice(0, 1).toUpperCase();
  return `<span class="account-avatar fallback ${escapeHtml(size)}" aria-hidden="true">${escapeHtml(initial)}</span>`;
}

export async function openAccountProfileEditor({ client, endpoint, locale = "zh", profile, onSaved }) {
  document.querySelector("[data-profile-dialog]")?.remove();
  const root = document.createElement("div");
  root.className = "profile-dialog-layer";
  root.dataset.profileDialog = "";
  root.innerHTML = `
    <button class="profile-dialog-backdrop" type="button" data-profile-close aria-label="${tr(locale, "关闭账号资料", "Close account profile")}"></button>
    <section class="profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-dialog-title">
      <button class="profile-dialog-close" type="button" data-profile-close aria-label="${tr(locale, "关闭", "Close")}">×</button>
      <p class="eyebrow">ACCOUNT PROFILE</p>
      <h2 id="profile-dialog-title">${tr(locale, "编辑账号资料", "Edit account profile")}</h2>
      <p class="profile-dialog-copy">${tr(locale, "昵称和头像会同步显示在语藏网站与 Prompt Vault 扩展中。", "Your nickname and avatar are shared by Yucang and the Prompt Vault extension.")}</p>
      <form data-profile-form>
        <div class="profile-avatar-editor">
          <div data-profile-avatar-preview>${profileAvatarMarkup(profile, locale, "large")}</div>
          <label class="button" for="profile-avatar-input">${tr(locale, "选择头像", "Choose avatar")}</label>
          <input id="profile-avatar-input" type="file" accept="image/jpeg,image/png,image/webp" data-profile-avatar />
          <small>${tr(locale, "JPEG、PNG 或 WebP，最大 2MB；保存时自动裁为正方形。", "JPEG, PNG, or WebP up to 2 MB; cropped to a square when saved.")}</small>
        </div>
        <label class="field">
          <span>${tr(locale, "昵称", "Nickname")}</span>
          <input name="nickname" required minlength="1" maxlength="40" value="${escapeHtml(profile?.nickname || "")}" autocomplete="nickname" />
        </label>
        <p class="profile-form-status" data-profile-status aria-live="polite"></p>
        <div class="profile-dialog-actions">
          <button class="button" type="button" data-profile-close>${tr(locale, "取消", "Cancel")}</button>
          <button class="button primary" type="submit" data-profile-save>${tr(locale, "保存", "Save")}</button>
        </div>
      </form>
    </section>`;
  document.body.append(root);
  const close = () => root.remove();
  root.querySelectorAll("[data-profile-close]").forEach((button) => button.addEventListener("click", close));
  const form = root.querySelector("[data-profile-form]");
  const fileInput = root.querySelector("[data-profile-avatar]");
  const preview = root.querySelector("[data-profile-avatar-preview]");
  const status = root.querySelector("[data-profile-status]");
  const save = root.querySelector("[data-profile-save]");
  let preparedFile = null;

  fileInput.addEventListener("change", async () => {
    status.textContent = "";
    preparedFile = null;
    const selected = fileInput.files?.[0];
    if (!selected) return;
    try {
      preparedFile = await prepareAvatar(selected);
      const previewUrl = URL.createObjectURL(preparedFile);
      preview.innerHTML = `<img class="account-avatar large" src="${escapeHtml(previewUrl)}" alt="${tr(locale, "新头像预览", "New avatar preview")}" />`;
    } catch (error) {
      status.textContent = error.message === "avatar_size"
        ? tr(locale, "头像不能超过 2MB。", "Avatar must not exceed 2 MB.")
        : tr(locale, "请选择有效的 JPEG、PNG 或 WebP 图片。", "Choose a valid JPEG, PNG, or WebP image.");
      fileInput.value = "";
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const nickname = form.elements.nickname.value.trim();
    if (!nickname || nickname.length > 40) return;
    save.disabled = true;
    status.textContent = tr(locale, "正在保存…", "Saving…");
    try {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError || !sessionData.session) throw new Error("session_required");
      const body = new FormData();
      body.set("displayName", nickname);
      if (preparedFile) body.set("avatar", preparedFile);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        body,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.error || "profile_update_failed");
      const saved = { nickname: payload.profile.displayName, avatarUrl: payload.profile.avatarUrl };
      status.textContent = tr(locale, "已保存。", "Saved.");
      await onSaved?.(saved);
      setTimeout(close, 280);
    } catch (error) {
      const labels = {
        avatar_too_large: tr(locale, "头像不能超过 2MB。", "Avatar must not exceed 2 MB."),
        invalid_avatar_type: tr(locale, "图片内容不是有效的 JPEG、PNG 或 WebP。", "The file is not a valid JPEG, PNG, or WebP image."),
        avatar_mime_mismatch: tr(locale, "图片格式与文件内容不一致。", "The image type does not match its content."),
        invalid_session: tr(locale, "登录已过期，请重新登录。", "Your session expired. Sign in again."),
      };
      status.textContent = labels[error.message] || tr(locale, "保存失败，请稍后重试。", "Could not save. Try again later.");
      save.disabled = false;
    }
  });
  form.elements.nickname.focus();
}
