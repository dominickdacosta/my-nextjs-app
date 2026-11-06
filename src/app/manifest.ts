import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} | Personal Health Tracker`,
    short_name: APP_NAME,
    description: "A private space to track nutrition, movement, sleep, and wellbeing.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f7f3",
    theme_color: "#285943",
    icons: [
      {
        src: "/icons/vitals.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
