/* Glass — the site, served with real sign-in email.

   One file, no dependencies: it serves the plain HTML site and answers the two
   calls the sign-in page makes.

     GET  /api/config          what delivery this server can do
     POST /api/otp/request     email a six-digit code
     POST /api/otp/verify      check a code and hand back the account
   + GET  /api/otp/email-preview   look at the email without sending it

   Run it with:   node server.js
   Configure it with a .env file (see .env.example). Free providers only:
   a Resend key, a Brevo key, or nothing at all — in which case the page falls
   back to its browser-only sign-in and says so, rather than pretending mail
   left the building. */

"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { renderHtml, describeDelivery, sendCodeEmail, BRAND } = require("./server/email");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "127.0.0.1";

/* ============================================================
   .env — fifteen lines instead of a dependency
   ============================================================ */

function loadEnv() {
  const file = path.join(ROOT, ".env");
  if (!fs.existsSync(file)) return;

  fs.readFileSync(file, "utf8")
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const eq = trimmed.indexOf("=");
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    });
}

loadEnv();

const delivery = describeDelivery(process.env);

/* ============================================================
   Command line checks
   node server.js --check                  what this machine can send
   node server.js --send-test you@mail.com one real code, nothing else
   ============================================================ */

function printReport() {
  const envFile = path.join(ROOT, ".env");
  const hasEnvFile = fs.existsSync(envFile);

  console.log("Glass sign-in email");
  console.log(`  site folder   ${ROOT}`);
  console.log(`  .env          ${hasEnvFile ? "found" : "not found — copy .env.example to .env"}`);
  console.log(`  provider      ${delivery.provider || "none"}`);
  console.log(`  from          ${delivery.from || "—"}`);
  console.log(`  delivery      ${delivery.mode || (delivery.configured ? "live" : delivery.debug ? "debug" : "off")}`);
  console.log(`  policy        ${CODE_TTL_MINUTES} min · ${MAX_ATTEMPTS} tries · ${RESEND_COOLDOWN_SECONDS}s between resends`);

  if (!delivery.configured && !delivery.debug) {
    console.log("\nNothing can be sent yet. Paste one line into .env:");
    console.log("  RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx   (resend.com, free)");
    console.log("  BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxx   (brevo.com, free)");
  } else if (!delivery.configured) {
    console.log("\nOTP_DEBUG=1 is on, so codes are shown on screen instead of emailed.");
  } else {
    console.log("\nReady. Start it with: node server.js");
  }
}

async function sendTest(address) {
  if (!delivery.configured) {
    console.error("No provider key found. Add RESEND_API_KEY or BREVO_API_KEY to .env first.");
    process.exit(1);
  }

  const code = newCode();
  try {
    const result = await sendCodeEmail(process.env, {
      to: address,
      code,
      expiresMinutes: CODE_TTL_MINUTES,
      requestedAt: new Date(),
    });
    console.log(`Sent a test code to ${address} via ${result.provider} (${result.id || "no id"}).`);
    console.log("Nothing is signed in by it — the code was never stored.");
  } catch (error) {
    console.error(`Delivery failed: ${error.message}`);
    console.error("Check the key, and that the From address is one the provider allows.");
    process.exitCode = 1;
  }
}

/* ============================================================
   Codes
   ============================================================ */

const CODE_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 15);
const MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);
const RESEND_COOLDOWN_SECONDS = Number(process.env.OTP_RESEND_SECONDS || 45);
const MAX_CODES_PER_EMAIL = Number(process.env.OTP_MAX_PER_EMAIL || 5);
const MAX_CODES_PER_IP = Number(process.env.OTP_MAX_PER_IP || 20);
const WINDOW_MS = 15 * 60 * 1000;

/** email → { salt, hash, expiresAt, attempts, sentAt, sends:[timestamps] } */
const codes = new Map();
/** ip → [timestamps] */
const byAddress = new Map();

const sessionSecret =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

function hashCode(code, salt) {
  return crypto.createHash("sha256").update(`${salt}:${code}`).digest();
}

function newCode() {
  // Six digits, uniform, from the kernel CSPRNG.
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function sweep(now) {
  for (const [email, entry] of codes) {
    if (entry.expiresAt < now) codes.delete(email);
  }
  for (const [ip, stamps] of byAddress) {
    const kept = stamps.filter((stamp) => now - stamp < WINDOW_MS);
    if (kept.length) byAddress.set(ip, kept);
    else byAddress.delete(ip);
  }
}

setInterval(() => sweep(Date.now()), 60 * 1000).unref();

function issueSession(email) {
  const payload = Buffer.from(
    JSON.stringify({ email, iat: Date.now() }),
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", sessionSecret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

/* ============================================================
   HTTP helpers
   ============================================================ */

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 8192) {
        reject(new Error("too_large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("bad_json"));
      }
    });
    req.on("error", reject);
  });
}

function isEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

function clientIp(req) {
  return (
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket.remoteAddress ||
    "local"
  );
}

/* ============================================================
   The API
   ============================================================ */

async function handleConfig(req, res) {
  sendJson(res, 200, {
    ok: true,
    delivery: {
      configured: delivery.configured,
      provider: delivery.provider,
      from: delivery.from,
      debug: delivery.debug,
      /* "live" really emails, "debug" shows the code on screen instead,
         "off" means the page falls back to its browser-only sign-in. */
      mode: delivery.configured ? "live" : delivery.debug ? "debug" : "off",
    },
    policy: {
      codeTtlMinutes: CODE_TTL_MINUTES,
      maxAttempts: MAX_ATTEMPTS,
      resendCooldownSeconds: RESEND_COOLDOWN_SECONDS,
    },
  });
}

async function handleRequest(req, res) {
  const body = await readJson(req);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!isEmail(email)) {
    return sendJson(res, 400, {
      ok: false,
      reason: "invalid_email",
      message: "That does not look like an email address.",
    });
  }

  const now = Date.now();
  sweep(now);

  const ip = clientIp(req);
  const recentIps = byAddress.get(ip) || [];
  if (recentIps.length >= MAX_CODES_PER_IP) {
    return sendJson(res, 429, {
      ok: false,
      reason: "rate_limited",
      retryAfterSeconds: Math.ceil((WINDOW_MS - (now - recentIps[0])) / 1000),
      message: "Too many codes have been requested from this connection. Try again shortly.",
    });
  }

  const existing = codes.get(email);
  if (existing && now - existing.sentAt < RESEND_COOLDOWN_SECONDS * 1000) {
    return sendJson(res, 429, {
      ok: false,
      reason: "cooldown",
      retryAfterSeconds: Math.ceil(
        (RESEND_COOLDOWN_SECONDS * 1000 - (now - existing.sentAt)) / 1000,
      ),
      message: "A code was just sent. Give it a minute to arrive.",
    });
  }

  const sends = (existing ? existing.sends : []).filter((stamp) => now - stamp < WINDOW_MS);
  if (sends.length >= MAX_CODES_PER_EMAIL) {
    return sendJson(res, 429, {
      ok: false,
      reason: "rate_limited",
      retryAfterSeconds: Math.ceil((WINDOW_MS - (now - sends[0])) / 1000),
      message: "That address has asked for a lot of codes. Try again later.",
    });
  }

  const code = newCode();
  const salt = crypto.randomBytes(16).toString("hex");
  const requestedAt = new Date();

  // With no provider configured the code is never emailed. In debug mode it is
  // handed back so the flow can still be walked end to end; otherwise we refuse
  // rather than invent a sign-in that looks real.
  if (!delivery.configured) {
    if (!delivery.debug) {
      return sendJson(res, 503, {
        ok: false,
        reason: "unconfigured",
        message:
          "This server has no email provider yet. Add RESEND_API_KEY or BREVO_API_KEY to .env.",
      });
    }

    codes.set(email, {
      salt,
      hash: hashCode(code, salt),
      expiresAt: now + CODE_TTL_MINUTES * 60 * 1000,
      attempts: 0,
      sentAt: now,
      sends: sends.concat(now),
    });
    byAddress.set(ip, recentIps.concat(now));
    console.log(`[otp] debug code for ${email}: ${code} (nothing emailed)`);

    return sendJson(res, 200, {
      ok: true,
      mode: "debug",
      debugCode: code,
      expiresInMinutes: CODE_TTL_MINUTES,
      resendAfterSeconds: RESEND_COOLDOWN_SECONDS,
    });
  }

  try {
    const result = await sendCodeEmail(process.env, {
      to: email,
      code,
      expiresMinutes: CODE_TTL_MINUTES,
      requestedAt,
    });

    codes.set(email, {
      salt,
      hash: hashCode(code, salt),
      expiresAt: now + CODE_TTL_MINUTES * 60 * 1000,
      attempts: 0,
      sentAt: now,
      sends: sends.concat(now),
    });
    byAddress.set(ip, recentIps.concat(now));
    console.log(`[otp] sent via ${result.provider} to ${email} (${result.id || "no id"})`);

    return sendJson(res, 200, {
      ok: true,
      mode: "live",
      provider: result.provider,
      expiresInMinutes: CODE_TTL_MINUTES,
      resendAfterSeconds: RESEND_COOLDOWN_SECONDS,
    });
  } catch (error) {
    console.error(`[otp] delivery failed for ${email}: ${error.message}`);
    return sendJson(res, 502, {
      ok: false,
      reason: "delivery_failed",
      message:
        "The code could not be sent just now. Check the provider key and that the sender address is verified, then try again.",
    });
  }
}

async function handleVerify(req, res) {
  const body = await readJson(req);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const now = Date.now();

  const entry = codes.get(email);
  if (!isEmail(email) || !entry) {
    return sendJson(res, 401, {
      ok: false,
      reason: "no_code",
      message: "Ask for a new code — the last one has expired or was never requested.",
    });
  }

  if (entry.expiresAt < now) {
    codes.delete(email);
    return sendJson(res, 401, {
      ok: false,
      reason: "expired",
      message: "That code has expired. Send yourself a new one.",
    });
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    codes.delete(email);
    return sendJson(res, 429, {
      ok: false,
      reason: "too_many_attempts",
      message: "Too many tries on that code. Ask for a fresh one.",
    });
  }

  entry.attempts += 1;

  const candidate = hashCode(code, entry.salt);
  const matches =
    code.length === 6 && crypto.timingSafeEqual(candidate, entry.hash);

  if (!matches) {
    return sendJson(res, 401, {
      ok: false,
      reason: "invalid_code",
      remainingAttempts: Math.max(0, MAX_ATTEMPTS - entry.attempts),
      message: "That code is not right. Check the email and try again.",
    });
  }

  // One sign-in per code.
  codes.delete(email);

  const account = {
    name: "",
    email,
    createdAt: now,
    guest: false,
    token: issueSession(email),
  };

  console.log(`[otp] signed in ${email}`);
  return sendJson(res, 200, { ok: true, account });
}

function handleEmailPreview(req, res) {
  if (!delivery.configured && !delivery.debug) {
    return sendJson(res, 503, {
      ok: false,
      reason: "unconfigured",
      message: "Configure a provider, or set OTP_DEBUG=1, to preview the email.",
    });
  }

  const html = renderHtml({
    code: "428913",
    expiresMinutes: CODE_TTL_MINUTES,
    requestedAt: new Date(),
  });

  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(html);
}

/* ============================================================
   Static files
   ============================================================ */

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".zip": "application/zip",
  ".txt": "text/plain; charset=utf-8",
};

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; " +
    "script-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'",
};

function serveStatic(req, res, urlPath) {
  const relative = decodeURIComponent(urlPath).replace(/^\/+/, "");
  const target = path.join(ROOT, relative === "" ? "index.html" : relative);

  // Never hand out the environment file or anything above the site root.
  const inside = target === ROOT || target.startsWith(ROOT + path.sep);
  const segments = relative.split("/");
  if (!inside || segments.some((part) => part.startsWith(".")) || relative.startsWith("server")) {
    return notFound(res);
  }

  fs.stat(target, (error, stats) => {
    if (error || !stats.isFile()) return notFound(res);

    const ext = path.extname(target).toLowerCase();
    const headers = Object.assign({}, SECURITY_HEADERS, {
      "Content-Type": TYPES[ext] || "application/octet-stream",
      "Content-Length": stats.size,
      // Pages revalidate; assets can sit in the cache for a while.
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
    });

    res.writeHead(200, headers);
    fs.createReadStream(target).pipe(res);
  });
}

function notFound(res) {
  fs.readFile(path.join(ROOT, "404.html"), (error, page) => {
    const body = error
      ? "<!doctype html><meta charset='utf-8'><title>Not found</title><p>Not found.</p>"
      : page;
    res.writeHead(404, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": Buffer.byteLength(body),
    });
    res.end(body);
  });
}

/* ============================================================
   Server
   ============================================================ */

/* The two flag modes answer a question and stop; only a plain run serves. */
let serving = true;

if (process.argv.includes("--check")) {
  printReport();
  process.exit(delivery.configured || delivery.debug ? 0 : 1);
} else if (process.argv.includes("--send-test")) {
  const address = process.argv[process.argv.indexOf("--send-test") + 1];
  if (!address) {
    console.error("Usage: node server.js --send-test you@example.com");
    process.exit(1);
  }
  serving = false;
  sendTest(address);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const route = url.pathname;
  const started = Date.now();

  res.on("finish", () => {
    console.log(`${req.method} ${route} → ${res.statusCode} (${Date.now() - started}ms)`);
  });

  try {
    if (route === "/api/config" && req.method === "GET") return await handleConfig(req, res);
    if (route === "/api/otp/request" && req.method === "POST") return await handleRequest(req, res);
    if (route === "/api/otp/verify" && req.method === "POST") return await handleVerify(req, res);
    if (route === "/api/otp/email-preview" && req.method === "GET") return handleEmailPreview(req, res);

    if (route.startsWith("/api/")) {
      return sendJson(res, 404, { ok: false, reason: "no_route" });
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      return sendJson(res, 405, { ok: false, reason: "method_not_allowed" });
    }

    return serveStatic(req, res, route);
  } catch (error) {
    if (error.message === "bad_json" || error.message === "too_large") {
      return sendJson(res, 400, { ok: false, reason: error.message });
    }
    console.error(`[error] ${route}: ${error.stack || error.message}`);
    return sendJson(res, 500, { ok: false, reason: "server_error" });
  }
});

if (serving) server.listen(PORT, HOST, () => {
  console.log(`Glass site on http://${HOST}:${PORT}`);
  console.log(
    delivery.configured
      ? `Sign-in email: ${delivery.provider} from ${delivery.from}`
      : delivery.debug
        ? "Sign-in email: not configured — OTP_DEBUG=1 shows the code on screen"
        : "Sign-in email: not configured — add RESEND_API_KEY or BREVO_API_KEY to .env",
  );
});

["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => {
    console.log("\nStopping.");
    server.close(() => process.exit(0));
  });
});
