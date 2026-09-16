import {
  Check,
  ChevronRight,
  Globe2,
  HeartHandshake,
  LockKeyhole,
  LogOut,
  Mail,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Eyebrow, Header, SectionTitle, Streak, type Notify } from "./primitives";

export function ProfileScreen({ notify, people = false }: { notify: Notify; people?: boolean }) {
  const previewOnly = (action: string) =>
    notify(`Preview only: ${action}. No email is sent, and no account or setting is changed.`);
  return (
    <div className="ps-scroll">
      <Header title="Profile">{people && <p>Your people, in your corner.</p>}</Header>
      <div className="ps-body">
        {!people && (
          <>
            <section className="ps-identity">
              <div className="ps-identity-avatar">A</div>
              <h3>Alex Morgan</h3>
              <p>alex.morgan@example.com</p>
              <span className="ps-mode-pill">
                <Users size={12} />
                Challenge
              </span>
            </section>
            <SectionTitle>Details</SectionTitle>
            <div className="ps-details">
              <div>
                <span>
                  <Globe2 size={16} />
                  Timezone
                </span>
                <strong>UTC</strong>
              </div>
              <div>
                <span>
                  <Check size={16} />
                  Tasks this month
                </span>
                <strong>2</strong>
              </div>
              <div>
                <span>
                  <LockKeyhole size={16} />
                  Month locked
                </span>
                <strong>September</strong>
              </div>
              <div>
                <span>
                  <Mail size={16} />
                  Email verified
                </span>
                <strong className="ps-sage">Yes · sample</strong>
              </div>
            </div>
            <SectionTitle>Appearance</SectionTitle>
            <fieldset className="ps-segments" aria-label="Appearance preview">
              {["Light", "Dark", "Auto"].map((value) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={value === "Light"}
                  className={value === "Light" ? "ps-selected" : ""}
                  onClick={() =>
                    previewOnly(
                      `${value} appearance selected for review; this White Paper study remains light`,
                    )
                  }
                >
                  {value}
                </button>
              ))}
            </fieldset>
          </>
        )}
        <SectionTitle>Accountability contact</SectionTitle>
        <section className="ps-contact">
          <div className="ps-contact-heading">
            <div className="ps-people-icon">
              <ShieldCheck size={22} strokeWidth={1.5} />
            </div>
            <div>
              <strong>Jamie Morgan</strong>
              <p>jamie@example.com</p>
            </div>
            <span className="ps-tiny-check">
              <Check size={12} />
            </span>
          </div>
          <p className="ps-contact-status">Verified — they’ll hear about missed days.</p>
          <span className="ps-sample-inline">Illustrative verified state</span>
          <div className="ps-contact-actions">
            <button type="button" onClick={() => previewOnly("changing an accountability contact")}>
              Change
            </button>
            <button type="button" onClick={() => previewOnly("removing an accountability contact")}>
              Remove
            </button>
          </div>
        </section>
        <SectionTitle aside={<span>CHALLENGE ONLY</span>}>Accountability partner</SectionTitle>
        <p className="ps-partner-intro">
          Share the showing up.
          <br />
          Keep the details to yourself.
        </p>
        <section className="ps-partner">
          <div className="ps-contact-heading">
            <div className="ps-people-icon">
              <HeartHandshake size={23} strokeWidth={1.5} />
            </div>
            <div>
              <strong>Riley Chen</strong>
              <p>riley@example.com</p>
            </div>
          </div>
          <div className="ps-partner-state">
            <div>
              <span className="ps-partner-state-dot" />
              Today · in progress
            </div>
            <Streak count={4} />
          </div>
          <button
            type="button"
            className="ps-partner-link"
            onClick={() => previewOnly("opening the partner's shared progress")}
          >
            View shared progress <ChevronRight size={16} />
          </button>
        </section>
        <div className="ps-partner-privacy">
          <LockKeyhole size={15} />
          <p>
            Partners see your streak and daily done or missed status. Never task names or notes.
            Basic mode stays invisible.
          </p>
        </div>
        <span className="ps-sample-inline">Sample accepted partnership · no invitation sent</span>
        <button
          type="button"
          className="ps-signout"
          onClick={() => previewOnly("signing out of this sample identity")}
        >
          <LogOut size={16} />
          Sign out
        </button>
        <Eyebrow>STEADY, NOT PERFECT.</Eyebrow>
      </div>
    </div>
  );
}
