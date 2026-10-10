"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconCircleArrowDownFilled,
  IconCircleArrowDownLeftFilled,
  IconCircleArrowLeftFilled,
  IconCodeCircle2Filled,
  IconLayoutDashboardFilled,
  IconCircleArrowUpRightFilled,
  IconCopyCheckFilled,
  IconCopyFilled,
  IconTrashXFilled,
  IconFileCodeFilled,
  IconMessageCircleFilled,
  IconRadarFilled,
  IconSearchFilled,
  IconSendFilled,
  IconScaleFilled,
  IconSettingsFilled,
  IconTrashFilled,
  IconUserFilled,
} from "@tabler/icons-react";
import Logo from "./logo";
import { Avatar, nameOf, subOf } from "./avatar";
import Overview from "./overview";
import GameSelect from "./game-select";
import { LuaCode } from "./code";
import { SettingsPanel, useSettings } from "./settings";
import LicensePanel from "./license";
import {
  CLIENT_PATH,
  UI_PATH,
  type ClientInfo,
  type ConnectionConfig,
  type LogEntry,
  type ServerEvent,
  type UIEvent,
} from "@/lib/connect";

type Status = "connecting" | "open" | "closed";
type View = "clients" | "settings" | "license";

const MAX_VIEW = 1000;

/* ---------- helpers ---------- */

function ago(ts: number, now: number) {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function clock(ts: number) {
  const d = new Date(ts);
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

function pretty(data: string): { text: string; json: boolean } {
  const t = data.trim();
  if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
    try {
      return { text: JSON.stringify(JSON.parse(t), null, 2), json: true };
    } catch {}
  }
  return { text: data, json: false };
}

function copy(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

function CopyButton({
  text,
  className = "",
  label,
}: {
  text: string;
  className?: string;
  label?: string;
}) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 1200);
    return () => clearTimeout(t);
  }, [done]);
  const Icon = done ? IconCopyCheckFilled : IconCopyFilled;
  return (
    <button
      onClick={() => {
        copy(text);
        setDone(true);
      }}
      title="Copy"
      className={`flex items-center gap-1.5 outline-none transition-colors ${
        done ? "text-accent-ink" : "hover:text-accent-ink"
      } ${className}`}
    >
      <Icon size={14} />
      {label && <span>{done ? "Copied" : label}</span>}
    </button>
  );
}

function clientFromPath(path: string): string | null {
  const m = path.match(/^\/clients\/([^/]+)\/?$/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

/* ---------- small pieces ---------- */

function ServerPill({ status }: { status: Status }) {
  const label = status === "open" ? "Live" : status === "connecting" ? "Connecting" : "Offline";
  const color =
    status === "open" ? "text-accent-ink" : status === "connecting" ? "text-muted" : "text-danger";
  return (
    <span
      className={`flex items-center gap-2 rounded-full bg-raised px-3 py-1.5 text-xs font-medium ${color}`}
    >
      <span
        className={`size-1.5 rounded-full ${
          status === "open" ? "bg-accent" : status === "connecting" ? "bg-muted" : "bg-danger"
        }`}
      />
      {label}
    </span>
  );
}

const Row = memo(function Row({ e, fresh }: { e: LogEntry; fresh: boolean }) {
  const { text, json } = useMemo(() => pretty(e.data), [e.data]);
  const inbound = e.dir === "in";
  return (
    <div
      className={`group grid grid-cols-[auto_auto_1fr_auto] items-start gap-3 rounded-xl px-3 py-2 font-mono text-[13px] leading-5 transition-colors hover:bg-raised ${
        fresh ? "flash" : ""
      }`}
    >
      <span className="select-none text-dim tabular-nums">{clock(e.ts)}</span>
      <span
        className={`mt-0.5 flex select-none items-center gap-0.5 rounded-full py-px pl-1 pr-2 text-[10px] font-semibold uppercase leading-4 tracking-wider ${
          inbound ? "bg-accent/10 text-accent-ink" : "bg-hover text-muted"
        }`}
        title={inbound ? "From Roblox" : "Sent from web"}
      >
        {inbound ? (
          <IconCircleArrowDownLeftFilled size={12} />
        ) : (
          <IconCircleArrowUpRightFilled size={12} />
        )}
        {inbound ? "in" : "out"}
      </span>
      <pre
        className={`min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere] ${json ? "text-fg" : inbound ? "text-fg" : "text-muted"}`}
      >
        {text}
      </pre>
      <CopyButton
        text={e.data}
        className="mt-0.5 select-none rounded-full px-1 text-dim opacity-0 group-hover:opacity-100"
      />
    </div>
  );
});

/* ---------- main ---------- */

export default function Dashboard() {
  const [status, setStatus] = useState<Status>("connecting");
  const [clients, setClients] = useState<Record<string, ClientInfo>>({});
  // selected client comes from the URL: /clients/{id}
  const [selected, setSelected] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [freshFrom, setFreshFrom] = useState(Infinity);
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState("");
  const [follow, setFollow] = useState(true);
  const [now, setNow] = useState(0);
  const [origin, setOrigin] = useState("ws://localhost:3000");
  const [conn, setConn] = useState<ConnectionConfig | null>(null);
  // address Roblox should use: same host, Roblox port from settings
  const wsOrigin = conn ? `ws://${conn.baseUrl}:${conn.wsPort}` : origin;
  const [view, setView] = useState<View>("clients");
  const [settings, setSettings] = useSettings();
  const [pane, setPane] = useState<"overview" | "console">("overview");
  // avatar + @username stay blurred until revealed (click the avatar on the client page)
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const toggleReveal = useCallback(
    (id: string) =>
      setRevealed((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );
  const hidden = (id: string) => !revealed.has(id);
  const dev = settings.developer;
  const showConsole = dev && pane === "console";

  const wsRef = useRef<WebSocket | null>(null);
  const selectedRef = useRef<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const send = useCallback((ev: UIEvent) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(ev));
  }, []);

  // ticking clock for "x ago"
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  // socket to the server
  useEffect(() => {
    const wsProto = location.protocol === "https:" ? "wss" : "ws";
    setOrigin(`${wsProto}://${location.host}`);

    let ws: WebSocket;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout>;
    let dead = false;

    const onEvent = (ev: ServerEvent) => {
      switch (ev.type) {
        case "snapshot":
          setClients(Object.fromEntries(ev.clients.map((c) => [c.id, c])));
          break;
        case "client":
          setClients((prev) => ({ ...prev, [ev.client.id]: ev.client }));
          break;
        case "config":
          setConn(ev.config);
          break;
        case "remove":
          setClients((prev) => {
            const next = { ...prev };
            delete next[ev.id];
            return next;
          });
          break;
        case "history":
          if (ev.id === selectedRef.current) {
            setFreshFrom(Infinity);
            setLogs(ev.entries.slice(-MAX_VIEW));
          }
          break;
        case "log":
          if (ev.id === selectedRef.current) {
            setFreshFrom((f) => Math.min(f, ev.entry.seq));
            setLogs((prev) => {
              const next = prev.length >= MAX_VIEW ? prev.slice(-MAX_VIEW + 1) : prev.slice();
              next.push(ev.entry);
              return next;
            });
          }
          break;
      }
    };

    const open = () => {
      setStatus("connecting");
      ws = new WebSocket(`${wsProto}://${location.host}${UI_PATH}`);
      wsRef.current = ws;
      ws.onopen = () => {
        retry = 0;
        setStatus("open");
        ws.send(JSON.stringify({ type: "subscribe", id: selectedRef.current } satisfies UIEvent));
      };
      ws.onmessage = (m) => {
        try {
          onEvent(JSON.parse(m.data));
        } catch {}
      };
      ws.onclose = () => {
        if (dead) return;
        setStatus("closed");
        timer = setTimeout(open, Math.min(5000, 400 * 2 ** retry++));
      };
    };
    open();

    return () => {
      dead = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, []);

  // URL changed (click, back/forward, direct link) -> load that client's messages
  useEffect(() => {
    selectedRef.current = selected;
    setLogs([]);
    setFreshFrom(Infinity);
    setFollow(true);
    send({ type: "subscribe", id: selected });
  }, [selected, send]);

  const select = useCallback((id: string | null) => {
    const url = id ? `/clients/${encodeURIComponent(id)}` : "/";
    if (location.pathname !== url) history.pushState(null, "", url);
    setSelected(id);
  }, []);

  // read the URL on load and on back/forward
  useEffect(() => {
    // old links: /?c={id} -> /clients/{id}
    const legacy = new URLSearchParams(location.search).get("c");
    if (legacy) history.replaceState(null, "", `/clients/${encodeURIComponent(legacy)}`);
    const sync = () => setSelected(clientFromPath(location.pathname));
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  // keep pinned to bottom
  useEffect(() => {
    const el = logRef.current;
    if (el && follow) el.scrollTop = el.scrollHeight;
  }, [logs, follow, showConsole]);

  const onScroll = () => {
    const el = logRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (atBottom !== follow) setFollow(atBottom);
  };

  // games seen across clients -> filter chips under the search box
  const games = useMemo(() => {
    const m = new Map<number, { game: NonNullable<ClientInfo["profile"]>["game"]; n: number }>();
    for (const c of Object.values(clients)) {
      const g = c.profile?.game;
      if (!g) continue;
      const e = m.get(g.id);
      m.set(g.id, { game: g.name || !e ? g : e.game, n: (e?.n ?? 0) + 1 });
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [clients]);
  const [gameFilter, setGameFilter] = useState<number | null>(null);
  // a filter on a game that's no longer listed would hide everyone
  useEffect(() => {
    if (gameFilter !== null && !games.some((g) => g.game!.id === gameFilter)) setGameFilter(null);
  }, [games, gameFilter]);

  const list = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return Object.values(clients)
      .filter((c) => gameFilter === null || c.profile?.game?.id === gameFilter)
      .filter(
        (c) =>
          !q ||
          [c.id, c.profile?.username, c.profile?.displayName, c.profile?.game?.name]
            .filter(Boolean)
            .some((v) => v!.toLowerCase().includes(q)),
      )
      .sort((a, b) => Number(b.online) - Number(a.online) || b.lastSeen - a.lastSeen);
  }, [clients, filter, gameFilter]);

  const onlineCount = useMemo(
    () => Object.values(clients).filter((c) => c.online).length,
    [clients],
  );
  const current = selected ? clients[selected] : undefined;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !draft.trim() || !current?.online) return;
    send({ type: "send", id: selected, data: draft });
    setDraft("");
    setFollow(true);
  };

  const snippet = `synchronization = {
    port = ${conn?.wsPort ?? 3000},
    base_url = "${conn?.baseUrl ?? "localhost"}",
    refresh_time = ${conn?.refreshTime ?? 10}
};loadstring(game:HttpGet("https://connect.getalchemy.net/open.luau"))()`;

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      {/* header */}
      <header className="flex h-14 shrink-0 items-center gap-4 rounded-2xl bg-panel px-5">
        <Logo src="/alchemy_full.svg" className="aspect-[315/70] h-6" />
        <span className="hidden font-mono text-xs tracking-widest text-dim sm:inline">
          / CONNECT
        </span>
        <nav className="flex rounded-full bg-raised p-1">
          {(
            [
              ["clients", IconUserFilled],
              ["settings", IconSettingsFilled],
              ["license", IconScaleFilled],
            ] as const
          ).map(([v, Icon]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              title={v}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium capitalize outline-none transition-colors ${
                view === v ? "bg-panel text-fg" : "text-muted hover:text-fg"
              }`}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{v}</span>
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden font-mono text-xs text-muted sm:inline">
            <span className="text-accent-ink">{onlineCount}</span> online
          </span>
          <ServerPill status={status} />
        </div>
      </header>

      {view === "license" ? (
        <LicensePanel />
      ) : view === "settings" ? (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          connection={conn}
          onSetConfig={(c) => send({ type: "setConfig", ...c })}
        />
      ) : (
        <div className="flex min-h-0 flex-1 gap-3">
          {/* client list */}
          <aside
            className={`${
              selected ? "hidden md:flex" : "flex"
            } w-full shrink-0 flex-col overflow-hidden rounded-2xl bg-panel md:w-72`}
          >
            <div className="flex gap-2 p-3">
              {games.length > 0 && (
                <GameSelect
                  games={games.map(({ game, n }) => ({ game: game!, n }))}
                  total={Object.keys(clients).length}
                  value={gameFilter}
                  onChange={setGameFilter}
                />
              )}
              <div className="relative min-w-0 flex-1">
                <IconSearchFilled
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-dim"
                />
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search clients"
                  className="h-9 w-full rounded-full bg-raised pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-dim focus:bg-hover"
                />
              </div>
            </div>
            <div className="flex items-center justify-between px-4 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wider text-dim">
              <span>Clients</span>
              <span className="tabular-nums">{list.length}</span>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              {list.length === 0 && (
                <li className="flex flex-col items-center gap-2 px-3 py-10 text-center text-sm text-dim">
                  {filter ? <IconSearchFilled size={22} /> : <IconRadarFilled size={22} />}
                  {filter ? "No match" : "Waiting for clients…"}
                </li>
              )}
              {list.map((c) => {
                const active = c.id === selected;
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => select(c.id)}
                      className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition ${
                        active ? "bg-raised" : "hover:bg-raised/70"
                      } ${c.online ? "" : "opacity-55"}`}
                    >
                      {active && <span className="sel-bar" />}
                      <Avatar client={c} blur={hidden(c.id)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{nameOf(c)}</span>
                        <span className="block truncate text-xs text-dim">
                          {c.profile?.username && (
                            <>
                              <span
                                className={`transition-[filter] duration-300 ${hidden(c.id) ? "blur-[3px]" : ""}`}
                              >
                                @{c.profile.username}
                              </span>
                              {" · "}
                            </>
                          )}
                          {c.profile?.game
                            ? (c.profile.game.name ?? `Game ${c.profile.game.id}`)
                            : c.online
                              ? `connected ${ago(c.connectedAt, now)}`
                              : `left ${ago(c.lastSeen, now)}`}
                        </span>
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[11px] tabular-nums ${
                          active ? "bg-accent/10 text-accent-ink" : "bg-bg text-muted"
                        }`}
                      >
                        {c.count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* main */}
          <main
            className={`${selected ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-panel`}
          >
            {selected && !showConsole ? (
              <div className="relative min-h-0 flex-1">
                <Overview
                  client={current}
                  id={selected}
                  shown={!hidden(selected)}
                  onToggleShown={() => toggleReveal(selected)}
                  sort={settings.itemSort}
                />
                <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-3 p-4 [&>*]:pointer-events-auto">
                  <button
                    onClick={() => select(null)}
                    className="flex items-center gap-1.5 rounded-full bg-raised px-3.5 py-1.5 text-xs font-medium text-muted outline-none transition-colors hover:bg-hover hover:text-fg"
                  >
                    <IconCircleArrowLeftFilled size={14} />
                    Close
                  </button>
                  <div className="ml-auto flex items-center gap-2 text-xs">
                    {dev && (
                      <div className="flex rounded-full bg-raised p-1">
                        {(
                          [
                            ["overview", IconLayoutDashboardFilled],
                            ["console", IconCodeCircle2Filled],
                          ] as const
                        ).map(([v, Icon]) => (
                          <button
                            key={v}
                            onClick={() => setPane(v)}
                            title={v}
                            className={`flex items-center gap-1.5 rounded-full px-3 py-1 capitalize outline-none transition-colors ${
                              pane === v ? "bg-panel text-fg" : "text-muted hover:text-fg"
                            }`}
                          >
                            <Icon size={14} />
                            <span className="hidden lg:inline">{v}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {current && !current.online && (
                      <button
                        onClick={() => {
                          send({ type: "forget", id: selected });
                          select(null);
                        }}
                        className="flex items-center gap-1.5 rounded-full bg-raised px-3.5 py-1.5 text-muted outline-none transition-colors hover:bg-danger/15 hover:text-danger"
                      >
                        <IconTrashFilled size={14} />
                        Remove
                      </button>
                    )}
                    {showConsole && (
                      <button
                        onClick={() => send({ type: "clear", id: selected })}
                        className="flex items-center gap-1.5 rounded-full bg-raised px-3.5 py-1.5 text-muted outline-none transition-colors hover:bg-accent/15 hover:text-accent-ink"
                      >
                        <IconTrashXFilled size={14} />
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : selected ? (
              <>
                <div className="flex h-16 shrink-0 items-center gap-3 px-5">
                  <button
                    onClick={() => select(null)}
                    className="-ml-2 grid size-8 place-items-center rounded-full text-muted outline-none hover:bg-raised hover:text-fg md:hidden"
                    aria-label="Back"
                  >
                    <IconCircleArrowLeftFilled size={18} />
                  </button>
                  <button
                    onClick={() => toggleReveal(selected)}
                    title={hidden(selected) ? "Click to reveal" : "Click to hide"}
                    className="outline-none"
                  >
                    <Avatar client={current} size={40} blur={hidden(selected)} />
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-semibold">
                        {nameOf(current, selected)}
                      </span>
                      {subOf(current) && (
                        <span
                          className={`truncate text-xs text-dim transition-[filter] duration-300 ${hidden(selected) ? "blur-[3px]" : ""}`}
                        >
                          {subOf(current)}
                        </span>
                      )}
                    </div>
                    <CopyButton
                      text={`${wsOrigin}${CLIENT_PATH}/${encodeURIComponent(selected)}`}
                      label={`${CLIENT_PATH}/${selected}`}
                      className="max-w-full truncate font-mono text-[11px] text-dim"
                    />
                  </div>
                  <div className="ml-auto flex items-center gap-2 text-xs">
                    {!current && <span className="text-dim">not connected</span>}
                    {dev && (
                      <div className="flex rounded-full bg-raised p-1">
                        {(
                          [
                            ["overview", IconLayoutDashboardFilled],
                            ["console", IconCodeCircle2Filled],
                          ] as const
                        ).map(([v, Icon]) => (
                          <button
                            key={v}
                            onClick={() => setPane(v)}
                            title={v}
                            className={`flex items-center gap-1.5 rounded-full px-3 py-1 capitalize outline-none transition-colors ${
                              pane === v ? "bg-panel text-fg" : "text-muted hover:text-fg"
                            }`}
                          >
                            <Icon size={14} />
                            <span className="hidden lg:inline">{v}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {current && !current.online && (
                      <button
                        onClick={() => {
                          send({ type: "forget", id: selected });
                          select(null);
                        }}
                        className="flex items-center gap-1.5 rounded-full bg-raised px-3.5 py-1.5 text-muted outline-none transition-colors hover:bg-danger/15 hover:text-danger"
                      >
                        <IconTrashFilled size={14} />
                        Remove
                      </button>
                    )}
                    {showConsole && (
                      <button
                        onClick={() => send({ type: "clear", id: selected })}
                        className="flex items-center gap-1.5 rounded-full bg-raised px-3.5 py-1.5 text-muted outline-none transition-colors hover:bg-accent/15 hover:text-accent-ink"
                      >
                        <IconTrashXFilled size={14} />
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative min-h-0 flex-1">
                  <div
                    ref={logRef}
                    onScroll={onScroll}
                    className="h-full overflow-y-auto px-2 pb-2"
                  >
                    {logs.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-dim">
                        <IconMessageCircleFilled size={28} className="mb-1" />
                        <span className="font-mono text-accent-ink/70">{"// no messages yet"}</span>
                        <span>Anything this client sends with ws:Send() shows up here.</span>
                      </div>
                    ) : (
                      logs.map((e) => <Row key={e.seq} e={e} fresh={e.seq >= freshFrom} />)
                    )}
                  </div>
                  {!follow && (
                    <button
                      onClick={() => setFollow(true)}
                      className="absolute bottom-4 right-5 flex items-center gap-1.5 rounded-full bg-raised px-3.5 py-1.5 text-xs font-medium text-accent-ink outline-none hover:bg-hover"
                    >
                      <IconCircleArrowDownFilled size={14} />
                      Latest
                    </button>
                  )}
                </div>

                <form onSubmit={submit} className="flex shrink-0 gap-2 p-3 pt-1">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    disabled={!current?.online}
                    placeholder={
                      current?.online ? `Send to ${nameOf(current, selected)}` : "Client is offline"
                    }
                    className="min-w-0 flex-1 rounded-full bg-raised px-5 py-3 font-mono text-sm outline-none transition-colors placeholder:text-dim focus:bg-hover disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!current?.online || !draft.trim()}
                    className="flex items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-on-accent outline-none transition hover:brightness-110 disabled:opacity-30"
                  >
                    <IconSendFilled size={17} />
                    Send
                  </button>
                </form>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
                <Logo src="/alchemy.svg" label="" className="size-24" />
                <div className="text-center">
                  <h1 className="text-lg font-semibold">Select a client</h1>
                  <p className="mt-1 text-sm text-muted">
                    {dev
                      ? "Connect from Roblox to "
                      : "Pick a client on the left to see its session"}
                    {dev && (
                      <>
                        {" "}
                        <span className="font-mono text-accent-ink">
                          {CLIENT_PATH}/{"{id}"}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                {dev && (
                  <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-bg">
                    <div className="flex items-center justify-between px-5 pb-1 pt-4 text-xs text-dim">
                      <span className="flex items-center gap-2 font-mono">
                        <IconFileCodeFilled size={14} />
                        loader.luau
                        <span className="rounded-full bg-raised px-2 py-px font-sans text-[10px] uppercase tracking-wider">
                          Luau
                        </span>
                      </span>
                      <CopyButton
                        text={snippet}
                        label="Copy"
                        className="rounded-full bg-raised px-3 py-1"
                      />
                    </div>
                    <div className="pb-4 pt-2">
                      <LuaCode code={snippet} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
