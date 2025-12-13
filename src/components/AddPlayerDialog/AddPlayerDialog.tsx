import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { AVATAR_COLORS } from "../../constants";
import type { PlayerProfile } from "../../types";
import { capitalizeFirst, clampName } from "../../utils/text";
import "./AddPlayerDialog.css";

export type AddPlayerDialogHandle = {
  open: () => void;
  close: () => void;
};

type Props = {
  profiles: PlayerProfile[];
  takenProfileIds: Set<string>;
  onAddFromProfile: (profileId: string) => void;
  onDeleteProfile: (profileId: string) => void;
  onCreateAndAdd: (
    name: string,
    avatarColor: string,
    saveForLater: boolean
  ) => boolean;
};

export const AddPlayerDialog = forwardRef<AddPlayerDialogHandle, Props>(
  function AddPlayerDialog(
    {
      profiles,
      takenProfileIds,
      onAddFromProfile,
      onDeleteProfile,
      onCreateAndAdd,
    },
    ref
  ) {
    const dialogRef = useRef<HTMLDialogElement | null>(null);
    const nameInputRef = useRef<HTMLInputElement | null>(null);
    const [pendingName, setPendingName] = useState("");
    const [selectedColor, setSelectedColor] = useState<string>(
      AVATAR_COLORS[0]?.value ?? "#64748b"
    );
    const [search, setSearch] = useState("");
    const [saveForLater, setSaveForLater] = useState(true);

    const filteredProfiles = useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return profiles;
      return profiles.filter((p) => p.name.toLowerCase().includes(q));
    }, [profiles, search]);

    function open() {
      setPendingName("");
      setSelectedColor(AVATAR_COLORS[0]?.value ?? "#64748b");
      setSearch("");
      setSaveForLater(true);
      dialogRef.current?.showModal();
      queueMicrotask(() => nameInputRef.current?.focus());
    }

    function close() {
      dialogRef.current?.close();
    }

    useImperativeHandle(ref, () => ({ open, close }), []);

    function submit() {
      const name = clampName(pendingName);
      if (!name) return;
      const ok = onCreateAndAdd(name, selectedColor, saveForLater);
      if (ok) close();
    }

    return (
      <dialog
        className="dialog"
        ref={dialogRef}
        onClose={() => setPendingName("")}
      >
        <form
          method="dialog"
          className="dialog__form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="dialog__head">
            <div className="dialog__title">Add player</div>
            <button
              className="iconbtn"
              type="button"
              onClick={close}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <label className="field">
            <span className="field__label">Name</span>
            <input
              ref={nameInputRef}
              className="input"
              value={pendingName}
              onChange={(e) => setPendingName(e.target.value)}
              autoComplete="off"
              inputMode="text"
              maxLength={28}
            />
          </label>

          <div className="field">
            <span className="field__label">Color</span>
            <div
              className="swatches"
              role="radiogroup"
              aria-label="Choose avatar color"
            >
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={
                    c.value === selectedColor
                      ? "swatch swatch--selected"
                      : "swatch"
                  }
                  style={{ backgroundColor: c.value }}
                  onClick={() => setSelectedColor(c.value)}
                  aria-label={c.label}
                  aria-checked={c.value === selectedColor}
                  role="radio"
                />
              ))}
            </div>
          </div>

          <label className="checkRow">
            <input
              className="checkRow__box"
              type="checkbox"
              checked={saveForLater}
              onChange={(e) => setSaveForLater(e.target.checked)}
            />
            <span className="checkRow__text">Save player for future games</span>
          </label>

          {profiles.length ? (
            <div className="field">
              <div className="orLabel">Or pick from past players</div>
              <input
                className="input input--compact"
                placeholder="Search players"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search past players"
              />
              <div className="profiles">
                {filteredProfiles.map((p) => {
                  const disabled = takenProfileIds.has(p.id);
                  const displayName = capitalizeFirst(p.name);
                  return (
                    <div className="profileRow" key={p.id}>
                      <div className="profileLeft">
                        <span
                          className="profileDot"
                          style={{ backgroundColor: p.avatarColor }}
                          aria-hidden="true"
                        />
                        <span className="profileName">{displayName}</span>
                      </div>
                      <div className="profileActions">
                        <button
                          className="btn btn--ghost btn--sm"
                          type="button"
                          onClick={() => {
                            onAddFromProfile(p.id);
                            close();
                          }}
                          disabled={disabled}
                          aria-label={
                            disabled
                              ? `${displayName} already added`
                              : `Add ${displayName}`
                          }
                        >
                          {disabled ? "Added" : "Add"}
                        </button>
                        <button
                          className="iconbtn iconbtn--danger iconbtn--sm"
                          type="button"
                          onClick={() => onDeleteProfile(p.id)}
                          aria-label={`Delete saved player ${displayName}`}
                          title="Delete saved player"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M9 3h6m-8 4h10m-9 0 .7 13h6.6L16 7"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
                {!filteredProfiles.length ? (
                  <div className="profilesEmpty">No matches</div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="dialog__actions">
            <button className="btn btn--ghost" type="button" onClick={close}>
              Cancel
            </button>
            <button
              className="btn btn--primary"
              type="submit"
              disabled={!clampName(pendingName)}
            >
              {saveForLater ? "Create & Add" : "Add"}
            </button>
          </div>
        </form>
      </dialog>
    );
  }
);
