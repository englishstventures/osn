// @vitest-environment happy-dom
import { render, cleanup, fireEvent, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InfoPopover } from "../../../src/components/ui/info-popover";

describe("InfoPopover", () => {
  afterEach(() => cleanup());

  it("renders the trigger button with '?' text", () => {
    render(() => <InfoPopover body="Some help text" />);
    const trigger = screen.getByLabelText("More info");
    expect(trigger).toBeTruthy();
    expect(trigger.textContent).toBe("?");
  });

  it("renders a caller-chosen glyph instead of the default", () => {
    render(() => <InfoPopover body="Help" glyph="i" />);
    expect(screen.getByLabelText("More info").textContent).toBe("i");
  });

  it("uses custom label for aria-label when provided", () => {
    render(() => <InfoPopover label="About visibility" body="Help" />);
    expect(screen.getByLabelText("About visibility")).toBeTruthy();
  });

  it("shows body text when trigger is clicked", async () => {
    render(() => <InfoPopover body="Detailed explanation here" />);
    // Body should not be visible initially (Kobalte Popover is closed by default)
    expect(screen.queryByText("Detailed explanation here")).toBeNull();

    fireEvent.click(screen.getByLabelText("More info"));

    // Kobalte Popover portals content to document.body — use screen
    expect(await screen.findByText("Detailed explanation here")).toBeTruthy();
  });

  it("hides body text when trigger is clicked again (toggle)", async () => {
    render(() => <InfoPopover body="Toggle me" />);
    const trigger = screen.getByLabelText("More info");

    fireEvent.click(trigger);
    expect(await screen.findByText("Toggle me")).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(trigger);

    // The panel outlives the close: Kobalte keeps it mounted for its exit
    // animation, and no animation runs here to end it. So dismissal is read
    // from the disclosure state on both elements rather than from the panel
    // disappearing — `data-expanded` must be gone and `data-closed` present.
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    const panel = screen.getByText("Toggle me");
    expect(panel.hasAttribute("data-expanded")).toBe(false);
    expect(panel.hasAttribute("data-closed")).toBe(true);
  });

  it("dismisses on Escape key", async () => {
    render(() => <InfoPopover body="Press Escape" />);
    const trigger = screen.getByLabelText("More info");

    fireEvent.click(trigger);
    expect(await screen.findByText("Press Escape")).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(trigger.getAttribute("aria-expanded")).toBe("false"));
    const panel = screen.getByText("Press Escape");
    expect(panel.hasAttribute("data-expanded")).toBe(false);
    expect(panel.hasAttribute("data-closed")).toBe(true);
  });

  it("renders a real button whose type is 'button'", () => {
    render(() => <InfoPopover body="Help" />);
    const trigger = screen.getByLabelText("More info");
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.getAttribute("type")).toBe("button");
  });

  it("is reachable by keyboard: enabled and left in the natural tab order", () => {
    render(() => <InfoPopover body="Help" />);
    const trigger = screen.getByLabelText("More info") as HTMLButtonElement;
    // happy-dom activates a button on click alone — it implements no Enter or
    // Space activation — so the keyboard path is asserted through the
    // properties the platform uses to provide it.
    expect(trigger.disabled).toBe(false);
    expect(trigger.getAttribute("tabindex")).toBeNull();
  });

  it("does not submit the form it sits inside", async () => {
    const onSubmit = vi.fn((e: Event) => e.preventDefault());
    render(() => (
      <form onSubmit={onSubmit}>
        <InfoPopover body="Help inside a form" />
        <button type="submit">Save</button>
      </form>
    ));

    fireEvent.click(screen.getByLabelText("More info"));
    expect(await screen.findByText("Help inside a form")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();

    // Positive control: the same harness has to be able to see a submit, or
    // the assertion above would pass in an environment that dispatches none.
    fireEvent.click(screen.getByText("Save"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
