import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, MotionConfig, motion, type Transition, type Variants } from "motion/react";
import useClickOutside from "@/hooks/useClickOutside";
import { cn } from "@/lib/utils";

// Adapted from motion-primitives' MorphingPopover. Women360 changes:
//  - the panel is portalled to <body>, so no ancestor with a transform or
//    backdrop-filter (the top bar, the page's rise animation) can clip it or
//    re-anchor its position;
//  - it uses our colour tokens instead of zinc, and respects reduced motion;
//  - focus moves into the panel when it opens and back to the trigger when it
//    closes;
//  - the `asChild` trigger mode is dropped (nothing here used it).

const TRANSITION: Transition = { type: "spring", bounce: 0.1, duration: 0.4 };

interface PopoverContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  uniqueId: string;
  variants?: Variants;
  triggerRef: React.RefObject<HTMLButtonElement>;
}

const PopoverContext = createContext<PopoverContextValue | null>(null);

function usePopoverLogic({
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
}: {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const uniqueId = useId();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isOpen = controlledOpen ?? uncontrolledOpen;

  const open = () => {
    if (controlledOpen === undefined) setUncontrolledOpen(true);
    onOpenChange?.(true);
  };
  const close = () => {
    if (controlledOpen === undefined) setUncontrolledOpen(false);
    onOpenChange?.(false);
  };
  return { isOpen, open, close, uniqueId };
}

export interface MorphingPopoverProps extends Omit<ComponentProps<"div">, "onChange"> {
  children: ReactNode;
  transition?: Transition;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  variants?: Variants;
}

export function MorphingPopover({
  children,
  transition = TRANSITION,
  defaultOpen,
  open,
  onOpenChange,
  variants,
  className,
  ...props
}: MorphingPopoverProps) {
  const logic = usePopoverLogic({ defaultOpen, open, onOpenChange });
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <PopoverContext.Provider value={{ ...logic, variants, triggerRef }}>
      <MotionConfig transition={transition} reducedMotion="user">
        <div className={cn("relative flex items-center justify-center", className)} {...props}>
          {children}
        </div>
      </MotionConfig>
    </PopoverContext.Provider>
  );
}

function useCtx(name: string) {
  const ctx = useContext(PopoverContext);
  if (!ctx) throw new Error(`${name} must be used within MorphingPopover`);
  return ctx;
}

export function MorphingPopoverTrigger({
  children,
  className,
  ...props
}: Omit<ComponentProps<typeof motion.button>, "children"> & { children: ReactNode }) {
  const ctx = useCtx("MorphingPopoverTrigger");
  return (
    <motion.div layoutId={`popover-trigger-${ctx.uniqueId}`} onClick={ctx.open} style={{ borderRadius: 999 }}>
      <motion.button
        {...props}
        ref={ctx.triggerRef}
        type="button"
        layoutId={`popover-label-${ctx.uniqueId}`}
        className={className}
        aria-haspopup="dialog"
        aria-expanded={ctx.isOpen}
        aria-controls={`popover-content-${ctx.uniqueId}`}
      >
        {children}
      </motion.button>
    </motion.div>
  );
}

export function MorphingPopoverContent({
  children,
  className,
  title,
  ...props
}: ComponentProps<typeof motion.div> & { title: string }) {
  const ctx = useCtx("MorphingPopoverContent");
  const panelRef = useRef<HTMLDivElement>(null);
  const { close, isOpen, triggerRef } = ctx;
  useClickOutside(panelRef, close);
  // `close` is a new function every render. The focus effect below must run
  // once per open/close, not once per keystroke (which would snap focus back to
  // the first field mid-typing), so it reads the latest one through a ref.
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!isOpen) return;
    const trigger = triggerRef.current;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeRef.current();
    }
    document.addEventListener("keydown", onKey);
    // Wait a frame so the panel is mounted, then land on the first field.
    const raf = requestAnimationFrame(() => {
      // A field if there is one (the close button comes first in the DOM, but isn't where typing starts).
      const panel = panelRef.current;
      (panel?.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea") ?? panel?.querySelector<HTMLElement>("button"))?.focus({
        preventScroll: true,
      });
    });
    return () => {
      document.removeEventListener("keydown", onKey);
      cancelAnimationFrame(raf);
      trigger?.focus({ preventScroll: true });
    };
  }, [isOpen, triggerRef]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div key={ctx.uniqueId} className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-ink-900/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden
          />
          <motion.div
            {...props}
            ref={panelRef}
            layoutId={`popover-trigger-${ctx.uniqueId}`}
            id={`popover-content-${ctx.uniqueId}`}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            style={{ borderRadius: 24 }}
            className={cn(
              "absolute inset-x-4 sm:inset-x-0 sm:mx-auto top-[6vh] max-h-[88vh] overflow-y-auto w360-scrollbar",
              "border border-[var(--w360-border)] bg-[var(--w360-bg-raised)] text-[var(--w360-text)] shadow-float",
              className
            )}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={ctx.variants}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
