type PwaInstallNoticeProps = { onInstall: () => void | Promise<void> }

export function PwaInstallNotice({ onInstall }: PwaInstallNoticeProps) {
  return <aside className="pwa-install-notice" aria-label="安装应用">
    <span>添加到桌面，像应用一样快速打开。</span>
    <button type="button" onClick={() => void onInstall()}>安装到桌面</button>
  </aside>
}
