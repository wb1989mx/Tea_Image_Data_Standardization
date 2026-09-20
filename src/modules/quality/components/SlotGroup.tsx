import type { ReactNode } from 'react';

// 维度分组薄壳（纯布局）
//
// 设计取舍：这里**不渲染维度标题**。因为「外形」「叶底」各只含 1 个槽位，
// 若仅给茶汤组加标题会造成视觉不对称；而茶汤组的归属已由槽位名
// 「茶汤第1冲 / 茶汤第2冲」自解释。若后续需要显式分组标题，只改本组件即可。
//
// 布局约定：
// - 桌面端：外层网格 4 列，茶汤组跨 2 列，组内 2 个子槽位并排；
// - 移动端：组内纵向堆叠（避免 390px 宽度下「相机/上传/编辑」三个按钮被挤压到不可点）。
export function SlotGroup({
  span = 1,
  children
}: {
  span?: number;
  children: ReactNode;
}) {
  const multi = span > 1;
  return (
    <div className={multi ? 'md:col-span-2' : undefined} style={{ minWidth: 0 }}>
      <div className={`grid grid-cols-1 gap-4 ${multi ? 'sm:grid-cols-2' : ''}`}>{children}</div>
    </div>
  );
}
