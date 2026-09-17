import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactCrop, { type Crop, type PercentCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import type { ImageAsset, OutputFormat, BackgroundMode, CropMeta, ColorProfile } from '../../infrastructure/types';
import { repositories } from '../../infrastructure/repository';
import { getColorProfileLookup } from '../../infrastructure/capabilities';
import {
  renderCircleCrop,
  drawCircleCrop,
  saveEditedAsset,
  isIdentityProfile,
  type EditParams,
  type PixelRect
} from './service';
import { EditorControls } from './components/EditorControls';

// 图像编辑页（独立路由 /edit/:assetId）
// 圆形裁剪 + 缩放/旋转 + 输出尺寸/格式/底色 + 色彩矫正；确认回写并广播，取消不保存
const PREVIEW = 220;
const DEFAULT_PERCENT: PercentCrop = { unit: '%', x: 10, y: 10, width: 80, height: 80 };

export function ImageEditorPage() {
  const { assetId } = useParams();
  const navigate = useNavigate();

  const [asset, setAsset] = useState<ImageAsset | null>(null);
  const [imgSrc, setImgSrc] = useState<string>('');
  const [crop, setCrop] = useState<Crop>(DEFAULT_PERCENT);
  const [completedCrop, setCompletedCrop] = useState<PercentCrop | null>(null);
  const [imgReady, setImgReady] = useState(false);

  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [outputSize, setOutputSize] = useState(1024);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('png');
  const [background, setBackground] = useState<BackgroundMode>('transparent');

  // 色彩矫正：按样品设备型号解析的预设 + 是否应用
  const [profile, setProfile] = useState<ColorProfile | null>(null);
  const [applyColor, setApplyColor] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const previewRef = useRef<HTMLCanvasElement | null>(null);

  // 载入资产与原图，并按样品设备型号解析色彩预设
  useEffect(() => {
    if (!assetId) return;
    let url = '';
    repositories.asset.get(assetId).then(async (a) => {
      if (!a) return;
      setAsset(a);
      url = URL.createObjectURL(a.originalFile);
      setImgSrc(url);
      const sample = await repositories.sample.get(a.sampleId);
      const model = sample?.deviceInfo.model ?? null;
      const lookup = getColorProfileLookup();
      const p = lookup ? lookup(model) : null;
      setProfile(p);
      setApplyColor(p ? !isIdentityProfile(p) : false);
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [assetId]);

  const currentPercent = (): PercentCrop => completedCrop ?? DEFAULT_PERCENT;

  // 实时预览（应用色彩矫正时一并烘焙）
  useEffect(() => {
    const img = imgRef.current;
    const canvas = previewRef.current;
    if (!img || !canvas || !imgReady) return;
    const c = currentPercent();
    if (!c.width || !c.height) return;
    const sx = img.naturalWidth / 100;
    const sy = img.naturalHeight / 100;
    const cropPx: PixelRect = {
      x: c.x * sx,
      y: c.y * sy,
      width: c.width * sx,
      height: c.height * sy
    };
    const params: EditParams = { outputSize: PREVIEW, outputFormat, background };
    drawCircleCrop(canvas, img, cropPx, params, rotation, scale, applyColor ? profile : null);
  }, [crop, completedCrop, scale, rotation, outputFormat, background, imgReady, applyColor, profile]);

  const handleConfirm = async () => {
    if (!asset || !imgRef.current) return;
    const c = currentPercent();
    if (!c.width || !c.height) {
      alert('请先框选裁剪区域');
      return;
    }
    const img = imgRef.current;
    const sx = img.naturalWidth / 100;
    const sy = img.naturalHeight / 100;
    const cropPx: PixelRect = {
      x: c.x * sx,
      y: c.y * sy,
      width: c.width * sx,
      height: c.height * sy
    };
    const params: EditParams = { outputSize, outputFormat, background };
    const activeProfile = applyColor ? profile : null;
    const blob = await renderCircleCrop(img, cropPx, params, rotation, scale, activeProfile);
    const cropMeta: CropMeta = {
      x: cropPx.x,
      y: cropPx.y,
      width: cropPx.width,
      height: cropPx.height,
      scale,
      rotation,
      outputSize,
      outputFormat,
      background
    };
    // 记录实际烘焙进 editedFile 的色彩参数（null=未应用），供记录/导出元数据使用
    asset.colorProfile = activeProfile;
    await saveEditedAsset(asset, blob, cropMeta);
    navigate(`/quality/${asset.sampleId}`);
  };

  const handleCancel = () => {
    if (asset) navigate(`/quality/${asset.sampleId}`);
    else navigate('/record');
  };

  if (!asset) {
    return (
      <div className="surface" style={{ padding: 16, color: 'var(--muted)' }}>
        加载图像资产中…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        className="surface"
        style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div style={{ fontWeight: 600 }}>图像编辑 · {asset.dimension}</div>
        <button onClick={handleCancel} style={{ color: 'var(--muted)', background: 'none', border: 'none' }}>
          取消
        </button>
      </div>

      <div className="surface" style={{ padding: 16, display: 'flex', justifyContent: 'center' }}>
        {imgSrc && (
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(_, percentCrop) => setCompletedCrop(percentCrop)}
            aspect={1}
            circularCrop
            keepSelection
          >
            <img
              ref={imgRef}
              src={imgSrc}
              alt="编辑原图"
              onLoad={() => setImgReady(true)}
              style={{ maxWidth: '100%', maxHeight: '60vh' }}
            />
          </ReactCrop>
        )}
      </div>

      <div
        className="surface"
        style={{ padding: 16, display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}
      >
        <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <EditorControls
            scale={scale}
            rotation={rotation}
            outputSize={outputSize}
            outputFormat={outputFormat}
            background={background}
            onScale={setScale}
            onRotate={setRotation}
            onOutputSize={setOutputSize}
            onFormat={setOutputFormat}
            onBackground={setBackground}
          />
          <div className="surface" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontWeight: 600 }}>色彩矫正</div>
            {profile ? (
              <>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {applyColor ? `已应用预设：${profile.presetName}` : '未应用（原图输出）'}
                </div>
                {profile.deviceModel !== '*' && (
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>匹配机型：{profile.deviceModel}</div>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={applyColor}
                    onChange={(e) => setApplyColor(e.target.checked)}
                  />
                  应用色彩矫正
                </label>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                未找到色彩预设（可在「设置 → 色彩映射表」维护设备→参数）
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>实时预览</div>
          <canvas
            ref={previewRef}
            width={PREVIEW}
            height={PREVIEW}
            style={{ borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg)' }}
          />
        </div>
      </div>

      <button
        onClick={handleConfirm}
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
        确认
      </button>
    </div>
  );
}
