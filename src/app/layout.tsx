import type { Metadata } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Halyard Display — the Devx brand display face, used for headings only.
// Body/UI text falls back to a neutral system sans (see tailwind config)
// to keep the interface readable and not over-branded.
const halyard = localFont({
  src: [
    {
      path: "../../public/fonts/halyard-font/Halyard-Display-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/halyard-font/Halyard-Display-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/halyard-font/Halyard-Display-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/fonts/halyard-font/Halyard-Display-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Devx Interns",
    template: "%s · Devx Interns",
  },
  description: "Browse vetted interns from Devx. Experience the Exceptional.",
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={halyard.variable}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
