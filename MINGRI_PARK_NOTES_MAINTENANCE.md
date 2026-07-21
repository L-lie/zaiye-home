# 《明日乐园》高温末世视觉设定维护说明

## 文件位置

- 私人源文件：`.private/mingri-park-heat-world.json`
- 网站加密数据：`assets/content/mingri-park-heat-world.enc.json`
- 加密笔记本清单：`assets/content/notes-library.enc.json`
- 公开笔记本清单：`assets/content/notes-public.json`
- 笔记页面：`mingri-park-notes.html`
- 共用详情页脚本：`notebook.js`

`.private` 已写入 `.gitignore`。私人源文件和密钥不得读取、显示、发送、提交或上传。

## 更新笔记

修改私人源文件后，在官网项目目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\update-mingri-park-notes.ps1
```

该命令只重新加密《明日乐园》笔记，同时刷新加密笔记本清单和公开笔记本清单。

验证生成结果：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\validate-mingri-park-notes.ps1
```

## 新增大分类

在 `categories` 数组中增加：

```json
{
  "id": "heat-environment",
  "title": "高温环境",
  "keywords": ["高温", "热浪", "末世"],
  "sections": []
}
```

`id` 必须使用不重复的英文小写名称。

## 新增小分类

在对应大分类的 `sections` 数组中增加：

```json
{
  "id": "heat-haze",
  "title": "热浪与空气畸变",
  "functionNames": ["热浪", "空气透视"],
  "shortcuts": [],
  "blocks": []
}
```

搜索会读取大分类标题与关键词、小分类标题、功能名称、快捷键和正文。

## 内容类型

```json
{ "type": "paragraph", "text": "普通段落" }
```

```json
{ "type": "ordered-list", "items": ["第一步", "第二步"] }
```

```json
{ "type": "unordered-list", "items": ["要点一", "要点二"] }
```

```json
{ "type": "tip", "text": "需要特别注意的内容" }
```

```json
{
  "type": "shortcuts",
  "items": [{ "keys": "快捷键", "action": "操作说明" }]
}
```

```json
{
  "type": "table",
  "columns": ["项目", "说明"],
  "rows": [["设定项", "具体说明"]]
}
```

## 控制上一层展示

私人源文件根级的 `publicVisible` 控制未解锁页面是否显示这份笔记本：

```json
"publicVisible": false
```

- `false`：未解锁页面不显示笔记本卡片。
- `true`：只显示标题、简介、分类数量和入口，不公开正文和目录。

修改后仍需运行更新命令，公开状态才会写入网站生成文件。

## 同步规则

同步官网时只提交公开页面代码、生成脚本、维护说明和 `assets/content` 中的加密产物。不得提交 `.private` 目录中的任何文件。
