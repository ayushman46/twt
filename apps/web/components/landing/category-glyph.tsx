import clsx from "clsx";
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
} from "lucide-react";

/** One quiet line icon per built-in category (same set as the extension's CategoryGlyph). */
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

/** Category icon; inherits its colour from the parent (usually `text-muted`). */
export function CategoryGlyph({ id, className }: { id: string; className?: string }) {
  const Icon = ICONS[id] ?? Shapes;
  return <Icon aria-hidden="true" className={clsx("size-[1em] shrink-0", className)} />;
}
