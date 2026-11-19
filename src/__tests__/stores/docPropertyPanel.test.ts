import { beforeEach, describe, expect, it } from "vitest";
import {
  hasExplicitDocPropertyChoice,
  normalizeDocPropertyVariant,
  useDocPropertyPanelStore,
} from "../../stores/docPropertyPanel";

describe("docPropertyVariant 全局偏好状态机", () => {
  beforeEach(() => {
    window.localStorage.removeItem("biaoyue.docPropertyVariant.explicit");
    useDocPropertyPanelStore.setState({
      preference: null,
      fallback: "A",
      narrow: false,
      variant: "A",
    });
  });

  it("归一化只接受 A / B", () => {
    expect(normalizeDocPropertyVariant("A")).toBe("A");
    expect(normalizeDocPropertyVariant("B")).toBe("B");
    expect(normalizeDocPropertyVariant("list")).toBeNull();
    expect(normalizeDocPropertyVariant(null)).toBeNull();
    expect(normalizeDocPropertyVariant(undefined)).toBeNull();
  });

  it("窄窗未手动选择时自动胶囊，宽窗回到配置默认", () => {
    useDocPropertyPanelStore.getState().applyLoadedPreference(null, "A");
    useDocPropertyPanelStore.getState().setNarrow(true);
    expect(useDocPropertyPanelStore.getState().variant).toBe("B");
    useDocPropertyPanelStore.getState().setNarrow(false);
    expect(useDocPropertyPanelStore.getState().variant).toBe("A");
    expect(useDocPropertyPanelStore.getState().preference).toBeNull();
  });

  it("手动切换后窄窗覆盖失效，且不因窗口变化回跳", () => {
    useDocPropertyPanelStore.getState().setVariant("A");
    useDocPropertyPanelStore.getState().setNarrow(true);
    expect(useDocPropertyPanelStore.getState().variant).toBe("A");
    useDocPropertyPanelStore.getState().setNarrow(false);
    expect(useDocPropertyPanelStore.getState().variant).toBe("A");
  });

  it("配置加载：有偏好用偏好，无偏好回落 displayStyle 映射", () => {
    useDocPropertyPanelStore.getState().setVariant("A");
    useDocPropertyPanelStore.getState().applyLoadedPreference("B", "A");
    expect(useDocPropertyPanelStore.getState().variant).toBe("B");
    useDocPropertyPanelStore.getState().applyLoadedPreference(null, "B");
    expect(useDocPropertyPanelStore.getState().variant).toBe("B");
    expect(useDocPropertyPanelStore.getState().preference).toBeNull();
  });

  it("#1147：无显式选择标记时，存储偏好不生效", () => {
    useDocPropertyPanelStore.getState().applyLoadedPreference("B", "A");
    expect(useDocPropertyPanelStore.getState().preference).toBeNull();
    expect(useDocPropertyPanelStore.getState().variant).toBe("A");
    useDocPropertyPanelStore.getState().setNarrow(true);
    expect(useDocPropertyPanelStore.getState().variant).toBe("B");
    expect(useDocPropertyPanelStore.getState().preference).toBeNull();
  });

  it("#1147：显式切换写入标记，后续加载承认存储偏好", () => {
    useDocPropertyPanelStore.getState().toggleVariant();
    expect(hasExplicitDocPropertyChoice()).toBe(true);
    useDocPropertyPanelStore.getState().applyLoadedPreference("B", "A");
    expect(useDocPropertyPanelStore.getState().variant).toBe("B");
  });

  it("窄窗启动：配置回填不把胶囊形态拉回默认", () => {
    useDocPropertyPanelStore.getState().setNarrow(true);
    useDocPropertyPanelStore.getState().applyLoadedPreference(null, "A");
    expect(useDocPropertyPanelStore.getState().variant).toBe("B");
    expect(useDocPropertyPanelStore.getState().preference).toBeNull();
  });

  it("非法形态值被拒绝且保持原状态", () => {
    useDocPropertyPanelStore.getState().setVariant("B");
    useDocPropertyPanelStore.getState().setVariant("stacked" as unknown as "A");
    expect(useDocPropertyPanelStore.getState().variant).toBe("B");
    expect(useDocPropertyPanelStore.getState().preference).toBe("B");
  });

  it("toggle 在 A / B 间切换并写偏好", () => {
    const store = useDocPropertyPanelStore.getState();
    store.toggleVariant();
    expect(useDocPropertyPanelStore.getState().variant).toBe("B");
    expect(useDocPropertyPanelStore.getState().preference).toBe("B");
    useDocPropertyPanelStore.getState().toggleVariant();
    expect(useDocPropertyPanelStore.getState().variant).toBe("A");
  });
});
