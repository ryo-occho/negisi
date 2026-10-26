import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Contrast,
  LogOut,
  Moon,
  RotateCcw,
  SquareCheck,
  Sun,
  UsersRound,
} from 'lucide-react';

const icons = {
  calendar: CalendarDays,
  check: SquareCheck,
  users: UsersRound,
  sun: Sun,
  moon: Moon,
  either: Contrast,
  arrow: ArrowRight,
  logout: LogOut,
  clock: Clock3,
  refresh: RotateCcw,
};

export default function UiIcon({ name }: { name: keyof typeof icons }) {
  const Icon = icons[name];
  return (
    <Icon size={20} strokeWidth={1.7} aria-hidden="true" focusable="false" />
  );
}
