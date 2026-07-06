/** Icon wrapper over lucide-react-native, name-mapped like grit's Icon. */
import {
  BicepsFlexed,
  CalendarDays,
  ChartColumn,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dumbbell,
  Flame,
  History,
  ListChecks,
  ListPlus,
  Minus,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  Ruler,
  Save,
  Scale,
  Search,
  Sparkles,
  Timer,
  TrendingDown,
  TrendingUp,
  Trash2,
  Trophy,
  UserCircle,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { C } from "../theme";

const MAP: Record<string, LucideIcon> = {
  BicepsFlexed, CalendarDays, ChartColumn, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, Clock, Dumbbell,
  Flame, History, ListChecks, ListPlus, Minus, Pause, Pencil, Play, Plus, Repeat, Ruler,
  Save, Scale, Search, Sparkles, Timer, TrendingDown, TrendingUp, Trash2, Trophy, UserCircle, X,
};

export function Icon({
  name,
  size = 20,
  color = C.ink,
  strokeWidth = 2.4,
}: {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const Cmp = MAP[name] ?? Sparkles;
  return <Cmp size={size} color={color} strokeWidth={strokeWidth} />;
}
