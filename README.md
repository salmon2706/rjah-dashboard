# RJAH tablet dashboard

Kiosk for The Robert Jones and Agnes Hunt Orthopaedic Hospital, Gobowen. Same layout as the Goodwood (Rolls-Royce) tablet, with the office RedChair weekday heat map.

Live: https://salmon2706.github.io/rjah-dashboard/

Cups are daily counter deltas from 26th October 2026. A board that arrives with a previous-site counter does not dump that total onto the screen.

## Serial history

| Board | Serial | At Gobowen |
| --- | --- | --- |
| RiverSand | LKK-5925 | from 26th October 2026 |

The live listener only accepts the current serial (`LKK-5925`). The on-screen road is 100 cups. The strip under the savings cards is the typical weekday heat map, 7am to 5:30pm, same half-hour bins as the office RedChair tablet.

On the tablet: Safari, the live URL, Add to Home Screen, landscape. Same Wi-Fi with internet.

## Deploy

```bash
./deploy.sh
```

That bumps the `?v=` cache token in `index.html`, commits, and pushes `main`. GitHub Pages serves `/` from `main`.
