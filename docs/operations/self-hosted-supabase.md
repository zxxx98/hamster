# 自包含 Docker 部署

## 前提条件

- Linux 主机已安装 Docker Engine 与 Docker Compose v2.20+。
- 至少 4 GB 可用内存，并为 Docker named volumes 准备持久化磁盘。
- 生产环境有一个外部 HTTPS 反向代理；Compose 不申请或管理 TLS 证书。

应用会打包固定版本的 Supabase 服务。数据库、Storage、Studio、Kong 与 Supavisor 仅运行在 Docker 内部网络；只有 Web 容器的 80 端口映射到宿主机 `APP_PORT`（默认 `24000`）。Web 容器从 `ghcr.io/zxxx98/hamster:latest` 拉取，并将 Supabase 路由反代到内部 Kong，因此浏览器无需知道数据库连接串或第二个 Supabase 域名。

## 首次部署

```bash
git clone <仓库地址> hamster
cd hamster
APP_ORIGIN=https://hamster.example.com ./deploy/bootstrap.sh
```

`APP_ORIGIN` 是用户浏览器访问的完整 HTTP(S) 地址，不能包含路径、查询参数或片段。它决定 Auth 回调与允许的重定向地址。`APP_PORT` 与其独立：反向代理场景通常仍保持默认 `24000`；需要改宿主端口时明确传入，例如：

```bash
APP_ORIGIN=https://hamster.example.com APP_PORT=24100 ./deploy/bootstrap.sh
```

脚本在首次运行时用 Node Docker 镜像生成所有密钥，写入 `deploy/runtime/.env`（权限 `0600`），再等待数据库与 Kong、按文件名顺序应用尚未记录的 `supabase/migrations/*.sql`，并更新 Edge Functions。它不会打印任何密钥。

首次部署完成时，未登录访问会自动进入 `/setup`。管理员仅在 HTTPS 页面上从受保护的环境文件读取 `INITIAL_SETUP_SECRET` 并填写一次。成功创建家庭后，数据库的单家庭约束会锁定初始化；之后未登录用户进入 `/login`，重复运行 bootstrap 不会清空数据或重新允许 setup。

## 反向代理与公网访问

让反向代理把一个 HTTPS 域名转发至 `http://127.0.0.1:APP_PORT`（若 Compose 端口没有限制为 loopback，可改用主机私网地址）。必须启用 WebSocket 转发，以支持 Realtime。代理只需转发一个应用域名，包含普通页面及 `/auth/v1`、`/rest/v1`、`/storage/v1`、`/realtime/v1`、`/functions/v1`、`/graphql/v1` 路径。

在证书和反代就绪前，可临时以 `http://PUBLIC_IP:24000` 作为 `APP_ORIGIN` 验证启动；不要在 HTTP 上传递用户密码、Token 或初始化密钥。若使用 Cloudflare，请将源站 TLS 配置为 Full (strict)。

## 更新、检查与备份

在仓库目录重复执行：

```bash
./deploy/bootstrap.sh
```

该操作复用 `deploy/runtime/.env`、保留 Docker volumes、总是拉取最新 Web 镜像、只应用 migration 账本中不存在的文件，并重建 Functions 服务。若要固定回滚版本，可在运行前设置 `HAMSTER_WEB_IMAGE=ghcr.io/zxxx98/hamster@sha256:<image-digest>`。日常检查命令：

```bash
docker compose --env-file deploy/runtime/.env -f deploy/compose.yml ps
docker compose --env-file deploy/runtime/.env -f deploy/compose.yml logs -f web kong functions
```

数据库和上传对象存储在 Compose 项目名对应的 `supabase-db-data` 与 `supabase-storage-data` named volumes 中。备份或迁移前先停止服务，并同时备份这两个 volumes 和 `deploy/runtime/.env`；环境文件丢失会使既有 JWT、数据库与初始化密钥无法正常配合。不要提交、共享或在终端历史中保存该文件。

## 验证

可运行隔离的端到端检查：

```bash
./deploy/smoke.sh
```

它创建临时 Compose 项目与数据 volumes，通过同源代理检查 Auth 健康端点和空数据库的 `initial-setup-status`，随后自动删除临时容器、volumes 与凭据。
