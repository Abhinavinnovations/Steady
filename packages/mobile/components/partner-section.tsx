import { useRef, useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { SteadyIcon } from "@/components/steady-icon";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { AccountVerification } from "@/components/account-verification";
import { useProfile } from "@/queries/steady";
import {
  useInvitePartner,
  useResendInvitation,
  useNudge,
  usePartner,
  useRemovePartner,
  useRespondInvite,
  useStopPartnerEmails,
} from "@/queries/partners";
import { GlassCard } from "@/components/glass-card";
import { SteadyButton } from "@/components/steady-button";

/**
 * Partner management — lives under Profile. One person who keeps you honest
 * on your CHALLENGE tasks: they see only your challenge streak and daily
 * done/missed, and get an email when you break the streak. Basic tasks stay
 * fully private — partners never see them at all.
 */
export function PartnerSection({ verificationAbove = false }: { verificationAbove?: boolean }) {
  const colors = useColors();
  const profile = useProfile();
  const partner = usePartner();
  const invite = useInvitePartner();
  const resend = useResendInvitation();
  const sending = useRef(false);
  const pendingInvite = useRef<{email: string; requestId: string} | null>(null);
  const retryId = useRef<string | null>(null);
  const respond = useRespondInvite();
  const stopEmails = useStopPartnerEmails();
  const remove = useRemovePartner();
  const nudge = useNudge();

  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const p = profile.data;
  const d = partner.data;

  function deliveryMessage(delivery?: {outcome: string; code: string}) {
    if (delivery?.outcome === "accepted") return "The email provider accepted the invitation, but inbox delivery is not confirmed. New email links let your contact accept in a browser without an account.";
    if (delivery?.outcome === "failed") return "Invitation saved, but email was not sent. Sender configuration or provider delivery needs attention. Use Resend when available to send an account-free link.";
    if (delivery?.outcome === "sending") return "Invitation saved. Email delivery is being checked; refresh status before retrying.";
    if (delivery?.code === "manual_provider_check_required") return "Email delivery remains unconfirmed. A provider check is needed before another send to avoid duplicates.";
    return "Invitation saved. Email delivery could not be confirmed. Refresh status before retrying. Older invitations may still have the sign-in link.";
  }
  async function sendInvite() {
    if (sending.current) return;
    sending.current = true; setFormError(null); setNotice(null);
    pendingInvite.current ??= { email: email.trim(), requestId: randomUUID() };
    try {
      const result = await invite.mutateAsync(pendingInvite.current);
      pendingInvite.current = null; setEmail(""); setNotice(deliveryMessage(result.delivery));
    } catch (e: any) {
      setFormError(e?.message ?? "Invitation result unknown. Refresh status before creating another invitation.");
    } finally { sending.current = false; }
  }
  async function resendInvite() {
    if (!d?.outgoing || sending.current) return;
    sending.current = true; setFormError(null); setNotice(null); retryId.current ??= randomUUID();
    try {
      const result = await resend.mutateAsync({partnerId: d.outgoing.id, requestId: retryId.current});
      if (result.delivery.outcome === "accepted" || result.delivery.outcome === "failed") retryId.current = null;
      setNotice(deliveryMessage(result.delivery));
    } catch (e: any) { setFormError(e?.message ?? "Delivery unconfirmed. Refresh status, then retry unchanged."); }
    finally { sending.current = false; }
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
    minHeight: 52,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.inputBorder,
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
  if (!d || !p) return <SteadyButton title="Retry accountability contact" variant="outline" onPress={() => { void profile.refetch(); void partner.refetch(); }}/>;

  return (
    <View>
      <Text style={{ color: colors.foreground, fontFamily: Fonts.sans, fontSize: 12, lineHeight: 19, marginBottom: 12 }}>Invite a contact by email. They can accept in a browser without an account or app. Email-code contacts are retired; their records are retained without enrolling them in alerts.</Text>
      <SteadyButton title="Refresh contact status" variant="ghost" onPress={() => void partner.refetch()} disabled={partner.isFetching}/>
      <Text
        style={{
          color: colors.mutedForeground,
          fontFamily: Fonts?.sans,
          fontSize: 12,
          lineHeight: 18,
          marginBottom: 12,
        }}
      >
        For Challenge tasks only. After explicit consent, your contact can receive future missed-day emails.
        No task names, notes or Basic tasks are shared. They can stop emails at any time.
        Checks run when Steady is used, not at a guaranteed time.
      </Text>

      {!d.emailVerified ? (
        <GlassCard padding={16} radius={16}>
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <SteadyIcon name="shield-outline" size={18} color={colors.warning} />
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
              {verificationAbove
                ? "Use Verify your email in the Account verification section above. After opening the email link, check verification status there."
                : "Verify your own account before inviting a contact. Your contact will accept a separate invitation."}
            </Text>
            {!verificationAbove && <AccountVerification />}
          </View>
        </GlassCard>
      ) : d.outgoing && d.outgoing.status === "invited" ? (
        <GlassCard padding={16} radius={16}>
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <SteadyIcon name="hourglass-outline" size={16} color={colors.warning} />
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
              Challenge cannot start until they accept. Nothing is shared while pending.
            </Text>
            <Text accessibilityLiveRegion="polite" style={{ color: colors.mutedForeground, fontFamily: Fonts.sans, fontSize: 12, lineHeight: 19 }}>{deliveryMessage(d.outgoing.delivery)}</Text>
            {d.outgoing.delivery?.updatedAt && <Text style={{ color: colors.mutedForeground, fontFamily: Fonts.sans, fontSize: 11 }}>Last checked: {new Date(d.outgoing.delivery.updatedAt).toISOString().replace("T", " ").replace(".000Z", " UTC")}</Text>}
            <SteadyButton title="Resend invitation" variant="outline" onPress={() => void resendInvite()} loading={resend.isPending} disabled={resend.isPending || d.outgoing.delivery?.code === "manual_provider_check_required"}/>
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
              <SteadyIcon name="checkmark-circle" size={18} color={colors.success} />
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
              {d.outgoing.accountLinked ? "They can see your high-level Challenge progress in their account. " : "They accepted without linking a Steady account. "}
              {d.outgoing.emailState === "enabled" ? "They consented to future missed-day emails and can stop them at any time." : d.outgoing.emailState === "stopped" ? "They stopped emails. Their accepted contact status is unchanged." : d.outgoing.emailState === "paused" ? "They consented, but automatic emails are currently paused." : "This existing acceptance is not enrolled in automatic missed-day emails."}
              {" "}Basic tasks stay private.
            </Text>
            <SteadyButton
              title="Remove accountability contact"
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
              placeholder="Accountability contact’s email"
              accessibilityLabel="Accountability contact’s email"
              autoComplete="email"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              editable={!invite.isPending}
              onChangeText={value => { setEmail(value); pendingInvite.current = null; }}
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
              One accountability contact at a time. Nothing is shared until they accept.
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
                  wants you as their accountability contact.
                </Text>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: Fonts?.sans,
                    fontSize: 12,
                    lineHeight: 18,
                  }}
                >
                  By accepting, you agree to future Challenge missed-day emails, at most one per missed day. You'll see only high-level progress, never task names, notes or Basic tasks. Stop emails here or from any alert. Checks run when Steady is used.
                </Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <SteadyButton
                    title="Accept"
                    style={{ flex: 1 }}
                    onPress={() =>
                      respond.mutate({ partnerId: inv.id, accept: true, consentVersion: "challenge-email-v1" })
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
                  <SteadyIcon name="flame" size={14} color={colors.streak} />
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
                <Text style={{ color: colors.mutedForeground, fontFamily: Fonts.sans, fontSize: 12 }}>{w.emailState === "stopped" ? "Emails stopped. Your contact relationship is unchanged." : w.emailState === "enabled" ? "Future missed-day emails enabled with your consent." : "Automatic missed-day emails are not active."}</Text>
                {w.emailState !== "stopped" && <SteadyButton title="Stop emails from this person" variant="ghost" onPress={() => stopEmails.mutate({ partnerId: w.partnerId })} loading={stopEmails.isPending} />}
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
                              ? colors.warning
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

      {remove.error || respond.error || stopEmails.error ? <Text accessibilityLiveRegion="polite" style={{color: colors.destructive, fontFamily: Fonts.sans}}>{(remove.error || respond.error || stopEmails.error)?.message}</Text> : null}
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
