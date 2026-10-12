# Turning on real sign-in email — free, no card

You need one free key and one line in a file. Ten minutes, no payment anywhere.

## 1. Get a free Resend key (easiest)

1. Go to <https://resend.com/signup> and sign up — free plan, no card, no
   trial that expires.
2. Confirm the email they send you. **Remember which address you used** — see
   the sandbox note below.
3. In the dashboard open **API Keys** → **Create API Key**. Name it `glass`,
   permission **Sending access**, and copy the key (it starts with `re_`). It is
   shown once.

## 2. Put it in `.env`

In this folder (`glass site/plain`), create a file named `.env` next to
`server.js` with one line:

```
RESEND_API_KEY=re_paste_your_key_here
```

Nothing else is required. `.env` is already listed in `.gitignore`, so it stays
on your machine — never commit it, never paste it into a chat.

## 3. Start the server

```bash
cd "glass site/plain"
npm start          # or: node server.js
```

You should see:

```
Glass site on http://127.0.0.1:4173
Sign-in email: resend from Glass <onboarding@resend.dev>
```

Check the setup at any time without starting the server:

```bash
npm run check                       # what this machine can send
npm run send-test -- you@mail.com   # one real code, nothing else
```

## 4. Try it

Open <http://127.0.0.1:4173/signin.html>, enter an address and press
**Continue with email**. The code arrives from
`Glass <onboarding@resend.dev>`; type the six digits and you are in.

## The one Resend catch (free plan, no domain)

`resend.dev` **can only send to the address on your Resend account** until you
verify a domain you own — that is Resend's own testing limit, not something this
site imposes:
[resend.com/docs/knowledge-base/403-error-resend-dev-domain](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

So on the free sandbox sender, sign in with the same email you signed up with.
That fully exercises the flow: real request, real email, real code check.

To email *other* people for free too:

- **Buy nothing — verify a single sender email at Brevo.** Brevo's free plan
  lets you verify one sender address (a Gmail address works; no domain, no DNS)
  and then send to any recipient within its daily limit. Sign up at
  <https://www.brevo.com>, then **SMTP & API → API Keys** → create one, and put
  that line in `.env` instead:

  ```
  BREVO_API_KEY=xkeysib-your-key-here
  OTP_FROM=Glass <the-address-you-verified@gmail.com>
  ```

- **Or verify a domain at Resend.** Free if you already own a domain; then set
  `OTP_FROM=Glass <hello@yourdomain.com>` and you can write to anyone.

## While you are setting that up

With no key at all the site still works: the sign-in step says mail is off and
keeps codes in the browser. Add `OTP_DEBUG=1` to `.env` to walk the whole flow
with the code shown on screen instead of emailed:

```bash
OTP_DEBUG=1 npm start
```

## Reminders

- The key was shared in a chat, so **rotate it** once you are done testing:
  delete it in the Resend dashboard and create a new one. A key pasted anywhere
  public should be treated as spent.
- Every edit to `.env` needs a restart — `Ctrl+C`, then `npm start` again.
- Codes live in memory: restarting clears pending ones. That is deliberate, and
  documented in [README.md](README.md).
