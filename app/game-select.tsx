"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconCaretDownFilled,
  IconCircleCheckFilled,
  IconDeviceGamepad2Filled,
} from "@tabler/icons-react";
import type { GameInfo } from "@/lib/connect";

function GameIcon({ game, size }: { game?: GameInfo; size: number }) {
  const [broken, setBroken] = useState(false);
  if (game?.icon && !broken)
    return (
      <img
        src={game.icon}
        alt=""
        onError={() => setBroken(true)}
        className="shrink-0 rounded-lg object-cover"
        style={{ width: size, height: size }}
      />
    );
  return (
    <span
      className="grid shrink-0 place-items-center rounded-lg bg-hover text-dim"
      style={{ width: size, height: size }}
    >
      <IconDeviceGamepad2Filled size={size * 0.6} />
    </span>
  );
}

const nameOf = (g: GameInfo) => g.name ?? `Game ${g.id}`;

export default function GameSelect({
  games,
  total,
  value,
  onChange,
}: {
  games: { game: GameInfo; n: number }[];
  total: number;
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const current = games.find((g) => g.game.id === value)?.game;

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", down);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("keydown", key);
    };
  }, [open]);

  const pick = (id: number | null) => {
    onChange(id);
    setOpen(false);
  };

  const Row = ({
    id,
    game,
    label,
    n,
  }: {
    id: number | null;
    game?: GameInfo;
    label: string;
    n: number;
  }) => (
    <button
      onClick={() => pick(id)}
      className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-raised ${
        value === id ? "text-fg" : "text-muted"
      }`}
    >
      <GameIcon game={game} size={24} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="font-mono text-[11px] tabular-nums text-dim">{n}</span>
      {value === id && <IconCircleCheckFilled size={15} className="shrink-0 text-accent-ink" />}
    </button>
  );

  return (
    <div ref={box} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        title={current ? nameOf(current) : "All games"}
        className={`flex h-9 items-center gap-1 rounded-full pl-1.5 pr-2 outline-none transition-colors ${
          open || value !== null ? "bg-hover" : "bg-raised hover:bg-hover"
        }`}
      >
        <GameIcon game={current} size={24} />
        <IconCaretDownFilled
          size={12}
          className={`text-dim transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="enter absolute left-0 top-11 z-30 flex w-64 flex-col gap-0.5 rounded-2xl bg-hover p-1.5">
          <Row id={null} label="All games" n={total} />
          {games.map(({ game, n }) => (
            <Row key={game.id} id={game.id} game={game} label={nameOf(game)} n={n} />
          ))}
        </div>
      )}
    </div>
  );
}
