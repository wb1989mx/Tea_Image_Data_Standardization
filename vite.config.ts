import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// PWA 配置（manifest / Service Worker / 离线缓存）
// 图标等资源在 modules/pwa 中实现后补全
export default defineConfig({
  // GitHub Pages 为子路径托管，使用相对 base 可适配任意仓库名/子路径
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'favicon.svg'],
      manifest: {
        name: '茶叶图像数据标准化平台',
        short_name: '茶叶图像',
        description: '茶叶图像数据采集与标准化平台',
        theme_color: '#0b7a5b',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: './',
        lang: 'zh-CN',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}']
      }
    })
  ]
});
