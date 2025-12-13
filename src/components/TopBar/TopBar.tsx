import "./TopBar.css";

type Props = {
  hasPlayers: boolean;
  playerCount: number;
  showReset?: boolean;
  title?: string;
  meta?: string;
  onLogoClick?: () => void;
  onAddPlayer: () => void;
  onResetGame: () => void;
};

export function TopBar({
  hasPlayers,
  playerCount,
  showReset = true,
  title = "Point Tracker",
  meta,
  onLogoClick,
  onAddPlayer,
  onResetGame,
}: Props) {
  const displayTitle = title.trim() ? title.trim().replace(/^./, (c) => c.toUpperCase()) : "Point Tracker";
  return (
    <header className="topbar">
      <div className="topbar__left">
        <div className="brand">
          <div className="brand__row">
            <button className="logo" type="button" onClick={onLogoClick} aria-label="Go to games">
              <img src="/icon3.png" alt="" className="logo__img" />
            </button>
            <div className="brand__title">{displayTitle}</div>
          </div>
          {hasPlayers ? (
            <div className="brand__meta" aria-label="Game stats">
              <span className="meta">{meta ?? `${playerCount} ${playerCount === 1 ? "player" : "players"}`}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="topbar__actions">
        {hasPlayers ? (
          <button className="iconbtn iconbtn--primary" type="button" onClick={onAddPlayer} aria-label="Add player">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
        {hasPlayers && showReset ? (
          <button className="iconbtn iconbtn--danger" type="button" onClick={onResetGame} aria-label="Reset game" title="Reset game">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M20 12a8 8 0 1 1-2.34-5.66" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path
                d="M20 4v6h-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
      </div>
    </header>
  );
}
