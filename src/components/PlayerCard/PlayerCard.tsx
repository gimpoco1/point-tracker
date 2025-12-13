import { useMemo, useRef, useState } from "react";
import type { Player } from "../../types";
import { QUICK_DELTAS } from "../../constants";
import { avatarStyleFor } from "../../utils/color";
import { capitalizeFirst } from "../../utils/text";
import "./PlayerCard.css";

type Props = {
  player: Player;
  rank: number;
  showRank: boolean;
  pulse?: "pos" | "neg";
  isWinner?: boolean;
  onDelta: (playerId: string, delta: number) => void;
  onDelete: (playerId: string) => void;
};

export function PlayerCard({ player, rank, showRank, pulse, isWinner, onDelta, onDelete }: Props) {
  const displayName = capitalizeFirst(player.name);
  const initial = displayName.trim().slice(0, 1).toUpperCase() || "?";
  const scoreClass = player.score > 0 ? "score score--pos" : player.score < 0 ? "score score--neg" : "score";
  const [customRaw, setCustomRaw] = useState("");
  const customValue = useMemo(() => Number.parseInt(customRaw, 10), [customRaw]);
  const canApplyCustom = Number.isFinite(customValue) && Math.abs(customValue) > 0;
  const ACTION_WIDTH = 92;

  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startSwipeX: number;
    isHorizontal?: boolean;
  } | null>(null);

  function closeSwipe() {
    setSwipeX(0);
  }

  function openSwipe() {
    setSwipeX(-ACTION_WIDTH);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startSwipeX: swipeX,
    };
    setIsSwiping(false);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (drag.isHorizontal === undefined) {
      if (absDx < 6 && absDy < 6) return;
      drag.isHorizontal = absDx > absDy + 4;
    }

    if (!drag.isHorizontal) return;
    e.preventDefault();
    if (!isSwiping) setIsSwiping(true);

    const next = Math.max(-ACTION_WIDTH, Math.min(0, drag.startSwipeX + dx));
    setSwipeX(next);
  }

  function onPointerUpOrCancel(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setIsSwiping(false);
    if (swipeX <= -ACTION_WIDTH * 0.5) openSwipe();
    else closeSwipe();
  }

  return (
    <div
      className="swipeRow"
      data-open={swipeX !== 0 ? "true" : "false"}
      style={{ ["--swipeW" as never]: `${ACTION_WIDTH}px` }}
    >
      <div className="swipeAction" aria-hidden={swipeX === 0}>
        <button
          className="swipeDelete"
          type="button"
          onClick={() => {
            closeSwipe();
            onDelete(player.id);
          }}
          aria-label={`Delete ${player.name}`}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M9 3h6m-8 4h10m-9 0 .7 13h6.6L16 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Remove
        </button>
      </div>

      <article
        className={`card swipeCard${isSwiping ? " swipeCard--dragging" : ""}${isWinner ? " card--winner" : ""}`}
        style={{ transform: `translateX(${swipeX}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUpOrCancel}
        onPointerCancel={onPointerUpOrCancel}
        onClick={() => {
          if (swipeX !== 0 && !isSwiping) closeSwipe();
        }}
      >
        <div className="cardHeader">
          <div className="cardHeader__left">
          {showRank ? (
            <div className="rank" aria-label={`Rank ${rank}`}>
              #{rank}
            </div>
          ) : null}
            <div className="avatar" style={avatarStyleFor(player.avatarColor)} aria-hidden="true">
              {initial}
            </div>
            <div className="who">
              <div className="who__name">{displayName}</div>
            </div>
          </div>

          <div className="cardHeader__right">
            <div className={`${scoreClass}${pulse ? ` score--pulse-${pulse}` : ""}`} aria-label={`Score ${player.score}`}>
              {player.score}
            </div>
            {isWinner ? <div className="winnerMark" aria-label="Winner">🏆</div> : null}
          </div>
        </div>

        <div className="cardBody">
        <div className="actions" aria-label={`Quick points for ${player.name}`}>
          {QUICK_DELTAS.map((delta) => (
            <button
              key={delta}
              type="button"
              className={delta > 0 ? "chip chip--pos" : "chip chip--neg"}
              onClick={() => onDelta(player.id, delta)}
              aria-label={`${delta > 0 ? "Add" : "Subtract"} ${Math.abs(delta)} points`}
            >
              {delta > 0 ? `+${delta}` : `${delta}`}
            </button>
          ))}
        </div>

        <div className="customRow" aria-label={`Custom points for ${displayName}`}>
          <input
            className="input input--compact"
            type="text"
            inputMode="numeric"
            placeholder="Custom"
            value={customRaw}
            onChange={(e) => setCustomRaw(e.target.value.replace(/[^\d]/g, ""))}
            aria-label="Custom points amount"
          />
            <button
              className="btn btn--ghost btn--square"
              type="button"
              disabled={!canApplyCustom}
              onClick={() => {
                onDelta(player.id, -Math.abs(customValue));
                setCustomRaw("");
              }}
              aria-label="Subtract custom points"
              title="Subtract"
            >
              <span className="glyph" aria-hidden="true">
                −
              </span>
            </button>
            <button
              className="btn btn--primary btn--square"
              type="button"
              disabled={!canApplyCustom}
              onClick={() => {
                onDelta(player.id, Math.abs(customValue));
                setCustomRaw("");
              }}
              aria-label="Add custom points"
              title="Add"
            >
              <span className="glyph" aria-hidden="true">
                +
              </span>
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
