import {
  isLeaf,
  listLeaves,
  type PaneDir,
  type PaneLayout,
  type PaneLeaf,
} from "./paneTree";

export interface AutoLayoutInput {
  root: PaneLayout;
  isMedia: (leaf: PaneLeaf) => boolean;
}

let seq = 0;
function branchId(): string {
  seq += 1;
  return `auto-${seq}-${Math.random().toString(36).slice(2, 8)}`;
}

function node(
  dir: PaneDir,
  ratio: number,
  a: PaneLayout,
  b: PaneLayout,
): PaneLayout {
  return { type: "node", id: branchId(), dir, ratio, children: [a, b] };
}

function stack(dir: PaneDir, items: PaneLayout[]): PaneLayout {
  return items.reduce((acc, cur) => node(dir, 0.5, acc, cur));
}

/**
 * 一键自动布局：按栏数与各栏选中页签的文件类型重排 pane 树。
 * 媒体栏（图片/视频/PDF）优先放在面积更大的位置；页签归属与选中态原样搬运。
 */
export function autoLayoutPanes({
  root,
  isMedia,
}: AutoLayoutInput): PaneLayout {
  const leaves = listLeaves(root);
  if (leaves.length <= 1) return root;

  const media = leaves.filter((leaf) => isMedia(leaf));
  const docs = leaves.filter((leaf) => !isMedia(leaf));
  const ordered = [...media, ...docs];
  const n = ordered.length;
  const col = (items: PaneLayout[]) => stack("col", items);

  if (n === 2) {
    return node("row", media.length === 1 ? 0.62 : 0.5, ordered[0], ordered[1]);
  }
  if (n === 3) {
    return node("row", 0.5, ordered[0], col(ordered.slice(1)));
  }
  if (n === 4 || n === 5 || n === 6) {
    const splitAt = n === 4 ? 2 : 3;
    return node(
      "row",
      0.5,
      col(ordered.slice(0, splitAt)),
      col(ordered.slice(splitAt)),
    );
  }
  const cols: PaneLayout[] = [];
  for (let i = 0; i < n; i += 3) {
    const chunk = ordered.slice(i, i + 3);
    cols.push(chunk.length === 1 ? chunk[0] : col(chunk));
  }
  return cols.reduce((acc, cur) => node("row", 0.5, acc, cur));
}

/** 树里所有 leaf 的 id 集合，用于校验重排没有改变页签归属。 */
export function leafIds(root: PaneLayout): string[] {
  return listLeaves(root).map((leaf) => leaf.id);
}

export { isLeaf };
