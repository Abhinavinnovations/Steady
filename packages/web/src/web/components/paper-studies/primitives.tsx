import type { ReactNode } from "react";
import {
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  CircleCheck,
  Flame,
  Trophy,
  UserRound,
} from "lucide-react";

export const studyScreens = [
  {
    id: "choice",
    name: "Basic / Challenge",
    detail: "A private start, or someone in your corner. The same setup rules, on quieter paper.",
  },
  {
    id: "today",
    name: "Today",
    detail: "Paper above, clarity below. Daily commitments and low-pressure to-dos stay distinct.",
  },
  {
    id: "progress",
    name: "Progress",
    detail: "Streaks, full days, badges and the journal. Color marks meaning, not decoration.",
  },
  {
    id: "ranks",
    name: "Ranks",
    detail:
      "The existing fair-play filters. Rankings count full days, never individual task checkmarks.",
  },
  {
    id: "calendar",
    name: "Calendar",
    detail: "One month at a glance, with daily commitments separated from dated to-dos.",
  },
  {
    id: "profile",
    name: "Profile",
    detail: "Identity, month rules and appearance. Accountability continues below the fold.",
  },
  {
    id: "people",
    name: "Profile · your people",
    detail: "A second view of the same Profile, so both contact and partner sections are visible.",
  },
  {
    id: "note",
    name: "Completion note",
    detail:
      "One honest line before a consistent task is complete. The ten-character minimum is unchanged.",
  },
  {
    id: "glass",
    name: "Glass navigation",
    detail:
      "A close-up of the five-tab capsule. Translucent material, reflective edges and an inset selected tab.",
  },
] as const;
export type ScreenId = (typeof studyScreens)[number]["id"];
export type Notify = (message: string) => void;

export function IconButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className="ps-icon-button" aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}
export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="ps-eyebrow">{children}</div>;
}
export function Header({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="ps-header">
      <div className="ps-brand-row">
        <span>STEADY</span>
        <span className="ps-sample">SAMPLE PREVIEW</span>
      </div>
      <div className="ps-title-row">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </header>
  );
}
export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="ps-section-title">
      <h3>{children}</h3>
      {aside}
    </div>
  );
}
export function Segments({
  values,
  value,
  onChange,
  label,
}: {
  values: string[];
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <fieldset className="ps-segments" aria-label={label}>
      {values.map((item) => (
        <button
          type="button"
          key={item}
          aria-pressed={value === item}
          className={value === item ? "ps-selected" : ""}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </fieldset>
  );
}
export function Streak({ count = 7 }: { count?: number }) {
  return (
    <span className="ps-streak">
      <Flame size={14} strokeWidth={1.7} />
      {count} days
    </span>
  );
}
export function SwitchControl({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`ps-switch ${checked ? "ps-on" : ""}`}
      onClick={onChange}
    >
      <span />
    </button>
  );
}
export function GlassNav({
  active,
  onChange,
}: {
  active: ScreenId;
  onChange: (id: ScreenId) => void;
}) {
  const items = [
    ["today", "Today", CircleCheck],
    ["progress", "Progress", ChartNoAxesColumnIncreasing],
    ["ranks", "Ranks", Trophy],
    ["calendar", "Calendar", CalendarDays],
    ["profile", "Profile", UserRound],
  ] as const;
  return (
    <nav className="ps-glass" aria-label="App preview navigation">
      {items.map(([id, label, Icon]) => (
        <button
          type="button"
          key={id}
          aria-current={
            active === id || (id === "profile" && active === "people") ? "page" : undefined
          }
          onClick={() => onChange(id)}
        >
          <Icon size={21} strokeWidth={1.65} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
export function DayLegend({ calendar = false }: { calendar?: boolean }) {
  return (
    <div className="ps-legend">
      <span>
        <i className="ps-dot ps-done" />
        {calendar ? "Full day" : "Done"}
      </span>
      <span>
        <i className="ps-dot ps-missed" />
        Missed
      </span>
      <span>
        <i className="ps-dot ps-rest" />
        Rest
      </span>
      <span>
        <i className={`ps-dot ${calendar ? "ps-due" : "ps-now"}`} />
        {calendar ? "To-do due" : "Today"}
      </span>
    </div>
  );
}
export const fullDays = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12];
export function dayState(day: number) {
  return day === 13
    ? "ps-now"
    : fullDays.includes(day)
      ? "ps-done"
      : day === 5
        ? "ps-missed"
        : "ps-rest";
}
