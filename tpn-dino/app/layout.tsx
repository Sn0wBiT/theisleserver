import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bảng nhiệm vụ TPN",
  description: "Theo dõi trực tiếp nhiệm vụ và phần thưởng trong The Isle.",
  icons: {
    icon: "/images/logo_TPN_Dino_Vietnam.png",
    apple: "/images/logo_TPN_Dino_Vietnam.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
