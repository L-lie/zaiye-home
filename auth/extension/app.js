const statusBox = document.querySelector("#status");
const loginPanel = document.querySelector("#loginPanel");
const oauthButtons = document.querySelector("#oauthButtons");
const emailPanel = document.querySelector("#emailPanel");
const emailRequestForm = document.querySelector("#emailRequestForm");
const emailVerifyForm = document.querySelector("#emailVerifyForm");
const consentPanel = document.querySelector("#consentPanel");
const accountLabel = document.querySelector("#accountLabel");
const actionDescription = document.querySelector("#actionDescription");
const continueButton = document.querySelector("#continueButton");
const cancelButton = document.querySelector("#cancelButton");

const FLOW_STORAGE_KEY = "yucangExtensionPendingAuth";
let client;
let session;
let flow;
let pendingEmail = "";

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle("error", isError);
}

function parseFlow() {
  const current = Object.fromEntries(new URLSearchParams(location.search));
  const stored = sessionStorage.getItem(FLOW_STORAGE_KEY);
  const candidate = current.redirect_uri ? current : (stored ? JSON.parse(stored) : current);
  const provider = candidate.provider || "";
  if (provider && !["github", "google", "email"].includes(provider)) throw new Error("登录方式无效。");
  if (!["signin", "link"].includes(candidate.action)) throw new Error("登录动作无效。");
  if (candidate.code_challenge_method !== "S256") throw new Error("只支持 S256 PKCE。");
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(candidate.code_challenge || "")) throw new Error("PKCE challenge 无效。");
  if (!/^[A-Za-z0-9._~-]{16,512}$/.test(candidate.state || "")) throw new Error("state 无效。");
  const redirect = new URL(candidate.redirect_uri);
  if (redirect.protocol !== "https:" || redirect.pathname !== "/yucang-auth" || redirect.search || redirect.hash) {
    throw new Error("扩展回跳地址无效。");
  }
  const normalized = {
    provider,
    action: candidate.action,
    redirect_uri: redirect.href,
    code_challenge: candidate.code_challenge,
    code_challenge_method: "S256",
    state: candidate.state,
  };
  sessionStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

function callbackUrl(values) {
  const url = new URL(flow.redirect_uri);
  Object.entries(values).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.href;
}

function showLogin() {
  loginPanel.hidden = false;
  consentPanel.hidden = true;
  oauthButtons.querySelectorAll("[data-provider]").forEach((button) => {
    button.hidden = Boolean(flow.provider && button.dataset.provider !== flow.provider);
  });
  emailPanel.hidden = Boolean(flow.provider && flow.provider !== "email");
  setStatus("请选择登录方式。网站登录不会读取扩展中的本地 Prompt。");
}

function showConsent() {
  loginPanel.hidden = true;
  consentPanel.hidden = false;
  accountLabel.textContent = session.user.user_metadata?.full_name
    || session.user.user_metadata?.name
    || session.user.email
    || session.user.id;
  actionDescription.textContent = flow.action === "link"
    ? "将此登录身份连接到当前 Prompt Vault 账号；扩展会再次核对返回的用户 ID。"
    : "确认后将安全返回 Prompt Vault 扩展。";
  setStatus("已登录。请确认是否继续返回扩展。");
}

async function authorizeExtension() {
  continueButton.disabled = true;
  setStatus("正在签发一次性登录凭证…");
  try {
    if (flow.action === "link" && ["github", "google"].includes(flow.provider)) {
      const linked = session.user.identities?.some((identity) => identity.provider === flow.provider);
      const marker = `yucangExtensionLinked:${flow.state}`;
      if (!linked && sessionStorage.getItem(marker) !== "started") {
        sessionStorage.setItem(marker, "started");
        const { error } = await client.auth.linkIdentity({
          provider: flow.provider,
          options: { redirectTo: `${location.origin}${location.pathname}` },
        });
        if (error) throw error;
        return;
      }
      sessionStorage.removeItem(marker);
    }

    const response = await fetch("/api/auth/extension/authorize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...flow,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error_description || result.error || "无法签发登录凭证。");
    sessionStorage.removeItem(FLOW_STORAGE_KEY);
    location.replace(callbackUrl({ code: result.code, state: result.state }));
  } catch (error) {
    setStatus(error.message || "无法完成扩展登录。", true);
    continueButton.disabled = false;
  }
}

async function startOAuth(provider) {
  setStatus(`正在前往 ${provider === "github" ? "GitHub" : "Google"}…`);
  const { error } = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${location.origin}${location.pathname}` },
  });
  if (error) throw error;
}

async function initialize() {
  try {
    flow = parseFlow();
    client = window.ZaiyeSupabase?.getClient();
    if (!client) throw new Error("语藏登录服务尚未配置。");
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    session = data.session;
    history.replaceState(null, "", `${location.pathname}?${new URLSearchParams(flow)}`);
    if (session) showConsent(); else showLogin();
  } catch (error) {
    setStatus(error.message || "扩展登录请求无效。", true);
    loginPanel.hidden = true;
    consentPanel.hidden = true;
  }
}

oauthButtons.addEventListener("click", async (event) => {
  const provider = event.target.closest("[data-provider]")?.dataset.provider;
  if (!provider) return;
  try { await startOAuth(provider); } catch (error) { setStatus(error.message, true); }
});

emailRequestForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  pendingEmail = new FormData(event.currentTarget).get("email").trim();
  try {
    const { error } = await client.auth.signInWithOtp({
      email: pendingEmail,
      options: { shouldCreateUser: true },
    });
    if (error) throw error;
    emailRequestForm.hidden = true;
    emailVerifyForm.hidden = false;
    setStatus("验证码已发送，请检查邮箱。");
  } catch (error) {
    setStatus(error.message, true);
    button.disabled = false;
  }
});

emailVerifyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    const token = new FormData(event.currentTarget).get("token").trim();
    const { data, error } = await client.auth.verifyOtp({ email: pendingEmail, token, type: "email" });
    if (error) throw error;
    session = data.session;
    if (!session) throw new Error("登录会话未建立。");
    showConsent();
  } catch (error) {
    setStatus(error.message, true);
    button.disabled = false;
  }
});

continueButton.addEventListener("click", authorizeExtension);
cancelButton.addEventListener("click", () => {
  sessionStorage.removeItem(FLOW_STORAGE_KEY);
  location.replace(callbackUrl({ error: "access_denied", state: flow.state }));
});

window.addEventListener("DOMContentLoaded", initialize, { once: true });
