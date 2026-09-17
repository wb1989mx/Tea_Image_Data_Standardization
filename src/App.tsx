import { useRootStore } from './infrastructure/store';
import { AppRouter } from './infrastructure/router';

// 主题仅通过 CSS 变量驱动，套在根容器上由 modules/theme 切换
export default function App() {
  const themeId = useRootStore((s) => s.themeId);
  return (
    <div className={`theme-${themeId}`}>
      <AppRouter />
    </div>
  );
}
