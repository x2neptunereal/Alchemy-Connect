# Alchemy Connect

**English** · [ภาษาไทย](README.th.md)

Server and dashboard for Alchemy Connect. Roblox clients connect here over WebSocket and show up live on the page.

Client (Lua) docs are at [connect.getalchemy.net](https://connect.getalchemy.net).

## What you need

- Node.js 20 or newer
- npm

## Dev

```bash
npm install
npm run dev
```

Open http://localhost:3000. It reloads when you change files.

## Build and run

```bash
npm install
npm run build
npm start
```

Same address, http://localhost:3000.

## Port

Default is 3000. Change it with `PORT`:

```bash
# macOS / Linux
PORT=4000 npm start

# Windows (PowerShell)
$env:PORT=4000; npm start
```

The port Roblox connects to, the base URL and the refresh time are set from the page (Settings → Connection). They're saved to `connect.config.json` next to `server.ts`. Delete that file to go back to defaults.

## Heads up

There's no login. Anyone who can reach the port can see your clients and send them messages. Fine on your own machine; if you open it to the internet, put something in front of it first.

## License

MIT. See [LICENSE](LICENSE). © 2023–2026 Alchemy Hub.
