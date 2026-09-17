---
"@cire/invites": patch
---

Gift registry — the scarcity counts go, and "Reserved" becomes a control

The guest registry counted two things at a guest: how much of the couple's list was still free ("6 of 14 still available"), and how many of each gift were left ("1 of 2 left", "All reserved"). Both are gone, along with the `data-gift-remaining` and `data-gift-availability` hooks and the sentence "Another guest has this one covered." A tally of what is left turns choosing a present into a race, which is the wrong feeling for the page. The household's own line stays — "You reserved 2 gifts" is their ledger, not a scoreboard.

A gift nobody can still reserve now says so as a disabled button reading "Reserved", with its picture dimmed. A real `disabled` rather than `aria-disabled`: the word is the whole message, so there is nothing behind the control for a keyboard user to reach, and the native attribute is what earns the WCAG 1.4.3 exemption for drawing it dimmed at all. The card's text is never dimmed, because the palette is derived per wedding and held to the contrast floors rather than above them. The control renders signed in or out — whether a gift is taken is a fact about the gift, not about the viewer's session.

The one count that earned its place moves to where it bounds an action: a hint under the quantity box naming the ceiling the box already enforces, so a guest who types 4 is told why they will get 2 before they submit rather than after.
