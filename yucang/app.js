import {
  CONTENT_TYPE_LABELS,
  LICENSE_LABELS,
  formatKeyValueLines,
  normalizeVariables,
  parseKeyValueLines,
  parseTags,
  renderPromptTemplate,
  snapshotToViewModel,
} from "./core.mjs";

const app = document.getElementById("app");
const accountActions = document.getElementById("accountActions");
const toast = document.getElementById("toast");

const state = {
  client: null,
  session: null,
  access: null,
  authReady: false,
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

function firstRow(data) {
  return Array.isArray(data) ? (data[0] || null) : data;
}

function notify(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { toast.hidden = true; }, 3200);
}

function setBusy(button, busy, label = "处理中…") {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = label;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
  }
}

function routeParts() {
  const value = location.hash.replace(/^#\/?/, "") || "discover";
  return value.split("/").filter(Boolean);
}

function go(path) {
  location.hash = `#/${path.replace(/^\//, "")}`;
}

function getClient() {
  if (state.client) return state.client;
  state.client = window.ZaiyeSupabase?.getClient();
  if (!state.client) throw new Error("Supabase 尚未配置，无法运行语藏。请检查 supabase-config.js。 ");
  return state.client;
}

async function rpc(name, args = {}) {
  const result = await getClient().rpc(name, args);
  if (result.error) throw result.error;
  return result.data;
}

function isSchemaMissing(error) {
  return ["PGRST202", "PGRST205", "42P01", "42883"].includes(error?.code)
    || /schema cache|function .* does not exist|relation .* does not exist/i.test(error?.message || "");
}

function renderError(error, title = "暂时无法完成") {
  const setup = isSchemaMissing(error)
    ? `<div class="setup-note">远程 Supabase 尚未应用 Slice 1 migration。请先在开发/测试项目应用 <code>20260825000100_yucang_slice1.sql</code>，再刷新页面。</div>`
    : "";
  app.innerHTML = `
    <section class="state-card error-card">
      <p class="eyebrow">YUCANG ERROR</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="lede">${escapeHtml(error?.message || String(error))}</p>
      ${setup}
      <div class="actions"><a class="button primary" href="#/discover">返回发现</a></div>
    </section>`;
}

async function loadAccess() {
  if (!state.session) {
    state.access = null;
    return;
  }
  try {
    state.access = firstRow(await rpc("yucang_get_my_access"));
  } catch (error) {
    state.access = null;
    if (!isSchemaMissing(error)) console.error(error);
  }
}

function renderHeader() {
  document.querySelectorAll("[data-creator-link]").forEach((item) => {
    item.hidden = !state.access?.is_creator;
  });
  document.querySelectorAll("[data-staff-link]").forEach((item) => {
    item.hidden = !(state.access?.is_admin || state.access?.is_reviewer);
  });

  if (!state.session) {
    accountActions.innerHTML = '<a class="button ghost" href="#/login">登录</a>';
    return;
  }
  accountActions.innerHTML = `
    <span class="account-copy">
      <strong>${escapeHtml(state.access?.nickname || state.session.user.user_metadata?.full_name || state.session.user.user_metadata?.name || "已登录")}</strong>
      <small>${escapeHtml(state.session.user.email || "")}</small>
    </span>
    <button class="button ghost" type="button" data-sign-out>退出</button>`;
  accountActions.querySelector("[data-sign-out]").addEventListener("click", async () => {
    await getClient().auth.signOut();
    go("discover");
  });
}

function requireLogin() {
  if (state.session) return true;
  go("login");
  return false;
}

function requireCreator() {
  if (!requireLogin()) return false;
  if (state.access?.is_creator) return true;
  app.innerHTML = `
    <section class="state-card narrow">
      <p class="eyebrow">INVITE ONLY</p>
      <h1>当前账号没有创作者资格</h1>
      <p class="lede">语藏 MVP 采用站方邀请制。普通登录用户可以浏览公开作品，但不能创建或提交作品。</p>
      <a class="button primary" href="#/discover">浏览发现</a>
    </section>`;
  return false;
}

function requireStaff() {
  if (!requireLogin()) return false;
  if (state.access?.is_admin || state.access?.is_reviewer) return true;
  app.innerHTML = `
    <section class="state-card narrow">
      <p class="eyebrow">STAFF ONLY</p>
      <h1>没有审核权限</h1>
      <p class="lede">审核后台仅向审核员和管理员开放。</p>
      <button class="button" type="button" data-bootstrap-admin>以站点 owner 初始化首位管理员</button>
    </section>`;
  app.querySelector("[data-bootstrap-admin]").addEventListener("click", bootstrapAdmin);
  return false;
}

async function renderDiscover() {
  app.innerHTML = '<section class="loading-state"><span class="spinner"></span><p>正在读取公开作品…</p></section>';
  try {
    const items = await rpc("yucang_list_public_works");
    app.innerHTML = `
      <section class="hero">
        <div>
          <p class="eyebrow">YUCANG · PROMPT COMMUNITY</p>
          <h1>从真实效果，找到可复用的 Prompt</h1>
          <p>语藏连接公开作品与个人 Prompt Vault。首个 MVP 从视觉创作者的免费分享开始。</p>
          ${state.access?.is_creator ? '<a class="button primary" href="#/publish/new">新建公开作品</a>' : ''}
        </div>
        <aside class="hero-panel">
          <strong>${items.length}</strong>
          <span>个已审核公开作品。未审核草稿不会出现在这里。</span>
        </aside>
      </section>
      <section>
        <div class="section-head"><div><p class="eyebrow">DISCOVER</p><h2>最新公开</h2></div><p>只读取 active + approved current version</p></div>
        ${items.length ? `<div class="card-grid">${items.map(renderWorkCard).join("")}</div>` : `
          <div class="empty-state">
            <h3>还没有公开作品</h3>
            <p>创作者提交的首个版本审核通过后，会真实出现在这里。</p>
          </div>`}
      </section>`;
  } catch (error) {
    renderError(error, "发现页暂时不可用");
  }
}

function renderWorkCard(item) {
  return `
    <article class="prompt-card">
      <a href="#/prompt/${encodeURIComponent(item.work_id)}">
        <div class="card-meta">
          <span class="pill accent">${escapeHtml(CONTENT_TYPE_LABELS[item.content_type] || item.content_type)}</span>
          <span class="pill">v${Number(item.version_no || 1)}</span>
        </div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.summary || "暂无简介")}</p>
        <footer class="card-footer"><span>${escapeHtml(item.author_nickname)}</span><span>${escapeHtml(item.model_name || "通用模型")}</span></footer>
      </a>
    </article>`;
}

async function renderLogin() {
  if (state.session) {
    app.innerHTML = `
      <section class="state-card narrow">
        <p class="eyebrow">SIGNED IN</p><h1>已经登录</h1>
        <p class="lede">${escapeHtml(state.session.user.email || "")}</p>
        <a class="button primary" href="#/discover">进入语藏</a>
      </section>`;
    return;
  }
  const lastMethod = localStorage.getItem("yucangLastAuthMethod") || "";
  const recent = (method) => lastMethod === method ? '<span class="pill accent">最近使用</span>' : "";
  app.innerHTML = `
    <section class="panel narrow auth-panel">
      <div class="auth-brand">
        <img src="assets/prompt-vault-logo.png" alt="" width="58" height="58" />
        <div><p class="eyebrow">PROMPT VAULT ACCOUNT</p><h1>登录语藏</h1><p>使用同一个 Prompt Vault 账号进入社区。</p></div>
      </div>
      <div class="auth-providers">
        <button class="button" type="button" data-oauth="github">使用 GitHub 登录 ${recent("github")}</button>
        <button class="button" type="button" data-oauth="google">使用 Google 登录 ${recent("google")}</button>
      </div>
      <div class="auth-divider">或使用邮箱验证码</div>
      <form id="emailCodeLogin" class="form-grid">
        <label class="field full"><span>邮箱</span><input name="email" type="email" required autocomplete="email" /></label>
        <label class="field full"><span>邮箱验证码</span><input name="token" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="发送后填写验证码" /></label>
        <div class="actions field full">
          <button class="button" type="button" data-send-code>发送验证码</button>
          <button class="button primary" type="submit">登录</button>
          ${recent("email")}
        </div>
      </form>
      <p class="privacy-note">登录不会自动上传或公开你扩展中的任何 Prompt。云同步需要单独开启；公开发布仍必须由你主动选择内容、查看预览并再次确认。<br><a href="https://zaiye.art/privacy.html" target="_blank" rel="noopener">隐私政策</a> · <a href="https://zaiye.art/terms.html" target="_blank" rel="noopener">用户协议</a></p>
    </section>`;

  const emailForm = app.querySelector("#emailCodeLogin");
  emailForm.querySelector("[data-send-code]").addEventListener("click", async (event) => {
    if (!emailForm.reportValidity()) return;
    const button = event.currentTarget;
    const form = new FormData(emailForm);
    setBusy(button, true, "正在发送…");
    const { error } = await getClient().auth.signInWithOtp({
      email: form.get("email"), options: { shouldCreateUser: true },
    });
    setBusy(button, false);
    notify(error ? error.message : "验证码已发送，请检查邮箱。");
  });

  emailForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.submitter;
    setBusy(button, true, "正在验证…");
    const form = new FormData(event.currentTarget);
    const { data, error } = await getClient().auth.verifyOtp({
      email: form.get("email"),
      token: form.get("token"),
      type: "email",
    });
    setBusy(button, false);
    if (error) return notify(error.message);
    localStorage.setItem("yucangLastAuthMethod", "email");
    state.session = data.session;
    await loadAccess();
    renderHeader();
    go("discover");
  });

  app.querySelectorAll("[data-oauth]").forEach((button) => button.addEventListener("click", async () => {
    localStorage.setItem("yucangLastAuthMethod", button.dataset.oauth);
    const { error } = await getClient().auth.signInWithOAuth({
      provider: button.dataset.oauth,
      options: { redirectTo: `${location.origin}${location.pathname}#/discover` },
    });
    if (error) notify(error.message);
  }));
}

function editorMarkup(record = {}) {
  const variables = normalizeVariables(record.variables);
  return `
    <section class="panel">
      <p class="eyebrow">CREATOR STUDIO · ${record.version_id ? `V${record.version_no}` : "NEW"}</p>
      <h1>${record.version_id ? "编辑发布草稿" : "新建公开作品"}</h1>
      <p class="lede">保存只进入发布流程域。只有公开预览、二次确认并审核通过后，作品才会出现在发现页。</p>
      <form id="workEditor" class="form-grid" data-version-id="${escapeHtml(record.version_id || "")}" data-work-id="${escapeHtml(record.work_id || "")}" data-revision="${Number(record.revision || 1)}">
        <label class="field full"><span>标题 *</span><input name="title" maxlength="120" required value="${escapeHtml(record.title || "")}" /></label>
        <label class="field full"><span>一句话用途/简介 *</span><input name="summary" maxlength="300" required value="${escapeHtml(record.summary || "")}" /></label>
        <label class="field"><span>内容类型</span><select name="content_type">${Object.entries(CONTENT_TYPE_LABELS).map(([value, label]) => `<option value="${value}" ${record.content_type === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
        <label class="field"><span>授权类型</span><select name="license_code">${Object.entries(LICENSE_LABELS).map(([value, label]) => `<option value="${value}" ${record.license_code === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
        <label class="field full"><span>完整 Prompt *</span><textarea class="prompt-input" name="prompt_text" required placeholder="使用 {{变量名}} 插入可修改变量">${escapeHtml(record.prompt_text || "")}</textarea><small>示例：一张 {{主体}} 的电影感画面，使用 {{光线}}。</small></label>
        <div class="field full"><span>变量与默认值</span><div class="variable-list" id="variableList">${variables.map(renderVariableEditorRow).join("")}</div><button class="button" type="button" data-add-variable>添加变量</button></div>
        <label class="field"><span>模型</span><input name="model_name" maxlength="120" value="${escapeHtml(record.model_name || "")}" placeholder="例如 Midjourney" /></label>
        <label class="field"><span>模型版本</span><input name="model_version" maxlength="120" value="${escapeHtml(record.model_version || "")}" placeholder="例如 v7" /></label>
        <label class="field full"><span>基础参数</span><textarea name="parameters" placeholder="每行一个，例如：aspect_ratio=16:9">${escapeHtml(formatKeyValueLines(record.parameters))}</textarea></label>
        <label class="field full"><span>标签</span><input name="tags" value="${escapeHtml((record.tags || []).join("，"))}" placeholder="电影感，角色设计，光影" /></label>
        <div class="actions field full">
          <button class="button" type="submit" name="intent" value="save">保存草稿</button>
          <button class="button primary" type="submit" name="intent" value="preview">保存并公开预览</button>
          <a class="button" href="#/my-publications">返回我的发布</a>
        </div>
      </form>
    </section>`;
}

function renderVariableEditorRow(item = {}) {
  return `<div class="variable-row">
    <input data-variable-name value="${escapeHtml(item.name || "")}" placeholder="变量名" aria-label="变量名" />
    <input data-variable-default value="${escapeHtml(item.defaultValue || "")}" placeholder="默认值" aria-label="变量默认值" />
    <button class="icon-button" type="button" data-remove-variable aria-label="删除变量">×</button>
  </div>`;
}

function bindVariableEditor(root) {
  const list = root.querySelector("#variableList");
  root.querySelector("[data-add-variable]").addEventListener("click", () => {
    list.insertAdjacentHTML("beforeend", renderVariableEditorRow());
  });
  list.addEventListener("click", (event) => {
    if (event.target.matches("[data-remove-variable]")) event.target.closest(".variable-row").remove();
  });
}

function collectEditor(form) {
  const data = new FormData(form);
  const variables = [...form.querySelectorAll(".variable-row")].map((row) => ({
    name: row.querySelector("[data-variable-name]").value.trim(),
    defaultValue: row.querySelector("[data-variable-default]").value.trim(),
  })).filter((item) => item.name);
  return {
    p_title: data.get("title"), p_summary: data.get("summary"),
    p_content_type: data.get("content_type"), p_prompt_text: data.get("prompt_text"),
    p_variables: variables, p_model_name: data.get("model_name"),
    p_model_version: data.get("model_version"), p_parameters: parseKeyValueLines(data.get("parameters")),
    p_tags: parseTags(data.get("tags")), p_license_code: data.get("license_code"),
  };
}

async function saveEditor(form) {
  const payload = collectEditor(form);
  const versionId = form.dataset.versionId;
  if (!versionId) {
    const result = firstRow(await rpc("yucang_create_work", payload));
    form.dataset.versionId = result.version_id;
    form.dataset.workId = result.work_id;
    form.dataset.revision = "1";
    return result.version_id;
  }
  const revision = await rpc("yucang_update_draft", {
    p_version_id: versionId,
    p_expected_revision: Number(form.dataset.revision),
    ...payload,
  });
  form.dataset.revision = String(revision);
  return versionId;
}

async function renderEditor(versionId = "") {
  if (!requireCreator()) return;
  app.innerHTML = '<section class="loading-state"><span class="spinner"></span><p>正在打开发布草稿…</p></section>';
  try {
    const record = versionId ? firstRow(await rpc("yucang_get_my_version", { p_version_id: versionId })) : {};
    if (versionId && !record) throw new Error("没有找到可访问的版本。");
    if (record?.status && record.status !== "draft") throw new Error("当前版本不处于可编辑 draft 状态。");
    app.innerHTML = editorMarkup(record || {});
    const form = app.querySelector("#workEditor");
    bindVariableEditor(form);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = event.submitter;
      setBusy(button, true, button.value === "preview" ? "正在生成预览…" : "正在保存…");
      try {
        const savedVersionId = await saveEditor(form);
        notify("草稿已保存");
        if (button.value === "preview") go(`preview/${savedVersionId}`);
        else if (!versionId) go(`publish/${savedVersionId}`);
      } catch (error) {
        notify(error.message);
      } finally {
        setBusy(button, false);
      }
    });
  } catch (error) {
    renderError(error, "无法打开发布草稿");
  }
}

function snapshotDetail(view, { includePrompt = true } = {}) {
  return `
    <div class="detail-meta">
      <span class="pill accent">${escapeHtml(CONTENT_TYPE_LABELS[view.content_type] || view.content_type)}</span>
      <span class="pill">v${view.version_no}</span>
      <span class="pill">${escapeHtml(LICENSE_LABELS[view.license_code] || view.license_code)}</span>
    </div>
    <h1>${escapeHtml(view.title)}</h1>
    <p class="lede">${escapeHtml(view.summary)}</p>
    <dl class="data-list">
      <div><dt>作者</dt><dd>${escapeHtml(view.author_nickname || state.access?.nickname || "—")}</dd></div>
      <div><dt>模型</dt><dd>${escapeHtml([view.model_name, view.model_version].filter(Boolean).join(" · ") || "—")}</dd></div>
      <div><dt>参数</dt><dd>${escapeHtml(formatKeyValueLines(view.parameters) || "—").replaceAll("\n", "<br>")}</dd></div>
      <div><dt>标签</dt><dd><span class="tag-list">${(view.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("") || "—"}</span></dd></div>
      <div><dt>授权</dt><dd>${escapeHtml(LICENSE_LABELS[view.license_code] || view.license_code)}</dd></div>
    </dl>
    ${includePrompt ? `<h2 style="margin-top:30px">完整 Prompt</h2><pre class="prompt-output">${escapeHtml(view.prompt_text)}</pre>` : ""}`;
}

async function renderPreview(versionId) {
  if (!requireCreator()) return;
  app.innerHTML = '<section class="loading-state"><span class="spinner"></span><p>正在生成冻结预览…</p></section>';
  try {
    const preview = firstRow(await rpc("yucang_prepare_preview", { p_version_id: versionId }));
    if (!preview) throw new Error("无法生成预览。");
    const view = snapshotToViewModel(preview.snapshot);
    app.innerHTML = `
      <section class="panel">
        <p class="eyebrow">PUBLIC PREVIEW · SECOND CONFIRMATION</p>
        <div class="detail-header">${snapshotDetail(view)}</div>
        <label class="confirm-box">
          <input type="checkbox" data-confirm-publish />
          <span>我确认以上全部内容将作为冻结的待审核版本提交。审核期间不能直接修改；只有审核通过后才会公开。</span>
        </label>
        <div class="actions">
          <button class="button primary" type="button" data-submit-review disabled>确认并提交审核</button>
          <a class="button" href="#/publish/${encodeURIComponent(versionId)}">返回修改</a>
        </div>
      </section>`;
    const checkbox = app.querySelector("[data-confirm-publish]");
    const button = app.querySelector("[data-submit-review]");
    checkbox.addEventListener("change", () => { button.disabled = !checkbox.checked; });
    button.addEventListener("click", async () => {
      setBusy(button, true, "正在冻结并提交…");
      try {
        await rpc("yucang_submit_for_review", {
          p_version_id: versionId,
          p_expected_hash: preview.content_hash,
        });
        notify("已提交审核，版本内容现已冻结。");
        go("my-publications");
      } catch (error) {
        notify(error.message);
        setBusy(button, false);
      }
    });
  } catch (error) {
    renderError(error, "无法生成公开预览");
  }
}

async function renderMyPublications() {
  if (!requireCreator()) return;
  app.innerHTML = '<section class="loading-state"><span class="spinner"></span><p>正在读取我的发布…</p></section>';
  try {
    const items = await rpc("yucang_list_my_publications");
    app.innerHTML = `
      <section>
        <div class="section-head"><div><p class="eyebrow">CREATOR STUDIO</p><h1 style="font-size:52px">我的发布</h1></div><a class="button primary" href="#/publish/new">新建公开作品</a></div>
        ${items.length ? `<div class="table-list">${items.map((item) => `
          <article class="table-row">
            <div><span class="status">${escapeHtml(item.version_status)}</span><h3>${escapeHtml(item.title || "未命名草稿")}</h3><p>v${item.version_no} · ${escapeHtml(item.summary || "暂无简介")} · ${formatDate(item.updated_at)}</p></div>
            <div class="actions" style="margin:0">
              ${item.version_status === "draft" ? `<a class="button" href="#/publish/${item.version_id}">编辑</a><a class="button primary" href="#/preview/${item.version_id}">预览提交</a>` : ""}
              ${item.version_status === "pending_review" ? `<button class="button" type="button" data-withdraw="${item.version_id}">撤回审核</button>` : ""}
              ${item.version_status === "changes_requested" ? `<button class="button" type="button" data-reopen="${item.version_id}">继续修改</button>` : ""}
              ${item.version_status === "approved" && item.current_public_version_id === item.version_id ? `<a class="button" href="#/prompt/${item.work_id}">查看公开页</a>` : ""}
            </div>
          </article>`).join("")}</div>` : '<div class="empty-state"><h3>还没有发布流程</h3><p>从新建公开作品开始。</p></div>'}
      </section>`;
    app.querySelectorAll("[data-withdraw]").forEach((button) => button.addEventListener("click", async () => {
      setBusy(button, true);
      try {
        await rpc("yucang_withdraw_review", { p_version_id: button.dataset.withdraw });
        notify("审核已撤回，版本回到 draft。");
        renderMyPublications();
      } catch (error) { notify(error.message); setBusy(button, false); }
    }));
    app.querySelectorAll("[data-reopen]").forEach((button) => button.addEventListener("click", async () => {
      setBusy(button, true);
      try {
        await rpc("yucang_reopen_changes", { p_version_id: button.dataset.reopen });
        go(`publish/${button.dataset.reopen}`);
      } catch (error) { notify(error.message); setBusy(button, false); }
    }));
  } catch (error) {
    renderError(error, "无法读取我的发布");
  }
}

async function renderPublicPrompt(workId) {
  app.innerHTML = '<section class="loading-state"><span class="spinner"></span><p>正在读取公开版本…</p></section>';
  try {
    const item = firstRow(await rpc("yucang_get_public_work", { p_work_id: workId }));
    if (!item) throw new Error("作品不存在、尚未审核通过或当前不可公开访问。");
    const variables = normalizeVariables(item.variables);
    const values = Object.fromEntries(variables.map((entry) => [entry.name, entry.defaultValue]));
    app.innerHTML = `
      <section class="detail-header">
        <p class="eyebrow">PUBLIC PROMPT · APPROVED CURRENT VERSION</p>
        ${snapshotDetail(item, { includePrompt: false })}
      </section>
      <section class="split-layout">
        <div class="panel">
          <h2>修改变量</h2>
          <p class="lede">变量只在当前页面生成最终 Prompt，不会修改公开版本。</p>
          <div class="form-grid" data-variable-inputs>
            ${variables.length ? variables.map((entry) => `<label class="field"><span>${escapeHtml(entry.name)}</span><input data-variable-value="${escapeHtml(entry.name)}" value="${escapeHtml(entry.defaultValue)}" /></label>`).join("") : '<p class="lede field full">这个 Prompt 没有声明变量，可直接复制。</p>'}
          </div>
        </div>
        <aside class="panel sticky-panel">
          <div class="section-head"><div><p class="eyebrow">FINAL PROMPT</p><h2>最终 Prompt</h2></div></div>
          <pre class="prompt-output" data-final-prompt></pre>
          <button class="button primary" type="button" data-copy-prompt style="margin-top:16px">复制 Prompt</button>
        </aside>
      </section>`;
    const output = app.querySelector("[data-final-prompt]");
    const update = () => { output.textContent = renderPromptTemplate(item.prompt_text, variables, values); };
    app.querySelectorAll("[data-variable-value]").forEach((input) => input.addEventListener("input", () => {
      values[input.dataset.variableValue] = input.value;
      update();
    }));
    app.querySelector("[data-copy-prompt]").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(output.textContent);
        notify("Prompt 已复制");
      } catch {
        const range = document.createRange(); range.selectNodeContents(output);
        const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
        notify("浏览器未授权剪贴板，已选中文本，请手动复制。");
      }
    });
    update();
  } catch (error) {
    renderError(error, "无法打开 Prompt");
  }
}

async function bootstrapAdmin(event) {
  const button = event?.currentTarget;
  setBusy(button, true);
  try {
    await rpc("yucang_bootstrap_admin");
    await loadAccess();
    renderHeader();
    notify("语藏首位管理员已初始化。");
    go("admin/review");
  } catch (error) {
    notify(error.message);
    setBusy(button, false);
  }
}

async function renderAdminReview() {
  if (!requireLogin()) return;
  if (!(state.access?.is_admin || state.access?.is_reviewer)) {
    requireStaff();
    return;
  }
  app.innerHTML = '<section class="loading-state"><span class="spinner"></span><p>正在读取审核队列…</p></section>';
  try {
    const items = await rpc("yucang_admin_list_pending");
    app.innerHTML = `
      <section class="split-layout">
        <div>
          <div class="section-head"><div><p class="eyebrow">REVIEW QUEUE</p><h1 style="font-size:52px">待审核</h1></div><span class="status">${items.length} 项</span></div>
          ${items.length ? `<div class="table-list">${items.map((item) => `
            <article class="table-row"><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.author_nickname)} · v${item.version_no} · ${formatDate(item.submitted_at)}</p></div><a class="button primary" href="#/admin/review/${item.submission_id}">打开审核</a></article>`).join("")}</div>` : '<div class="empty-state"><h3>审核队列为空</h3><p>创作者二次确认并提交后，会出现在这里。</p></div>'}
        </div>
        ${state.access?.is_admin ? `
          <aside class="panel sticky-panel">
            <p class="eyebrow">ADMIN</p><h2>赋予创作者资格</h2>
            <form id="grantCreator" class="form-grid">
              <label class="field full"><span>已有账号邮箱</span><input name="email" type="email" required /></label>
              <label class="field full"><span>公开昵称</span><input name="nickname" required maxlength="40" /></label>
              <label class="field full"><span>作者 slug</span><input name="slug" required pattern="[a-z0-9][a-z0-9-]{1,62}[a-z0-9]" placeholder="visual-creator" /></label>
              <button class="button primary field full" type="submit">赋予资格</button>
            </form>
          </aside>` : ""}
      </section>`;
    const grantForm = app.querySelector("#grantCreator");
    grantForm?.addEventListener("submit", async (event) => {
      event.preventDefault(); const button = event.submitter; setBusy(button, true);
      const data = new FormData(event.currentTarget);
      try {
        await rpc("yucang_admin_grant_creator", {
          p_email: data.get("email"), p_nickname: data.get("nickname"), p_slug: data.get("slug"),
        });
        notify("创作者资格已生效。"); event.currentTarget.reset();
        if (data.get("email") === state.session.user.email) { await loadAccess(); renderHeader(); }
      } catch (error) { notify(error.message); } finally { setBusy(button, false); }
    });
  } catch (error) {
    renderError(error, "无法打开审核后台");
  }
}

async function renderSubmission(submissionId) {
  if (!requireStaff()) return;
  app.innerHTML = '<section class="loading-state"><span class="spinner"></span><p>正在读取冻结 submission…</p></section>';
  try {
    const item = firstRow(await rpc("yucang_admin_get_submission", { p_submission_id: submissionId }));
    if (!item) throw new Error("Submission 不存在或不可访问。");
    const view = snapshotToViewModel(item.snapshot);
    app.innerHTML = `
      <section class="split-layout">
        <div class="panel review-snapshot">
          <p class="eyebrow">FROZEN SUBMISSION · ${escapeHtml(item.content_hash.slice(0, 12))}</p>
          ${snapshotDetail(view)}
        </div>
        <aside class="panel sticky-panel">
          <p class="eyebrow">REVIEW ACTION</p><h2>审核决定</h2>
          <p class="lede">审核员只能决定结果，不能修改创作者 Prompt。</p>
          <label class="field"><span>审核原因/说明</span><textarea data-review-reason placeholder="要求修改或拒绝时请说明原因"></textarea></label>
          <div class="actions">
            <button class="button primary" type="button" data-review-action="approved">通过并公开</button>
            <button class="button" type="button" data-review-action="changes_requested">要求修改</button>
            <button class="button danger" type="button" data-review-action="rejected">拒绝</button>
          </div>
        </aside>
      </section>`;
    app.querySelectorAll("[data-review-action]").forEach((button) => button.addEventListener("click", async () => {
      const action = button.dataset.reviewAction;
      const reason = app.querySelector("[data-review-reason]").value.trim();
      if (action !== "approved" && !reason) return notify("要求修改或拒绝时必须填写原因。");
      setBusy(button, true, action === "approved" ? "正在批准并公开…" : "正在提交决定…");
      try {
        await rpc("yucang_review_submission", {
          p_submission_id: submissionId, p_action: action, p_reason: reason,
        });
        notify(action === "approved" ? "审核通过，作品已成为真实公开数据。" : "审核结果已保存。");
        go("admin/review");
      } catch (error) { notify(error.message); setBusy(button, false); }
    }));
  } catch (error) {
    renderError(error, "无法读取审核 submission");
  }
}

async function renderRoute() {
  const [section, id] = routeParts();
  document.querySelectorAll(".main-nav a").forEach((link) => {
    link.removeAttribute("aria-current");
    if (link.getAttribute("href") === `#/${section}`) link.setAttribute("aria-current", "page");
  });
  app.focus({ preventScroll: true });
  if (section === "discover") return renderDiscover();
  if (section === "login") return renderLogin();
  if (section === "prompt" && id) return renderPublicPrompt(id);
  if (section === "publish" && id === "new") return renderEditor();
  if (section === "publish" && id) return renderEditor(id);
  if (section === "preview" && id) return renderPreview(id);
  if (section === "my-publications") return renderMyPublications();
  if (section === "admin" && id === "review" && routeParts()[2]) return renderSubmission(routeParts()[2]);
  if (section === "admin" && id === "review") return renderAdminReview();
  renderError(new Error("页面不存在。"), "没有找到这个页面");
}

async function initialize() {
  try {
    const client = getClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    state.session = data.session;
    await loadAccess();
    state.authReady = true;
    renderHeader();
    client.auth.onAuthStateChange((_event, session) => {
      state.session = session;
      setTimeout(async () => {
        await loadAccess();
        renderHeader();
      }, 0);
    });
    await renderRoute();
  } catch (error) {
    renderError(error, "语藏初始化失败");
  }
}

window.addEventListener("hashchange", renderRoute);
window.addEventListener("DOMContentLoaded", initialize, { once: true });
