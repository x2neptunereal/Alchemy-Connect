export type Direction = "in" | "out";

export interface LogEntry {
  seq: number;
  dir: Direction;
  data: string;
  ts: number;
}

export interface Profile {
  username?: string;
  displayName?: string;
  userId?: number;
  avatar?: string;
  time?: number;
  game?: GameInfo;
}

export interface GameInfo {
  id: number;
  name?: string;
  icon?: string;
}

export interface Stat {
  label: string;
  value: string | number;
  highlight?: boolean;
}

export interface Item {
  name: string;
  count?: number;
  gained?: number;
  detail?: string;
  icon?: string;
  iconId?: number;
  iconNative?: boolean;
  group?: string;
  extra?: { label: string; value: string | number }[];

  sprite?: { x: number; y: number; w: number; h: number; sheet: number };
}

export interface SessionState {
  stats: Stat[];
  items: Item[];
  started?: number;
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

export type ServerEvent =
  | { type: "snapshot"; clients: ClientInfo[] }
  | { type: "client"; client: ClientInfo }
  | { type: "remove"; id: string }
  | { type: "history"; id: string; entries: LogEntry[] }
  | { type: "log"; id: string; entry: LogEntry }
  | { type: "config"; config: ConnectionConfig };

export interface ConnectionConfig {
  webPort: number;
  wsPort: number;
  baseUrl: string;
  refreshTime: number;
  error?: string;
}

export type UIEvent =
  | { type: "subscribe"; id: string | null }
  | { type: "send"; id: string; data: string }
  | { type: "clear"; id: string }
  | { type: "forget"; id: string }
  | { type: "setPort"; port: number }
  | { type: "setConfig"; port?: number; baseUrl?: string; refreshTime?: number };

export const UI_PATH = "/ui";
export const CLIENT_PATH = "/connect";
