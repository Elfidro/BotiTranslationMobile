# BotiTranslation Enhancer

Userscript for [botitranslation.com](https://www.botitranslation.com/):

- **Dark mode.** The site already ships a `.skin-dark` theme in its stylesheet
  but never enables it, and that theme is unfinished (grey inputs, white rank
  lists, dialogs and tables). The script switches the page to `skin-dark` and
  patches the parts it misses.
- **Explore fix** (`/explore` only):
  - **No more repeated novels.** The site loads Explore 20 books at a time,
    but the server's order shifts between those requests, so some novels keep
    reappearing while others never show. The script loads the list in large
    chunks that come back in a stable order, only as far as you scroll, so
    every novel appears exactly once for every filter combination.
  - **Hide novels.** Each card gets a small *Hide* button next to *Favorite*.
    Hidden novels are left out of Explore from then on. A *Hidden novels (N)*
    section in the left sidebar, under Genre, lists them with *Unhide* per
    novel and *Unhide all*. The list is stored in the browser (`localStorage`),
    so it is per browser and per device.

Chapter pages (`/chapter/...`) are excluded on purpose: the reader has its own
colour themes, pick one from the palette in the reader toolbar.

## Install

1. Install a userscript manager:
   - Desktop: [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/)
   - Android: Firefox + Tampermonkey/Violentmonkey, or Kiwi Browser + Tampermonkey
   - iOS: [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) for Safari
2. Open the raw script and the manager will offer to install it:

   https://raw.githubusercontent.com/Elfidro/BotiTranslationMobile/main/botitranslation.user.js

Updates are picked up automatically through `@updateURL`.

**Upgrading from the earlier two scripts:** if you installed *BotiTranslation
Dark Mode* (`botitranslation-dark.user.js`) or *BotiTranslation Explore Fix*
(`botitranslation-explore.user.js`), remove them from your userscript manager
and install this one instead. Those files no longer exist, so they will not
receive updates. Your hidden-novels list carries over.

## Files

- `botitranslation.user.js` - the userscript
