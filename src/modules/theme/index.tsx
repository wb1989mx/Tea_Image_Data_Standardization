import { useEffect } from 'react';
import { useRootStore } from '../../infrastructure/store';
import { bus } from '../../infrastructure/event-bus';

// 主题模块：3 套 token（CSS 变量驱动），切换仅改视觉不改业务逻辑
// 主题定义与 token 见 src/index.css（.theme-*）；此处提供切换 UI 与 hook
// 注：原「暗黑科技风（dark）」「新拟态柔和风（neumorphism）」已下线，原因见 resolveThemeId 注释

export const THEMES = [
  { id: 'ios', name: '极简 iOS 风', swatch: '#0b7a5b' },
  { id: 'guofeng', name: '茶韵国风', swatch: '#0b7a5b' },
  { id: 'material', name: 'Material You 风', swatch: '#1f6feb' }
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export const DEFAULT_THEME_ID: ThemeId = 'ios';

const VALID_THEME_IDS = THEMES.map((t) => t.id) as readonly string[];

// 主题白名单校验：主题列表缩减后，本地可能仍存有已下线主题（如 dark / neumorphism）。
// 若不校验，根容器会套用不存在的 .theme-* 类名，导致全部 CSS 变量未定义、界面样式崩坏。
// 因此所有「从存储读出的主题值」都必须先经过此函数。
export function resolveThemeId(raw: string | null | undefined): ThemeId {
  return raw && VALID_THEME_IDS.includes(raw) ? (raw as ThemeId) : DEFAULT_THEME_ID;
}

// 主题切换 hook：写入根 Store（已持久化）并广播，App 据此套用 .theme-* class
export function useTheme() {
  const rawThemeId = useRootStore((s) => s.themeId);
  const setThemeId = useRootStore((s) => s.setThemeId);
  const themeId = resolveThemeId(rawThemeId);

  // 存量非法值（已下线主题）静默纠正回默认，避免高亮与渲染不一致
  useEffect(() => {
    if (rawThemeId !== themeId) setThemeId(themeId);
  }, [rawThemeId, themeId, setThemeId]);

  const setTheme = (id: string) => {
    const safe = resolveThemeId(id);
    setThemeId(safe);
    bus.emit('theme:changed', safe);
  };
  return { themeId, setTheme, themes: THEMES };
}

// 主题设置面板（设置页使用）
export function ThemePage() {
  const { themeId, setTheme, themes } = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>选择视觉风格（仅影响外观，不改变业务逻辑）</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
        {themes.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px',
              borderRadius: 'var(--radius)',
              border: themeId === t.id ? '2px solid var(--primary)' : '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              cursor: 'pointer'
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: t.swatch,
                flexShrink: 0
              }}
            />
            <span style={{ fontSize: 13 }}>{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
