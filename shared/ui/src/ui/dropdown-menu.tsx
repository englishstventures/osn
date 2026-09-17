import { DropdownMenu as KobalteDropdownMenu } from "@kobalte/core/dropdown-menu";
import { clsx } from "clsx";
import { splitProps, type ComponentProps, type ParentComponent } from "solid-js";

const DropdownMenu = KobalteDropdownMenu;
const DropdownMenuTrigger = KobalteDropdownMenu.Trigger;

const DropdownMenuContent: ParentComponent<ComponentProps<"div">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <KobalteDropdownMenu.Portal>
      <KobalteDropdownMenu.Content
        class={clsx(
          "base:bg-ui-surface-raised base:text-ui-ink base:border-ui-hairline base:z-50 base:min-w-32 base:rounded-ui-md base:border base:p-1 base:shadow-md base:outline-none",
          "base:data-[expanded]:animate-in base:data-[closed]:animate-out base:data-[closed]:fade-out-0 base:data-[expanded]:fade-in-0 base:data-[closed]:zoom-out-95 base:data-[expanded]:zoom-in-95",
          local.class,
        )}
        {...others}
      />
    </KobalteDropdownMenu.Portal>
  );
};

const DropdownMenuItem: ParentComponent<ComponentProps<"div"> & { onSelect?: () => void }> = (
  props,
) => {
  const [local, others] = splitProps(props, ["class", "onSelect"]);
  return (
    <KobalteDropdownMenu.Item
      class={clsx(
        "base:relative base:flex base:cursor-pointer base:select-none base:items-center base:rounded-ui-sm base:px-2 base:py-1.5 base:text-ui-base base:outline-none",
        "base:focus:bg-ui-surface-sunk base:focus:text-ui-ink",
        "base:data-[disabled]:pointer-events-none base:data-[disabled]:opacity-50",
        local.class,
      )}
      onSelect={local.onSelect}
      {...others}
    />
  );
};

/**
 * Two jobs share this element, and they are set differently.
 *
 * `heading` names a group of items and leads the menu — semibold, full ink.
 * `identity` is the block at the top of an account menu that says *who you are
 * signed in as*: it is context rather than a heading, so it recedes, and every
 * account menu in the repository had been reaching for the same two utilities
 * to say so.
 */
const DROPDOWN_LABEL_TONE = {
  heading: "base:text-ui-ink base:font-semibold",
  identity: "base:text-ui-ink-secondary base:font-normal",
} satisfies Readonly<Record<"heading" | "identity", string>>;

const DropdownMenuLabel: ParentComponent<
  ComponentProps<"span"> & { tone?: keyof typeof DROPDOWN_LABEL_TONE }
> = (props) => {
  const [local, others] = splitProps(props, ["class", "tone"]);
  return (
    <KobalteDropdownMenu.GroupLabel
      class={clsx(
        "base:px-2 base:py-1.5 base:text-ui-base",
        DROPDOWN_LABEL_TONE[local.tone ?? "heading"],
        local.class,
      )}
      {...others}
    />
  );
};

const DropdownMenuSeparator: ParentComponent<ComponentProps<"hr">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <KobalteDropdownMenu.Separator
      class={clsx("base:bg-ui-hairline base:-mx-1 base:my-1 base:h-px", local.class)}
      {...others}
    />
  );
};

const DropdownMenuGroup = KobalteDropdownMenu.Group;

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
};
