import { useRef, useState } from "react";
import Icon from "./Icon";
import {
  Button,
  type ButtonSize,
  type ButtonVariant,
} from "../ui/primitives/Button";
import { IconButton } from "../ui/primitives/IconButton";
import { Menu, type MenuItem } from "../ui/primitives/Menu";

/**
 * 基件对照场（ui-quality-primitives-v1 / 2.1 子集；2.4 扩为四基件 × 6 态 × 明暗）。
 *
 * 仅 dev：`src/main.tsx` 用 `import.meta.env.DEV && ?showcase` 分流，生产构建不含本文件。
 * 结构按「基件分节 + 每节一个 map」，2.4 加 Menu / Tooltip 与 6 态矩阵时直接续写。
 */

const BUTTON_VARIANTS: readonly ButtonVariant[] = [
  "primary",
  "secondary",
  "soft",
  "ghost",
  "danger",
  "danger-soft",
];

const BUTTON_SIZES: readonly ButtonSize[] = ["sm", "md"];

const ICONBUTTON_SIZES = [14, 18] as const;

const MENU_ITEMS: MenuItem[] = [
  { id: "new", label: "新建文档", icon: "markdown", shortcut: "⌘N", run: () => {} },
  { id: "duplicate", label: "复制", shortcut: "⌘D", run: () => {} },
  { id: "delete", label: "删除（不可用）", disabled: true, run: () => {} },
];

const sectionTitle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: "14px",
};

export default function Showcase() {
  const [clicked, setClicked] = useState(false);
  // 真实 React 状态切换（非 classList 硬改）：供 e2e 验证 loading 进 / 出时
  // 文案不替换、宽度不抖、aria-busy 正确挂落（AC4「不残留上一轮文案」）。
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [menuB, setMenuB] = useState<{ x: number; y: number } | null>(null);
  const [narrowMenu, setNarrowMenu] = useState<{ x: number; y: number } | null>(null);
  const [cornerStage, setCornerStage] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuBtnBRef = useRef<HTMLButtonElement>(null);
  const menuBtnGroupRef = useRef<HTMLDivElement>(null);
  const narrowRef = useRef<HTMLDivElement>(null);
  const cornerRefs = {
    "menu-corner-tl": useRef<HTMLButtonElement>(null),
    "menu-corner-tr": useRef<HTMLButtonElement>(null),
    "menu-corner-bl": useRef<HTMLButtonElement>(null),
    "menu-corner-br": useRef<HTMLButtonElement>(null),
    "menu-narrow-anchor": useRef<HTMLButtonElement>(null),
  };

  const anchorOf = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.bottom + 4 };
  };

  const openMenu = (el: HTMLElement | null) => {
    if (el) setMenu(anchorOf(el));
  };

  const openMenuB = (el: HTMLElement | null) => {
    if (el) setMenuB(anchorOf(el));
  };

  const openNarrowMenu = (el: HTMLElement | null) => {
    if (el) setNarrowMenu(anchorOf(el));
  };

  return (
    <div
      data-showcase-root="true"
      style={{
        padding: "24px",
        background: "var(--app-bg)",
        color: "var(--app-text)",
        minHeight: "100vh",
        fontFamily: "inherit",
      }}
    >
      <h1 style={{ margin: "0 0 16px", fontSize: "16px" }}>
        基件对照场（dev-only）
      </h1>

      {clicked && (
        <p data-clicked="true" style={{ margin: "0 0 16px", fontSize: "13px" }}>
          已点击
        </p>
      )}

      <section data-section="button-grid" style={{ marginBottom: "24px" }}>
        <h2 style={sectionTitle}>Button · 六 variant × 两 size</h2>
        {/*
          显式标记：本网格是 variant × size 展示样本，其中的 primary 不是真实操作区，
          不计入「每屏 primary ≤1」音量纪律。e2e 用 data-showcase-grid="samples"
          把样本数钉死（改动即红），与 data-section="primary-rule" 的纪律区分离。
        */}
        <div
          data-showcase-grid="samples"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
            gap: "8px",
            alignItems: "center",
          }}
        >
          {BUTTON_VARIANTS.map((variant) =>
            BUTTON_SIZES.map((size) => (
              <Button
                key={`${variant}-${size}`}
                variant={variant}
                size={size}
                onClick={() => setClicked(true)}
                data-showcase={`button-${variant}-${size}`}
                data-primitive="button"
              >
                {variant}
              </Button>
            )),
          )}
        </div>
      </section>

      <section data-section="button-states" style={{ marginBottom: "24px" }}>
        <h2 style={sectionTitle}>Button · 状态（loading 宽度不抖 / disabled 不触发）</h2>
        <div style={{ display: "flex", gap: "8px" }}>
          <Button
            variant="primary"
            size="md"
            loading
            data-showcase="button-loading"
            data-primitive="button"
            onClick={() => setClicked(true)}
          >
            保存中
          </Button>
          <Button
            variant="secondary"
            size="md"
            disabled
            data-showcase="button-disabled"
            onClick={() => setClicked(true)}
          >
            已禁用
          </Button>
          <Button
            variant="primary"
            size="md"
            loading={loadingDemo}
            data-showcase="button-loading-toggle"
            onClick={() => setClicked(true)}
          >
            保存
          </Button>
          <Button
            variant="secondary"
            size="sm"
            data-showcase="button-loading-toggle-switch"
            onClick={() => setLoadingDemo((v) => !v)}
          >
            切换 loading（当前 {loadingDemo ? "loading" : "idle"}）
          </Button>
        </div>
      </section>

      <section data-section="primary-rule" style={{ marginBottom: "24px" }}>
        <h2 style={sectionTitle}>每屏 primary ≤1（本区恰好一个主操作）</h2>
        <div style={{ display: "flex", gap: "8px" }}>
          <Button
            variant="primary"
            size="md"
            icon="check"
            data-showcase="primary-rule-primary"
            onClick={() => setClicked(true)}
          >
            确认
          </Button>
          <Button
            variant="secondary"
            size="md"
            data-showcase="primary-rule-secondary"
            onClick={() => setClicked(true)}
          >
            取消
          </Button>
        </div>
      </section>

      <section data-section="iconbutton" style={{ marginBottom: "24px" }}>
        <h2 style={sectionTitle}>IconButton · 两 size × 两态</h2>
        <div style={{ display: "flex", gap: "8px" }}>
          {ICONBUTTON_SIZES.map((size) => (
            <div
              key={size}
              style={{ display: "flex", gap: "8px", alignItems: "center" }}
            >
              <IconButton
                icon="settings"
                label={`设置 ${size}`}
                size={size}
                data-showcase={`iconbutton-${size}-enabled`}
                data-primitive="iconbutton"
                onClick={() => setClicked(true)}
              />
              <IconButton
                icon="settings"
                label={`设置 ${size} 禁用`}
                size={size}
                disabled
                data-showcase={`iconbutton-${size}-disabled`}
                data-primitive="iconbutton"
                onClick={() => setClicked(true)}
              />
            </div>
          ))}
        </div>
      </section>

      <section data-section="menu" style={{ marginBottom: "24px" }}>
        <h2 style={sectionTitle}>Menu · 12 向翻转 / 层栈关闭</h2>
        <div ref={menuBtnGroupRef} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            ref={menuBtnRef}
            data-showcase="menu-open"
            className="bp-btn bp-btn--secondary bp-btn--md"
            onClick={() => openMenu(menuBtnRef.current)}
          >
            <span className="bp-btn__label">打开菜单</span>
          </button>
          <button
            ref={menuBtnBRef}
            data-showcase="menu-open-b"
            className="bp-btn bp-btn--secondary bp-btn--md"
            onClick={() => openMenuB(menuBtnBRef.current)}
          >
            <span className="bp-btn__label">打开第二层</span>
          </button>
        </div>
        {menu && (
          <Menu
            anchor={menu}
            items={MENU_ITEMS}
            onClose={() => setMenu(null)}
            testId="showcase-menu"
            triggerRef={menuBtnGroupRef}
          />
        )}
        {menuB && (
          <Menu
            anchor={menuB}
            items={MENU_ITEMS}
            onClose={() => setMenuB(null)}
            testId="showcase-menu-b"
            triggerRef={menuBtnBRef}
          />
        )}

        <h2 style={{ ...sectionTitle, marginTop: "16px" }}>
          四角锚点（e2e 验证 12 向翻转）
        </h2>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            data-showcase="menu-corner-toggle"
            className="bp-btn bp-btn--secondary bp-btn--sm"
            aria-pressed={cornerStage}
            onClick={() => setCornerStage((v) => !v)}
          >
            <span className="bp-btn__label">
              {cornerStage ? "收起四角舞台" : "展开四角舞台"}
            </span>
          </button>
        </div>
        {cornerStage && (
          <div
            data-showcase-corner-stage=""
            style={{
              position: "fixed",
              inset: 0,
              pointerEvents: "none",
              zIndex: 80,
            }}
          >
            <button
              ref={cornerRefs["menu-corner-tl"]}
              data-showcase="menu-corner-tl"
              className="bp-btn bp-btn--secondary bp-btn--sm"
              style={{
                position: "fixed",
                left: "8px",
                top: "8px",
                pointerEvents: "auto",
              }}
              onClick={() => openMenu(cornerRefs["menu-corner-tl"].current)}
            >
              <span className="bp-btn__label">左上</span>
            </button>
            <button
              ref={cornerRefs["menu-corner-tr"]}
              data-showcase="menu-corner-tr"
              className="bp-btn bp-btn--secondary bp-btn--sm"
              style={{
                position: "fixed",
                right: "8px",
                top: "8px",
                pointerEvents: "auto",
              }}
              onClick={() => openMenu(cornerRefs["menu-corner-tr"].current)}
            >
              <span className="bp-btn__label">右上</span>
            </button>
            <button
              ref={cornerRefs["menu-corner-bl"]}
              data-showcase="menu-corner-bl"
              className="bp-btn bp-btn--secondary bp-btn--sm"
              style={{
                position: "fixed",
                left: "8px",
                bottom: "8px",
                pointerEvents: "auto",
              }}
              onClick={() => openMenu(cornerRefs["menu-corner-bl"].current)}
            >
              <span className="bp-btn__label">左下</span>
            </button>
            <button
              ref={cornerRefs["menu-corner-br"]}
              data-showcase="menu-corner-br"
              className="bp-btn bp-btn--secondary bp-btn--sm"
              style={{
                position: "fixed",
                right: "8px",
                bottom: "8px",
                pointerEvents: "auto",
              }}
              onClick={() => openMenu(cornerRefs["menu-corner-br"].current)}
            >
              <span className="bp-btn__label">右下</span>
            </button>
          </div>
        )}

        <h2 style={{ ...sectionTitle, marginTop: "16px" }}>
          窄容器（#1017 回归：右缘不溢出）
        </h2>
        <div
          ref={narrowRef}
          data-showcase-narrow-container=""
          style={{
            position: "relative",
            width: "200px",
            height: "80px",
            border: "1px solid var(--app-border)",
            borderRadius: "var(--radius-4)",
          }}
        >
          <button
            ref={cornerRefs["menu-narrow-anchor"]}
            data-showcase="menu-narrow-anchor"
            className="bp-btn bp-btn--secondary bp-btn--sm"
            style={{ position: "absolute", right: "8px", top: "8px" }}
            onClick={() => openNarrowMenu(cornerRefs["menu-narrow-anchor"].current)}
          >
            <span className="bp-btn__label">靠右锚点</span>
          </button>
        </div>
        {narrowMenu && (
          <Menu
            anchor={narrowMenu}
            items={MENU_ITEMS}
            onClose={() => setNarrowMenu(null)}
            testId="showcase-menu-narrow"
            boundsOf={() => narrowRef.current}
            triggerRef={cornerRefs["menu-narrow-anchor"]}
          />
        )}
      </section>

      <section data-section="icon-reference">
        <h2 style={sectionTitle}>Icon 参照</h2>
        <div style={{ display: "flex", gap: "8px" }}>
          <Icon name="check" size={18} />
          <Icon name="close" size={18} />
          <Icon name="settings" size={18} />
        </div>
      </section>
    </div>
  );
}
