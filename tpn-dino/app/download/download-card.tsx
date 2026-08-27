"use client";

import { useEffect, useState } from "react";

type ReleaseManifest = { version: string };

export default function DownloadCard() {
  const [version, setVersion] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/hud/manifest.json", { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Manifest unavailable");
        return response.json() as Promise<ReleaseManifest>;
      })
      .then((manifest) => {
        if (typeof manifest.version !== "string" || !manifest.version) throw new Error("Invalid manifest");
        setVersion(manifest.version);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setUnavailable(true);
      });
    return () => controller.abort();
  }, []);

  return (
    <section className="download-card">
      <div className="download-card__heading">
        <div className="download-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 15v4h14v-4" /></svg>
        </div>
        <div>
          <p className="eyebrow">Windows 10 / 11 · 64-bit</p>
          <h2>TPN Isle Control HUD</h2>
        </div>
      </div>
      <p className="download-description">
        HUD chính thức dành cho máy chủ TPN Dino, bao gồm minimap, nhiệm vụ, trạng thái khủng long và cập nhật tự động.
      </p>
      <div className="download-meta">
        <div><span>Phiên bản</span><strong>{version ?? (unavailable ? "Không khả dụng" : "Đang kiểm tra…")}</strong></div>
        <div><span>Định dạng</span><strong>ZIP</strong></div>
        <div><span>Cập nhật</span><strong>Tự động</strong></div>
      </div>
      {version ? (
        <a className="download-button" href="/hud/downloads/TPNIsleControlHUD.zip" download>
          <span>Tải TPNIsleControlHUD</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14" /></svg>
        </a>
      ) : unavailable ? (
        <p className="download-unavailable">Bản phát hành hiện chưa sẵn sàng. Vui lòng thử lại sau.</p>
      ) : (
        <p className="download-checking">Đang xác minh bản phát hành mới nhất…</p>
      )}
      <p className="download-note">Giải nén toàn bộ tệp ZIP, sau đó chạy TPNIsleControlHUD.exe. Trình cập nhật sẽ xác minh mọi tệp trước khi HUD khởi động.</p>
    </section>
  );
}
