function escapeAttribute(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function loginControlsMarkup({ assetRoot, showStatus = false } = {}) {
  const root = escapeAttribute(assetRoot || "../");
  return `
    ${showStatus ? '<div id="status" class="login-status" role="status" aria-live="polite">正在检查登录状态...</div>' : ""}
    <section id="loginPanel">
      <div class="login-method-row">
        <span>其他登录方式</span>
        <div id="oauthButtons" class="login-oauth-icons">
          <button class="login-provider-icon" type="button" data-provider="github" data-oauth="github" aria-label="使用 GitHub 登录" title="使用 GitHub 登录">
            <img src="${root}/auth/assets/github.svg" alt="" width="20" height="20" />
          </button>
          <button class="login-provider-icon" type="button" data-provider="google" data-oauth="google" aria-label="使用 Google 登录" title="使用 Google 登录">
            <img src="${root}/auth/assets/google.svg" alt="" width="20" height="20" />
          </button>
        </div>
      </div>
      <div id="emailPanel" class="login-email-panel">
        <div class="login-divider"><span>邮箱验证码</span></div>
        <form id="emailRequestForm" class="login-form">
          <label for="loginEmail">邮箱</label>
          <div class="login-input-action">
            <input id="loginEmail" name="email" type="email" autocomplete="email" required />
            <button type="submit">发送验证码</button>
          </div>
        </form>
        <form id="emailVerifyForm" class="login-form" hidden>
          <label for="loginToken">验证码</label>
          <div class="login-input-action">
            <input id="loginToken" name="token" inputmode="numeric" autocomplete="one-time-code" minlength="6" maxlength="8" required />
            <button type="submit">验证并登录</button>
          </div>
        </form>
      </div>
    </section>`;
}

export function loginExperienceMarkup({
  assetRoot,
  logoSrc,
  title = "登录语藏",
  description = "使用同一个 Prompt Vault 账号进入语藏。",
  controls = "",
  footer = "登录不会上传、同步或公开你扩展中的本地 Prompt。",
} = {}) {
  const root = escapeAttribute(assetRoot || "../");
  return `
    <section class="login-experience" aria-labelledby="loginExperienceTitle">
      <aside class="login-showcase" aria-label="语藏与 Prompt Vault 功能展示">
        <div class="login-showcase-copy">
          <p>从灵感到长期复用</p>
          <h2>把散落的 Prompt<br />收进自己的创作系统</h2>
        </div>
        <div class="login-slides" data-login-slides>
          <figure class="login-slide is-active" data-login-slide>
            <img src="${root}/assets/prompt-vault-desktop.png" alt="Prompt Vault 桌面端的分类、搜索与 Prompt 查看界面" width="1520" height="1160" />
            <figcaption><strong>收集与整理</strong><span>分类、搜索、编辑和复用自己的 Prompt</span></figcaption>
          </figure>
          <figure class="login-slide" data-login-slide hidden>
            <img src="${root}/assets/prompt-vault-mobile.png" alt="Prompt Vault 窄窗口中的 Prompt 卡片与快捷操作" width="720" height="1196" />
            <figcaption><strong>随时调用</strong><span>在不同窗口中快速找到需要的内容</span></figcaption>
          </figure>
          <figure class="login-slide" data-login-slide hidden>
            <img src="${root}/assets/prompt-vault-product.jpg" alt="Prompt Vault 桌面端与移动端产品界面组合展示" width="5280" height="3300" />
            <figcaption><strong>连接语藏社区</strong><span>发现公开作品，再收进自己的 Prompt Vault</span></figcaption>
          </figure>
        </div>
        <div class="login-slide-controls" role="group" aria-label="切换功能展示">
          <button class="is-active" type="button" data-login-slide-to="0" aria-label="查看收集与整理" aria-pressed="true"></button>
          <button type="button" data-login-slide-to="1" aria-label="查看随时调用" aria-pressed="false"></button>
          <button type="button" data-login-slide-to="2" aria-label="查看连接语藏社区" aria-pressed="false"></button>
        </div>
      </aside>
      <div class="login-entry">
        <div class="login-entry-inner">
          <header class="login-brand-block">
            <img src="${escapeAttribute(logoSrc)}" alt="" width="62" height="62" />
            <div><strong>语藏</strong><span>PROMPT VAULT</span></div>
          </header>
          <h1 id="loginExperienceTitle">${title}</h1>
          <p class="login-description">${description}</p>
          <div class="login-controls">${controls}</div>
          <p class="login-privacy">${footer}</p>
        </div>
      </div>
    </section>`;
}

export function bindLoginShowcase(root) {
  const slides = [...root.querySelectorAll("[data-login-slide]")];
  const controls = [...root.querySelectorAll("[data-login-slide-to]")];
  if (slides.length < 2 || slides.length !== controls.length) return () => {};
  let active = 0;
  let timer = null;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const show = (index) => {
    active = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      const selected = slideIndex === active;
      slide.hidden = !selected;
      slide.classList.toggle("is-active", selected);
    });
    controls.forEach((control, controlIndex) => {
      const selected = controlIndex === active;
      control.classList.toggle("is-active", selected);
      control.setAttribute("aria-pressed", String(selected));
    });
  };
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
  const start = () => {
    stop();
    if (!reducedMotion) timer = setInterval(() => show(active + 1), 5200);
  };
  controls.forEach((control) => control.addEventListener("click", () => {
    show(Number(control.dataset.loginSlideTo));
    start();
  }));
  root.addEventListener("mouseenter", stop);
  root.addEventListener("mouseleave", start);
  root.addEventListener("focusin", stop);
  root.addEventListener("focusout", start);
  start();
  return stop;
}
