/** 阅读区行宽唯一真源：设置页滑块与状态栏弹层共用。 */
export const READER_WIDTH_MIN = 480;
export const READER_WIDTH_MAX = 1400;
export const READER_WIDTH_STEP = 20;

export const READER_WIDTH_PRESETS = [
  { value: 720, label: "紧凑", bar: 14 },
  { value: 960, label: "适中", bar: 17 },
  { value: 1080, label: "标准", bar: 20 },
  { value: 1200, label: "宽松", bar: 23 },
] as const;
