import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Play In 432 — native shells (App Store + Google Play) via Capacitor.
 * Web build → dist/ is copied into ios/ and android/ on `npx cap sync`.
 */
const config: CapacitorConfig = {
  appId: "com.playin432.app",
  appName: "Play In 432",
  webDir: "dist",
  server: {
    // Production loads local assets from the package (not a remote URL).
    androidScheme: "https",
    iosScheme: "https",
  },
  plugins: {
    // Native HTTP bypasses WKWebView CORS for API calls (Stripe checkout, etc.)
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#070b0f",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#070b0f",
    },
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scheme: "Play In 432",
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#070b0f",
  },
};

export default config;
