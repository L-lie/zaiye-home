# Supabase 未来远程后台备用说明

当前作品维护已改为仅绑定 `127.0.0.1` 的 Codex 本地编辑器，不需要邮箱、密码、验证码或 Supabase Auth。请不要为当前编辑流程修改邮件模板，也不要删除已经建立的 Supabase 数据结构。

## 已保留的备用基础

- `supabase/schema.sql`：主人资料与原有私人数据权限基础。
- `supabase/portfolio.sql`：作品草稿、发布历史、资产登记与 Storage RLS。
- `supabase/verify-portfolio-policies.sql`：只读核查四条 Storage owner policy。
- `portfolio-originals`：私人原图桶，限制 JPG、PNG、WebP。
- `portfolio-public`：公开水印 WebP 桶。
- `supabase-config.js`：只包含可公开的 Project URL 与 `sb_publishable_` key。

这些文件和桶供未来需要远程后台时继续开发。目前 `admin.html` 不加载 Supabase 客户端，不依赖登录会话；作品页仍保留对既有正式发布数据的兼容读取，并在没有远程正式版本时读取仓库内静态 JSON。

## 绝对不要提供或提交

- 数据库密码
- Secret key、`service_role` key 或以 `sb_secret_` 开头的 key
- GitHub token
- `.private/`、主人原图或任何本地绝对路径

浏览器端最多只能使用 Project URL 和以 `sb_publishable_` 开头的公开 key，真正权限必须由 RLS 控制。

## 只读权限核查

在 Supabase SQL Editor 运行 `supabase/verify-portfolio-policies.sql`。结果应正好有 4 行，并且每行的 `policy_exists`、`covers_originals`、`covers_public`、`checks_owner`、`checks_owner_folder` 均为 `true`。Dashboard bucket 列表里的 policy 数量只是界面归类，不能代替这项核查。

匿名检查应继续满足：

- 不能读取私人草稿、私人资产或发布历史。
- 不能修改正式发布数据。
- 不能列出或下载 `portfolio-originals`。
- 可以读取 `portfolio-public` 中已经烘焙水印的 WebP，但不能写入。

## 当前实际维护方式

请按 `LOCAL_PORTFOLIO_EDITOR.md` 启动本地编辑器。Supabase 备用配置不参与本地草稿、图片处理或静态发布，也不应为了本地编辑器而回滚。
