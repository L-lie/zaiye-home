import assert from "node:assert/strict";
import fs from "node:fs";
import {
  commentsSectionMarkup,
  groupCommentThreads,
  interactionEventLabel,
  notificationPanelMarkup,
} from "../yucang/interactions.mjs";

const comments = [
  { comment_id: "root-1", parent_id: null, kind: "question", author_nickname: "提问者", body: "参数怎么设置？", created_at_label: "刚刚", is_work_author: false },
  { comment_id: "reply-1", parent_id: "root-1", kind: "reply", author_nickname: "作者", body: "建议从 0.7 开始。", created_at_label: "刚刚", is_work_author: true },
];

const threads = groupCommentThreads(comments);
assert.equal(threads.length, 1);
assert.equal(threads[0].replies.length, 1);

const guest = commentsSectionMarkup({ comments, isLoggedIn: false, locale: "zh" });
assert.match(guest, /提问作者/);
assert.match(guest, /登录后可以评论/);
assert.doesNotMatch(guest, /data-comment-form/);
assert.doesNotMatch(guest, /data-reply-to/);

const member = commentsSectionMarkup({ comments, isLoggedIn: true, locale: "zh" });
assert.match(member, /data-comment-form/);
assert.match(member, /value="comment" checked/);
assert.match(member, /value="question"/);
assert.match(member, /data-reply-to="root-1"/);
assert.match(member, /id="comment-reply-1"/);
assert.doesNotMatch(member, /password|私信/);

assert.equal(interactionEventLabel("question_author_reply", "zh"), "作者回答了你的提问");
const panel = notificationPanelMarkup([{
  notification_id: "notice-1",
  event_type: "work_comment",
  work_id: "work-1",
  work_title: "测试作品",
  comment_id: "root-1",
  comment_excerpt: "很好用",
  actor_nickname: "读者",
  created_at_label: "刚刚",
  read_at: null,
}], "zh");
assert.match(panel, /data-notification-read-all/);
assert.match(panel, /data-notification-work="work-1"/);
assert.match(panel, /data-notification-comment="root-1"/);
assert.match(panel, /is-unread/);

const appSource = fs.readFileSync(new URL("../yucang/app.js", import.meta.url), "utf8");
const indexSource = fs.readFileSync(new URL("../yucang/index.html", import.meta.url), "utf8");
const cssSource = fs.readFileSync(new URL("../yucang/interactions.css", import.meta.url), "utf8");
assert.match(appSource, /yucang_list_comments/);
assert.match(appSource, /yucang_create_comment/);
assert.match(appSource, /yucang_list_notifications/);
assert.match(appSource, /yucang_notification_unread_count/);
assert.match(appSource, /prompt\/\$\{item\.dataset\.notificationWork\}\/comment\/\$\{item\.dataset\.notificationComment\}/);
assert.match(appSource, /childId === "comment" \? detailId/);
assert.match(indexSource, /interactions\.css\?v=20260827-interactions1/);
assert.match(indexSource, /app\.js\?v=20260827-cardsidebar1/);
assert.match(cssSource, /\.notification-panel/);
assert.match(cssSource, /\.is-notification-target/);

console.log("Yucang interaction UI contract tests passed.");
