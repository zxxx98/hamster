# 当前服务器上的自托管 Supabase

## 部署位置与运行方式

- 部署目录：`/opt/supabase`
- 编排方式：官方 Supabase Docker Compose 配置
- 环境变量与密钥：`/opt/supabase/.env`，权限为 `0600`，不得提交或复制到仓库
- 持久化数据目录位于独立数据盘 `/mnt/data/supabase`：PostgreSQL 为 `/mnt/data/supabase/db/data`，Storage 对象文件为 `/mnt/data/supabase/storage`。Docker 镜像与运行时仍在系统盘；增长的数据不会占用系统盘。
- 日常服务管理：

```bash
cd /opt/supabase
sudo docker compose ps
sudo docker compose up -d
sudo docker compose down
sudo docker compose logs -f kong auth db
```

不要删除 `/mnt/data/supabase`；它包含家庭资产应用的数据库和上传的地点照片等对象文件。迁移或恢复数据前，先停止这套 Compose 服务并保留一份可验证的备份。

## 网络边界

仅 Kong API 网关需要经由公网域名访问：

| 用途 | 本机地址 | 是否经 Lucky 公开 |
|---|---|---|
| Supabase API 网关 | `http://127.0.0.1:23020` | 是 |
| Supabase Studio | `http://127.0.0.1:23021` | 否 |
| Kong 本地 HTTPS | `https://127.0.0.1:23022` | 否 |
| PostgreSQL / Supavisor | `127.0.0.1:5432`、`127.0.0.1:6543` | 否 |

数据库、连接池和 Studio 都不应直接暴露到公网。

## Lucky 反向代理

在 Lucky 创建一条规则：

```text
域名：supabase.980204.xyz
上游协议：http
上游地址：127.0.0.1
上游端口：23020
WebSocket：开启
HTTP 自动跳转 HTTPS：开启
```

Lucky 负责为该域名配置 TLS 证书。Cloudflare 代理启用时，将 Cloudflare 的 SSL/TLS 模式设为 **Full (strict)**，确保 Cloudflare 到 Lucky 的链路也是 HTTPS。

该反代会提供 `/auth/v1`、`/rest/v1`、`/storage/v1`、`/realtime/v1`、`/functions/v1` 和 `/graphql/v1` 等 Supabase API 路由。Kong 已移除 Studio 的兜底路由：通过公网域名访问根路径将返回 `404`，避免管理后台被顺带公开。

## 私有 Studio 访问

从服务器本机访问：

```bash
curl -I http://127.0.0.1:23021/api/platform/profile
```

从本地电脑通过 SSH 隧道访问：

```bash
ssh -L 23021:127.0.0.1:23021 ubuntu@158.178.243.20
```

然后在本地浏览器打开 `http://127.0.0.1:23021`。

## 验证

服务启动后，以下命令须返回 `200`：

```bash
anon_key=$(sudo sed -n 's/^ANON_KEY=//p' /opt/supabase/.env)
curl -i -H "apikey: $anon_key" http://127.0.0.1:23020/auth/v1/health
```

添加 Lucky 反代后，从外部验证：

```bash
curl -I https://supabase.980204.xyz/auth/v1/health
```

健康端点经公网访问可能需要提供匿名 API key；重点是确认 TLS 证书有效、域名能连接到 Lucky，且 API 路由可达。
