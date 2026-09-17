import { create } from 'zustand';
import type { Sample, SampleStatus } from '../../infrastructure/types';
import { repositories } from '../../infrastructure/repository';
import { writeFormDraft, type LabelFormFields } from './draft';

// 标签表单本地状态 + 自定义选项（类别/等级）
// 仅依赖 infrastructure（repository 注册表），不依赖其它业务模块
interface LabelState {
  sampleId: string | null;
  category: string;
  name: string;
  year: number;
  grade: string;
  status: SampleStatus;
  categories: string[];
  grades: string[];

  loadOptions: () => Promise<void>;
  loadFromSample: (s: Sample) => void;
  // 用本地草稿覆盖表单字段（刷新/重进后恢复未提交内容）
  applyFormFields: (f: LabelFormFields) => void;
  setField: (k: 'category' | 'name' | 'year' | 'grade', v: string | number) => void;
  setStatus: (s: SampleStatus) => void;
  setSampleId: (id: string) => void;
  reset: () => void;
  addCategory: (v: string) => Promise<void>;
  addGrade: (v: string) => Promise<void>;
}

export const useLabelStore = create<LabelState>((set, get) => ({
  sampleId: null,
  category: '',
  name: '',
  year: new Date().getFullYear(),
  grade: '',
  status: 'incomplete',
  categories: [],
  grades: [],

  loadOptions: async () => {
    const [categories, grades] = await Promise.all([
      repositories.option.getCategories(),
      repositories.option.getGrades()
    ]);
    set({ categories, grades });
  },
  loadFromSample: (s) =>
    set({
      sampleId: s.id,
      category: s.category,
      name: s.name,
      year: s.year,
      grade: s.grade,
      status: s.status
    }),
  applyFormFields: (f) =>
    set({ category: f.category, name: f.name, year: f.year, grade: f.grade }),
  // 每次字段变更同步写入本地草稿缓冲：误刷新/误关页面后可原样恢复。
  // 注意：只写临时缓冲，不改动 Dexie 中的领域数据（提交时才落库）。
  setField: (k, v) => {
    set({ [k]: v } as Pick<LabelState, typeof k>);
    const s = get();
    if (s.sampleId) {
      writeFormDraft(s.sampleId, {
        category: s.category,
        name: s.name,
        year: s.year,
        grade: s.grade
      });
    }
  },
  setStatus: (status) => set({ status }),
  setSampleId: (sampleId) => set({ sampleId }),
  reset: () =>
    set({
      sampleId: null,
      category: '',
      name: '',
      year: new Date().getFullYear(),
      grade: '',
      status: 'incomplete'
    }),
  addCategory: async (v) => {
    await repositories.option.addCategory(v);
    await get().loadOptions();
  },
  addGrade: async (v) => {
    await repositories.option.addGrade(v);
    await get().loadOptions();
  }
}));
