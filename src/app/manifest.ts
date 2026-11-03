import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sasamigo",
    short_name: "Sasamigo",
    description: "Friends who remember. AI friends who text like friends.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf6ee",
    theme_color: "#e8642c",
    icons: [
      { src: "/brand/sasamigo-app-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/sasamigo-app-icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/sasamigo-mark.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
