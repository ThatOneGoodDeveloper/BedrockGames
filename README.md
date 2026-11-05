# Bedrock Games

A collection of 806 browser games, presented as a desktop in your browser in the style of macOS Tahoe: a wallpaper with a big centered clock, a menu bar, a dock, and draggable frosted-glass windows. All artwork and icons are original. No accounts, and no analytics or tracking scripts on this site's own pages.

**Live site:** https://thatonegooddeveloper.github.io/BedrockGames/

## What's in it

- **Desktop.** Windows you can drag, resize, zoom (green), minimize to the dock (yellow) and close (red). A dock to open apps, and a menu bar with File, View, Window and Help menus. Window positions are remembered.
- **Games window.** A Finder-style sidebar with Library (All Games, Favorites, Recently Played) and 10 categories, a search field, and sorting (A-Z, Z-A, category, most played). Clicking a game opens it fullscreen right away; press `Esc` to leave.
- **Spotlight search.** Press `/` or `Ctrl`/`Cmd` + `K` to search games and apps from anywhere.
- **Options window.** Theme (light, dark, auto), wallpaper, accent color, auto fullscreen, a backup file, and the disguise tools below.
- **Disguise tools.** Open the site inside an `about:blank` tab, set a custom tab title and icon (Google, Drive, Docs, Classroom, Canvas, Wikipedia, Khan Academy), and a panic key (default `` ` ``) that jumps to a page you choose.
- **Open in about:blank.** File > Open Site in about:blank, the Options button, or the game player's **Tab** button. Allow pop-ups for the site first. When the site is opened from a downloaded file, the about:blank tab loads the hosted copy, so it needs an internet connection.
- **Works on phones.** Each window becomes a full-screen app and the dock stays at the bottom.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `/` or `Ctrl`/`Cmd` + `K` | Spotlight search |
| `1` `2` | Open Games, Options |
| `?` | Open Help |
| `Esc` | Close Spotlight or a menu, or leave the current game |
| `` ` `` (changeable) | Panic key: jump to your panic page |

## Where the games come from

- **26 built-in games** (Snake, Tetris, 2048, Chess, Pac-Man and others) are included as local files in `games/` and run without an internet connection.
- **780 other games** load from their original host (`inkyedu118.github.io`). They need an internet connection, and they stop working if that host is blocked or goes away.

Game names, artwork and content belong to their respective owners. Games that load from another host are served by that host, so their pages may have their own ads or tracking.

## Run it

The site is one file, `index.html` (HTML, CSS and JavaScript together), plus the `games/` and `assets/` folders.

- **On GitHub Pages:** enable Pages for the `master` branch and it works as is.
- **From a downloaded zip:** open `index.html` in a browser. Games, search, favorites and options all work.
- **On any static host** (AWS S3, Netlify, Cloudflare Pages and so on): upload the folder as is.

## Your data

Favorites, history, play counts and options are stored in your browser only. **Options > Backup** exports them to a file you can load on another device. The site itself sends nothing to any server. Games that load from another host, and the tab icons you can choose in Options (loaded from Google, Wikipedia and similar), contact those hosts when used.

## Repository layout

| Path | What it is |
| --- | --- |
| `index.html` | The whole site: markup, styles, scripts and the game list |
| `games/` | One folder per game, each with its own `index.html` |
| `assets/` | Thumbnails, icons, and the shared game styles and scripts |
| `bedrock.svg` | An SVG that embeds the live site, for opening in its own tab |
