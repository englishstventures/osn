import { clsx } from "clsx";
import { splitProps, type Component, type ComponentProps } from "solid-js";

type TextareaProps = ComponentProps<"textarea">;

const Textarea: Component<TextareaProps> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <textarea
      class={clsx(
        "base:border-osn-hairline-strong base:bg-osn-ground base:text-osn-ink base:ring-offset-background base:placeholder:text-osn-ink-secondary base:focus-visible:ring-osn-focus base:flex base:min-h-[60px] base:w-full base:rounded-md base:border base:px-3 base:py-2 base:text-sm base:focus-visible:outline-none base:focus-visible:ring-2 base:focus-visible:ring-offset-2 base:disabled:cursor-not-allowed base:disabled:opacity-50",
        local.class,
      )}
      {...others}
    />
  );
};

export { Textarea };
export type { TextareaProps };
