/* The suite, authored as content — the same rows as src/convex/catalog.ts.
   Keeping it here means browse, search and the cart all work the moment the
   page opens, with no server in front of it. */

window.GLASS_PRODUCTS = [
  {
    slug: "glass-tweaks",
    name: "Glass Tweaks",
    tagline: "Fine control over the glass surfaces of your desktop.",
    description:
      "Adjust transparency, blur radius, corner geometry and tint across every window, then save the result as a preset you can switch between. Changes apply live, so you can see what you are doing instead of guessing at it.",
    priceCents: 1500,
    currency: "usd",
    status: "in-development",
    statusLabel: "In development",
    platforms: ["macOS", "Windows"],
    form: "tweaks",
    licence: "Lifetime licence, one seat",
    seats: 500,
    highlights: ["Live preview", "Saved presets", "Per-app rules"],
    requirements: "macOS 13 or later, or Windows 11",
    releaseNote:
      "The core controls are finished and in daily use. Preset sharing is still being built.",
    sortOrder: 1,
    tags: ["appearance", "customisation", "desktop", "premium"],
  },
  {
    slug: "glass-startup",
    name: "Glass Startup",
    tagline: "See exactly what launches with your machine.",
    description:
      "One list of everything that starts with your computer — apps, helpers and background services — with the time each one adds to boot. Disable, delay or group items and watch the timeline settle. Names are written the way a person would say them, not the way a daemon reports them.",
    priceCents: 0,
    currency: "usd",
    status: "in-development",
    statusLabel: "In development",
    platforms: ["macOS", "Windows"],
    form: "startup",
    licence: "Free, one seat",
    seats: 500,
    highlights: ["Boot timeline", "Delay and group", "Plain-language names"],
    requirements: "macOS 13 or later, or Windows 11",
    releaseNote:
      "Detection and the boot timeline are complete. Grouping arrives in the next build.",
    sortOrder: 2,
    tags: ["performance", "boot", "desktop", "free"],
  },
  {
    slug: "glass-vm",
    name: "Glass VM",
    tagline: "Local virtual machines, with nothing hidden.",
    description:
      "Run Linux and Windows images on your own hardware and watch CPU, memory, disk and network per machine in one calm panel. Snapshots are a single click, and nothing is uploaded anywhere.",
    priceCents: 3000,
    currency: "usd",
    status: "in-development",
    statusLabel: "In development",
    platforms: ["macOS"],
    form: "vm",
    licence: "Lifetime licence, one seat",
    seats: 300,
    highlights: ["Instant snapshots", "Live metrics", "Offline by default"],
    requirements:
      "Apple silicon, or an Intel Mac with virtualisation enabled",
    releaseNote:
      "Linux guests are stable. Windows guests are still in testing.",
    sortOrder: 3,
    tags: ["virtualisation", "development", "snapshots"],
  },
  {
    slug: "glass-client",
    name: "Glass Client",
    tagline: "A quieter way to run Minecraft.",
    description:
      "A companion client for Minecraft that keeps versions, mods and shaders in one calm panel. Launch times, memory and frame pacing are shown as measured numbers, and nothing is installed behind your back.",
    priceCents: 0,
    currency: "usd",
    status: "in-development",
    statusLabel: "In development",
    platforms: ["macOS", "Windows"],
    form: "client",
    licence: "Free, one seat",
    seats: 500,
    highlights: [
      "Version and mod profiles",
      "Shaders without the fuss",
      "Measured frame pacing",
    ],
    requirements:
      "Minecraft: Java Edition 1.21 or later, on macOS 13+ or Windows 11",
    releaseNote:
      "The launcher and profile handling are working. The in-game overlay comes next.",
    sortOrder: 4,
    tags: ["minecraft", "gaming", "performance", "free"],
  },
];
