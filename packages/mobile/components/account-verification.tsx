import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { authClient } from "@/lib/auth";
import { usePartner } from "@/queries/partners";
import { useProfile } from "@/queries/steady";
import { SteadyButton } from "./steady-button";

/** Same real account status in Profile and the onboarding contact gate. */
export function AccountVerification() {
  const colors = useColors();
  const profile = useProfile();
  const partner = usePartner();
  const busy = useRef(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const verified = partner.data?.emailVerified;
  const body = { color: colors.mutedForeground, fontFamily: Fonts.sans, fontSize: 13, lineHeight: 20 };

  async function send() {
    if (!profile.data?.email || verified !== false || busy.current) return;
    if (Date.now() < cooldownUntil) {
      setNotice("Please wait one minute between verification requests and check your inbox first.");
      return;
    }
    busy.current = true; setSending(true); setNotice(null);
    // Also space unknown outcomes: a lost response does not prove nothing was sent.
    setCooldownUntil(Date.now() + 60_000);
    try {
      const result = await authClient.sendVerificationEmail({ email: profile.data.email });
      if (result.error) {
        const code = result.error.code;
        setNotice(code === "EMAIL_ALREADY_VERIFIED"
          ? "Your account is already verified. Checking the latest status."
          : code === "VERIFICATION_EMAIL_NOT_SENT" || code === "VERIFICATION_EMAIL_UNCONFIRMED"
            ? result.error.message ?? "Email delivery could not be confirmed."
            : "Could not confirm the verification request. Check your inbox and try again later.");
      } else if (result.data?.status === true) {
        setNotice("Verification email accepted by the email provider. Check your inbox and spam folder, open the link, then return here and check verification status.");
      } else {
        setNotice("Email delivery could not be confirmed. Check your inbox before trying again.");
      }
      await partner.refetch();
    } catch {
      setNotice("Email delivery could not be confirmed. Check your inbox before trying again.");
    } finally { busy.current = false; setSending(false); }
  }

  return <View style={{ gap: 10, marginTop: 16 }}>
    <Text style={{ color: colors.foreground, fontFamily: Fonts.semibold, fontSize: 15 }}>Account verification</Text>
    <Text accessibilityLiveRegion="polite" style={body}>
      {verified === true
        ? "Your email is already verified. No extra verification is needed. Your contact still needs to accept your invitation separately."
        : verified === false
          ? "Verify your own email before inviting or accepting an accountability contact. Basic tasks remain available without verification."
          : "Account verification status is unavailable. Check again before continuing."}
    </Text>
    {verified === false && <SteadyButton title="Verify your email" variant="outline" onPress={() => void send()} loading={sending} disabled={!profile.data?.email} />}
    <SteadyButton title="Check verification status" variant="ghost" disabled={partner.isFetching || sending} onPress={() => { setNotice(null); void partner.refetch(); }} />
    {notice && <Text accessibilityLiveRegion="polite" style={body}>{notice}</Text>}
  </View>;
}
