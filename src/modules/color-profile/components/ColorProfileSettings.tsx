import { useState } from 'react';
import type { ColorProfile, ColorParamKey, ParamSpec } from '../../../infrastructure/types';
import {
  PARAM_SPECS,
  NEUTRAL_COLOR_PARAMS,
  WILDCARD_MODEL,
  clampParam,
  formatParam,
  paramRangeText
} from '../../../infrastructure/types';
import { useMediaQuery } from '../../../infrastructure/utils';
import { loadProfiles, saveProfiles, filterString, DEFAULT_PROFILES } from '../service';

// 色彩映射表维护（设置页使用）：可增删改预设，并上传样图实时预览
//
// 响应式约定（移动端优先）：
// 1) 桌面端为「左参数(定宽 280~320px) / 右预览(占满剩余)」两列；移动端改单列，
//    且预览块**排在参数之前**，保证进入页面即可看到预览，无需横向缩放或滚动。
// 2) 所有网格子项加 minWidth: 0 —— <input type="file"> 存在约 200px 的固有最小宽度，
//    在固定两列网格中会撑破容器导致页面横向溢出，移动端浏览器随即整体缩小页面
//    （用户感知为"必须缩放才能看全"）。
// 3) 移动端表单控件字号由 index.css 的全局媒体查询统一提升至 16px（防 iOS 聚焦自动缩放），
//    此处不再单独声明，避免两处事实来源。
//
// 参数区约定：
// - 参数元信息（上下限/步长/中性值/单位/语义）全部来自 PARAM_SPECS，本文件不写死任何边界数值；
//   新增参数只需在 PARAM_SPECS 追加一行，此处渲染、钳制、回显自动跟随。
// - 数值输入采用「草稿缓冲」：编辑中保留用户原始文本（否则无法清空重输、前导负号会被吞），
//   仅当可解析时提交；失焦时统一经 clampParam 钳制到上下限并按定义表小数位回显。
export function ColorProfileSettings() {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [profiles, setProfiles] = useState<ColorProfile[]>(() => loadProfiles());
  const [active, setActive] = useState(0);
  const [testImg, setTestImg] = useState<string>('');
  const [saved, setSaved] = useState(false);
  // 「按住看原图」：按下期间临时移除 filter，便于判断校准幅度
  const [showOriginal, setShowOriginal] = useState(false);

  const current = profiles[active] ?? DEFAULT_PROFILES[0];

  // 通配项是「未匹配机型」的唯一兜底出口，删除它会让编辑页对未匹配机型彻底失去预设。
  // 读取路径虽会自动补回（ensureWildcard），但"删了又回来"本身就是困惑源，故在源头禁止。
  const isWildcardRow = current.deviceModel === WILDCARD_MODEL;
  const hasWildcard = profiles.some((p) => p.deviceModel === WILDCARD_MODEL);

  const update = (patch: Partial<ColorProfile>) => {
    setProfiles((prev) => prev.map((p, i) => (i === active ? { ...p, ...patch } : p)));
    setSaved(false);
  };

  const updateParam = (key: ColorParamKey, value: number) => {
    setProfiles((prev) => prev.map((p, i) => (i === active ? { ...p, [key]: value } : p)));
    setSaved(false);
  };

  const persist = () => {
    saveProfiles(profiles);
    setSaved(true);
  };

  const addNew = () => {
    // 新预设初值直接取定义表的中性值集合，PARAM_SPECS 新增参数时自动带上
    setProfiles((prev) => [
      ...prev,
      { deviceModel: '新设备', ...NEUTRAL_COLOR_PARAMS, presetName: '新预设' }
    ]);
    setActive(profiles.length);
    setSaved(false);
  };

  const remove = (i: number) => {
    const target = profiles[i];
    // 双重保险：按钮已 disable，此处再挡一次，防止键盘/程序路径绕过
    if (!target || target.deviceModel === WILDCARD_MODEL) return;
    setProfiles((prev) => prev.filter((_, idx) => idx !== i));
    setActive(0);
    setSaved(false);
  };

  // ---- 参数列（预设名称 / 设备匹配 / 参数数字输入） ----
  const paramsCol = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      {/* 预设名称与设备型号并排一行，压缩竖向空间 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={labelText}>预设名称</span>
          <input
            value={current.presetName}
            onChange={(e) => update({ presetName: e.target.value })}
            style={field}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={labelText}>匹配设备型号（* 通配）</span>
          <input
            value={current.deviceModel}
            onChange={(e) => update({ deviceModel: e.target.value })}
            style={field}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {PARAM_SPECS.map((spec) => (
          <ParamField
            key={spec.key}
            spec={spec}
            value={current[spec.key]}
            onChange={(v) => updateParam(spec.key, v)}
          />
        ))}
      </div>
    </div>
  );

  // ---- 预览列（样图实时预览） ----
  const previewCol = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ ...labelText, flex: '1 1 auto' }}>样图实时预览（上传测试）</span>
        <button
          type="button"
          disabled={!testImg}
          onPointerDown={() => setShowOriginal(true)}
          onPointerUp={() => setShowOriginal(false)}
          onPointerLeave={() => setShowOriginal(false)}
          onPointerCancel={() => setShowOriginal(false)}
          style={{ ...btn(), padding: '4px 10px', fontSize: 12, opacity: testImg ? 1 : 0.5 }}
        >
          按住看原图
        </button>
      </div>
      <input
        type="file"
        accept="image/*"
        style={{ ...field, width: '100%' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setTestImg(URL.createObjectURL(f));
            setShowOriginal(false);
          }
        }}
      />
      {/* 底色固定为中性灰：色彩与明度判断不受主题切换干扰，是校色场景的标准做法 */}
      <div
        style={{
          height: isDesktop ? 'clamp(320px, 46vh, 560px)' : 'clamp(240px, 40vh, 420px)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          background: PREVIEW_BG,
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
          padding: 8
        }}
      >
        {testImg ? (
          <img
            src={testImg}
            alt="预览"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              filter: showOriginal ? 'none' : filterString(current)
            }}
          />
        ) : (
          <span style={{ color: '#FFFFFF', fontSize: 13 }}>未上传样图</span>
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
        <button
          onClick={() => remove(active)}
          disabled={isWildcardRow}
          title={isWildcardRow ? '通配项是未匹配机型的兜底出口，不可删除' : '删除当前预设'}
          style={{
            ...btn(),
            opacity: isWildcardRow ? 0.45 : 1,
            cursor: isWildcardRow ? 'not-allowed' : 'pointer'
          }}
        >
          删除
        </button>
        <button onClick={persist} style={btnPrimary}>
          保存映射表
        </button>
        {saved && <span style={{ color: 'var(--primary)', fontSize: 13 }}>已保存</span>}
      </div>

      {/* 映射表状态常驻可见：通配项缺失是「编辑页找不到预设」的唯一成因，
          把它摆在设置页，用户自检时不必先撞上一次无解的错误提示。 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--muted)' }}>
        <span>映射表共 {profiles.length} 条</span>
        <span>{hasWildcard ? '通配项已配置（未匹配机型走它）' : '通配项缺失（读取时会自动补齐）'}</span>
        {isWildcardRow && <span style={{ color: 'var(--text)' }}>当前选中为通配项，不可删除</span>}
      </div>

      {/* 列序：桌面端 左参数→右预览；移动端 预览→参数（首屏即可见样图） */}
      <div
        style={{
          display: 'grid',
          // 参数列定宽（280~320px）而非等分：参数区只占必要宽度，其余全部让给预览
          gridTemplateColumns: isDesktop ? 'minmax(280px, 320px) minmax(0, 1fr)' : '1fr',
          gap: 14,
          alignItems: 'start'
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

// 单个参数行：左（标签 + 上下限提示） / 右（数字输入框）
function ParamField({
  spec,
  value,
  onChange
}: {
  spec: ParamSpec;
  value: number;
  onChange: (v: number) => void;
}) {
  // draft === null 表示「未在编辑」，显示值由 value 派生（切换预设时自动同步）
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? formatParam(spec.key, value);

  const handleChange = (t: string) => {
    setDraft(t);
    // 中间态不提交：空串与单独的负号在输入过程中会频繁出现，提交会把光标打回去
    if (t.trim() === '' || t.trim() === '-') return;
    const n = Number(t);
    // 编辑中不钳制（否则想把 -5 改成 -0.5 会被提前改写），仅提交可解析的数值
    if (Number.isFinite(n)) onChange(n);
  };

  const commit = () => {
    const t = (draft ?? '').trim();
    // 失焦统一钳制：空值回退中性值，越界值收敛到上下限，并规范化小数位
    onChange(clampParam(spec.key, t === '' ? NaN : Number(t)));
    setDraft(null);
  };

  const draftNum = draft === null || draft.trim() === '' ? null : Number(draft);
  const outOfRange =
    draftNum !== null &&
    Number.isFinite(draftNum) &&
    (draftNum < spec.min || draftNum > spec.max);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) 88px',
        gap: 8,
        alignItems: 'center',
        minWidth: 0
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }} title={spec.desc}>
        <span style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap' }}>{spec.label}</span>
        <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
          {paramRangeText(spec)}
        </span>
      </div>
      <input
        type="number"
        inputMode="decimal"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={display}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        aria-label={`${spec.label}（${paramRangeText(spec)}）`}
        style={{
          ...field,
          padding: '4px 8px',
          // 收紧行高：参数行是纯数字输入，不需要正文行高，压缩后 5 行共省下约 25px
          lineHeight: 1.2,
          minWidth: 0,
          // 字号刻意不在此声明：移动端由 index.css 的全局媒体查询统一提升到 16px
          // （防 iOS 聚焦自动缩放），桌面端沿用控件默认字号。避免两处事实来源。
          borderColor: outOfRange ? WARN_COLOR : 'var(--border)'
        }}
      />
    </div>
  );
}

const PREVIEW_BG = '#808080';
const WARN_COLOR = '#c0392b';

const labelText: React.CSSProperties = { fontSize: 12, color: 'var(--muted)' };

const field: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  minWidth: 0
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
