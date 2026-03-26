"use client";

import { useEffect, useState } from "react";

export default function UnderDevelopmentPage() {
  const [message, setMessage] = useState(
    "Honey Well is currently under maintenance and testing. Please check back later."
  );
  const [eta, setEta] = useState("");

  useEffect(() => {
    fetch("/api/settings/public", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.maintenance_message === "string" && d.maintenance_message.trim()) {
          setMessage(d.maintenance_message.trim());
        }
        if (typeof d.maintenance_eta === "string") {
          setEta(d.maintenance_eta.trim());
        }
      })
      .catch(() => {});
  }, []);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center px-6 py-16">
      <div className="w-full rounded-2xl border border-honey-border bg-surface p-8 text-center shadow-sm dark:bg-surface-dark">
        <h1 className="font-display text-4xl text-honey-text">Website under development</h1>
        <p className="mt-4 text-base text-honey-muted">{message}</p>
        {eta && <p className="mt-2 text-sm font-medium text-primary">{eta}</p>}
      </div>
    </main>
  );
}
