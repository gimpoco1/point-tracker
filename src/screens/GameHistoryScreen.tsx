import { translate } from "../i18n/translate";
import {
  useRef,
  useState,
  type PointerEvent,
  type TouchEvent,
  type MouseEvent,
} from "react";
import type { Game } from "../types";
import { avatarStyleFor } from "../utils/color";
import { capitalizeFirst } from "../utils/text";
import { TeamIcon } from "../components/TeamIcon/TeamIcon";
import { HistoryTurnRow } from "../features/game-history/components/HistoryTurnRow";
import { useGameHistory } from "../features/game-history/hooks/useGameHistory";
import "../features/game-history/styles/GameHistoryScreen.css";

type Props = {
  game: Game;
};

export function GameHistoryScreen({ game }: Props) {
  const [selectedPlayerId, setSelectedPlayerId] = useState("all");
  const filterDragRef = useRef({
    pointerId: -1,
    startX: 0,
    scrollLeft: 0,
    dragged: false,
  });
  const {
    entries,
    isTeamsGame,
    timeFormat,
    playerOptions,
    showPlayerFilter,
    hasSelectedPlayer,
    groupedEntries,
  } = useGameHistory(game, selectedPlayerId);

  function handleFilterPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    filterDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
      dragged: false,
    };
  }

  function handleFilterPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = filterDragRef.current;
    if (drag.pointerId !== event.pointerId) return;

    // A press may end outside the strip before we have captured a drag.
    if (event.pointerType === "mouse" && event.buttons === 0) {
      drag.pointerId = -1;
      drag.dragged = false;
      return;
    }

    const deltaX = event.clientX - drag.startX;
    if (Math.abs(deltaX) > 4) {
      drag.dragged = true;
      // Capture only drags so ordinary clicks still reach the filter buttons.
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
    }
    event.currentTarget.scrollLeft = drag.scrollLeft - deltaX;
  }

  function handleFilterPointerEnd(event: PointerEvent<HTMLDivElement>) {
    const drag = filterDragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    filterDragRef.current.pointerId = -1;
  }

  function handleFilterClickCapture(event: MouseEvent<HTMLDivElement>) {
    // Keyboard activation must never be consumed by an earlier pointer drag.
    if (event.detail === 0) return;
    if (!filterDragRef.current.dragged) return;
    event.preventDefault();
    event.stopPropagation();
    filterDragRef.current.dragged = false;
  }

  function stopFilterTouchPropagation(event: TouchEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  return (
    <main
      className={`content historyContent${
        isTeamsGame ? " historyContent--teams" : ""
      }`}
    >
      {entries.length > 0 ? (
        <section
          className="historyList"
          aria-label={translate("topbar.gameHistory")}
        >
          {showPlayerFilter ? (
            <div
              className="historyFilter"
              aria-label={translate("dynamic.filterHistoryBy", [
                translate(isTeamsGame ? "common.team" : "common.player"),
              ])}
              onClickCapture={handleFilterClickCapture}
              onPointerDown={handleFilterPointerDown}
              onPointerMove={handleFilterPointerMove}
              onPointerUp={handleFilterPointerEnd}
              onPointerCancel={handleFilterPointerEnd}
              onTouchStart={stopFilterTouchPropagation}
              onTouchEnd={stopFilterTouchPropagation}
            >
              <button
                className={`historyFilter__chip${
                  selectedPlayerId === "all" || !hasSelectedPlayer
                    ? " historyFilter__chip--active"
                    : ""
                }`}
                type="button"
                onClick={() => setSelectedPlayerId("all")}
              >
                {translate("copy.all")}
              </button>
              {playerOptions.map((player) => (
                <button
                  key={player.id}
                  className={`historyFilter__chip${
                    selectedPlayerId === player.id
                      ? " historyFilter__chip--active"
                      : ""
                  }`}
                  type="button"
                  onClick={() => setSelectedPlayerId(player.id)}
                >
                  {player.icon ? (
                    <span
                      className="historyFilter__teamIcon"
                      aria-hidden="true"
                    >
                      <TeamIcon
                        icon={player.icon}
                        size={13}
                        strokeWidth={2.2}
                        aria-hidden="true"
                      />
                    </span>
                  ) : (
                    <span
                      className="historyFilter__swatch"
                      style={avatarStyleFor(player.avatarColor)}
                      aria-hidden="true"
                    />
                  )}
                  {capitalizeFirst(player.name)}
                </button>
              ))}
            </div>
          ) : null}
          {groupedEntries.map((group) => (
            <section className="historyGroup" key={group.key}>
              <h2 className="historyGroup__title">{group.label}</h2>
              <div className="historyRows">
                {group.turns.map((turn) => (
                  <HistoryTurnRow
                    key={turn.key}
                    turn={turn}
                    timeLabel={timeFormat.format(new Date(turn.createdAt))}
                    isTeamsGame={isTeamsGame}
                  />
                ))}
              </div>
            </section>
          ))}
        </section>
      ) : (
        <section className="empty historyEmpty">
          <h1 className="empty__title">
            {translate("copy.noScoreHistoryYet")}
          </h1>
          <p className="empty__hint">
            {translate("copy.scoreChangesWillAppearHere")}
          </p>
        </section>
      )}
    </main>
  );
}
