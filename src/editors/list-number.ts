/* 列表行模型与有序编号计算（design D5 / 7.2）。
 *
 * 行分类（`classifyListLine`）与装饰共用这一份规则，编号与显示不会各自漂移；
 * `decorations/list.ts` 再导出这些符号，既有导入路径不变。
 *
 * 编号规则：同深度连续段内从 1 起递增；空行不打断；非空且非有序的行打断该深度
 * 及更深的连续段；更深的行是子列表，不打断外层连续段（嵌套独立计数）。
 */
import {
  EditorState,
  type Extension,
  type Text,
  type Transaction,
} from "@codemirror/state";
import { fencedCodeRanges } from "./decorations/code";
import { STRUCTURE_USER_EVENT } from "./structure-history";

const blockquotePrefixRegex = /^(?:>[ \t]?)+/;
export const unorderedListRegex = /^[-*+]\s/;
export const orderedListRegex = /^\d+\.\s/;
export const taskListRegex = /^- \[([ xX])\]\s/;

/** 一行的列表种类，以及标记占用的偏移。 */
export interface ListLineInfo {
  kind: "task" | "unordered" | "ordered" | "plain";
  /** 行首引用前缀（`> `）长度，没有则为 0。 */
  prefixLen: number;
  /** 前缀之后的行首缩进长度（嵌套层级用）。 */
  indentLen: number;
  /** 嵌套深度 0–6（两空格一层）。 */
  depth: number;
  /** 缩进之后的标记长度（`- `、`1. `、`- [x] `），普通行为 0。 */
  markerLen: number;
  /** 任务行：复选框是否勾选。 */
  checked: boolean;
}

/**
 * 把一行源码归类为列表项，容忍引用前缀。
 *
 * 装饰与高亮块正文渲染共用这一份规则，引用里（或高亮块 widget 里）的列表
 * 因此与顶层列表行为一致，不会各自漂移。
 */
export function classifyListLine(line: string): ListLineInfo {
  const prefixLen = line.match(blockquotePrefixRegex)?.[0].length ?? 0;
  const afterPrefix = line.slice(prefixLen);
  const indentLen = afterPrefix.match(/^[ \t]*/)?.[0].length ?? 0;
  const depth = Math.min(6, Math.floor(indentLen / 2));
  const body = afterPrefix.slice(indentLen);

  const base = { prefixLen, indentLen, depth, checked: false };

  const task = taskListRegex.exec(body);
  if (task) {
    return {
      ...base,
      kind: "task",
      markerLen: task[0].length,
      checked: task[1].toLowerCase() === "x",
    };
  }
  const unordered = unorderedListRegex.exec(body);
  if (unordered) {
    return { ...base, kind: "unordered", markerLen: unordered[0].length };
  }
  const ordered = orderedListRegex.exec(body);
  if (ordered) {
    return { ...base, kind: "ordered", markerLen: ordered[0].length };
  }
  return { ...base, kind: "plain", markerLen: 0 };
}

/** 一个有序项的计算序号与字面量位置。 */
export interface OrderedNumberEntry {
  /** 1 基行号。 */
  line: number;
  /** 行首绝对偏移。 */
  lineStart: number;
  /** 计算序号（同深度连续段内 1 起）。 */
  number: number;
  /** 数字字面量起始绝对偏移（点之前）。 */
  literalFrom: number;
  /** 数字字面量结束绝对偏移。 */
  literalTo: number;
  /** 嵌套深度。 */
  depth: number;
}

const COUNTERS = 7;

/**
 * 计算每行有序项的期望序号。
 *
 * @param lines 全文按行拆分。
 * @param isSkipped 返回 true 的行不参与编号（如围栏代码块）。
 */
export function computeOrderedNumbers(
  lines: readonly string[],
  isSkipped?: (lineStart: number) => boolean,
): OrderedNumberEntry[] {
  const entries: OrderedNumberEntry[] = [];
  const counters = new Array<number>(COUNTERS).fill(0);
  let pos = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineStart = pos;
    pos += line.length + 1;
    if (isSkipped?.(lineStart)) continue;
    if (line.trim() === "") continue;
    const info = classifyListLine(line);
    if (info.kind === "ordered" && info.markerLen > 0) {
      counters[info.depth] += 1;
      for (let depth = info.depth + 1; depth < COUNTERS; depth += 1) {
        counters[depth] = 0;
      }
      const markerFrom = lineStart + info.prefixLen + info.indentLen;
      const digits =
        /^\d+/.exec(line.slice(info.prefixLen + info.indentLen))?.[0] ?? "";
      entries.push({
        line: index + 1,
        lineStart,
        number: counters[info.depth],
        literalFrom: markerFrom,
        literalTo: markerFrom + digits.length,
        depth: info.depth,
      });
    } else {
      for (let depth = info.depth; depth < COUNTERS; depth += 1) {
        counters[depth] = 0;
      }
    }
  }
  return entries;
}

/** 需要改写的有序编号字面量。 */
export interface LiteralChange {
  from: number;
  to: number;
  insert: string;
}

/**
 * 返回把源码有序编号字面量改成计算序号所需的变更（无差异返回空数组）。
 *
 * 只处理有序列表行；围栏代码块内的 `1. ` 不参与，非列表数字文本不受影响。
 */
export function orderedLiteralChanges(doc: Text): LiteralChange[] {
  const text = doc.toString();
  const fences = fencedCodeRanges(text);
  const isSkipped = (pos: number): boolean =>
    fences.some((range) => pos >= range.from && pos <= range.to);
  const entries = computeOrderedNumbers(text.split("\n"), isSkipped);
  const changes: LiteralChange[] = [];
  for (const entry of entries) {
    const actual = text.slice(entry.literalFrom, entry.literalTo);
    const desired = String(entry.number);
    if (actual !== desired) {
      changes.push({
        from: entry.literalFrom,
        to: entry.literalTo,
        insert: desired,
      });
    }
  }
  return changes;
}

/**
 * 判断本次事务是否需要同步有序编号字面量（性能门）。
 *
 * 普通逐字键入（`input.type`）且行数不变时返回 false：显示序号由装饰实时
 * 计算，源码字面量留到下一次结构变化（回车 / 删除行 / 缩进 / 转换）时再对齐，
 * 避免每键一次 O(文档) 的全量扫描。行数变化、结构命令、删除路径与程序化
 * 变更仍然同步，保证源码字面量不会长期偏离显示值。
 */
export function shouldSyncOrderedNumbers(tr: Transaction): boolean {
  if (!tr.docChanged) return false;
  if (tr.newDoc.lines !== tr.startState.doc.lines) return true;
  if (tr.isUserEvent(STRUCTURE_USER_EVENT)) return true;
  if (tr.isUserEvent("delete")) return true;
  return !tr.isUserEvent("input.type");
}

/**
 * 把编号字面量同步并入产生结构变化的同一事务（undo 一步）。
 *
 * 用 `transactionFilter` 返回合并后的新事务，而非「监听 docChanged 再 dispatch」：
 * 后者会多出一笔历史，一次 ⌘Z 只回退编号、结构变化留在原地。原事务作为首个
 * spec 传入（运行时带 annotations），编号变更以 `sequential` 追加，CM6 会把
 * 两者 compose 成同一事务，历史与选区映射都按一步处理。
 */
export function orderedNumberSync(): Extension {
  return EditorState.transactionFilter.of((tr) => {
    if (!shouldSyncOrderedNumbers(tr)) return tr;
    const changes = orderedLiteralChanges(tr.newDoc);
    if (changes.length === 0) return tr;
    return tr.startState.update(tr, {
      changes,
      sequential: true,
      filter: false,
    });
  });
}
