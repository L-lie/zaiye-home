# 再野文化工作室官网

一个面向中国客户的影视美术 / 视觉设计个人工作室静态官网。

## 域名方向

- `llie.com`
- `llie.studio`
- `llie.art`
- `llie.design`
- `llie-lab.com`
- `llie.works`
- `zaiye.studio`
- `zaiyeculture.com`

如果主要服务国内客户，也可以考虑：

- `lliestudio.cn`
- `llieart.cn`
- `llie-design.cn`

## 修改建议

- 简历 PPT 里的图片已经抽到 `assets/portfolio/`，索引在 `assets/portfolio/portfolio-index.json`。
- 首页卡片可以先用 `assets/portfolio/` 里的图替换；后续再按项目拆成详情页。
- `assets/hero-production-design.png` 目前是气质占位图，后续可以换成真实片场图、置景图或作品拼贴。
- 把 `index.html` 里的项目名、职责、年份继续替换为更完整的真实履历。
- Prompt Vault 作为浏览器提示词工具入口，后续可以独立成产品页或精选 prompt 库。

## 作品编辑器

- 运行 `npm run editor:portfolio`，再打开 `http://127.0.0.1:8765/admin.html`，即可在本机编辑作品、项目入口和图片顺序。
- 草稿和上传原图只进入 `.private/portfolio-editor/`；公开目录只保存压缩后的 WebP，并自动烘焙小号斜向“再野文化”水印。
- 点击“发布到官网文件”会更新静态作品索引；之后仍由 Codex 精确提交和上线，不向网页暴露 Git 或命令执行能力。
- 本地编辑器使用说明见 `LOCAL_PORTFOLIO_EDITOR.md`；Supabase 配置保留为未来远程后台备用，见 `SUPABASE_SETUP.md`。
