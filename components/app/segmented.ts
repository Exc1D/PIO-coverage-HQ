import { cn } from "@/lib/utils";

/** iOS segmented control, built from links: the list is the track, the current item the raised thumb. */
export const segmentedList = "inline-flex rounded-[9px] bg-foreground/[0.06] p-0.5";

export function segmentedItem(current: boolean) {
  return cn(
    "inline-flex min-h-11 items-center rounded-[7px] px-3.5 text-sm text-muted-foreground transition-[background-color,box-shadow,color] duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:opacity-60",
    current && "bg-background font-medium text-foreground shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)]",
  );
}
