export * from '../../infrastructure/types';

// [模块占位] 存储：Dexie schema + repository 实现（CRUD）
// 公开接口：db / sampleRepo / assetRepo
export function StoragePanel() {
  return (
    <div className="surface" style={{ padding: 16, color: 'var(--muted)' }}>
      存储模块（modules/storage 待实现）
    </div>
  );
}
