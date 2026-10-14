# Rebar-Fab Field Quote (PWA) v1

Static, offline-capable web app for Rebar-Fab field sales. No app store, no server code, no paid services.
Designed by Joe Dane Lucero P.E.

## Files
- `index.html`, `styles.css`, `app.js` (UI), `calc.js` (takeoff and pricing math)
- `manifest.json`, `sw.js` (service worker, cache `rf-quote-v1`), `icons/` (192, 512, maskable 512, apple-touch 180, favicon, all from the RF ring mark)
- `logo.png` (Rebar-Fab logo), `accessories.json` (bundled from `standards/accessories_pricelist.csv`: cost, markup %, sell)
- `ocr/` offline OCR (tesseract.js 5 with English data, about 11 MB, cached in the background after install)
- `screens/` mobile screenshots

## Hosting (HTTPS is required to install)
Any static host works. Upload the folder contents so that `index.html` sits at the site root (or in a sub-path; all paths are relative).
- **Netlify Drop:** go to https://app.netlify.com/drop and drag the `field_quote_app` folder (or unzip `field_quote_app_v1.zip` and drag the folder). You get an https URL right away.
- **GitHub Pages:** create a repo, push these files to `main`, then Settings → Pages → Deploy from branch `main` / root. The URL is `https://<user>.github.io/<repo>/`.
- **Cloudflare Pages:** Workers & Pages → Create → Pages → Upload assets → drop the folder.
After an update, bump `VER` in `sw.js` (for example `rf-quote-v2`) so phones pick up the new files.

## Install
- **iPhone (Safari):** open the URL in Safari → Share → **Add to Home Screen** → Add. Open it once while online so it caches, and after that it works offline.
- **Android (Chrome):** open the URL → menu ⋮ → **Install app** (or tap the install banner).

## Use
- **Takeoff:** add elements (slab/mat, continuous footing/grade beam, spread footing/pad, pier/drilled shaft, wall, ductbank, custom). Every row shows count x length = LF x lb/LF = lb, plus 20' and 40' sticks. Laps (default 40 db) show on their own rows when a bar is longer than the stock length (default 40 ft). Hooks use 12 db (editable). Bent bars, ties, stirrups, spirals and hooked bars are Fabricated; everything else is Straight, and you can override this per line. Each line has a plan sheet/page reference.
- **Plan Photo:** use the camera or pick from the gallery, then calibrate by tapping two ends of a known dimension (enter `20'-6"` or `20.5`, or a printed scale as `2in @ 1/8`). Then measure linear (LF), area (SF) or count. Pinch or wheel to zoom, drag to pan, Undo. Send any measurement to a new or existing takeoff line, and the photo name plus the measurement go into the plan reference. OCR reads callouts like `#5 @ 12" EW` and can apply the bar size and spacing to a line. **Photo measurements are field estimates. Verify them against the scaled plans.**
- **Price (internal):** sets trucking to Auto (ROUNDUP(T/24) x $1,200) or Manual (a total $ amount, or loads x $/load). It has quote-level rate overrides (highlighted, with the market rate and the $/% difference), a target sell $/lb or $/T that back-solves the markup, a per-line override sell $/lb, and a below-cost warning. Accessories come from the price list, and you can suggest dobies/chairs on a 4'x4' grid.
- **Quote (customer copy):** shows only sell prices. Material, Trucking and Shop Drawings are separate columns that add up to the Total, with $/T and $/lb. The bold base total comes first, then optional items totaled separately, then a double-ruled grand total. It includes the exclusion "Concrete by others" and the escalation terms. Use Print / PDF (print stylesheet), Share (Web Share API: text plus CSV, falling back to mailto), or CSV.
- **Saved:** quotes and photos are stored in IndexedDB on the device. You can open, duplicate or delete them.
- **Settings:** market rates and accessory sell prices, an optional admin PIN lock, and **Reset to Rebar-Fab defaults**.

## Pricing math
- Waste lb = takeoff lb x (1 + waste%). Material sell = (fab lb x fab $/lb + straight lb x straight $/lb) x (1 + waste) x (1 + markup). Epoxy lines use the epoxy $/lb on all pounds.
- Shop drawings = tons x $35. Trucking on base lines is ROUNDUP(base T / 24) x $1,200 (or the manual value), split across the base lines by tonnage. Each optional line carries its own ROUNDUP(T/24) loads.
- Markup applies to material only by default. A setting can also apply it to trucking and shop drawings.

## Import / export schema
CSV columns: `line_no,element,description,sheet_ref,epoxy,optional,class_override,carry_laps,mark,bar,count,length_ft,lf,lb_per_lf,lb,sticks_20,sticks_40,class,math,params_json,override_per_lb`, plus trailer rows `#trucking,...`, `#override,{json}` and `#accessory,...`.
On import, `params_json` rebuilds each element. A plain bar list (element=custom with bar, count and length_ft) also imports. JSON export is `{app, schema:1, settings, quote, takeoff}`.
