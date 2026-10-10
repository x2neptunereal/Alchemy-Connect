"use client";

import { useState } from "react";
import { IconDeviceGamepad2Filled, IconUserFilled } from "@tabler/icons-react";
import type { ClientInfo, GameInfo } from "@/lib/connect";

/** `blur` hides only the picture; the online/offline dot stays sharp. */
export function Avatar({
  client,
  size = 36,
  blur = false,
}: {
  client?: ClientInfo;
  size?: number;
  blur?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const src = client?.profile?.avatar;
  return (
    <span className="relative block shrink-0" style={{ width: size, height: size }}>
      <span
        className="block size-full overflow-hidden rounded-full transition-[filter] duration-300"
        style={{ filter: blur ? `blur(${Math.max(3, size * 0.09)}px)` : undefined }}
      >
        {src && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            onError={() => setBroken(true)}
            className="size-full rounded-full bg-hover object-cover"
          />
        ) : (
          <span className="grid size-full place-items-center rounded-full bg-hover text-dim">
            <IconUserFilled size={size * 0.5} />
          </span>
        )}
      </span>
      <span
        className={`absolute bottom-0 right-0 rounded-full ring-[3px] ring-panel ${
          client?.online ? "bg-accent" : "bg-dim"
        }`}
        style={{ width: Math.max(12, size * 0.2), height: Math.max(12, size * 0.2) }}
      />
    </span>
  );
}

export const nameOf = (c?: ClientInfo, fallback = "") =>
  c?.profile?.displayName || c?.profile?.username || c?.id || fallback;

export function subOf(c?: ClientInfo) {
  const p = c?.profile;
  if (!p) return null;
  const parts = [];
  if (p.username) parts.push(`@${p.username}`);
  if (p.userId) parts.push(String(p.userId));
  return parts.join(" · ");
}

/** Small game icon + name chip. */
export function GameTag({ game, className = "" }: { game?: GameInfo; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (!game) return null;
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-1.5 rounded-full bg-raised py-0.5 pl-0.5 pr-2.5 text-xs text-muted ${className}`}
      title={`Game ${game.id}`}
    >
      {game.icon && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={game.icon}
          alt=""
          onError={() => setBroken(true)}
          className="size-5 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-hover text-dim">
          <IconDeviceGamepad2Filled size={12} />
        </span>
      )}
      <span className="truncate">{game.name ?? `Game ${game.id}`}</span>
    </span>
  );
}
