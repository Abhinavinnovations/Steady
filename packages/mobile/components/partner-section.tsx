import { useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { authClient } from "@/lib/auth";
import { useProfile } from "@/queries/steady";
import {
  useInvitePartner,
  useNudge,
  usePartner,
  useRemovePartner,
  useRespondInvite,
} from "@/queries/partners";
import { GlassCard } from "@/components/glass-card";
import { SteadyButton } from "@/components/steady-button";

/**
 * Partner management — lives under Profile. One person who keeps you honest
 * on your CHALLENGE tasks: they see only your challenge streak and daily
 * done/missed, and get an email when you break the streak. Basic tasks stay
 * fully private — partners never see them at all.
 */
export function PartnerSection() {
  const colors = useColors();
  const profile = useProfile();
  const partner = usePartner();
  const invite = useInvitePartner();
  const respond = useRespondInvite();
  const remove = useRemovePartner();
  const nudge = useNudge();

  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verifySending, setVerifySending] = useState(false);

  const p = profile.data;
  const d = partner.data;

  async function resendVerification() {
    if (!p?.email) return;
    setVerifySending(true);
    setNotice(null);
    const res = await authClient.sendVerificationEmail({ email: p.email });
    setVerifySending(false);
    setNotice(
      res.error
        ? (res.error.message ?? "Couldn't send the email — try again later.")
        : "Verification email sent. Check your inbox, then come back.",
    );
  }

  async function sendInvite() {
    setFormError(null);
    setNotice(null);
    try {
      await invite.mutateAsync({ email: email.trim() });
      setEmail("");
      setNotice("Invite sent. Nothing is shared until they accept.");
    } catch (e: any) {
      setFormError(e?.message ?? "Couldn't send the invite");
    }
  }

  async function sendNudge(partnerId: number) {
    setFormError(null);
    setNotice(null);
    try {
      await nudge.mutateAsync({ partnerId });
      setNotice("Nudge sent. Gentle, one per missed day.");
    } catch (e: any) {
      setFormError(e?.message ?? "Couldn't nudge");
    }
  }

  const inputStyle = {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    color: colors.foreground,
    paddingHorizontal: 16,
    fontFamily: Fonts?.sans,
    fontSize: 15,
  } as const;

  if (profile.isLoading || partner.isLoading) {
    return (
      <View style={{ paddingVertical: 24, alignItems: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!d || !p) return null;

  return (
    <View>
      <Text
        style={{
          color: colors.mutedForeground,
          fontFamily: Fonts?.sans,
          fontSize: 12,
          lineHeight: 18,
          marginBottom: 12,
        }}
      >
        For challenge tasks only. Your partner sees your streak and daily
        done/missed — never task names or notes — and gets an email when you
        break the streak. Basic tasks stay invisible to them.
      </Text>

      {!d.emailVerified ? (
        <GlassCard padding={16} radius={16}>
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="shield-outline" size={18} color={colors.warning} />
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: Fonts?.semibold,
                  fontSize: 14,
                }}
              >
                Verify your email first
              </Text>
            </View>
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: Fonts?.sans,
                fontSize: 13,
                lineHeight: 19,
              }}
            >
              Partner features need one verified account per person. We sent a
              link to {p.email} when you signed up.
            </Text>
            <SteadyButton
              title={verifySending ? "Sending…" : "Resend verification email"}
              variant="outline"
              onPress={resendVerification}
              loading={verifySending}
            />
          </View>
        </GlassCard>
      ) : d.outgoing && d.outgoing.status === "invited" ? (
        <GlassCard padding={16} radius={16}>
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="hourglass-outline" size={16} color={colors.warning} />
              <Text
                style={{
                  flex: 1,
                  color: colors.foreground,
                  fontFamily: Fonts?.medium,
                  fontSize: 14,
                }}
              >
                {d.outgoing.partnerEmail}
              </Text>
              <Text
                style={{
                  color: colors.warning,
                  fontFamily: Fonts?.medium,
                  fontSize: 12,
                }}
              >
                Pending
              </Text>
            </View>
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: Fonts?.sans,
                fontSize: 12,
                lineHeight: 18,
              }}
            >
              They'll see nothing until they accept.
            </Text>
            <SteadyButton
              title="Cancel invite"
              variant="outline"
              onPress={() => remove.mutate({})}
              loading={remove.isPending}
            />
          </View>
        </GlassCard>
      ) : d.outgoing && d.outgoing.status === "accepted" ? (
        <GlassCard padding={16} radius={16}>
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text
                style={{
                  flex: 1,
                  color: colors.foreground,
                  fontFamily: Fonts?.medium,
                  fontSize: 14,
                }}
              >
                {d.outgoing.partnerEmail}
              </Text>
            </View>
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: Fonts?.sans,
                fontSize: 12,
                lineHeight: 18,
              }}
            >
              They see your challenge streak and daily done/missed, and hear
              about it by email when you break the streak.
            </Text>
            <SteadyButton
              title="Remove partner"
              variant="outline"
              onPress={() => remove.mutate({})}
              loading={remove.isPending}
            />
          </View>
        </GlassCard>
      ) : (
        <GlassCard padding={16} radius={16}>
          <View style={{ gap: 12 }}>
            {d.outgoing?.status === "declined" ? (
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: Fonts?.sans,
                  fontSize: 12,
                }}
              >
                Your last invite was declined. You can invite someone else.
              </Text>
            ) : null}
            <TextInput
              style={inputStyle}
              placeholder="Partner's email"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <SteadyButton
              title="Send invite"
              onPress={sendInvite}
              loading={invite.isPending}
              disabled={!email.trim().includes("@")}
            />
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: Fonts?.sans,
                fontSize: 12,
                lineHeight: 18,
              }}
            >
              One partner at a time. Nothing is shared until they accept.
            </Text>
          </View>
        </GlassCard>
      )}

      {d.emailVerified && d.incoming.length > 0 ? (
        <View style={{ marginTop: 12, gap: 10 }}>
          {d.incoming.map((inv) => (
            <GlassCard key={inv.id} padding={16} radius={16}>
              <View style={{ gap: 12 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: Fonts?.medium,
                    fontSize: 14,
                    lineHeight: 20,
                  }}
                >
                  <Text style={{ fontFamily: Fonts?.semibold }}>
                    {inv.ownerName}
                  </Text>{" "}
                  wants you as their accountability partner.
                </Text>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: Fonts?.sans,
                    fontSize: 12,
                    lineHeight: 18,
                  }}
                >
                  If you accept, you'll see only their high-level progress.
                </Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <SteadyButton
                    title="Accept"
                    style={{ flex: 1 }}
                    onPress={() =>
                      respond.mutate({ partnerId: inv.id, accept: true })
                    }
                    loading={respond.isPending}
                  />
                  <SteadyButton
                    title="Decline"
                    variant="outline"
                    style={{ flex: 1 }}
                    onPress={() =>
                      respond.mutate({ partnerId: inv.id, accept: false })
                    }
                    loading={respond.isPending}
                  />
                </View>
              </View>
            </GlassCard>
          ))}
        </View>
      ) : null}

      {d.watching.length > 0 ? (
        <View style={{ marginTop: 12, gap: 10 }}>
          {d.watching.map((w) => (
            <GlassCard key={w.partnerId} padding={16} radius={16}>
              <View style={{ gap: 12 }}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Text
                    style={{
                      flex: 1,
                      color: colors.foreground,
                      fontFamily: Fonts?.semibold,
                      fontSize: 15,
                    }}
                  >
                    {w.displayName}
                  </Text>
                  <Ionicons name="flame" size={14} color={colors.streak} />
                  <Text
                    style={{
                      color: colors.streak,
                      fontFamily: Fonts?.semibold,
                      fontSize: 14,
                    }}
                  >
                    {w.streak}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 16 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor:
                          w.todayStatus === "complete"
                            ? colors.success
                            : w.todayStatus === "missed"
                              ? colors.destructive
                              : colors.mutedForeground,
                      }}
                    />
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontFamily: Fonts?.sans,
                        fontSize: 12,
                      }}
                    >
                      Today:{" "}
                      {w.todayStatus === "complete"
                        ? "done"
                        : w.todayStatus === "pending"
                          ? "in progress"
                          : w.todayStatus === "missed"
                            ? "missed"
                            : "rest day"}
                    </Text>
                  </View>
                  {w.consistency !== null ? (
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontFamily: Fonts?.sans,
                        fontSize: 12,
                      }}
                    >
                      {w.consistency}% consistent
                    </Text>
                  ) : null}
                </View>
                {w.missedYesterday ? (
                  w.canNudge ? (
                    <SteadyButton
                      title="Nudge — they missed yesterday"
                      variant="outline"
                      onPress={() => sendNudge(w.partnerId)}
                      loading={nudge.isPending}
                    />
                  ) : (
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontFamily: Fonts?.sans,
                        fontSize: 12,
                      }}
                    >
                      Missed yesterday — already nudged.
                    </Text>
                  )
                ) : null}
              </View>
            </GlassCard>
          ))}
        </View>
      ) : null}

      {formError ? (
        <Text
          style={{
            marginTop: 12,
            color: colors.destructive,
            fontFamily: Fonts?.sans,
            fontSize: 13,
          }}
        >
          {formError}
        </Text>
      ) : null}
      {notice ? (
        <Text
          style={{
            marginTop: 12,
            color: colors.success,
            fontFamily: Fonts?.sans,
            fontSize: 13,
          }}
        >
          {notice}
        </Text>
      ) : null}
    </View>
  );
}
