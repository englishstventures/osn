import { Tabs as KobalteTabs } from "@kobalte/core/tabs";
import { clsx } from "clsx";
import { splitProps, type Component, type JSX } from "solid-js";

const Tabs = KobalteTabs;

const TabsList: Component<{ class?: string; children?: JSX.Element }> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return <KobalteTabs.List class={clsx("base:flex base:gap-1", local.class)} {...others} />;
};

const TabsTrigger: Component<{
  value: string;
  class?: string;
  children?: JSX.Element;
  disabled?: boolean;
}> = (props) => {
  const [local, others] = splitProps(props, ["class", "value"]);
  return (
    <KobalteTabs.Trigger
      value={local.value}
      class={clsx(
        "base:rounded-md base:px-3 base:py-1.5 base:text-sm base:font-medium base:transition-colors",
        "base:text-osn-ink-secondary base:hover:bg-osn-surface-sunk",
        "base:data-[selected]:bg-osn-accent base:data-[selected]:text-osn-on-accent",
        local.class,
      )}
      {...others}
    />
  );
};

const TabsContent: Component<{ value: string; class?: string; children?: JSX.Element }> = (
  props,
) => {
  const [local, others] = splitProps(props, ["class", "value"]);
  return (
    <KobalteTabs.Content
      value={local.value}
      class={clsx("base:mt-2 base:focus-visible:outline-none", local.class)}
      {...others}
    />
  );
};

export { Tabs, TabsList, TabsTrigger, TabsContent };
