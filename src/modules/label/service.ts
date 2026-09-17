import type { Sample, DeviceInfo } from '../../infrastructure/types';
import { uid } from '../../infrastructure/utils';
import { repositories } from '../../infrastructure/repository';

// 标签模块服务层：创建草稿 / 持久化标签 / 读取草稿
// 全部经由 infrastructure repository，不触碰其它业务模块

export interface LabelInput {
  category: string;
  name: string;
  year: number;
  grade: string;
  deviceInfo: DeviceInfo;
}

// 创建一个空草稿 Sample（status=incomplete），保证刷新不丢、quality 可引用
export async function createDraft(deviceInfo: DeviceInfo): Promise<Sample> {
  const now = Date.now();
  const draft: Sample = {
    id: uid('s'),
    category: '',
    name: '',
    year: now ? new Date().getFullYear() : new Date().getFullYear(),
    grade: '',
    deviceInfo,
    colorProfile: null,
    images: { shape: null, soup: null, leaf: null },
    status: 'incomplete',
    createdAt: now,
    updatedAt: now
  };
  await repositories.sample.create(draft);
  return draft;
}

// 校验标签是否完整（用于提交前的硬性校验）
export function isLabelComplete(input: LabelInput): boolean {
  return Boolean(input.category.trim() && input.name.trim() && input.year && input.grade.trim());
}

// 保存标签：写入 Sample 并标记 status=pending（进入质量维度阶段）
export async function saveLabel(sampleId: string, input: LabelInput): Promise<Sample> {
  const existing = await repositories.sample.get(sampleId);
  const now = Date.now();
  const merged: Sample = {
    id: sampleId,
    category: input.category.trim(),
    name: input.name.trim(),
    year: Number(input.year),
    grade: input.grade.trim(),
    deviceInfo: input.deviceInfo,
    colorProfile: existing?.colorProfile ?? null,
    images: existing?.images ?? { shape: null, soup: null, leaf: null },
    status: 'pending',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  await repositories.sample.update(merged);
  return merged;
}

// 读取已存在草稿（编辑模式回填）
export async function getDraftLabel(sampleId: string): Promise<Sample | undefined> {
  return repositories.sample.get(sampleId);
}
