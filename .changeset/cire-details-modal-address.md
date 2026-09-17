---
"@cire/invites": patch
---

The invite's event details modal: the venue address wraps instead of being cut
off, and the map footer no longer offers two ways to open the same map.

The address carried `truncate` — `white-space: nowrap` plus `text-overflow:
ellipsis` — so it clipped at every width rather than only narrow ones, and a
guest could not read where the event was. It now wraps. `wrap-anywhere` gives a
single unbreakable token somewhere to break, so no address can push the row
wider than the card; `line-clamp-4` bounds an address of unlimited length, which
is a real case because nothing between the organiser's input and the render
constrains it. Four lines is measured rather than guessed: in the narrowest
column this footer renders in — 83px, the fallback branch at a 320px viewport —
a street address takes three.

The shared footer's "Open in Maps" action is now the CSS-card branch's alone.
When the real Google Maps iframe renders, Google's own "View larger map" is
already there, so the footer action was a second route to the same place. In the
fallback branch it stays: the whole card is the link, and the action is the only
visible sign of it. With nothing left using the footer's link mode, the `<a>`
branch and its `href` prop are gone rather than kept as a shim.

`MapPreview.browser.test.tsx` measures the outcome in a real Chromium at 320,
768 and 1440 — the fast tier can only see that the text is in the DOM, which
truncation never changed.
