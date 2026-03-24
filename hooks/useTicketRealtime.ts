"use client";

import { useEffect, useRef } from "react";

/**
 * Guest customers use token-based API access; ticket data loads via API routes (service role).
 * Polls the ticket endpoint so the thread stays fresh (Part 7: faster default interval).
 */
export function useTicketRealtime(
  ticketNumber: string | undefined,
  load: () => void | Promise<void>,
  options?: { enabled?: boolean; intervalMs?: number }
) {
  const enabled = options?.enabled !== false;
  const intervalMs = options?.intervalMs ?? 2500;
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
