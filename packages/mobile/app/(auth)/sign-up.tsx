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
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { SteadyButton } from "@/components/steady-button";
import { GradientBackdrop } from "@/components/gradient-backdrop";
import { authClient, captureToken } from "@/lib/auth";

export default function SignUpScreen() {
  const colors = useColors();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signUp() {
    setError(null);
    if (password.length < 8) {
      setError("Password needs at least 8 characters");
      return;
    }
    setLoading(true);
    const res = await authClient.signUp.email(
      { name: name.trim() || email.split("@")[0], email: email.trim(), password },
      { onSuccess: captureToken },
    );
    setLoading(false);
    if (res.error) setError(res.error.message ?? "Sign-up failed");
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
              Create your account
            </Text>
            <Text
              style={{
                marginTop: 8,
                color: colors.mutedForeground,
                fontFamily: Fonts?.sans,
                fontSize: 14,
              }}
            >
              One account. Your streak follows you everywhere.
            </Text>
          </View>

          <View style={{ gap: 14 }}>
            <TextInput
              style={inputStyle}
              placeholder="Name"
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={setName}
            />
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
              placeholder="Password (8+ characters)"
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
              title="Create account"
              onPress={signUp}
              loading={loading}
              disabled={!email.trim() || password.length === 0}
            />
          </View>

          <View style={{ flex: 1 }} />
          <Pressable onPress={() => router.back()} style={{ paddingVertical: 24 }}>
            <Text
              style={{
                textAlign: "center",
                color: colors.mutedForeground,
                fontFamily: Fonts?.sans,
                fontSize: 14,
              }}
            >
              Already have an account?{" "}
              <Text style={{ color: colors.primary, fontFamily: Fonts?.semibold }}>
                Sign in
              </Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
