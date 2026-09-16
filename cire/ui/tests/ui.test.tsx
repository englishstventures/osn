import { Field } from "@osn/ui/ui/field";
import "@testing-library/jest-dom/vitest";
// @vitest-environment happy-dom
import { cleanup, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vitest";

import Button from "../src/button";
import Card, { cardClass, CardEyebrow } from "../src/card";
import Loading from "../src/loading";
import { UsernameInput } from "../src/username-input";

/**
 * These are class-mapping components, and a test that asserts the classes is a
 * test that has to be edited every time the design moves — it pins the current
 * answer, not the contract. So what is checked here is what a call site can
 * rely on: that the variants differ from each other, that props reach the DOM,
 * and that the accessibility wiring is there.
 *
 * They came from `cire/host` and `cire/vendor`, which each had a copy. The
 * components they cover are the ones that stayed cire's — everything else the
 * two portals duplicated is in `@osn/ui` now, and so are its tests.
 */

afterEach(cleanup);

describe("Button", () => {
  it("does not submit the form it is standing in, unless told to", () => {
    // A toolbar control inside a settings form is the common case, and a button
    // with no type is a submit button.
    const { getByRole } = render(() => <Button>Export</Button>);
    expect(getByRole("button")).toHaveProperty("type", "button");
  });

  it("still takes a type when the caller means it", () => {
    const { getByRole } = render(() => <Button type="submit">Save</Button>);
    expect(getByRole("button")).toHaveProperty("type", "submit");
  });

  it("gives each variant a different look", () => {
    const { getByText } = render(() => (
      <>
        <Button variant="primary">Commit</Button>
        <Button variant="outline">Second</Button>
        <Button variant="quiet">Quiet</Button>
        <Button variant="danger">Delete</Button>
      </>
    ));
    const classes = ["Commit", "Second", "Quiet", "Delete"].map(
      (label) => getByText(label).className,
    );
    expect(new Set(classes).size).toBe(4);
  });

  it("gives each size a different look", () => {
    const { getByText } = render(() => (
      <>
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="icon">✕</Button>
      </>
    ));
    const classes = ["Small", "Medium", "✕"].map((label) => getByText(label).className);
    expect(new Set(classes).size).toBe(3);
  });

  it("keeps the caller's own classes", () => {
    const { getByRole } = render(() => <Button class="self-start">Add</Button>);
    expect(getByRole("button").className).toContain("self-start");
  });

  it("passes everything else through", () => {
    const { getByRole } = render(() => (
      <Button disabled aria-label="Remove guest">
        ✕
      </Button>
    ));
    expect(getByRole("button")).toBeDisabled();
    expect(getByRole("button")).toHaveAttribute("aria-label", "Remove guest");
  });
});

describe("Card", () => {
  it("renders its children in a plain box", () => {
    const { getByText } = render(() => (
      <Card>
        <CardEyebrow>Guests</CardEyebrow>
      </Card>
    ));
    expect(getByText("Guests")).toBeInTheDocument();
  });

  it("marks the accented card out from the ordinary one", () => {
    expect(cardClass({ tone: "accent" })).not.toBe(cardClass());
  });

  it("adds nothing for a card that is not a control", () => {
    // The hover treatment is a promise that the whole rectangle is clickable.
    expect(cardClass()).not.toContain("hover:");
    expect(cardClass({ interactive: true })).toContain("hover:");
  });
});

describe("UsernameInput", () => {
  it("shows a fixed @ ahead of the box", () => {
    const { getByText } = render(() => <UsernameInput aria-label="OSN handle" />);
    expect(getByText("@")).toBeInTheDocument();
  });

  it("names the control by the label alone — the @ isn't part of it", () => {
    const { getByRole } = render(() => <UsernameInput aria-label="OSN handle" />);
    expect(getByRole("textbox")).toHaveAccessibleName("OSN handle");
  });

  it("wires up Field the same as a plain Input", () => {
    // The combobox use in HostsPanel spreads Field's {...field} (id,
    // aria-describedby, aria-invalid) onto this component — same contract
    // Field already proves for Input above.
    const { getByRole } = render(() => (
      <Field label="OSN handle" errors={["No account with that handle."]}>
        {(field) => <UsernameInput {...field} />}
      </Field>
    ));
    const input = getByRole("textbox");
    expect(input).toHaveAccessibleName("OSN handle");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("passes everything else through to the input", () => {
    const { getByRole } = render(() => (
      <UsernameInput aria-label="OSN handle" placeholder="alice" disabled />
    ));
    const input = getByRole("textbox");
    expect(input).toHaveAttribute("placeholder", "alice");
    expect(input).toBeDisabled();
  });
});

describe("Loading", () => {
  it("announces itself without interrupting", () => {
    render(() => <Loading label="Loading enquiries…" />);
    const el = screen.getByRole("status");
    expect(el).toHaveTextContent("Loading enquiries…");
    // `status`, not `alert`: something starting to load is not urgent.
    expect(el).not.toHaveAttribute("role", "alert");
  });
});
