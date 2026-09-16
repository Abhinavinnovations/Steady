import { welcomeQuote, type WelcomeTheme } from "./themes";
import { usePreviewMotion } from "./use-preview-motion";

export function WelcomePreview({ theme, paused, reduced, onBegin }: {
  theme: WelcomeTheme;
  paused: boolean;
  reduced: boolean;
  onBegin: () => void;
}) {
  const { ref, running } = usePreviewMotion(paused, reduced);
  return (
    <section ref={ref} className="uo-welcome" data-theme={theme.id} data-running={running} aria-label={`${theme.name} welcome preview`}>
      <div className="uo-material" aria-hidden="true" />
      <div className="uo-light uo-light-one" aria-hidden="true" />
      <div className="uo-light uo-light-two" aria-hidden="true" />
      <div className="uo-paper-veil" aria-hidden="true" />
      <div className="uo-welcome-copy">
        <p className="uo-wordmark">STEADY</p>
        <blockquote>
          <p className="uo-quote">{welcomeQuote}</p>
          <footer className="uo-attribution">— Steady</footer>
        </blockquote>
      </div>
      <button className="uo-begin" onClick={onBegin}>Begin</button>
    </section>
  );
}
