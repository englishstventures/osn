import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { splitProps, type Component, type ComponentProps } from "solid-js";

const buttonVariants = cva(
  "base:inline-flex base:cursor-pointer base:items-center base:justify-center base:gap-2 base:whitespace-nowrap base:rounded-md base:text-sm base:font-medium base:transition-colors base:focus-visible:outline-none base:focus-visible:ring-2 base:focus-visible:ring-osn-focus base:disabled:pointer-events-none base:disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "base:bg-osn-accent base:text-osn-on-accent base:hover:bg-osn-accent/90",
        destructive: "base:bg-osn-danger base:text-osn-on-danger base:hover:bg-osn-danger/90",
        outline:
          "base:border base:border-osn-hairline-strong base:bg-osn-ground base:hover:bg-osn-surface-sunk base:hover:text-osn-ink",
        secondary: "base:bg-osn-surface-sunk base:text-osn-ink base:hover:bg-osn-surface-sunk/80",
        ghost: "base:hover:bg-osn-surface-sunk base:hover:text-osn-ink",
        link: "base:text-osn-accent-ink base:underline-offset-4 base:hover:underline",
      },
      size: {
        default: "base:h-9 base:px-4 base:py-2",
        sm: "base:h-8 base:rounded-md base:px-3 base:text-xs",
        lg: "base:h-10 base:rounded-md base:px-8",
        icon: "base:h-9 base:w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

const Button: Component<ButtonProps> = (props) => {
  const [local, others] = splitProps(props, ["variant", "size", "class"]);
  return (
    <button
      class={clsx(buttonVariants({ variant: local.variant, size: local.size }), local.class)}
      {...others}
    />
  );
};

export { Button, buttonVariants };
export type { ButtonProps };
