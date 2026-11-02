/**
 * 表格单元格选区工具条（#328 / change editor-fidelity 7.1）。
 *
 * 当矩形单元格选区激活时出现（见 `cell-selection.ts`），暴露源规格 §6 的两个
 * 动作：
 *
 * - 合并单元格（`data-testid="cell-merge"`）：把选中矩形合并进它的左上角单元格。
 *   仅当多于一个单元格被选中时可用。
 * - 单元格背景色（`data-testid="cell-bg"`）：一个背景色子菜单加「恢复默认」，
 *   通过已有的 `mdb-bg-*` span 约定应用。
 *
 * 工具条挂在 `view.dom` 上（不是表格 widget），所以 CM6 重建 widget DOM 时它
 * 保持不动。它由视图级选区 pub/sub 驱动，而不是 CM6 事务，因为创建选区的拖拽
 * 不发出事务。
 */
import type { Extension } from "@codemirror/state";
import { ViewPlugin, type EditorView } from "@codemirror/view";
import {
  cellRect,
  cellSelectionCount,
  getCellSelection,
  isCellInSelection,
  subscribeCellSelection,
  type CellSelection,
} from "./cell-selection";
import { mergeTableCellSelection, setCellBackground } from "./table";

/** 背景选项，镜像浮动色板的「背景色」行。 */
const CELL_BG_COLORS: readonly {
  label: string;
  swatch: string;
  colorClass: string;
}[] = [
  { label: "红色", swatch: "#ffd8d3", colorClass: "mdb-bg-red" },
  { label: "蓝色", swatch: "#d7dcff", colorClass: "mdb-bg-blue" },
  { label: "绿色", swatch: "#d2f8d2", colorClass: "mdb-bg-green" },
  { label: "橙色", swatch: "#ffedd0", colorClass: "mdb-bg-orange" },
  { label: "紫色", swatch: "#e8d7ff", colorClass: "mdb-bg-purple" },
];

function styleToolbar(root: HTMLElement): void {
  root.style.position = "absolute";
  root.style.display = "none";
  root.style.alignItems = "center";
  root.style.gap = "2px";
  root.style.padding = "4px";
  root.style.background = "var(--app-surface)";
  root.style.border = "1px solid var(--app-border)";
  root.style.borderRadius = "6px";
  root.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.18)";
  root.style.zIndex = "1002";
}

function styleToolbarButton(btn: HTMLButtonElement): void {
  btn.style.background = "transparent";
  btn.style.border = "none";
  btn.style.color = "var(--app-text)";
  btn.style.padding = "4px 8px";
  btn.style.cursor = "pointer";
  btn.style.borderRadius = "4px";
  btn.style.fontSize = "13px";
  btn.style.lineHeight = "1";
  btn.style.whiteSpace = "nowrap";
}

/** 把按钮置灰并阻断，但不把它从布局里移除。 */
function setButtonDisabled(btn: HTMLButtonElement, disabled: boolean): void {
  btn.disabled = disabled;
  btn.classList.toggle("mdb-cell-toolbar-btn-disabled", disabled);
  btn.style.opacity = disabled ? "0.4" : "1";
  btn.style.cursor = disabled ? "default" : "pointer";
}

/**
 * 单元格工具条扩展。只挂一次（经 `editorDecorations`），让任何表格交互都获得
 * 合并 / 单元格背景入口。
 */
export function cellToolbar(): Extension {
  return ViewPlugin.fromClass(
    class {
      private readonly unsubscribe: () => void;
      private root: HTMLDivElement | null = null;
      private mergeBtn: HTMLButtonElement | null = null;
      private menu: HTMLDivElement | null = null;
      // 菜单是由 hover 而非 click 打开时为 true；紧随 hover-open 的 click 不能
      // 又把它关掉（#390）。
      private hoverOpened = false;
      private readonly closeMenu: () => void;

      constructor(private readonly view: EditorView) {
        this.closeMenu = () => {
          if (this.menu) this.menu.style.display = "none";
          this.hoverOpened = false;
          document.removeEventListener("mousedown", this.onOutsideDown, true);
          document.removeEventListener("keydown", this.onEscape, true);
        };
        this.unsubscribe = subscribeCellSelection(view, () => this.sync());
      }

      private onOutsideDown = (event: MouseEvent): void => {
        if (this.root && !this.root.contains(event.target as Node)) {
          this.closeMenu();
        }
      };

      private onEscape = (event: KeyboardEvent): void => {
        if (event.key === "Escape") this.closeMenu();
      };

      private openMenu(): void {
        if (!this.menu) return;
        this.menu.style.display = "flex";
        document.addEventListener("mousedown", this.onOutsideDown, true);
        document.addEventListener("keydown", this.onEscape, true);
      }

      private toggleMenu(): void {
        if (this.menu?.style.display === "flex") this.closeMenu();
        else this.openMenu();
      }

      private build(): void {
        const view = this.view;
        const root = document.createElement("div");
        root.className = "cm-cell-toolbar";
        root.classList.add("mdb-cell-toolbar");
        root.setAttribute("data-testid", "cell-toolbar");
        styleToolbar(root);

        const merge = document.createElement("button");
        merge.type = "button";
        merge.className = "cm-cell-toolbar-merge";
        merge.classList.add(
          "cm-cell-toolbar-btn",
          "mdb-cell-toolbar-btn",
          "mdb-cell-toolbar-merge",
        );
        merge.setAttribute("data-testid", "cell-merge");
        merge.title = "合并单元格";
        merge.textContent = "合并单元格";
        styleToolbarButton(merge);
        merge.addEventListener("mousedown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const selection = getCellSelection(view);
          if (!selection || cellSelectionCount(selection) <= 1) return;
          mergeTableCellSelection(
            view,
            selection.tableIndex,
            cellRect(selection),
          );
        });

        const dropdown = document.createElement("div");
        dropdown.className = "cm-cell-toolbar-dropdown";
        dropdown.classList.add("mdb-cell-toolbar-dropdown");
        dropdown.style.position = "relative";
        dropdown.style.display = "inline-flex";

        const bg = document.createElement("button");
        bg.type = "button";
        bg.className = "cm-cell-toolbar-dropdown-btn";
        bg.classList.add(
          "cm-cell-toolbar-btn",
          "mdb-cell-toolbar-btn",
          "mdb-cell-toolbar-dropdown-btn",
        );
        bg.setAttribute("data-testid", "cell-bg");
        bg.title = "单元格背景色";
        bg.textContent = "单元格背景色 ▾";
        styleToolbarButton(bg);
        bg.addEventListener("mousedown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (this.menu?.style.display === "flex" && this.hoverOpened) {
            this.hoverOpened = false;
            return;
          }
          this.toggleMenu();
        });

        // 滑入：悬停「单元格背景色」控件无需点击即可展开子菜单，与块把手的
        // 飞出层一致（#390）。
        dropdown.addEventListener("mouseenter", () => {
          if (this.menu?.style.display === "flex") return;
          this.openMenu();
          this.hoverOpened = true;
        });
        dropdown.addEventListener("mouseleave", () => this.closeMenu());

        const menu = document.createElement("div");
        menu.className = "cm-cell-toolbar-menu";
        menu.classList.add("mdb-cell-toolbar-menu");
        menu.style.position = "absolute";
        menu.style.top = "100%";
        menu.style.left = "0";
        menu.style.marginTop = "4px";
        menu.style.background = "var(--app-surface)";
        menu.style.border = "1px solid var(--app-border)";
        menu.style.borderRadius = "4px";
        menu.style.padding = "6px";
        menu.style.display = "none";
        menu.style.flexDirection = "column";
        menu.style.gap = "6px";
        menu.style.zIndex = "1003";
        menu.style.minWidth = "120px";
        menu.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.18)";

        const swatches = document.createElement("div");
        swatches.className = "cm-color-swatches";
        swatches.classList.add("mdb-color-swatches");
        swatches.style.display = "flex";
        swatches.style.gap = "6px";
        for (const color of CELL_BG_COLORS) {
          const swatch = document.createElement("button");
          swatch.type = "button";
          swatch.className = "cm-color-swatch-bg";
          swatch.classList.add(
            "cm-color-swatch",
            "mdb-color-swatch",
            "mdb-color-swatch-bg",
          );
          swatch.title = color.label;
          swatch.setAttribute("aria-label", color.label);
          swatch.style.width = "20px";
          swatch.style.height = "20px";
          swatch.style.borderRadius = "4px";
          swatch.style.border = "1px solid var(--app-border)";
          swatch.style.cursor = "pointer";
          swatch.style.padding = "0";
          swatch.style.background = color.swatch;
          swatch.addEventListener("mousedown", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const selection = getCellSelection(view);
            if (selection) {
              setCellBackground(
                view,
                selection.tableIndex,
                cellRect(selection),
                color.colorClass,
              );
            }
            this.closeMenu();
          });
          swatches.appendChild(swatch);
        }
        menu.appendChild(swatches);

        const reset = document.createElement("button");
        reset.type = "button";
        reset.className = "cm-cell-toolbar-reset";
        reset.classList.add("mdb-cell-toolbar-reset");
        reset.textContent = "恢复默认";
        reset.style.background = "transparent";
        reset.style.border = "none";
        reset.style.color = "var(--app-text)";
        reset.style.padding = "4px 6px";
        reset.style.cursor = "pointer";
        reset.style.borderRadius = "4px";
        reset.style.fontSize = "13px";
        reset.style.textAlign = "left";
        reset.addEventListener("mousedown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const selection = getCellSelection(view);
          if (selection) {
            setCellBackground(
              view,
              selection.tableIndex,
              cellRect(selection),
              null,
            );
          }
          this.closeMenu();
        });
        menu.appendChild(reset);

        dropdown.appendChild(bg);
        dropdown.appendChild(menu);
        root.appendChild(merge);
        root.appendChild(dropdown);

        if (
          view.dom.style.position === "static" ||
          view.dom.style.position === ""
        ) {
          view.dom.style.position = "relative";
        }
        view.dom.appendChild(root);

        this.root = root;
        this.mergeBtn = merge;
        this.menu = menu;
      }

      /** 选中单元格的并集包围盒，编辑器相对像素。 */
      private selectedRect(selection: CellSelection): DOMRect | null {
        const table =
          this.view.dom.querySelectorAll("table.cm-table")[
            selection.tableIndex
          ];
        if (!(table instanceof HTMLTableElement)) return null;
        let left = Number.POSITIVE_INFINITY;
        let top = Number.POSITIVE_INFINITY;
        let right = Number.NEGATIVE_INFINITY;
        let bottom = Number.NEGATIVE_INFINITY;
        let found = false;
        const cells = table.querySelectorAll<HTMLElement>(
          "th[data-row], td[data-row]",
        );
        cells.forEach((cell) => {
          if (
            !isCellInSelection(
              selection,
              Number(cell.dataset.row),
              Number(cell.dataset.col),
            )
          ) {
            return;
          }
          const rect = cell.getBoundingClientRect();
          left = Math.min(left, rect.left);
          top = Math.min(top, rect.top);
          right = Math.max(right, rect.right);
          bottom = Math.max(bottom, rect.bottom);
          found = true;
        });
        if (!found) return null;
        return new DOMRect(left, top, right - left, bottom - top);
      }

      private position(selection: CellSelection): void {
        if (!this.root) return;
        const rect = this.selectedRect(selection);
        if (!rect) return;
        const editorRect = this.view.dom.getBoundingClientRect();
        const height = this.root.offsetHeight || 0;
        this.root.style.left = `${Math.max(4, rect.left - editorRect.left)}px`;
        this.root.style.top = `${Math.max(4, rect.top - editorRect.top - height - 6)}px`;
      }

      private sync(): void {
        const selection = getCellSelection(this.view);
        // 普通点击只是把光标放进单元格——没有工具条。刻意选中（拖拽或
        // shift-click）可以是单个单元格，且仍想要背景控件（#455）。
        const deliberate =
          selection !== null &&
          (cellSelectionCount(selection) > 1 || selection.explicit === true);
        if (!selection || !deliberate) {
          this.closeMenu();
          if (this.root) this.root.style.display = "none";
          return;
        }
        if (!this.root) this.build();
        if (this.root && this.mergeBtn) {
          setButtonDisabled(this.mergeBtn, cellSelectionCount(selection) <= 1);
          this.root.style.display = "inline-flex";
          this.position(selection);
        }
      }

      destroy(): void {
        this.unsubscribe();
        this.closeMenu();
        this.root?.remove();
        this.root = null;
      }
    },
  );
}
