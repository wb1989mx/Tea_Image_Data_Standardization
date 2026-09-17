// 标签表单「未提交内容」的本地草稿缓冲
//
// 职责边界：只负责"用户已经输入、但尚未点击保存"的表单值，属临时 UI 状态，
// 与 Dexie 中的领域数据（Sample / ImageAsset）职责分离、互不覆盖。
// 解决场景：填报过程中误刷新 / 误关页面 / 切走再回来 → 输入内容不丢。
//
// 全部读写均做异常兜底：隐私模式、存储被禁用、配额满等情况静默降级，
// 不影响正常填报（最坏情况退化为旧行为——刷新后需重填）。

const FORM_KEY = (sampleId: string) => `label-form-draft:${sampleId}`;
const LAST_KEY = 'label-form-draft:last';

export interface LabelFormFields {
  category: string;
  name: string;
  year: number;
  grade: string;
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 静默降级：不影响填报流程
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // 静默降级
  }
}

// 是否含有用户实际输入（仅年份为默认值不算脏，避免空草稿被误认为待恢复内容）
function isDirty(f: LabelFormFields): boolean {
  return Boolean(f.category.trim() || f.name.trim() || f.grade.trim());
}

function normalize(raw: unknown): LabelFormFields {
  const p = (raw ?? {}) as Record<string, unknown>;
  const y = Number(p.year);
  return {
    category: typeof p.category === 'string' ? p.category : '',
    name: typeof p.name === 'string' ? p.name : '',
    year: Number.isFinite(y) && y > 0 ? y : new Date().getFullYear(),
    grade: typeof p.grade === 'string' ? p.grade : ''
  };
}

// 写入草稿（每次输入变更即调用；全空则清除，不占用空间）
export function writeFormDraft(sampleId: string, fields: LabelFormFields): void {
  if (!isDirty(fields)) {
    clearFormDraft(sampleId);
    return;
  }
  safeSet(FORM_KEY(sampleId), JSON.stringify(fields));
  safeSet(LAST_KEY, sampleId);
}

export function readFormDraft(sampleId: string): LabelFormFields | null {
  const raw = safeGet(FORM_KEY(sampleId));
  if (!raw) return null;
  try {
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

// 清除草稿：保存成功后调用（含 last 指针，避免下次误恢复已提交内容）
export function clearFormDraft(sampleId: string): void {
  safeRemove(FORM_KEY(sampleId));
  if (safeGet(LAST_KEY) === sampleId) safeRemove(LAST_KEY);
}

// 读取"上一次未提交的草稿"：用于误关页面后重新打开、且 URL 已丢失 sampleId 的场景
export function readLastFormDraft(): { sampleId: string; fields: LabelFormFields } | null {
  const id = safeGet(LAST_KEY);
  if (!id) return null;
  const fields = readFormDraft(id);
  return fields ? { sampleId: id, fields } : null;
}
