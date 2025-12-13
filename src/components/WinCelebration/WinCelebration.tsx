import { useEffect } from "react";
import "./WinCelebration.css";

type Props = {
  winnerName: string;
  onDone: () => void;
};

export function WinCelebration({ winnerName, onDone }: Props) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 2200);
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <div className="winFx" role="status" aria-live="polite" aria-label={`${winnerName} wins`}>
      <div className="winFx__veil" />
      <div className="winFx__content">
        <div className="winFx__badge">Winner</div>
        <div className="winFx__name">{winnerName}</div>
        <div className="winFx__hint">Tap to keep scoring</div>
      </div>
      <div className="winFx__confetti" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, i) => (
          <span className="confetti" key={i} style={{ ["--i" as never]: i }} />
        ))}
      </div>
    </div>
  );
}

