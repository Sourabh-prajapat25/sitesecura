import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === "production" ? "https://sitesecura.com" : "http://localhost:3000")
  ),
  title: {
    default: "Website Security Scanner & Monitoring | SiteSecura",
    template: "%s | SiteSecura",
  },
  description:
    "Scan your website for HTTPS, SSL/TLS, DNS, security headers, and configuration issues. Get a deterministic security score and plain-English actionable recommendations.",
  keywords: [
    "website security scanner",
    "website security check",
    "security score",
    "SSL checker",
    "HTTPS security",
    "security headers",
    "DMARC check",
    "SPF verification",
    "website security monitoring",
    "website security report",
  ],
  authors: [{ name: "SiteSecura" }],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Website Security Scanner & Monitoring | SiteSecura",
    description:
      "Instant deterministic security score, verified findings, plain-English fix instructions, and continuous automated monitoring.",
    url:
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.NODE_ENV === "production" ? "https://sitesecura.com" : "http://localhost:3000"),
    siteName: "SiteSecura",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Website Security Scanner & Monitoring | SiteSecura",
    description:
      "Scan your website for HTTPS, SSL, DNS, and security headers. Get a clear security score and actionable fixes.",
  },
  icons: {
    icon: [
      { url: "/brand/sitesecura-logo.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
    ],
    shortcut: "/brand/sitesecura-logo.svg",
    apple: "/brand/sitesecura-logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var isDashboard=window.location.pathname.startsWith('/dashboard');var t=localStorage.getItem('sitesecura-theme');if(isDashboard&&t==='dark'){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col antialiased text-slate-900 bg-slate-50 dark:text-slate-100 dark:bg-[#0B1220] transition-colors duration-150">
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
