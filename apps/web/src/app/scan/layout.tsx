import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security Assessment Report | SiteSecura",
  description:
    "View verified security score, checks, and recommendations for this website security assessment.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ScanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
