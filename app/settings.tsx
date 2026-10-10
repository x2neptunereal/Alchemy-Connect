"use client";

import { useCallback, useEffect, useState } from "react";
import ColorPicker from "./color-picker";
import {
  IconCircleCheckFilled,
  IconCodeCircle2Filled,
  IconPaletteFilled,
  IconDropletFilled,
  IconMoonFilled,
  IconCircleXFilled,
  IconLayoutDashboardFilled,
  IconWorldFilled,
  IconAlertCircleFilled,
  IconSendFilled,
  IconSunFilled,
} from "@tabler/icons-react";

import type { ConnectionConfig } from "@/lib/connect";
import {
  DEFAULT_SETTINGS,
  HEX,
  SETTINGS_KEY,
  onAccent,
  onAccentShade,
  type Settings,
} from "@/lib/settings";

const PRESETS = [
  "#00ff83",
  "#2dd4bf",
  "#38bdf8",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#ff5a36",
  "#facc15",
];

function apply(s: Settings) {
  const d = document.documentElement;
  d.dataset.theme = s.theme;
  d.style.setProperty("--accent", s.accent);
  d.style.setProperty("--on-accent-auto", onAccentShade(s.accent));
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
      setSettings({
        theme: raw.theme === "light" ? "light" : "dark",
        accent: HEX.test(raw.accent ?? "") ? raw.accent : DEFAULT_SETTINGS.accent,
        developer: raw.developer === true,
        itemSort: raw.itemSort === "amount" || raw.itemSort === "default" ? raw.itemSort : "name",
      });
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    apply(settings);
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({ ...settings, onAccent: onAccentShade(settings.accent) }),
      );
    } catch {}
  }, [settings, loaded]);

  return [settings, setSettings] as const;
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-panel p-6">
      <h2 className="mb-5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-dim">
        <Icon size={14} />
        {title}
      </h2>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted">{hint}</div>
      </div>
      {children}
    </div>
  );
}

export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full outline-none transition-colors ${
        on ? "bg-accent" : "bg-hover"
      }`}
    >
      <span
        className={`absolute left-1 top-1 size-5 rounded-full transition-all duration-200 ${
          on ? "translate-x-5 bg-on-accent" : "bg-muted"
        }`}
      />
    </button>
  );
}

function Check({ color }: { color: string }) {
  return <IconCircleCheckFilled size={18} color={color} />;
}

type ConfigPatch = { port?: number; baseUrl?: string; refreshTime?: number };

const inputCls =
  "rounded-full bg-raised px-4 py-2 font-mono text-sm outline-none transition-colors focus:bg-hover disabled:opacity-50";

function ConnectionFields({
  connection,
  onSetConfig,
}: {
  connection: ConnectionConfig | null;
  onSetConfig: (c: ConfigPatch) => void;
}) {
  const [port, setPort] = useState("");
  const [base, setBase] = useState("");
  const [refresh, setRefresh] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!connection) return;
    setPort(String(connection.wsPort));
    setBase(connection.baseUrl);
    setRefresh(String(connection.refreshTime));
    setPending(false);
  }, [connection]);

  const p = Number(port);
  const r = Number(refresh);
  const valid =
    Number.isInteger(p) && p > 0 && p < 65536 && base.trim() !== "" && r >= 1 && r <= 3600;
  const changed =
    !!connection &&
    (p !== connection.wsPort || base.trim() !== connection.baseUrl || r !== connection.refreshTime);

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid || !changed) return;
        setPending(true);
        onSetConfig({ port: p, baseUrl: base.trim(), refreshTime: r });
      }}
    >
      <Field label="Base URL" hint="Host your Roblox script connects to">
        <input
          value={base}
          onChange={(e) => setBase(e.target.value.slice(0, 253))}
          disabled={!connection}
          spellCheck={false}
          placeholder="localhost"
          className={`w-48 ${inputCls}`}
        />
      </Field>
      <Field label="WebSocket port" hint="Port your Roblox script connects to">
        <input
          value={port}
          onChange={(e) => setPort(e.target.value.replace(/\D/g, "").slice(0, 5))}
          inputMode="numeric"
          disabled={!connection}
          className={`w-24 ${inputCls}`}
        />
      </Field>
      <Field label="Refresh time" hint="Seconds between updates from Roblox">
        <span className="flex items-center gap-2">
          <input
            value={refresh}
            onChange={(e) => setRefresh(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            disabled={!connection}
            className={`w-20 ${inputCls}`}
          />
          <span className="text-sm text-muted">sec</span>
        </span>
      </Field>

      {connection && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div
            className={`flex flex-1 items-start gap-2 rounded-xl px-3 py-2 text-xs ${
              connection.error ? "bg-danger/10 text-danger" : "bg-raised text-muted"
            }`}
          >
            {connection.error ? (
              <>
                <IconAlertCircleFilled size={14} className="mt-px shrink-0" />
                {connection.error}. Pick another port.
              </>
            ) : (
              <span>
                Roblox connects to{" "}
                <span className="font-mono text-accent-ink">
                  ws://{connection.baseUrl}:{connection.wsPort}/connect/{"{id}"}
                </span>
                {connection.wsPort !== connection.webPort && (
                  <> (port {connection.webPort} still works too)</>
                )}
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={!valid || !changed || pending}
            className="self-end rounded-full bg-accent px-5 py-2 text-sm font-semibold text-on-accent outline-none transition hover:brightness-110 disabled:opacity-30 sm:self-auto"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </form>
  );
}

export function SettingsPanel({
  settings,
  onChange,
  connection,
  onSetConfig,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  connection: ConnectionConfig | null;
  onSetConfig: (c: ConfigPatch) => void;
}) {
  const [hex, setHex] = useState(settings.accent);
  useEffect(() => setHex(settings.accent), [settings.accent]);
  const [picking, setPicking] = useState(false);
  const closePicker = useCallback(() => setPicking(false), []);

  const setAccent = (accent: string) => onChange({ ...settings, accent: accent.toLowerCase() });
  const custom = !PRESETS.includes(settings.accent.toLowerCase());

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-3 pb-3">
        <Section title="Appearance" icon={IconPaletteFilled}>
          <Field label="Theme" hint="Light or dark interface">
            <div className="flex rounded-full bg-raised p-1">
              {(
                [
                  ["dark", IconMoonFilled],
                  ["light", IconSunFilled],
                ] as const
              ).map(([t, Icon]) => (
                <button
                  key={t}
                  onClick={() => onChange({ ...settings, theme: t })}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium capitalize outline-none transition-colors ${
                    settings.theme === t ? "bg-accent text-on-accent" : "text-muted hover:text-fg"
                  }`}
                >
                  <Icon size={16} />
                  {t}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Accent color" hint="Used for status, highlights and buttons">
            <div className="flex flex-wrap items-center gap-2">
              {PRESETS.map((c) => {
                const on = settings.accent.toLowerCase() === c;
                return (
                  <button
                    key={c}
                    onClick={() => setAccent(c)}
                    aria-label={c}
                    className="grid size-8 place-items-center rounded-full outline-none transition-transform hover:scale-110"
                    style={{ background: c }}
                  >
                    {on && <Check color={onAccent(c)} />}
                  </button>
                );
              })}
              <div className="relative">
                <button
                  onClick={() => setPicking((v) => !v)}
                  className="grid size-8 cursor-pointer place-items-center rounded-full outline-none transition-transform hover:scale-110"
                  style={{
                    background: custom
                      ? settings.accent
                      : "conic-gradient(#ff5a36,#facc15,#00ff83,#38bdf8,#a855f7,#ec4899,#ff5a36)",
                  }}
                  title="Custom color"
                >
                  {custom ? (
                    <Check color={onAccent(settings.accent)} />
                  ) : (
                    <IconDropletFilled size={15} color="#ffffff" />
                  )}
                </button>
                {picking && (
                  <ColorPicker value={settings.accent} onChange={setAccent} onClose={closePicker} />
                )}
              </div>
            </div>
          </Field>

          <Field label="Hex" hint="Type any color">
            <input
              value={hex}
              onChange={(e) => {
                const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
                setHex(v);
                if (HEX.test(v)) setAccent(v);
              }}
              spellCheck={false}
              maxLength={7}
              className="w-32 rounded-full bg-raised px-4 py-2 font-mono text-sm uppercase outline-none transition-colors focus:bg-hover"
            />
          </Field>
        </Section>

        <Section title="Connection" icon={IconWorldFilled}>
          <ConnectionFields connection={connection} onSetConfig={onSetConfig} />
        </Section>

        <Section title="Display" icon={IconLayoutDashboardFilled}>
          <Field label="Sort items" hint="Order of items inside each section">
            <div className="flex rounded-full bg-raised p-1">
              {(
                [
                  ["default", "As sent"],
                  ["amount", "Amount"],
                  ["name", "A–Z"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => onChange({ ...settings, itemSort: v })}
                  title={
                    v === "amount"
                      ? "Highest count / mastery first"
                      : v === "name"
                        ? "By name, A to Z"
                        : "In the order Roblox sends them"
                  }
                  className={`rounded-full px-4 py-1.5 text-sm font-medium outline-none transition-colors ${
                    settings.itemSort === v
                      ? "bg-accent text-on-accent"
                      : "text-muted hover:text-fg"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
        </Section>

        <Section title="Developer" icon={IconCodeCircle2Filled}>
          <Field
            label="Developer mode"
            hint="Show the raw message console, send box and Lua snippet for each client"
          >
            <Switch
              on={settings.developer}
              onChange={(developer) => onChange({ ...settings, developer })}
            />
          </Field>
        </Section>

        <Section title="Preview" icon={IconPaletteFilled}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2 rounded-full bg-raised px-3 py-1.5 text-xs font-medium text-accent-ink">
              <span className="size-1.5 rounded-full bg-accent" />
              Live
            </span>
            <span className="rounded-full bg-accent/10 px-2 font-mono text-[10px] font-semibold uppercase leading-5 tracking-wider text-accent-ink">
              in
            </span>
            <span className="font-mono text-sm text-accent-ink">/connect/{"{id}"}</span>
            <span className="flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-on-accent">
              <IconSendFilled size={17} />
              Send
            </span>
          </div>
        </Section>

        <div className="flex justify-end">
          <button
            onClick={() => onChange(DEFAULT_SETTINGS)}
            className="flex items-center gap-1.5 rounded-full bg-panel px-4 py-2 text-sm text-muted outline-none transition-colors hover:bg-raised hover:text-fg"
          >
            <IconCircleXFilled size={15} />
            Reset to default
          </button>
        </div>
      </div>
    </div>
  );
}
