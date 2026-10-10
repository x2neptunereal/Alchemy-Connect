"use client";

import { useEffect, useRef, useState } from "react";

/* ---------- color math ---------- */

type HSV = { h: number; s: number; v: number }; // h 0-360, s/v 0-1

function hexToHsv(hex: string): HSV {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

function hsvToHex({ h, s, v }: HSV) {
  const f = (k: number) => {
    const n = (k + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(n, 4 - n, 1))) * 255);
  };
  return `#${[f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

const clamp = (x: number) => Math.min(1, Math.max(0, x));

/** Calls `onMove(x, y)` (0-1 inside `el`) while the pointer is held down. */
function useDrag(onMove: (x: number, y: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    onMove(clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height));
  };
  return {
    ref,
    onPointerDown: (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      move(e);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) move(e);
    },
  };
}

/* ---------- picker ---------- */

export default function ColorPicker({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (hex: string) => void;
  onClose: () => void;
}) {
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [hex, setHex] = useState(value);
  const box = useRef<HTMLDivElement>(null);

  // follow outside changes (presets, hex field) without fighting the drag
  const last = useRef(value);
  useEffect(() => {
    if (value.toLowerCase() !== last.current.toLowerCase()) {
      last.current = value;
      setHsv((cur) => {
        const next = hexToHsv(value);
        // keep hue when the color is grey/black (hue is undefined there)
        return next.s === 0 || next.v === 0 ? { ...next, h: cur.h } : next;
      });
      setHex(value);
    }
  }, [value]);

  const commit = (next: HSV) => {
    setHsv(next);
    const h = hsvToHex(next);
    last.current = h;
    setHex(h);
    onChange(h);
  };

  const sv = useDrag((x, y) => commit({ ...hsv, s: x, v: 1 - y }));
  const hue = useDrag((x) => commit({ ...hsv, h: x * 360 }));

  // close on outside click / Escape
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", down);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("keydown", key);
    };
  }, [onClose]);

  const pure = hsvToHex({ h: hsv.h, s: 1, v: 1 });
  const current = hsvToHex(hsv);

  return (
    <div
      ref={box}
      className="enter absolute right-0 top-11 z-30 w-64 select-none rounded-2xl bg-hover p-3"
    >
      {/* saturation / brightness */}
      <div
        {...sv}
        className="relative h-40 cursor-crosshair touch-none rounded-xl"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), ${pure}`,
        }}
      >
        <span
          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            background: current,
            boxShadow: "0 0 0 2px #fff, 0 0 0 3px rgb(0 0 0 / 0.25)",
          }}
        />
      </div>

      {/* hue */}
      <div
        {...hue}
        className="relative mt-3 h-3 cursor-pointer touch-none rounded-full"
        style={{
          background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
        }}
      >
        <span
          className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: `${(hsv.h / 360) * 100}%`,
            background: pure,
            boxShadow: "0 0 0 2px #fff, 0 0 0 3px rgb(0 0 0 / 0.25)",
          }}
        />
      </div>

      {/* preview + hex */}
      <div className="mt-3 flex items-center gap-2">
        <span className="size-9 shrink-0 rounded-full" style={{ background: current }} />
        <input
          value={hex.toUpperCase()}
          onChange={(e) => {
            const v = (e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`)
              .slice(0, 7)
              .toLowerCase();
            setHex(v);
            if (/^#[0-9a-f]{6}$/.test(v)) {
              last.current = v;
              setHsv(hexToHsv(v));
              onChange(v);
            }
          }}
          spellCheck={false}
          className="min-w-0 flex-1 rounded-full bg-raised px-4 py-2 font-mono text-sm outline-none"
        />
      </div>
    </div>
  );
}
