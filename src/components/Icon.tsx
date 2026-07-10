/** Icon wrapper over lucide-react-native, name-mapped like grit's Icon. */
import {
  ArrowUpDown,
  BicepsFlexed,
  CalendarDays,
  ChartColumn,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Diff,
  Dumbbell,
  Ellipsis,
  FileText,
  Filter,
  Flame,
  History,
  House,
  List,
  ListChecks,
  ListPlus,
  Minus,
  Moon,
  Pause,
  Pencil,
  Pin,
  Play,
  Plus,
  Repeat,
  Ruler,
  Save,
  Scale,
  Search,
  Share2,
  SlidersVertical,
  Sparkles,
  Timer,
  TrendingDown,
  TrendingUp,
  Trash2,
  Trophy,
  Undo2,
  UserCircle,
  Waypoints,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { C } from "../theme";

const MAP: Record<string, LucideIcon> = {
  ArrowUpDown, BicepsFlexed, CalendarDays, ChartColumn, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, Clock, Diff, Dumbbell,
  Ellipsis, FileText, Filter, Flame, History, House, List, ListChecks, ListPlus, Minus, Moon, Pause, Pencil, Pin, Play, Plus, Repeat, Ruler,
  Save, Scale, Search, Share2, SlidersVertical, Sparkles, Timer, TrendingDown, TrendingUp, Trash2, Trophy, Undo2, UserCircle, Waypoints, X,
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
