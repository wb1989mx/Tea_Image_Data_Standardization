import JSZip from 'jszip';
import type { Sample, SlotKey } from '../../infrastructure/types';
import { SLOT_KEYS, SLOT_LABEL } from '../../infrastructure/types';
import { downloadBlob } from '../../infrastructure/utils';

// 导出服务层：将若干样品打包为 ZIP（纯前端，无网络依赖）
// 仅依赖 infrastructure（types 定义表 / utils）；图片名取各资产已生成的 fileName，
// 命名规则由 record 模块负责。槽位（含茶汤第1冲/第2冲）全部由定义表驱动。

function extOf(sample: Sample, slot: SlotKey): string {
  const fmt = sample.images[slot]?.cropMeta?.outputFormat;
  return fmt === 'webp' ? 'webp' : 'png';
}

// 样品级自由编号（各槽位共享，取首个非空）
function freeCodeOf(s: Sample): string {
  for (const k of SLOT_KEYS) {
    const fc = s.images[k]?.freeCode;
    if (fc) return fc;
  }
  return '';
}

function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// 打包：全部槽位图像（images/ 目录）+ metadata.csv + metadata.json + manifest.txt
export async function packZip(samples: Sample[]): Promise<Blob> {
  const zip = new JSZip();
  const imageFolder = zip.folder('images')!;
  const rows: Record<string, string>[] = [];
  const meta: unknown[] = [];

  for (const s of samples) {
    const freeCode = freeCodeOf(s);

    for (const slot of SLOT_KEYS) {
      const a = s.images[slot];
      if (a?.editedFile && a.fileName) {
        imageFolder.file(`${a.fileName}.${extOf(s, slot)}`, a.editedFile);
      }
    }

    // 按定义表生成槽位列，列名如「茶汤第1冲文件」「茶汤第2冲文件」；
    // 未采集的选填槽位保留空值，列结构保持一致，便于下游脚本按列名读取。
    const row: Record<string, string> = {
      样品名称: s.name,
      茶叶类别: s.category,
      年份: String(s.year),
      等级: s.grade,
      自由编号: freeCode
    };
    for (const slot of SLOT_KEYS) {
      row[`${SLOT_LABEL[slot]}文件`] = s.images[slot]?.fileName ?? '';
    }
    row.设备型号 = s.deviceInfo.model ?? '';
    row.色彩矫正 = s.colorProfile?.presetName ?? '';
    row.登记时间 = new Date(s.createdAt).toLocaleString();
    rows.push(row);

    meta.push({
      id: s.id,
      name: s.name,
      category: s.category,
      year: s.year,
      grade: s.grade,
      freeCode,
      deviceInfo: s.deviceInfo,
      colorProfile: s.colorProfile,
      // 键为槽位键：shape / soup / soup2 / leaf
      files: Object.fromEntries(SLOT_KEYS.map((k) => [k, s.images[k]?.fileName ?? ''])),
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
    `采集槽位：${SLOT_KEYS.map((k) => SLOT_LABEL[k]).join(' / ')}\n` +
    `目录结构：images/ 标准图、metadata.csv、metadata.json、manifest.txt\n\n` +
    samples
      .map((s, i) => `${i + 1}. ${s.name}_${s.year}_${s.grade}（编号 ${freeCodeOf(s)}）`)
      .join('\n');
  zip.file('manifest.txt', manifest);

  return zip.generateAsync({ type: 'blob' });
}

// 打包并触发下载（record 模块经 capabilities 调用）
export async function downloadSamples(samples: Sample[], filename = 'tea-images.zip'): Promise<void> {
  const blob = await packZip(samples);
  downloadBlob(blob, filename);
}
