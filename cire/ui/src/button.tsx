import type { SafeProps } from "@osn/ui/ui/props";
import { splitProps } from "solid-js";

/**
 * cire's button.
 *
 * Every control in both portals was already one of four shapes — a solid gold
 * commit, a gold-outlined secondary, a neutral-outlined quiet action, and a
 * destructive one — written out longhand at each of the ~40 call sites, which
 * is why three had drifted to a different padding and two to a different
 * tracking. This is those four, named.
 *
 * ## Why this is not `@osn/ui`'s Button
 *
 * The shapes are the house style, not a general one: uppercase, tracked, a
 * sharp 4px corner, and a *gold* primary rather than a neutral one. `@osn/ui`'s
 * Button is the shadcn set — six variants, sentence case, rounded — and an app
 * that wanted cire's would be overriding almost every class. Two components is
 * the honest answer; one component with ten variants is not.
 *
 * ## No haptic here
 *
 * Tempting, and wrong. The vocabulary in `haptics.ts` is deliberately five
 * names, fired at the moment a change *takes* — not at the moment a button is
 * pressed. A press that opens a dialog, switches a tab or starts a request that
 * then fails has nothing to confirm yet. Buzzing on every press is exactly the
 * "phone in a pocket buzzing through a seating chart" that module warns about.
 *
 * ## About `class`
 *
 * Appended, and there is no `tailwind-merge` here, so it is for what the
 * variant does not decide — `self-start`, `w-full`, a grid placement. The
 * defaults are all `base:`-prefixed and therefore zero-specificity, so a
 * caller's plain utility does win; what it cannot do is beat another `base:`
 * utility on the same property, since those resolve by stylesheet order.
 * Anything that needs a different colour or padding wants a new variant.
 */

export type ButtonVariant = "primary" | "cta" | "outline" | "quiet" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const BASE =
  "base:font-osn-body base:inline-flex base:items-center base:justify-center base:gap-2 " +
  "base:rounded-osn-sm base:border base:whitespace-nowrap base:uppercase " +
  "base:transition-colors base:duration-100 base:ease-out " +
  // Its own focus ring, from the contract's own token. A library component
  // cannot assume its host declares a blanket `:focus-visible` rule: the two
  // portals and `@cire/invites` do, `@cire/landing` does not, and the nine
  // guest-site call sites this replaces each wrote one out by hand. The values
  // match what the portals' global rule already draws, so nothing moves there.
  "base:focus-visible:outline-2 base:focus-visible:outline-offset-2 base:focus-visible:outline-osn-focus " +
  "base:disabled:pointer-events-none base:disabled:opacity-40 " +
  // `aria-disabled` is the other way to say it: the control stays in the tab
  // order and keeps its description reachable, and the click is swallowed below
  // rather than left to each caller. Used where the point is that someone READS
  // why they cannot press it — a `disabled` button is skipped by the keyboard
  // and by a screen reader in forms mode, which hides the explanation from
  // exactly the person asking.
  "base:aria-disabled:cursor-not-allowed base:aria-disabled:opacity-40";

const VARIANT = {
  primary:
    "base:border-osn-accent base:bg-osn-accent base:text-osn-on-accent base:hover:bg-osn-accent-strong",
  /**
   * Outline at rest, primary on hover — the guest site's call to action, at
   * nine call sites across `@cire/invites` and `@cire/landing`: the claim-code
   * submit, the RSVP commit, both gift-registry actions, the consent banner's
   * accept.
   *
   * Not a second `outline`. An invite is restrained enough that a solid gold
   * fill at rest would be the loudest thing on a page whose job is a
   * photograph and a date, so the *primary* action is drawn as an outline and
   * promotes on hover. The portals have the opposite problem — a dashboard
   * needs its commit to be findable — so there `primary` is filled from the
   * start and `outline` stays a wash. Both products need both.
   */
  cta: "base:border-osn-accent base:text-osn-accent-ink base:bg-transparent base:hover:bg-osn-accent base:hover:text-osn-on-accent base:disabled:hover:bg-transparent base:disabled:hover:text-osn-accent-ink",
  outline:
    "base:border-osn-accent/40 base:text-osn-accent-ink base:hover:border-osn-accent base:hover:bg-osn-accent-soft",
  quiet:
    "base:border-osn-hairline base:text-osn-ink-secondary base:hover:border-osn-accent base:hover:text-osn-accent-ink",
  danger:
    "base:border-osn-danger/40 base:text-osn-danger base:hover:border-osn-danger base:hover:bg-osn-danger/10",
} satisfies Readonly<Record<ButtonVariant, string>>;

const SIZE = {
  sm: "base:px-3 base:py-1.5 base:text-osn-xs base:tracking-osn-wider",
  md: "base:px-4 base:py-2 base:text-osn-sm base:tracking-osn-wider",
  // For a control that is the only thing to do on the screen it is on — a
  // claim-code submit, an RSVP commit. Also the minimum comfortable touch
  // target on a phone, which is where most invites are opened.
  lg: "base:px-6 base:py-3.5 base:text-osn-base base:tracking-osn-wider",
  // Square, for a single glyph. No tracking — there is nothing to track.
  icon: "base:h-8 base:w-8 base:shrink-0 base:p-0 base:text-osn-base",
} satisfies Readonly<Record<ButtonSize, string>>;

/**
 * The classes on their own, for a call site that needs a different element — an
 * `<a>` that looks like a button, a Kobalte trigger rendered `as`. Reaching for
 * this instead of `<button role="link">` is the right trade every time.
 */
export function buttonClass(options: { variant?: ButtonVariant; size?: ButtonSize } = {}): string {
  return `${BASE} ${VARIANT[options.variant ?? "quiet"]} ${SIZE[options.size ?? "md"]}`;
}

export type ButtonProps = SafeProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export default function Button(props: ButtonProps) {
  const [own, rest] = splitProps(props, ["variant", "size", "class", "onClick"]);

  /**
   * `aria-disabled` has to mean it.
   *
   * The attribute only tells assistive technology the control is unavailable —
   * the browser still fires the click, because that is the whole reason to
   * choose it over `disabled` (the control keeps its tab stop, so its reason
   * stays reachable). Swallowing the click here is what makes the announcement
   * true; leaving it to every caller makes the styling a promise the component
   * does not keep.
   */
  const inert = () => props["aria-disabled"] === true || props["aria-disabled"] === "true";

  return (
    // `type` sits before the spread so a caller can still pass `type="submit"`.
    // A button with no type submits the form it is in, which is never what a
    // toolbar control in a settings form means to do.
    <button
      type="button"
      {...rest}
      class={`${buttonClass({ variant: own.variant, size: own.size })}${
        own.class ? ` ${own.class}` : ""
      }`}
      onClick={(event) => {
        if (inert()) {
          // `preventDefault` as well as the early return: a `type="submit"`
          // button inside a form would otherwise still submit it.
          event.preventDefault();
          return;
        }
        const handler = own.onClick;
        if (typeof handler === "function") handler(event);
        // Solid's bound form: `onClick={[fn, data]}`.
        else if (Array.isArray(handler)) handler[0](handler[1], event);
      }}
    />
  );
}
