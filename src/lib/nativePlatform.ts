import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

export const NATIVE_AUTH_CALLBACK_URL = "plink://auth/callback";
export const NATIVE_AUTH_COMPLETED_EVENT = "plink:native-auth-completed";
export const NATIVE_BROWSER_DISMISSED_EVENT = "plink:native-browser-dismissed";
export const PASSWORD_RECOVERY_EVENT = "plink:password-recovery";

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export function isNativeIOSApp() {
  return isNativeApp() && Capacitor.getPlatform() === "ios";
}

export function isNativeAndroidApp() {
  return isNativeApp() && Capacitor.getPlatform() === "android";
}

export function getAuthRedirectUrl(flow?: "recovery") {
  if (isNativeApp()) {
    const callbackUrl = new URL(NATIVE_AUTH_CALLBACK_URL);
    if (flow) callbackUrl.searchParams.set("flow", flow);
    return callbackUrl.toString();
  }

  if (typeof window === "undefined") return undefined;
  const callbackUrl = new URL(window.location.pathname, window.location.origin);
  if (flow) callbackUrl.searchParams.set("flow", flow);
  return callbackUrl.toString();
}

export async function openExternalUrl(url: string) {
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("Only secure web links can be opened.");
  }

  if (isNativeApp()) {
    await Browser.open({ url: parsedUrl.toString() });
    return;
  }

  window.location.assign(parsedUrl.toString());
}
