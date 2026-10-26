import {
  Bitcoin,
  Briefcase,
  ChartLine,
  Clapperboard,
  Code,
  Cpu,
  FlaskConical,
  GraduationCap,
  HeartPulse,
  Laugh,
  Megaphone,
  Newspaper,
  PenTool,
  Rocket,
  Shapes,
  Timer,
  Trophy,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { cn } from './ui/primitives';

/** One quiet line icon per built-in category. Emoji stay only for categories the user made. */
const ICONS: Record<string, LucideIcon> = {
  ai: Cpu,
  dev: Code,
  design: PenTool,
  startups: Rocket,
  marketing: Megaphone,
  finance: ChartLine,
  crypto: Bitcoin,
  productivity: Timer,
  career: Briefcase,
  science: FlaskConical,
  health: HeartPulse,
  learning: GraduationCap,
  tools: Wrench,
  news: Newspaper,
  sports: Trophy,
  culture: Clapperboard,
  humor: Laugh,
  other: Shapes,
};

export interface GlyphCategory {
  id: string;
  emoji?: string;
  builtin?: boolean;
}

/** Renders a category's icon. Inherits colour from its parent (use `text-muted` or the category colour). */
export function CategoryGlyph({ category, className }: { category: GlyphCategory; className?: string }) {
  const Icon = category.builtin !== false ? ICONS[category.id] : undefined;
  if (Icon) return <Icon aria-hidden strokeWidth={1.75} className={cn('size-[1em] shrink-0', className)} />;
  return (
    <span aria-hidden className={cn('inline-block shrink-0 leading-none', className)}>
      {category.emoji || '•'}
    </span>
  );
}
