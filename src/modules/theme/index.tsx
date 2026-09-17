import { useRootStore } from '../../infrastructure/store';
import { bus } from '../../infrastructure/event-bus';

// 主题模块：5 套 token（CSS 变量驱动），切换仅改视觉不改业务逻辑
// 主题定义与 token 见 src/index.css（.theme-*）；此处提供切换 UI 与 hook

export const THEMES = [
  { id: 'ios', name: '极简 iOS 风', swatch: '#0b7a5b' },
  { id: 'guofeng', name: '茶韵国风', swatch: '#0b7a5b' },
  { id: 'material', name: 'Material You 风', swatch: '#1f6feb' },
  { id: 'dark', name: '暗黑科技风', swatch: '#2dd4a7' },
  { id: 'neumorphism', name: '新拟态柔和风', swatch: '#5b8def' }
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

// 主题切换 hook：写入根 Store 并广播，App 据此套用 .theme-* class
export function useTheme() {
  const themeId = useRootStore((s) => s.themeId);
  const setThemeId = useRootStore((s) => s.setThemeId);
  const setTheme = (id: string) => {
    setThemeId(id);
    bus.emit('theme:changed', id);
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
