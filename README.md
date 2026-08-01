# 家藏

家庭共享消耗品库存 PWA：扫码或手动录入商品，记录房间和存放点，按需补货并在低库存时提醒。

## Docker 部署

在全新的 Linux 主机上，只需 Docker Engine、Docker Compose v2.20+、至少 4 GB 内存和持久化磁盘；不需要预先安装 Supabase、Node、创建数据表或部署 Functions。

```bash
git clone <仓库地址> hamster
cd hamster
APP_ORIGIN=https://hamster.example.com ./deploy/bootstrap.sh
```

首次运行会生成服务端密钥、启动私有 Supabase、应用所有 `supabase/migrations`、部署 Edge Functions，并将运行配置写入权限为 `0600` 的 `deploy/runtime/.env`。全部成功后，终端会仅一次输出 `INITIAL_SETUP_SECRET`；请将终端和 CI 日志视为敏感信息。唯一暴露的端口是 Web 服务（默认 `24000`）；浏览器通过同一域名访问 `/auth/v1`、`/rest/v1` 和 `/functions/v1`，数据库、Studio 与 Supavisor 不会发布到宿主机。

若先用公网 IP 做 HTTP 验证，可使用 `APP_ORIGIN=http://PUBLIC_IP:24000 ./deploy/bootstrap.sh`。正式公开前，应由 Caddy、Nginx、Traefik 或云负载均衡器在 Web 服务前提供 HTTPS 和 WebSocket 转发；不要在 HTTP 页面提交初始化密钥或用户 Token。更多运行与反代说明见 [自托管部署说明](docs/operations/self-hosted-supabase.md)。

## 首次创建家庭

全新部署且尚未创建家庭时，应用会自动打开 `/setup`。输入家庭名称、创建者账号、创建者 Token 与服务器管理员从首次成功部署的终端输出取得的 `INITIAL_SETUP_SECRET`。若未保留该输出，可从受保护的环境文件读取：

```bash
sudo sed -n 's/^INITIAL_SETUP_SECRET=//p' deploy/runtime/.env
```

账号为 3–32 位小写字母、数字、下划线或连字符；Token 至少 16 位。

请只通过 HTTPS 页面提交 Token 与初始化密钥；不要把它们放入命令历史、URL、聊天记录或浏览器存储。创建成功后，页面会自动登录并进入库存首页。数据库的单家庭约束会自动禁用后续初始化：新的未登录访问会到 `/login`，`/setup` 也会重定向至登录页，无需删除密钥文件或重建 Functions 服务。

首次创建成功后不需要额外的人工收尾操作。后续重跑 `./deploy/bootstrap.sh` 会复用现有密钥和数据，只应用尚未记录的 migration 并更新 Functions；它不会重置家庭数据或重新开放初始化。

## 更新应用

```bash
cd hamster
./deploy/bootstrap.sh
```

构建时 `.env.local` 仅包含公开的 Supabase URL 与匿名公钥；服务角色密钥、Free API 凭据及初始化密钥均只存在服务器受保护环境文件中，绝不能提交到仓库。

## 手动验收清单

- 真机打开 Web 地址并安装 PWA。
- 首次使用创建者账号和 Token 登录；关闭后重新打开无需再次输入。
- 扫描商品条码；查询失败时手动填写；拍照或选取 JPG/PNG/WebP 图片。
- 保存商品到房间和存放点，检查库存列表、详情和图片/位置。
- 执行补货、取用、用完，检查数量和历史；取用超量时确认清零。
- 令数量低于阈值，重新打开首页，检查提醒、忽略与补货后恢复。
- 用创建者新增成员，在第二台设备登录；一台设备操作库存，另一台设备自动刷新。

这些是手动验收项，不作为 UI 自动化测试。
