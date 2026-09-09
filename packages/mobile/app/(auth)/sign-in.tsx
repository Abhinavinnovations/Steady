import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { SteadyButton } from "@/components/steady-button";
import { GradientBackdrop } from "@/components/gradient-backdrop";
import { authClient, captureToken } from "@/lib/auth";

export default function SignInScreen() {
  const colors = useColors();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function signInEmail() {
    setError(null);
    setLoading(true);
    const res = await authClient.signIn.email(
      { email: email.trim(), password },
      { onSuccess: captureToken },
    );
    setLoading(false);
    if (res.error) setError(res.error.message ?? "Sign-in failed");
  }

  async function signInGoogle() {
    setError(null);
    setGoogleLoading(true);
    const result = await authClient.managedAuth.signIn({ provider: "google" });
    setGoogleLoading(false);
    if (
      result.error &&
      result.error.code !== "AUTH_SESSION_DISMISSED" &&
      result.error.code !== "POPUP_CLOSED"
    ) {
      setError(result.error.message ?? "Google sign-in failed");
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

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <GradientBackdrop />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24 }}
        >
          <View style={{ paddingTop: 40, paddingBottom: 32 }}>
            <Text
              style={{
                color: colors.foreground,
                fontFamily: Fonts?.semibold,
                fontSize: 26,
              }}
            >
              Welcome back
            </Text>
            <Text
              style={{
                marginTop: 8,
                color: colors.mutedForeground,
                fontFamily: Fonts?.sans,
                fontSize: 14,
              }}
            >
              Pick up where you left off.
            </Text>
          </View>

          <View style={{ gap: 14 }}>
            <TextInput
              style={inputStyle}
              placeholder="Email"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={inputStyle}
              placeholder="Password"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            {error ? (
              <Text
                style={{
                  color: colors.destructive,
                  fontFamily: Fonts?.sans,
                  fontSize: 13,
                }}
              >
                {error}
              </Text>
            ) : null}
            <SteadyButton
              title="Sign in"
              onPress={signInEmail}
              loading={loading}
              disabled={!email.trim() || password.length === 0}
            />

            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 6 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              <Text style={{ color: colors.mutedForeground, fontFamily: Fonts?.sans, fontSize: 12 }}>
                or
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            </View>

            <Pressable
              onPress={signInGoogle}
              disabled={googleLoading}
              style={({ pressed }) => ({
                height: 52,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                opacity: pressed || googleLoading ? 0.7 : 1,
              })}
            >
              <Ionicons name="logo-google" size={18} color={colors.foreground} />
              <Text style={{ color: colors.foreground, fontFamily: Fonts?.medium, fontSize: 15 }}>
                {googleLoading ? "Opening Google…" : "Continue with Google"}
              </Text>
            </Pressable>
          </View>

          <View style={{ flex: 1 }} />
          <Pressable onPress={() => router.push("/(auth)/sign-up")} style={{ paddingVertical: 24 }}>
            <Text
              style={{
                textAlign: "center",
                color: colors.mutedForeground,
                fontFamily: Fonts?.sans,
                fontSize: 14,
              }}
            >
              New here?{" "}
              <Text style={{ color: colors.primary, fontFamily: Fonts?.semibold }}>
                Create an account
              </Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
