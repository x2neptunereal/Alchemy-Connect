// Tiny Lua/Luau highlighter: no dependencies, colors come from --syn-* theme variables.

type Kind = "kw" | "str" | "num" | "com" | "fn" | "key" | "glob" | "op" | "txt";

const KEYWORDS = new Set(
  "and break do else elseif end false for function if in local nil not or repeat return then true until while continue export type".split(
    " ",
  ),
);
const GLOBALS = new Set(
  "game workspace script loadstring require print warn error pcall task wait typeof tostring tonumber pairs ipairs string table math os Vector2 Vector3 Color3 Instance Enum".split(
    " ",
  ),
);

const TOKEN =
  /(--\[(=*)\[[\s\S]*?\]\2\]|--[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|\[(=*)\[[\s\S]*?\]\4\])|(\b0x[\da-f]+\b|\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)|([A-Za-z_]\w*)|(\.\.\.?|[=~<>]=|[-+*/%^#=<>(){}[\];:,.])|(\s+|.)/gi;

function tokenize(src: string): { kind: Kind; text: string }[] {
  const out: { kind: Kind; text: string }[] = [];
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(src))) {
    const [text, com, , str, , num, word, op] = m;
    let kind: Kind = "txt";
    if (com) kind = "com";
    else if (str) kind = "str";
    else if (num) kind = "num";
    else if (op) kind = "op";
    else if (word) {
      const rest = src.slice(TOKEN.lastIndex);
      if (KEYWORDS.has(word)) kind = "kw";
      else if (/^\s*[({"']/.test(rest))
        kind = "fn"; // call: foo(...) / foo"..."
      else if (/^\s*=(?!=)/.test(rest))
        kind = "key"; // table field / assignment target
      else if (GLOBALS.has(word)) kind = "glob";
      else if (/[:.]\s*$/.test(src.slice(0, m.index))) kind = "fn"; // method/field after : or .
    }
    out.push({ kind, text });
  }
  return out;
}

const COLOR: Record<Kind, string> = {
  kw: "text-[var(--syn-kw)]",
  str: "text-[var(--syn-str)]",
  num: "text-[var(--syn-num)]",
  com: "text-dim italic",
  fn: "text-[var(--syn-fn)]",
  key: "text-[var(--syn-key)]",
  glob: "text-[var(--syn-glob)]",
  op: "text-muted",
  txt: "",
};

export function LuaCode({ code }: { code: string }) {
  const lines = code.split("\n");
  const tokens = tokenize(code);

  // split tokens back into lines so we can number them
  const rows: { kind: Kind; text: string }[][] = [[]];
  for (const t of tokens) {
    const parts = t.text.split("\n");
    parts.forEach((p, i) => {
      if (i > 0) rows.push([]);
      if (p) rows[rows.length - 1].push({ kind: t.kind, text: p });
    });
  }

  return (
    <div className="overflow-x-auto pb-1">
      <table className="w-max border-separate border-spacing-0 font-mono text-[12.5px] leading-6">
        <tbody>
          {rows.slice(0, lines.length).map((row, i) => (
            <tr key={i}>
              <td className="select-none pl-5 pr-4 text-right align-top text-dim/60 tabular-nums">
                {i + 1}
              </td>
              <td className="whitespace-pre pr-6 text-fg/90">
                {row.length
                  ? row.map((t, j) =>
                      t.kind === "txt" ? (
                        t.text
                      ) : (
                        <span key={j} className={COLOR[t.kind]}>
                          {t.text}
                        </span>
                      ),
                    )
                  : " "}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
