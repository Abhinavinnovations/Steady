import { useEffect, useRef, useState } from "react";
import { Check, Leaf, ShieldCheck } from "lucide-react";
import { useInspectRecipient, useRespondRecipient } from "../queries/recipient";
import { useRecipientToken } from "../lib/recipient-token";
import "./invitation.css";

export default function Invitation() {
  const recipientToken = useRecipientToken();
  // A newly opened link must never inherit another recipient's inspection or action.
  return <InvitationContent key={recipientToken} recipientToken={recipientToken} />;
}

function InvitationContent({ recipientToken }: { recipientToken: string }) {
  const inspect = useInspectRecipient();
  const { mutate: inspectLink } = inspect;
  const respond = useRespondRecipient();
  const locked = useRef(false);
  const [answer, setAnswer] = useState<string | null>(null);
  useEffect(() => {
    document.title = "Your Steady invitation";
    setAnswer(null);
    if (recipientToken) inspectLink({ token: recipientToken });
  }, [inspectLink, recipientToken]);
  const state = !recipientToken ? "invalid" : answer || inspect.data?.state || "loading";
  const busy = respond.isPending;
  async function decide(action: "accept" | "decline" | "stop") {
    if (locked.current) return;
    locked.current = true;
    try { const result = await respond.mutateAsync({ token: recipientToken, action }); setAnswer(result.state); }
    catch { /* Show the safe server message below, keep the same token for retry. */ }
    finally { locked.current = false; }
  }
  const titles: Record<string, string> = {
    accepted: "You’re their accountability contact.", declined: "Invitation declined.", stopped: "Emails stopped.",
    expired: "This invitation has expired.", cancelled: "This invitation was cancelled.", invalid: "Open your invitation email.",
    unavailable: "Invitations are temporarily unavailable.", stop: "Your email preferences.", loading: "Opening your invitation…",
  };
  return <main className="recipient-page">
    <div className="recipient-sheet">
      <header className="recipient-brand"><Leaf size={21} strokeWidth={1.4} aria-hidden="true" /><span>STEADY</span></header>
      <div className="recipient-eyebrow">A LITTLE ACCOUNTABILITY</div>
      <h1>{state === "invited" ? <>{inspect.data?.ownerName || "Someone"} would like you in their corner.</> : titles[state] || "Your invitation"}</h1>
      <section aria-live="polite" aria-busy={busy || inspect.isPending}>
        {state === "invited" && <>
          <p>They’ve invited you to be their accountability contact. No account to create. No app to install.</p>
          <div className="recipient-agreement">
            <h2>What accepting means</h2>
            <ul>
              <li><Check aria-hidden="true" size={18} />You agree to receive an email when they miss a future Challenge day, at most once per missed day.</li>
              <li><ShieldCheck aria-hidden="true" size={18} />Task names, notes and Basic tasks stay private.</li>
              <li><Check aria-hidden="true" size={18} />You can stop these emails at any time using the link in each message.</li>
            </ul>
          </div>
          <p className="recipient-small">Only full days after acceptance count. Checks run when Steady is used, so emails are not guaranteed at a particular time. Opening this page does not accept the invitation.</p>
          <div className="recipient-actions">
            <button disabled={busy} onClick={() => void decide("accept")}>{busy && respond.variables?.action === "accept" ? "Accepting…" : "Accept invitation"}</button>
            <button className="secondary" disabled={busy} onClick={() => void decide("decline")}>{busy && respond.variables?.action === "decline" ? "Declining…" : "Decline"}</button>
          </div>
          {inspect.data?.expiresAt && <p className="recipient-small">Expires {new Date(inspect.data.expiresAt).toISOString().slice(0, 16).replace("T", " ")} UTC.</p>}
        </>}
        {state === "accepted" && <p>Your invitation is accepted. If you consented to missed-day emails, they can start with future full Challenge days. You don’t need to do anything else. A kind check-in is enough.</p>}
        {state === "declined" && <p>You won’t receive missed-day emails from this invitation. The sender can see that you declined.</p>}
        {state === "stopped" && <p>You won’t receive new invitations or missed-day emails from this person. Your existing contact relationship, if any, stays in place. An email already in transit may still arrive.</p>}
        {state === "expired" && <p>Ask the sender to resend the invitation from Steady. No account is needed to accept the new link.</p>}
        {state === "cancelled" && <p>No action is needed. Nothing was accepted by opening this page.</p>}
        {state === "invalid" && <p>Use the full link in your Steady email. For privacy, we remove the secret link from the address bar. If you refreshed this page, reopen the email link.</p>}
        {state === "unavailable" && <p>Please reopen your email link later. Nothing has been changed.</p>}
        {state === "stop" && <p>Stop invitations and missed-day emails from the person whose message brought you here. This keeps any existing contact relationship in place. Opening this page changes nothing.</p>}
        {inspect.isError && <div role="alert" className="recipient-error"><p>We couldn’t check this invitation. Your choice has not been recorded by this page.</p><button className="secondary" disabled={inspect.isPending} onClick={() => inspect.mutate({ token: recipientToken })}>Try again</button></div>}
        {respond.isError && <p role="alert" className="recipient-error">{respond.error.message || "Your response could not be confirmed. Try the same choice again."}</p>}
        {recipientToken && !["invalid", "unavailable", "stopped", "loading"].includes(state) && <div className="recipient-stop">
          <button className={state === "stop" ? "" : "text-button"} disabled={busy} onClick={() => void decide("stop")}>{busy && respond.variables?.action === "stop" ? "Stopping emails…" : "Stop emails from this person"}</button>
          <p className="recipient-small">Stops invitations and missed-day alerts. Does not delete anyone’s account or tasks.</p>
        </div>}
      </section>
      <footer>Consistency, with a little support.</footer>
    </div>
  </main>;
}
