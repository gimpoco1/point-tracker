import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Player } from "../types";
import { computeRanks, sortPlayers } from "../utils/ranking";

function idsKey(players: Player[]): string {
  return players.map((p) => p.id).join("|");
}

function sortedIds(players: Player[]): string[] {
  return [...players].sort(sortPlayers).map((p) => p.id);
}

export function useDelayedRanking(players: Player[], delayMs = 1200) {
  const playersRef = useRef<Player[]>(players);
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  const [orderIds, setOrderIds] = useState<string[]>(() => sortedIds(players));
  const timerRef = useRef<number | null>(null);

  const key = useMemo(() => idsKey(players), [players]);

  const forceResort = useCallback(() => {
    setOrderIds(sortedIds(playersRef.current));
  }, []);

  const scheduleResort = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      forceResort();
    }, delayMs);
  }, [delayMs, forceResort]);

  useEffect(() => {
    // Add/remove players should update ordering immediately.
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setOrderIds(sortedIds(players));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const orderedPlayers = useMemo(() => {
    const byId = new Map(players.map((p) => [p.id, p] as const));
    const out: Player[] = [];
    for (const id of orderIds) {
      const p = byId.get(id);
      if (p) out.push(p);
    }
    // In case orderIds is stale, append missing players deterministically.
    if (out.length !== players.length) {
      const missing = players.filter((p) => !orderIds.includes(p.id)).sort(sortPlayers);
      out.push(...missing);
    }
    return out;
  }, [orderIds, players]);

  const ranks = useMemo(() => computeRanks(orderedPlayers), [orderedPlayers]);

  return { orderedPlayers, ranks, scheduleResort, forceResort };
}

