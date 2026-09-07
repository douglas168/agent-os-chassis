"use client";

import { type ComponentPropsWithRef, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export type TooltipIconButtonProps = ComponentPropsWithRef<typeof Button> & {
  tooltip: string;
  side?: "top" | "bottom" | "left" | "right";
};

export const TooltipIconButton = forwardRef<
  HTMLButtonElement,
  TooltipIconButtonProps
>(({ children, tooltip, side = "bottom", className, ...rest }, ref) => {
  void side;
  return (
    <Button
      variant="ghost"
      size="icon"
      {...rest}
      aria-label={rest["aria-label"] ?? tooltip}
      title={tooltip}
      className={cn("aui-button-icon size-6 p-1 active:scale-90", className)}
      ref={ref}
    >
      {children}
    </Button>
  );
});

TooltipIconButton.displayName = "TooltipIconButton";
