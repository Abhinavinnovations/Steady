import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, Check, Columns2, Pause, Play, X } from "lucide-react";
import { themes, type WelcomeTheme } from "../components/ui-options/themes";
import { WelcomePreview } from "../components/ui-options/welcome-preview";
import { useReducedMotion } from "../components/ui-options/use-preview-motion";
import "../components/ui-options/ui-options.css";

export default function UiOptions() {
  const [selected, setSelected] = useState<WelcomeTheme>(themes[0]);
  const [other, setOther] = useState<WelcomeTheme>(themes[1]);
  const [paused, setPaused] = useState(false);
  const [compareRequested, setCompareRequested] = useState(false);
  const [wide, setWide] = useState(() => window.matchMedia("(min-width: 1050px)").matches);
  const [message, setMessage] = useState(false);
  const beginTrigger = useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion();
  const compare = wide && compareRequested;

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1050px)");
    const update = () => setWide(query.matches);
    query.addEventListener("change", update);
    const oldTitle = document.title;
    document.title = "Steady — Welcome studies";
    return () => {
      query.removeEventListener("change", update);
      document.title = oldTitle;
    };
  }, []);

  const begin = () => {
    beginTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMessage(true);
  };
  const dismiss = () => {
    setMessage(false);
    beginTrigger.current?.focus({ preventScroll: true });
  };

  return (
    <main className="uo-gallery">
      <a className="uo-skip" href="#welcome-preview">Skip to welcome preview</a>
      <header className="uo-header">
        <div className="uo-identity"><span>STEADY</span><i aria-hidden="true" /><span className="uo-header-label">Welcome studies</span></div>
        <span className="uo-preview-label"><span aria-hidden="true" />Design preview</span>
      </header>

      <section className="uo-intro" aria-labelledby="uo-heading">
        <div><p className="uo-eyebrow">FIVE WAYS TO BEGIN</p><h1 id="uo-heading">A quieter beginning.</h1><p className="uo-lede">The same small step. A different feeling.</p></div>
        <div className="uo-toolbar">
          <button className="uo-tool uo-compare-button" aria-pressed={compare} onClick={() => setCompareRequested(!compareRequested)}><Columns2 size={16} aria-hidden="true" />{compare ? "Single view" : "Compare two"}</button>
          <button className="uo-tool" disabled={reduced} onClick={() => setPaused(!paused)} aria-pressed={paused || reduced}>
            {paused || reduced ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
            {reduced ? "Reduced motion" : paused ? "Resume motion" : "Pause motion"}
          </button>
        </div>
      </section>

      <div className={`uo-workspace${compare ? " uo-comparing" : ""}`}>
        <aside className="uo-directions" aria-label="Welcome directions">
          <p className="uo-section-label">EXPLORE THE DIRECTIONS <ArrowDown size={13} aria-hidden="true" /></p>
          <fieldset className="uo-options" aria-label="Choose a welcome direction">
            {themes.map((theme) => (
              <button key={theme.id} className="uo-option" aria-pressed={selected.id === theme.id} onClick={() => setSelected(theme)}>
                <span className={`uo-swatch uo-swatch-${theme.id}`} aria-hidden="true" />
                <span className="uo-option-text"><span className="uo-option-number">{theme.number}</span><span>{theme.name}</span></span>
                {selected.id === theme.id && <Check className="uo-selection-check" size={16} aria-hidden="true" />}
              </button>
            ))}
          </fieldset>
          <div className="uo-sidebar-note"><span className="uo-note-rule" /><p>Only the atmosphere changes.</p><span>The words stay still.<br />Your current app stays untouched.</span></div>
        </aside>

        <section className="uo-stage" id="welcome-preview" tabIndex={-1} aria-label="Interactive welcome previews">
          <div className="uo-preview-column">
            <div className="uo-screen-caption"><span>{selected.number} / {selected.name}</span><span>{paused || reduced ? "STILL" : "MOTION"}</span></div>
            <WelcomePreview theme={selected} paused={paused} reduced={reduced} onBegin={begin} />
            <p className="uo-screen-footnote">{compare ? selected.subtitle : "A welcome screen, not a new commitment."}</p>
          </div>
          {compare && <div className="uo-preview-column">
            <label className="uo-screen-caption uo-compare-select"><span>Compare with</span><select aria-label="Second welcome direction" value={other.id} onChange={(event) => setOther(themes.find((theme) => theme.id === event.target.value) ?? themes[1])}>{themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select></label>
            <WelcomePreview theme={other} paused={paused} reduced={reduced} onBegin={begin} />
            <p className="uo-screen-footnote">{other.subtitle}</p>
          </div>}
        </section>

        {!compare && <aside className="uo-story" aria-label="About this direction">
          <p className="uo-section-label">THE FEELING</p>
          <h2>{selected.subtitle}</h2>
          <p className="uo-description">{selected.description}</p>
          <dl className="uo-specs"><div><dt>Material</dt><dd>{selected.material}</dd></div><div><dt>Movement</dt><dd>{selected.light}</dd></div></dl>
          <div className="uo-palette" aria-label="Color palette">{selected.colors.map((color) => <span key={color} style={{ background: color }} title={color} />)}<span className="uo-palette-label">Paper. Ink. Accent.</span></div>
          <p className="uo-mood">{selected.mood}</p>
          <div className="uo-motion-note"><span className="uo-section-label">A LITTLE LIFE, IN THE BACKGROUND</span><p>{selected.detail}</p></div>
        </aside>}
      </div>
      <footer className="uo-footer"><p>Take your time. Nothing here changes your app.</p><a href="/ui-options/CREDITS.txt" target="_blank" rel="noreferrer">Materials & credits <ArrowUpRight size={13} aria-hidden="true" /></a></footer>
      {message && <div className="uo-notice"><output><strong>Preview only.</strong> Onboarding is unchanged.</output><button aria-label="Dismiss preview message" onClick={dismiss}><X size={18} aria-hidden="true" /></button></div>}
    </main>
  );
}
