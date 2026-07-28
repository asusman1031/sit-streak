import type { MetadataRoute } from "next";

// Name is a placeholder until Sawyer picks the real one.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Streak",
    short_name: "Streak",
    description: "5 minutes, twice a day.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#4338ca",
    theme_color: "#4338ca",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
