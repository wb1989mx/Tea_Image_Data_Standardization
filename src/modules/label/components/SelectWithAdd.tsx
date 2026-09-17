import { useState } from 'react';

// 可自定义新增的下拉选择器（类别 / 等级复用）
// 纯展示组件，仅通过 props 回调与外部通信
interface Props {
  label: string;
  value: string;
  options: string[];
  placeholder?: string;
  onChange: (v: string) => void;
  onAdd: (v: string) => void | Promise<void>;
}

export function SelectWithAdd({ label, value, options, placeholder, onChange, onAdd }: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const commit = async () => {
    const v = draft.trim();
    if (v) {
      await onAdd(v);
      onChange(v);
    }
    setDraft('');
    setAdding(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ color: 'var(--muted)', fontSize: 13 }}>{label}</label>
      {!adding ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)'
            }}
          >
            <option value="">{placeholder ?? '请选择'}</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setAdding(true)}
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--primary)'
            }}
          >
            + 新增
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="输入新选项"
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)'
            }}
          />
          <button
            type="button"
            onClick={commit}
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--primary)',
              background: 'var(--primary)',
              color: '#fff'
            }}
          >
            确定
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setDraft('');
            }}
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--muted)'
            }}
          >
            取消
          </button>
        </div>
      )}
    </div>
  );
}
