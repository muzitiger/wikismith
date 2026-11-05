Static assets
=============

favicon.svg        Site icon.

og-default.png     Social card, 1200x630. Used whenever a page has no
                   og:image of its own (src/components/seo/Seo.astro).

                   Regenerate after changing the site name or tagline:

                     "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
                       --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
                       --window-size=1200,630 \
                       --screenshot=public/og-default.png \
                       "file://$PWD/scripts/og-card.html"

                   scripts/og-card.html is the editable source: one HTML file,
                   no build step, no image editor needed.

                   Why PNG and not SVG: Facebook, X, LinkedIn and Slack do not
                   render SVG og:image. They show a blank card. Keep it raster.

                   Per-page og:image paths declared in content files are still
                   placeholders — replace them with real 1200x630 captures.
