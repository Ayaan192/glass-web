# Glass — the plain site

The same shop as `../src` (Vite + React + Convex), rebuilt as hand-written
HTML, CSS and JavaScript. No framework, no bundler on the client, no CSS build
step — and one small Node file behind it that serves the pages and emails real
sign-in codes.

## Pages

| File | What it is |
| --- | --- |
| `index.html` | Landing: brand intro, the promise strip, the suite, how we build, contact |
| `catalog.html` | The shelf with live search, platform filters and sorting |
| `product.html?slug=glass-tweaks` | One app: illustration, highlights, reserve panel, specifications |
| `checkout.html` | Licence details and the order summary |
| `order.html?id=…` | The receipt for a reservation |
| `account.html` | Profile, licence name, which apps are licensed or reserved, order history |
| `signin.html?returnTo=…` | Email step, emailed six-digit code, guest access |
| `404.html` | Anything that is not one of the above, served by `server.js` |

`assets/` holds the whole design system (`glass.css`), the suite as content
(`data.js`), the client runtime (`glass.js` — header, account menu, cart drawer,
icons, drawn glass objects, browser-side shop state) and the favicon.

## Sign-in by email

`server.js` is a zero-dependency Node server. It serves the folder above and
answers four calls:

| Route | What it does |
| --- | --- |
| `GET /api/config` | Tells the page whether real mail is switched on (`live`), only shown on screen (`debug`) or unavailable (`off`) |
| `POST /api/otp/request` | Makes a six-digit code, stores its SHA-256 hash and emails it |
| `POST /api/otp/verify` | Checks the code in constant time and returns the account plus a signed session token |
| `GET /api/otp/email-preview` | Renders the email so you can look at it without sending one |

### Turning on real mail

Both providers below are free, and neither needs a paid key. Copy
`.env.example` to `.env` and fill in **one** line:

```bash
cd "glass site/plain"
cp .env.example .env     # then edit .env
npm start                # or: node server.js
```

- **Resend** — `RESEND_API_KEY=re_…`. Free tier, no card. Its sandbox sender
  (`Glass <onboarding@resend.dev>`) works immediately for the address you signed
  up with; verify a domain to write to anyone.
- **Brevo** — `BREVO_API_KEY=xkeysib-…`. Free tier, no card. Verify a single
  sender address (no domain, no DNS) and you can send to any recipient, up to
  the daily limit.

Whichever key is present is used; `RESEND_API_KEY` wins if both are set.
`OTP_FROM` sets the From line — the default for Brevo is `hello@glass.app`, so
change it to an address you have actually verified.

With no key at all the page does not pretend: the sign-in step says the mail
server is off, and either shows the code on screen (`OTP_DEBUG=1`, for working
on the flow) or falls back to the browser-only sign-in when the page is opened
without the server at all.

### The email itself

`server/email.js` renders it — table-based HTML with inline styles, the only
shape that survives Gmail, Outlook and Apple Mail, wearing the same tokens as
the site: soft canvas, rounded white card, one blue accent, the monogram, the
code in a mono panel with the expiry, a "if you did not ask for this" line, and
a plain-text version for clients that ask for one. See it any time at
`/api/otp/email-preview`.

### What keeps the codes honest

- Codes come from `crypto.randomInt`, are stored only as a salted SHA-256 hash,
  compared with `crypto.timingSafeEqual`, and are deleted the moment they are
  used — one sign-in per code.
- Fifteen minutes to live, five wrong tries, then the code is thrown away.
- A 45-second resend cooldown, at most five codes per address and twenty per
  connection in a fifteen-minute window; the page reads the wait from the server
  rather than inventing one.
- Codes are never logged and never appear in an error message (`OTP_DEBUG=1`
  prints one deliberately, for development).
- `.env`, dot-files and the server's own source are never served; pages go out
  with a strict `Content-Security-Policy` and `nosniff`.

Two limits worth knowing: the code store lives in memory, so a restart clears
pending codes and a second instance would not share them; and while the session
token is HMAC-signed, the browser still keeps the account in `localStorage`. A
deployment that matters should move that to an `HttpOnly` cookie session.

## What stays in the browser

The React site talks to Convex for cart, orders and catalogue. This build has no
database, so the shop lives in `localStorage`:

- `glass-theme` — light or dark (dark is the default, as in the app)
- `glass-session` — the signed-in account (from the server, token included) or a guest session
- `glass-cart` — reserved seats
- `glass-orders` — orders placed from checkout

Two consequences worth being plain about:

1. **Guest accounts stay in the browser.** "Continue as guest" never touches the
   server, exactly as in the app.
2. **Payments are not connected.** Checkout records the reservation as an order
   marked *Awaiting payment* and charges nothing — the honesty the React build
   already shows while Stripe is unconfigured.

## Running it without Node

The pages are plain files: open `index.html` from disk, or serve the folder with
anything (`python -m http.server`). Sign-in then stays in the browser, because
there is nothing to send mail from.

## Keeping the two sites in step

`src/convex/catalog.ts` and `assets/data.js` are the same rows. Change an app,
price or platform in one and change it in the other; the pages render whatever
`data.js` holds, so the shelf, detail pages, drawer and checkout all follow.
