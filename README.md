# RJAH Gobowen dashboard

Live board for The Robert Jones and Agnes Hunt Orthopaedic Hospital, Gobowen. Portrait 9:16 for their 65-inch iiyama with iiSignage². Landscape still uses the Goodwood tablet layout.

Live: https://salmon2706.github.io/rjah-dashboard/

Cups are daily counter deltas from 26th October 2026. A board that arrives with a previous-site counter does not dump that total onto the screen.

## Serial history

| Board | Serial | At Gobowen |
| --- | --- | --- |
| RiverSand | LKK-5925 | from 26th October 2026 |

The live listener only accepts the current serial (`LKK-5925`). The on-screen road is 100 cups. The strip under the savings cards is the typical weekday heat map, 7am to 5:30pm, same half-hour bins as the office RedChair tablet.

## iiyama TV (iiSignage²)

65-inch professional signage, native 3840×2160, mounted portrait so the page is 2160×3840. The CMS is iiSignage² at iiyama-cms.com.

1. New programme in **portrait**.
2. Add a **Web Page** widget. Paste this URL exactly, including the last slash:

   `https://salmon2706.github.io/rjah-dashboard/`

   Without that slash the CMS loads the HTML and then looks for the styles at the wrong path. You get four black quarter-circles on white. That is the tablet corner marks with no CSS.
3. Right-click the widget, **Fill up**, so it covers the screen.
4. Leave force refresh off. The page already listens live on Firebase; a refresh would blank it.
5. Back button off. No entrance animation. No cookie or login on this URL.
6. Publish to the 65-inch. The display needs internet (GitHub Pages and Firebase).

To preview the TV stack on a laptop, open the URL with `?tv=1`.

## Deploy

```bash
./deploy.sh
```

That bumps the `?v=` cache token in `index.html`, commits, and pushes `main`. GitHub Pages serves `/` from `main`.
