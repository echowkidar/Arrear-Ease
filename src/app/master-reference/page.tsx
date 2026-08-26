"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { RatesMatrixViewerModal } from "@/components/rates-matrix-viewer-modal";

export default function MasterReferencePage() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Calculator
            </Link>
          </Button>
          <ThemeToggle />
        </div>

        <RatesMatrixViewerModal
          isOpen={isOpen}
          onClose={() => {
            window.location.href = "/";
          }}
        />
      </main>
    </div>
  );
}
