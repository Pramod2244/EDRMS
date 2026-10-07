"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/documents");
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-400 font-sans">
      Loading document path...
    </div>
  );
}
