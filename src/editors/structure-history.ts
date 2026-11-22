/* 结构命令的历史边界（design D5 / ADR 0012 三原则）。
 *
 * 结构命令（标题升降、列表缩进、智能回车、智能退格、块转换）是「一个意图、
 * 一次撤销」：每个命令的 dispatch 都带 userEvent: "app.structure" 与
 * isolateHistory.of("full")，自成一组。
 *
 * 绝不设 addToHistory: false——结构命令必须留在历史里，否则一次 ⌘Z 会
 * 跳过它、连带回退到更早的状态。
 */

import { isolateHistory } from "@codemirror/commands";
import type { Annotation, TransactionSpec } from "@codemirror/state";

/** 结构命令的统一 userEvent 名。 */
export const STRUCTURE_USER_EVENT = "app.structure";

/**
 * 给事务 spec 附加结构命令注解：`userEvent: "app.structure"` 与
 * `isolateHistory.of("full")`（每个结构意图自成一组）。
 *
 * 已存在的 annotations 原样保留并追加隔离注解，支持缺失 / 单个 / 数组三种形态。
 */
export function structureTransaction(spec: TransactionSpec): TransactionSpec {
  const isolate = isolateHistory.of("full");
  const annotations = spec.annotations;
  const merged: readonly Annotation<any>[] =
    annotations == null
      ? [isolate]
      : Array.isArray(annotations)
        ? [...annotations, isolate]
        : [annotations, isolate];
  return { ...spec, userEvent: STRUCTURE_USER_EVENT, annotations: merged };
}
