// server.ts — Next.js + WebSocket hub
//   Roblox  -> ws://host:3000/connect/{id}
//   Web UI  -> ws://host:3000/ui
import { createServer, type IncomingMessage, type Server } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import type { Duplex } from "node:stream";
import { randomBytes } from "node:crypto";
import next from "next";
import { WebSocketServer, WebSocket, type RawData } from "ws";
import {
  CLIENT_PATH,
  UI_PATH,
  type ClientInfo,
  type ConnectionConfig,
  type LogEntry,
  type GameInfo,
  type Item,
  type Profile,
  type SessionState,
  type Stat,
  type ServerEvent,
  type UIEvent,
} from "./lib/connect";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);

// ---- connection config (saved next to server.ts) --------------------------
const CONFIG_FILE = "connect.config.json";
const config: ConnectionConfig = {
  webPort: port,
  wsPort: port,
  baseUrl: "localhost",
  refreshTime: 10,
};

/** "https://example.com/" -> "example.com"; only host-ish characters. */
const cleanBaseUrl = (v: unknown) =>
  typeof v === "string"
    ? v
        .trim()
        .replace(/^[a-z]+:\/\//i, "")
        .replace(/\/+$/, "")
        .replace(/[^\w.\-:[\]]/g, "")
        .slice(0, 253)
    : "";
const cleanRefresh = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 && n <= 3600 ? Math.round(n) : undefined;
};

try {
  const saved = JSON.parse(readFileSync(CONFIG_FILE, "utf8")) as Partial<ConnectionConfig>;
  if (Number.isInteger(saved.wsPort)) config.wsPort = saved.wsPort!;
  if (cleanBaseUrl(saved.baseUrl)) config.baseUrl = cleanBaseUrl(saved.baseUrl);
  config.refreshTime = cleanRefresh(saved.refreshTime) ?? config.refreshTime;
} catch {}
const saveConfig = () => {
  try {
    const { wsPort, baseUrl, refreshTime } = config;
    writeFileSync(CONFIG_FILE, JSON.stringify({ wsPort, baseUrl, refreshTime }, null, 2) + "\n");
  } catch {}
};

const MAX_LOG = 1000; // messages kept per client
const OFFLINE_TTL = 30 * 60_000; // forget offline clients after 30 min

interface Client {
  info: ClientInfo;
  socket: WebSocket | null;
  log: LogEntry[];
  seq: number;
  /** first `count` seen per item this session -> used to work out `gained` */
  baseline: Map<string, number>;
}

const clients = new Map<string, Client>();
const uis = new Map<WebSocket, { subscribed: string | null }>();

const toText = (d: RawData): string =>
  Array.isArray(d) ? Buffer.concat(d).toString("utf8") : Buffer.from(d as Buffer).toString("utf8");

function emit(ws: WebSocket, ev: ServerEvent) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(ev));
}
function emitAll(ev: ServerEvent, only?: (sub: string | null) => boolean) {
  const raw = JSON.stringify(ev);
  for (const [ws, s] of uis) {
    if (ws.readyState === WebSocket.OPEN && (!only || only(s.subscribed))) ws.send(raw);
  }
}

function push(id: string, c: Client, dir: LogEntry["dir"], data: string) {
  const entry: LogEntry = { seq: ++c.seq, dir, data, ts: Date.now() };
  c.log.push(entry);
  if (c.log.length > MAX_LOG) c.log.splice(0, c.log.length - MAX_LOG);
  c.info.count++;
  c.info.lastSeen = entry.ts;
  emitAll({ type: "log", id, entry }, (sub) => sub === id);
  emitAll({ type: "client", client: c.info });
}

function parseId(raw: string): string {
  let id = "";
  try {
    id = decodeURIComponent(raw);
  } catch {
    id = raw;
  }
  id = id.trim().slice(0, 64);
  return id || `anon-${randomBytes(3).toString("hex")}`;
}

// ---- profiles -----------------------------------------------------------
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 64) : undefined);

/**
 * Roblox messages look like { types = "<kind>", data = { ... } }.
 * Fields inside `data` are merged over top-level ones, so flat messages work too.
 */
function envelope(text: string): { kind?: string; body: Record<string, unknown> } | null {
  const t = text.trim();
  if (!t.startsWith("{")) return null;
  try {
    const j = JSON.parse(t) as Record<string, unknown>;
    if (!j || typeof j !== "object" || Array.isArray(j)) return null;
    const data = j.data && typeof j.data === "object" && !Array.isArray(j.data) ? j.data : {};
    return { kind: str(j.types ?? j.type)?.toLowerCase(), body: { ...j, ...data } };
  } catch {
    return null;
  }
}

/** { types = "link", data = { username, userid, displayname, time } } */
function readProfile(text: string): Profile | null {
  const env = envelope(text);
  if (!env || (env.kind && env.kind !== "link")) return null;
  try {
    const j = env.body;
    const username = str(j.username ?? j.name);
    const displayName = str(j.displayname ?? j.displayName);
    const userId = Number(j.userid ?? j.userId) || undefined;
    if (!username && !displayName && !userId) return null;
    const sent = Number(j.time);
    // os.time() is in seconds
    const time = Number.isFinite(sent) && sent > 0 ? (sent < 1e12 ? sent * 1000 : sent) : undefined;
    const gameId = Number(j.games ?? j.game ?? j.gameId ?? j.universeId) || undefined;
    return { username, displayName, userId, time, game: gameId ? { id: gameId } : undefined };
  } catch {
    return null;
  }
}

const avatarCache = new Map<number, string>();

async function fetchAvatar(userId: number): Promise<string | undefined> {
  if (avatarCache.has(userId)) return avatarCache.get(userId);
  try {
    const r = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`,
    );
    const j = (await r.json()) as { data?: { imageUrl?: string }[] };
    const url = j.data?.[0]?.imageUrl;
    if (url) avatarCache.set(userId, url);
    return url;
  } catch {
    return undefined;
  }
}

// game.GameId -> name + icon
const gameCache = new Map<number, Promise<GameInfo>>();

function fetchGame(id: number): Promise<GameInfo> {
  if (!gameCache.has(id)) {
    gameCache.set(
      id,
      (async () => {
        const info: GameInfo = { id };
        try {
          const r = await fetch(`https://games.roblox.com/v1/games?universeIds=${id}`);
          const j = (await r.json()) as { data?: { name?: string }[] };
          info.name = j.data?.[0]?.name;
        } catch {}
        try {
          const r = await fetch(
            `https://thumbnails.roblox.com/v1/games/icons?universeIds=${id}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`,
          );
          const j = (await r.json()) as { data?: { imageUrl?: string }[] };
          info.icon = j.data?.[0]?.imageUrl;
        } catch {}
        if (!info.name && !info.icon) gameCache.delete(id); // retry next time
        return info;
      })(),
    );
  }
  return gameCache.get(id)!;
}

function setProfile(c: Client, p: Profile) {
  const prev = c.info.profile ?? {};
  const next: Profile = {
    ...prev,
    ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)),
  };
  // same game as before: keep the name/icon we already looked up
  if (p.game && prev.game?.id === p.game.id) next.game = prev.game;
  c.info.profile = next;
  emitAll({ type: "client", client: c.info });
  if (next.game && !next.game.name) {
    const gid = next.game.id;
    fetchGame(gid).then((game) => {
      if (c.info.profile?.game?.id === gid) {
        c.info.profile = { ...c.info.profile, game };
        emitAll({ type: "client", client: c.info });
      }
    });
  }
  if (next.userId && !next.avatar) {
    const uid = next.userId;
    fetchAvatar(uid).then((avatar) => {
      if (avatar && c.info.profile?.userId === uid) {
        c.info.profile = { ...c.info.profile, avatar };
        emitAll({ type: "client", client: c.info });
      }
    });
  }
}

// ---- session stats ------------------------------------------------------
// Roblox sends: { type = "stats", stats = {...}, items = {...}, started = os.time() }
const num = (v: unknown) => {
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
  return Number.isFinite(n) && v !== "" && v !== null && v !== undefined ? n : undefined;
};

function assetId(v: unknown): number | undefined {
  if (typeof v === "number" && v > 0) return Math.floor(v);
  if (typeof v === "string") {
    const m = v.match(/^(?:rbxassetid:\/\/|rbxthumb:\/\/.*id=)?(\d+)/i);
    if (m) return Number(m[1]);
  }
  return undefined;
}

const KNOWN_ITEM_KEYS = new Set(
  "name count amount gained gain delta detail icon image imageOffset imageSize sheetSize offset size".split(
    " ",
  ),
);

/** {x, y} | {X, Y} | [x, y] -> [x, y] */
function pair(v: unknown): [number, number] | undefined {
  // "150, 150" (e.g. tostring(Vector2))
  if (typeof v === "string") {
    const m = v.match(/(-?[\d.]+)\s*[, x]\s*(-?[\d.]+)/);
    return m ? [Number(m[1]), Number(m[2])] : undefined;
  }
  if (Array.isArray(v)) {
    const [a, b] = [num(v[0]), num(v[1])];
    return a !== undefined && b !== undefined ? [a, b] : undefined;
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const [a, b] = [num(o.x ?? o.X), num(o.y ?? o.Y)];
    return a !== undefined && b !== undefined ? [a, b] : undefined;
  }
  return undefined;
}

/** "masteryLevel" / "mastery_level" -> "Mastery level" */
const prettyKey = (k: string) => {
  const s = k
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Sprite defaults: set once on the message or a section instead of on every item. */
type SpriteDefaults = { imageSize?: unknown; sheetSize?: unknown };

const sheetPx = (v: unknown) => num(Array.isArray(v) ? v[0] : v);

function parseItems(list: unknown[], group?: string, defaults: SpriteDefaults = {}): Item[] {
  return list
    .filter((i): i is Record<string, unknown> => !!i && typeof i === "object" && !Array.isArray(i))
    .map((i) => {
      const raw = i.icon ?? i.image;
      const url = typeof raw === "string" && /^https?:\/\//.test(raw) ? raw : undefined;

      const offset = pair(i.imageOffset ?? i.offset);
      const size = pair(i.imageSize ?? i.size) ?? pair(defaults.imageSize) ?? [150, 150];
      const sheet = sheetPx(i.sheetSize) ?? sheetPx(defaults.sheetSize) ?? 1024;
      const sprite = offset
        ? { x: offset[0], y: offset[1], w: size[0], h: size[1], sheet }
        : undefined;

      const extra = Object.entries(i)
        .filter(
          ([k, v]) => !KNOWN_ITEM_KEYS.has(k) && (typeof v === "number" || typeof v === "string"),
        )
        .slice(0, 4)
        .map(([k, v]) => ({ label: prettyKey(k), value: v as string | number }));

      return {
        name: str(i.name) ?? "Item",
        count: num(i.count ?? i.amount),
        gained: num(i.gained ?? i.gain ?? i.delta),
        detail: str(i.detail),
        icon: url,
        iconId: url ? undefined : assetId(raw),
        group,
        extra: extra.length ? extra : undefined,
        sprite,
      } satisfies Item;
    });
}

type StatePatch = Partial<Pick<SessionState, "stats" | "items" | "started">>;

/** { types = "stats", stats = {...}, items = {...} }  (or inside `data`) */
function readState(text: string): StatePatch | null {
  const env = envelope(text);
  if (!env) return null;
  const j = env.body;
  if (env.kind ? env.kind !== "stats" : !("stats" in j) && !("items" in j)) return null;
  const patch: StatePatch = {};

  if (Array.isArray(j.stats)) {
    patch.stats = (j.stats as Record<string, unknown>[])
      .filter((s) => s && typeof s === "object")
      .map((s) => ({
        label: str(s.label ?? s.name) ?? "",
        value: typeof s.value === "number" || typeof s.value === "string" ? s.value : "",
        highlight: s.highlight === true,
      }))
      .slice(0, 12) as Stat[];
  } else if (j.stats && typeof j.stats === "object") {
    patch.stats = Object.entries(j.stats as Record<string, unknown>)
      .slice(0, 12)
      .map(([label, value]) => ({
        label,
        value: typeof value === "number" || typeof value === "string" ? value : String(value),
      }));
  }

  // items = { ... }                      -> one "Items" section
  // items = { swords = {...}, fruits = {...} } -> one section per key
  // items = { { name = "Swords", types = "weapon", data = {...} }, ... } -> sections in this order
  const isSection = (x: unknown) =>
    !!x && typeof x === "object" && Array.isArray((x as Record<string, unknown>).data);
  if (Array.isArray(j.items) && j.items.length && j.items.every(isSection)) {
    patch.items = (j.items as Record<string, unknown>[]).flatMap((sec, i) =>
      parseItems(sec.data as unknown[], str(sec.name) ?? `Section ${i + 1}`, {
        imageSize: sec.imageSize ?? j.imageSize,
        sheetSize: sec.sheetSize ?? j.sheetSize,
      }),
    );
  } else if (Array.isArray(j.items)) {
    patch.items = parseItems(j.items, undefined, j);
  } else if (j.items && typeof j.items === "object") {
    patch.items = Object.entries(j.items as Record<string, unknown>)
      .filter(([, list]) => Array.isArray(list))
      .flatMap(([group, list]) => parseItems(list as unknown[], group, j));
  }
  if (patch.items) patch.items = patch.items.slice(0, 200);

  const started = num(j.started ?? j.start);
  if (started) patch.started = started < 1e12 ? started * 1000 : started; // accept os.time() seconds

  return Object.keys(patch).length ? patch : null;
}

const iconCache = new Map<number, string>();

async function fetchIcons(ids: number[]) {
  const missing = [...new Set(ids)].filter((id) => !iconCache.has(id));
  for (let i = 0; i < missing.length; i += 50) {
    const batch = missing.slice(i, i + 50);
    try {
      const r = await fetch(
        `https://thumbnails.roblox.com/v1/assets?assetIds=${batch.join(",")}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`,
      );
      const j = (await r.json()) as { data?: { targetId: number; imageUrl?: string }[] };
      for (const d of j.data ?? []) if (d.imageUrl) iconCache.set(d.targetId, d.imageUrl);
    } catch {}
  }
}

// Sprite sheets need the whole image, not a 150px thumbnail.
// Try the full-resolution file first; fall back to the largest square thumbnail.
const sheetCache = new Map<number, { url: string; native: boolean } | null>();
const sheetBytes = new Map<number, { type: string; body: Buffer }>();

const sheetPending = new Map<number, Promise<void>>();

function resolveSheet(id: number) {
  if (!sheetPending.has(id)) sheetPending.set(id, loadSheet(id));
  return sheetPending.get(id)!;
}

async function loadSheet(id: number) {
  sheetCache.set(id, null);
  try {
    const r = await fetch(`https://assetdelivery.roblox.com/v1/asset/?id=${id}`, {
      redirect: "manual",
    });
    const loc = r.headers.get("location");
    if (r.status >= 300 && r.status < 400 && loc) {
      sheetCache.set(id, { url: loc, native: true });
      return;
    }
    const type = r.headers.get("content-type") ?? "";
    if (r.ok && type.startsWith("image/")) {
      sheetBytes.set(id, { type, body: Buffer.from(await r.arrayBuffer()) });
      sheetCache.set(id, { url: `/rbx-asset/${id}`, native: true });
      return;
    }
  } catch {}
  for (const size of ["700x700", "512x512", "420x420"]) {
    try {
      const r = await fetch(
        `https://thumbnails.roblox.com/v1/assets?assetIds=${id}&returnPolicy=PlaceHolder&size=${size}&format=Png&isCircular=false`,
      );
      if (!r.ok) continue;
      const j = (await r.json()) as { data?: { imageUrl?: string }[] };
      const url = j.data?.[0]?.imageUrl;
      if (url) {
        sheetCache.set(id, { url, native: false });
        return;
      }
    } catch {}
  }
}

const withIcons = (items: Item[]) =>
  items.map((it) => {
    if (it.icon || !it.iconId) return it;
    if (it.sprite) {
      const sheet = sheetCache.get(it.iconId);
      return sheet ? { ...it, icon: sheet.url, iconNative: sheet.native } : it;
    }
    return { ...it, icon: iconCache.get(it.iconId) };
  });

/** Items without `gained`: gained = count now - first count seen this session. */
function fillGained(c: Client, items: Item[]) {
  return items.map((it) => {
    if (it.count === undefined || it.gained !== undefined) return it;
    const key = `${it.group ?? ""}\u0000${it.name}`;
    if (!c.baseline.has(key)) c.baseline.set(key, it.count);
    return { ...it, gained: it.count - c.baseline.get(key)! };
  });
}

function setState(c: Client, patch: StatePatch) {
  const prev = c.info.state;
  if (patch.items) patch.items = fillGained(c, patch.items);
  c.info.state = {
    stats: patch.stats ?? prev?.stats ?? [],
    items: withIcons(patch.items ?? prev?.items ?? []),
    started: patch.started ?? prev?.started,
    updatedAt: Date.now(),
  };
  emitAll({ type: "client", client: c.info });

  const missing = c.info.state.items.filter((it) => !it.icon && it.iconId);
  const need = missing.filter((it) => !it.sprite).map((it) => it.iconId!);
  const sheets = [...new Set(missing.filter((it) => it.sprite).map((it) => it.iconId!))];
  if (need.length || sheets.length) {
    Promise.all([fetchIcons(need), ...sheets.map(resolveSheet)]).then(() => {
      if (!c.info.state) return;
      c.info.state = { ...c.info.state, items: withIcons(c.info.state.items) };
      emitAll({ type: "client", client: c.info });
    });
  }
}

// ---- Roblox side --------------------------------------------------------
function onRoblox(ws: WebSocket, req: IncomingMessage, id: string) {
  const now = Date.now();
  let c = clients.get(id);
  if (c?.socket && c.socket !== ws) c.socket.close(4000, "replaced by new connection");
  if (!c) {
    c = {
      info: {
        id,
        online: true,
        connectedAt: now,
        lastSeen: now,
        address: null,
        count: 0,
        profile: null,
        state: null,
      },
      socket: null,
      log: [],
      seq: 0,
      baseline: new Map(),
    };
    clients.set(id, c);
  }
  c.socket = ws;
  c.baseline = new Map(); // new connection = new session: gains start from 0 again
  c.info.online = true;
  c.info.connectedAt = now;
  c.info.lastSeen = now;
  c.info.address = req.socket.remoteAddress ?? null;
  emitAll({ type: "client", client: c.info });
  console.log(`[+] ${id}`);

  const client = c;
  ws.on("message", (data) => {
    const text = toText(data);
    const p = readProfile(text);
    if (p) setProfile(client, p);
    const st = readState(text);
    if (st) setState(client, st);
    push(id, client, "in", text);
  });
  // ids that are plain numbers are treated as a UserId until a profile message arrives
  if (!client.info.profile && /^\d+$/.test(id)) setProfile(client, { userId: Number(id) });
  ws.on("close", () => {
    if (client.socket !== ws) return; // replaced
    client.socket = null;
    client.info.online = false;
    client.info.lastSeen = Date.now();
    emitAll({ type: "client", client: client.info });
    console.log(`[-] ${id}`);
  });
  ws.on("error", () => {});
}

// ---- Web UI side --------------------------------------------------------
function onUI(ws: WebSocket) {
  uis.set(ws, { subscribed: null });
  emit(ws, { type: "snapshot", clients: [...clients.values()].map((c) => c.info) });
  emit(ws, { type: "config", config });

  ws.on("message", (raw) => {
    let ev: UIEvent;
    try {
      ev = JSON.parse(toText(raw));
    } catch {
      return;
    }
    const state = uis.get(ws);
    if (!state) return;

    switch (ev.type) {
      case "subscribe": {
        state.subscribed = ev.id;
        const c = ev.id ? clients.get(ev.id) : undefined;
        if (ev.id) emit(ws, { type: "history", id: ev.id, entries: c?.log ?? [] });
        break;
      }
      case "send": {
        const c = clients.get(ev.id);
        if (c?.socket?.readyState === WebSocket.OPEN && typeof ev.data === "string") {
          c.socket.send(ev.data);
          push(ev.id, c, "out", ev.data);
        }
        break;
      }
      case "clear": {
        const c = clients.get(ev.id);
        if (c) {
          c.log = [];
          c.info.count = 0;
          emitAll({ type: "history", id: ev.id, entries: [] }, (sub) => sub === ev.id);
          emitAll({ type: "client", client: c.info });
        }
        break;
      }
      case "forget": {
        const c = clients.get(ev.id);
        if (c && !c.socket) {
          clients.delete(ev.id);
          emitAll({ type: "remove", id: ev.id });
        }
        break;
      }
      case "setPort": {
        const p = Number(ev.port);
        if (Number.isInteger(p) && p > 0 && p < 65536) void listenRoblox(p);
        break;
      }
      case "setConfig": {
        const base = cleanBaseUrl(ev.baseUrl);
        if (base) config.baseUrl = base;
        config.refreshTime = cleanRefresh(ev.refreshTime) ?? config.refreshTime;
        const p = Number(ev.port);
        if (Number.isInteger(p) && p > 0 && p < 65536 && p !== config.wsPort) {
          void listenRoblox(p); // saves + broadcasts
        } else {
          saveConfig();
          emitAll({ type: "config", config });
        }
        break;
      }
    }
  });
  ws.on("close", () => uis.delete(ws));
  ws.on("error", () => {});
}

// prune long-offline clients
setInterval(() => {
  const cutoff = Date.now() - OFFLINE_TTL;
  for (const [id, c] of clients) {
    if (!c.socket && c.info.lastSeen < cutoff) {
      clients.delete(id);
      emitAll({ type: "remove", id });
    }
  }
}, 60_000).unref();

// ---- extra Roblox-only port ----------------------------------------------
let robloxServer: Server | null = null;
let robloxWss: WebSocketServer | null = null;

function closeRobloxServer() {
  robloxWss?.clients.forEach((ws) => ws.close(1001, "port changed"));
  robloxWss?.close();
  robloxServer?.close();
  robloxServer = null;
  robloxWss = null;
}

/** Open `p` for Roblox clients (ws://host:p/connect/{id}). p === webPort -> only the main port. */
async function listenRoblox(p: number) {
  closeRobloxServer();
  config.error = undefined;
  if (p !== config.webPort) {
    const srv = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(`Alchemy Connect: Roblox clients connect to ws://<host>:${p}${CLIENT_PATH}/{id}\n`);
    });
    const wss = new WebSocketServer({ noServer: true });
    srv.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      const pathname = new URL(req.url ?? "/", "http://x").pathname;
      if (pathname === CLIENT_PATH || pathname.startsWith(CLIENT_PATH + "/")) {
        const id = parseId(pathname.slice(CLIENT_PATH.length + 1));
        wss.handleUpgrade(req, socket, head, (ws) => onRoblox(ws, req, id));
      } else {
        socket.destroy();
      }
    });
    const ok = await new Promise<boolean>((resolve) => {
      srv.once("error", (err: NodeJS.ErrnoException) => {
        config.error =
          err.code === "EADDRINUSE" ? `Port ${p} is already in use` : `Could not open port ${p}`;
        resolve(false);
      });
      srv.listen(p, () => resolve(true));
    });
    if (ok) {
      robloxServer = srv;
      robloxWss = wss;
      console.log(`> Roblox: ws://localhost:${p}${CLIENT_PATH}/{id}`);
    } else {
      console.log(`> ${config.error}`);
    }
  }
  config.wsPort = p;
  saveConfig();
  emitAll({ type: "config", config });
}

// ---- boot ---------------------------------------------------------------
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    // full-resolution sprite sheets fetched from Roblox (see resolveSheet)
    const m = req.url?.match(/^\/rbx-asset\/(\d+)/);
    const sheet = m && sheetBytes.get(Number(m[1]));
    if (sheet) {
      res.writeHead(200, { "content-type": sheet.type, "cache-control": "public, max-age=86400" });
      res.end(sheet.body);
      return;
    }
    handle(req, res);
  });
  const wss = new WebSocketServer({ noServer: true });
  const nextUpgrade = app.getUpgradeHandler();

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const pathname = new URL(req.url ?? "/", "http://x").pathname;

    if (pathname === UI_PATH) {
      wss.handleUpgrade(req, socket, head, (ws) => onUI(ws));
    } else if (pathname === CLIENT_PATH || pathname.startsWith(CLIENT_PATH + "/")) {
      const id = parseId(pathname.slice(CLIENT_PATH.length + 1));
      wss.handleUpgrade(req, socket, head, (ws) => onRoblox(ws, req, id));
    } else {
      nextUpgrade(req, socket, head); // Next.js HMR etc.
    }
  });

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
    console.log(`> Roblox: ws://localhost:${port}${CLIENT_PATH}/{id}`);
    if (config.wsPort !== port) void listenRoblox(config.wsPort);
  });
});
