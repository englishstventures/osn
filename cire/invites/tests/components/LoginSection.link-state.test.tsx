// @vitest-environment jsdom
import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, expect, it, vi } from "vitest";

import { LoginSection } from "../../src/components/LoginSection";
import type { ClaimResult } from "../../src/components/types";

/**
 * The account-link box sits above the events. If it appeared a request after
 * the invite opened, it would push events already on screen down the page —
 * on every session restore, where the welcome and the events arrive together.
 *
 * So it must draw from the claim payload alone. The real panel and the real
 * account link render here, with every network request held unanswered: the
 * box still appears, and nothing is even asked. Only the lazy chunk stands
 * between the payload and the box, and that download starts as the claim or
 * restore begins (LoginSection.lazy.test.tsx, LoginSection.warm.test.tsx).
 */

const household: ClaimResult = {
  publicId: "OKAFOR-LILY-AB12CD",
  familyName: "Okafor",
  members: [
    { guestId: "g-chidi", firstName: "Chidi", lastName: "Okafor", nickname: null, eventIds: [] },
    { guestId: "g-ada", firstName: "Ada", lastName: "Okafor", nickname: null, eventIds: [] },
  ],
  events: [],
  rsvps: [],
  accountLink: { enabled: true, signedIn: true, linkedGuestIds: ["g-ada"] },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("draws the account link from the claim payload, with no request to wait on", async () => {
  const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
  vi.stubGlobal("fetch", fetchMock);

  const view = render(() => (
    <LoginSection apiUrl="https://api.test" result={household} onClaimed={() => {}} />
  ));

  await view.findByText("Link your Pulse account", {}, { timeout: 3000 });
  // Drawn in the payload's state: signed in, Ada's seat already linked.
  expect(view.getByText("Which guest are you?")).toBeTruthy();
  expect(view.getAllByText("✓ Linked")).toHaveLength(1);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("draws the sign-in control, not the picker, when the payload says signed out", async () => {
  const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
  vi.stubGlobal("fetch", fetchMock);

  const view = render(() => (
    <LoginSection
      apiUrl="https://api.test"
      result={{ ...household, accountLink: { enabled: true, signedIn: false, linkedGuestIds: [] } }}
      onClaimed={() => {}}
    />
  ));

  await view.findByRole("button", { name: "Sign in with musubi" }, { timeout: 3000 });
  expect(view.queryByText("Which guest are you?")).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});
