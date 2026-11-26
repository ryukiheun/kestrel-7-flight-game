[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/ryukiheun/kestrel-7-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/ryukiheun/kestrel-7-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

# KESTREL-7 — Canyon Run

An original arcade flight game for the [best-flight-game-20261126-0057 bounty](https://make.fun/bounty/best-flight-game-20261126-0057): fly the KESTREL-7 jet of Vermilion Wing through Ember Canyon. Three sorties with three different goals — a ring run down the valley, a ridge-crossing delivery to a drop pad, and a night landing on runway 09 — with throttle, fuel and hull turning every sortie into decisions. Chase view with afterburner, or press C for the lit cockpit with runway ahead. No commercial names, aircraft, art or music: everything here is original.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

Or open `game/index.html` from any static server. No build step, no network request: every file the game loads lives under `game/`.

## Controls

- **W / S** or **↑ / ↓** — pitch nose up / down
- **A / D** or **← / →** — bank and turn
- **Shift / Ctrl** — throttle up / down (full throttle drinks fuel fast)
- **Mouse** — nudge the gunsight
- **C** — chase / cockpit view
- **1 / 2 / 3** — ring run / canyon delivery / night landing
- **P** — pause · **R** — retry the sortie

Land gentle to score: under 170 KT and under 900 FPM on runway 09. Hit the rock and the hull pays for it.

## Referral

Referral code: `r5cs55h2`

## License

MIT — see [LICENSE](LICENSE).
