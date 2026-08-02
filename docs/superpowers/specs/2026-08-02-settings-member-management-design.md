# 设置页与家庭成员管理设计

## 目标

新增“设置”页，将现有成员创建功能收拢其中，并让家庭创建者可以新增、查看、修改及删除普通家庭成员。成员的登录账号和 Token 均可修改；创建者账号不可被修改或删除。

## 信息架构与界面

- 新增受登录保护的 `/settings` 路由，并将桌面侧栏和移动底栏中的“成员”入口改为“设置”。扫码入口仍保持独立。
- 设置页显示“家庭成员”区块：每位成员显示账号；家庭创建者有“创建者”标识，没有编辑和删除操作。
- 对普通成员提供编辑与删除操作。编辑展开或显示一个独立表单，包含账号和可选的新 Token；Token 不回显，留空表示不修改。
- 新增成员表单移入同一页面。账号沿用 3–32 位小写字母、数字、下划线或连字符规则，Token 至少 16 字符。
- 删除前使用明确的浏览器确认提示。成功后立即更新列表；失败时保留表单内容并显示可理解的错误。

## 服务端与权限

- 新增一个 `manage-members` Edge Function，使用当前访问者的 Bearer token 鉴别身份，并通过 service role 执行 Auth 管理操作。
- Function 支持 `list`、`create`、`update`、`delete` 四个 action。每个 action 在服务端查询调用者的 profile 和 household，只有 `households.created_by` 与当前用户相同才继续。
- `list` 返回当前家庭 profiles 与创建者 ID；前端不能通过数据库直接获知或自行判断管理权限。
- `create` 创建 Supabase Auth 用户并插入 profile；若 profile 写入失败，回滚 Auth 用户。
- `update` 可同时或分别更新用户名和 Token。用户名变更同步把认证邮箱从旧的 `<username>@member.local` 改为新的内部别名；Token 更新仅设置新密码。空 Token 不触发密码更新。
- `delete` 拒绝删除 household 创建者；删除普通成员的 Auth 用户，由 profile 的级联关系清理对应 profile。
- 不返回、存储或显示既有 Token；所有错误响应均避免透露敏感凭据。

## 数据与部署

- 不需要数据库 schema 或 RLS migration：现有 `profiles`、`households.created_by` 与 profile 级联删除足够支持成员关联。
- `bootstrap.sh` 已将项目的 `supabase/functions` 同步到运行时 Functions 目录，因此新 Function 会随现有部署流程发布。

## 测试

- 为客户端成员管理 API 写 action 请求与输入校验测试。
- 为设置页写成员列表、创建、编辑、删除确认、创建者不可操作、失败反馈及导航改名的测试。
- 为 Edge Function 抽取或复用可测试的纯权限/请求校验辅助逻辑，覆盖未登录、非创建者、删除创建者、账号冲突和正常 CRUD。
- 运行完整测试、生产构建，并在部署后以创建者账号手测新增、改名、Token 重设和删除；使用普通成员确认没有管理权限。

## 非目标

- 不支持多个管理员、成员邀请邮件或找回 Token。
- 不允许删除或修改家庭创建者，也不允许创建者将管理员权限转交给其他成员。
- 不向用户暴露内部认证邮箱别名。
