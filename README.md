# Alchemy Connect

WebSocket bridge between a Roblox executor script and a web dashboard. This repo is the server + dashboard (Next.js).

Docs: [connect.getalchemy.net](https://connect.getalchemy.net)

- [Quick Start](https://connect.getalchemy.net/quick-start)
- [Link Account](https://connect.getalchemy.net/link) · [Stats](https://connect.getalchemy.net/stats) · [Items](https://connect.getalchemy.net/items)
- [Server](https://connect.getalchemy.net/server)

## Install

You need Node.js and npm.

```bash
git clone https://github.com/x2neptunereal/Alchemy-Connect
cd Alchemy-Connect
npm install
```

## Run

```bash
# development
npm run dev

# production
npm run build
npm run start
```

Open http://localhost:3000 for the dashboard.

## Port

Default is `3000`. It has to match `synchronization.port` in your script.

Change it with `PORT`:

```bash
# macOS / Linux
PORT=4000 npm run start

# Windows (PowerShell)
$env:PORT=4000; npm run start
```

You can also open a separate port just for Roblox from the dashboard (Settings → Connection). That's saved in `connect.config.json`. Delete the file to reset.

## Endpoint

| Route | Protocol | |
| --- | --- | --- |
| `/connect/:userId` | `ws://` | One connection per Roblox client. Takes `link` and `stats` messages. |

## Running on another machine

Set `base_url` in your script to the server's IP or domain, and make sure the port is reachable from where Roblox is running.

There's no login, so anyone who can reach the port can see your clients and send them messages. Put something in front of it before opening it to the internet.

## License

MIT. See [LICENSE](LICENSE). © 2023–2026 Alchemy Hub.
