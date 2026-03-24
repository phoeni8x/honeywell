"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useRef } from "react";

type Options = {
  onTicketsChange?: () => void;
  onMessageInsert?: (ticketId: string) => void;
  enabled?: boolean;
};

export function useAdminTicketRealtime(options: Options) {
  const supabase = useMemo(() => createClient(), []);
  const enabled = options.enabled !== false;
  const ticketsRef = useRef(options.onTicketsChange);
  const msgRef = useRef(options.onMessageInsert);
  ticketsRef.current = options.onTicketsChange;
  msgRef.current = options.onMessageInsert;

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel("admin-tickets-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        () => {
          ticketsRef.current?.();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ticket_messages" },
        (payload) => {
          const row = payload.new as { ticket_id?: string };
          if (row?.ticket_id) msgRef.current?.(row.ticket_id);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, enabled]);
}
