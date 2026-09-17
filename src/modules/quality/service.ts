import type { Sample, ImageAsset, QualityDimension } from '../../infrastructure/types';
import { uid } from '../../infrastructure/utils';
import { repositories } from '../../infrastructure/repository';
import { bus } from '../../infrastructure/event-bus';
import { getExifExtractor, getColorProfileLookup } from '../../infrastructure/capabilities';

// 质量维度服务层：创建/挂载图像资产、校验登记就绪、确认登记生成 Sample
// 仅依赖 infrastructure（repository / event-bus / capabilities），不触碰其它业务模块

// 将原始图写入资产并挂到样品对应槽位；并尝试用 EXIF 提取能力补全设备型号
export async function ensureAsset(
  sampleId: string,
  dimension: QualityDimension,
  original: Blob
): Promise<ImageAsset> {
  const now = Date.now();
  const asset: ImageAsset = {
    id: uid('a'),
    sampleId,
    dimension,
    originalFile: original,
    editedFile: null,
    fileName: '',
    freeCode: '',
    cropMeta: null,
    colorProfile: null,
    createdAt: now,
    updatedAt: now
  };
  await repositories.asset.put(asset);
  const sample = await repositories.sample.get(sampleId);
  if (sample) {
    sample.images[dimension] = asset;
    // 仅当样品尚无 EXIF 信息时尝试从首张图补全（设备型号/相机型号）
    if (!sample.deviceInfo.exifMake && !sample.deviceInfo.exifModel) {
      const extractor = getExifExtractor();
      if (extractor) {
        const exif = await extractor(original);
        if (exif) {
          sample.deviceInfo = {
            ...sample.deviceInfo,
            exifMake: exif.make,
            exifModel: exif.model
          };
        }
      }
    }
    sample.updatedAt = now;
    await repositories.sample.update(sample);
  }
  return asset;
}

// 登记就绪判定：标签完整 + 三图均已编辑确认（editedFile 存在）
export function isRegistrationReady(sample: Sample): boolean {
  const { shape, soup, leaf } = sample.images;
  return Boolean(
    sample.category &&
      sample.name &&
      sample.year &&
      sample.grade &&
      shape?.editedFile &&
      soup?.editedFile &&
      leaf?.editedFile
  );
}

// 确认登记：状态置 registered，按设备型号解析色彩预设写入 sample，持久化，并广播事件
export async function confirmRegistration(sampleId: string): Promise<Sample | undefined> {
  const sample = await repositories.sample.get(sampleId);
  if (!sample) return undefined;
  // 解析并挂载色彩矫正参数（与编辑器使用同一查找能力，互不 import）
  const lookup = getColorProfileLookup();
  sample.colorProfile = lookup ? lookup(sample.deviceInfo.model) : null;
  sample.status = 'registered';
  sample.updatedAt = Date.now();
  await repositories.sample.update(sample);
  bus.emit('sample:created', { sampleId });
  bus.emit('sample:changed');
  return sample;
}
