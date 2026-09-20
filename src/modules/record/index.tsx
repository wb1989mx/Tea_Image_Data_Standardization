import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Sample, SlotKey } from '../../infrastructure/types';
import { SLOT_KEYS, SLOT_LABEL } from '../../infrastructure/types';
import { repositories } from '../../infrastructure/repository';
import { bus } from '../../infrastructure/event-bus';
import { useMediaQuery, formatTimestamp, downloadBlob } from '../../infrastructure/utils';
import { getExporter } from '../../infrastructure/capabilities';
import {
  sampleFreeCode,
  fileNameFor,
  hasConflict,
  applyFreeCode,
  deleteSample,
  bulkAutoRename,
  reuploadAsset
} from './service';
import { SampleThumb } from './components/SampleThumb';

// 数据记录与导出页（路由 /record）
// 槽位（外形 / 茶汤第1冲 / 茶汤第2冲 / 叶底）由 infrastructure/types 的定义表驱动，
// 本页不含槽位硬编码；每个槽位可独立重编辑 / 重传。

export function RecordPage() {
  const navigate = useNavigate();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const exporter = getExporter();

  const [samples, setSamples] = useState<Sample[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // 打包反馈：packing 防重复点击，notice 给出成功/失败结论（失败也能看到原因）
  const [packing, setPacking] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    const list = await repositories.sample.list();
    setSamples(list);
    setDrafts((prev) => {
      const next = { ...prev };
      for (const s of list) {
        if (!(s.id in next)) next[s.id] = sampleFreeCode(s);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    refresh();
    const onChanged = () => refresh();
    bus.on('sample:changed', onChanged);
    return () => bus.off('sample:changed', onChanged);
  }, [refresh]);

  const toggleSelect = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const commitFreeCode = async (sample: Sample) => {
    const val = (drafts[sample.id] ?? '').trim();
    if (!val) return;
    if (hasConflict(samples, sample, val)) {
      alert(`编号 ${val} 与同标签组合下其它样品冲突，请更换`);
      return;
    }
    await applyFreeCode(sample, val);
    await refresh();
  };

  // 重传按槽位独立：茶汤第1冲与第2冲互不影响
  const handleReupload = async (sample: Sample, slot: SlotKey, blob: Blob) => {
    await reuploadAsset(sample, slot, blob);
    await refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除该样品及其全部图像？')) return;
    await deleteSample(id);
    setSelected((s) => s.filter((x) => x !== id));
    await refresh();
  };

  const handleBulkRename = async () => {
    const ids = selected.length ? selected : samples.map((s) => s.id);
    await bulkAutoRename(samples, ids);
    await refresh();
  };

  // 一键打包：能力返回的是 ZIP Blob（纯生成），必须在此触发下载交付，
  // 否则只是白白生成一份内存中的 Blob，界面不会有任何反应。
  const handlePack = async () => {
    if (packing) return;
    if (!exporter) {
      setNotice({ type: 'err', text: '导出模块未就绪，请刷新页面后重试' });
      return;
    }
    const target = selected.length ? samples.filter((s) => selected.includes(s.id)) : samples;
    if (!target.length) {
      setNotice({ type: 'err', text: '暂无可导出的样品' });
      return;
    }
    setNotice(null);
    setPacking(true);
    try {
      const blob = await exporter(target);
      if (!blob || blob.size === 0) throw new Error('生成的打包文件为空');
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
      const filename = `tea-images-${stamp}.zip`;
      downloadBlob(blob, filename);
      setNotice({
        type: 'ok',
        text: `已导出 ${target.length} 个样品 · ${filename}（${(blob.size / 1024 / 1024).toFixed(2)} MB），请查看浏览器下载栏`
      });
    } catch (e) {
      setNotice({ type: 'err', text: `打包失败：${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setPacking(false);
    }
  };

  if (!samples.length) {
    return (
      <div className="surface" style={{ padding: 16, color: 'var(--muted)' }}>
        暂无已登记样品。请先在「登记」完成标签与图像采集并确认登记。
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        className="surface"
        style={{ padding: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
      >
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>
          共 {samples.length} 条 · 已选 {selected.length}
        </span>
        <button onClick={() => setSelected(samples.map((s) => s.id))} style={btn(false)}>
          全选
        </button>
        <button onClick={() => setSelected([])} style={btn(false)}>
          清空选择
        </button>
        <button onClick={handleBulkRename} style={btn(false)}>
          批量自动编号
        </button>
        <button
          onClick={handlePack}
          disabled={packing}
          style={{ ...btn(true), opacity: packing ? 0.7 : 1, cursor: packing ? 'wait' : 'pointer' }}
        >
          {packing ? '打包中…' : '一键打包 ZIP'}
        </button>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          未勾选时导出全部样品
        </span>
      </div>

      {notice && (
        <div
          className="surface"
          style={{
            padding: '10px 14px',
            fontSize: 13,
            color: notice.type === 'ok' ? 'var(--primary)' : '#c0392b',
            borderColor: notice.type === 'ok' ? 'var(--primary)' : '#c0392b'
          }}
        >
          {notice.text}
        </div>
      )}

      {isDesktop ? (
        <div className="surface" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: 'var(--muted)', textAlign: 'left' }}>
                <th style={th}>选</th>
                <th style={th}>图像</th>
                <th style={th}>标签</th>
                <th style={th}>自由编号</th>
                <th style={th}>标准文件名（示例）</th>
                <th style={th}>设备</th>
                <th style={th}>登记时间</th>
                <th style={th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((s) => {
                const fc = drafts[s.id] ?? '';
                return (
                  <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={td}>
                      <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggleSelect(s.id)} />
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {SLOT_KEYS.map((k) => (
                          <SampleThumb key={k} asset={s.images[k]} size={48} />
                        ))}
                      </div>
                    </td>
                    <td style={td}>
                      <div>{s.name}</div>
                      <div style={{ color: 'var(--muted)' }}>
                        {s.category} / {s.year} / {s.grade}
                      </div>
                    </td>
                    <td style={td}>
                      <input
                        value={fc}
                        onChange={(e) => setDrafts((p) => ({ ...p, [s.id]: e.target.value }))}
                        onBlur={() => commitFreeCode(s)}
                        onKeyDown={(e) => e.key === 'Enter' && commitFreeCode(s)}
                        style={{ width: 70, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                      />
                    </td>
                    <td style={td}>
                      <FilenamePreview sample={s} freeCode={fc || sampleFreeCode(s)} />
                    </td>
                    <td style={td}>{s.deviceInfo.model ?? '—'}</td>
                    <td style={td}>{formatTimestamp(s.createdAt)}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <button onClick={() => navigate(`/label/${s.id}`)} style={btn(false)}>
                          编辑标签
                        </button>
                        <SlotActionList
                          sample={s}
                          onEdit={(slot) => {
                            const a = s.images[slot];
                            if (a) navigate(`/edit/${a.id}`);
                          }}
                          onReupload={(slot, blob) => handleReupload(s, slot, blob)}
                        />
                        <button onClick={() => handleDelete(s.id)} style={btn(false)}>
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {samples.map((s) => {
            const fc = drafts[s.id] ?? '';
            return (
              <div key={s.id} className="surface" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggleSelect(s.id)} />
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                    {s.category} / {s.year} / {s.grade}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {SLOT_KEYS.map((k) => (
                    <div key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 68 }}>
                      <SampleThumb asset={s.images[k]} size={64} />
                      <span style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.2 }}>
                        {SLOT_LABEL[k]}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>自由编号</span>
                  <input
                    value={fc}
                    onChange={(e) => setDrafts((p) => ({ ...p, [s.id]: e.target.value }))}
                    onBlur={() => commitFreeCode(s)}
                    style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                  />
                </div>

                <FilenamePreview sample={s} freeCode={fc || sampleFreeCode(s)} />

                <SlotActionList
                  sample={s}
                  onEdit={(slot) => {
                    const a = s.images[slot];
                    if (a) navigate(`/edit/${a.id}`);
                  }}
                  onReupload={(slot, blob) => handleReupload(s, slot, blob)}
                />

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => navigate(`/label/${s.id}`)} style={btn(false)}>
                    编辑标签
                  </button>
                  <button onClick={() => handleDelete(s.id)} style={btn(false)}>
                    删除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// 标准文件名预览：逐一列出槽位（未采集 / 未编辑也会显式标注，避免误以为已就绪）
function FilenamePreview({ sample, freeCode }: { sample: Sample; freeCode: string }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
      {SLOT_KEYS.map((k) => {
        const a = sample.images[k];
        return (
          <div key={k} style={{ whiteSpace: 'nowrap' }}>
            {SLOT_LABEL[k]}：{a ? fileNameFor(sample, k, freeCode) : '—'}
            {a && !a.editedFile ? '（未编辑）' : ''}
            {!a ? '（未采集）' : ''}
          </div>
        );
      })}
    </div>
  );
}

// 按槽位独立的操作列表：每个已采集槽位一行「槽位名 + 重编辑 + 重传」
// 修复既有缺陷：原先重传按钮硬编码 'shape'，只能重传外形。
function SlotActionList({
  sample,
  onEdit,
  onReupload
}: {
  sample: Sample;
  onEdit: (slot: SlotKey) => void;
  onReupload: (slot: SlotKey, blob: Blob) => void;
}) {
  const rows = SLOT_KEYS.filter((k) => sample.images[k]);
  if (!rows.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {rows.map((k) => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              fontSize: 11,
              color: 'var(--muted)',
              width: 64,
              flexShrink: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            title={SLOT_LABEL[k]}
          >
            {SLOT_LABEL[k]}
          </span>
          <button onClick={() => onEdit(k)} style={btn(false)}>
            重编辑
          </button>
          <label style={btn(false)}>
            重传
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onReupload(k, f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      ))}
    </div>
  );
}

function btn(primary: boolean): React.CSSProperties {
  return {
    padding: '8px 12px',
    borderRadius: 'var(--radius)',
    border: primary ? 'none' : '1px solid var(--border)',
    background: primary ? 'var(--primary)' : 'var(--surface)',
    color: primary ? '#fff' : 'var(--text)',
    cursor: 'pointer',
    fontSize: 13,
    textAlign: 'center'
  };
}

const th: React.CSSProperties = { padding: '10px 8px', fontWeight: 600 };
const td: React.CSSProperties = { padding: '10px 8px', verticalAlign: 'top' };
