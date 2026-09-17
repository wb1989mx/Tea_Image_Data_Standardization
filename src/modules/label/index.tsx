import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLabelStore } from './store';
import { createDraft, saveLabel, isLabelComplete, getDraftLabel } from './service';
import { SelectWithAdd } from './components/SelectWithAdd';
import { useRootStore } from '../../infrastructure/store';
import type { SampleStatus } from '../../infrastructure/types';

const STATUS_LABEL: Record<SampleStatus, string> = {
  incomplete: '未完成',
  pending: '待确认',
  registered: '已登记'
};

// 标签登记页（路由 /label 与 /label/:sampleId）
// 仅依赖 infrastructure + 自身；设备信息从根 Store 读取（由 device 模块写入）
export function LabelPage() {
  const { sampleId } = useParams();
  const navigate = useNavigate();
  const deviceInfo = useRootStore((s) => s.deviceInfo);

  const {
    category,
    name,
    year,
    grade,
    status,
    categories,
    grades,
    loadOptions,
    loadFromSample,
    setField,
    setSampleId,
    addCategory,
    addGrade
  } = useLabelStore();

  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  // 初始化：加载选项；有 sampleId 则回填草稿，否则创建新草稿并改写路由
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadOptions();
      if (sampleId) {
        const draft = await getDraftLabel(sampleId);
        if (draft && !cancelled) {
          loadFromSample(draft);
          setReady(true);
          return;
        }
      }
      const created = await createDraft(deviceInfo);
      if (!cancelled) {
        setSampleId(created.id);
        setReady(true);
        navigate(`/label/${created.id}`, { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
    // 仅在 sampleId 变化时重建草稿，避免循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleId]);

  const handleSave = async () => {
    const input = { category, name, year, grade, deviceInfo };
    if (!isLabelComplete(input)) {
      setError('请完整填写：茶叶类别、名称、年份、等级');
      return;
    }
    setError('');
    const id = useLabelStore.getState().sampleId;
    if (!id) return;
    await saveLabel(id, input);
    navigate(`/quality/${id}`);
  };

  if (!ready) {
    return (
      <div className="surface" style={{ padding: 16, color: 'var(--muted)' }}>
        正在准备标签草稿…
      </div>
    );
  }

  const fieldStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        className="surface"
        style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div style={{ fontWeight: 600 }}>标签登记</div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          当前状态：<b style={{ color: 'var(--primary)' }}>{STATUS_LABEL[status]}</b>
        </div>
      </div>

      <div className="surface" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SelectWithAdd
          label="茶叶类别"
          value={category}
          options={categories}
          placeholder="请选择类别"
          onChange={(v) => setField('category', v)}
          onAdd={addCategory}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ color: 'var(--muted)', fontSize: 13 }}>茶叶名称</label>
          <input
            value={name}
            onChange={(e) => setField('name', e.target.value)}
            placeholder="如：西湖龙井"
            style={fieldStyle}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ color: 'var(--muted)', fontSize: 13 }}>年份</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setField('year', Number(e.target.value))}
            style={fieldStyle}
          />
        </div>

        <SelectWithAdd
          label="等级"
          value={grade}
          options={grades}
          placeholder="请选择等级"
          onChange={(v) => setField('grade', v)}
          onAdd={addGrade}
        />

        {deviceInfo.model && (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            设备信息：{deviceInfo.model}
            {deviceInfo.os ? ` · ${deviceInfo.os}` : ''}
            {deviceInfo.exifModel ? ` · EXIF ${deviceInfo.exifModel}` : ''}
          </div>
        )}
      </div>

      {error && <div style={{ color: '#c0392b', fontSize: 13 }}>{error}</div>}

      <button
        onClick={handleSave}
        style={{
          padding: '14px',
          borderRadius: 'var(--radius)',
          border: 'none',
          background: 'var(--primary)',
          color: '#fff',
          fontWeight: 600,
          fontSize: 16
        }}
      >
        保存标签，进入质量维度
      </button>
    </div>
  );
}
