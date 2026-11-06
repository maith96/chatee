import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// The preview image shown when a Sasamigo link is shared on WhatsApp, X, LinkedIn, Facebook, etc.
// Used by every page unless a page adds its own opengraph-image.
export const alt = "Sasamigo: friends who remember. AI friends, made in Kenya.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  // The full logo (bubble, wordmark and tagline), so no brand fonts are needed here.
  const logo = await readFile(join(process.cwd(), "public/brand/sasamigo-logo.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#FBF6EE",
          color: "#12302F",
        }}
      >
        <img src={logoSrc} width={960} height={274} alt="" />
        <div style={{ marginTop: 36, fontSize: 40, display: "flex" }}>AI friends who text like friends · Made in Kenya</div>
        <div
          style={{
            marginTop: 28,
            display: "flex",
            padding: "10px 26px",
            borderRadius: 999,
            background: "#0F3D3E",
            color: "#FBF6EE",
            fontSize: 30,
          }}
        >
          Always honestly AI · 18+
        </div>
      </div>
    ),
    { ...size },
  );
}
