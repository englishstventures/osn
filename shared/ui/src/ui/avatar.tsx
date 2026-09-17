import { clsx } from "clsx";
import { splitProps, type Component, type ComponentProps } from "solid-js";

/**
 * A picture of a person, with initials behind it.
 *
 * `ring` is here because an overlapping stack is the one arrangement that needs
 * the avatar's own edge to change: without a band of the page's own colour
 * between them, two circles that overlap read as one shape. The ring is drawn
 * in the surface colour rather than a border colour for that reason — it is
 * standing in for the gap, not outlining the avatar.
 */
type AvatarProps = ComponentProps<"span"> & {
  /** `surface` draws a band of the page's own colour around the circle, for an overlapping stack. */
  ring?: "none" | "surface";
};

const Avatar: Component<AvatarProps> = (props) => {
  const [local, others] = splitProps(props, ["class", "ring"]);
  return (
    <span
      class={clsx(
        "base:relative base:flex base:shrink-0 base:overflow-hidden base:rounded-ui-pill",
        local.ring === "surface" && "base:border-2 base:border-ui-surface",
        local.class,
      )}
      {...others}
    />
  );
};

const AvatarImage: Component<ComponentProps<"img">> = (props) => {
  const [local, others] = splitProps(props, ["class", "alt"]);
  return (
    <img
      class={clsx("base:aspect-square base:h-full base:w-full base:object-cover", local.class)}
      alt={local.alt ?? ""}
      {...others}
    />
  );
};

const AvatarFallback: Component<ComponentProps<"span">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <span
      class={clsx(
        "base:bg-ui-surface-sunk base:text-ui-ink-secondary base:flex base:h-full base:w-full base:items-center base:justify-center base:text-ui-xs base:font-semibold",
        local.class,
      )}
      {...others}
    />
  );
};

export { Avatar, AvatarImage, AvatarFallback };
export type { AvatarProps };
