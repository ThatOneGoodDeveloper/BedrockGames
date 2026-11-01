# Bedrock Games

A collection of 806 browser games with a built-in web browser, in a single-page site styled after macOS Tahoe's frosted-glass look. No accounts, and no analytics or tracking scripts on this site's own pages.

**Live site:** https://thatonegooddeveloper.github.io/BedrockGames/

## What's in it

- **Games.** 806 games in 10 categories (puzzle, arcade, action, racing, adventure, multiplayer, shooting, simulation, platform, sports). Search, sort (A-Z, Z-A, category, most played), favorites, a "continue playing" row, and a random-game button. Clicking a game opens it fullscreen right away; press `Esc` to leave.
- **Browser.** Opens any website through a proxy (Ultraviolet or Scramjet) using a Wisp server. See [Browser tab setup](#browser-tab-setup).
- **Options.** Theme (light, dark, auto), accent color, reduce transparency, auto fullscreen, a backup file, and the disguise tools below.
- **Disguise tools.** Open the site inside an `about:blank` tab, set a custom tab title and icon (Google, Drive, Docs, Classroom, Canvas, Wikipedia, Khan Academy), and a panic key (default `` ` ``) that jumps to a page you choose.
- **Open in about:blank.** The game player's **Tab** button opens the current game in an `about:blank` tab with your disguise applied.
- **Works on phones.** Bottom tab bar, two-column game grid, and a search drawer.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `/` | Jump to search |
| `1` `2` `3` | Games, Browser, Options |
| `Esc` | Leave the current game |
| `` ` `` (changeable) | Panic key: jump to your panic page |

## Where the games come from

- **26 built-in games** (Snake, Tetris, 2048, Chess, Pac-Man and others) are included as local files in `games/` and run without an internet connection.
- **780 other games** load from their original host (`inkyedu118.github.io`). They need an internet connection, and they stop working if that host is blocked or goes away.

Game names, artwork and content belong to their respective owners. Games that load from another host are served by that host, so their pages may have their own ads or tracking.

## Run it

### On GitHub Pages

The site is one file, `index.html` (HTML, CSS and JavaScript together), plus the `games/`, `assets/` and `proxy/` folders. Enable Pages for the `master` branch and it works as is. The Browser tab also needs a Wisp server, which Pages cannot provide.

### From a downloaded zip

Open `index.html` in a browser. Games, search, favorites and options all work. The Browser tab does not, because browsers do not allow the proxy to run from a local file. To use it, run the local server below.

### With the included server

Needs Node.js 18 or newer.

```sh
npm install
npm start
```

Then open http://localhost:8080. The server serves the site and a Wisp endpoint at `/wisp/`, so the Browser tab works with no extra setup.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `8080` | Port to listen on |
| `HOST` | `127.0.0.1` (`0.0.0.0` when a host sets `PORT`) | Address to listen on |
| `ALLOWED_ORIGINS` | any | Comma-separated site addresses allowed to use the Wisp endpoint. Always set this on a public server. |
| `ALLOW_PRIVATE` | off | Set to `1` to let the proxy reach private and loopback addresses |

## Browser tab setup

The proxy rewrites pages in the browser, and a **Wisp server** relays the network connections. Pick one:

1. **Locally:** `npm start`, as above.
2. **On Render (free plan available):** create a Web Service from this repo (or use the included `render.yaml` as a Blueprint) with build command `npm install` and start command `npm start`. Set `ALLOWED_ORIGINS` to your site address, for example `https://thatonegooddeveloper.github.io`. Then paste `wss://YOUR-SERVICE.onrender.com/wisp/` into the Wisp server box in the Browser tab and press **Test**. Free plans sleep when idle, so the first request after a break can take about a minute.
3. **Any other Node host:** run `npm install` and `npm start`, and set `HOST=0.0.0.0` if the host does not set `PORT`.

When the page is served from `*.github.io` and the Wisp box is empty, it uses the address in the `HOSTED_WISP` constant near the top of the Browser section of `index.html`. Change it there to point at your own server, or type an address into the box to override it.

Heavy sites (video, large web apps) can be slow or fail, especially on a small free server. Some sites block cloud server addresses.

## Your data

Favorites, history, play counts and options are stored in your browser only. **Options > Backup** exports them to a file you can load on another device. The site itself sends nothing to any server. Games that load from another host, and the tab icons you can choose in Options (loaded from Google, Wikipedia and similar), contact those hosts when used. Pages you open in the Browser tab pass through your Wisp server, so only use a server you trust.

## Repository layout

| Path | What it is |
| --- | --- |
| `index.html` | The whole site: markup, styles, scripts and the game list |
| `games/` | One folder per game, each with its own `index.html` |
| `assets/` | Thumbnails, icons, and the shared game styles and scripts |
| `proxy/` | Proxy engine files, service workers and licenses |
| `server.js`, `package.json` | The local and self-hosted server |
| `render.yaml` | Render deployment settings |
| `bedrock.svg` | An SVG that embeds the live site, for opening in its own tab |

## Licenses

The proxy files in `proxy/` are third-party software, mostly AGPL-3.0: Ultraviolet, Scramjet and the libcurl transport, with bare-mux under MIT. See [`proxy/NOTICE.md`](proxy/NOTICE.md) for versions and sources, and `proxy/LICENSE` for the AGPL text. If you host this site for other people, publish its source, including any changes you make to those parts. The server uses wisp-js (LGPL-3.0-or-later).

The Browser tab uses the same proxy stack as [DogeUB](https://github.com/xorynix/dogeub); the integration code here is original.
