import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
// 副作用导入：注册仓储实现 + 种子默认选项（必须在其它业务模块读写前完成）
import { ensureSeed } from './modules/storage';
// 各能力模块在导入时向 infrastructure/capabilities 注册自身，互不 import
import './modules/export';
import './modules/camera';
import './modules/device';
import './modules/color-profile';
import './modules/pwa';

ensureSeed().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
