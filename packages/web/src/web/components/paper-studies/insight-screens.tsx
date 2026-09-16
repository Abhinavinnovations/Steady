import { useState } from "react";
import {
  Award,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  LockKeyhole,
  Sparkles,
  Sprout,
  Trophy,
} from "lucide-react";
import {
  DayLegend,
  Eyebrow,
  Header,
  IconButton,
  SectionTitle,
  Segments,
  SwitchControl,
  dayState,
  type Notify,
} from "./primitives";

export function ProgressScreen({ notify }: { notify: Notify }) {
  const [range, setRange] = useState("Week");
  return (
    <div className="ps-scroll">
      <Header title="Progress">
        <p>Small steps leave a lasting mark.</p>
      </Header>
      <div className="ps-body">
        <Segments
          label="Progress range"
          values={["Week", "Month", "Year"]}
          value={range}
          onChange={setRange}
        />
        <div className="ps-stats">
          <div>
            <strong>
              7<span>days</span>
            </strong>
            <p>Active streak</p>
          </div>
          <div>
            <strong>
              7<span>days</span>
            </strong>
            <p>Best streak</p>
          </div>
          <div>
            <strong>
              {range === "Week" ? 100 : 92}
              <span>%</span>
            </strong>
            <p>Consistency</p>
          </div>
        </div>
        <section className="ps-days-section">
          <SectionTitle aside={<span>{range === "Week" ? "SEP 7–13" : "2026"}</span>}>
            {range === "Week" ? "Last 7 days" : range === "Month" ? "This month" : "Last 12 months"}
          </SectionTitle>
          {range === "Week" ? (
            <div className="ps-week">
              {["M", "T", "W", "T", "F", "S", "S"].map((label, i) => (
                <div key={i}>
                  <span>{label}</span>
                  <div className={`ps-week-day ${i < 6 ? "ps-done" : "ps-now"}`}>
                    {i < 6 ? <Check size={17} /> : 13}
                  </div>
                  <small>{i + 7}</small>
                </div>
              ))}
            </div>
          ) : range === "Month" ? (
            <div className="ps-mini-month">
              {Array.from({ length: 13 }, (_, i) => (
                <span className={dayState(i + 1)} key={i}>
                  {i + 1}
                </span>
              ))}
            </div>
          ) : (
            <div className="ps-year-dots" aria-label="Last 365 days: 352 rest days before September; 11 complete, 1 missed, and today in progress">
              {Array.from({ length: 365 }, (_, i) => <span aria-hidden="true" key={i} className={i < 352 ? "ps-rest" : dayState(i - 351)} />)}
            </div>
          )}
          <DayLegend />
          <p className="ps-caption">
            {range === "Week"
              ? "6 of 6 elapsed commitment days complete."
              : "11 of 12 elapsed commitment days complete."}
            <br />
            Today is still in progress.
          </p>
        </section>
        <SectionTitle aside={<span>2 OF 6 EARNED</span>}>Badges</SectionTitle>
        <div className="ps-badges">
          {[
            { name: "First day", Icon: Sprout },
            { name: "7-day streak", Icon: Flame },
            { name: "30-day streak", Icon: Sparkles },
            { name: "100-day streak", Icon: Trophy },
            { name: "Century", Icon: Award },
            { name: "Perfect month", Icon: Award },
          ].map(({ name, Icon }, index) => (
            <button
              type="button"
              key={name}
              className={index < 2 ? "ps-badge-earned" : ""}
              onClick={() =>
                notify(
                  `${name}: ${index < 2 ? "earned in this illustrative sample" : "not yet earned in this illustrative sample"}. No real account achievements are shown.`,
                )
              }
            >
              <span>
                <Icon size={22} strokeWidth={1.5} />
                {index >= 2 && <LockKeyhole className="ps-lock" size={9} />}
              </span>
              <small>{name}</small>
            </button>
          ))}
        </div>
        <SectionTitle aside={<span>YOUR WORDS</span>}>Journal</SectionTitle>
        <article className="ps-journal">
          <div className="ps-between">
            <strong>Read 20 pages</strong>
            <span>Sep 13</span>
          </div>
          <p>“Read twenty pages before checking my phone. A quieter start.”</p>
        </article>
      </div>
    </div>
  );
}

export function RanksScreen({ notify }: { notify: Notify }) {
  const [mode, setMode] = useState("Challenge");
  const [range, setRange] = useState("Month");
  const [tasks, setTasks] = useState("2 tasks");
  const [visible, setVisible] = useState(true);
  const rows = range === "Week" ? [6, 6, 6, 5, 4] : [12, 12, 11, 10, 9];
  return (
    <div className="ps-scroll">
      <Header title="Ranks">
        <p>
          Boards are split by mode and task count, so it’s fair. Score is full days — every task
          done.
        </p>
      </Header>
      <div className="ps-body">
        <Segments
          label="Board mode"
          values={["Basic", "Challenge"]}
          value={mode}
          onChange={setMode}
        />
        <div className="ps-filter-space">
          <Segments
            label="Board period"
            values={["Week", "Month", "Year"]}
            value={range}
            onChange={setRange}
          />
        </div>
        <fieldset className="ps-chips ps-rank-chips" aria-label="Board task count">
          {["1 task", "2 tasks", "3+ tasks"].map((item) => (
            <button
              type="button"
              key={item}
              aria-pressed={tasks === item}
              className={tasks === item ? "ps-chip-active" : ""}
              onClick={() => setTasks(item)}
            >
              {item}
            </button>
          ))}
        </fieldset>
        <div className="ps-board-head">
          <Eyebrow>
            {range === "Week" ? "THIS WEEK" : range === "Year" ? "THIS YEAR" : "SEPTEMBER"}
          </Eyebrow>
          <span>FULL DAYS</span>
        </div>
        <div className="ps-board">
          {[
            "Maya R.",
            "Noah K.",
            mode === "Challenge" && tasks === "2 tasks" && visible ? "Alex Morgan" : "Robin S.",
            "Sam T.",
            "Jules W.",
          ].map((name, index) => {
            const you = name === "Alex Morgan";
            return (
              <div className={`ps-rank-row ${you ? "ps-you" : ""}`} key={name}>
                <span className="ps-position">{index + 1}</span>
                <div className={`ps-avatar ps-avatar-${index}`}>{name[0]}</div>
                <div className="ps-rank-name">
                  <strong>
                    {name} {you && <small>(you)</small>}
                  </strong>
                  <span>
                    {tasks === "1 task" ? "1 task" : tasks === "3+ tasks" ? "3 tasks" : "2 tasks"}{" "}
                    this month
                  </span>
                </div>
                <div className="ps-rank-score">
                  <strong>{rows[index]}</strong>
                  <span>
                    <Flame size={10} />
                    {[12, 12, 7, 5, 4][index]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="ps-caption">Illustrative board · not live rankings</p>
        <div className="ps-privacy">
          <div className="ps-between">
            <strong>Appear on leaderboards</strong>
            <SwitchControl
              label="Appear on sample leaderboards"
              checked={visible}
              onChange={() => {
                setVisible(!visible);
                notify(
                  "Sample visibility changed here only. Your real leaderboard setting is unchanged.",
                );
              }}
            />
          </div>
          <p>
            Only your name and numbers.
            <br />
            Never your tasks or notes.
          </p>
        </div>
      </div>
    </div>
  );
}

export function CalendarScreen({ notify }: { notify: Notify }) {
  const [selected, setSelected] = useState(13);
  return (
    <div className="ps-scroll">
      <Header title="Calendar">
        <p>Everything scheduled, in one place. UTC.</p>
      </Header>
      <div className="ps-body">
        <div className="ps-month-heading">
          <IconButton
            label="Previous month preview"
            onClick={() =>
              notify(
                "This design study uses September 2026 sample data. Month navigation in the real app is unchanged.",
              )
            }
          >
            <ChevronLeft size={18} />
          </IconButton>
          <h3>
            September <span>2026</span>
          </h3>
          <IconButton
            label="Next month preview"
            onClick={() =>
              notify(
                "This design study uses September 2026 sample data. No live schedule is loaded.",
              )
            }
          >
            <ChevronRight size={18} />
          </IconButton>
        </div>
        <div className="ps-calendar-grid">
          <div className="ps-calendar-weekdays">
            {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
              <span key={i}>{day}</span>
            ))}
          </div>
          <div className="ps-calendar-dates">
            <span />
            <span />
            {Array.from({ length: 30 }, (_, i) => {
              const day = i + 1;
              return (
                <button
                  type="button"
                  key={day}
                  aria-label={`September ${day}${day < 13 ? (day === 5 ? ", missed" : ", full day") : day === 13 ? ", today, to-do due" : ", upcoming"}`}
                  aria-pressed={selected === day}
                  className={`${dayState(day)} ${selected === day ? "ps-day-selected" : ""}`}
                  onClick={() => setSelected(day)}
                >
                  {day}
                  {day === 13 && <i />}
                </button>
              );
            })}
          </div>
        </div>
        <DayLegend calendar />
        <section className="ps-day-panel">
          <div className="ps-between">
            <h3>
              {selected === 13 ? "Today" : `September ${selected}`} <span>· Sep {selected}</span>
            </h3>
            <span className="ps-day-status">
              {selected === 13
                ? "IN PROGRESS"
                : selected > 13
                  ? "UPCOMING"
                  : selected === 5
                    ? "MISSED"
                    : "FULL DAY"}
            </span>
          </div>
          {selected === 13 && (
            <>
              <Eyebrow>TO-DOS DUE</Eyebrow>
              <div className="ps-due-task">
                <span className="ps-check" />
                Book a dentist appointment
              </div>
              <p className="ps-caption">Complete consistent tasks with a note in Today.</p>
            </>
          )}
          <Eyebrow>EVERY DAY</Eyebrow>
          <div className="ps-scheduled">
            <div>
              <strong>Read 20 pages</strong>
              <span>08:00 UTC · 20 min</span>
            </div>
            <span className="ps-task-tag">Challenge</span>
          </div>
          <div className="ps-scheduled">
            <div>
              <strong>Walk outside</strong>
              <span>18:00 UTC · 30 min</span>
            </div>
            <span className="ps-task-tag">Challenge</span>
          </div>
        </section>
        <p className="ps-caption ps-calendar-note">
          Consistent tasks repeat every day of the month. To-dos never affect these day colors.
        </p>
      </div>
    </div>
  );
}
