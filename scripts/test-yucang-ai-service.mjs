import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("yucang/app.js");
const html = read("yucang/index.html");
const css = read("yucang/app.css");
const pricing = read("YUCANG_HOSTED_AI_PRICING.md");

assert.doesNotMatch(html, /href="#\/ai-service" data-nav="ai-service"/);
assert.match(app, /class="my-account-card" href="#\/ai-service"/);
assert.match(app, /section === "ai-service"\) return renderAiService\(\)/);
assert.match(app, /function renderAiService\(\)/);
assert.match(css, /\.ai-service-page/);

const pageStart = app.indexOf("function renderAiService()");
const pageEnd = app.indexOf("\nasync function ", pageStart);
const page = app.slice(pageStart, pageEnd > pageStart ? pageEnd : app.length);

for (const text of [
  "价格公示",
  "充值与托管 AI 尚未开放",
  "100 点 = 人民币 1 元",
  "经济模型 · 输入",
  "经济模型 · 输出",
  "品质模型 · 输入",
  "品质模型 · 输出",
  "每次请求最低扣 2 点",
  "1000 点",
  "3200 点",
  "8000 点",
  "一次性获得 100 点体验点",
  "¥9.9",
  "¥29",
  "¥69",
  "不自动续费",
  "不允许透支",
  "付费点永久有效",
  "BYOK",
  "本地基础功能永久免费且无需登录",
  "平台不收取 AI 服务费",
  "Key 只保存在本机",
  "模型商费用由用户承担",
  "不会扫描、搜索或枚举扩展私库",
  "登录不会上传本地 Prompt",
  "云同步仍然关闭",
  "约 2000 输入 token + 1000 输出 token",
  "约 6 点（¥0.06）",
  "约 12 点（¥0.12）",
  "图片尺寸",
  "失败且没有产生有效模型结果时不扣点",
  "不可变用量账本",
  "当前继续使用自带 API",
  "查看如何配置自带 API",
]) assert.ok(page.includes(text), `AI service page missing: ${text}`);

for (const url of [
  "https://api-docs.deepseek.com/zh-cn/quick_start/pricing/",
  "https://help.aliyun.com/zh/model-studio/model-pricing",
  "https://supabase.com/docs/guides/functions/pricing",
]) {
  assert.ok(page.includes(url), `AI service page missing source: ${url}`);
  assert.ok(pricing.includes(url), `pricing document missing source: ${url}`);
}

assert.ok(!page.includes("立即购买"));
assert.ok(!page.includes("Buy now"));
assert.ok(!page.includes("data-buy"));
assert.ok(!page.includes("余额："));
assert.ok(!page.includes("Balance:"));

for (const text of [
  "毛利压力测试",
  "100 语藏点 = 人民币 1 元",
  "每次请求最低扣 2 点",
  "合法收款主体",
  "签名 webhook",
  "退款、发票与对账",
  "用户协议、隐私政策",
  "Gemini 3.5 Flash-Lite",
  "OpenAI GPT-4.1 mini",
  "DeepSeek v4 flash",
]) assert.ok(pricing.includes(text), `pricing document missing: ${text}`);

console.log("Yucang hosted AI pricing tests passed.");
