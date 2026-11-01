# Proxy components

The Browser tab uses these open-source libraries. They are included unmodified (source maps removed) so the site works on static hosting.

| Folder | Component | Version | License | Source |
| --- | --- | --- | --- | --- |
| `portal/` | Ultraviolet | 3.2.7 | AGPL-3.0 | https://github.com/titaniumnetwork-dev/Ultraviolet |
| `scramjet/` | Scramjet | 1.1.0 | AGPL-3.0 | https://github.com/MercuryWorkshop/scramjet |
| `baremux/` | bare-mux | 2.1.9 | MIT | https://github.com/MercuryWorkshop/bare-mux |
| `libcurl/` | libcurl-transport (with libcurl.js, LGPL-3.0) | 1.5.1 | AGPL-3.0 | https://github.com/MercuryWorkshop/libcurl-transport |

`server.js` uses wisp-js (LGPL-3.0-or-later), https://github.com/MercuryWorkshop/wisp-js.

The same stack is used by DogeUB, https://github.com/xorynix/dogeub (AGPL-3.0). The wiring in `sw.js`, `sj-sw.js`, `portal/uv.config.js` and `server.js` is original to this project.

The full AGPL-3.0 text is in `LICENSE` in this folder. Because these parts are AGPL-3.0, publish the source of this site (including any changes you make to them) if you host it for other people.
