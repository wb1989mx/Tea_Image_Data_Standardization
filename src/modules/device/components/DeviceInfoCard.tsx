import { useRootStore } from '../../../infrastructure/store';

// 设备信息卡片（设置页使用）：展示自动获取结果，支持手动兜底输入
export function DeviceInfoCard() {
  const deviceInfo = useRootStore((s) => s.deviceInfo);
  const setDeviceInfo = useRootStore((s) => s.setDeviceInfo);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>
        型号：{deviceInfo.model ?? '未获取'}
        {deviceInfo.os ? ` · ${deviceInfo.os}` : ''}
        {deviceInfo.browser ? ` · ${deviceInfo.browser}` : ''}
      </div>
      {deviceInfo.exifMake || deviceInfo.exifModel ? (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          EXIF：{deviceInfo.exifMake ?? '—'} / {deviceInfo.exifModel ?? '—'}
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>手动修正型号</span>
        <input
          value={deviceInfo.model ?? ''}
          placeholder="如 iPhone 15 / 小米14"
          onChange={(e) => setDeviceInfo({ ...deviceInfo, model: e.target.value || null })}
          style={{
            flex: 1,
            padding: '8px 10px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)'
          }}
        />
      </div>
    </div>
  );
}
