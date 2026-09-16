/**
 * The contract's token names, as data.
 *
 * `tokens.css` is the authority on what the contract *is*; this module exists
 * so a mapping can be checked **exhaustively** rather than by eye. An app's
 * conformance test asks for `CONTRACT_COLOR_TOKENS` and asserts that it has
 * mapped every one, which is what turns "we adopted the contract" from a claim
 * into something that fails a build.
 *
 * Keeping the list here rather than parsing it back out of the stylesheet is
 * deliberate: a regex over CSS would happily "find" a token in a comment, and
 * the drift it is supposed to catch is exactly a token added to one and not the
 * other. `tests/tokens-css-agrees.test.ts` asserts the two agree, so the
 * duplication is guarded rather than hoped about.
 */

/**
 * Colour tokens, grouped by the contrast obligation each one carries.
 *
 * The grouping is not documentation — {@link assertContractConformance} reads
 * it to decide what to assert about each token, so moving a token between
 * groups changes what an app has to prove.
 */
export const CONTRACT_COLOR_TOKENS = {
  /** Backgrounds a reader's eye rests on. Nothing is asserted *about* them; they are what other tokens are asserted *against*. */
  grounds: ["--osn-ground", "--osn-ground-deep"],
  /** Raised planes. Also grounds for contrast purposes. */
  surfaces: ["--osn-surface", "--osn-surface-raised", "--osn-surface-sunk"],
  /** Body-copy ink. Must clear {@link WCAG_TEXT} against every ground and surface. */
  ink: ["--osn-ink", "--osn-ink-secondary"],
  /** Large-text, ornament and disabled ink. Clears {@link WCAG_UI} only — never body copy. */
  inkLarge: ["--osn-ink-tertiary"],
  /** Non-text UI that must be perceivable: control boundaries, the focus ring. Clears {@link WCAG_UI}. */
  ui: ["--osn-hairline-strong", "--osn-focus"],
  /** Decoration with no contrast floor. A card is told apart by its surface, not its edge. */
  decorative: ["--osn-hairline", "--osn-accent-soft"],
  /** Fills. What sits *on* them is asserted, not they themselves. */
  fills: ["--osn-accent", "--osn-accent-strong", "--osn-danger"],
  /** Ink that sits on a fill. Asserted against the fill it names, not against the page. */
  onFill: ["--osn-on-accent", "--osn-on-danger"],
  /** Accent and status colours used as ink on a ground. Clears {@link WCAG_TEXT}. */
  chromaticInk: ["--osn-accent-ink", "--osn-success", "--osn-warn"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/** Every colour token in the contract, flattened. */
export const ALL_COLOR_TOKENS: readonly string[] = Object.values(CONTRACT_COLOR_TOKENS).flat();

/** Radius, type-family and motion tokens. No contrast obligation, so they are listed separately. */
export const CONTRACT_SCALAR_TOKENS = {
  radius: [
    "--osn-radius-hair",
    "--osn-radius-sm",
    "--osn-radius-md",
    "--osn-radius-lg",
    "--osn-radius-pill",
  ],
  fontFamily: ["--osn-font-body", "--osn-font-display", "--osn-font-mono"],
  focus: ["--osn-focus-width", "--osn-focus-offset"],
  motion: [
    "--osn-dur-fast",
    "--osn-dur-base",
    "--osn-dur-slow",
    "--osn-ease-out",
    "--osn-ease-in-out",
  ],
  elevation: ["--osn-elev-1", "--osn-elev-2"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/** WCAG 2.2 minimum contrast for body text. */
export const WCAG_TEXT = 4.5;

/** WCAG 2.2 minimum contrast for large text and non-text UI. */
export const WCAG_UI = 3;

/**
 * The pairs {@link assertContractConformance} checks, derived from the groups
 * above rather than listed by hand.
 *
 * Every ink is measured against every ground and surface, because a token that
 * clears 4.5:1 on the page and fails it on a raised menu is a real defect and
 * the naive version of this check — ink against `--osn-ground` alone — does not
 * see it. That is nine assertions per ink token, which is why this is generated.
 */
export function contrastPairs(): readonly { fg: string; bg: string; min: number }[] {
  const grounds = [...CONTRACT_COLOR_TOKENS.grounds, ...CONTRACT_COLOR_TOKENS.surfaces];
  const pairs: { fg: string; bg: string; min: number }[] = [];

  for (const fg of CONTRACT_COLOR_TOKENS.ink) {
    for (const bg of grounds) pairs.push({ fg, bg, min: WCAG_TEXT });
  }
  for (const fg of CONTRACT_COLOR_TOKENS.chromaticInk) {
    for (const bg of grounds) pairs.push({ fg, bg, min: WCAG_TEXT });
  }
  for (const fg of [...CONTRACT_COLOR_TOKENS.inkLarge, ...CONTRACT_COLOR_TOKENS.ui]) {
    for (const bg of grounds) pairs.push({ fg, bg, min: WCAG_UI });
  }

  // On-fill ink is asserted against the fill it names, never against the page:
  // `--osn-on-accent` sitting on `--osn-ground` is a combination no component
  // produces, and asserting it would fail honest palettes for no reason.
  pairs.push({ fg: "--osn-on-accent", bg: "--osn-accent", min: WCAG_TEXT });
  pairs.push({ fg: "--osn-on-accent", bg: "--osn-accent-strong", min: WCAG_TEXT });
  pairs.push({ fg: "--osn-on-danger", bg: "--osn-danger", min: WCAG_TEXT });

  return pairs;
}
