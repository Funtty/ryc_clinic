import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "ryc-dental-admin",
    name: "RYC Dental — Admin Dashboard",
    short_name: "RYC Admin",
    description:
      "RYC Dental Service admin dashboard — appointments, patients, payments and clinic management.",
    lang: "en",
    start_url: "/admin",
    scope: "/admin",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf7f2",
    theme_color: "#102825",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}