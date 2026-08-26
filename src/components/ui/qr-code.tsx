"use client";

import React, { useEffect, useState } from "react";
import QRCodeLib from "qrcode";

interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export function QRCode({ value, size = 190, className = "" }: QRCodeProps) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    let isMounted = true;
    QRCodeLib.toDataURL(value, {
      width: size * 3, // Ultra-sharp 3x resolution for instant mobile camera recognition
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (isMounted) {
          setDataUrl(url);
        }
      })
      .catch((err) => {
        console.error("Standard QR Generation Error:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center bg-white rounded-xl border border-border animate-pulse ${className}`}
      >
        <span className="text-xs text-muted-foreground">Generating UPI QR...</span>
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt="Scan to Pay via UPI"
      width={size}
      height={size}
      className={`rounded-xl bg-white p-2 shadow-sm border border-border/80 object-contain ${className}`}
    />
  );
}
