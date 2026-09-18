import { useRootStore } from './infrastructure/store';
import { AppRouter } from './infrastructure/router';
import { resolveThemeId } from './modules/theme';

// 主题仅通过 CSS 变量驱动，套在根容器上由 modules/theme 切换
// resolveThemeId 做白名单兜底：本地若残留已下线主题，回退默认，避免套用不存在的类名
export default function App() {
  const rawThemeId = useRootStore((s) => s.themeId);
  const themeId = resolveThemeId(rawThemeId);
  return (
    <div className={`theme-${themeId}`}>
      <AppRouter />
    </div>
  );
}
