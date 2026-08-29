import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import DownloadCard from "./download-card";

export const metadata: Metadata = {
  title: "Tải TPN Isle Control HUD | TPN Dino",
  description: "Tải HUD chính thức cho máy chủ The Isle TPN Dino.",
};

export default function DownloadPage() {
  return (
    <main className="download-shell">
      <div className="download-backdrop" aria-hidden="true">
        <Image src="/images/bg.jpg" fill priority sizes="100vw" alt="" />
      </div>
      <header className="download-nav">
        <Link className="logo download-logo" href="/" aria-label="TPN Dino Việt Nam">
          <Image className="brand-logo-image" src="/images/logo_TPN_Dino_Vietnam.png" width={58} height={58} priority alt="" />
          <span>TPN Dino Việt Nam</span>
        </Link>
        <Link className="text-link" href="/auth/steam">Đăng nhập Steam</Link>
      </header>
      <div className="download-content">
        <section className="download-intro">
          <p className="eyebrow">HUD chính thức</p>
          <h1>Chơi nhiều hơn.<br />Thấy rõ hơn.</h1>
          <p>Đưa nhiệm vụ, minimap và thông tin sinh tồn của TPN Dino trực tiếp lên trò chơi của bạn.</p>
          <div className="download-features" aria-label="Tính năng">
            <span>Minimap trực tiếp</span><span>Nhiệm vụ</span><span>Tự động cập nhật</span><span>Kiểm tra toàn vẹn</span>
          </div>
        </section>
        <DownloadCard />
      </div>
    </main>
  );
}
