# Free API 商品条码与手动商品图片

## 目标

将商品条码供应商替换为 Free API 文档 569 所列的商品条码接口，并在扫码录入时支持为商品手动拍照或从设备选择图片。

## 条码查询

- 浏览器仅向 `lookup-barcode` Edge Function 发送 8–14 位数字条码。
- Edge Function 使用服务器环境变量 `FREE_API_APP_ID`、`FREE_API_APP_SECRET` 请求 `https://www.mxnzp.com/api/barcode/goods/details`，参数为 `barcode`、`app_id`、`app_secret`。
- 仅当上游返回 `code: 1` 且包含 `data.goodsName` 时返回成功；映射 `goodsName` 为商品名、`brand` 为品牌、`standard` 为规格。
- 上游不提供图片，查询成功与失败均允许用户修改字段并进入手动录入；应用不把密钥、上游原始响应或密钥相关错误返回给浏览器。

## 手动图片

- 录入商品时提供“拍照 / 选择图片”控件，移动端用 `capture="environment"` 优先打开后置摄像头，桌面端可选择文件。
- 图片接受 JPG、PNG、WebP，单张最大 5 MB；不合格文件在本地提示，不上传。
- 图片上传到私有 `location-photos` Storage bucket 中独立的商品路径：`{householdId}/products/{productId}/{filename}`。现有基于家庭 UUID 前缀的 Storage RLS 策略继续约束访问。
- 上传成功后，将对象路径保存到 `products.image_url`；图片上传失败不丢失已经填写的商品文字和条码，用户可重试或跳过图片。

## 验证范围

- 自动化：验证 Free API 字段映射、商品图片对象路径与文件类型/大小校验。
- 手动：真机扫码、拍照、选择图片、上游无数据后的手动录入。
- 不新增 UI 自动化测试。
