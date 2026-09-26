import { cleanup, render, waitFor } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ClaimResult } from "../../src/components/types";

/**
 * The account-link panel and the OSN auth client stay out of the invite's
 * first download: most households never link an account, so every invite
 * would otherwise pay for code only a few use.
 *
 * Each mock factory counts how often its module is EVALUATED. A static import
 * anywhere in LoginSection's graph evaluates it the moment LoginSection loads;
 * a `lazy()` import evaluates it only when the panel first renders it.
 *
 * The cases run in order in one module registry, and the counts only ever
 * rise, so each case proves its own step: nothing on import, nothing for an
 * unclaimed visitor, nothing for a host preview, then both on a real claim.
 */
const loads = vi.hoisted(() => ({ pulse: 0, auth: 0, authCore: 0 }));

vi.mock("../../src/components/PulseAccountLink", () => {
  loads.pulse++;
  return { PulseAccountLink: () => <div data-testid="pulse-account-link-stub" /> };
});

vi.mock("@shared/rp-auth/solid", () => {
  loads.auth++;
  return { AuthProvider: (props: { children: unknown }) => props.children };
});

// The auth client's core, which sign-out imports to end the OSN sign-in.
vi.mock("@shared/rp-auth", () => {
  loads.authCore++;
  return { signOut: () => Promise.resolve() };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const claim: ClaimResult = {
  publicId: "OKAFOR-LILY-AB12CD",
  familyName: "Okafor",
  members: [
    { guestId: "g-1", firstName: "Chidi", lastName: "Okafor", nickname: null, eventIds: [] },
  ],
  events: [],
  rsvps: [],
};

async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
}

describe("LoginSection keeps account linking out of the first download", () => {
  it("does not load it with the panel", async () => {
    await import("../../src/components/LoginSection");
    expect(loads).toEqual({ pulse: 0, auth: 0, authCore: 0 });
  });

  it("does not load it for a visitor who has not claimed", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { LoginSection } = await import("../../src/components/LoginSection");
    render(() => <LoginSection apiUrl="http://x" result={null} onClaimed={() => {}} />);
    await settle();
    expect(loads).toEqual({ pulse: 0, auth: 0, authCore: 0 });
  });

  it("does not load it for a host preview", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { LoginSection } = await import("../../src/components/LoginSection");
    render(() => (
      <LoginSection apiUrl="http://x" result={{ ...claim, preview: true }} onClaimed={() => {}} />
    ));
    await settle();
    expect(loads).toEqual({ pulse: 0, auth: 0, authCore: 0 });
  });

  it("loads it once a household has claimed", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { LoginSection } = await import("../../src/components/LoginSection");
    const { findByTestId } = render(() => (
      <LoginSection apiUrl="http://x" result={claim} onClaimed={() => {}} />
    ));
    await findByTestId("pulse-account-link-stub");
    await waitFor(() => expect(loads).toEqual({ pulse: 1, auth: 1, authCore: 0 }));
  });
});
