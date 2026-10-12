/* The sign-in email.

   Two jobs live in this file: rendering the code as a branded, client-proof
   HTML email, and handing it to a provider over plain HTTP. No SDK, no
   dependency — a fetch and a template.

   Providers, both with a free tier:
     RESEND_API_KEY  → https://api.resend.com/emails   (Bearer auth)
     BREVO_API_KEY   → https://api.brevo.com/v3/smtp/email (api-key header)

   Whichever key is present is used; RESEND wins if both are set. Nothing is
   sent when neither is, and the server says so instead of pretending. */

"use strict";

const BRAND = {
  name: "Glass",
  tagline: "Independent software studio",
  replyTo: "glassbrand@proton.me",
  /* The site palette, flattened to hex for mail clients that never met oklch. */
  ink: "#0d1014",
  muted: "#6b7280",
  line: "#e6e8ec",
  canvas: "#f4f5f8",
  card: "#ffffff",
  accent: "#2563eb",
  panel: "#f7f9fc",
};

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** "123456" → "123 456" — easier to read back from a phone screen. */
function spaced(code) {
  return String(code).replace(/(\d{3})(\d{3})/, "$1 $2");
}

/**
 * A single-column table layout with inline styles: the only shape that renders
 * the same in Gmail, Outlook and Apple Mail. The glass cues are kept — soft
 * canvas, a rounded white card, one blue accent — without anything that needs
 * a stylesheet.
 */
function renderHtml({ code, expiresMinutes, requestedAt }) {
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(requestedAt);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>Your Glass sign-in code</title>
  </head>
  <body style="margin:0;padding:0;background-color:${BRAND.canvas};">
    <!-- Preheader: the line a mail app shows next to the subject. -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Your Glass sign-in code is ${spaced(code)}. It expires in ${expiresMinutes} minutes.
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="background-color:${BRAND.canvas};padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
            style="max-width:520px;background-color:${BRAND.card};border:1px solid ${BRAND.line};border-radius:24px;">
            <!-- Brand -->
            <tr>
              <td style="padding:32px 36px 0 36px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="34" height="34" align="center" valign="middle">
                      <!-- Logo Icon from plain/assets/logo.svg -->
                      <img src="https://raw.githubusercontent.com/Ayaan192/kmcproject-schoolportal/refs/heads/main/logo.svg" alt="Glass Logo" width="34" height="34" style="display:block;width:34px;height:34px;border-radius:10px;object-fit:contain;" />
                    </td>
                    <td style="padding-left:12px;font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:0.24em;text-transform:uppercase;color:${BRAND.ink};">
                      Glass
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Headline -->
            <tr>
              <td style="padding:32px 36px 0 36px;">
                <p style="margin:0;font-family:${FONT};font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:${BRAND.muted};">
                  Sign in
                </p>
                <h1 style="margin:12px 0 0 0;font-family:${FONT};font-size:26px;font-weight:300;letter-spacing:-0.02em;color:${BRAND.ink};">
                  Your sign-in code
                </h1>
                <p style="margin:12px 0 0 0;font-family:${FONT};font-size:15px;line-height:24px;color:${BRAND.muted};">
                  Enter this code on the sign-in page to finish signing in. It is
                  good for one sign-in only.
                </p>
              </td>
            </tr>

            <!-- The code (Google-style individual digit boxes) -->
            <tr>
              <td style="padding:24px 36px 0 36px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                  style="background-color:${BRAND.panel};border:1px solid ${BRAND.line};border-radius:16px;">
                  <tr>
                    <td align="center" style="padding:26px 20px;">
                      
                      <!-- Individual Digit Containers -->
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          ${code.toString().split('').map(digit => `
                            <td align="center" width="42" height="52" style="background-color:#ffffff;border:1px solid ${BRAND.line};border-radius:10px;font-family:${MONO};font-size:26px;font-weight:600;color:${BRAND.ink};">
                              ${digit}
                            </td>
                            <td style="width:6px;" width="6"></td>
                          `).join('')}
                        </tr>
                      </table>

                      <div style="margin-top:16px;font-family:${FONT};font-size:12px;letter-spacing:0.05em;color:${BRAND.muted};">
                        Expires in ${expiresMinutes} minutes
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Details -->
            <tr>
              <td style="padding:22px 36px 0 36px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-family:${FONT};font-size:13px;line-height:22px;color:${BRAND.muted};">
                      Requested at ${escapeHtml(time)}. If you did not ask for this
                      code, you can ignore this email — nothing about your account
                      has changed, and the code will expire on its own.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:26px 36px 32px 36px;">
                <div style="height:1px;background-color:${BRAND.line};"></div>
                <p style="margin:16px 0 0 0;font-family:${FONT};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${BRAND.muted};">
                  ${escapeHtml(BRAND.name)} — ${escapeHtml(BRAND.tagline)}
                </p>
                <p style="margin:8px 0 0 0;font-family:${FONT};font-size:12px;color:${BRAND.muted};">
                  Questions? Reply to this email or write to
                  <a href="mailto:${BRAND.replyTo}" style="color:${BRAND.accent};text-decoration:none;">${BRAND.replyTo}</a>.
                </p>
              </td>
            </tr>
          </table>

          <p style="margin:18px 0 0 0;font-family:${FONT};font-size:11px;color:${BRAND.muted};">
            Four apps in development · early access open
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
                          }

/** The same message as plain text, for clients that ask for it. */
function renderText({ code, expiresMinutes, requestedAt }) {
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(requestedAt);

  return [
    `Your Glass sign-in code is ${spaced(code)}`,
    "",
    `Enter it on the sign-in page to finish signing in. It expires in ${expiresMinutes} minutes and is good for one sign-in.`,
    "",
    `Requested at ${time}. If you did not ask for this code you can ignore this email.`,
    "",
    `${BRAND.name} — ${BRAND.tagline}`,
    BRAND.replyTo,
  ].join("\n");
}

function providerFromEnv(env) {
  if (env.RESEND_API_KEY) {
    return {
      name: "resend",
      from:
        env.OTP_FROM ||
        `${BRAND.name} <onboarding@resend.dev>`,
      async send({ to, subject, html, text }) {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: this.from,
            to: [to],
            subject,
            html,
            text,
            reply_to: BRAND.replyTo,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.message || `Resend returned ${response.status}`);
        }
        return payload.id || null;
      },
    };
  }

  if (env.BREVO_API_KEY) {
    return {
      name: "brevo",
      from: env.OTP_FROM || BRAND.replyTo,
      async send({ to, subject, html, text }) {
        const senderMatch = /^(.*)<(.*)>$/.exec(this.from.trim());
        const sender = senderMatch
          ? { name: senderMatch[1].trim().replace(/"/g, ""), email: senderMatch[2].trim() }
          : { name: BRAND.name, email: this.from.trim() };

        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": env.BREVO_API_KEY,
            "Content-Type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            sender,
            to: [{ email: to }],
            replyTo: { email: BRAND.replyTo, name: BRAND.name },
            subject,
            htmlContent: html,
            textContent: text,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.message || `Brevo returned ${response.status}`);
        }
        return payload.messageId || null;
      },
    };
  }

  return null;
}

function describeDelivery(env) {
  const provider = providerFromEnv(env);
  return {
    configured: Boolean(provider),
    provider: provider ? provider.name : null,
    from: provider ? provider.from : null,
    debug: String(env.OTP_DEBUG || "") === "1",
  };
}

/**
 * Send one code. Resolves with { provider, id } on success and throws a plain
 * Error whose message is safe to show — the code itself is never echoed.
 */
async function sendCodeEmail(env, { to, code, expiresMinutes, requestedAt }) {
  const provider = providerFromEnv(env);
  if (!provider) {
    throw new Error("No email provider is configured.");
  }

  const subject = `Your Glass sign-in code: ${spaced(code)}`;
  const html = renderHtml({ code, expiresMinutes, requestedAt });
  const text = renderText({ code, expiresMinutes, requestedAt });

  const id = await provider.send({ to, subject, html, text });
  return { provider: provider.name, id };
}

module.exports = {
  BRAND,
  renderHtml,
  renderText,
  describeDelivery,
  sendCodeEmail,
};
