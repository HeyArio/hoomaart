# Hooma Art: product and design context

register: brand

## What it is
Hooma Art sells valuable artworks through private, invitation-only evenings in architect-designed homes, joined by a website where every work has its own page. Persian first (RTL), with English. Market: Tehran.

## Who the site is for, in order
1. Artists deciding whether to consign work. The site's current job is to convince them.
2. Space owners and sponsors.
3. Buyers, once there is a catalog.

## Design direction
A dark viewing room. The artwork is the only colour on the page; the interface is black, white and hairlines.

- The hero room takes its light from the work on show (a blurred copy of the image behind it).
- Scale is shown as an architectural elevation drawing (wall, door, dimension lines), which ties the product to the architects' side of the business.
- Type: Markazi Text for display, Vazirmatn for text. Persian numerals in Persian.
- One signal colour, `--dot` red, used only for a sold work (the gallery red dot).
- Motion: one hero load sequence, slow crossfades between works, quiet scroll entrances. All of it is switched off for reduced-motion users.

## Rules for copy
- Never invent facts: no made-up statistics, names, prices, dimensions, sales or event history. Unknown details show "on request" or are left out.
- Do not name or imitate other marketplaces. Do not disparage galleries.
- Guest, venue and artist privacy come first.
- Tone: calm, premium, concrete. Short sentences. Persian reads as written in Persian.
- Be honest about the technology: camera recognition depends on light, the QR marker is the reliable path, uploaded photos stay on the phone unless the visitor sends them.

## Technical shape
Zero-dependency Node server (`server.js`), static frontend in `public/`, JSON data in `DATA_DIR`. No build step.
