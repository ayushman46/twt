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
  primary: 'btn-brand',
  secondary: 'bg-panel-2 text-fg hover:bg-panel-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]',
  soft: 'bg-accent-soft text-accent hover:bg-accent/20',
  ghost: 'text-fg-2 hover:bg-panel-2 hover:text-fg',
  outline: 'border border-line-strong bg-panel text-fg hover:bg-panel-2 hover:border-line-strong shadow-card',
  danger: 'bg-bad/10 text-bad hover:bg-bad/15',
};

const sizes: Record<Size, string> = {
  xs: 'h-7 px-2.5 text-xs gap-1.5 rounded-lg',
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-[10px]',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-xl',
  icon: 'h-9 w-9 rounded-[10px]',
  'icon-sm': 'h-7 w-7 rounded-lg',
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
        'inline-flex shrink-0 select-none items-center justify-center font-medium whitespace-nowrap transition-[background,color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
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

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-[10px] border border-line-strong bg-panel px-3 text-sm text-fg shadow-card placeholder:text-faint transition-[box-shadow,border-color] outline-none focus:border-accent/60 focus:ring-4 focus:ring-accent/15',
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full resize-none rounded-xl border border-line-strong bg-panel px-3 py-2.5 text-sm leading-relaxed text-fg placeholder:text-faint outline-none focus:border-accent/60 focus:ring-4 focus:ring-accent/15',
        className,
      )}
      {...props}
    />
  );
});

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line-strong bg-panel-2 px-1 font-sans text-[10.5px] font-medium text-muted shadow-[inset_0_-1px_0_var(--line)]',
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
      className={cn('inline-flex h-[22px] max-w-full items-center gap-1 truncate rounded-full px-2 text-[11.5px] font-medium', !color && 'bg-panel-2 text-fg-2', className)}
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
      <span className="text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">{children}</span>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md animate-rise flex-col items-center px-6 py-20 text-center">
      {icon ? <div className="mb-5 grid size-14 place-items-center rounded-2xl bg-panel-2 text-muted [&_svg]:size-6">{icon}</div> : null}
      <h3 className="text-[17px] font-semibold tracking-tight text-fg">{title}</h3>
      {children ? <div className="mt-2 text-sm leading-relaxed text-muted">{children}</div> : null}
      {action ? <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-2xl border border-line bg-panel shadow-card', className)}>{children}</div>;
}

/** Small uppercase eyebrow label used above premium headings. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('text-[11px] font-semibold tracking-[0.12em] text-faint uppercase', className)}>{children}</div>;
}
