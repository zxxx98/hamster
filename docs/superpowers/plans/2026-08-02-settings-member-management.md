# 设置页与家庭成员管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用创建者专属的设置页完成成员的查看、新增、账号改名、Token 重设和删除，并保护创建者账号。

**Architecture:** 浏览器只调用 `manage-members` Edge Function；该 Function 用调用者 JWT 验证创建者身份，再通过 service role 管理 Auth 与 profile。设置页维护一次成员列表，成功操作后以 API 返回结果更新或重载，失败时不丢失输入。

**Tech Stack:** React 19、TypeScript、Supabase JS、Supabase Edge Functions、Vitest、Testing Library。

---

## File structure

- Create `supabase/functions/manage-members/index.ts`: 创建者鉴权和成员 CRUD。
- Modify `src/features/auth/api.ts`: 成员管理 action 的类型化客户端。
- Modify `src/features/auth/api.test.ts`: 客户端请求与输入校验。
- Create `src/features/auth/SettingsPage.tsx`: 成员列表、创建、编辑、删除确认。
- Create `src/features/auth/SettingsPage.test.tsx`: 设置页关键状态与交互。
- Modify `src/app/App.tsx`, `src/app/AppNavigation.tsx`, `src/app/NavigationIcon.tsx`, `src/app/AppNavigation.test.tsx`: 路由及导航“成员”到“设置”的迁移。
- Modify `src/styles.css`: 仅为设置页成员行与编辑表单添加局部布局。

### Task 1: 定义成员管理客户端并先写失败测试

**Files:**
- Modify: `src/features/auth/api.ts`
- Modify: `src/features/auth/api.test.ts`

- [ ] **Step 1: 写一个失败测试，验证 action 和请求体**

```ts
it('sends a member update action with an optional replacement token', async () => {
  const invoke = vi.fn().mockResolvedValue({ data: { id: 'member-2', username: 'lin' }, error: null })
  await updateMember({ functions: { invoke } } as never, {
    id: 'member-2', username: 'lin', token: 'a-replacement-token',
  })

  expect(invoke).toHaveBeenCalledWith('manage-members', {
    body: { action: 'update', id: 'member-2', username: 'lin', token: 'a-replacement-token' },
  })
})
```

Add equivalent expectations for `listMembers(client)`, `createMember(client, credentials)`, and `deleteMember(client, id)`; add validation cases for invalid username and a non-empty Token shorter than 16 characters.

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- src/features/auth/api.test.ts`

Expected: FAIL because `updateMember`, `listMembers`, and `deleteMember` are not exported.

- [ ] **Step 3: 实现最小的 typed wrapper**

```ts
export type ManagedMember = { id: string; username: string; isCreator: boolean }
type MemberActionClient = { functions: { invoke: (name: string, options: { body: unknown }) => Promise<{ data: unknown; error: Error | null }> } }

async function manageMembers(client: MemberActionClient, body: Record<string, unknown>) {
  const { data, error } = await client.functions.invoke('manage-members', { body })
  if (error) throw error
  return data
}

export async function updateMember(client: MemberActionClient, input: { id: string; username: string; token?: string }) {
  validateCredentials(input.username, input.token || 'valid-token-at-least')
  if (input.token !== undefined && input.token.length < 16) throw new Error('Token 至少需要 16 个字符。')
  return manageMembers(client, { action: 'update', ...input }) as Promise<ManagedMember>
}
```

Use the same helper for list, create, and delete. Preserve the existing `createMember(username, token)` public signature as a compatibility wrapper until the old page is removed.

- [ ] **Step 4: 运行目标测试确认通过**

Run: `npm test -- src/features/auth/api.test.ts`

Expected: PASS.

- [ ] **Step 5: 提交客户端层**

```bash
git add src/features/auth/api.ts src/features/auth/api.test.ts
git commit -m "feat: add member management client actions"
```

### Task 2: 实现创建者专属 Edge Function

**Files:**
- Create: `supabase/functions/manage-members/index.ts`
- Create: `supabase/functions/_shared/memberManagement.ts`
- Create: `supabase/functions/_shared/memberManagement.test.ts`

- [ ] **Step 1: 写纯请求解析辅助函数的失败测试**

```ts
expect(parseMemberAction({ action: 'delete', id: 'member-2' })).toEqual({ action: 'delete', id: 'member-2' })
expect(parseMemberAction({ action: 'update', id: 'member-2', username: 'Lin' })).toBeNull()
expect(parseMemberAction({ action: 'delete', id: '' })).toBeNull()
```

- [ ] **Step 2: 运行解析测试确认失败**

Run: `npx vitest run supabase/functions/_shared/memberManagement.test.ts`

Expected: FAIL because the parser does not exist.

- [ ] **Step 3: 实现严格 action 解析和 Function 鉴权**

The parser returns only these shapes:

```ts
type MemberAction =
  | { action: 'list' }
  | { action: 'create'; username: string; token: string }
  | { action: 'update'; id: string; username: string; token?: string }
  | { action: 'delete'; id: string }
```

In `manage-members/index.ts`, copy the existing `create-member` authorization sequence: reject missing/invalid Bearer tokens with 401; select the caller profile with service role; select household `created_by`; reject a non-creator with 403. For `list`, select `id, display_name` from profiles filtered by household and return each as `{ id, username: display_name, isCreator: id === created_by }`.

For `create`, create `<username>@member.local`, insert profile, roll back Auth user if insert fails, and return the new member. For `update`, reject the creator ID, load the target profile scoped to household, call `auth.admin.updateUserById` with `email` only when the username changed and `password` only when a token was supplied, then update `display_name`. For `delete`, reject the creator ID, verify target profile belongs to household, then call `auth.admin.deleteUser(id)`. Return 404 for an absent/out-of-household target and 409 for Auth uniqueness conflicts.

- [ ] **Step 4: 运行解析测试确认通过**

Run: `npx vitest run supabase/functions/_shared/memberManagement.test.ts`

Expected: PASS.

- [ ] **Step 5: 提交 Function**

```bash
git add supabase/functions/manage-members/index.ts supabase/functions/_shared/memberManagement.ts supabase/functions/_shared/memberManagement.test.ts
git commit -m "feat: add creator-only member management function"
```

### Task 3: 构建设置页并迁移导航

**Files:**
- Create: `src/features/auth/SettingsPage.tsx`
- Create: `src/features/auth/SettingsPage.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/AppNavigation.tsx`
- Modify: `src/app/NavigationIcon.tsx`
- Modify: `src/app/AppNavigation.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: 编写失败的设置页交互测试**

Mock `listMembers`, `createMember`, `updateMember`, and `deleteMember`. Cover:

```tsx
expect(await screen.findByText('创建者')).toBeInTheDocument()
expect(screen.queryByRole('button', { name: '编辑 creator' })).not.toBeInTheDocument()
fireEvent.click(screen.getByRole('button', { name: '编辑 lin' }))
fireEvent.change(screen.getByLabelText('lin 的新 Token'), { target: { value: 'new-secure-member-token' } })
fireEvent.click(screen.getByRole('button', { name: '保存 lin' }))
expect(updateMember).toHaveBeenCalledWith(expect.anything(), {
  id: 'member-2', username: 'lin', token: 'new-secure-member-token',
})
```

Also test `window.confirm` false leaves `deleteMember` uncalled, a server failure displays an alert, and the navigation links to `/settings` with accessible name “设置”.

- [ ] **Step 2: 运行目标测试确认失败**

Run: `npm test -- src/features/auth/SettingsPage.test.tsx src/app/AppNavigation.test.tsx`

Expected: FAIL because SettingsPage and the settings route do not exist.

- [ ] **Step 3: 实现最小设置 UI 和路由**

`SettingsPage` loads members on mount, shows `<p role="alert">` on fetch/mutation failure, and uses form-local busy states. Its member rows use these labels: “编辑 <username>”, “删除 <username>”, “保存 <username>”, and “<username> 的新 Token”. Do not render actions for `isCreator: true`.

Replace the `/members` private route with `/settings`, redirect legacy `/members` to `/settings`, replace the nav link’s pathname and accessible text, and rename the icon type/key from `members` to `settings`. Keep the mobile destination count at three.

- [ ] **Step 4: 添加局部 CSS**

```css
.settings-member-row { display: grid; gap: 10px; }
.settings-member-actions { display: flex; flex-wrap: wrap; gap: 12px; }
.settings-member-editor { margin-top: 4px; }
```

Use the existing button and form primitives; do not introduce a second visual system.

- [ ] **Step 5: 运行目标测试确认通过**

Run: `npm test -- src/features/auth/SettingsPage.test.tsx src/app/AppNavigation.test.tsx src/app/App.test.tsx`

Expected: PASS.

- [ ] **Step 6: 提交页面与导航**

```bash
git add src/features/auth/SettingsPage.tsx src/features/auth/SettingsPage.test.tsx src/app/App.tsx src/app/AppNavigation.tsx src/app/NavigationIcon.tsx src/app/AppNavigation.test.tsx src/styles.css
git commit -m "feat: move member controls into settings"
```

### Task 4: 全量验证与部署

**Files:**
- Modify: `docs/superpowers/reviews/2026-08-02-app-ui-functional-review.md`

- [ ] **Step 1: 运行完整测试和生产构建**

Run: `npm test && npm run build`

Expected: all tests pass and Vite emits the PWA artifacts.

- [ ] **Step 2: 更新审查记录**

Append the settings route, creator-only controls, Token non-disclosure, legacy members redirect, and remaining device-only checks to the review record.

- [ ] **Step 3: 提交验证记录**

```bash
git add docs/superpowers/reviews/2026-08-02-app-ui-functional-review.md
git commit -m "docs: review settings member management"
```

- [ ] **Step 4: 发布与线上健康检查**

Run: `git push origin master`, wait for the Docker image GitHub Action to succeed, then run `sudo -n ./deploy/bootstrap.sh`. Confirm the public root returns HTTP 200 and use the protected runtime environment to confirm `/auth/v1/health` and `initial-setup-status` succeed without printing secrets.

