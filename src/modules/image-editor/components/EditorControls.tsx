import type { OutputFormat, BackgroundMode } from '../../../infrastructure/types';

// 编辑控制面板：缩放 / 旋转 / 输出尺寸 / 格式 / 底色
// 纯受控组件，仅通过 props 回调通信
interface Props {
  scale: number;
  rotation: number;
  outputSize: number;
  outputFormat: OutputFormat;
  background: BackgroundMode;
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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
