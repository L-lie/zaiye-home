import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [app, interactions, css, rules, migration, index] = await Promise.all([
  readFile(new URL("../yucang/app.js", import.meta.url), "utf8"),
  readFile(new URL("../yucang/interactions.mjs", import.meta.url), "utf8"),
  readFile(new URL("../yucang/app.css", import.meta.url), "utf8"),
  readFile(new URL("../yucang/rules.html", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260902000200_yucang_governance_reports_appeals.sql", import.meta.url), "utf8"),
  readFile(new URL("../yucang/index.html", import.meta.url), "utf8"),
]);

for (const table of ["yucang_reports", "yucang_report_events", "yucang_appeals"]) {
  assert.match(migration, new RegExp(`create table public\\.${table}`));
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  assert.match(migration, new RegExp(`revoke all on public\\.${table} from anon, authenticated`));
}
assert.match(migration, /before update or delete on public\.yucang_report_events/);
assert.match(migration, /grant execute on function public\.yucang_submit_report\(text, uuid, text, text, text, text\) to anon, authenticated/);
assert.doesNotMatch(migration, /grant (select|insert|update|delete).*yucang_reports.*anon/i);
assert.match(migration, /if caller is null and .*contact_email/s);
assert.match(migration, /duplicate_open_report/);
assert.match(migration, /rate_limited/);
assert.match(migration, /private\.yucang_can_review\(\)/);
assert.match(migration, /restrict_work_from_report/);
assert.match(migration, /hide_comment_from_report/);
assert.match(migration, /resolve_appeal_/);

assert.match(app, /data-report-work/);
assert.match(app, /data-report-account/);
assert.match(app, /data-report-official/);
assert.match(interactions, /data-report-comment/);
assert.match(app, /#\/governance/);
assert.match(app, /#\/admin\/reports/);
assert.match(app, /yucang_submit_report/);
assert.match(app, /yucang_submit_appeal/);
assert.match(app, /yucang_admin_resolve_report/);
assert.match(app, /yucang_admin_resolve_appeal/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.governance-card/);
assert.match(index, /20260903-exits1/);

for (const heading of ["公开发布要求", "免费作品授权", "可以举报的情形", "处理流程", "知识产权投诉", "申诉与人工复核", "信息使用与记录保留"]) {
  assert.ok(rules.includes(heading), `missing governance rules section: ${heading}`);
}
assert.ok(rules.includes("私人 Prompt 备份不属于社区公开内容"));

console.log("Yucang governance contract checks passed");
