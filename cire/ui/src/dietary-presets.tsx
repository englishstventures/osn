import {
  DIETARY_PRESET_BAND,
  DIETARY_PRESET_LABEL,
  DIETARY_PRESETS,
  type DietaryBand,
  type DietaryPreset,
} from "@cire/dietary";
import { Popover, PopoverContent, PopoverTrigger } from "@shared/ui/ui/popover";
import { createMemo, createSignal, createUniqueId, For, onCleanup, Show, type JSX } from "solid-js";

/**
 * The dietary-requirement picker: one multi-select, two presentations.
 *
 * Every surface that collects dietary requirements renders this — the guest
 * invite, the host's record-a-reply editor, the marketing demo — so the
 * vocabulary a caterer eventually reads is decided in exactly one place.
 *
 * ## One fieldset, two shells
 *
 * Below `md:` the checkboxes sit inline in a horizontally scrolling track: on a
 * phone the whole point is that answering is a tap, and a control you must open
 * first is a tap you have to spend before you can start. At `md:` and up the
 * same checkboxes move into a popover behind a trigger that names the current
 * selection, because sixteen pills across a desktop form is a wall.
 *
 * The **checkboxes are rendered once**, and the shell is chosen at runtime
 * rather than in CSS. A CSS fork would need the fields in the tree twice —
 * Solid evaluates a JSX expression once, so the same nodes placed in two parents
 * MOVE rather than duplicate — and two controls with the same accessible name is
 * a worse problem than one media query.
 *
 * `matchMedia` is guarded and defaults to the narrow shell, because jsdom
 * provides none and an unguarded read would take out every unit test that mounts
 * a form containing this. The `change` listener is not optional: a signal seeded
 * from `.matches` alone never updates, so a window resized across the breakpoint
 * would strand the guest with a popover trigger that no longer opens anything.
 *
 * ## Why the trigger is not a `<select>`
 *
 * A native select cannot express "vegetarian AND no nuts", and that is the
 * common case rather than the edge — a guest with two requirements would have to
 * abandon the list and type both into "Other", which is the failure the presets
 * exist to remove.
 *
 * ## A `<fieldset>` with no `<legend>`
 *
 * The grouping is a real fieldset, named by `aria-label` rather than a legend.
 * A caller already wraps this in a fieldset whose legend says whose
 * requirements these are, and on a household sheet that name is load-bearing —
 * "Vegetarian" means nothing without "for Ravi". A second legend inside it
 * pushes screen readers to announce only the innermost, dropping the member's
 * name from every checkbox; an `aria-label` names this group without competing.
 * The band headings are plain text for the same reason.
 *
 * ## The "Other" box is the caller's
 *
 * This renders the presets and nothing else. The free-text box belongs to the
 * form, below this control, because it has to stay reachable while the popover
 * is closed — and a guest who has typed something must be able to see it without
 * reopening anything.
 */

const BAND_LABEL = {
  diet: "Diet",
  allergy: "Allergies",
  other: "",
} satisfies Readonly<Record<DietaryBand, string>>;

/** The order bands render in; `other` trails both and gets no heading. */
const BANDS = ["diet", "allergy", "other"] as const;

export interface DietaryPresetsProps {
  /** The current selection. Controlled — this component holds no state. */
  value: readonly DietaryPreset[];
  onChange: (next: readonly DietaryPreset[]) => void;
  /** Disables every checkbox and the trigger: submitting, saved, or past the
   *  RSVP deadline. */
  disabled?: boolean;
  /** Names whose requirements these are, for the group's accessible name. */
  label?: string;
  /** Extra classes for the popover panel, for a caller with its own layering. */
  panelClass?: string;
  /**
   * Pin the fields inline at every width instead of collapsing them into a
   * popover above the breakpoint. For a caller whose surface has no room for a
   * panel, or which wants every option visible at once.
   */
  shell?: "auto" | "inline";
}

function toggle(
  current: readonly DietaryPreset[],
  key: DietaryPreset,
  on: boolean,
): readonly DietaryPreset[] {
  const next = new Set(current);
  if (on) next.add(key);
  else next.delete(key);
  // Canonical order, so the value this hands back is the order it renders and
  // the order the column stores. Nothing downstream has to re-sort.
  return DIETARY_PRESETS.filter((k) => next.has(k));
}

/**
 * What the collapsed trigger says.
 *
 * The selection itself, never a static "Dietary requirements" — a closed control
 * that does not say what it holds makes a guest open it to check, every time.
 * Truncated at two so a long selection cannot outgrow the button.
 */
function summarise(value: readonly DietaryPreset[]): string {
  if (value.length === 0) return "Add dietary requirements";
  const shown = value.slice(0, 2).map((k) => DIETARY_PRESET_LABEL[k]);
  const rest = value.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} +${rest}` : shown.join(", ");
}

function PresetCheckbox(props: {
  preset: DietaryPreset;
  checked: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}): JSX.Element {
  return (
    <label class="font-body border-ui-hairline text-ui-ink has-[:checked]:border-ui-accent has-[:checked]:bg-ui-accent-wash has-[:focus-visible]:ring-ui-focus flex shrink-0 cursor-pointer snap-start items-center gap-2 rounded-full border px-3 py-1.5 text-[0.82rem] whitespace-nowrap transition-colors duration-200 select-none has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:ring-2">
      {/* A real checkbox, visually hidden rather than replaced: the checked
          state, the space key, the screen-reader announcement and the label
          association all come from the platform. `sr-only` keeps it focusable,
          which `display: none` would not. */}
      <input
        type="checkbox"
        class="sr-only"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.currentTarget.checked)}
      />
      <span aria-hidden="true" class="text-ui-accent text-[0.9em] leading-none">
        {props.checked ? "✓" : "+"}
      </span>
      {DIETARY_PRESET_LABEL[props.preset]}
    </label>
  );
}

/** Matches the `md:` breakpoint the rest of cire's invite sheet forks at. */
const WIDE_QUERY = "(min-width: 48rem)";

function createIsWide() {
  const [wide, setWide] = createSignal(false);
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return wide;
  const query = window.matchMedia(WIDE_QUERY);
  setWide(query.matches);
  const onChange = (event: MediaQueryListEvent) => setWide(event.matches);
  query.addEventListener("change", onChange);
  onCleanup(() => query.removeEventListener("change", onChange));
  return wide;
}

export default function DietaryPresets(props: DietaryPresetsProps): JSX.Element {
  const groupId = createUniqueId();
  const selected = createMemo(() => new Set(props.value));
  const wide = createIsWide();

  const bands = createMemo(() =>
    BANDS.map((band) => ({
      band,
      presets: DIETARY_PRESETS.filter((k) => DIETARY_PRESET_BAND[k] === band),
    })),
  );

  // `wide` decides the layout outright rather than a `md:` variant doing it:
  // the same fields render in a scrolling row on a phone and in a wrapped column
  // inside the popover, and by the time they are in the popover the viewport is
  // already known to be wide. A media variant here would be a second, redundant
  // answer to a question the shell has already asked.
  const fields = () => (
    <fieldset
      aria-label={props.label ?? "Dietary requirements"}
      // A fieldset carries a border, padding and margin by default; this is a
      // grouping for semantics, not a box. `min-w-0` is load-bearing: a
      // `<fieldset>` resolves its min-width from its CONTENT, so without it the
      // scrolling track below cannot shrink and the sixteen pills push the whole
      // sheet wider than the phone instead of overflowing inside it.
      class="m-0 block min-w-0 border-0 p-0"
    >
      <div
        classList={{
          "flex min-w-0 gap-4": true,
          "snap-x snap-proximity overflow-x-auto pb-1": !wide(),
          "flex-col gap-3": wide(),
        }}
      >
        <For each={bands()}>
          {(group) => (
            <div
              classList={{
                "flex gap-2": true,
                "shrink-0 items-center": !wide(),
                "flex-col items-start": wide(),
              }}
            >
              <Show when={BAND_LABEL[group.band] !== ""}>
                <p class="font-body text-ui-ink-muted shrink-0 text-[0.68rem] tracking-[0.12em] uppercase">
                  {BAND_LABEL[group.band]}
                </p>
              </Show>
              <div classList={{ "flex gap-2": true, "shrink-0": !wide(), "flex-wrap": wide() }}>
                <For each={group.presets}>
                  {(preset) => (
                    <PresetCheckbox
                      preset={preset}
                      checked={selected().has(preset)}
                      disabled={props.disabled}
                      onChange={(on) => props.onChange(toggle(props.value, preset, on))}
                    />
                  )}
                </For>
              </div>
            </div>
          )}
        </For>
      </div>
    </fieldset>
  );

  return (
    <Show when={wide() && props.shell !== "inline"} fallback={fields()}>
      {/* Kobalte owns placement, dismiss, focus return and the ARIA contract.
          Its content carries `data-kb-top-layer`, which is what keeps the panel
          reachable from inside a modal that marks everything outside itself
          `aria-hidden` — the guest invite opens this from exactly there. */}
      <Popover gutter={6} placement="bottom-start">
        <PopoverTrigger
          id={groupId}
          disabled={props.disabled}
          class="font-body border-ui-hairline text-ui-ink hover:border-ui-accent-soft focus-visible:ring-ui-focus rounded-ui-sm flex w-full cursor-pointer items-center justify-between gap-2 border bg-transparent px-3 py-2.5 text-left text-[0.88rem] transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span classList={{ "text-ui-ink-muted": props.value.length === 0 }}>
            {summarise(props.value)}
          </span>
          <span aria-hidden="true" class="text-ui-ink-muted text-[0.7em]">
            ▾
          </span>
        </PopoverTrigger>
        <PopoverContent class="base:w-auto base:max-w-[22rem] base:p-4">{fields()}</PopoverContent>
      </Popover>
    </Show>
  );
}
