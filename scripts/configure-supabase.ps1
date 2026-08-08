$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $projectRoot "supabase-config.js"

$projectUrl = (Read-Host "Supabase Project URL（https://xxxx.supabase.co）").Trim()
if ($projectUrl -notmatch '^https://[a-z0-9-]+\.supabase\.co/?$') {
  throw "Project URL 格式不正确。"
}

$publishableKey = (Read-Host "Supabase Publishable key（sb_publishable_ 开头）").Trim()
if ($publishableKey -notmatch '^sb_publishable_') {
  throw "这里只允许填写 Publishable key。不要填写 Secret 或 service_role key。"
}

$config = @"
window.ZAIYE_SUPABASE_CONFIG = Object.freeze({
  url: "$projectUrl",
  publishableKey: "$publishableKey",
});
"@

[System.IO.File]::WriteAllText($configPath, $config, [System.Text.UTF8Encoding]::new($false))
Write-Host "已写入 $configPath"
Write-Host "没有保存数据库密码、Secret key、service_role key 或主人登录密码。"
