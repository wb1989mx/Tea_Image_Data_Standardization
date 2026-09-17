import type { Sample, QualityDimension } from '../../infrastructure/types';
import { DIMENSION_LABEL } from '../../infrastructure/types';
import { repositories } from '../../infrastructure/repository';
import { bus } from '../../infrastructure/event-bus';

// 记录服务层：重命名规则、自由编号自动递增、冲突检测、批量重命名、删除
// 仅依赖 infrastructure（repository / event-bus）

const DIMS: QualityDimension[] = ['shape', 'soup', 'leaf'];

// 样品级自由编号（三图共享，取首个非空）
export function sampleFreeCode(s: Sample): string {
  return s.images.shape?.freeCode || s.images.soup?.freeCode || s.images.leaf?.freeCode || '';
}

// 标准文件名规则：名称 + 年份 + 等级 + 质量维度 + 自由编号
export function fileNameFor(s: Sample, dim: QualityDimension, freeCode: string): string {
  return `${s.name}_${s.year}_${s.grade}_${DIMENSION_LABEL[dim]}_${freeCode}`;
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

// 应用自由编号：写入样品三图资产并生成标准文件名，持久化
export async function applyFreeCode(sample: Sample, freeCode: string): Promise<Sample> {
  const now = Date.now();
  for (const dim of DIMS) {
    const a = sample.images[dim];
    if (a) {
      a.freeCode = freeCode;
      a.fileName = fileNameFor(sample, dim, freeCode);
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

// 替换某维度原图（重传）：保留资产，清空编辑结果，需重新编辑
export async function reuploadAsset(sample: Sample, dim: QualityDimension, blob: Blob): Promise<Sample> {
  const a = sample.images[dim];
  if (!a) return sample;
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
