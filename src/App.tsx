import { useMemo, useRef, useState } from "react";
import { ConfirmDialog, type ConfirmDialogHandle } from "./components/ConfirmDialog";
import { TopBar } from "./components/TopBar/TopBar";
import { useProfiles } from "./hooks/useProfiles";
import { useGames } from "./hooks/useGames";
import { useScorePulse } from "./hooks/useScorePulse";
import { HomeScreen } from "./screens/HomeScreen";
import { GameScreen } from "./screens/GameScreen";
import { AddPlayerDialogHandle } from "./components/AddPlayerDialog/AddPlayerDialog";

export default function App() {
  const { profiles, upsertProfile, deleteProfile } = useProfiles();
  const {
    games,
    currentGame,
    createGame,
    selectGame,
    deleteGame,
    addPlayer,
    removePlayer,
    resetScores,
    updateScore,
  } = useGames();
  const { pulseById, triggerPulse } = useScorePulse();
  const confirmRef = useRef<ConfirmDialogHandle>(null!);
  const addDialogRef = useRef<AddPlayerDialogHandle>(null!);
  const [view, setView] = useState<"home" | "game">("home");

  const gameMeta = useMemo(() => {
    if (!currentGame) return undefined;
    return `${currentGame.players.length} ${currentGame.players.length === 1 ? "player" : "players"} · Points to win:  ${currentGame.targetPoints}`;
  }, [currentGame]);

  const hasNonZeroScore = useMemo(() => {
    if (!currentGame) return false;
    return currentGame.players.some((p) => p.score !== 0);
  }, [currentGame]);

  return (
    <div className="app">
      <TopBar
        title={view === "game" && currentGame ? currentGame.name : "Plink"}
        meta={view === "game" && currentGame ? gameMeta : undefined}
        hasPlayers={view === "game" && !!currentGame && currentGame.players.length > 0}
        playerCount={view === "game" && currentGame ? currentGame.players.length : 0}
        showReset={view === "game" && hasNonZeroScore}
        onLogoClick={() => setView("home")}
        onAddPlayer={() => addDialogRef.current?.open()}
        onResetGame={async () => {
          if (!currentGame) return;
          const ok = await confirmRef.current?.confirm({
            title: "Reset game",
            message: "Reset all scores to 0?",
            confirmText: "Reset",
            tone: "danger",
          });
          if (!ok) return;
          resetScores(currentGame.id);
        }}
      />

      {view === "home" ? (
        <HomeScreen
          games={games}
          onCreate={(input) => {
            const created = createGame(input);
            if (created) setView("game");
          }}
          onEnter={(gameId) => {
            selectGame(gameId);
            setView("game");
          }}
          onDelete={async (gameId) => {
            const g = games.find((x) => x.id === gameId);
            const label = g ? g.name : "this game";
            const ok = await confirmRef.current?.confirm({
              title: "Delete game",
              message: `Delete "${label}"? This removes the game and its scores.`,
              confirmText: "Delete",
              tone: "danger",
            });
            if (!ok) return;
            deleteGame(gameId);
          }}
        />
      ) : currentGame ? (
        <GameScreen
          game={currentGame}
          profiles={profiles}
          confirmRef={confirmRef}
          pulseById={pulseById}
          onTriggerPulse={triggerPulse}
          addDialogRef={addDialogRef}
          onAddFromProfile={(profileId) => {
            const profile = profiles.find((p) => p.id === profileId);
            if (!profile) return;
            addPlayer(currentGame.id, { name: profile.name, avatarColor: profile.avatarColor, profileId: profile.id });
          }}
          onDeleteProfile={async (profileId) => {
            const profile = profiles.find((p) => p.id === profileId);
            const label = profile ? profile.name : "this player";
            const ok = await confirmRef.current?.confirm({
              title: "Delete saved player",
              message: `Delete "${label}" from your saved players?`,
              confirmText: "Delete",
              tone: "danger",
            });
            if (!ok) return;
            deleteProfile(profileId);
          }}
          onCreateAndAdd={(name, avatarColor, saveForLater) => {
            if (!currentGame) return false;
            if (!saveForLater) {
              addPlayer(currentGame.id, { name, avatarColor });
              return true;
            }
            const profile = upsertProfile(name, avatarColor);
            if (!profile) return false;
            addPlayer(currentGame.id, { name: profile.name, avatarColor: profile.avatarColor, profileId: profile.id });
            return true;
          }}
          onUpdateScore={(playerId, delta) => updateScore(currentGame.id, playerId, delta)}
          onDeletePlayer={(playerId) => removePlayer(currentGame.id, playerId)}
        />
      ) : (
        <HomeScreen
          games={games}
          onCreate={(input) => {
            const created = createGame(input);
            if (created) setView("game");
          }}
          onEnter={(gameId) => {
            selectGame(gameId);
            setView("game");
          }}
          onDelete={async (gameId) => {
            const ok = await confirmRef.current?.confirm({
              title: "Delete game",
              message: "Delete this game?",
              confirmText: "Delete",
              tone: "danger",
            });
            if (!ok) return;
            deleteGame(gameId);
          }}
        />
      )}

      <ConfirmDialog ref={confirmRef} />
    </div>
  );
}
