import mitt from 'mitt';

// 跨模块解耦通信：模块之间禁止直接 import，统一走事件总线
export type AppEvents = {
  'asset:updated': { assetId: string; sampleId: string };
  'sample:created': { sampleId: string };
  'sample:changed': void;
  'theme:changed': string;
  'online:changed': boolean;
};

export const bus = mitt<AppEvents>();
