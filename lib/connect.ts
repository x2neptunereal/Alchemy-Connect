// Shared types between server.ts and the web UI.

export type Direction = "in" | "out"; // in = Roblox -> server, out = web -> Roblox

export interface LogEntry {
  seq: number;
  dir: Direction;
  data: string;
  ts: number;
}

/** Filled from the first JSON message a client sends with username / userid / displayname. */
export interface Profile {
  username?: string;
  displayName?: string;
  userId?: number;
  avatar?: string; // Roblox headshot URL
  time?: number; // ms timestamp from `time = os.time()`; the session timer counts from here
  game?: GameInfo; // from `games = game.GameId`
}

/** Roblox experience (universe) the client is playing. */
export interface GameInfo {
  id: number; // universe id = game.GameId
  name?: string;
  icon?: string;
}

/** One big number on the overview ("Level 225"). */
export interface Stat {
  label: string;
  value: string | number;
  highlight?: boolean; // shown in the accent color
}

/** One row in the overview item grid ("Ore  +2 · 70 in inventory"). */
export interface Item {
  name: string;
  count?: number;
  gained?: number;
  detail?: string; // overrides the "+2 · 70 in inventory" line
  icon?: string; // resolved image URL
  iconId?: number; // Roblox asset id (resolved to `icon` by the server)
  iconNative?: boolean; // icon is the full-resolution sheet (not a scaled thumbnail)
  group?: string; // section it belongs to, e.g. "swords" (from items = { swords = {...} })
  extra?: { label: string; value: string | number }[]; // any other fields, e.g. mastery = 600
  /** Crop of a sprite sheet: imageOffset = {x, y}, imageSize = {w, h}, sheetSize = px of the full sheet */
  sprite?: { x: number; y: number; w: number; h: number; sheet: number };
}

/** Latest `{ type: "stats" }` message a client sent. */
export interface SessionState {
  stats: Stat[];
  items: Item[];
  started?: number; // ms timestamp the session timer counts from
  updatedAt: number;
}

export interface ClientInfo {
  id: string;
  online: boolean;
  connectedAt: number;
  lastSeen: number;
  address: string | null;
  count: number;
  profile: Profile | null;
  state: SessionState | null;
}

/** server -> web UI */
export type ServerEvent =
  | { type: "snapshot"; clients: ClientInfo[] }
  | { type: "client"; client: ClientInfo }
  | { type: "remove"; id: string }
  | { type: "history"; id: string; entries: LogEntry[] }
  | { type: "log"; id: string; entry: LogEntry }
  | { type: "config"; config: ConnectionConfig };

/** Where Roblox clients can connect. */
export interface ConnectionConfig {
  webPort: number; // dashboard port (Roblox can always connect here too)
  wsPort: number; // extra port just for Roblox (same as webPort = no extra port)
  baseUrl: string; // host the Roblox loader connects to (default "localhost")
  refreshTime: number; // seconds between updates the loader sends (default 10)
  error?: string; // last error opening wsPort, e.g. port already in use
}

/** web UI -> server */
export type UIEvent =
  | { type: "subscribe"; id: string | null }
  | { type: "send"; id: string; data: string }
  | { type: "clear"; id: string }
  | { type: "forget"; id: string }
  | { type: "setPort"; port: number }
  | { type: "setConfig"; port?: number; baseUrl?: string; refreshTime?: number };

export const UI_PATH = "/ui";
export const CLIENT_PATH = "/connect";
