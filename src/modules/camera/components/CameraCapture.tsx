import { useEffect, useRef, useState } from 'react';
import type { CaptureProps } from '../../../infrastructure/capabilities';
import { openStream, readCapabilities, captureFrame, applyControl, type CameraCaps } from '../service';

// 相机采集组件（注册到 infrastructure/capabilities，quality 模块经 getCameraCapture() 使用）
// 支持后置优先、变焦/曝光/对焦/白平衡专业控制；不支持时降级为文件上传
export function CameraCapture({ preferRear, onCaptured, onCancel }: CaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [caps, setCaps] = useState<CameraCaps>({});
  const [zoom, setZoom] = useState(1);
  const [exposure, setExposure] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stream = await openStream(preferRear ?? true);
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play();
        }
        const track = stream.getVideoTracks()[0];
        if (track) setCaps(readCapabilities(track));
        setReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : '摄像头打开失败');
      }
    })();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [preferRear]);

  const doCapture = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      const blob = await captureFrame(v);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      onCaptured(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : '抓帧失败');
    }
  };

  const handleCancel = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCancel();
  };

  if (error) {
    // 降级：文件上传
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ color: '#c0392b', fontSize: 13 }}>摄像头不可用：{error}</div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>已降级为文件上传：</div>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onCaptured(f);
          }}
        />
        <button onClick={handleCancel} style={btn()}>
          取消
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <video
        ref={videoRef}
        muted
        playsInline
        style={{ width: '100%', borderRadius: 'var(--radius)', background: '#000', maxHeight: '50vh' }}
      />
      {!ready && <div style={{ color: 'var(--muted)', fontSize: 13 }}>摄像头启动中…</div>}

      {caps.zoom && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>变焦 {zoom.toFixed(2)}×</div>
          <input
            type="range"
            min={caps.zoom[0]}
            max={caps.zoom[1]}
            step={0.01}
            value={zoom}
            onChange={async (e) => {
              const z = Number(e.target.value);
              setZoom(z);
              const t = streamRef.current?.getVideoTracks()[0];
              if (t) await applyControl(t, { zoom: z });
            }}
            style={{ width: '100%' }}
          />
        </div>
      )}

      {caps.exposure && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>曝光补偿 {exposure}</div>
          <input
            type="range"
            min={caps.exposure[0]}
            max={caps.exposure[1]}
            step={0.1}
            value={exposure}
            onChange={async (e) => {
              const x = Number(e.target.value);
              setExposure(x);
              const t = streamRef.current?.getVideoTracks()[0];
              if (t) await applyControl(t, { exposureCompensation: x });
            }}
            style={{ width: '100%' }}
          />
        </div>
      )}

      {caps.focus && (
        <button
          onClick={async () => {
            const t = streamRef.current?.getVideoTracks()[0];
            if (t) await applyControl(t, { focusMode: 'manual', focusDistance: 0 });
          }}
          style={btn()}
        >
          点按对焦（手动）
        </button>
      )}

      {caps.whiteBalance && (
        <button
          onClick={async () => {
            const t = streamRef.current?.getVideoTracks()[0];
            if (t) await applyControl(t, { whiteBalanceMode: 'manual' });
          }}
          style={btn()}
        >
          手动白平衡
        </button>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={doCapture} disabled={!ready} style={btnPrimary}>
          拍照
        </button>
        <button onClick={handleCancel} style={btn()}>
          取消
        </button>
      </div>
    </div>
  );
}

function btn(primary = false): React.CSSProperties {
  return {
    padding: '10px 14px',
    borderRadius: 'var(--radius)',
    border: primary ? 'none' : '1px solid var(--border)',
    background: primary ? 'var(--primary)' : 'var(--surface)',
    color: primary ? '#fff' : 'var(--text)',
    cursor: 'pointer'
  };
}
const btnPrimary = btn(true);
