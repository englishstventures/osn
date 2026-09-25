// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * `EventsEditor.grip.browser.test.tsx` measures a grip — `Button variant="bare"
 * size="icon"` with exactly these classes, inside a narrow flex row beside a
 * greedy sibling — against WCAG 2.2 SC 2.5.8's 24px floor. The gift list, the
 * checklist and the budget draw their grip through `ReorderControls`, so that
 * measurement covers them only while this file renders the same button with the
 * same classes. This pins it.
 */
describe("ReorderControls", () => {
  it("draws the grip the browser tier measures", () => {
    const source = readFileSync(
      join(import.meta.dirname, "..", "..", "src", "components", "ReorderControls.tsx"),
      "utf8",
    );
    expect(source).toContain('variant="bare"');
    expect(source).toContain('size="icon"');
    expect(source).toContain('class="cursor-grab touch-none active:cursor-grabbing"');
  });
});
