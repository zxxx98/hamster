# 家藏

家庭共享消耗品库存 PWA：扫码或手动录入商品，记录房间和存放点，按需补货并在低库存时提醒。

## 当前部署

- Web：`http://158.178.243.20:24000`
- Supabase API：`https://supabase.980204.xyz`
- 静态站点由 `hamster-web` Docker 容器提供；SPA 深链接会回退至 `index.html`。

## 首次创建家庭

在服务器执行以下命令，将 `CREATOR_USERNAME` 与 `CREATOR_TOKEN` 替换为最终值。账号为 3–32 位小写字母、数字、下划线或连字符；Token 至少 16 位。

```bash
read -rsp '初始化密钥: ' setup_secret; echo
read -rp '创建者账号: ' creator_username
read -rsp '创建者 Token: ' creator_token; echo
anon_key=$(sudo sed -n 's/^ANON_KEY=//p' /opt/supabase/.env)
curl --fail --silent --show-error \
  -H "apikey: $anon_key" \
  -H "Content-Type: application/json" \
  -H "x-initial-setup-secret: $setup_secret" \
  -d "{\"username\":\"$creator_username\",\"token\":\"$creator_token\",\"householdName\":\"我的家庭\"}" \
  http://127.0.0.1:23020/functions/v1/bootstrap-household
```

成功后立即删除 `/opt/supabase/.env.initial-setup`，然后执行：

```bash
cd /opt/supabase
sudo docker compose --env-file .env up -d functions
```

函数会从数据库层拒绝第二个家庭，但删除初始化密钥仍是必须的安全步骤。

## 更新前端

```bash
cd /home/ubuntu/code/personal/hamster
npm run build
sudo docker restart hamster-web
```

构建时 `.env.local` 仅包含公开的 Supabase URL 与匿名公钥；服务角色密钥、Free API 凭据及初始化密钥均只存在服务器受保护环境文件中。

## 手动验收清单

- 真机打开 Web 地址并安装 PWA。
- 首次使用创建者账号和 Token 登录；关闭后重新打开无需再次输入。
- 扫描商品条码；查询失败时手动填写；拍照或选取 JPG/PNG/WebP 图片。
- 保存商品到房间和存放点，检查库存列表、详情和图片/位置。
- 执行补货、取用、用完，检查数量和历史；取用超量时确认清零。
- 令数量低于阈值，重新打开首页，检查提醒、忽略与补货后恢复。
- 用创建者新增成员，在第二台设备登录；一台设备操作库存，另一台设备自动刷新。

这些是手动验收项，不作为 UI 自动化测试。
