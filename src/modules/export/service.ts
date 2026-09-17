import JSZip from 'jszip';
import type { Sample, QualityDimension } from '../../infrastructure/types';
import { DIMENSION_LABEL } from '../../infrastructure/types';
import { downloadBlob } from '../../infrastructure/utils';

// 导出服务层：将若干样品打包为 ZIP（纯前端，无网络依赖）
// 仅依赖 infrastructure（utils）；图片名取各资产已生成的 fileName，命名规则由 record 模块负责

const DIMS: QualityDimension[] = ['shape', 'soup', 'leaf'];

function extOf(sample: Sample, dim: QualityDimension): string {
  const fmt = sample.images[dim]?.cropMeta?.outputFormat;
  return fmt === 'webp' ? 'webp' : 'png';
}

function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// 打包：三图（images/ 目录）+ metadata.csv + metadata.json + manifest.txt
export async function packZip(samples: Sample[]): Promise<Blob> {
  const zip = new JSZip();
  const imageFolder = zip.folder('images')!;
  const rows: Record<string, string>[] = [];
  const meta: unknown[] = [];

  for (const s of samples) {
    const freeCode =
      s.images.shape?.freeCode || s.images.soup?.freeCode || s.images.leaf?.freeCode || '';

    for (const dim of DIMS) {
      const a = s.images[dim];
      if (a?.editedFile && a.fileName) {
        imageFolder.file(`${a.fileName}.${extOf(s, dim)}`, a.editedFile);
      }
    }

    rows.push({
      样品名称: s.name,
      茶叶类别: s.category,
      年份: String(s.year),
      等级: s.grade,
      自由编号: freeCode,
      外形文件: s.images.shape?.fileName ?? '',
      茶汤文件: s.images.soup?.fileName ?? '',
      叶底文件: s.images.leaf?.fileName ?? '',
      设备型号: s.deviceInfo.model ?? '',
      色彩矫正: s.colorProfile?.presetName ?? '',
      登记时间: new Date(s.createdAt).toLocaleString()
    });

    meta.push({
      id: s.id,
      name: s.name,
      category: s.category,
      year: s.year,
      grade: s.grade,
      freeCode,
      deviceInfo: s.deviceInfo,
      colorProfile: s.colorProfile,
      files: {
        shape: s.images.shape?.fileName ?? '',
        soup: s.images.soup?.fileName ?? '',
        leaf: s.images.leaf?.fileName ?? ''
      },
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    });
  }

  const headers = Object.keys(rows[0] ?? {});
  const csv = [headers.join(',')]
    .concat(rows.map((r) => headers.map((h) => csvCell(r[h])).join(',')))
    .join('\n');
  // 加 BOM 以便 Excel 正确识别 UTF-8
  zip.file('metadata.csv', '﻿' + csv);
  zip.file('metadata.json', JSON.stringify(meta, null, 2));

  const manifest =
    `茶叶图像数据标准化平台 · 导出包\n` +
    `样品数量：${samples.length}\n` +
    `生成时间：${new Date().toLocaleString()}\n` +
    `目录结构：images/ 标准图、metadata.csv、metadata.json、manifest.txt\n\n` +
    samples
      .map(
        (s, i) =>
          `${i + 1}. ${s.name}_${s.year}_${s.grade}（编号 ${s.images.shape?.freeCode || ''}）`
      )
      .join('\n');
  zip.file('manifest.txt', manifest);

  return zip.generateAsync({ type: 'blob' });
}

// 打包并触发下载（record 模块经 capabilities 调用）
export async function downloadSamples(samples: Sample[], filename = 'tea-images.zip'): Promise<void> {
  const blob = await packZip(samples);
  downloadBlob(blob, filename);
}
