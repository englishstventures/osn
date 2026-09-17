import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { splitProps, type Component, type ComponentProps } from "solid-js";

const badgeVariants = cva(
  "base:inline-flex base:items-center base:rounded-osn-pill base:px-2.5 base:py-0.5 base:text-osn-sm base:font-semibold base:transition-colors base:focus:outline-none base:focus:ring-2 base:focus:ring-osn-focus base:focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "base:bg-osn-accent base:text-osn-on-accent",
        secondary: "base:bg-osn-surface-sunk base:text-osn-ink-secondary",
        destructive: "base:bg-osn-danger base:text-osn-on-danger",
        outline: "base:text-osn-ink base:border base:border-osn-hairline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type BadgeProps = ComponentProps<"div"> & VariantProps<typeof badgeVariants>;

const Badge: Component<BadgeProps> = (props) => {
  const [local, others] = splitProps(props, ["variant", "class"]);
  return <div class={clsx(badgeVariants({ variant: local.variant }), local.class)} {...others} />;
};

export { Badge, badgeVariants };
export type { BadgeProps };
