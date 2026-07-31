# Free API Barcode and Product Photo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use Free API for barcode lookup and let inventory entry attach a manually captured product image.

**Architecture:** The existing authenticated Edge Function changes upstream provider but retains its browser response contract. A focused catalog helper builds a household-scoped product-image path and validates image files before uploading to the private Storage bucket.

**Tech Stack:** TypeScript, React, Supabase JS, Supabase Edge Runtime, Vitest.

---

### Task 1: Switch the server-side barcode provider

**Files:**
- Modify: `supabase/functions/lookup-barcode/index.ts`
- Modify: `src/features/catalog/api.ts`
- Modify: `src/features/catalog/api.test.ts`

- [ ] **Step 1: Write a failing Free API mapping test.**

```ts
expect(normalizeBarcodeProduct({ goodsName: '清风抽纸', brand: '清风', standard: '单包' }))
  .toEqual({ name: '清风抽纸', brand: '清风', specification: '单包', imageUrl: null })
```

- [ ] **Step 2: Run `npm test -- src/features/catalog/api.test.ts`.**

Expected: FAIL because the old mapping accepts only `name/spec/image`.

- [ ] **Step 3: Implement the Free API mapping and request.**

Use `https://www.mxnzp.com/api/barcode/goods/details`; send `barcode`, `app_id` from `FREE_API_APP_ID`, and `app_secret` from `FREE_API_APP_SECRET`. Treat only `code === 1` with `data.goodsName` as found. Map `goodsName`, `brand`, and `standard`; always return `imageUrl: null`. Do not return provider credentials or raw provider errors.

- [ ] **Step 4: Run the focused test and Edge Runtime bundle check.**

```bash
npm test -- src/features/catalog/api.test.ts
sudo docker exec supabase-edge-functions edge-runtime bundle /home/deno/functions/lookup-barcode/index.ts --output /tmp/lookup-barcode.js
```

- [ ] **Step 5: Commit.**

```bash
git add src/features/catalog supabase/functions/lookup-barcode
git commit -m "feat: switch barcode lookup to Free API"
```

### Task 2: Add validated product-image upload helpers

**Files:**
- Create: `src/features/catalog/productPhoto.ts`
- Create: `src/features/catalog/productPhoto.test.ts`

- [ ] **Step 1: Write failing tests.**

```ts
expect(productPhotoPath('household-1', 'product-2', 'camera.jpg'))
  .toBe('household-1/products/product-2/camera.jpg')
expect(() => validateProductPhoto(new File(['x'], 'x.gif', { type: 'image/gif' }))).toThrow()
```

- [ ] **Step 2: Run `npm test -- src/features/catalog/productPhoto.test.ts`.**

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement minimal helpers.**

Accept JPEG, PNG, and WebP only, up to 5 MB. Upload to the existing private `location-photos` bucket at `{householdId}/products/{productId}/{filename}` and return the object path. The caller saves that path in `products.image_url`; upload errors must be thrown to permit retry without losing form fields.

- [ ] **Step 4: Verify and commit.**

```bash
npm test -- src/features/catalog/productPhoto.test.ts
git add src/features/catalog/productPhoto.ts src/features/catalog/productPhoto.test.ts
git commit -m "feat: add product photo upload helper"
```

### Task 3: Configure and deploy Free API credentials

**Files:**
- Modify outside repository: `/opt/supabase/.env.free-api`
- Modify outside repository: `/opt/supabase/docker-compose.yml`

- [ ] **Step 1: Create a root-only environment file with `FREE_API_APP_ID` and `FREE_API_APP_SECRET`; do not print either value.**
- [ ] **Step 2: Add that file to the functions service `env_file` list and recreate only `supabase-edge-functions`.**
- [ ] **Step 3: Copy the reviewed lookup function into `/opt/supabase/volumes/functions/lookup-barcode/`, run an Edge Runtime bundle check, and confirm the container is healthy.**
- [ ] **Step 4: Run all key tests and build.**

```bash
npm test
npm run build
```
