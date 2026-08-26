import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("yucang/app.js");
const html = read("yucang/index.html");
const css = read("yucang/app.css");
const pricing = read("YUCANG_HOSTED_AI_PRICING.md");

assert.match(html, /href="#\/ai-service" data-nav="ai-service"/);
assert.match(app, /section === "ai-service"\) return renderAiService\(\)/);
assert.match(app, /function renderAiService\(\)/);
assert.match(css, /\.ai-service-page/);

const pageStart = app.indexOf("function renderAiService()");
const pageEnd = app.indexOf("\nasync function ", pageStart);
const page = app.slice(pageStart, pageEnd > pageStart ? pageEnd : app.length);

for (const text of [
  "价格公示",
  "购买尚未开放",
  "DeepSeek V4 Flash",
  "DeepSeek V4 Pro",
  "Qwen3-VL-Flash",
  "4,000 输入 token",
  "2,000 输出 token",
  "标准文本",
  "图像理解",
  "进阶推理",
  "30 额度",
  "240 额度",
  "750 额度",
  "1800 额度",
  "¥9.9",
  "¥29",
  "¥69",
  "不自动续费",
  "BYOK",
  "平台不收取 AI 服务费",
  "Key 只保存在本机",
  "不会扫描、搜索或枚举扩展私库",
  "登录不会上传本地 Prompt",
  "云同步仍然关闭",
  "退款规则公示",
  "购买后 7 天内且未使用",
  "赠送额度不折现",
  "不可变用量账本",
  "不提供无限量套餐",
  "No unlimited plans are offered",
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
assert.ok(!page.includes("OpenAI/Gemini/Groq"));

for (const text of [
  "毛利压力测试",
  "商户主体",
  "支付宝、微信支付或合规收单服务",
  "签名 webhook",
  "订单、退款、发票和财务对账",
  "用户协议、隐私政策",
  "Customer Application",
  "不转售 API Key",
]) assert.ok(pricing.includes(text), `pricing document missing: ${text}`);

console.log("Yucang hosted AI pricing tests passed.");
