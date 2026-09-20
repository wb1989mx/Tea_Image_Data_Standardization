import type { Sample, ImageAsset, SlotKey } from '../../infrastructure/types';
import { SLOT_DEF, REQUIRED_SLOTS } from '../../infrastructure/types';
import { uid } from '../../infrastructure/utils';
import { repositories } from '../../infrastructure/repository';
import { bus } from '../../infrastructure/event-bus';
import { getExifExtractor, getColorProfileLookup } from '../../infrastructure/capabilities';

// 质量维度服务层：创建/挂载图像资产、校验登记就绪、确认登记生成 Sample
// 仅依赖 infrastructure（repository / event-bus / capabilities），不触碰其它业务模块

// 将原始图写入资产并挂到样品对应槽位；并尝试用 EXIF 提取能力补全设备型号
// 注意入参是 **slot（槽位）** 而非 dimension：茶汤第 1 冲与第 2 冲共享 dimension='soup'，
// 若以 dimension 为键，两张茶汤会互相覆盖（静默丢失）。dimension 由槽位定义表反查。
export async function ensureAsset(
  sampleId: string,
  slot: SlotKey,
  original: Blob
): Promise<ImageAsset> {
  const now = Date.now();
  const asset: ImageAsset = {
    id: uid('a'),
    sampleId,
    dimension: SLOT_DEF[slot].dimension,
    slot,
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
    sample.images[slot] = asset;
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

// 登记就绪判定：标签完整 + **全部必填槽位**均完成编辑确认（editedFile 存在）
// 判定依据来自 SLOTS 定义表的 required 字段，而非硬编码三图 ——
// 茶汤第 2 冲为选填（required=false），未采集不阻塞「确认登记」。
export function isRegistrationReady(sample: Sample): boolean {
  return Boolean(
    sample.category &&
      sample.name &&
      sample.year &&
      sample.grade &&
      REQUIRED_SLOTS.every((s) => sample.images[s.key]?.editedFile)
  );
}

// 列出尚未完成编辑确认的必填槽位展示名（用于就地提示"还差哪几张"）
export function missingRequiredSlots(sample: Sample): string[] {
  return REQUIRED_SLOTS.filter((s) => !sample.images[s.key]?.editedFile).map((s) => s.label);
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
