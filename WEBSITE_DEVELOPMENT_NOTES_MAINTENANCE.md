# 官网开发实操笔记维护说明

## 文件位置

- 私人源文件：`.private/website-development-notes.json`
- 公开加密文件：`assets/content/website-development-notes.enc.json`
- 私人笔记总索引：`assets/content/notes-library.enc.json`
- 公开清单：`assets/content/notes-public.json`
- 内容页：`website-development-notes.html`

`.private` 和共享密钥文件不得提交 Git。网页、公开 JSON 和提交信息中也不得出现本地绝对路径、密码、验证码、Secret key、service_role key 或数据库密码。

## 从定稿 Markdown 重新导入

在仓库根目录执行：

```powershell
node scripts/import-website-development-notes.mjs '<定稿 Markdown 文件路径>'
```

导入器按二级标题建立分类、三级标题建立目录小节，并保留段落、提示、列表、表格和围栏代码块。导入后应先检查私人 JSON 的标题层级，不要直接发布来源不明或含敏感信息的 Markdown。

## 生成与验证

```powershell
powershell -ExecutionPolicy Bypass -File scripts/update-website-development-notes.ps1
powershell -ExecutionPolicy Bypass -File scripts/validate-website-development-notes.ps1
node scripts/test-website-development-notes.mjs
```

更新脚本会使用当前 `.private` 中的全部已配置私人笔记重新生成各自密文、私人总索引和公开清单，避免用旧输出覆盖其他笔记的新内容。

验证完成后还要确认：

1. `notes.html` 解锁后能看到第三本“从本地项目到真正上线”笔记。
2. 进入内容页后目录可以跳转，正文关键词可以搜索。
3. `assets/content/notes-public.json` 不包含 `website-development`，也不包含正文、分类或代码块。
4. Git 暂存列表不包含 `.private`、共享密钥或与本笔记无关的文件。
