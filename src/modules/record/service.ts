import type { Sample, SlotKey } from '../../infrastructure/types';
import { SLOT_KEYS, SLOT_LABEL } from '../../infrastructure/types';
import { repositories } from '../../infrastructure/repository';
import { bus } from '../../infrastructure/event-bus';

// 记录服务层：重命名规则、自由编号自动递增、冲突检测、批量重命名、删除、重传
// 仅依赖 infrastructure（repository / event-bus / types 定义表）
// 注意：循环一律走 SLOT_KEYS（槽位），不再用三图维度数组 —— 茶汤有 2 个槽位。

// 样品级自由编号（各槽位共享，取首个非空）
export function sampleFreeCode(s: Sample): string {
  for (const k of SLOT_KEYS) {
    const fc = s.images[k]?.freeCode;
    if (fc) return fc;
  }
  return '';
}

// 标准文件名规则：名称 + 年份 + 等级 + 槽位名 + 自由编号
// 例：清香铁观音_2026_三级_茶汤第1冲_001
export function fileNameFor(s: Sample, slot: SlotKey, freeCode: string): string {
  return `${s.name}_${s.year}_${s.grade}_${SLOT_LABEL[slot]}_${freeCode}`;
}

function comboKey(s: Sample): string {
  return `${s.name}|${s.year}|${s.grade}`;
}

// 同一标签组合下，自动递增下一个自由编号（3 位补零）
export function nextFreeCode(samples: Sample[], target: Sample): string {
  let max = 0;
  for (const s of samples) {
    if (s.id === target.id) continue;
    if (comboKey(s) !== comboKey(target)) continue;
    const n = parseInt(sampleFreeCode(s), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return String(max + 1).padStart(3, '0');
}

// 冲突检测：同一组合下是否存在其它样品占用相同自由编号
export function hasConflict(samples: Sample[], target: Sample, freeCode: string): boolean {
  if (!freeCode) return false;
  return samples.some(
    (s) => s.id !== target.id && comboKey(s) === comboKey(target) && sampleFreeCode(s) === freeCode
  );
}

// 应用自由编号：写入样品全部槽位资产并生成标准文件名，持久化
export async function applyFreeCode(sample: Sample, freeCode: string): Promise<Sample> {
  const now = Date.now();
  for (const slot of SLOT_KEYS) {
    const a = sample.images[slot];
    if (a) {
      a.freeCode = freeCode;
      a.fileName = fileNameFor(sample, slot, freeCode);
      a.updatedAt = now;
      await repositories.asset.put(a);
    }
  }
  sample.updatedAt = now;
  await repositories.sample.update(sample);
  bus.emit('sample:changed');
  return sample;
}

export async function deleteSample(id: string): Promise<void> {
  await repositories.sample.remove(id);
  bus.emit('sample:changed');
}

// 批量：为所选样品按各自组合自动递增编号（本地跟踪已分配编号，避免碰撞）
export async function bulkAutoRename(samples: Sample[], selectedIds: string[]): Promise<void> {
  const sel = samples.filter((s) => selectedIds.includes(s.id));
  const usedByCombo: Record<string, number> = {};
  for (const s of sel) {
    const key = comboKey(s);
    let existingMax = usedByCombo[key] ?? 0;
    for (const o of samples) {
      if (o.id === s.id || comboKey(o) !== key) continue;
      const n = parseInt(sampleFreeCode(o), 10);
      if (!isNaN(n) && n > existingMax) existingMax = n;
    }
    const fc = String(existingMax + 1).padStart(3, '0');
    usedByCombo[key] = existingMax + 1;
    await applyFreeCode(s, fc);
  }
}

// 替换某槽位原图（重传）：保留资产记录，清空编辑结果，需重新编辑。
// 入参为 slot：茶汤第 1 冲（soup）与第 2 冲（soup2）互不影响。
export async function reuploadAsset(sample: Sample, slot: SlotKey, blob: Blob): Promise<Sample> {
  const a = sample.images[slot];
  if (!a) return sample; // 该槽位尚未采集：请到采集页新增，避免在此处隐式创建资产
  a.originalFile = blob;
  a.editedFile = null;
  a.cropMeta = null;
  a.updatedAt = Date.now();
  await repositories.asset.put(a);
  sample.updatedAt = Date.now();
  await repositories.sample.update(sample);
  bus.emit('sample:changed');
  return sample;
}

// 遍历样品全部槽位的资产（记录页缩略图/文件名预览用）
export function slotAssets(s: Sample): { slot: SlotKey; asset: Sample['images'][SlotKey] }[] {
  return SLOT_KEYS.map((slot) => ({ slot, asset: s.images[slot] }));
}
