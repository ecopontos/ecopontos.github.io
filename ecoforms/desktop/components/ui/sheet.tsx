"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/src/lib/utils"

function Sheet({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger {...props} />
}

function SheetPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal {...props} />
}

function SheetClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close {...props} />
}

function SheetOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out fixed inset-0 z-50 bg-black/40",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({ className, children, side = "right", ...props }: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: "right" | "left" }) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 z-50 h-full bg-background shadow-lg transition ease-in-out duration-300 outline-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200",
          side === "right"
            ? "right-0 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right"
            : "left-0 data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
          "w-full sm:max-w-md",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute top-4 right-4">
          <XIcon />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("px-4 py-3 border-b", className)} {...props} />
  )
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("text-lg font-semibold", className)} {...props} />
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />
}

export {
  Sheet,
  SheetTrigger,
  SheetPortal,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
}

export default Sheet
