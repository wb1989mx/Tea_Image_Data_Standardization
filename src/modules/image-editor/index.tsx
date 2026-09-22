import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactCrop, { type Crop, type PercentCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import type {
  ImageAsset,
  OutputFormat,
  BackgroundMode,
  CropShape,
  CropMeta,
  ColorProfile
} from '../../infrastructure/types';
import {
  SLOT_LABEL,
  CROP_SHAPE_DEF,
  DEFAULT_CROP_SHAPE,
  cropShapeOf,
  cropShapeRadius,
  isWildcardModel,
  slotOf
} from '../../infrastructure/types';
import { repositories } from '../../infrastructure/repository';
import { getColorProfileLookup } from '../../infrastructure/capabilities';
import {
  renderCrop,
  drawCrop,
  saveEditedAsset,
  isIdentityProfile,
  type EditParams,
  type PixelRect
} from './service';
import { EditorControls } from './components/EditorControls';

// 通配回退属于「能用但不精确」的提示，用琥珀色区别于错误红
const HIT_NOTE_COLOR = '#b26a00';

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
  // 裁剪模式：方形 / 圆形。与裁剪几何（位置/缩放/旋转）正交，故切换时无需重置任何几何状态。
  const [cropShape, setCropShape] = useState<CropShape>(DEFAULT_CROP_SHAPE);

  // 色彩矫正：按样品设备型号解析的预设 + 是否应用
  const [profile, setProfile] = useState<ColorProfile | null>(null);
  const [applyColor, setApplyColor] = useState(false);
  // 样品记录的机型：兜底分支要把"为什么没匹配上"讲清楚，就得把机型回显出来
  const [sampleModel, setSampleModel] = useState<string | null>(null);

  // 保存反馈：saving 防重复提交，saved 给出成功反馈后再返回，error 就地提示失败原因
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

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
      // 恢复该资产已保存的裁剪形状：否则重新编辑一张方形产出时会默认回到圆形，
      // 用户只点一次「确认」就把产物静默改回圆形 —— 这类不可见的状态翻转必须避免。
      // 历史资产无 shape 字段，cropShapeOf 兜底为圆形，与既有产出形态一致。
      setCropShape(cropShapeOf(a.cropMeta));
      const sample = await repositories.sample.get(a.sampleId);
      const model = sample?.deviceInfo.model ?? null;
      setSampleModel(model);
      const lookup = getColorProfileLookup();
      const p = lookup ? lookup(model) : null;
      setProfile(p);
      setApplyColor(p ? !isIdentityProfile(p) : false);
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [assetId]);

  // 命中类型：区分「精确命中机型」与「回退通配项」。
  // 在此之前二者在界面上都只表现为"有预设可用"，于是"我的预设没生效"这件事
  // 只能靠用户自己拿设置页的机型去比对才能发现 —— 这里把它显式讲出来。
  const colorHit: 'exact' | 'wildcard' | 'none' = !profile
    ? 'none'
    : isWildcardModel(profile.deviceModel)
      ? 'wildcard'
      : 'exact';

  // 两处兜底分支共用的出口按钮
  const gotoColorSettings = (
    <button
      onClick={() => navigate('/settings')}
      style={{
        alignSelf: 'flex-start',
        padding: '6px 12px',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        color: 'var(--text)',
        cursor: 'pointer',
        fontSize: 13
      }}
    >
      前往「设置 → 色彩映射表」维护
    </button>
  );

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
    const params: EditParams = { outputSize: PREVIEW, outputFormat, background, shape: cropShape };
    drawCrop(canvas, img, cropPx, params, rotation, scale, applyColor ? profile : null);
  }, [crop, completedCrop, scale, rotation, outputFormat, background, cropShape, imgReady, applyColor, profile]);

  const handleConfirm = async () => {
    if (saving || saved) return;
    if (!asset || !imgRef.current) {
      setError('图像尚未加载完成，请稍候再试');
      return;
    }
    const c = currentPercent();
    if (!c.width || !c.height) {
      setError('请先在原图上框选裁剪区域');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const img = imgRef.current;
      const sx = img.naturalWidth / 100;
      const sy = img.naturalHeight / 100;
      const cropPx: PixelRect = {
        x: c.x * sx,
        y: c.y * sy,
        width: c.width * sx,
        height: c.height * sy
      };
      const params: EditParams = { outputSize, outputFormat, background, shape: cropShape };
      const activeProfile = applyColor ? profile : null;
      const blob = await renderCrop(img, cropPx, params, rotation, scale, activeProfile);
      if (!blob || blob.size === 0) throw new Error('生成图像为空，请调整裁剪区域后重试');
      const cropMeta: CropMeta = {
        x: cropPx.x,
        y: cropPx.y,
        width: cropPx.width,
        height: cropPx.height,
        scale,
        rotation,
        outputSize,
        outputFormat,
        background,
        // 记录产物的实际蒙版形状：缩略图呈现与导出元数据都依赖它
        shape: cropShape
      };
      // 记录实际烘焙进 editedFile 的色彩参数（null=未应用），供记录/导出元数据使用
      asset.colorProfile = activeProfile;
      await saveEditedAsset(asset, blob, cropMeta);
      // 成功反馈：按钮短暂显示「已保存」再返回采集页（返回后槽位徽标同步为已确认）
      setSaved(true);
      setSaving(false);
      setTimeout(() => navigate(`/quality/${asset.sampleId}`), 800);
    } catch (e) {
      setSaving(false);
      setError(`保存失败：${e instanceof Error ? e.message : String(e)}（请重试）`);
    }
  };

  const handleCancel = () => {
    if (saving) return; // 保存过程中禁止离开，避免半途中断
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
        {/* 显示中文槽位名（如「茶汤第1冲」）：两张茶汤图编辑时才分得清在改哪张 */}
        <div style={{ fontWeight: 600 }}>图像编辑 · {SLOT_LABEL[slotOf(asset)]}</div>
        <button
          onClick={handleCancel}
          disabled={saving}
          style={{
            color: 'var(--muted)',
            background: 'none',
            border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.5 : 1
          }}
        >
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
            // 叠加层形状跟随定义表：圆形模式叠加圆形遮罩，方形模式为直角手柄。
            // aspect 恒为 1，故切换形状不改变选区几何 —— 这正是「切换零损失」的前提。
            circularCrop={CROP_SHAPE_DEF[cropShape].masked}
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
            cropShape={cropShape}
            scale={scale}
            rotation={rotation}
            outputSize={outputSize}
            outputFormat={outputFormat}
            background={background}
            onCropShape={setCropShape}
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
                {colorHit === 'exact' ? (
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>匹配机型：{profile.deviceModel}</div>
                ) : (
                  // 通配回退：明确告知"没匹配上"，否则用户会以为自己的预设已生效
                  <>
                    <div style={{ fontSize: 12, color: HIT_NOTE_COLOR }}>
                      样品机型「{sampleModel || '未记录'}」未命中具体预设，已回退通配项
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      如需精确匹配：在「设置 → 色彩映射表」为上述机型增补一条预设
                    </div>
                    {gotoColorSettings}
                  </>
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
              // 兜底分支：正常情况下不会走到这里 —— color-profile 的读取路径保证映射表中
              // 始终存在通配项。仅当色彩模块未注册（lookup 为空）时才可达。
              // 因此这里不能只丢一句提示：要说明机型、给出下一步动作，让用户能走出去。
              <>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>当前样品未匹配到色彩预设</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  样品机型：{sampleModel || '未记录'}；映射表中补一条同型号条目或通配项即可命中
                </div>
                {gotoColorSettings}
              </>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>实时预览</div>
          <canvas
            ref={previewRef}
            width={PREVIEW}
            height={PREVIEW}
            // 轮廓跟随裁剪形状，让「当前是哪一档」在预览处即可辨认
            style={{
              borderRadius: cropShapeRadius(cropShape),
              border: '1px solid var(--border)',
              background: 'var(--bg)'
            }}
          />
        </div>
      </div>

      {/* 保存状态提示：错误就地显示并保留在当前页，便于修正后重试 */}
      {error && (
        <div
          className="surface"
          style={{ padding: '10px 14px', color: '#c0392b', fontSize: 13, borderColor: '#c0392b' }}
        >
          {error}
        </div>
      )}
      {saved && (
        <div
          className="surface"
          style={{ padding: '10px 14px', color: 'var(--primary)', fontSize: 13 }}
        >
          已保存，正在返回采集页…
        </div>
      )}

      <button
        onClick={handleConfirm}
        disabled={saving || saved}
        style={{
          padding: '14px',
          borderRadius: 'var(--radius)',
          border: 'none',
          background: saved ? 'var(--muted)' : 'var(--primary)',
          color: '#fff',
          fontWeight: 600,
          fontSize: 16,
          cursor: saving || saved ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.75 : 1
        }}
      >
        {saved ? '已保存 ✓' : saving ? '保存中…' : '确认'}
      </button>
    </div>
  );
}
