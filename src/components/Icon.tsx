/**
 * Icon wrapper: TABLER (Adilzhan picked it from the lavish icon-pack review,
 * `.lavish/torq-icons.html`, 2026-08-09), replacing lucide.
 *
 * Why: lucide's rounded terminals sat oddly against a SHARP-10 radius system
 * and a logo made of blades. Tabler is the same 2 px outline idiom on the
 * same 24-unit box (so the swap is this map and nothing else), but drawn on
 * a squarer grid, and at ~6 200 glyphs it is roughly four times the library.
 *
 * DEEP IMPORTS, not the barrel: `@tabler/icons-react-native/IconHome`
 * pulls one module, where importing from the package root would hand Metro
 * all 6 243 icons to bundle (Metro does not tree-shake). Keep it that way.
 *
 * MEASURED: this swap took the Android bundle from 6.00 MB to 4.23 MB (
 * 1.78 MB smaller) because the OLD lucide import was a barrel and was
 * shipping all ~1 600 of its icons to use 57. The saving is the import
 * style, not the pack; do not undo it by "tidying" these into one line.
 *
 * The KEYS are still the old lucide names. That is deliberate: every call
 * site in the app says `<Icon name="Dumbbell" />`, and renaming ~60 usages
 * across 20 files to say "IconBarbell" would be churn with no benefit. This
 * table is the one place the two vocabularies meet.
 */
import IconArchive from "@tabler/icons-react-native/IconArchive";
import IconArchiveOff from "@tabler/icons-react-native/IconArchiveOff";
import IconArrowsSort from "@tabler/icons-react-native/IconArrowsSort";
import IconStretching from "@tabler/icons-react-native/IconStretching";
import IconCalendarEvent from "@tabler/icons-react-native/IconCalendarEvent";
import IconCamera from "@tabler/icons-react-native/IconCamera";
import IconChartBar from "@tabler/icons-react-native/IconChartBar";
import IconCheck from "@tabler/icons-react-native/IconCheck";
import IconChecks from "@tabler/icons-react-native/IconChecks";
import IconChevronDown from "@tabler/icons-react-native/IconChevronDown";
import IconChevronLeft from "@tabler/icons-react-native/IconChevronLeft";
import IconChevronRight from "@tabler/icons-react-native/IconChevronRight";
import IconClock from "@tabler/icons-react-native/IconClock";
import IconCopy from "@tabler/icons-react-native/IconCopy";
import IconArrowsDiff from "@tabler/icons-react-native/IconArrowsDiff";
import IconBarbell from "@tabler/icons-react-native/IconBarbell";
import IconDots from "@tabler/icons-react-native/IconDots";
import IconEye from "@tabler/icons-react-native/IconEye";
import IconEyeOff from "@tabler/icons-react-native/IconEyeOff";
import IconFileText from "@tabler/icons-react-native/IconFileText";
import IconFilter from "@tabler/icons-react-native/IconFilter";
import IconFlame from "@tabler/icons-react-native/IconFlame";
import IconHistory from "@tabler/icons-react-native/IconHistory";
import IconHome from "@tabler/icons-react-native/IconHome";
import IconList from "@tabler/icons-react-native/IconList";
import IconListCheck from "@tabler/icons-react-native/IconListCheck";
import IconPlaylistAdd from "@tabler/icons-react-native/IconPlaylistAdd";
import IconLock from "@tabler/icons-react-native/IconLock";
import IconLockCheck from "@tabler/icons-react-native/IconLockCheck";
import IconMail from "@tabler/icons-react-native/IconMail";
import IconMedal from "@tabler/icons-react-native/IconMedal";
import IconMinus from "@tabler/icons-react-native/IconMinus";
import IconMoon from "@tabler/icons-react-native/IconMoon";
import IconPlayerPause from "@tabler/icons-react-native/IconPlayerPause";
import IconPencil from "@tabler/icons-react-native/IconPencil";
import IconPin from "@tabler/icons-react-native/IconPin";
import IconPlayerPlay from "@tabler/icons-react-native/IconPlayerPlay";
import IconPlus from "@tabler/icons-react-native/IconPlus";
import IconRepeat from "@tabler/icons-react-native/IconRepeat";
import IconRuler from "@tabler/icons-react-native/IconRuler";
import IconDeviceFloppy from "@tabler/icons-react-native/IconDeviceFloppy";
import IconScale from "@tabler/icons-react-native/IconScale";
import IconSearch from "@tabler/icons-react-native/IconSearch";
import IconShare from "@tabler/icons-react-native/IconShare";
import IconAdjustments from "@tabler/icons-react-native/IconAdjustments";
import IconSparkles from "@tabler/icons-react-native/IconSparkles";
import IconStopwatch from "@tabler/icons-react-native/IconStopwatch";
import IconTrash from "@tabler/icons-react-native/IconTrash";
import IconTrendingDown from "@tabler/icons-react-native/IconTrendingDown";
import IconTrendingUp from "@tabler/icons-react-native/IconTrendingUp";
import IconAlertTriangle from "@tabler/icons-react-native/IconAlertTriangle";
import IconTrophy from "@tabler/icons-react-native/IconTrophy";
import IconArrowBackUp from "@tabler/icons-react-native/IconArrowBackUp";
import IconUserCircle from "@tabler/icons-react-native/IconUserCircle";
import IconUser from "@tabler/icons-react-native/IconUser";
import IconRoute from "@tabler/icons-react-native/IconRoute";
import IconX from "@tabler/icons-react-native/IconX";
import { C } from "../theme";

import type { ComponentType } from "react";
import type { SvgProps } from "react-native-svg";

type TablerIcon = ComponentType<SvgProps & { size?: number | string; strokeWidth?: number | string }>;

const MAP: Record<string, TablerIcon> = {
  Archive: IconArchive,
  ArchiveRestore: IconArchiveOff,
  ArrowUpDown: IconArrowsSort,
  BicepsFlexed: IconStretching,
  CalendarDays: IconCalendarEvent,
  Camera: IconCamera,
  ChartColumn: IconChartBar,
  Check: IconCheck,
  CheckCheck: IconChecks,
  ChevronDown: IconChevronDown,
  ChevronLeft: IconChevronLeft,
  ChevronRight: IconChevronRight,
  Clock: IconClock,
  Copy: IconCopy,
  Diff: IconArrowsDiff,
  Dumbbell: IconBarbell,
  Ellipsis: IconDots,
  Eye: IconEye,
  EyeOff: IconEyeOff,
  FileText: IconFileText,
  Filter: IconFilter,
  Flame: IconFlame,
  History: IconHistory,
  House: IconHome,
  List: IconList,
  ListChecks: IconListCheck,
  ListPlus: IconPlaylistAdd,
  Lock: IconLock,
  LockKeyhole: IconLockCheck,
  Mail: IconMail,
  Medal: IconMedal,
  Minus: IconMinus,
  Moon: IconMoon,
  Pause: IconPlayerPause,
  Pencil: IconPencil,
  Pin: IconPin,
  Play: IconPlayerPlay,
  Plus: IconPlus,
  Repeat: IconRepeat,
  Ruler: IconRuler,
  Save: IconDeviceFloppy,
  Scale: IconScale,
  Search: IconSearch,
  Share2: IconShare,
  SlidersVertical: IconAdjustments,
  Sparkles: IconSparkles,
  Timer: IconStopwatch,
  Trash2: IconTrash,
  TrendingDown: IconTrendingDown,
  TrendingUp: IconTrendingUp,
  TriangleAlert: IconAlertTriangle,
  Trophy: IconTrophy,
  Undo2: IconArrowBackUp,
  UserCircle: IconUserCircle,
  UserRound: IconUser,
  Waypoints: IconRoute,
  X: IconX,
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
  const Cmp = MAP[name];
  if (!Cmp) return null;
  return <Cmp size={size} color={color} strokeWidth={strokeWidth} />;
}
