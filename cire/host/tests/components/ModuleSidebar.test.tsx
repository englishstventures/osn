// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ModuleSidebar from "../../src/components/ModuleSidebar";
import { MODULE_NAV } from "../../src/lib/module-nav";

/** Every gated entitlement, so the nav's structural tests are about the nav
 *  rather than about the lock. The locked shape has its own describe below. */
const ENTITLED = ["vendors", "registry"];

/**
 * ModuleSidebar is the IA shell's primary nav — a keyboard-accessible <nav> of
 * module buttons with aria-current on the active one. It's presentational: it
 * renders every module and reports selections up. Write gating lives inside
 * each module; entitlement gating fades the row and offers an upgrade rather
 * than hiding it.
 */
describe("ModuleSidebar", () => {
  afterEach(() => cleanup());

  /** The persistent rail. Both surfaces sit in the DOM — the container query
   *  hides one with `display: none`, which happy-dom doesn't apply — so module
   *  queries are scoped to the rail landmark rather than the document.
   *
   *  Both navs legitimately carry the same accessible name (only one is ever
   *  rendered to a real user), so the rail is picked as the one *outside* the
   *  dialog rather than by name alone — otherwise this helper would start
   *  throwing the moment a test queried it with the sheet open. */
  const rail = () => {
    const navs = screen.getAllByRole("navigation", { name: /Wedding modules/i });
    const found = navs.find((nav) => !nav.closest('[role="dialog"]'));
    if (!found) throw new Error("no module rail outside the sheet");
    return found;
  };

  it("renders every module in workflow order", () => {
    render(() => <ModuleSidebar active="overview" entitlements={ENTITLED} onSelect={vi.fn()} />);
    const labels = within(rail())
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(labels).toEqual([
      "◈Overview",
      "◇Events",
      "✓Checklist",
      "$Budget",
      "⬡Vendors",
      "⊞Registry",
      "✎Guests",
      "✦Invite",
      "✧Settings",
    ]);
  });

  it("marks the active module with aria-current and no others", () => {
    render(() => <ModuleSidebar active="invite" entitlements={ENTITLED} onSelect={vi.fn()} />);
    const marked = within(rail())
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-current") === "page");
    expect(marked).toHaveLength(1);
    expect(marked[0]!.textContent).toContain("Invite");
  });

  it("opens a sheet listing every module and closes it on a selection", async () => {
    const onSelect = vi.fn();
    render(() => <ModuleSidebar active="overview" entitlements={ENTITLED} onSelect={onSelect} />);

    // The narrow-container surface: a trigger naming the current module, so a
    // guest never has to open the sheet to know where they are.
    const trigger = screen.getByRole("button", { name: /Modules/ });
    expect(trigger.textContent).toContain("Overview");
    fireEvent.click(trigger);

    const sheet = await screen.findByRole("dialog", { name: /Wedding modules/i });
    const sheetLabels = within(sheet)
      .getAllByRole("button")
      // Drop the close button; keep the module rows.
      .filter((b) => b.getAttribute("aria-label") !== "Close modules")
      .map((b) => b.textContent);
    expect(sheetLabels).toHaveLength(MODULE_NAV.length);
    expect(sheetLabels[0]).toContain("Overview");
    // Every module reachable in one screen — the point of replacing the strip.
    expect(sheetLabels.some((l) => l?.includes("Settings"))).toBe(true);

    fireEvent.click(within(sheet).getByRole("button", { name: /Budget/ }));
    expect(onSelect).toHaveBeenCalledWith("budget");
    // Picking a module dismisses the sheet rather than leaving it over the panel.
    // Asserted on the trigger's expanded state, not on unmount: Kobalte defers the
    // removal until the exit keyframe ends, and happy-dom applies no stylesheet, so
    // the node lingers here in a way it never would in a browser.
    await waitFor(() => expect(trigger.getAttribute("aria-expanded")).toBe("false"));
  });

  it("reports the selected module up via onSelect", () => {
    const onSelect = vi.fn();
    render(() => <ModuleSidebar active="overview" entitlements={ENTITLED} onSelect={onSelect} />);
    fireEvent.click(within(rail()).getByRole("button", { name: /Settings/ }));
    expect(onSelect).toHaveBeenCalledWith("settings");
  });

  it("is a labelled navigation landmark", () => {
    render(() => <ModuleSidebar active="overview" entitlements={ENTITLED} onSelect={vi.fn()} />);
    expect(rail().tagName).toBe("NAV");
    expect(rail().getAttribute("aria-label")).toBe("Wedding modules");
  });

  /**
   * A module the wedding is not entitled to.
   *
   * The row stays in the nav, faded and inert, and offers the upgrade three
   * ways: a three-second pointer dwell, the same delay on keyboard focus, and a
   * click — which is the only path a touch user has, because Kobalte's hover
   * card ignores touch pointers outright.
   */
  describe("a locked module", () => {
    /** Kobalte's popper is floating-ui, which observes its reference and
     *  floating elements. happy-dom ships no `ResizeObserver`, so the card
     *  would throw on open without one; it runs no layout either, so the stub
     *  reports nothing and the card's placement is not what these tests
     *  check. */
    class NoopResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    beforeEach(() => {
      vi.stubGlobal("ResizeObserver", NoopResizeObserver);
    });

    afterEach(() => {
      // Restore the clock even for the tests that never faked it: a leaked fake
      // clock hangs the `findByRole`/`waitFor` in the sheet test above.
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    const lockedRow = () => within(rail()).getByRole("button", { name: /Registry/ });

    it("fades the row, marks it aria-disabled and drops its native tooltip", () => {
      render(() => <ModuleSidebar active="overview" entitlements={[]} onSelect={vi.fn()} />);
      const row = lockedRow();
      expect(row.getAttribute("aria-disabled")).toBe("true");
      // `aria-disabled` and not `disabled`: Kobalte's trigger drops its pointer
      // and focus handlers on a disabled trigger, so the card could never open.
      expect(row.hasAttribute("disabled")).toBe(false);
      expect(row.getAttribute("class")).toContain("opacity-50");
      // No `title`: a native tooltip fires well inside the dwell and would race
      // the popover.
      expect(row.hasAttribute("title")).toBe(false);
      expect(row.getAttribute("aria-label")).toBe("Registry — locked. Upgrade to unlock.");
    });

    it("navigates nowhere when clicked, and offers the upgrade instead", async () => {
      const onSelect = vi.fn();
      render(() => <ModuleSidebar active="overview" entitlements={[]} onSelect={onSelect} />);
      fireEvent.click(lockedRow());
      expect(onSelect).not.toHaveBeenCalled();
      // The tap path: the same click that does not navigate opens the offer.
      expect(await screen.findByText("Gift registry")).toBeTruthy();
      expect(screen.getByText(/List the gifts you'd like/)).toBeTruthy();
    });

    it("opens nothing until the pointer has rested for three seconds", async () => {
      vi.useFakeTimers();
      render(() => <ModuleSidebar active="overview" entitlements={[]} onSelect={vi.fn()} />);
      fireEvent.pointerEnter(lockedRow(), { pointerType: "mouse" });

      // Well past Kobalte's own 700ms default, so this asserts the override took
      // rather than merely that some delay exists.
      await vi.advanceTimersByTimeAsync(2900);
      expect(screen.queryByText("Gift registry")).toBeNull();

      await vi.advanceTimersByTimeAsync(200);
      expect(screen.getByText("Gift registry")).toBeTruthy();
    });

    it("offers an Upgrade button that does nothing", async () => {
      render(() => <ModuleSidebar active="overview" entitlements={[]} onSelect={vi.fn()} />);
      fireEvent.click(lockedRow());
      await screen.findByText("Gift registry");
      // Not `/Upgrade/` alone: the locked row's own accessible name says
      // "Upgrade to unlock", so that pattern matches the trigger too.
      const upgrade = screen.getByRole("button", { name: /coming soon/i });
      expect((upgrade as HTMLButtonElement).disabled).toBe(true);
    });

    it("locks only the modules whose entitlement is missing", () => {
      render(() => (
        <ModuleSidebar active="overview" entitlements={["registry"]} onSelect={vi.fn()} />
      ));
      const locked = within(rail())
        .getAllByRole("button")
        .filter((b) => b.getAttribute("aria-disabled") === "true")
        .map((b) => b.textContent);
      expect(locked).toEqual(["⬡Vendors"]);
    });
  });
});
