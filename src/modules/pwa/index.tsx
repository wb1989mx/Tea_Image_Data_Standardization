import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { bus } from '../../infrastructure/event-bus';
import { useRootStore } from '../../infrastructure/store';

// PWA 模块：SW 注册（离线缓存）、安装提示、在线状态（仅依赖基础设施，互不 import）
// 注意：install 提示与离线缓存依赖 HTTPS / localhost 安全上下文

// beforeinstallprompt 最小类型（避免依赖特定 lib 版本）
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// 注册 Service Worker（离线可用）；模块导入即执行一次
export function registerPWA(): void {
  if ('serviceWorker' in navigator) {
    registerSW({ immediate: true });
  }
}
registerPWA();

// 在线状态 hook：同步根 Store 并广播 online:changed
export function useOnlineStatus(): boolean {
  const online = useRootStore((s) => s.online);
  const setOnline = useRootStore((s) => s.setOnline);
  useEffect(() => {
    const on = () => {
      setOnline(true);
      bus.emit('online:changed', true);
    };
    const off = () => {
      setOnline(false);
      bus.emit('online:changed', false);
    };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [setOnline]);
  return online;
}

// 安装提示 hook：捕获 beforeinstallprompt，暴露手动触发
export function useInstallPrompt(): { canInstall: boolean; prompt: () => void } {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  return {
    canInstall: !!deferred,
    prompt: () => {
      deferred?.prompt();
      setDeferred(null);
    }
  };
}

// PWA 设置面板（设置页使用）
export function PwaSettings() {
  const online = useOnlineStatus();
  const { canInstall, prompt } = useInstallPrompt();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>
        网络状态：
        <b style={{ color: online ? 'var(--primary)' : '#c0392b' }}>{online ? '在线' : '离线'}</b>
        （离线时仍可打开已登记数据）
      </div>
      {canInstall ? (
        <button
          onClick={prompt}
          style={{
            padding: '12px',
            borderRadius: 'var(--radius)',
            border: 'none',
            background: 'var(--primary)',
            color: '#fff',
            fontWeight: 600
          }}
        >
          安装到主屏幕
        </button>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          当前环境暂不可安装（需 HTTPS / 用户交互触发）
        </div>
      )}
    </div>
  );
}
