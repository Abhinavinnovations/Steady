import { createAuthClient } from "better-auth/react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { managedAuthExpoClient } from "@runablehq/managed-auth/native";
import { getRandomValues } from "expo-crypto";
import { installSecureRandom } from "./auth-random";

const isWeb = Platform.OS === "web";
const TOKEN_KEY = "bearer_token";

const extra = Constants.expoConfig?.extra ?? {};
const baseURL = extra.apiUrl ?? process.env.EXPO_PUBLIC_API_URL;

export function getToken(): string {
  return isWeb ? localStorage.getItem(TOKEN_KEY) ?? "" : SecureStore.getItem(TOKEN_KEY) ?? "";
}

function setToken(token: string) {
  if (isWeb) localStorage.setItem(TOKEN_KEY, token);
  else SecureStore.setItem(TOKEN_KEY, token);
}

async function removeToken() {
  if (isWeb) localStorage.removeItem(TOKEN_KEY);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export function signInWithGoogle() {
  if (!isWeb) {
    installSecureRandom(globalThis, array => {
      // Managed auth requests Uint8Array; Expo fills the same view securely.
      getRandomValues(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
      return array;
    });
  }
  return authClient.managedAuth.signIn({ provider: "google" });
}

export const authClient = createAuthClient({
  baseURL,
  basePath: "/api/auth",
  fetchOptions: {
    ...(isWeb ? { credentials: "omit" as const } : {}),
    auth: {
      type: "Bearer",
      token: () => getToken(),
    },
    headers: isWeb ? {} : { "expo-origin": "mobile://" },
  },
  plugins: [
    managedAuthExpoClient({
      applicationId: extra.applicationId,
      issuer: extra.runableAuthIssuer,
      storage: {
        getToken,
        setToken,
        clearToken: () => setToken(""),
      },
    }),
  ],
});

/** Call in onSuccess of signIn/signUp to capture the bearer token. */
export function captureToken(ctx: { response: Response }) {
  const token = ctx.response.headers.get("set-auth-token");
  if (token) setToken(token);
}

/** Clear stored token on sign-out. */
export async function clearToken() {
  await removeToken();
}
