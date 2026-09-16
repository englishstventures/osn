import { splitProps, type ComponentProps } from "solid-js";

import type { SafeProps } from "./props";

/**
 * A data table, as three parts: the scrolling frame, a column head and a cell.
 *
 * ## The wrapper scrolls, the page does not
 *
 * A guest table with an email column is wider than a phone, and a table that
 * cannot be reached sideways is a table with a hidden column. The scroll lives
 * on the wrapper, so the body never scrolls sideways with it — which is the one
 * thing that makes a page feel broken rather than dense.
 *
 * That scroll has to be reachable from the keyboard. WebKit does not make an
 * overflow container focusable on its own, so somebody who does not use a mouse
 * cannot reach the columns that are off the edge. `tabindex="0"` gives it arrow
 * keys; the labelled region is what stops the new tab stop being an unexplained
 * one on the way past.
 *
 * Which is why `label` is required rather than optional. A focusable box with no
 * name is worse than the bug it fixes, and any table can say in a word what it
 * holds. A named `<section>` *is* a region, so the name does both jobs and there
 * is no `role` to write.
 *
 * `border-separate` with zero spacing, rather than `border-collapse`: a
 * collapsed table hands its border to the cells, and the outer radius on the
 * wrapper then gets a square corner poking through it.
 */
export interface TableProps {
  /** Names the scroll region: "Guests", "Replies", "Changes". */
  label: string;
  class?: string;
  children: ComponentProps<"table">["children"];
}

export function Table(props: TableProps) {
  // oxlint-disable no-noninteractive-tabindex -- the rule is about static
  // content, and this box scrolls. Focusing it is what gives the arrow keys
  // somewhere to go; the name above is what makes the stop explicable. A
  // block rather than the next-line form because the attribute is not on the
  // line the element opens on, and oxfmt is what decides that.
  return (
    <section
      aria-label={props.label}
      tabindex="0"
      class={`base:border-osn-hairline base:overflow-x-auto base:rounded-osn-sm base:border${props.class ? ` ${props.class}` : ""}`}
    >
      <table class="base:w-full base:border-separate base:border-spacing-0 base:text-left">
        {props.children}
      </table>
    </section>
  );
  // oxlint-enable no-noninteractive-tabindex
}

export type ThProps = SafeProps<"th"> & {
  /**
   * Centre the heading over a column of checkboxes or icons. A prop rather than
   * a passed `text-center`, because that would fight the `text-left` below on
   * the same property — and two Tailwind utilities on one property resolve by
   * stylesheet order, not by the order they appear in `class`.
   */
  align?: "start" | "center";
};

/**
 * A column head. `scope="col"` by default — without it a screen reader has to
 * guess which cells a header governs, and in a wide table it guesses wrong.
 */
export function Th(props: ThProps) {
  const [own, rest] = splitProps(props, ["align", "class"]);
  return (
    <th
      scope="col"
      {...rest}
      class={`base:font-osn-body base:border-osn-hairline base:text-osn-accent-ink base:border-b base:px-4 base:py-3 ${
        own.align === "center" ? "base:text-center" : "base:text-left"
      } base:text-osn-xs base:font-normal base:tracking-osn-wider base:whitespace-nowrap base:uppercase${
        own.class ? ` ${own.class}` : ""
      }`}
    />
  );
}

export type TdProps = SafeProps<"td"> & {
  /** Figures: right-aligned, tabular, so the digits line up down the column. */
  numeric?: boolean;
};

export function Td(props: TdProps) {
  const [own, rest] = splitProps(props, ["numeric", "class"]);
  return (
    <td
      {...rest}
      class={`base:border-osn-hairline/40 base:text-osn-ink base:border-b base:px-4 base:py-3 base:text-osn-base ${
        own.numeric ? "base:text-right base:font-osn-mono base:tabular-nums" : ""
      }${own.class ? ` ${own.class}` : ""}`}
    />
  );
}
