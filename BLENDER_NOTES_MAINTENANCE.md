# Blender 学习笔记维护说明

## 文件位置

- 私人笔记源文件：`.private/blender-notes.json`
- 私人解锁密钥：`.private/blender-notes.key`
- 网站加密数据：`assets/content/blender-notes.enc.json`
- 笔记页面：`blender-notes.html`

`.private` 已写入 `.gitignore`，原文和密钥不会上传 GitHub。不要把 `.private` 目录中的内容发给别人。

## 更新网站笔记

1. 修改 `.private/blender-notes.json`。
2. 在项目目录运行：

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\update-blender-notes.ps1
   ```

3. 本地预览确认内容。
4. 提交并推送生成的 `assets/content/blender-notes.enc.json`。GitHub Pages 会自动重新部署。

验证源文件和加密数据是否一致：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\validate-blender-notes.ps1
```

第一次运行更新命令时会自动生成 `.private/blender-notes.key`。打开网站时需要输入这个文件里的密钥。密钥丢失后无法解密已经发布的数据，但可以重新生成密钥并重新加密源文件。

## 新增大分类

在 `categories` 数组中增加：

```json
{
  "id": "materials",
  "title": "材质与贴图",
  "keywords": ["材质", "贴图", "shader"],
  "sections": []
}
```

`id` 使用不重复的英文小写名称。

## 新增小分类

在对应大分类的 `sections` 数组中增加：

```json
{
  "id": "image-texture",
  "title": "添加图片贴图",
  "functionNames": ["Image Texture", "Shader Editor"],
  "shortcuts": ["Shift + A"],
  "blocks": []
}
```

搜索会同时读取大分类标题、关键词、小分类标题、功能名称、快捷键和正文。

## 内容类型

段落：

```json
{ "type": "paragraph", "text": "普通文字，`快捷键`，**重点文字**。" }
```

有序步骤：

```json
{ "type": "ordered-list", "items": ["第一步", "第二步"] }
```

无序列表：

```json
{ "type": "unordered-list", "items": ["项目一", "项目二"] }
```

提示：

```json
{ "type": "tip", "text": "需要特别注意的内容。" }
```

快捷键组：

```json
{
  "type": "shortcuts",
  "items": [
    { "keys": "Shift + A", "action": "打开添加菜单" }
  ]
}
```

表格：

```json
{
  "type": "table",
  "columns": ["功能", "说明"],
  "rows": [
    ["功能名称", "具体说明"]
  ]
}
```

JSON 最后一项后面不要保留逗号。修改完成后一定运行更新命令，网站不会直接读取私人原文。

## 给记笔记对话框的固定说明

```text
官网项目路径：E:\work\3.工作室\llie-studio-site
Blender 私人笔记源文件：E:\work\3.工作室\llie-studio-site\.private\blender-notes.json
维护说明：E:\work\3.工作室\llie-studio-site\BLENDER_NOTES_MAINTENANCE.md

请把新内容加入 Blender 私人笔记源文件，保持现有 JSON 结构。完成修改后运行：
powershell -ExecutionPolicy Bypass -File E:\work\3.工作室\llie-studio-site\scripts\update-blender-notes.ps1

这会同步生成官网使用的加密笔记。不要读取、显示或发送 .private\blender-notes.key，也不要把 .private 目录提交到 GitHub。修改后告诉我改了哪些分类和笔记；未经我明确授权，不要提交或推送。
```
