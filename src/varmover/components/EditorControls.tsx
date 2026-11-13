import { useEffect, useState } from "react";

export function CommitTextField({
  value,
  onCommit,
  placeholder,
  className = "",
}: {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  function commit(): void {
    const clean = draft.trim();
    if (!clean) {
      setDraft(value);
      return;
    }
    if (clean !== value) onCommit(clean);
  }

  return (
    <input
      className={`material-input ${className}`}
      value={draft}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(value);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

export function CommitNumberField({
  value,
  onCommit,
  minimum,
  maximum,
  step = 1,
  className = "",
}: {
  value: number;
  onCommit: (value: number) => void;
  minimum?: number;
  maximum?: number;
  step?: number;
  className?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  function commit(): void {
    let numeric = Number(draft);
    if (!Number.isFinite(numeric)) {
      setDraft(String(value));
      return;
    }
    if (minimum !== undefined) numeric = Math.max(minimum, numeric);
    if (maximum !== undefined) numeric = Math.min(maximum, numeric);
    if (numeric !== value) onCommit(numeric);
    setDraft(String(numeric));
  }

  return (
    <input
      className={`material-input material-input-number ${className}`}
      type="number"
      value={draft}
      min={minimum}
      max={maximum}
      step={step}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(String(value));
          event.currentTarget.blur();
        }
      }}
    />
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}) {
  return (
    <label className="material-switch">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="material-switch-track"><span className="material-switch-thumb" /></span>
      {label && <span>{label}</span>}
    </label>
  );
}
