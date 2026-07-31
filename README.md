# 家庭库存

家庭共享库存的响应式 Web 应用，支持以 PWA 形式安装。

## 本地运行

复制 `.env.example` 为 `.env.local`，填入 Supabase 项目的 URL 与匿名密钥后运行：

```sh
npm install
npm run dev
```

## 生产部署

应用使用 `BrowserRouter`。生产服务器必须将未知的前端路由重写到 `/index.html`，否则直接访问例如 `/login` 会返回 404。Nginx 可使用：

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```
