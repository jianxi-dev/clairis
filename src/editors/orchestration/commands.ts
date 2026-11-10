import type { EditorView } from "@codemirror/view";

export interface CommandContext {
  view: EditorView;
}

export type CommandFn = (ctx: CommandContext) => void;

const registry = new Map<string, CommandFn>();

export function registerCommand(id: string, fn: CommandFn): void {
  registry.set(id, fn);
}

export function hasCommand(id: string): boolean {
  return registry.has(id);
}

export function executeCommand(id: string, ctx: CommandContext): boolean {
  const fn = registry.get(id);
  if (!fn) return false;
  fn(ctx);
  return true;
}

export function listCommandIds(): string[] {
  return Array.from(registry.keys());
}

export function clearCommands(): void {
  registry.clear();
}
