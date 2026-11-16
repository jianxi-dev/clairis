import { create } from "zustand";

interface SearchFloatState {
  /** 当前打开浮窗的窗格；null = 全部关闭。 */
  openPaneId: string | null;
  open: (paneId: string) => void;
  close: (paneId: string) => void;
  toggle: (paneId: string) => void;
}

/** 搜索浮窗开关（#981）：只记哪个窗格开着，位置与尺寸由面板组件自持。 */
export const useSearchFloatStore = create<SearchFloatState>((set) => ({
  openPaneId: null,
  open: (paneId) => set({ openPaneId: paneId }),
  close: (paneId) =>
    set((state) =>
      state.openPaneId === paneId ? { openPaneId: null } : state,
    ),
  toggle: (paneId) =>
    set((state) => ({
      openPaneId: state.openPaneId === paneId ? null : paneId,
    })),
}));
