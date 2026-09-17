import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Sample, QualityDimension } from '../../infrastructure/types';
import { DIMENSION_LABEL } from '../../infrastructure/types';
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
const DIMS: QualityDimension[] = ['shape', 'soup', 'leaf'];

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

  const handleReupload = async (sample: Sample, dim: QualityDimension, blob: Blob) => {
    await reuploadAsset(sample, dim, blob);
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
        暂无已登记样品。请先在「登记」完成标签与三图采集并确认登记。
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
                <th style={th}>三图</th>
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
                        {DIMS.map((d) => (
                          <SampleThumb key={d} asset={s.images[d]} size={48} />
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
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {DIMS.map((d) => (
                          <div key={d}>
                            {DIMENSION_LABEL[d]}：{fileNameFor(s, d, fc || sampleFreeCode(s))}
                            {s.images[d]?.editedFile ? '' : '（未编辑）'}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td style={td}>{s.deviceInfo.model ?? '—'}</td>
                    <td style={td}>{formatTimestamp(s.createdAt)}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <button onClick={() => navigate(`/label/${s.id}`)} style={btn(false)}>
                          编辑标签
                        </button>
                        {DIMS.map((d) =>
                          s.images[d] ? (
                            <button
                              key={d}
                              onClick={() => navigate(`/edit/${s.images[d]!.id}`)}
                              style={btn(false)}
                            >
                              重编辑{DIMENSION_LABEL[d]}
                            </button>
                          ) : null
                        )}
                        <label style={btn(false)}>
                          重传
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleReupload(s, 'shape', f);
                              e.target.value = '';
                            }}
                          />
                        </label>
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
                <div style={{ display: 'flex', gap: 10 }}>
                  {DIMS.map((d) => (
                    <div key={d} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <SampleThumb asset={s.images[d]} size={72} />
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{DIMENSION_LABEL[d]}</span>
                      {s.images[d] && (
                        <button onClick={() => navigate(`/edit/${s.images[d]!.id}`)} style={btn(false)}>
                          重编辑
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>自由编号</span>
                  <input
                    value={fc}
                    onChange={(e) => setDrafts((p) => ({ ...p, [s.id]: e.target.value }))}
                    onBlur={() => commitFreeCode(s)}
                    style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                  />
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {fileNameFor(s, 'shape', fc || sampleFreeCode(s))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => navigate(`/label/${s.id}`)} style={btn(false)}>
                    编辑标签
                  </button>
                  <label style={btn(false)}>
                    重传
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleReupload(s, 'shape', f);
                        e.target.value = '';
                      }}
                    />
                  </label>
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
