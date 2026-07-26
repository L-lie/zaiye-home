# Supabase 权限基础配置

这次只建立未来登录与权限分层所需的数据库结构和本地配置模板；现有官网页面、作品页、Canvas、学习笔记均未改动，也没有接入登录界面。

## 一次性配置

1. 在 [Supabase](https://supabase.com/) 创建项目。
2. 在 Authentication > Providers 中启用 Email 登录。
3. 打开 SQL Editor，执行 [`supabase/schema.sql`](supabase/schema.sql) 全部内容。
4. 后续用邮箱注册你的站长账号后，在 SQL Editor 执行下列 SQL，把该账号设成站长：

```sql
update public.profiles as profile
set site_role = 'owner'
from auth.users as user_account
where profile.id = user_account.id
  and lower(user_account.email) = lower('YOUR_OWNER_EMAIL');
```

5. 以后接入前端时，将 `.env.example` 复制为 `.env`，填入项目地址和 publishable key。

## 以后只需要提供

```text
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
OWNER_EMAIL=
```

不要提供密码、`service_role` key、GitHub token、分享链接的原始口令或 `.private/` 内容。

## 当前权限模型

- 未登录访客：只能访问公开官网内容。
- 普通登录用户：只能读取和编辑自己创建的私人笔记本与画布。
- 站长账号：拥有自己的私人笔记本、画布及其分享链接。
- 公开主页和作品页的正式编辑：以后应由受保护的服务端 API 或后台完成；不能仅凭浏览器中的角色让用户直接改 GitHub 静态文件。

## 未来分享链接

每个笔记本以后由服务端生成随机 token；数据库只保存 token 的哈希。分享链接可设置密码、到期时间和撤销状态，验证必须通过服务端接口完成，不能为匿名访问开放 RLS。

## 现有内容

现有加密笔记、Canvas 数据与 `.private/` 内容没有被读取、迁移或提交。这套数据库结构只作为后续真实登录和权限控制的基础。

## 上线前检查

- 匿名请求不能读取 `private_notebooks` 与 `private_canvases`。
- 账号 A 无法读取或修改账号 B 的记录。
- 站长账号可以管理自己的私人记录与分享链接。
- `notebook_share_links` 没有匿名查询策略。
