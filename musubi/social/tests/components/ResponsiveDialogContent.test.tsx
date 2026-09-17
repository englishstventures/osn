// @vitest-environment happy-dom
import { Dialog } from "@shared/ui/ui/dialog";
import { cleanup, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vitest";

import { ResponsiveDialogContent } from "../../src/components/ResponsiveDialogContent";

afterEach(() => {
  cleanup();
});

/** Every app dialog routes through this component; its bottom-sheet face is
 *  pure classes, so the contract is locked with class assertions (same
 *  pattern as MobileNav.test.tsx's shell test). */
describe("<ResponsiveDialogContent /> — sheet-class contract", () => {
  it("carries the mobile bottom-sheet tokens, and inherits the desktop card radius", () => {
    render(() => (
      <Dialog open onOpenChange={() => {}}>
        <ResponsiveDialogContent>
          <p>sheet body</p>
        </ResponsiveDialogContent>
      </Dialog>
    ));
    const content = screen.getByText("sheet body").closest("[role=dialog]") as HTMLElement;
    expect(content).not.toBeNull();
    // `rounded-ui-lg` rather than `rounded-card`: App.css maps
    // `--ui-radius-lg: var(--radius-card)`, so `DialogContent`'s own default
    // already resolves to musubi's 16px card radius and the wrapper does not
    // need to restate it. Asserting the contract class is what keeps that
    // true — if the mapping is ever dropped, this is the test that notices.
    for (const token of [
      "rounded-ui-lg",
      "max-md:bottom-0",
      "max-md:top-auto",
      "max-md:max-w-none",
      "max-md:max-h-[85dvh]",
      "max-md:overflow-y-auto",
      "max-md:rounded-b-none",
      "max-md:pb-safe",
    ]) {
      expect(content.className).toContain(token);
    }
  });

  it("appends caller classes after the sheet defaults so they win merges", () => {
    render(() => (
      <Dialog open onOpenChange={() => {}}>
        <ResponsiveDialogContent class="max-w-sm p-0">
          <p>sheet body</p>
        </ResponsiveDialogContent>
      </Dialog>
    ));
    const content = screen.getByText("sheet body").closest("[role=dialog]") as HTMLElement;
    const cls = content.className;
    expect(cls.indexOf("max-w-sm")).toBeGreaterThan(cls.indexOf("max-md:bottom-0"));
    expect(cls).toContain("p-0");
  });
});
