"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconChartPieFilled,
  IconDiamondFilled,
  IconEyeFilled,
  IconSearchFilled,
} from "@tabler/icons-react";
import { Avatar, GameTag, nameOf } from "./avatar";
import type { ClientInfo, Item, Stat } from "@/lib/connect";
import type { ItemSort } from "@/lib/settings";

/** What "Amount" sorts by: count, else the first number field (e.g. mastery). */
const amountOf = (it: Item) =>
  it.count ?? (it.extra?.find((x) => typeof x.value === "number")?.value as number) ?? -Infinity;

/* ---------- formatting ---------- */

const decimalsOf = (n: number) =>
  Number.isInteger(n) ? 0 : Math.min(2, `${n}`.split(".")[1]?.length ?? 0);

const fmtFull = (n: number, decimals = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** 20394662 -> "20.39M"; below a million stays full ("32,296"). */
const fmtNum = (n: number, decimals = 0) => {
  const a = Math.abs(n);
  for (const [v, u] of [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
  ] as const) {
    if (a >= v) return `${(n / v).toFixed(2).replace(/\.?0+$/, "")}${u}`;
  }
  return fmtFull(n, decimals);
};

const signed = (n: number) =>
  `${n > 0 ? "+" : n < 0 ? "−" : "+"}${fmtNum(Math.abs(n), decimalsOf(n))}`;

function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

const prettyGroup = (k: string) => {
  const t = k
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

function ago(ts: number, now: number) {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 3) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

/* ---------- animation hooks ---------- */

/** Smoothly counts from the previous value to `target` (ease-out). */
function useTween(target: number, ms = 700) {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const from = current.current;
    if (from === target) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      current.current = target;
      setValue(target);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const v = from + (target - from) * (1 - (1 - k) ** 3);
      current.current = v;
      setValue(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

/** Reports how much a number changed; `tick` bumps on every change so CSS animations replay. */
function useChange(value: number | undefined) {
  const prev = useRef(value);
  const [change, setChange] = useState({ delta: 0, tick: 0 });
  useEffect(() => {
    const before = prev.current;
    prev.current = value;
    if (before === undefined || value === undefined || before === value) return;
    setChange((c) => ({ delta: value - before, tick: c.tick + 1 }));
  }, [value]);
  return change;
}

/* ---------- pieces ---------- */

function Num({ value, className = "" }: { value: number; className?: string }) {
  const v = useTween(value);
  const [full, setFull] = useState(false);
  const d = decimalsOf(value);
  const short = Math.abs(value) >= 1e6; // only big numbers have a short form (20.39M)
  if (!short) return <span className={`tabular-nums ${className}`}>{fmtFull(v, d)}</span>;
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        setFull((f) => !f);
      }}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setFull((f) => !f)}
      title={full ? "Click for short" : fmtFull(value, d)}
      className={`cursor-pointer select-none tabular-nums outline-none ${className}`}
    >
      {full ? fmtFull(v, d) : fmtNum(v, d)}
    </span>
  );
}

/** "+137" that floats up and fades out. */
function Delta({
  delta,
  tick,
  className = "",
}: {
  delta: number;
  tick: number;
  className?: string;
}) {
  if (!tick || !delta) return null;
  return (
    <span
      key={tick}
      className={`rise pointer-events-none absolute whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
        delta > 0 ? "bg-accent/15 text-accent-ink" : "bg-danger/15 text-danger"
      } ${className}`}
    >
      {signed(delta)}
    </span>
  );
}

/** Big uppercase section title with optional bits on the right. */
function SectionHead({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 px-1">
      <h2 className="text-xl font-bold uppercase tracking-wide">{title}</h2>
      {right}
    </div>
  );
}

function StatCard({ s, highlight, index }: { s: Stat; highlight: boolean; index: number }) {
  const n = typeof s.value === "number" ? s.value : undefined;
  const { delta, tick } = useChange(n);
  return (
    <div
      className="enter relative flex w-[calc(50%-0.375rem)] select-none flex-col items-center gap-1 rounded-2xl bg-raised/60 px-4 py-5 text-center sm:w-[calc(25%-0.5625rem)]"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {tick > 0 && (
        <span
          key={tick}
          className={`tint pointer-events-none absolute inset-0 rounded-2xl ${delta < 0 ? "tint-down" : ""}`}
        />
      )}
      <span
        title={String(s.value)}
        className={`relative w-full truncate text-2xl font-bold tracking-tight ${highlight ? "text-accent-ink" : "text-fg"}`}
      >
        {n !== undefined ? <Num value={n} /> : s.value}
      </span>
      <span className="relative w-full truncate text-xs text-muted">{s.label}</span>
      <Delta delta={delta} tick={tick} className="right-2 top-2" />
    </div>
  );
}

/** Item picture: a plain image, or one cell cut out of a sprite sheet (imageOffset). */
function ItemIcon({ it, box = 44 }: { it: Item; box?: number }) {
  const [broken, setBroken] = useState(false);
  const [sheet, setSheet] = useState<{ w: number; h: number } | null>(null);
  const sp = it.sprite;

  useEffect(() => {
    setSheet(null);
    if (!sp || !it.icon) return;
    const img = new Image();
    img.onload = () => setSheet({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setBroken(true);
    img.src = it.icon;
  }, [it.icon, sp]);

  let inner: React.ReactNode = null;
  if (it.icon && !broken) {
    if (!sp) {
      inner = (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={it.icon}
          alt=""
          onError={() => setBroken(true)}
          className="size-full rounded-xl object-cover"
        />
      );
    } else if (sheet) {
      // r: loaded-image px per original-sheet px (1 for the full file, <1 for a thumbnail)
      const r = it.iconNative ? 1 : sheet.w / sp.sheet;
      const s = box / (Math.max(sp.w, sp.h) * r);
      inner = (
        <span
          className="block rounded-xl"
          style={{
            width: sp.w * r * s,
            height: sp.h * r * s,
            backgroundImage: `url(${it.icon})`,
            backgroundSize: `${sheet.w * s}px ${sheet.h * s}px`,
            backgroundPosition: `${-sp.x * r * s}px ${-sp.y * r * s}px`,
            backgroundRepeat: "no-repeat",
          }}
        />
      );
    }
  }
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-xl text-dim ${
        inner ? "" : "bg-raised"
      }`}
      style={{ width: box, height: box }}
    >
      {inner ?? (it.icon && !broken ? null : <IconDiamondFilled size={18} />)}
    </span>
  );
}

function Extra({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="truncate text-fg/80">
      <span className="text-dim">{label} </span>
      {typeof value === "number" ? <Num value={value} /> : value}
    </span>
  );
}

function ItemCard({ it, index }: { it: Item; index: number }) {
  const gained = useChange(it.gained);
  const count = useChange(it.count);
  const float = count.tick ? count : gained; // prefer showing how much the inventory moved
  const showGain = it.gained !== undefined && it.gained !== 0;

  return (
    <div
      className="enter relative flex select-none items-center gap-3 rounded-2xl bg-raised/40 p-3 transition-colors hover:bg-raised"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {float.tick > 0 && (
        <span
          key={`t${float.tick}`}
          className={`tint pointer-events-none absolute inset-0 rounded-2xl ${float.delta < 0 ? "tint-down" : ""}`}
        />
      )}
      <ItemIcon it={it} box={48} />
      <span className={`relative min-w-0 flex-1 ${showGain ? "pr-12" : ""}`}>
        <span className="block truncate text-sm font-medium">{it.name}</span>
        <span className="mt-0.5 flex items-center gap-3 text-xs text-muted">
          {it.detail ?? (
            <>
              {it.count !== undefined && (
                <span className="truncate">
                  <span className="font-medium text-fg/90">
                    <Num value={it.count} />
                  </span>{" "}
                  in inventory
                </span>
              )}
              {it.extra?.map((x) => <Extra key={x.label} {...x} />)}
            </>
          )}
        </span>
      </span>

      {showGain && (
        <span
          key={`g${gained.tick}`}
          className={`${gained.tick ? "pop" : ""} absolute right-2.5 top-2.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
            it.gained! > 0 ? "bg-accent/10 text-accent-ink" : "bg-danger/10 text-danger"
          }`}
        >
          {it.gained! > 0 ? "+" : ""}
          <Num value={it.gained!} />
        </span>
      )}
      <Delta
        delta={float.delta}
        tick={float.tick}
        className={showGain ? "right-14 top-2" : "right-3 top-2"}
      />
    </div>
  );
}

/** Avatar + @username are blurred until clicked (safe for streaming / screenshots). */
function Identity({
  client,
  id,
  shown,
  onToggle,
}: {
  client?: ClientInfo;
  id: string;
  shown: boolean;
  onToggle: () => void;
}) {
  const p = client?.profile;
  return (
    <div className="flex flex-col items-center">
      <button
        onClick={onToggle}
        title={shown ? "Click to hide" : "Click to reveal"}
        className="group relative outline-none"
      >
        <Avatar client={client} size={88} blur={!shown} />
        {!shown && (
          <span className="absolute inset-0 grid place-items-center text-fg/80 transition-transform group-hover:scale-110">
            <IconEyeFilled size={22} />
          </span>
        )}
      </button>
      <span className="mt-3 text-base font-semibold">{nameOf(client, id)}</span>
      {p?.username && (
        <button
          onClick={onToggle}
          title={shown ? "Click to hide" : "Click to reveal"}
          className={`text-xs text-dim outline-none transition-[filter] duration-300 ${shown ? "" : "blur-[4px]"}`}
        >
          @{p.username}
        </button>
      )}
      {p?.game && <GameTag game={p.game} className="mt-2" />}
    </div>
  );
}

/** One item group ("Materials"): big header with a count and its own search box. */
function ItemSection({ title, items }: { title: string; items: Item[] }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const shown = query ? items.filter((it) => it.name.toLowerCase().includes(query)) : items;

  return (
    <section className="mt-10 w-full">
      <SectionHead
        title={title}
        right={
          <>
            <span className="rounded-full bg-raised px-2.5 py-0.5 font-mono text-xs tabular-nums text-muted">
              {query ? `${shown.length}/${items.length}` : items.length}
            </span>
            <div className="relative ml-auto w-full sm:w-56">
              <IconSearchFilled
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-dim"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setQ("")}
                placeholder={`Search ${title.toLowerCase()}`}
                className="h-9 w-full rounded-full bg-raised pl-9 pr-4 text-sm outline-none transition-colors placeholder:text-dim focus:bg-hover"
              />
            </div>
          </>
        }
      />
      {shown.length ? (
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(() => {
            // key by name (+ repeat count for duplicate names) so re-sorting keeps each card
            const seen = new Map<string, number>();
            return shown.map((it, i) => {
              const n = (seen.get(it.name) ?? 0) + 1;
              seen.set(it.name, n);
              return <ItemCard key={`${it.name}#${n}`} it={it} index={i} />;
            });
          })()}
        </div>
      ) : (
        <div className="rounded-2xl bg-raised/40 px-4 py-6 text-center text-sm text-dim">
          No {title.toLowerCase()} match &ldquo;{q.trim()}&rdquo;
        </div>
      )}
    </section>
  );
}

/* ---------- page ---------- */

export default function Overview({
  client,
  id,
  shown,
  onToggleShown,
  sort = "name",
}: {
  client?: ClientInfo;
  id: string;
  shown: boolean;
  onToggleShown: () => void;
  sort?: ItemSort;
}) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const state = client?.state;
  // timer: stats.started > profile time (os.time()) > when the socket connected
  const start = state?.started ?? client?.profile?.time ?? client?.connectedAt ?? 0;
  const end = client?.online ? now : (client?.lastSeen ?? now);
  const elapsed = now && start ? end - start : 0;

  // items = { swords = {...}, fruits = {...} } -> one section per group, in the order received
  const groups: [string, Item[]][] = [];
  for (const it of state?.items ?? []) {
    const title = it.group ? prettyGroup(it.group) : "Items";
    const g = groups.find(([t]) => t === title);
    if (g) g[1].push(it);
    else groups.push([title, [it]]);
  }
  if (sort !== "default") {
    const byName = (a: Item, b: Item) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    for (const g of groups) {
      g[1] = [...g[1]].sort((a, b) =>
        sort === "name" ? byName(a, b) : amountOf(b) - amountOf(a) || byName(a, b),
      );
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-4xl flex-col items-center px-6 pb-10 pt-14">
        <Identity client={client} id={id} shown={shown} onToggle={onToggleShown} />

        <div className="mt-2 text-5xl font-bold tabular-nums tracking-tight sm:text-7xl">
          {clock(elapsed)}
        </div>

        {state && state.stats.length > 0 && (
          <section className="mt-10 w-full">
            <SectionHead
              title="Stats"
              right={
                now ? (
                  <span className="ml-auto text-xs text-dim">
                    Updated {ago(state.updatedAt, now)}
                  </span>
                ) : null
              }
            />
            <div className="flex flex-wrap justify-center gap-3">
              {state.stats.map((s, i) => (
                <StatCard key={s.label || i} s={s} index={i} highlight={!!s.highlight} />
              ))}
            </div>
          </section>
        )}

        {groups.map(([title, items]) => (
          <ItemSection key={title} title={title} items={items} />
        ))}

        {!state && (
          <div className="mt-10 flex w-full flex-col items-center gap-2 rounded-2xl bg-raised/60 px-6 py-8 text-center text-sm text-muted">
            <IconChartPieFilled size={26} className="text-dim" />
            No stats yet
            <span className="text-xs text-dim">
              Send <span className="font-mono text-accent-ink">{'{ types = "stats" }'}</span> from
              Roblox to fill this page.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
