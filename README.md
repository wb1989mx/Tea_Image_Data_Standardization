# 茶叶图像数据标准化平台（PWA）

面向茶叶科研/质检的**图像数据采集与标准化**工具。桌面端负责复杂的批量管理，手机端负责现场采集；
两端共用同一套业务逻辑与路由，仅布局壳不同。核心流程：**标签登记 → 外形/茶汤/叶底三图采集编辑 →
确认登记 → 数据记录 → 批量重命名 → 一键打包下载（ZIP）**。

## 技术栈

- React 18 + Vite 5 + TypeScript
- Tailwind CSS v3 + 自建轻量原子组件（等价 shadcn/ui，避免 CLI 初始化耦合）
- Zustand（根状态）/ Dexie（IndexedDB 持久化）
- React Router v6（桌面/手机共用路由）
- react-image-crop（圆形裁剪）、JSZip（打包）、exifr（EXIF 读取）、vite-plugin-pwa（PWA）

## 快速开始

```bash
# 安装依赖
npm install

# 本地开发（http://localhost:5173，localhost 属安全上下文，相机/安装/EXIF 可用）
npm run dev

# 类型检查
npm run typecheck

# 生产构建（生成 dist/，含 sw.js 与 manifest.webmanifest）
npm run build

# 本地预览构建产物
npm run preview
```

## 架构与模块边界（关键约定）

工程严格分层，**业务模块之间零耦合**，跨模块只通过基础设施层通信。

```
src/
├─ infrastructure/         # 模块唯一通信通道，业务模块只依赖此层
│  ├─ types.ts             # 领域数据模型（全模块共用契约）
│  ├─ repository/          # 数据访问抽象接口（Sample/Asset/Option）
│  ├─ capabilities/        # 能力注册表（相机/导出/EXIF/色彩烘焙/预设查找）
│  ├─ event-bus/           # 发布订阅（mitt），如 asset:updated / sample:created
│  ├─ store/               # 根 Zustand（在线状态/主题），各业务模块自有 store
│  ├─ utils/               # useMediaQuery / uid / downloadBlob / useObjectURL …
│  └─ router/              # 路由表 + Desktop/Mobile 双 Shell 切换
└─ modules/                # 11 个业务模块，彼此不互相 import
   label · quality · image-editor · record · export
   camera · device · color-profile · theme · storage · pwa
```

- **依赖倒置（repository）**：`storage` 在启动期把 Dexie 实现注册进 `infrastructure/repository`，
  其他模块只消费接口，不直接引用 `storage`。
- **能力注册表（capabilities）**：`camera`/`export`/`device`/`color-profile` 在启动期各自注册能力
  （相机组件、ZIP 打包、EXIF 提取、色彩烘焙、预设查找），调用方经 `getXxx()` 取用，互不 import。
- **事件解耦（event-bus）**：`image-editor` 完成编辑 → 发 `asset:updated` → `quality` 订阅刷新槽位，
  无需直接引用对方。
- **双端同构**：单 bundle，`router` 按 `useMediaQuery('(min-width: 768px)')` 切换
  `DesktopShell`（侧边栏/表格/批量）与 `MobileShell`（底部导航/大按钮/相机优先）。

修改任意单个模块（如 `image-editor`）不影响其他模块运行。

## 核心流程

登录/打开 → `/label` 登记标签（类别/名称/年份/等级，类别与等级可自定义新增）→
`/quality/:sampleId` 采集外形/茶汤/叶底（相机或上传，进入 `/edit/:assetId` 圆形裁剪）→
校验（标签完整 + 三图均确认）后「确认登记」→ `/record` 查看、重命名、冲突检测、批量操作 →
一键打包 ZIP 下载。

## 色彩矫正（已接入编辑器）

平台通过「设备型号 → 色彩矫正参数」映射表实现跨机型色彩标准化：

- 映射表在「设置 → 色彩映射表」维护（localStorage 持久化，**非硬编码机型**），可增删预设，
  字段含色温/色调/饱和度/对比度。
- 进入图像编辑页时，按当前样品的 `deviceInfo.model` 解析预设（命中具体机型回退通配 `*`）。
- 编辑器提供「应用色彩矫正」开关：开启后，**实时预览与导出文件均烘焙该预设**；
  原图始终保留，`editedFile` 为矫正后结果，`asset.colorProfile` 记录实际应用的参数。
- 确认登记时，`sample.colorProfile` 同步写入，供记录/导出元数据展示。

> 说明：当前色彩矫正基于 CSS `filter`（对比度/饱和度/亮度/色相旋转）近似实现，非 ICC 级色彩管理，
> 适用于科研样本的快速可比标准化，不替代专业校色流程。

## 主题

内置 5 套主题（极简 iOS 风 / Material You / 新拟态 / 暗黑科技 / 茶韵国风），由 CSS Variables（Theme Token）
驱动，「设置 → 主题」切换。主题**只改视觉，不改变任何业务逻辑**。默认：极简 iOS 风。

## PWA 与部署要求

- 构建产物 `dist/` 含 `sw.js`（离线缓存 app shell）与 `manifest.webmanifest`（可安装到主屏）。
- **硬性前提**：相机（`getUserMedia`/`ImageCapture`）、`beforeinstallprompt` 安装提示、EXIF 读取
  均依赖**安全上下文（HTTPS 或 localhost）**。本地 `npm run dev` 可用；真机必须经 HTTPS 部署，
  否则相机专业模式与安装提示会被浏览器拦截。
- 部署：将 `dist/` 托管到任意支持 HTTPS 的静态服务器/CDN 即可，Service Worker 自动注册。

## 验收清单对照

| # | 验收项 | 实现位置 |
|---|---|---|
| 1 | 桌面/手机均完成完整流程 | 共用路由 + 双 Shell |
| 2 | 相机/上传自动获取设备型号/EXIF | `camera` + `device`（exifr）+ `quality.ensureAsset` |
| 3 | 外形/茶汤/叶底独立编辑并裁剪为圆形 | `image-editor`（react-image-crop circularCrop） |
| 4 | 确认编辑回退质量维度页并更新缩略图 | `event-bus` `asset:updated` |
| 5 | 确认登记后刷新不丢失 | `storage`（Dexie） |
| 6 | 文件名符合「名称+年份+等级+维度+自由编号」 | `record` `renameRule` |
| 7 | 多条数据一键打包 ZIP 下载 | `export`（JSZip：三图 + metadata.csv/json + manifest.txt） |
| 8 | 3–5 套主题切换不影响逻辑 | `theme`（CSS Variables） |
| 9 | 模块独立，替换/修改单模块不影响全局 | 分层 + DI + 能力注册表 |
| 10 | PWA 可安装/离线/响应式 | `pwa` + vite-plugin-pwa |

## 已知边界与后续

- 色彩矫正为 `filter` 近似，非 ICC 级；如需更高精度可接入 `color-profile.bakeProfile` 的矩阵扩展。
- 「网络恢复后同步」当前仅留事件接口（`online:changed`），未接远端服务器。
- 单样品建议 ≤ 3×8MB（1024² PNG/WebP），超出会提示，防止 IndexedDB 膨胀。
- 相机专业控制（对焦/曝光/变焦/白平衡）依赖浏览器能力探测，不支持时自动降级为普通拍照 + 上传。
