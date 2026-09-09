import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { SteadyButton } from "@/components/steady-button";
import {
  useAccountability,
  useRemoveContact,
  useResendContactCode,
  useSetContact,
  useVerifyContact,
} from "@/queries/accountability";

/**
 * Challenge accountability contact flow: email → 6-digit code → verified.
 * Used in onboarding (challenge gate), Partner (mode switch gate) and Profile.
 */
export function AccountabilitySetup({
  onVerified,
  showRemove = false,
}: {
  onVerified?: () => void;
  showRemove?: boolean;
}) {
  const colors = useColors();
  const contact = useAccountability();
  const setContact = useSetContact();
  const verify = useVerifyContact();
  const resend = useResendContactCode();
  const remove = useRemoveContact();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const c = contact.data;

  async function submitEmail() {
    const e = email.trim().toLowerCase();
    if (!e.includes("@")) return;
    setError(null);
    setInfo(null);
    try {
      await setContact.mutateAsync({ email: e });
      setChanging(false);
      setCode("");
      setInfo("Code sent — ask them for the 6 digits.");
    } catch (err: any) {
      setError(err?.message ?? "Couldn't save contact");
    }
  }

  async function submitCode() {
    if (code.trim().length !== 6) return;
    setError(null);
    setInfo(null);
    try {
      await verify.mutateAsync({ code: code.trim() });
      onVerified?.();
    } catch (err: any) {
      setError(err?.message ?? "Couldn't verify");
    }
  }

  async function resendCode() {
    setError(null);
    setInfo(null);
    try {
      await resend.mutateAsync(undefined);
      setInfo("New code sent.");
    } catch (err: any) {
      setError(err?.message ?? "Couldn't resend");
    }
  }

  const inputStyle = {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    color: colors.foreground,
    paddingHorizontal: 14,
    fontFamily: Fonts?.sans,
    fontSize: 15,
  } as const;

  return (
    <View style={{ gap: 12 }}>
      {c && c.verified && !changing ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Ionicons name="shield-checkmark" size={20} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: colors.foreground, fontFamily: Fonts?.medium, fontSize: 14 }}
              >
                {c.email}
              </Text>
              <Text
                style={{ color: colors.mutedForeground, fontFamily: Fonts?.sans, fontSize: 12 }}
              >
                Verified — they'll hear about missed days
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 14 }}>
            <Pressable onPress={() => { setChanging(true); setEmail(""); }} hitSlop={6}>
              <Text style={{ color: colors.primary, fontFamily: Fonts?.medium, fontSize: 13 }}>
                Change
              </Text>
            </Pressable>
            {showRemove ? (
              <Pressable onPress={() => remove.mutate(undefined)} hitSlop={6}>
                <Text
                  style={{ color: colors.destructive, fontFamily: Fonts?.medium, fontSize: 13 }}
                >
                  Remove
                </Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : c && !c.verified && !changing ? (
        <>
          <Text
            style={{ color: colors.mutedForeground, fontFamily: Fonts?.sans, fontSize: 13, lineHeight: 19 }}
          >
            We emailed a 6-digit code to{" "}
            <Text style={{ color: colors.foreground, fontFamily: Fonts?.medium }}>
              {c.email}
            </Text>
            . Ask them for it, then enter it here.
          </Text>
          <TextInput
            style={[inputStyle, { letterSpacing: 6, textAlign: "center", fontFamily: Fonts?.semibold }]}
            placeholder="••••••"
            placeholderTextColor={colors.mutedForeground}
            value={code}
            onChangeText={(v) => setCode(v.replace(/[^0-9]/g, "").slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
          />
          <SteadyButton
            title="Confirm code"
            onPress={submitCode}
            disabled={code.trim().length !== 6}
            loading={verify.isPending}
          />
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 18 }}>
            <Pressable onPress={resendCode} disabled={resend.isPending} hitSlop={6}>
              <Text style={{ color: colors.primary, fontFamily: Fonts?.medium, fontSize: 13 }}>
                {resend.isPending ? "Sending..." : "Resend code"}
              </Text>
            </Pressable>
            <Pressable onPress={() => { setChanging(true); setEmail(""); }} hitSlop={6}>
              <Text
                style={{ color: colors.mutedForeground, fontFamily: Fonts?.medium, fontSize: 13 }}
              >
                Use another email
              </Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text
            style={{ color: colors.mutedForeground, fontFamily: Fonts?.sans, fontSize: 13, lineHeight: 19 }}
          >
            Who should hear about it when you miss a day? Any email works —
            they don't need the app.
          </Text>
          <TextInput
            style={inputStyle}
            placeholder="their@email.com"
            placeholderTextColor={colors.mutedForeground}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            onSubmitEditing={submitEmail}
            returnKeyType="send"
          />
          <SteadyButton
            title="Send verification code"
            onPress={submitEmail}
            disabled={!email.trim().includes("@")}
            loading={setContact.isPending}
          />
          {changing ? (
            <Pressable
              onPress={() => setChanging(false)}
              hitSlop={6}
              style={{ alignSelf: "center" }}
            >
              <Text
                style={{ color: colors.mutedForeground, fontFamily: Fonts?.medium, fontSize: 13 }}
              >
                Keep current contact
              </Text>
            </Pressable>
          ) : null}
        </>
      )}

      {error ? (
        <Text style={{ color: colors.destructive, fontFamily: Fonts?.sans, fontSize: 13 }}>
          {error}
        </Text>
      ) : null}
      {info && !error ? (
        <Text style={{ color: colors.success, fontFamily: Fonts?.sans, fontSize: 13 }}>
          {info}
        </Text>
      ) : null}
    </View>
  );
}
