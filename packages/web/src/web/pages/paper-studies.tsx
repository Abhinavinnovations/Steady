import { useState } from "react";
import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, X } from "lucide-react";
import { GlassNav, studyScreens, type ScreenId } from "../components/paper-studies/primitives";
import { ChoiceScreen, NoteSheet, TodayScreen } from "../components/paper-studies/daily-screens";
import {
  CalendarScreen,
  ProgressScreen,
  RanksScreen,
} from "../components/paper-studies/insight-screens";
import { ProfileScreen } from "../components/paper-studies/profile-screen";
import "../components/paper-studies/paper-studies.css";

const sampleNote =
  "Walked by the park for thirty minutes. Left my headphones at home and noticed the trees.";
export default function PaperStudies() {
  const requested = new URLSearchParams(window.location.search).get("screen");
  const initial = studyScreens.find((screen) => screen.id === requested)?.id ?? "choice";
  const [screen, setScreen] = useState<ScreenId>(initial);
  const [message, setMessage] = useState("");
  const [noteOpen, setNoteOpen] = useState(initial === "note");
  const [note, setNote] = useState(sampleNote);
  const [completed, setCompleted] = useState(false);
  const [opaque, setOpaque] = useState(false);
  const [glassActive, setGlassActive] = useState<ScreenId>("today");
  const index = studyScreens.findIndex((item) => item.id === screen);
  const study = studyScreens[index]!;
  function selectScreen(id: ScreenId) {
    setMessage("");
    setScreen(id);
    setNoteOpen(id === "note");
    const url = new URL(window.location.href);
    url.searchParams.set("screen", id);
    window.history.replaceState(null, "", url.pathname + url.search);
  }
  const today = (
    <TodayScreen
      notify={setMessage}
      openNote={() => setNoteOpen(true)}
      completed={completed}
      note={note}
      undo={() => setCompleted(false)}
    />
  );
  return (
    <main className={`ps-gallery ${opaque ? "ps-opaque" : ""}`}>
      <div className="ps-gallery-top">
        <a href="/ui-options">
          <ArrowLeft size={15} />
          Welcome studies
        </a>
        <span>STEADY / DESIGN STUDY 02</span>
        <a href="/paper-studies/CREDITS.txt" target="_blank" rel="noreferrer">
          Sources <ArrowUpRight size={14} />
        </a>
      </div>
      <div className="ps-workspace">
        <aside className="ps-sidebar">
          <p className="ps-gallery-kicker">WHITE PAPER · APPLICATION</p>
          <h1>
            A quieter place <br />
            to show up.
          </h1>
          <p className="ps-gallery-intro">
            Your existing screens, on the paper you chose. A little glass at your fingertips.
          </p>
          <nav className="ps-screen-picker" aria-label="Screen studies">
            {studyScreens.map((item, i) => (
              <button
                type="button"
                key={item.id}
                aria-current={screen === item.id ? "page" : undefined}
                onClick={() => selectScreen(item.id)}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
                {item.name}
                <ArrowUpRight size={16} />
              </button>
            ))}
          </nav>
          <div className="ps-preview-disclosure">
            <strong>Design preview. Not your account.</strong>
            <p>
              Source-matched web screens with illustrative data. No mobile, backend or account
              changes.
            </p>
          </div>
          <label className="ps-transparency">
            <input
              type="checkbox"
              aria-label="Reduce transparency"
              checked={opaque}
              onChange={(event) => setOpaque(event.target.checked)}
            />
            Reduce transparency
          </label>
        </aside>
        <section className="ps-stage" aria-label={study.name + " preview"}>
          <div className="ps-stage-caption">
            <span>{String(index + 1).padStart(2, "0")} / 09</span>
            <span>WHITE PAPER + LIQUID GLASS</span>
          </div>
          <div
            className={`ps-phone ${screen === "glass" ? "ps-phone-detail" : ""}`}
            data-screen={screen}
          >
            {screen === "glass" ? (
              <div className="ps-glass-detail">
                <div className="ps-detail-paper">
                  <div className="ps-brand-row">
                    <span>STEADY</span>
                    <span className="ps-sample">SAMPLE PREVIEW</span>
                  </div>
                  <p className="ps-detail-kicker">THE BOTTOM BAR</p>
                  <h2>
                    Light, held
                    <br />
                    in glass.
                  </h2>
                  <p>
                    Five familiar places.
                    <br />
                    One quiet, floating capsule.
                  </p>
                </div>
                <div className="ps-glass-context">
                  <div className="ps-glass-context-line" />
                  <div className="ps-glass-context-line" />
                  <div className="ps-glass-context-line" />
                </div>
                <GlassNav active={glassActive} onChange={setGlassActive} />
                <div className="ps-glass-material">
                  <span>TRANSLUCENT FILL</span>
                  <span>REFLECTIVE RIM</span>
                  <span>INSET SELECTION</span>
                </div>
                <p className="ps-glass-footnote">
                  CSS material study, not native Apple Liquid Glass.
                  <br />
                  An opaque fallback keeps every label readable.
                </p>
              </div>
            ) : (
              <>
                <div className="ps-screen-content" inert={noteOpen}>
                  {screen === "choice" && <ChoiceScreen notify={setMessage} />}
                  {(screen === "today" || screen === "note") && today}
                  {screen === "progress" && <ProgressScreen notify={setMessage} />}
                  {screen === "ranks" && <RanksScreen notify={setMessage} />}
                  {screen === "calendar" && <CalendarScreen notify={setMessage} />}
                  {(screen === "profile" || screen === "people") && (
                    <ProfileScreen key={screen} notify={setMessage} people={screen === "people"} />
                  )}
                  {screen !== "choice" && (
                    <GlassNav
                      active={screen === "note" ? "today" : screen}
                      onChange={selectScreen}
                    />
                  )}
                </div>
                {noteOpen && (
                  <NoteSheet
                    note={note}
                    setNote={setNote}
                    onClose={() => setNoteOpen(false)}
                    onComplete={() => {
                      setCompleted(true);
                      setNoteOpen(false);
                      setMessage(
                        "Sample task completed here only. No real task or streak was changed.",
                      );
                    }}
                  />
                )}
              </>
            )}
            {message && (
              <output className="ps-notice">
                <p>{message}</p>
                <button
                  type="button"
                  aria-label="Dismiss preview message"
                  onClick={() => setMessage("")}
                >
                  <X size={16} />
                </button>
              </output>
            )}
          </div>
          <div className="ps-stage-footer">
            <div>
              <h2>{study.name}</h2>
              <p>{study.detail}</p>
            </div>
            <div className="ps-page-controls">
              <button
                type="button"
                aria-label="Previous study"
                disabled={index === 0}
                onClick={() => selectScreen(studyScreens[index - 1]!.id)}
              >
                <ChevronLeft size={19} />
              </button>
              <button
                type="button"
                aria-label="Next study"
                disabled={index === studyScreens.length - 1}
                onClick={() => selectScreen(studyScreens[index + 1]!.id)}
              >
                <ChevronRight size={19} />
              </button>
            </div>
          </div>
          <p className="ps-render-note">
            390 × 844 web composition · sample dates & times in UTC
            <br />
            Static screenshot studies; native keyboard and device rendering not depicted.
          </p>
        </section>
      </div>
    </main>
  );
}
