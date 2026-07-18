import { useEffect, useState } from "react";
import { getEvents, type AgentEvent } from "../api/client";

/** Loads the historical agent feed, then subscribes to live events over WebSocket. */
export function useCaseSocket(caseId: string | undefined) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!caseId) return;
    // history first (events that happened before this page opened)
    getEvents(caseId).then((history) =>
      setEvents((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        return [...history.filter((e) => !seen.has(e.id)), ...prev]
          .sort((a, b) => a.id - b.id);
      })
    ).catch(() => {});

    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws/cases/${caseId}`);
    ws.onopen = () => setConnected(true);
    ws.onmessage = (msg) => {
      const event: AgentEvent = JSON.parse(msg.data);
      setEvents((prev) => prev.some((e) => e.id === event.id) ? prev : [...prev, event]);
    };
    ws.onclose = () => setConnected(false);
    const ping = setInterval(() => ws.readyState === 1 && ws.send("ping"), 20000);
    return () => { clearInterval(ping); ws.close(); };
  }, [caseId]);

  return { events, connected };
}
