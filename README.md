# BotiTranslation Dark Mode

Userscript that turns [botitranslation.com](https://www.botitranslation.com/) dark.

The site already ships a `.skin-dark` theme in its stylesheet but never enables it,
and that theme is unfinished (grey inputs, white rank lists, dialogs and tables).
This script switches the body to `skin-dark` on page load and patches the parts it misses.

Chapter pages (`/chapter/...`) are excluded on purpose: the reader has its own
colour themes, pick one from the palette in the reader toolbar.

## Install

1. Install a userscript manager:
   - Desktop: [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/)
   - Android: Firefox + Tampermonkey/Violentmonkey, or Kiwi Browser + Tampermonkey
   - iOS: [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) for Safari
2. Open the raw script and the manager will offer to install it:

   https://raw.githubusercontent.com/Elfidro/BotiTranslationMobile/main/botitranslation-dark.user.js

Updates are picked up automatically through `@updateURL`.

## Explore Fix

A second, independent userscript for the Explore page (`/explore`):

- **No more repeated novels.** The site loads Explore 20 books at a time, but
  the server's order shifts between those requests, so the same novels show up
  again and again while others never appear. The script loads the list in large
  1000-book chunks (which come back in a stable order), only as far as you
  scroll, and hands the page its 20-book pages from that list. Every novel shows
  up exactly once, for every Category / Genre / Last Update / Status filter.
- **Hide novels you are not interested in.** Each card gets a small *Hide*
  button next to *Favorite*. Hidden novels are left out of Explore from then on.
- **Undo.** A *Hidden novels (N)* section in the left sidebar, under Genre,
  lists what you hid, with *Unhide* per novel and *Unhide all*.

The hidden list is stored in the browser (`localStorage`), so it is per browser
and per device. It works with or without the dark mode script.

Install:

https://raw.githubusercontent.com/Elfidro/BotiTranslationMobile/main/botitranslation-explore.user.js

## Files

- `botitranslation-dark.user.js` - the dark mode userscript
- `botitranslation-explore.user.js` - the Explore page fix (no duplicates, hide novels)
