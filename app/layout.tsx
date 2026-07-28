import type { Metadata, Viewport } from "next";
import { Baloo_2 } from "next/font/google";
import "./globals.css";
import { RegisterSW } from "@/components/RegisterSW";

// Chunky, rounded, and fun — fits a kid's streak app.
const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
});

// Ashton's app: Poppy Streaks.
export const metadata: Metadata = {
  title: "Poppy Streaks",
  description: "5 minutes, twice a day.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Poppy Streaks",
  },
  icons: {
    apple: "/icon-180.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#dc2626",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${baloo.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
