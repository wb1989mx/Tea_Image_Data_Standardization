import { BrowserRouter, Routes, Route, Navigate, Outlet, NavLink } from 'react-router-dom';
import { useMediaQuery } from '../utils';
import { LabelPage } from '../../modules/label';
import { QualityPage } from '../../modules/quality';
import { ImageEditorPage } from '../../modules/image-editor';
import { RecordPage } from '../../modules/record';
import { ThemePage } from '../../modules/theme';
import { DeviceInfoCard } from '../../modules/device';
import { ColorProfileSettings } from '../../modules/color-profile';
import { PwaSettings } from '../../modules/pwa';

// 路由表：桌面/手机共用，仅 Shell 不同
const NAV = [
  { to: '/label', label: '登记', end: false },
  { to: '/record', label: '记录', end: true },
  { to: '/settings', label: '设置', end: true }
];

function NavItems() {
  return (
    <>
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          style={({ isActive }) => ({
            color: isActive ? 'var(--primary)' : 'var(--muted)',
            textDecoration: 'none',
            fontWeight: isActive ? 600 : 400,
            padding: '8px 12px',
            borderRadius: 8
          })}
        >
          {n.label}
        </NavLink>
      ))}
    </>
  );
}

// 桌面端：侧边栏 + 内容区
function DesktopShell() {
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <aside
        className="surface"
        style={{ width: 220, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <div style={{ fontWeight: 600, marginBottom: 12 }}>茶叶图像标准化</div>
        <NavItems />
      </aside>
      <main style={{ flex: 1, padding: 24 }}>
        <Outlet />
      </main>
    </div>
  );
}

// 手机端：底部导航 + 大按钮
function MobileShell() {
  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--bg)' }}>
      <main style={{ flex: 1, padding: 16, paddingBottom: 80 }}>
        <Outlet />
      </main>
      <nav
        className="surface"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-around',
          padding: '12px 0',
          borderTop: '1px solid var(--border)'
        }}
      >
        <NavItems />
      </nav>
    </div>
  );
}

function Shell() {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  return isDesktop ? <DesktopShell /> : <MobileShell />;
}

// 设置页：组合 theme / device / color-profile / pwa 设置面板（外壳组合，不改各模块逻辑）
function SettingsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section className="surface" style={{ padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>主题</div>
        <ThemePage />
      </section>
      <section className="surface" style={{ padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>设备信息</div>
        <DeviceInfoCard />
      </section>
      <section className="surface" style={{ padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>色彩矫正映射表</div>
        <ColorProfileSettings />
      </section>
      <section className="surface" style={{ padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>PWA / 安装</div>
        <PwaSettings />
      </section>
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<Navigate to="/label" replace />} />
          <Route path="/label" element={<LabelPage />} />
          <Route path="/label/:sampleId" element={<LabelPage />} />
          <Route path="/quality/:sampleId" element={<QualityPage />} />
          <Route path="/edit/:assetId" element={<ImageEditorPage />} />
          <Route path="/record" element={<RecordPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
