import { createAuthClient } from "better-auth/react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { managedAuthExpoClient } from "@runablehq/managed-auth/native";

const isWeb = Platform.OS === "web";
const TOKEN_KEY = "bearer_token";

const extra = Constants.expoConfig?.extra ?? {};
const baseURL = extra.apiUrl ?? process.env.EXPO_PUBLIC_API_URL;

export function getToken(): string {
  try {
    return SecureStore.getItem(TOKEN_KEY) ?? "";
  } catch {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  }
}

function setToken(token: string) {
  try {
    SecureStore.setItem(TOKEN_KEY, token);
  } catch {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

async function removeToken() {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    localStorage.removeItem(TOKEN_KEY);
  }
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
