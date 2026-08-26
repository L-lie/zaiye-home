import {
  applyLastLoginHint,
  bindLoginConsent,
  bindLoginShowcase,
  loginControlsMarkup,
  loginExperienceMarkup,
} from "../login-experience.js";

const extensionLoginRoot = document.querySelector("#extensionLoginRoot");
extensionLoginRoot.innerHTML = loginExperienceMarkup({
  assetRoot: "../..",
  logoSrc: "../../yucang/assets/prompt-vault-logo.png",
  title: "登录语藏",
  description: "登录后安全返回 Prompt Vault 扩展。",
  controls: `${loginControlsMarkup({ assetRoot: "../..", showStatus: true })}
    <section id="consentPanel" class="login-consent" hidden>
      <p>当前账号：<strong id="accountLabel"></strong></p>
      <p id="actionDescription">确认后将返回 Prompt Vault 扩展。</p>
      <div class="login-consent-actions">
        <button id="continueButton" type="button">继续</button>
        <button id="switchAccountButton" type="button" class="secondary">切换账号</button>
        <button id="cancelButton" type="button" class="secondary">取消</button>
      </div>
    </section>`,
  footer: "登录只建立账号会话，不会上传、同步或公开你的本地 Prompt。",
});
extensionLoginRoot.querySelector(".login-experience")?.insertAdjacentHTML(
  "beforeend",
  '<button id="closePageButton" class="extension-login-close" type="button" aria-label="取消并关闭登录">×</button>',
);
bindLoginShowcase(extensionLoginRoot);
const loginConsent = bindLoginConsent(extensionLoginRoot);

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
const switchAccountButton = document.querySelector("#switchAccountButton");
const cancelButton = document.querySelector("#cancelButton");
const closePageButton = document.querySelector("#closePageButton");

const FLOW_STORAGE_KEY = "yucangExtensionPendingAuth";
const LAST_AUTH_METHOD_KEY = "yucangLastAuthMethod";
const LAST_AUTH_EMAIL_KEY = "yucangLastAuthEmail";
const PENDING_AUTH_METHOD_KEY = "yucangExtensionPendingAuthMethod";
applyLastLoginHint(extensionLoginRoot, {
  method: localStorage.getItem(LAST_AUTH_METHOD_KEY) || "",
  email: localStorage.getItem(LAST_AUTH_EMAIL_KEY) || "",
});
const EXTENSION_AUTH_API_BASE = "https://zbcdmtjmqpwtevjaewtl.supabase.co/functions/v1";
const EXTENSION_CALLBACK_PROTOCOL = Object.freeze({
  type: "prompt-vault-extension-auth-result",
  protocolVersion: 1,
  extensionIds: new Set([
    "fapladhajicfoiadhcpmbmfkodekkckg",
    "idiemjhonlahnlnalpanhplbgjcfbpnl",
  ]),
});
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
  const consent = candidate.consent || "";
  if (consent && consent !== "accepted") throw new Error("登录确认状态无效。");
  if (!["signin", "link"].includes(candidate.action)) throw new Error("登录动作无效。");
  if (candidate.code_challenge_method !== "S256") throw new Error("只支持 S256 PKCE。");
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(candidate.code_challenge || "")) throw new Error("PKCE challenge 无效。");
  if (!/^[A-Za-z0-9._~-]{16,512}$/.test(candidate.state || "")) throw new Error("state 无效。");
  const redirect = new URL(candidate.redirect_uri);
  if (redirect.protocol !== "https:" || redirect.pathname !== "/yucang-auth" || redirect.search || redirect.hash) {
    throw new Error("扩展回跳地址无效。");
  }
  const extensionId = redirect.hostname.replace(/\.chromiumapp\.org$/i, "");
  if (`${extensionId}.chromiumapp.org` !== redirect.hostname || !EXTENSION_CALLBACK_PROTOCOL.extensionIds.has(extensionId)) {
    throw new Error("扩展身份不在允许列表中。");
  }
  const normalized = {
    provider,
    consent,
    action: candidate.action,
    redirect_uri: redirect.href,
    code_challenge: candidate.code_challenge,
    code_challenge_method: "S256",
    state: candidate.state,
    extension_id: extensionId,
  };
  sessionStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

function sendExtensionResult(values) {
  return new Promise((resolve, reject) => {
    if (!globalThis.chrome?.runtime?.sendMessage) {
      reject(new Error("未检测到可接收登录结果的 Prompt Vault 扩展。"));
      return;
    }
    const requestId = `yucang-auth-${crypto.randomUUID()}`.slice(0, 100);
    const timer = setTimeout(() => reject(new Error("扩展没有及时接收登录结果，请返回扩展重试。")), 12_000);
    chrome.runtime.sendMessage(flow.extension_id, {
      type: EXTENSION_CALLBACK_PROTOCOL.type,
      protocolVersion: EXTENSION_CALLBACK_PROTOCOL.protocolVersion,
      action: "complete",
      requestId,
      redirect_uri: flow.redirect_uri,
      state: flow.state,
      ...values,
    }, (response) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) return reject(new Error("无法连接 Prompt Vault 扩展，请确认扩展已更新并启用。"));
      if (!response?.ok || response.requestId !== requestId) {
        return reject(new Error(response?.error_description || "扩展未能完成登录换码。"));
      }
      resolve(response);
    });
  });
}

function providerStartMarker() {
  return `yucangExtensionProviderStarted:${flow.state}`;
}

function showLogin() {
  loginPanel.hidden = false;
  consentPanel.hidden = true;
  oauthButtons.querySelectorAll("[data-provider]").forEach((button) => {
    button.closest(".login-provider-option").hidden = Boolean(flow.action === "link" && flow.provider && button.dataset.provider !== flow.provider);
  });
  emailPanel.hidden = Boolean(flow.action === "link" && flow.provider && flow.provider !== "email");
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

async function clearStaleWebsiteSession() {
  try {
    await client.auth.signOut({ scope: "local" });
  } catch {
    // A rejected or expired remote session must not keep the local consent UI alive.
  }
  session = null;
}

async function getVerifiedWebsiteSession() {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  const candidate = data.session;
  if (!candidate) return null;

  const verified = await client.auth.getUser(candidate.access_token);
  if (!verified.error && verified.data.user?.id === candidate.user?.id) return candidate;

  const refreshed = await client.auth.refreshSession();
  const refreshedSession = refreshed.data?.session;
  if (!refreshed.error && refreshedSession) {
    const reverified = await client.auth.getUser(refreshedSession.access_token);
    if (!reverified.error && reverified.data.user?.id === refreshedSession.user?.id) return refreshedSession;
  }

  await clearStaleWebsiteSession();
  return null;
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

    const response = await fetch(`${EXTENSION_AUTH_API_BASE}/yucang-extension-authorize`, {
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
    if (!response.ok && (response.status === 401 || result.error === "invalid_session")) {
      await clearStaleWebsiteSession();
      showLogin();
      setStatus("官网登录已过期，请重新选择登录方式。", true);
      return;
    }
    if (!response.ok) throw new Error(result.error_description || result.error || "无法签发登录凭证。");
    if (result.state !== flow.state || result.redirect_uri !== flow.redirect_uri) {
      throw new Error("登录凭证与当前扩展请求不匹配。");
    }
    await sendExtensionResult({ code: result.code });
    sessionStorage.removeItem(FLOW_STORAGE_KEY);
    setStatus("登录已安全返回 Prompt Vault，本标签页将自动关闭。");
  } catch (error) {
    setStatus(error.message || "无法完成扩展登录。", true);
    continueButton.disabled = false;
  }
}

async function startOAuth(provider) {
  sessionStorage.setItem(PENDING_AUTH_METHOD_KEY, provider);
  setStatus(`正在前往 ${provider === "github" ? "GitHub" : "Google"}…`);
  const { error } = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${location.origin}${location.pathname}` },
  });
  if (error) {
    sessionStorage.removeItem(PENDING_AUTH_METHOD_KEY);
    throw error;
  }
}

async function initialize() {
  try {
    flow = parseFlow();
    client = window.ZaiyeSupabase?.getClient();
    if (!client) throw new Error("语藏登录服务尚未配置。");
    if (flow.consent === "accepted") {
      const checkbox = extensionLoginRoot.querySelector("#loginPolicyConsent");
      if (checkbox) checkbox.checked = true;
      loginConsent.refresh();
    }
    session = await getVerifiedWebsiteSession();
    const pendingAuthMethod = sessionStorage.getItem(PENDING_AUTH_METHOD_KEY) || "";
    if (session && ["github", "google"].includes(pendingAuthMethod)) {
      localStorage.setItem(LAST_AUTH_METHOD_KEY, pendingAuthMethod);
      sessionStorage.removeItem(PENDING_AUTH_METHOD_KEY);
    }
    history.replaceState(null, "", `${location.pathname}?${new URLSearchParams(flow)}`);
    if (flow.action === "signin" && ["github", "google"].includes(flow.provider)
      && loginConsent.allowed()
      && sessionStorage.getItem(providerStartMarker()) !== "started") {
      sessionStorage.setItem(providerStartMarker(), "started");
      if (session) {
        const { error: signOutError } = await client.auth.signOut({ scope: "local" });
        if (signOutError) throw signOutError;
        session = null;
      }
      await startOAuth(flow.provider);
      return;
    }
    if (session) showConsent(); else showLogin();
  } catch (error) {
    setStatus(error.message || "扩展登录请求无效。", true);
    loginPanel.hidden = true;
    consentPanel.hidden = true;
  }
}

oauthButtons.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-provider]");
  const provider = button?.dataset.provider;
  if (!provider) return;
  if (!loginConsent.allowed()) return setStatus("请先阅读并同意用户协议和隐私政策。", true);
  loginConsent.setBusy(button, true);
  try { await startOAuth(provider); } catch (error) {
    loginConsent.setBusy(button, false);
    setStatus(error.message, true);
  }
});

emailRequestForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!loginConsent.allowed()) return setStatus("请先阅读并同意用户协议和隐私政策。", true);
  const button = event.submitter;
  loginConsent.setBusy(button, true);
  sessionStorage.removeItem(PENDING_AUTH_METHOD_KEY);
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
    loginConsent.setBusy(button, false);
  }
});

emailVerifyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!loginConsent.allowed()) return setStatus("请先阅读并同意用户协议和隐私政策。", true);
  const button = event.submitter;
  loginConsent.setBusy(button, true);
  try {
    const token = new FormData(event.currentTarget).get("token").trim();
    const { data, error } = await client.auth.verifyOtp({ email: pendingEmail, token, type: "email" });
    if (error) throw error;
    session = data.session;
    if (!session) throw new Error("登录会话未建立。");
    const normalizedEmail = pendingEmail.toLowerCase();
    localStorage.setItem(LAST_AUTH_METHOD_KEY, "email");
    localStorage.setItem(LAST_AUTH_EMAIL_KEY, normalizedEmail);
    applyLastLoginHint(extensionLoginRoot, { method: "email", email: normalizedEmail });
    showConsent();
  } catch (error) {
    setStatus(error.message, true);
    loginConsent.setBusy(button, false);
  }
});

continueButton.addEventListener("click", authorizeExtension);
switchAccountButton.addEventListener("click", async () => {
  switchAccountButton.disabled = true;
  try {
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw error;
    session = null;
    sessionStorage.removeItem(PENDING_AUTH_METHOD_KEY);
    sessionStorage.removeItem(providerStartMarker());
    flow = { ...flow, provider: "" };
    sessionStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(flow));
    history.replaceState(null, "", `${location.pathname}?${new URLSearchParams(flow)}`);
    showLogin();
    setStatus("已退出当前网站账号，请重新选择登录方式。");
  } catch (error) {
    setStatus(error.message || "无法切换账号。", true);
  } finally {
    switchAccountButton.disabled = false;
  }
});

async function cancelAndClose() {
  cancelButton.disabled = true;
  closePageButton.disabled = true;
  try {
    await sendExtensionResult({ error: "access_denied", error_description: "User cancelled the authorization request." });
    sessionStorage.removeItem(FLOW_STORAGE_KEY);
    sessionStorage.removeItem(providerStartMarker());
    setStatus("已取消，正在返回 Prompt Vault。");
  } catch (error) {
    setStatus(error.message || "无法返回 Prompt Vault。", true);
    cancelButton.disabled = false;
    closePageButton.disabled = false;
  }
}

cancelButton.addEventListener("click", cancelAndClose);
closePageButton.addEventListener("click", cancelAndClose);

window.addEventListener("DOMContentLoaded", initialize, { once: true });
