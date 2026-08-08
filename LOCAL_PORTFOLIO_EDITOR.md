# Codex 本地作品编辑器

## 启动

在网站仓库根目录运行：

```powershell
npm run editor:portfolio
```

浏览器打开：

```text
http://127.0.0.1:8765/admin.html
```

服务只监听 `127.0.0.1`，不对局域网或公网开放。不要直接用 `file://` 打开 `admin.html`。

## 可以做什么

- 编辑器左侧直接显示与正式作品页一致的网页，不是脱离页面的后台表格。
- 直接点击作品名、说明、项目名称和介绍修改文字。
- 选中文字后可在右侧调整字号、颜色和字重，并可恢复网页默认样式。
- 拖动整张作品卡、同组图片或项目卡调整公开页面顺序。
- 点击作品图片或项目封面后，在右侧选择新图片并替换。
- 可切换电脑和手机宽度检查实际排版。
- 新增、编辑、复制、删除和排序作品图片条目。
- 新增、编辑、删除和排序项目入口。
- 上传或替换作品图、项目封面，并立即预览。
- 保存私人草稿，或把确认后的内容发布到官网静态数据文件。
- 导入、导出作品 JSON 备份。

## 图片与水印规则

- 只接受 JPG、PNG、WebP，单张不超过 30 MB。
- 原图随机命名后保存在 `.private/portfolio-editor/originals/`，禁止提交 Git。
- 公开目录只生成受控尺寸的 WebP：1280px 预览图和 2400px 展示图。
- 两种公开 WebP 都在像素中烘焙小号、低透明度、斜向阵列的“再野文化”文字水印。
- 网页不会收到私人原图路径或内部文件名。

## 草稿与发布

- “保存草稿”只写 `.private/portfolio-editor/draft.json`，不会改变官网。
- “发布到官网文件”会先备份当前静态索引，再更新：
  - `assets/portfolio/portfolio-index.json`
  - `assets/portfolio/portfolio-media.json`
  - `assets/portfolio/portfolio-projects.json`
- 本地网页不会运行 Git 命令。发布到正式域名仍由 Codex 审查差异、精确提交、推送并验证。

## 安全边界

- 写请求必须来自同一 localhost origin，并携带编辑器专用标记。
- 服务拒绝路径穿越、本地绝对路径、Base64/Blob 文件地址、非法 MIME、超大请求、重复 ID 和异常数量。
- 静态文件服务拒绝访问 `.private`、`.git`、`node_modules`。
- Supabase 现为未来远程后台备用，不是本地编辑器的依赖。

## 验证

```powershell
npm run test:portfolio-editor
npm run test:supabase
```

端到端测试使用独立临时私人目录，测试后恢复原静态 JSON 并清理临时图片，不会保留测试项目。
