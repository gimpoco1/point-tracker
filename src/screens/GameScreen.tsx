import { useEffect, useMemo, useRef, useState } from "react";
import type { Game } from "../types";
import type { ConfirmDialogHandle } from "../components/ConfirmDialog";
import type { PlayerProfile } from "../types";
import { capitalizeFirst } from "../utils/text";
import { sortPlayers } from "../utils/ranking";
import { WinCelebration } from "../components/WinCelebration/WinCelebration";
import {
  AddPlayerDialog,
  AddPlayerDialogHandle,
} from "../components/AddPlayerDialog/AddPlayerDialog";
import { PlayerCard } from "../components/PlayerCard/PlayerCard";

type Props = {
  game: Game;
  profiles: PlayerProfile[];
  confirmRef: React.RefObject<ConfirmDialogHandle>;
  addDialogRef: React.RefObject<AddPlayerDialogHandle>;
  pulseById: Record<string, "pos" | "neg" | undefined>;
  onTriggerPulse: (playerId: string, delta: number) => void;
  onAddFromProfile: (profileId: string) => void;
  onDeleteProfile: (profileId: string) => void;
  onCreateAndAdd: (
    name: string,
    avatarColor: string,
    saveForLater: boolean
  ) => boolean;
  onUpdateScore: (playerId: string, delta: number) => void;
  onDeletePlayer: (playerId: string) => void;
  ranks: Map<string, number>;
  sortedPlayers: Game["players"];
  allZero: boolean;
};

export function GameScreen({
  game,
  profiles,
  confirmRef,
  addDialogRef,
  pulseById,
  onTriggerPulse,
  onAddFromProfile,
  onDeleteProfile,
  onCreateAndAdd,
  onUpdateScore,
  onDeletePlayer,
  ranks,
  sortedPlayers,
  allZero,
}: Props) {
  const takenProfileIds = useMemo(
    () =>
      new Set(game.players.map((p) => p.profileId).filter(Boolean) as string[]),
    [game.players]
  );

  const hasPlayers = game.players.length > 0;
  const [winFxName, setWinFxName] = useState<string | null>(null);
  const prevWinnerIdRef = useRef<string | null>(null);

  const winner = useMemo(() => {
    if (!game.players.length) return null;
    const top = [...game.players].sort(sortPlayers)[0];
    return top && top.score >= game.targetPoints ? top : null;
  }, [game.players, game.targetPoints]);

  useEffect(() => {
    const winnerId = winner?.id ?? null;
    if (winnerId && prevWinnerIdRef.current !== winnerId) {
      setWinFxName(capitalizeFirst(winner?.name ?? ""));
    }
    prevWinnerIdRef.current = winnerId;
  }, [winner]);

  return (
    <>
      {winFxName ? (
        <WinCelebration
          winnerName={winFxName}
          onDone={() => setWinFxName(null)}
        />
      ) : null}
      <main className="content">
        {!hasPlayers ? (
          <section className="empty">
            <h1 className="empty__title">Add players to start.</h1>
            <button
              className="btn btn--primary btn--xl"
              type="button"
              onClick={() => addDialogRef.current?.open()}
            >
              Add first player
            </button>
          </section>
        ) : (
          <section className="grid" aria-label="Players">
            {sortedPlayers.map((player) => {
              const rank = ranks.get(player.id) ?? 1;
              const pulse = pulseById[player.id];
              return (
                <PlayerCard
                  key={player.id}
                  player={player}
                  rank={rank}
                  showRank={!allZero}
                  pulse={pulse}
                  isWinner={winner?.id === player.id}
                  onDelta={(playerId, delta) => {
                    onUpdateScore(playerId, delta);
                    onTriggerPulse(playerId, delta);
                  }}
                  onDelete={async (playerId) => {
                    const p = game.players.find((x) => x.id === playerId);
                    const label = p ? capitalizeFirst(p.name) : "this player";
                    const ok = await confirmRef.current?.confirm({
                      title: "Delete player",
                      message: `Remove "${label}" from this game?`,
                      confirmText: "Delete",
                      tone: "danger",
                    });
                    if (!ok) return;
                    onDeletePlayer(playerId);
                  }}
                />
              );
            })}
          </section>
        )}
      </main>

      <AddPlayerDialog
        ref={addDialogRef}
        profiles={profiles}
        takenProfileIds={takenProfileIds}
        onAddFromProfile={(profileId) => {
          onAddFromProfile(profileId);
        }}
        onDeleteProfile={(profileId) => onDeleteProfile(profileId)}
        onCreateAndAdd={onCreateAndAdd}
      />
    </>
  );
}
