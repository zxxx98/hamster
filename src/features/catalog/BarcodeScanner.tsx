import { Html5QrcodeScanner } from 'html5-qrcode'
import { useEffect, useState } from 'react'
import { lookupBarcode, type BarcodeProduct } from './api'

type BarcodeScannerProps = {
  onProduct: (product: BarcodeProduct, barcode: string) => void
  onManualEntry: (barcode: string | null) => void
}

export function BarcodeScanner({ onProduct, onManualEntry }: BarcodeScannerProps) {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const scanner = new Html5QrcodeScanner('barcode-reader', { fps: 10, qrbox: { width: 240, height: 160 } }, false)
    scanner.render(
      async (code) => {
        await scanner.clear()
        try {
          const result = await lookupBarcode(code)
          if (result.found && result.product) onProduct(result.product, code)
          else setMessage('未查询到该商品，可手动填写。')
        } catch {
          setMessage('查询失败，可手动填写商品信息。')
        }
      },
      () => undefined,
    )
    return () => { void scanner.clear().catch(() => undefined) }
  }, [onProduct])

  return <section><div id="barcode-reader" /><p>{message ?? '请允许相机权限以扫描条形码。'}</p><button type="button" onClick={() => onManualEntry(null)}>手动填写商品信息</button></section>
}
