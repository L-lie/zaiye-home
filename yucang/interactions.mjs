const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const copy = (locale, zh, en) => locale === "en" ? en : zh;

export function interactionEventLabel(eventType, locale = "zh") {
  const labels = {
    work_comment: ["评论了你的作品", "commented on your work"],
    work_question: ["向你的作品提问", "asked about your work"],
    comment_reply: ["回复了你的评论", "replied to your comment"],
    question_author_reply: ["作者回答了你的提问", "the author answered your question"],
  };
  const label = labels[eventType] || ["与你的作品产生了互动", "interacted with your work"];
  return copy(locale, label[0], label[1]);
}

export function groupCommentThreads(comments = []) {
  const roots = [];
  const rootById = new Map();
  for (const comment of comments) {
    if (!comment.parent_id) {
      const thread = { root: comment, replies: [] };
      roots.push(thread);
      rootById.set(comment.comment_id, thread);
    }
  }
  for (const comment of comments) {
    if (comment.parent_id && rootById.has(comment.parent_id)) {
      rootById.get(comment.parent_id).replies.push(comment);
    }
  }
  return roots;
}

function commentMeta(comment, locale) {
  const badges = [];
  if (comment.kind === "question") badges.push(`<span class="interaction-badge question">${copy(locale, "提问作者", "Question for author")}</span>`);
  if (comment.is_work_author) badges.push(`<span class="interaction-badge author">${copy(locale, "作者", "Author")}</span>`);
  return `
    <div class="interaction-meta">
      <strong>${escapeHtml(comment.author_nickname || copy(locale, "语藏用户", "Yucang member"))}</strong>
      ${badges.join("")}
      <time datetime="${escapeHtml(comment.created_at || "")}">${escapeHtml(comment.created_at_label || "")}</time>
    </div>`;
}

function replyMarkup(comment, locale) {
  return `
    <article class="interaction-reply" id="comment-${escapeHtml(comment.comment_id)}">
      ${commentMeta(comment, locale)}
      <p>${escapeHtml(comment.body)}</p>
    </article>`;
}

export function commentsSectionMarkup({ comments = [], isLoggedIn = false, locale = "zh" } = {}) {
  const threads = groupCommentThreads(comments);
  const composer = isLoggedIn ? `
    <form class="interaction-composer" data-comment-form>
      <div class="interaction-kind" role="radiogroup" aria-label="${copy(locale, "互动类型", "Interaction type")}">
        <label><input type="radio" name="interaction-kind" value="comment" checked /> <span>${copy(locale, "评论", "Comment")}</span></label>
        <label><input type="radio" name="interaction-kind" value="question" /> <span>${copy(locale, "提问作者", "Ask the author")}</span></label>
      </div>
      <label class="interaction-input">
        <span class="sr-only">${copy(locale, "评论内容", "Comment")}</span>
        <textarea maxlength="2000" required data-comment-body placeholder="${copy(locale, "说说你如何使用这条 Prompt，或请作者解释具体做法…", "Share how you use this Prompt, or ask the author to explain…")}"></textarea>
      </label>
      <div class="interaction-submit-row">
        <small>${copy(locale, "公开发布 · 最多 2,000 字", "Published publicly · 2,000 characters max")}</small>
        <button class="button primary" type="submit" data-comment-submit>${copy(locale, "发布", "Post")}</button>
      </div>
    </form>` : `
    <div class="interaction-login-note">
      <p>${copy(locale, "登录后可以评论、向作者公开提问和回复。", "Sign in to comment, ask the author publicly, and reply.")}</p>
      <a class="button" href="#/login">${copy(locale, "登录参与", "Sign in")}</a>
    </div>`;

  const threadMarkup = threads.length ? threads.map(({ root, replies }) => `
    <article class="interaction-thread" id="comment-${escapeHtml(root.comment_id)}">
      <div class="interaction-root">
        ${commentMeta(root, locale)}
        <p>${escapeHtml(root.body)}</p>
        ${isLoggedIn ? `<button class="interaction-reply-trigger" type="button" data-reply-to="${escapeHtml(root.comment_id)}" data-reply-author="${escapeHtml(root.author_nickname || "")}">${copy(locale, "回复", "Reply")}</button>` : ""}
      </div>
      ${replies.length ? `<div class="interaction-replies">${replies.map((reply) => replyMarkup(reply, locale)).join("")}</div>` : ""}
      ${isLoggedIn ? `<div class="interaction-inline-reply" data-reply-form-for="${escapeHtml(root.comment_id)}" hidden></div>` : ""}
    </article>`).join("") : `
    <div class="interaction-empty">
      <p>${copy(locale, "还没有讨论。成为第一个分享使用体验的人。", "No discussion yet. Be the first to share how you used it.")}</p>
    </div>`;

  return `
    <section class="community-discussion" id="discussion" data-community-discussion>
      <div class="community-discussion-head">
        <div><p class="eyebrow">COMMUNITY</p><h2>${copy(locale, "讨论与提问", "Discussion & questions")}</h2></div>
        <span>${comments.length} ${copy(locale, "条互动", "interactions")}</span>
      </div>
      ${composer}
      <div class="interaction-threads" data-comment-threads>${threadMarkup}</div>
    </section>`;
}

export function notificationPanelMarkup(notifications = [], locale = "zh") {
  const items = notifications.length ? notifications.map((item) => `
    <button class="notification-item${item.read_at ? "" : " is-unread"}" type="button"
      data-notification-id="${escapeHtml(item.notification_id)}"
      data-notification-work="${escapeHtml(item.work_id)}"
      data-notification-comment="${escapeHtml(item.comment_id)}">
      <span><strong>${escapeHtml(item.actor_nickname || copy(locale, "语藏用户", "Yucang member"))}</strong> ${escapeHtml(interactionEventLabel(item.event_type, locale))}</span>
      <small>${escapeHtml(item.work_title || "")} · ${escapeHtml(item.created_at_label || "")}</small>
      <em>${escapeHtml(item.comment_excerpt || "")}</em>
    </button>`).join("") : `<p class="notification-empty">${copy(locale, "暂时没有新通知。", "No notifications yet.")}</p>`;
  return `
    <div class="notification-panel-head">
      <strong>${copy(locale, "互动通知", "Notifications")}</strong>
      ${notifications.some((item) => !item.read_at) ? `<button type="button" data-notification-read-all>${copy(locale, "全部已读", "Mark all read")}</button>` : ""}
    </div>
    <div class="notification-list">${items}</div>`;
}
