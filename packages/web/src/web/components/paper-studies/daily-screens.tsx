import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, Flag, Leaf, Mic, Plus, Users, X } from "lucide-react";
import { Eyebrow, Header, IconButton, SectionTitle, Streak, type Notify } from "./primitives";

export function ChoiceScreen({ notify }: { notify: Notify }) {
  const [mode, setMode] = useState("");
  return (
    <div className="ps-scroll ps-choice">
      <Header title="How do you want to show up?">
        <Eyebrow>YOUR WAY</Eyebrow>
        <p>Start privately, or add someone who keeps you accountable. You choose.</p>
      </Header>
      <fieldset className="ps-choice-options" aria-label="Choose your mode">
        {[
          {
            name: "Basic",
            Icon: Leaf,
            copy: "Build consistency privately. Set up a commitment now, or skip and start with to-dos.",
            tag: "JUST FOR YOU",
          },
          {
            name: "Challenge",
            Icon: Users,
            copy: "Verify an accountability contact. Challenge starts only when you confirm your commitment.",
            tag: "BETTER, TOGETHER",
          },
        ].map(({ name, Icon, copy, tag }) => (
          <button
            type="button"
            className={`ps-mode ${mode === name ? "ps-mode-selected" : ""}`}
            key={name}
            aria-pressed={mode === name}
            onClick={() => setMode(name)}
          >
            <div className="ps-mode-top">
              <Icon size={23} strokeWidth={1.5} />
              <span className="ps-radio">{mode === name && <span />}</span>
            </div>
            <strong>{name}</strong>
            <p>{copy}</p>
            <span className="ps-mode-tag">{tag}</span>
          </button>
        ))}
      </fieldset>
      <div className="ps-choice-footer">
        <button
          type="button"
          className="ps-primary"
          disabled={!mode}
          onClick={() =>
            notify(
              mode === "Basic"
                ? "Preview only: Basic would let you create a commitment or skip to to-dos. Nothing has started."
                : "Preview only: Challenge requires a verified contact, then your explicit commitment confirmation. Nothing has started.",
            )
          }
        >
          Continue <ArrowRight size={18} />
        </button>
        <p>Your pace. Your choice.</p>
      </div>
    </div>
  );
}

export function TodayScreen({
  notify,
  openNote,
  completed,
  note,
  undo,
}: {
  notify: Notify;
  openNote: () => void;
  completed: boolean;
  note: string;
  undo: () => void;
}) {
  const [todo, setTodo] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [category, setCategory] = useState("All");
  const [flagged, setFlagged] = useState(false);
  return (
    <div className="ps-scroll">
      <Header
        title="Today"
        action={
          <IconButton
            label="Voice capture preview"
            onClick={() =>
              notify(
                "Voice capture stays in the existing app. This screenshot preview never records audio.",
              )
            }
          >
            <Mic size={21} />
          </IconButton>
        }
      >
        <div className="ps-between">
          <p>Sunday, September 13</p>
          <Streak count={completed ? 8 : 7} />
        </div>
      </Header>
      <div className="ps-body">
        <section className="ps-commitment">
          <div className={`ps-ring ${completed ? "ps-ring-full" : ""}`}>
            <span>
              <strong>{completed ? 2 : 1}</strong>
              <small>of 2</small>
            </span>
          </div>
          <div>
            <Eyebrow>YOUR DAILY COMMITMENT</Eyebrow>
            <h3>{completed ? "A day well spent." : "One thing at a time."}</h3>
            <p>Do one thing, write one line.</p>
          </div>
        </section>
        <div className="ps-toolbar">
          <span>
            UTC <span className="ps-separator">·</span> Swipe left for actions
          </span>
          <button
            type="button"
            aria-label="Filter flagged tasks"
            aria-pressed={flagged}
            onClick={() => setFlagged(!flagged)}
          >
            <Flag size={16} fill={flagged ? "currentColor" : "none"} />
          </button>
        </div>
        <fieldset className="ps-chips" aria-label="Task categories">
          {["All", "Mind", "Movement"].map((item) => (
            <button
              type="button"
              className={category === item ? "ps-chip-active" : ""}
              key={item}
              aria-pressed={item === category}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </fieldset>
        <SectionTitle aside={<span>DAILY · 2 TASKS</span>}>Consistent</SectionTitle>
        <div className="ps-task-list">
          {category !== "Mind" && (
            <>
              <button
                type="button"
                className={`ps-task ${completed ? "ps-task-done" : ""}`}
                onClick={completed ? () => setExpanded(!expanded) : openNote}
              >
                <span className={`ps-check ${completed ? "ps-checked" : ""}`}>
                  {completed && <Check size={16} />}
                </span>
                <div>
                  <strong>Walk outside</strong>
                  <p>18:00 UTC · 30 min · Movement</p>
                  <span className="ps-task-tag">Challenge</span>
                </div>
                <Flag size={14} className="ps-task-flag" />
              </button>
              {expanded && completed && (
                <div className="ps-task-note">
                  <p>{note}</p>
                  <button type="button" onClick={undo}>
                    Undo completion
                  </button>
                </div>
              )}
            </>
          )}
          {category !== "Movement" && !flagged && (
            <button
              type="button"
              className="ps-task ps-task-done"
              onClick={() =>
                notify(
                  "Sample journal: Read twenty pages before checking my phone. A quieter start.",
                )
              }
            >
              <span className="ps-check ps-checked">
                <Check size={16} />
              </span>
              <div>
                <strong>Read 20 pages</strong>
                <p>08:00 UTC · 20 min · Mind</p>
                <span className="ps-task-tag">Challenge · Done</span>
              </div>
              <ChevronDown size={16} className="ps-task-flag" />
            </button>
          )}
        </div>
        <button
          type="button"
          className="ps-add"
          onClick={() =>
            notify(
              "Preview only: the current month's consistent tasks are locked after confirmation. No tasks were changed.",
            )
          }
        >
          <Plus size={17} />
          Add a task
        </button>
        <SectionTitle aside={<span>no streak, no pressure</span>}>To-dos</SectionTitle>
        <button
          type="button"
          className={`ps-task ps-todo ${todo ? "ps-task-done" : ""}`}
          aria-pressed={todo}
          onClick={() => setTodo(!todo)}
        >
          <span className={`ps-check ${todo ? "ps-checked" : ""}`}>
            {todo && <Check size={16} />}
          </span>
          <div>
            <strong>Book a dentist appointment</strong>
            <p>Due today</p>
          </div>
        </button>
        <button
          type="button"
          className="ps-add"
          onClick={() =>
            notify(
              "Preview only: to-dos can be added without affecting streaks. Nothing was saved.",
            )
          }
        >
          <Plus size={17} />
          Add a to-do
        </button>
        <p className="ps-end-note">A little, every day.</p>
      </div>
    </div>
  );
}

export function NoteSheet({
  note,
  setNote,
  onClose,
  onComplete,
}: {
  note: string;
  setNote: (value: string) => void;
  onClose: () => void;
  onComplete: () => void;
}) {
  const sheetRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    sheetRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    return () => previous?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="ps-scrim">
      <dialog
        open
        className="ps-note-sheet"
        aria-modal="true"
        aria-labelledby="ps-note-title"
        ref={sheetRef}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
          if (event.key === "Tab") {
            const nodes = Array.from(
              sheetRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), textarea") ??
                [],
            );
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            }
            if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="ps-sheet-handle" />
        <div className="ps-between">
          <Eyebrow>ONE HONEST LINE</Eyebrow>
          <IconButton label="Close completion note" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        <h2 id="ps-note-title">What did you do?</h2>
        <p className="ps-note-task">Walk outside</p>
        <label htmlFor="ps-note-input" className="ps-sr-only">
          Completion note
        </label>
        <textarea
          id="ps-note-input"
            aria-label="Completion note"
          maxLength={1000}
          placeholder="One honest line about what you actually did…"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          aria-describedby="ps-note-help ps-note-count"
        />
        <div className="ps-note-meta">
          <span id="ps-note-count">
            {note.trim().length < 10
              ? `${10 - note.trim().length} more characters needed`
              : "Ready to count."}
          </span>
          <span>{note.length}/1000</span>
        </div>
        <p id="ps-note-help" className="ps-note-tip">
          Tip: tap the mic on your keyboard to speak instead of typing.
        </p>
        <button
          type="button"
          className="ps-primary"
          disabled={note.trim().length < 10}
          onClick={onComplete}
        >
          Mark done <Check size={18} />
        </button>
        <p className="ps-note-disclaimer">Sample note · saved only in this preview</p>
      </dialog>
    </div>
  );
}
