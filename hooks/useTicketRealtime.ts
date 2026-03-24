"use client";

import { useEffect, useRef } from "react";

/**
 * Guest customers use token-based API access; Postgres Realtime is not available under current RLS.
 * This hook polls the ticket endpoint so the chat stays fresh.
 */
export function useTicketRealtime(
  ticketNumber: string | undefined,
  load: () => void | Promise<void>,
  options?: { enabled?: boolean; intervalMs?: number }
) {
  const enabled = options?.enabled !== false;
  const intervalMs = options?.intervalMs ?? 4000;
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!ticketNumber || !enabled) return;
    const id = window.setInterval(() => {
      void loadRef.current();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [ticketNumber, enabled, intervalMs]);
}
