/** 图表水合入口（兼容壳，design D1/D2）：实现已换装 Pele，见 renderers/diagram/。
 *  入口名与签名保持不变，调用点（PreviewView / ContentArea / 编辑区装饰注入）零改动。 */
export {
  clearAll as clearMermaid,
  renderAll as renderMermaid,
} from "./diagram/engine";
