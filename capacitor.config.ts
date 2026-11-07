import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl =
  process.env.CAPACITOR_SERVER_URL ?? "http://10.0.2.2:3000";

const config: CapacitorConfig = {
  appId: "com.vitals.health",
  appName: "Vitals",
  webDir: "www",
  server: {
    url: serverUrl,
    cleartext: new URL(serverUrl).protocol === "http:",
  },
};

export default config;
