import { useState } from 'react';
import type { ColorProfile } from '../../../infrastructure/types';
import { useMediaQuery } from '../../../infrastructure/utils';
import { loadProfiles, saveProfiles, filterString, DEFAULT_PROFILES } from '../service';

// 色彩映射表维护（设置页使用）：可增删改预设，并上传样图实时预览
//
// 响应式约定（移动端优先）：
// 1) 桌面端为「左参数 / 右预览」两列；移动端改为单列，且预览块**排在参数之前**，
//    保证进入页面即可看到预览，无需横向缩放或滚动。
// 2) 所有网格子项加 minWidth: 0 —— <input type="file"> 存在约 200px 的固有最小宽度，
//    在固定两列网格中会撑破容器导致页面横向溢出，移动端浏览器随即整体缩小页面
//    （用户感知为"必须缩放才能看全"）。
// 3) 移动端表单控件字号由 index.css 的全局媒体查询统一提升至 16px（防 iOS 聚焦自动缩放），
//    此处不再单独声明，避免两处事实来源。
export function ColorProfileSettings() {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [profiles, setProfiles] = useState<ColorProfile[]>(() => loadProfiles());
  const [active, setActive] = useState(0);
  const [testImg, setTestImg] = useState<string>('');
  const [saved, setSaved] = useState(false);

  const current = profiles[active] ?? DEFAULT_PROFILES[0];

  const update = (patch: Partial<ColorProfile>) => {
    setProfiles((prev) => prev.map((p, i) => (i === active ? { ...p, ...patch } : p)));
    setSaved(false);
  };

  const persist = () => {
    saveProfiles(profiles);
    setSaved(true);
  };

  const addNew = () => {
    setProfiles((prev) => [
      ...prev,
      { deviceModel: '新设备', temperature: 0, tint: 0, saturation: 1, contrast: 1, presetName: '新预设' }
    ]);
    setActive(profiles.length);
    setSaved(false);
  };

  const remove = (i: number) => {
    setProfiles((prev) => prev.filter((_, idx) => idx !== i));
    setActive(0);
    setSaved(false);
  };

  // ---- 参数列（预设名称 / 设备匹配 / 四项滑杆） ----
  const paramsCol = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <label style={{ fontSize: 13, color: 'var(--muted)' }}>预设名称</label>
      <input
        value={current.presetName}
        onChange={(e) => update({ presetName: e.target.value })}
        style={field}
      />
      <label style={{ fontSize: 13, color: 'var(--muted)' }}>匹配设备型号（* 为通配）</label>
      <input
        value={current.deviceModel}
        onChange={(e) => update({ deviceModel: e.target.value })}
        style={field}
      />
      <Slider label={`色温 ${current.temperature}`} min={-500} max={500} step={10} value={current.temperature} onChange={(v) => update({ temperature: v })} />
      <Slider label={`色调 ${current.tint}`} min={-100} max={100} step={1} value={current.tint} onChange={(v) => update({ tint: v })} />
      <Slider label={`饱和度 ${current.saturation.toFixed(2)}`} min={0.5} max={1.5} step={0.01} value={current.saturation} onChange={(v) => update({ saturation: v })} />
      <Slider label={`对比度 ${current.contrast.toFixed(2)}`} min={0.5} max={1.5} step={0.01} value={current.contrast} onChange={(v) => update({ contrast: v })} />
    </div>
  );

  // ---- 预览列（样图实时预览） ----
  const previewCol = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <label style={{ fontSize: 13, color: 'var(--muted)' }}>样图实时预览（上传测试）</label>
      <input
        type="file"
        accept="image/*"
        style={{ ...field, width: '100%' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setTestImg(URL.createObjectURL(f));
        }}
      />
      <div
        style={{
          flex: isDesktop ? 1 : undefined,
          minHeight: isDesktop ? 160 : 140,
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          background: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}
      >
        {testImg ? (
          <img src={testImg} alt="预览" style={{ maxWidth: '100%', maxHeight: 220, filter: filterString(current) }} />
        ) : (
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>未上传样图</span>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={active}
          onChange={(e) => setActive(Number(e.target.value))}
          style={{ ...field, flex: '1 1 180px', minWidth: 0, maxWidth: '100%' }}
        >
          {profiles.map((p, i) => (
            <option key={i} value={i}>
              {p.presetName}（{p.deviceModel}）
            </option>
          ))}
        </select>
        <button onClick={addNew} style={btn()}>
          新增预设
        </button>
        <button onClick={() => remove(active)} style={btn()}>
          删除
        </button>
        <button onClick={persist} style={btnPrimary}>
          保存映射表
        </button>
        {saved && <span style={{ color: 'var(--primary)', fontSize: 13 }}>已保存</span>}
      </div>

      {/* 列序：桌面端 左参数→右预览；移动端 预览→参数（首屏即可见样图） */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr',
          gap: 12
        }}
      >
        {isDesktop ? (
          <>
            {paramsCol}
            {previewCol}
          </>
        ) : (
          <>
            {previewCol}
            {paramsCol}
          </>
        )}
      </div>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%' }}
      />
    </div>
  );
}

const field: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)'
};
function btn(primary = false): React.CSSProperties {
  return {
    padding: '8px 12px',
    borderRadius: 'var(--radius)',
    border: primary ? 'none' : '1px solid var(--border)',
    background: primary ? 'var(--primary)' : 'var(--surface)',
    color: primary ? '#fff' : 'var(--text)',
    cursor: 'pointer'
  };
}
const btnPrimary = btn(true);
