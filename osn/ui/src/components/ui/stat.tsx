import { Show, type JSX } from "solid-js";

/**
 * One figure, said loudly: 84 guests, 12 days, $4,200 left.
 *
 * `tabular-nums` is what keeps a counting number from shuffling its own width
 * as it ticks — a figure that reflows while it updates reads as broken rather
 * than as live.
 *
 * The label sits below the figure, not above it. Someone scanning a grid of
 * these reads the numbers first and looks for the word only when one of them is
 * surprising.
 */
export function Stat(props: {
  /** Already formatted — this component knows nothing about money or dates. */
  value: JSX.Element;
  label: string;
  /** A trailing note: "of 120", "since Tuesday". */
  hint?: string;
}) {
  return (
    <div class="base:flex base:flex-col base:gap-0.5">
      <p class="base:font-osn-display base:text-osn-xl base:font-light base:leading-osn-none base:tabular-nums base:text-osn-accent-ink">
        {props.value}
      </p>
      <p class="base:font-osn-body base:text-osn-base base:text-osn-ink">{props.label}</p>
      <Show when={props.hint}>
        <p class="base:font-osn-body base:text-osn-xs base:text-osn-ink-secondary">{props.hint}</p>
      </Show>
    </div>
  );
}
