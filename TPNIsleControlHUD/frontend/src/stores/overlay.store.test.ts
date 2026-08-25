import { beforeEach, describe, expect, it } from "vitest";
import { useOverlayStore } from "./overlay.store";

describe("overlay panel state", () => {
  beforeEach(() => {
    useOverlayStore.setState({ interactive: false, panel: "none", expandedMinimapOpen: false });
  });

  it("opens quests and the expanded minimap independently", () => {
    const store = useOverlayStore.getState();

    store.setInteractive(true);
    expect(useOverlayStore.getState()).toMatchObject({ panel: "quests", expandedMinimapOpen: false });

    useOverlayStore.getState().openPanel("minimap");
    expect(useOverlayStore.getState()).toMatchObject({ panel: "none", expandedMinimapOpen: true });

    useOverlayStore.getState().openPanel("quests");
    expect(useOverlayStore.getState()).toMatchObject({ panel: "quests", expandedMinimapOpen: true });
  });

  it("closes both panels when interactive mode ends", () => {
    useOverlayStore.setState({ interactive: true, panel: "quests", expandedMinimapOpen: true });
    useOverlayStore.getState().setInteractive(false);
    expect(useOverlayStore.getState()).toMatchObject({ interactive: false, panel: "none", expandedMinimapOpen: false });
  });
});
