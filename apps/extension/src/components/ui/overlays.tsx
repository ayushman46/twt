import { Dialog as D, DropdownMenu as M, Popover as P, Switch as S, Tooltip as T } from 'radix-ui';
import { Check, ChevronRight, X } from 'lucide-react';
import { cloneElement, createContext, useContext, useState, type ComponentPropsWithoutRef, type ReactElement, type ReactNode, type SyntheticEvent } from 'react';
import { t } from '@/i18n/core';
import { cn } from './primitives';

/* Tooltip */

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <T.Provider delayDuration={350} skipDelayDuration={150}>
      {children}
    </T.Provider>
  );
}

export function Tip({ label, children, side = 'top', shortcut }: { label: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right'; shortcut?: string }) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className="z-[80] flex animate-fade-in items-center gap-2 rounded-lg border border-line bg-panel px-2 py-1 text-xs font-medium text-fg shadow-pop"
        >
          {label}
          {shortcut ? <span className="rounded bg-panel-2 px-1 text-[10px] text-muted">{shortcut}</span> : null}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

type Handler = (e: SyntheticEvent) => void;

/**
 * Tooltip that mounts Radix only after the trigger is first hovered/focused.
 * Cards render several tooltips each; deferring them keeps card mounts cheap.
 */
export function LazyTip({ label, children, side, shortcut }: { label: ReactNode; children: ReactElement<{ onPointerEnter?: Handler; onFocus?: Handler }>; side?: 'top' | 'bottom' | 'left' | 'right'; shortcut?: string }) {
  const [armed, setArmed] = useState(false);
  if (armed)
    return (
      <Tip label={label} side={side} shortcut={shortcut}>
        {children}
      </Tip>
    );
  return cloneElement(children, {
    onPointerEnter: (e: SyntheticEvent) => {
      children.props.onPointerEnter?.(e);
      setArmed(true);
    },
    onFocus: (e: SyntheticEvent) => {
      children.props.onFocus?.(e);
      setArmed(true);
    },
  });
}

/* Dropdown menu */

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;
export const MenuSub = M.Sub;
export const MenuGroup = M.Group;

const menuPanel =
  'z-[70] min-w-[200px] overflow-hidden rounded-xl border border-line bg-panel p-1 text-sm text-fg shadow-pop data-[state=open]:animate-fade-in max-h-[min(70vh,var(--radix-dropdown-menu-content-available-height))] overflow-y-auto';

export function MenuContent({ className, align = 'end', ...props }: ComponentPropsWithoutRef<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content align={align} sideOffset={6} collisionPadding={10} className={cn(menuPanel, className)} {...props} />
    </M.Portal>
  );
}

const itemCls =
  'relative flex h-8 cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 text-[13px] outline-none data-[highlighted]:bg-panel-2 data-[disabled]:opacity-40 [&_svg]:size-4 [&_svg]:text-muted';

export function MenuItem({ className, danger, shortcut, children, ...props }: ComponentPropsWithoutRef<typeof M.Item> & { danger?: boolean; shortcut?: string }) {
  return (
    <M.Item className={cn(itemCls, danger && 'text-bad [&_svg]:text-bad', className)} {...props}>
      {children}
      {shortcut ? <span className="ml-auto pl-4 text-[11px] text-faint">{shortcut}</span> : null}
    </M.Item>
  );
}

export function MenuCheckItem({ className, children, ...props }: ComponentPropsWithoutRef<typeof M.CheckboxItem>) {
  return (
    <M.CheckboxItem className={cn(itemCls, 'pr-8', className)} {...props}>
      {children}
      <M.ItemIndicator className="absolute right-2.5">
        <Check className="!text-accent" />
      </M.ItemIndicator>
    </M.CheckboxItem>
  );
}

export function MenuRadioGroup(props: ComponentPropsWithoutRef<typeof M.RadioGroup>) {
  return <M.RadioGroup {...props} />;
}

export function MenuRadioItem({ className, children, ...props }: ComponentPropsWithoutRef<typeof M.RadioItem>) {
  return (
    <M.RadioItem className={cn(itemCls, 'pr-8', className)} {...props}>
      {children}
      <M.ItemIndicator className="absolute right-2.5">
        <Check className="!text-accent" />
      </M.ItemIndicator>
    </M.RadioItem>
  );
}

export function MenuSubTrigger({ className, children, ...props }: ComponentPropsWithoutRef<typeof M.SubTrigger>) {
  return (
    <M.SubTrigger className={cn(itemCls, 'data-[state=open]:bg-panel-2', className)} {...props}>
      {children}
      <ChevronRight className="ml-auto !size-3.5" />
    </M.SubTrigger>
  );
}

export function MenuSubContent({ className, ...props }: ComponentPropsWithoutRef<typeof M.SubContent>) {
  return (
    <M.Portal>
      <M.SubContent sideOffset={6} collisionPadding={10} className={cn(menuPanel, className)} {...props} />
    </M.Portal>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <M.Label className="px-2.5 pt-2 pb-1 text-[12px] font-medium text-muted">{children}</M.Label>;
}

export function MenuSeparator() {
  return <M.Separator className="my-1 h-px bg-line" />;
}

/* Popover */

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;

export function PopoverContent({ className, align = 'start', ...props }: ComponentPropsWithoutRef<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        align={align}
        sideOffset={8}
        collisionPadding={12}
        className={cn('z-[70] rounded-xl border border-line bg-panel p-3 text-sm text-fg shadow-pop outline-none data-[state=open]:animate-fade-in', className)}
        {...props}
      />
    </P.Portal>
  );
}

/* Dialog */

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  hideClose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  hideClose?: boolean;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[60] bg-black/40 data-[state=open]:animate-fade-in" />
        <D.Content
          aria-describedby={description ? undefined : undefined}
          className={cn(
            'fixed top-[12vh] left-1/2 z-[61] w-[calc(100vw-32px)] max-w-lg -translate-x-1/2 animate-rise rounded-2xl border border-line bg-panel p-5 text-fg shadow-pop outline-none',
            className,
          )}
        >
          {title ? <D.Title className="pr-8 text-[16px] font-semibold tracking-tight">{title}</D.Title> : <D.Title className="sr-only">{t('common.dialog')}</D.Title>}
          {description ? <D.Description className="mt-1 text-sm text-muted">{description}</D.Description> : <D.Description className="sr-only">{t('common.dialog')}</D.Description>}
          <div className={cn(title || description ? 'mt-4' : '')}>{children}</div>
          {!hideClose ? (
            <D.Close className="absolute top-4 right-4 grid size-7 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-fg" aria-label={t('common.close')}>
              <X className="size-4" />
            </D.Close>
          ) : null}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/* Switch */

/** Id of the visible label for controls rendered inside a labelled settings row. */
export const FieldLabelContext = createContext<string | undefined>(undefined);

export function Switch({ checked, onCheckedChange, disabled, id, label }: { checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean; id?: string; label?: string }) {
  const labelledBy = useContext(FieldLabelContext);
  return (
    <S.Root
      id={id}
      aria-label={label}
      aria-labelledby={label ? undefined : labelledBy}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className="relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full bg-panel-3 transition-colors data-[state=checked]:bg-accent disabled:opacity-50"
    >
      <S.Thumb className="block size-[18px] translate-x-[2px] rounded-full bg-white shadow-sm transition-transform duration-200 data-[state=checked]:translate-x-[18px]" />
    </S.Root>
  );
}
