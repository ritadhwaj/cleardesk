import { useEffect, useState } from "react";
import type { AgentEvent } from "../api/client";

/** Subscribes to the live agent-event feed for a case over WebSocket. */
export function useCaseSocket(caseId: string | undefined) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!caseId) return;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws/cases/${caseId}`);
    ws.onopen = () => setConnected(true);
    ws.onmessage = (msg) => {
      const event: AgentEvent = JSON.parse(msg.data);
      setEvents((prev) => [...prev, event]);
    };
    ws.onclose = () => setConnected(false);
    const ping = setInterval(() => ws.readyState === 1 && ws.send("ping"), 20000);
    return () => { clearInterval(ping); ws.close(); };
  }, [caseId]);

  return { events, connected };
}
