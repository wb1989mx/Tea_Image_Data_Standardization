import type { OutputFormat, BackgroundMode, CropShape } from '../../../infrastructure/types';
import { CROP_SHAPES, CROP_SHAPE_DEF, cropCoverScale } from '../../../infrastructure/types';

// 编辑控制面板：裁剪模式 / 缩放 / 旋转 / 输出尺寸 / 格式 / 底色
// 纯受控组件，仅通过 props 回调通信
interface Props {
  cropShape: CropShape;
  scale: number;
  rotation: number;
  outputSize: number;
  outputFormat: OutputFormat;
  background: BackgroundMode;
  onCropShape: (v: CropShape) => void;
  onScale: (v: number) => void;
  onRotate: (v: number) => void;
  onOutputSize: (v: number) => void;
  onFormat: (v: OutputFormat) => void;
  onBackground: (v: BackgroundMode) => void;
}

const fieldStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)'
};

export function EditorControls(props: Props) {
  const shapeDef = CROP_SHAPE_DEF[props.cropShape];
  // 四角露底是「正方形 + 旋转」且缩放不足时的必然结果，故按充要条件判断，
  // 而不是只看「旋转≠0」——否则用户已缩放到位时仍被提示，提示就沦为噪音。
  const needScale = cropCoverScale(props.cropShape, props.rotation);
  const cornersUncovered = !shapeDef.masked && props.scale < needScale - 1e-9;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 裁剪模式：两态分段控件，选项由 CROP_SHAPES 定义表驱动。
          形状只决定「输出蒙版」，因此切换不会重置裁剪框、缩放、旋转或色彩矫正 ——
          这一点是刻意的：形状属呈现层，几何属编辑层，两层互不干涉。 */}
      <div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>裁剪模式</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {CROP_SHAPES.map((s) => {
            const on = props.cropShape === s.key;
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={on}
                title={s.hint}
                onClick={() => props.onCropShape(s.key)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '8px 10px',
                  borderRadius: 'var(--radius)',
                  border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                  background: on ? 'var(--primary)' : 'var(--surface)',
                  color: on ? '#fff' : 'var(--text)',
                  fontWeight: on ? 600 : 400,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>
          {shapeDef.hint}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
          缩放：{props.scale.toFixed(2)}×
        </div>
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.01}
          value={props.scale}
          onChange={(e) => props.onScale(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      <div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
          旋转：{props.rotation}°
        </div>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={props.rotation}
          onChange={(e) => props.onRotate(Number(e.target.value))}
          style={{ width: '100%' }}
        />
        {/* 如实告知这一处几何边界，而不是替用户清空裁剪。
            提示给出「需要多少缩放」这个可执行数字，用户照做即可消除。 */}
        {cornersUncovered && (
          <div style={{ fontSize: 11, color: HINT_COLOR, marginTop: 4, lineHeight: 1.5 }}>
            正方形 + 旋转 {props.rotation}°：旋转后方片盖不住画布四角，会露出底色；
            缩放提高至 {needScale.toFixed(2)}× 以上即可填满（当前 {props.scale.toFixed(2)}×）
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 13, color: 'var(--muted)' }}>输出尺寸（像素）</label>
        <select
          value={props.outputSize}
          onChange={(e) => props.onOutputSize(Number(e.target.value))}
          style={fieldStyle}
        >
          <option value={512}>512 × 512</option>
          <option value={1024}>1024 × 1024</option>
          <option value={2048}>2048 × 2048</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>格式</label>
          <select
            value={props.outputFormat}
            onChange={(e) => props.onFormat(e.target.value as OutputFormat)}
            style={fieldStyle}
          >
            <option value="png">PNG</option>
            <option value="webp">WebP</option>
          </select>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>底色</label>
          <select
            value={props.background}
            onChange={(e) => props.onBackground(e.target.value as BackgroundMode)}
            style={fieldStyle}
          >
            <option value="transparent">透明底</option>
            <option value="white">白底</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// 「能用但需注意」的提示色（与色彩矫正的通配回退提示同色，保持全局语义一致），
// 不用错误红：这是几何必然结果，不是错误。
const HINT_COLOR = '#b26a00';
