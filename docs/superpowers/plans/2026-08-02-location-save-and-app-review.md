# 位置保存修复与全应用界面走查 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让位置管理页在写入成功后不再因刷新异常误报保存失败，优化移动端新增入口，并完成全应用功能与移动端界面走查。

**Architecture:** 位置页继续直接使用 Supabase，但将“写入”与“重载列表”分成独立结果：只有写入失败才显示保存错误。写入成功时用返回的行立即更新本地状态，后台重载失败则不破坏该状态。样式以一个局部类限制在两个位置新增入口。

**Tech Stack:** React 19、TypeScript、Vitest、Testing Library、Supabase JS、Vite。

---

## File structure

- Modify `src/features/locations/LocationManagementPage.tsx`：拆分保存和重载失败路径，使用写入返回行更新本地状态，并添加两个文字按钮类。
- Modify `src/features/locations/LocationManagementPage.test.tsx`：覆盖成功写入/刷新失败、写入失败及入口样式。
- Modify `src/styles.css`：定义位置页文字按钮的默认、悬停、禁用和键盘焦点状态。
- Create `docs/superpowers/reviews/2026-08-02-app-ui-functional-review.md`：记录全应用走查清单、验证证据和发现项。

### Task 1: 写入位置页的回归测试

**Files:**
- Modify: `src/features/locations/LocationManagementPage.test.tsx`

- [ ] **Step 1: 替换极简 Supabase mock，写入两个失败用例和样式断言**

```tsx
it('keeps a successfully saved room visible when the following refresh fails', async () => {
  // First load returns no rooms; the upsert returns the created room; the second load rejects.
  render(<MemoryRouter><LocationManagementPage /></MemoryRouter>)
  await user.type(screen.getByLabelText('新房间'), '厨房')
  await user.click(screen.getByRole('button', { name: '添加房间' }))

  expect(await screen.findByText('厨房')).toBeInTheDocument()
  expect(screen.queryByText('无法保存房间，请重试。')).not.toBeInTheDocument()
  expect(screen.getByLabelText('新房间')).toHaveValue('')
})

it('keeps the room form and reports an error when the room write fails', async () => {
  // The upsert resolves with an error before any refresh is attempted.
  render(<MemoryRouter><LocationManagementPage /></MemoryRouter>)
  await user.type(screen.getByLabelText('新房间'), '厨房')
  await user.click(screen.getByRole('button', { name: '添加房间' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('无法保存房间，请重试。')
  expect(screen.getByLabelText('新房间')).toHaveValue('厨房')
})

it('uses text action styling for both location creation buttons', async () => {
  render(<MemoryRouter><LocationManagementPage /></MemoryRouter>)
  expect(await screen.findByRole('button', { name: '添加房间' })).toHaveClass('location-create-action')
  expect(screen.getByRole('button', { name: '添加存放点' })).toHaveClass('location-create-action')
})
```

- [ ] **Step 2: 运行目标测试，确认现状失败**

Run: `npm test -- src/features/locations/LocationManagementPage.test.tsx`

Expected: FAIL，因为按钮没有 `location-create-action`，且写入后刷新抛错会显示保存失败。

- [ ] **Step 3: 提交只含失败测试的变更**

```bash
git add src/features/locations/LocationManagementPage.test.tsx
git commit -m "test: cover location save refresh failures"
```

### Task 2: 分离位置写入和列表刷新状态

**Files:**
- Modify: `src/features/locations/LocationManagementPage.tsx`
- Modify: `src/styles.css`
- Test: `src/features/locations/LocationManagementPage.test.tsx`

- [ ] **Step 1: 让 `load` 接受是否显示读取错误的参数，并保留 `rooms`/ `locations` 的本地值**

```tsx
const load = useCallback(async (showReadError = true) => {
  setIsLoading(true)
  try {
    // Existing auth/profile/room/location/signing reads.
    setRooms((roomRows ?? []) as Room[])
    setLocations(typedLocations)
    setPhotoUrls(Object.fromEntries(signedEntries))
    setMessage('')
    return true
  } catch {
    if (showReadError) setMessage('暂时无法读取位置，请稍后重试。')
    return false
  } finally {
    setIsLoading(false)
  }
}, [])
```

- [ ] **Step 2: 使用带 `.select(...).single()` 的 upsert/insert 返回行，并在刷新前合并本地状态**

```tsx
const { data: createdRoom, error } = await supabase
  .from('rooms')
  .upsert({ household_id: householdId, name }, { onConflict: 'household_id,name' })
  .select('id, name')
  .single()
if (error || !createdRoom) throw error ?? new Error('房间保存失败')

setRooms((current) => current.some((room) => room.id === createdRoom.id)
  ? current : [...current, createdRoom].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')))
event.currentTarget.reset()
void load(false)
```

For locations, use `.insert(...).select('id, name, room_id, photo_path, rooms(name)').single()`, append the returned `Location` when absent, reset the form, then call `void load(false)`. Keep each create function's `catch` around only the write path and preserve its existing error text.

- [ ] **Step 3: 给两个新增入口添加局部样式钩子并实现文字按钮状态**

```tsx
<button className="location-create-action" type="submit" disabled={isSavingRoom || !householdId}>…</button>
```

```css
.location-create-action {
  justify-self: start;
  background: transparent;
  color: #5E7966;
  padding: 8px 0;
  border-radius: 0;
}
.location-create-action:hover:not(:disabled) { background: transparent; color: #486451; transform: none; }
.location-create-action:focus-visible { outline: 2px solid #5E7966; outline-offset: 3px; }
```

- [ ] **Step 4: 运行目标测试，确认通过**

Run: `npm test -- src/features/locations/LocationManagementPage.test.tsx`

Expected: PASS，三项位置页回归测试均通过。

- [ ] **Step 5: 提交实现**

```bash
git add src/features/locations/LocationManagementPage.tsx src/features/locations/LocationManagementPage.test.tsx src/styles.css
git commit -m "fix: preserve successful location saves on refresh failure"
```

### Task 3: 执行全应用功能和移动端界面走查

**Files:**
- Create: `docs/superpowers/reviews/2026-08-02-app-ui-functional-review.md`

- [ ] **Step 1: 运行测试和生产构建**

Run: `npm test && npm run build`

Expected: 全部 Vitest 测试通过，TypeScript 编译和 Vite 生产构建完成且退出码为 0。

- [ ] **Step 2: 启动本地预览并逐页验证**

Run: `npm run dev -- --host 127.0.0.1`

Record this exact checklist and result in the review file: initial setup, login, inventory list/filter/empty state, inventory detail, stock in/out, scanner/photo fallbacks, low-stock panel, members, locations, desktop navigation, touch bottom navigation, scanner FAB, PWA install notice. For each route, record route reachability, primary action availability, empty/error feedback, and whether fixed navigation obscures content at a 390px viewport.

- [ ] **Step 3: 修复走查中可在本地稳定复现的缺陷并补回归测试**

For every confirmed defect, add a focused test in its feature `*.test.tsx` file, make the smallest behavior or CSS correction, and re-run the affected test file. If no defect is confirmed, record “未发现可稳定复现的缺陷”。 Do not change external-service behavior that cannot be exercised locally.

- [ ] **Step 4: 复跑全量验证并提交走查记录及任何修复**

Run: `npm test && npm run build && git status --short`

Expected: 所有测试和构建通过，工作树只包含审查记录及已验证的走查修复。

```bash
git add docs/superpowers/reviews/2026-08-02-app-ui-functional-review.md src
git commit -m "docs: record application UI functional review"
```

