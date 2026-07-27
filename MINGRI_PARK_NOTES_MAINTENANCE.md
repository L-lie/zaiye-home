# 《明日乐园》私人笔记维护说明

## 文件与安全边界

- 私人正文：`.private/mingri-park-heat-world.json`
- 私人原图目录：`.private/mingri-park-heat-world-assets/`
- 正式数据结构：`schemas/private-notebook.schema.json`
- 加密正文：`assets/content/mingri-park-heat-world.enc.json`
- 加密图片：`assets/content/secure-media/<32位随机十六进制名>.bin`
- 笔记入口：`notes.html`
- 内容页：`mingri-park-notes.html`

`.private` 已写入 `.gitignore`。私人 JSON、原图、密钥、本地绝对路径不得提交、上传或复制到公开目录。公开的 `.bin` 文件只有密文，随机文件名与图片内容、镜头号和原文件名没有对应关系。

## 私人图片登记

把原图放进 `.private/mingri-park-heat-world-assets/`，再在私人正文根级 `assets` 数组登记：

```json
{
  "assets": [
    {
      "assetId": "heat-square-shot-001",
      "source": "sequence-01/shot-001.png"
    },
    {
      "assetId": "heat-square-final-001",
      "source": "sequence-01/final-001.jpg"
    }
  ]
}
```

- `assetId` 必须唯一，建议使用稳定的英文小写短横线命名；图片换版时尽量保留原 ID。
- `source` 只能是相对于私人原图目录的路径，不能使用盘符、绝对路径、`..`、符号链接或目录。
- 输入只允许 JPEG、PNG、WebP，扩展名必须与真实格式一致。
- 单文件上限 40 MiB，单边上限 20,000 像素，总像素上限 80,000,000。
- `assets` 只登记文件；真正显示的位置由正文 block 引用 `assetId`。

## 单图 block

```json
{
  "type": "image",
  "assetId": "heat-square-shot-001",
  "alt": "广场原始镜头，远景中建筑轮廓被热雾遮挡",
  "caption": "原始镜头的空间层次偏平",
  "role": "shot",
  "sourceLabel": "SQ010_SH020",
  "credit": "项目内部截图"
}
```

必填字段为 `type`、`assetId`、`alt`、`role`。`caption`、`sourceLabel`、`credit` 可省略。

`role` 可用值：

- `shot`：原始镜头
- `revision`：镜头修改示意
- `final`：最终画面效果
- `reference`：视觉参考
- `comparison`：其他对比图

## 图集 block

```json
{
  "type": "gallery",
  "layout": "before-after",
  "items": [
    {
      "assetId": "heat-square-shot-001",
      "alt": "修改前的广场镜头",
      "caption": "修改前",
      "role": "shot",
      "sourceLabel": "SQ010_SH020"
    },
    {
      "assetId": "heat-square-final-001",
      "alt": "修改后的广场最终效果",
      "caption": "最终效果",
      "role": "final",
      "sourceLabel": "SQ010_SH020"
    }
  ]
}
```

`layout` 可用值：

- `grid`：普通多图网格，至少 1 张。
- `comparison`：多图对比，至少 2 张。
- `before-after`：前后对比，必须正好 2 张。

每个 `items` 成员使用与单图相同的图片引用字段，不写 `type`。手机端的对比布局会自动改为单列，所有图片都保持原比例，不会拉伸。

## 生成和验证

修改私人正文或原图后，在项目目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\update-mingri-park-notes.ps1
```

该命令会先运行不接触真实资料的合成安全测试，再：

1. 验证 JSON、重复 ID、引用和私人图片路径。
2. 为每张图生成最长边 640 px 的缩略图和最长边 2400 px 的展示图。
3. 转为 WebP 后，复用主人密钥生成独立图片密钥，并以 AES-GCM 分别加密。
4. 将图片尺寸、MIME、随机密文地址和 `assetId` 映射放进加密正文。
5. 清理不再被任何加密笔记引用的随机图片密文。

不会发布私人原图，也不会将图片转成明文 Base64。缩略图同样是密文。

验证已生成内容：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\validate-mingri-park-notes.ps1
```

验证会检查正文一致性、图片密文解密、WebP 尺寸、缺失文件、错误引用和孤立密文。只有在你本人准备更新真实私人内容时才运行这两个命令；网站维护对话不得主动读取 `.private`。

## 浏览器行为

图片只会在主人笔记解锁后按需下载和解密。页面使用 Blob URL 显示缩略图与大图；退出笔记、在统一入口点击“锁定”、会话失效或离开页面时会撤销 Blob URL。解密失败只显示“图片暂时无法显示”，不显示内部文件名或路径。

## 内容维护对话如何引用图片

以后给内容维护对话的指令只使用 `assetId`，不要粘贴本地绝对路径。例如：

> 在“热雾层次”知识点后添加 before-after 图集。修改前使用 `heat-square-shot-001`，修改后使用 `heat-square-final-001`；来源标签都写 `SQ010_SH020`。

如果是新图片，同时提供：

1. 希望使用的新 `assetId`。
2. 图片已放入私人原图目录后的相对路径。
3. `role`、无障碍 `alt`、图注和来源标签。

维护对话应先把新 ID 登记到根级 `assets`，再在知识点中引用；不得根据文件名自行猜测内容。

## Git 同步规则

可提交页面代码、schema、生成脚本、维护说明、加密正文和 `assets/content/secure-media/` 中的 `.bin` 密文。不得提交 `.private`、私人原图、密钥或临时解密文件。提交前应检查 `git status`，确认没有私人路径。
