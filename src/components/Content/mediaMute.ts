type Listener = (muted: boolean) => void;

let muted = false;
const listeners = new Set<Listener>();

export function isMediaMuted(): boolean {
  return muted;
}

export function setMediaMuted(next: boolean): void {
  if (next === muted) return;
  muted = next;
  listeners.forEach((fn) => fn(muted));
}

export function toggleMediaMuted(): void {
  setMediaMuted(!muted);
}

export function subscribeMediaMute(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
