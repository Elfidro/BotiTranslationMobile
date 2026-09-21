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

## Files

- `botitranslation-dark.user.js` - the userscript
