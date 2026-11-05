/**
 * 工作区分栏的递归 pane 树（change layout-portal / 3.1）。
 *
 * 这里只有纯模型与纯函数：不碰 store、不碰 DOM。渲染在
 * `components/Content/PaneTreeView.tsx`，状态在 `stores/index.ts`。
 *
 *   node = { id, dir: 'row'|'col', ratio, children }
 *   leaf = { id, tabs, activeTabId, editorMode }
 *
 * 约定：
 *  - 根 leaf 的 id 固定为 "main"：`getActiveEditorView()` 的兜底面板依赖它。
 *  - 根 leaf 永不被删除（只有一个格时关闭按钮不出现）。
 *  - 每格最小 240px（宽与高）：比例侧由 `clampRatio` 兜底，CSS `min-width`
 *    /`min-height` 是最后一层硬保证。
 */

import type { EditorMode } from "../types";

export const MIN_PANE_PX = 240;
/** 解析持久化布局时的最大嵌套深度。超过即视为损坏，返回 null。 */
export const MAX_PANE_DEPTH = 32;

export type PaneDir = "row" | "col";

/** 落区方向（相对目标格的某一侧）；用于拖拽换位（change layout-portal / 5.1）。 */
export type PaneSide = "left" | "right" | "top" | "bottom";

/** 左右侧是水平分裂（row），上下侧是垂直分裂（col）。 */
export function sideToDir(side: PaneSide): PaneDir {
  return side === "left" || side === "right" ? "row" : "col";
}

export interface PaneLeaf {
  type: "leaf";
  id: string;
  tabs: string[];
  activeTabId: string | null;
  editorMode: EditorMode;
  /** leaf 角色：普通页签格（缺省）或 AI 停靠窗格（layout-portal 9.1）。 */
  kind?: "tabs" | "ai";
}

export interface PaneBranch {
  type: "node";
  id: string;
  dir: PaneDir;
  ratio: number;
  children: [PaneLayout, PaneLayout];
}

export type PaneLayout = PaneLeaf | PaneBranch;

/** 持久化后的 leaf：页签存的是文件绝对路径（tab id 跨重启不稳定）。 */
export interface SerializedLeaf {
  type: "leaf";
  id: string;
  tabs: string[];
  activePath: string | null;
  editorMode: EditorMode;
  /** AI 停靠窗格持久化为 "ai"；普通格缺省（老配置兼容）。 */
  kind?: "tabs" | "ai";
}

export interface SerializedBranch {
  type: "node";
  id: string;
  dir: PaneDir;
  ratio: number;
  children: [SerializedNode, SerializedNode];
}

export type SerializedNode = SerializedLeaf | SerializedBranch;

export interface SerializedPaneLayout {
  version: 1;
  focusedId: string;
  root: SerializedNode;
}

const EDITOR_MODES: readonly EditorMode[] = ["preview", "edit", "source"];

let nextBranchId = 1;
function generateBranchId(): string {
  return `branch-${nextBranchId++}`;
}

export function createRootLeaf(): PaneLeaf {
  return {
    type: "leaf",
    id: "main",
    tabs: [],
    activeTabId: null,
    editorMode: "preview",
  };
}

export function createLeaf(
  id: string,
  editorMode: EditorMode = "preview",
): PaneLeaf {
  return { type: "leaf", id, tabs: [], activeTabId: null, editorMode };
}

export function isLeaf(node: PaneLayout): node is PaneLeaf {
  return node.type === "leaf";
}

export function findLeaf(root: PaneLayout, leafId: string): PaneLeaf | null {
  if (isLeaf(root)) return root.id === leafId ? root : null;
  return (
    findLeaf(root.children[0], leafId) ?? findLeaf(root.children[1], leafId)
  );
}

export function containsLeaf(node: PaneLayout, leafId: string): boolean {
  return findLeaf(node, leafId) !== null;
}

export function listLeaves(root: PaneLayout): PaneLeaf[] {
  if (isLeaf(root)) return [root];
  return [...listLeaves(root.children[0]), ...listLeaves(root.children[1])];
}

export function leafCount(root: PaneLayout): number {
  return listLeaves(root).length;
}

/** 结构克隆，对每个 leaf 应用 fn（不修改原树）。 */
export function mapLeaves(
  root: PaneLayout,
  fn: (leaf: PaneLeaf) => PaneLeaf,
): PaneLayout {
  if (isLeaf(root)) return fn(root);
  return {
    ...root,
    children: [
      mapLeaves(root.children[0], fn),
      mapLeaves(root.children[1], fn),
    ],
  };
}

export function updateLeaf(
  root: PaneLayout,
  leafId: string,
  patch: Partial<Omit<PaneLeaf, "type" | "id">>,
): PaneLayout {
  return mapLeaves(root, (leaf) =>
    leaf.id === leafId ? { ...leaf, ...patch } : leaf,
  );
}

export function leafOfTab(root: PaneLayout, tabId: string): PaneLeaf | null {
  return listLeaves(root).find((leaf) => leaf.tabs.includes(tabId)) ?? null;
}

/**
 * 把 leafId 指定的 leaf 一分为二：原 leaf 留在 children[0]，newLeaf 在
 * children[1]，新分支 ratio 0.5。找不到 leafId 时原样返回。
 */
export function splitLeaf(
  root: PaneLayout,
  leafId: string,
  dir: PaneDir,
  newLeaf: PaneLeaf,
): PaneLayout {
  if (!containsLeaf(root, leafId)) return root;
  const replace = (node: PaneLayout): PaneLayout => {
    if (isLeaf(node)) {
      if (node.id !== leafId) return node;
      return {
        type: "node",
        id: generateBranchId(),
        dir,
        ratio: 0.5,
        children: [node, newLeaf],
      };
    }
    return {
      ...node,
      children: [replace(node.children[0]), replace(node.children[1])],
    };
  };
  return replace(root);
}

/**
 * 删除 leafId：其父分支塌缩为存活的那个兄弟子树。
 * 根 leaf 永不删除（removed=false）。
 */
export function removeLeaf(
  root: PaneLayout,
  leafId: string,
): { root: PaneLayout; removed: boolean } {
  if (isLeaf(root)) return { root, removed: false };
  if (!containsLeaf(root, leafId)) return { root, removed: false };

  const walk = (node: PaneLayout): PaneLayout => {
    if (isLeaf(node)) return node;
    const [a, b] = node.children;
    if (isLeaf(a) && a.id === leafId) return b;
    if (isLeaf(b) && b.id === leafId) return a;
    return { ...node, children: [walk(a), walk(b)] };
  };
  return { root: walk(root), removed: true };
}

/**
 * 与 leafId 最近的兄弟子树里的第一个 leaf（用于关闭后移焦点）。
 * 找不到（根 leaf）返回 null。
 */
export function siblingLeafId(root: PaneLayout, leafId: string): string | null {
  const walk = (node: PaneLayout): string | null => {
    if (isLeaf(node)) return null;
    const [a, b] = node.children;
    const inA = containsLeaf(a, leafId);
    const inB = containsLeaf(b, leafId);
    if (!inA && !inB) return null;
    const deeper = walk(inA ? a : b);
    if (deeper) return deeper;
    const sibling = inA ? b : a;
    return isLeaf(sibling) ? sibling.id : (listLeaves(sibling)[0]?.id ?? null);
  };
  return walk(root);
}

export function setBranchRatio(
  root: PaneLayout,
  branchId: string,
  ratio: number,
): PaneLayout {
  const safe = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0.5;
  const walk = (node: PaneLayout): PaneLayout => {
    if (isLeaf(node)) return node;
    const children: [PaneLayout, PaneLayout] = [
      walk(node.children[0]),
      walk(node.children[1]),
    ];
    return node.id === branchId
      ? { ...node, ratio: safe, children }
      : { ...node, children };
  };
  return walk(root);
}

/**
 * 把 ratio 钳进 [minPx/containerPx, 1 - minPx/containerPx]，保证两侧都 ≥ 240px。
 * 容器太窄（≤ 2×minPx）时无解，退回 0.5。
 */
export function clampRatio(
  ratio: number,
  containerPx: number,
  minPx: number = MIN_PANE_PX,
): number {
  const safeRatio = Number.isFinite(ratio) ? ratio : 0.5;
  if (
    !Number.isFinite(containerPx) ||
    containerPx <= 0 ||
    containerPx <= 2 * minPx
  ) {
    return 0.5;
  }
  const lo = minPx / containerPx;
  const hi = 1 - lo;
  return Math.min(hi, Math.max(lo, safeRatio));
}

/** 在 leafId 的 leaf 末尾追加页签并置为活动。 */
export function addTab(
  root: PaneLayout,
  leafId: string,
  tabId: string,
): PaneLayout {
  const leaf = findLeaf(root, leafId);
  if (!leaf) return root;
  const tabs = leaf.tabs.includes(tabId) ? leaf.tabs : [...leaf.tabs, tabId];
  return updateLeaf(root, leafId, { tabs, activeTabId: tabId });
}

/** 从 leafId 的 leaf 移除页签，并在必要时把活动页签切到相邻页签。 */
export function removeTab(
  root: PaneLayout,
  leafId: string,
  tabId: string,
): PaneLayout {
  const leaf = findLeaf(root, leafId);
  if (!leaf) return root;
  const tabs = leaf.tabs.filter((id) => id !== tabId);
  let activeTabId = leaf.activeTabId;
  if (activeTabId === tabId || !tabs.includes(activeTabId ?? "")) {
    activeTabId = tabs[0] ?? null;
  }
  return updateLeaf(root, leafId, { tabs, activeTabId });
}

/** 把数组元素从 `from` 移到 `to`（终态下标，splice 语义）；越界或原位返回副本。 */
export function moveItem<T>(arr: readonly T[], from: number, to: number): T[] {
  const n = arr.length;
  if (from < 0 || from >= n) return arr.slice();
  const clamped = Math.max(0, Math.min(n - 1, to));
  if (clamped === from) return arr.slice();
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(clamped, 0, item);
  return next;
}

/** 在 leafId 内把页签从 `from` 移到 `to`（终态下标）。原位/越界返回原树。 */
export function reorderLeafTabs(
  root: PaneLayout,
  leafId: string,
  from: number,
  to: number,
): PaneLayout {
  const leaf = findLeaf(root, leafId);
  if (!leaf) return root;
  const tabs = moveItem(leaf.tabs, from, to);
  if (tabs.every((id, i) => id === leaf.tabs[i])) return root;
  return updateLeaf(root, leafId, { tabs });
}

// ── 拖拽换位（change layout-portal / 5.1）────────────────────────

/**
 * 把 newNode 包成 targetId 所在 leaf 的兄弟：target 与 newNode 组成一个
 * ratio 0.5 的新分支，newNode 落在 side 指定的那一侧。找不到 target 返回原树。
 */
function wrapLeafWith(
  root: PaneLayout,
  targetId: string,
  newNode: PaneLeaf,
  side: PaneSide,
): PaneLayout {
  const dir = sideToDir(side);
  const before = side === "left" || side === "top";
  const walk = (node: PaneLayout): PaneLayout => {
    if (isLeaf(node)) {
      if (node.id !== targetId) return node;
      return {
        type: "node",
        id: generateBranchId(),
        dir,
        ratio: 0.5,
        children: before ? [newNode, node] : [node, newNode],
      };
    }
    return {
      ...node,
      children: [walk(node.children[0]), walk(node.children[1])],
    };
  };
  return walk(root);
}

/**
 * 互换两个 leaf 的位置：只交换两棵子树，分支与各分支 ratio 保持在原结构位置；
 * 每个 leaf 自带的页签 / activeTabId / editorMode 随 leaf 一起搬走。
 * 同一个 id、或任一 id 不存在时返回原树。
 */
export function swapLeaves(
  root: PaneLayout,
  aId: string,
  bId: string,
): PaneLayout {
  if (aId === bId) return root;
  const a = findLeaf(root, aId);
  const b = findLeaf(root, bId);
  if (!a || !b) return root;
  return mapLeaves(root, (leaf) => {
    if (leaf.id === aId) return b;
    if (leaf.id === bId) return a;
    return leaf;
  });
}

/**
 * 把 sourceId 的 leaf 移到 targetId 的某一侧：先从原位置摘除（父分支塌缩），
 * 再作为兄弟插到 target 该侧，target 与它组成 ratio 0.5 的新分支。
 * source === target、或任一 id 不存在时返回原树。
 */
export function moveLeaf(
  root: PaneLayout,
  sourceId: string,
  targetId: string,
  side: PaneSide,
): PaneLayout {
  if (sourceId === targetId) return root;
  const source = findLeaf(root, sourceId);
  if (!source) return root;
  if (!findLeaf(root, targetId)) return root;
  const { root: removed, removed: ok } = removeLeaf(root, sourceId);
  if (!ok) return root;
  return wrapLeafWith(removed, targetId, source, side);
}

/**
 * 把 sourceId 的 leaf 提到根层：摘除后与整棵剩余树组成新的根分支，
 * moved leaf 落在 side 侧、ratio 0.5。根就是单个 leaf、或 id 不存在时返回原树。
 */
export function moveLeafToRoot(
  root: PaneLayout,
  sourceId: string,
  side: PaneSide,
): PaneLayout {
  if (isLeaf(root)) return root;
  const source = findLeaf(root, sourceId);
  if (!source) return root;
  const { root: rest, removed } = removeLeaf(root, sourceId);
  if (!removed) return root;
  const dir = sideToDir(side);
  const before = side === "left" || side === "top";
  return {
    type: "node",
    id: generateBranchId(),
    dir,
    ratio: 0.5,
    children: before ? [source, rest] : [rest, source],
  };
}

/**
 * 在 leafId 的某一侧分裂：newLeaf 作为该侧的新兄弟，ratio 0.5。
 * 与 `splitLeaf` 的区别是能指定新格在左/上（splitLeaf 恒把新格放 children[1]）。
 */
export function splitLeafSide(
  root: PaneLayout,
  leafId: string,
  side: PaneSide,
  newLeaf: PaneLeaf,
): PaneLayout {
  if (!containsLeaf(root, leafId)) return root;
  return wrapLeafWith(root, leafId, newLeaf, side);
}

/** 序列化：丢弃没有 path 的页签（未保存新页签跨重启无法恢复）。 */
export function serializeLayout(
  layout: PaneLayout,
  focusedId: string,
  pathOf: (tabId: string | null) => string | null,
): SerializedPaneLayout {
  const node = (n: PaneLayout): SerializedNode => {
    if (isLeaf(n)) {
      const tabs = n.tabs
        .map((id) => pathOf(id))
        .filter((p): p is string => typeof p === "string" && p.length > 0);
      const activePath = pathOf(n.activeTabId);
      return {
        type: "leaf",
        id: n.id,
        tabs,
        activePath: activePath ?? null,
        editorMode: n.editorMode,
        ...(n.kind === "ai" ? { kind: "ai" as const } : null),
      };
    }
    return {
      type: "node",
      id: n.id,
      dir: n.dir,
      ratio: n.ratio,
      children: [node(n.children[0]), node(n.children[1])],
    };
  };
  return { version: 1, focusedId, root: node(layout) };
}

function isValidLeaf(node: unknown): node is SerializedLeaf {
  if (typeof node !== "object" || node === null) return false;
  const n = node as Record<string, unknown>;
  if (n.type !== "leaf") return false;
  if (typeof n.id !== "string" || n.id.length === 0) return false;
  if (!Array.isArray(n.tabs) || !n.tabs.every((t) => typeof t === "string")) {
    return false;
  }
  if (n.activePath !== null && typeof n.activePath !== "string") return false;
  if (!EDITOR_MODES.includes(n.editorMode as EditorMode)) return false;
  if (n.kind !== undefined && n.kind !== "tabs" && n.kind !== "ai")
    return false;
  return true;
}

function isValidBranch(node: unknown, depth: number): node is SerializedBranch {
  if (typeof node !== "object" || node === null) return false;
  if (depth > MAX_PANE_DEPTH) return false;
  const n = node as Record<string, unknown>;
  if (n.type !== "node") return false;
  if (typeof n.id !== "string" || n.id.length === 0) return false;
  if (n.dir !== "row" && n.dir !== "col") return false;
  if (typeof n.ratio !== "number" || !Number.isFinite(n.ratio)) return false;
  if (!Array.isArray(n.children) || n.children.length !== 2) return false;
  return n.children.every((child) => isValidNode(child, depth + 1));
}

function isValidNode(node: unknown, depth: number): node is SerializedNode {
  if (depth > MAX_PANE_DEPTH) return false;
  if (typeof node !== "object" || node === null) return false;
  const type = (node as Record<string, unknown>).type;
  if (type === "leaf") return isValidLeaf(node);
  if (type === "node") return isValidBranch(node, depth);
  return false;
}

function collectIds(node: SerializedNode, out: Set<string>): boolean {
  if (out.has(node.id)) return false;
  out.add(node.id);
  if (node.type === "node") {
    return (
      collectIds(node.children[0], out) && collectIds(node.children[1], out)
    );
  }
  return true;
}

/**
 * 严格校验持久化 JSON。任一结构问题（坏 JSON / 版本不符 / id 重复 /
 * 分支不是两个子节点 / ratio 非有限数 / 嵌套过深）都返回 null，由调用方
 * 退化为默认单格。
 */
export function parseSerializedLayout(
  json: string,
): SerializedPaneLayout | null {
  if (typeof json !== "string" || json.trim().length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  if (obj.version !== 1) return null;
  if (typeof obj.focusedId !== "string" || obj.focusedId.length === 0)
    return null;
  if (!isValidNode(obj.root, 1)) return null;
  const root = obj.root as SerializedNode;
  const ids = new Set<string>();
  if (!collectIds(root, ids)) return null;
  return { version: 1, focusedId: obj.focusedId, root };
}

/**
 * 把解析后的布局还原成运行时树：把 path 映射回 tab id（映射不到的丢弃），
 * 空 leaf（非根）塌缩掉；全部映射失败时退化为默认单格。
 */
export function restoreLayout(
  state: SerializedPaneLayout,
  idOfPath: (path: string) => string | null,
): { root: PaneLayout; focusedId: string } {
  let anyTab = false;
  let anyAi = false;

  const node = (n: SerializedNode): PaneLayout => {
    if (n.type === "leaf") {
      const isAi = n.kind === "ai";
      if (isAi) anyAi = true;
      const tabs: string[] = [];
      for (const path of n.tabs) {
        const id = idOfPath(path);
        if (id && !tabs.includes(id)) tabs.push(id);
      }
      let activeTabId = (n.activePath ? idOfPath(n.activePath) : null) ?? null;
      if (activeTabId && !tabs.includes(activeTabId)) activeTabId = null;
      if (!activeTabId) activeTabId = tabs[0] ?? null;
      if (tabs.length > 0) anyTab = true;
      return {
        type: "leaf",
        id: n.id,
        tabs,
        activeTabId,
        editorMode: EDITOR_MODES.includes(n.editorMode)
          ? n.editorMode
          : "preview",
        ...(isAi ? { kind: "ai" as const } : null),
      };
    }
    return {
      type: "node",
      id: n.id,
      dir: n.dir,
      ratio: Number.isFinite(n.ratio) ? n.ratio : 0.5,
      children: [node(n.children[0]), node(n.children[1])],
    };
  };

  let root = node(state.root);

  // 空 leaf（非根、非 AI）塌缩。每次都重算，直到树稳定。
  // AI 窗格无页签但必须保留——它承载 AI 对话宿主，不是空占位。
  let changed = true;
  while (changed && !isLeaf(root)) {
    changed = false;
    const empties = listLeaves(root).filter(
      (leaf) => leaf.kind !== "ai" && leaf.tabs.length === 0,
    );
    for (const leaf of empties) {
      if (isLeaf(root)) break;
      const res = removeLeaf(root, leaf.id);
      if (res.removed) {
        root = res.root;
        changed = true;
      }
    }
  }

  if (!anyTab && !anyAi) {
    return { root: createRootLeaf(), focusedId: "main" };
  }

  let focusedId = state.focusedId;
  if (!findLeaf(root, focusedId)) {
    focusedId = listLeaves(root)[0]?.id ?? "main";
  }
  return { root, focusedId };
}
