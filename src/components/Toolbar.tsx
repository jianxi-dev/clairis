/**
 * 全局顶栏只保留产品级品牌标识。
 *
 * 网格概览、AI、主题、沉浸四个入口已下沉到底部状态栏（G-3）；文件标题与
 * 预览/编辑/源码切换在每个分栏的页签条，顶栏不再承担当前文档的身份。
 */
export default function Toolbar() {
  return (
    <header className="app-chrome flex items-center gap-1 px-3 py-1.5 border-b border-[var(--app-border)] bg-transparent text-sm select-none shrink-0">
      <span className="text-xs font-medium tracking-wide text-[var(--app-text-2)]">
        标月
      </span>
    </header>
  );
}
