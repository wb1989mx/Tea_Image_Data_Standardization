export * from '../../infrastructure/types';

// [模块占位] 导出：ZIP 打包（三图 + metadata.csv + metadata.json + manifest.txt）
// 公开接口：packZip(samples)
export function ExportPanel() {
  return (
    <div className="surface" style={{ padding: 16, color: 'var(--muted)' }}>
      导出模块（modules/export 待实现）
    </div>
  );
}
