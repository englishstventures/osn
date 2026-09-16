/**
 * `Modal` is built on `<dialog>` + `showModal()`, and essentially everything
 * that makes that worth choosing is invisible to a DOM shim: the top layer, the
 * focus trap, background inertness, `::backdrop`, Escape handling. A happy-dom
 * assertion that the element exists would pass against a `<div>` with the same
 * class list.
 *
 * So these run in real Chromium, and they test the platform behaviour this
 * component exists to borrow rather than the markup it emits.
 */

import { render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { describe, expect, it } from "vitest";

import { Modal } from "../../src/components/ui/modal";

/**
 * Mount a modal whose `open` is driven by a signal, as a caller's would be, and
 * hand back THAT dialog rather than whichever one `document.querySelector`
 * reaches first.
 *
 * The distinction is not pedantry: a `showModal()` dialog is in the top layer,
 * so it is not removed by an `afterEach` that only empties the render container,
 * and a document-wide lookup silently returns the first survivor from an earlier
 * test. Five assertions here failed that way before the query was scoped —
 * every one of them reporting a fault in the component rather than in the test.
 */
function mount(props: { dismissable?: boolean } = {}) {
  const [open, setOpen] = createSignal(true);
  const result = render(() => (
    <Modal open={open()} onClose={() => setOpen(false)} label="Test dialog" {...props}>
      <button type="button">inside</button>
    </Modal>
  ));
  const el = result.container.querySelector("dialog");
  if (!el) throw new Error("no dialog rendered");
  return { ...result, open, setOpen, dialog: () => el };
}

describe("Modal", () => {
  it("opens modally rather than as an inline dialog", () => {
    // `open` alone means a non-modal dialog: no top layer, no focus trap, no
    // inert background. `matches(":modal")` is the only way to tell the two
    // apart, and it is the whole reason for using this element.
    const { dialog } = mount();
    expect(dialog().open).toBe(true);
    expect(dialog().matches(":modal")).toBe(true);
  });

  it("makes the page behind it inert", () => {
    // The platform's doing, not ours — but if the dialog were ever opened with
    // `show()` instead of `showModal()` this is what would silently regress,
    // and a user would find it by clicking a button that does nothing.
    const outside = document.createElement("button");
    outside.textContent = "outside";
    document.body.append(outside);

    mount();
    let clicked = false;
    outside.addEventListener("click", () => (clicked = true));
    outside.click();

    // `.click()` dispatches directly and bypasses hit-testing, so inertness
    // shows up as the element being unreachable rather than as a swallowed
    // event: nothing outside the dialog can hold focus while it is open.
    outside.focus();
    expect(document.activeElement).not.toBe(outside);
    expect(clicked).toBe(true);

    outside.remove();
  });

  it("moves focus into the dialog when it opens", () => {
    const { getByText, dialog } = mount();
    expect(dialog().contains(document.activeElement)).toBe(true);
    expect(getByText("inside")).toBeTruthy();
  });

  it("tells the caller when the element closes itself, so `open` cannot desync", async () => {
    // The failure this guards: the dialog closes on Escape whether or not
    // anyone is listening. A caller that only clears `open` in its own button
    // handler is then left with `open === true` against a closed dialog, and
    // the next attempt to open does nothing at all.
    //
    // Two things this test had to learn the hard way. A *synthetic* Escape
    // keydown does not close a dialog — dispatched events do not run the UA's
    // default action — so `close()` stands in for it; that is the same code
    // path Escape reaches, and the assertion is about what the component does
    // once the element has closed. And `close` is fired in a queued task, not
    // synchronously, so the assertion has to yield first. Read synchronously it
    // reports a desync that is not there.
    const { open, dialog } = mount();
    dialog().close();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(open()).toBe(false);
  });

  it("reopens after closing, rather than throwing", () => {
    // `showModal()` on an already-open dialog throws `InvalidStateError`, so the
    // effect is guarded on the element's own state. This is the round trip that
    // would surface a wrong guard.
    const { setOpen, dialog } = mount();
    setOpen(false);
    expect(dialog().open).toBe(false);
    setOpen(true);
    expect(dialog().matches(":modal")).toBe(true);
  });

  it("closes when the backdrop is clicked, but not when its own padding is", () => {
    const { open, dialog } = mount();
    const box = dialog().getBoundingClientRect();

    // Inside the dialog's box, on its padding — a click that targets the dialog
    // element itself but is not the backdrop. The naive `target === currentTarget`
    // check closes here, which loses a user's work every time they miss a
    // control by a few pixels.
    dialog().dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        clientX: Math.round(box.left + 4),
        clientY: Math.round(box.top + 4),
      }),
    );
    expect(open()).toBe(true);

    // Outside the box: the backdrop.
    dialog().dispatchEvent(
      new MouseEvent("click", { bubbles: true, clientX: Math.round(box.left - 20), clientY: 10 }),
    );
    expect(open()).toBe(false);
  });

  it("ignores backdrop clicks when `dismissable` is false", () => {
    const { open, dialog } = mount({ dismissable: false });
    dialog().dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 2, clientY: 2 }));
    expect(open()).toBe(true);
  });

  it("paints a backdrop, through the `::backdrop` rule it injects", () => {
    const { dialog } = mount();
    const backdrop = getComputedStyle(dialog(), "::backdrop").backgroundColor;
    expect(backdrop).not.toBe("");
    expect(backdrop).not.toBe("rgba(0, 0, 0, 0)");
  });

  it("carries an accessible name", () => {
    const { dialog } = mount();
    expect(dialog().getAttribute("aria-label")).toBe("Test dialog");
  });

  it("prefers `labelledBy` over `label`, so a visible heading cannot drift from it", () => {
    const { container } = render(() => (
      <>
        <h2 id="title">Delete profile</h2>
        <Modal open onClose={() => {}} label="ignored" labelledBy="title">
          body
        </Modal>
      </>
    ));
    const el = container.querySelector("dialog");
    expect(el?.getAttribute("aria-labelledby")).toBe("title");
    expect(el?.getAttribute("aria-label")).toBeNull();
  });

  it("needs no z-index, because the top layer is above every stacking context", () => {
    // The reason this component exists in the form it does. Nine hand-rolled
    // overlays in this repository are `position: fixed` in a portal, each one
    // an animated ancestor away from being trapped in a stacking context it
    // cannot escape — the bug that put cire's RSVP toast under the sheet it
    // fired beneath. A top-layer dialog cannot be captured that way.
    const trap = document.createElement("div");
    trap.style.transform = "translateZ(0)";
    trap.style.zIndex = "2147483647";
    trap.style.position = "relative";
    document.body.append(trap);

    render(
      () => (
        <Modal open onClose={() => {}} label="Trapped?">
          body
        </Modal>
      ),
      { container: trap },
    );

    const el = trap.querySelector("dialog") as HTMLDialogElement;
    expect(el.matches(":modal")).toBe(true);
    expect(getComputedStyle(el).zIndex).toBe("auto");

    // Rendered inside a transformed, stacking-context-creating ancestor and
    // still the topmost thing at its own centre.
    const box = el.getBoundingClientRect();
    const top = document.elementFromPoint(
      Math.round(box.left + box.width / 2),
      Math.round(box.top + box.height / 2),
    );
    expect(el.contains(top)).toBe(true);

    trap.remove();
  });
});
