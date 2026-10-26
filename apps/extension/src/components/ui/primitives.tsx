import { clsx, type ClassValue } from 'clsx';
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { twMerge } from 'tailwind-merge';
import { LoaderCircle } from 'lucide-react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'soft';
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const variants: Record<Variant, string> = {
  /* Solid accent. One per view. */
  primary: 'btn-brand',
  /* Bordered panel: the default for everything else. */
  secondary: 'border border-line bg-panel text-fg hover:bg-panel-2',
  soft: 'bg-accent-soft text-accent hover:bg-accent/15',
  ghost: 'text-fg-2 hover:bg-panel-2 hover:text-fg',
  outline: 'border border-line-strong bg-panel text-fg hover:bg-panel-2',
  /* Destructive: neutral until hovered, then red. */
  danger: 'text-fg-2 hover:bg-panel-2 hover:text-bad',
};

const sizes: Record<Size, string> = {
  xs: 'h-7 gap-1.5 rounded-lg px-2.5 text-xs',
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-[13px]',
  md: 'h-9 gap-2 rounded-lg px-3.5 text-sm',
  lg: 'h-11 gap-2 rounded-xl px-5 text-[15px]',
  icon: 'h-9 w-9 rounded-lg',
  'icon-sm': 'h-7 w-7 rounded-md max-sm:h-9 max-sm:w-9',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap select-none transition-colors duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <LoaderCircle className="animate-spin" /> : null}
      {children}
    </button>
  );
});

const field =
  'w-full border border-line-strong bg-panel text-fg outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-accent focus:shadow-[inset_0_0_0_1px_var(--accent)]';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(field, 'h-9 rounded-lg px-3 text-sm', className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(field, 'resize-none rounded-lg px-3 py-2.5 text-sm leading-relaxed', className)} {...props} />;
});

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line-strong bg-panel-2 px-1 font-sans text-[11px] font-medium text-muted',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function Badge({ children, className, color }: { children: ReactNode; className?: string; color?: string }) {
  return (
    <span
      className={cn('inline-flex h-[22px] max-w-full items-center gap-1 truncate rounded-full px-2 text-[12px] font-medium', !color && 'bg-panel-2 text-fg-2', className)}
      style={color ? { background: `color-mix(in oklab, ${color} 14%, transparent)`, color: `color-mix(in oklab, ${color} 75%, var(--fg))` } : undefined}
    >
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn('size-4 animate-spin text-muted', className)} />;
}

export function SectionLabel({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between px-2.5 pt-4 pb-1.5', className)}>
      <span className="text-[12px] font-medium text-muted">{children}</span>
      {action}
    </div>
  );
}

/** One icon in muted text, a heading, one sentence and one button. No tile. */
export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md animate-rise flex-col items-center px-6 py-20 text-center">
      {icon ? <div className="mb-4 text-muted [&_svg]:size-6">{icon}</div> : null}
      <h3 className="text-[16px] font-semibold tracking-tight text-fg">{title}</h3>
      {children ? <div className="mt-1.5 text-sm leading-relaxed text-muted">{children}</div> : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/** A flat panel: hairline border, no shadow. */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-xl border border-line bg-panel', className)}>{children}</div>;
}

/** Small muted label above a heading. Sentence case, no uppercase eyebrow. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('text-[12px] font-medium text-muted', className)}>{children}</div>;
}
