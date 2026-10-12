/* Glass — the shared runtime.

   One classic script, no bundler and no imports, that every page pulls in with
   a plain <script src>. It owns the header, the cart drawer, the shop state
   kept in localStorage, the icon set and the little glass objects the suite is
   drawn with. Page scripts only render the middle of the page. */

(function () {
  "use strict";

  var PRODUCTS = window.GLASS_PRODUCTS || [];
  var MAX_SEATS = 10;

  /* ============================================================
     Storage
     A file:// page or a private window can refuse localStorage, so every
     read and write is guarded and falls back to memory for the session.
     ============================================================ */

  var memory = {};

  var store = {
    get: function (key, fallback) {
      try {
        var raw = window.localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (error) {
        return key in memory ? memory[key] : fallback;
      }
    },
    set: function (key, value) {
      memory[key] = value;
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        /* memory copy stands in for the session */
      }
    },
    remove: function (key) {
      delete memory[key];
      try {
        window.localStorage.removeItem(key);
      } catch (error) {
        /* nothing to clean up */
      }
    },
  };

  /* ============================================================
     Formatting — the same rules as src/lib/format.ts
     ============================================================ */

  function formatPrice(cents, currency) {
    var whole = cents % 100 === 0;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  }

  function formatPriceLabel(cents, currency) {
    return cents === 0 ? "Free" : formatPrice(cents, currency);
  }

  function formatOrderDate(timestamp) {
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(timestamp));
  }

  function formatMemberSince(timestamp) {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(new Date(timestamp));
  }

  function pluralize(count, singular, plural) {
    return count === 1 ? singular : plural || singular + "s";
  }

  /* ============================================================
     Icons — 24px stroke glyphs, the lucide set the app uses.
     ============================================================ */

  var ICONS = {
    layers: [
      "m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z",
      "m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65",
      "m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65",
    ],
    bag: [
      "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z",
      "M3 6h18",
      "M16 10a4 4 0 0 1-8 0",
    ],
    moon: ["M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"],
    sun: [
      "<circle cx='12' cy='12' r='4'/>",
      "M12 2v2",
      "M12 20v2",
      "m4.93 4.93 1.41 1.41",
      "m17.66 17.66 1.41 1.41",
      "M2 12h2",
      "M20 12h2",
      "m6.34 17.66-1.41 1.41",
      "m19.07 4.93-1.41 1.41",
    ],
    search: ["<circle cx='11' cy='11' r='8'/>", "m21 21-4.3-4.3"],
    x: ["M18 6 6 18", "m6 6 12 12"],
    plus: ["M5 12h14", "M12 5v14"],
    minus: ["M5 12h14"],
    trash: [
      "M3 6h18",
      "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",
      "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
      "M10 11v6",
      "M14 11v6",
    ],
    check: ["M20 6 9 17l-5-5"],
    "arrow-right": ["M5 12h14", "m12 5 7 7-7 7"],
    "arrow-left": ["m12 19-7-7 7-7", "M19 12H5"],
    download: [
      "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",
      "m7 10 5 5 5-5",
      "M12 15V3",
    ],
    lock: [
      "<rect x='3' y='11' width='18' height='11' rx='2'/>",
      "M7 11V7a5 5 0 0 1 10 0v4",
    ],
    alert: ["<circle cx='12' cy='12' r='10'/>", "M12 8v4", "M12 16h.01"],
    package: [
      "m7.5 4.27 9 5.15",
      "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",
      "m3.3 7 8.7 5 8.7-5",
      "M12 22V12",
    ],
    "log-out": [
      "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",
      "m16 17 5-5-5-5",
      "M21 12H9",
    ],
    "user-x": [
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
      "<circle cx='9' cy='7' r='4'/>",
      "m17 8 5 5",
      "m22 8-5 5",
    ],
  };

  function icon(name, size, strokeWidth) {
    var paths = ICONS[name] || [];
    var body = paths
      .map(function (path) {
        return path.charAt(0) === "<" ? path : "<path d='" + path + "'/>";
      })
      .join("");
    return (
      "<svg viewBox='0 0 24 24' width='" +
      (size || 16) +
      "' height='" +
      (size || 16) +
      "' fill='none' stroke='currentColor' stroke-width='" +
      (strokeWidth || 1.5) +
      "' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>" +
      body +
      "</svg>"
    );
  }

  /* ============================================================
     Glass objects
     Each app is drawn as a translucent interface panel rather than
     photographed, so the suite stays weightless. Shapes are keyed by the
     product's `form` and everything lives in a 120 x 160 box.
     ============================================================ */

  var SHAPES = {
    tweaks: {
      rects: [
        [14, 30, 92, 100, 14],
        [30, 54, 60, 5, 2.5],
        [30, 78, 60, 5, 2.5],
        [30, 102, 60, 5, 2.5],
      ],
      circles: [
        [50, 56.5, 7],
        [76, 80.5, 7],
        [46, 104.5, 7],
      ],
      highlights: ["M25 44 Q23 80 25 116"],
    },
    startup: {
      rects: [
        [14, 30, 92, 100, 14],
        [30, 48, 60, 9, 4.5],
        [30, 65, 44, 9, 4.5],
        [30, 82, 68, 9, 4.5],
        [30, 99, 52, 9, 4.5],
        [30, 116, 36, 9, 4.5],
      ],
      highlights: ["M25 44 Q23 80 25 116"],
    },
    client: {
      rects: [
        [14, 30, 92, 100, 14],
        [26, 42, 68, 46, 9],
        [26, 98, 44, 8, 4],
        [26, 112, 30, 8, 4],
      ],
      polys: ["50,58 50,72 64,65"],
      highlights: ["M25 44 Q23 80 25 116"],
    },
    vm: {
      rects: [
        [14, 30, 92, 100, 14],
        [26, 42, 26, 76, 9],
        [58, 42, 38, 44, 9],
        [64, 54, 26, 5, 2.5],
        [64, 66, 18, 5, 2.5],
        [58, 92, 38, 5, 2.5],
        [58, 103, 26, 5, 2.5],
      ],
      circles: [
        [33, 52, 3.5],
        [33, 64, 3.5],
        [33, 76, 3.5],
      ],
      highlights: ["M25 44 Q23 80 25 116"],
    },
  };

  var objectSeq = 0;

  function glassObject(form, options) {
    var settings = options || {};
    var shape = SHAPES[form] || SHAPES.tweaks;
    var bodyId = "glass-body-" + ++objectSeq;

    var panels = (shape.rects || [])
      .map(function (r) {
        return (
          "<rect x='" + r[0] + "' y='" + r[1] + "' width='" + r[2] +
          "' height='" + r[3] + "' rx='" + r[4] + "'/>"
        );
      })
      .join("");

    var dots = (shape.circles || [])
      .map(function (c) {
        return "<circle cx='" + c[0] + "' cy='" + c[1] + "' r='" + c[2] + "'/>";
      })
      .join("");

    var polys = (shape.polys || [])
      .map(function (points) {
        return "<polygon points='" + points + "'/>";
      })
      .join("");

    var streaks = (shape.highlights || [])
      .map(function (d) {
        return "<path d='" + d + "'/>";
      })
      .join("");

    return (
      "<svg viewBox='0 0 120 160' role='img' aria-label='" +
      escapeAttr(settings.label || form) +
      "' class='" +
      (settings.className || "") +
      "'>" +
      "<defs><linearGradient id='" + bodyId + "' x1='0' y1='0' x2='0.3' y2='1'>" +
      "<stop offset='0%' stop-color='#ffffff' stop-opacity='0.92'/>" +
      "<stop offset='42%' stop-color='#ffffff' stop-opacity='0.38'/>" +
      "<stop offset='74%' stop-color='#60a5fa' stop-opacity='0.20'/>" +
      "<stop offset='100%' stop-color='#ffffff' stop-opacity='0.55'/>" +
      "</linearGradient></defs>" +
      "<g fill='url(#" + bodyId + ")' stroke='currentColor' stroke-opacity='0.18' stroke-width='1.25'>" +
      panels + dots + polys +
      "</g>" +
      "<g fill='none' stroke='#ffffff' stroke-opacity='0.6' stroke-width='2.5' stroke-linecap='round'>" +
      streaks +
      "</g></svg>"
    );
  }

  function escapeAttr(value) {
    return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  /* ============================================================
     Catalog
     ============================================================ */

  function findProduct(slug) {
    for (var i = 0; i < PRODUCTS.length; i++) {
      if (PRODUCTS[i].slug === slug) return PRODUCTS[i];
    }
    return null;
  }

  var PLATFORMS = (function () {
    var seen = {};
    PRODUCTS.forEach(function (item) {
      item.platforms.forEach(function (platform) {
        seen[platform] = true;
      });
    });
    return Object.keys(seen).sort();
  })();

  var SORT_LABELS = {
    default: "Default",
    "price-asc": "Price, low to high",
    "price-desc": "Price, high to low",
    name: "Name",
  };

  function searchText(item) {
    return [item.name, item.tagline, item.description]
      .concat(item.platforms, [item.licence], item.highlights, item.tags)
      .join(" ")
      .toLowerCase();
  }

  function list(options) {
    var settings = options || {};
    var q = (settings.q || "").trim().toLowerCase();
    var platform = settings.platform && settings.platform !== "All" ? settings.platform : null;
    var terms = q.split(/\s+/).filter(Boolean);

    var filtered = PRODUCTS.filter(function (item) {
      if (platform && item.platforms.indexOf(platform) === -1) return false;
      if (!terms.length) return true;
      var haystack = searchText(item);
      return terms.every(function (term) {
        return haystack.indexOf(term) !== -1;
      });
    });

    var sort = settings.sort || "default";
    var sorted = filtered.slice().sort(function (a, b) {
      if (sort === "price-asc") return a.priceCents - b.priceCents;
      if (sort === "price-desc") return b.priceCents - a.priceCents;
      if (sort === "name") return a.name.localeCompare(b.name);
      return a.sortOrder - b.sortOrder;
    });

    return {
      items: sorted,
      platforms: ["All"].concat(PLATFORMS),
      total: PRODUCTS.length,
      currency: "usd",
    };
  }

  /* ============================================================
     Session — an account that lives in this browser.
     ============================================================ */

  var SESSION_KEY = "glass-session";

  function session() {
    return store.get(SESSION_KEY, null);
  }

  function signInEmail(email) {
    var account = {
      name: "",
      email: email,
      createdAt: Date.now(),
      guest: false,
    };
    store.set(SESSION_KEY, account);
    return account;
  }

  function signInGuest() {
    var account = {
      name: "",
      email: "",
      createdAt: Date.now(),
      guest: true,
    };
    store.set(SESSION_KEY, account);
    return account;
  }

  function updateName(name) {
    var account = session();
    if (!account) return null;
    account.name = name;
    store.set(SESSION_KEY, account);
    return account;
  }

  function signOut() {
    store.remove(SESSION_KEY);
  }

  /* ============================================================
     Cart and orders
     ============================================================ */

  var CART_KEY = "glass-cart";
  var ORDERS_KEY = "glass-orders";

  function rawLines() {
    var lines = store.get(CART_KEY, []);
    return Array.isArray(lines) ? lines : [];
  }

  function cart() {
    var lines = rawLines()
      .map(function (line) {
        var product = findProduct(line.slug);
        if (!product) return null;
        var quantity = Math.max(1, Math.min(MAX_SEATS, line.quantity));
        return {
          slug: product.slug,
          name: product.name,
          form: product.form,
          statusLabel: product.statusLabel,
          currency: product.currency,
          seats: product.seats,
          quantity: quantity,
          unitPriceCents: product.priceCents,
          lineTotalCents: product.priceCents * quantity,
        };
      })
      .filter(Boolean);

    return {
      lines: lines,
      itemCount: lines.reduce(function (total, line) {
        return total + line.quantity;
      }, 0),
      totalCents: lines.reduce(function (total, line) {
        return total + line.lineTotalCents;
      }, 0),
      currency: "usd",
    };
  }

  function setQuantity(slug, quantity) {
    var product = findProduct(slug);
    var ceiling = Math.min(MAX_SEATS, product ? product.seats : MAX_SEATS);
    var lines = rawLines().filter(function (line) {
      return line.slug !== slug;
    });
    if (quantity >= 1) {
      lines.push({ slug: slug, quantity: Math.min(quantity, ceiling) });
    }
    store.set(CART_KEY, lines);
    return cart();
  }

  function addToCart(slug, quantity) {
    var existing = rawLines().filter(function (line) {
      return line.slug === slug;
    })[0];
    var current = existing ? existing.quantity : 0;
    return setQuantity(slug, current + (quantity || 1));
  }

  function removeFromCart(slug) {
    store.set(
      CART_KEY,
      rawLines().filter(function (line) {
        return line.slug !== slug;
      }),
    );
    return cart();
  }

  function clearCart() {
    store.set(CART_KEY, []);
  }

  function orders() {
    var list2 = store.get(ORDERS_KEY, []);
    return Array.isArray(list2) ? list2 : [];
  }

  function placeOrder(details) {
    var current = cart();
    var order = {
      id:
        "ord" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      createdAt: Date.now(),
      status: "pending",
      items: current.lines.map(function (line) {
        return {
          slug: line.slug,
          name: line.name,
          quantity: line.quantity,
          lineTotalCents: line.lineTotalCents,
        };
      }),
      totalCents: current.totalCents,
      currency: current.currency,
      customerName: details.customerName,
      company: details.company || "",
      note: details.note || "",
    };
    store.set(ORDERS_KEY, [order].concat(orders()));
    clearCart();
    return order;
  }

  function findOrder(id) {
    var all = orders();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) return all[i];
    }
    return null;
  }

  /* ============================================================
     Toast
     ============================================================ */

  var toastTimer = null;

  function toast(message) {
    var node = document.querySelector(".toast");
    if (!node) {
      node = document.createElement("div");
      node.className = "toast glass glass-rim";
      node.setAttribute("role", "status");
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.classList.add("is-in");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      node.classList.remove("is-in");
    }, 2600);
  }

  /* ============================================================
     Theme
     ============================================================ */

  function isDark() {
    return document.documentElement.classList.contains("dark");
  }

  function setTheme(theme) {
    var dark = theme !== "light";
    document.documentElement.classList.toggle("dark", dark);
    store.set("glass-theme", dark ? "dark" : "light");
    renderHeader();
  }

  function toggleTheme() {
    setTheme(isDark() ? "light" : "dark");
  }

  /* ============================================================
     Header, account menu and cart drawer
     ============================================================ */

  var HEADER_HTML = "";

  function headerMarkup() {
    var account = session();
    var count = cart().itemCount;
    var dark = isDark();

    var links = [
      ["The suite", "catalog.html"],
      ["How we build", "index.html#craft"],
      ["Contact", "index.html#contact"],
    ]
      .map(function (link) {
        return '<a class="nav__link" href="' + link[1] + '">' + link[0] + "</a>";
      })
      .join("");

    var accountActions = account
      ? "" +
        '<div class="menu-wrap">' +
        '<button type="button" class="btn btn--ghost btn--sm" data-menu-trigger aria-haspopup="menu" aria-expanded="false">' +
        '<span class="avatar">' + initialOf(account) + "</span>" +
        '<span class="only-sm">Account</span>' +
        "</button>" +
        '<div class="menu glass glass-rim" data-menu role="menu">' +
        '<div class="menu__label">' +
        '<span class="menu__name">' + escapeHtml(account.name || "Guest session") + "</span>" +
        '<span class="menu__email">' + escapeHtml(account.email || "No email on this account") + "</span>" +
        "</div>" +
        '<div class="menu__sep"></div>' +
        '<a class="menu__item" role="menuitem" href="account.html">Your account</a>' +
        '<a class="menu__item" role="menuitem" href="catalog.html">The suite</a>' +
        '<div class="menu__sep"></div>' +
        '<button type="button" class="menu__item menu__item--danger" role="menuitem" data-sign-out>' +
        icon("log-out", 16) + "Sign out</button>" +
        "</div>" +
        "</div>"
      : "" +
        '<a class="btn btn--ghost btn--sm only-sm" href="signin.html?returnTo=account.html">Sign in</a>' +
        '<a class="btn btn--primary btn--sm" href="catalog.html">Reserve access</a>';

    return (
      '<header class="site-header">' +
      '<nav class="nav glass glass-rim">' +
      '<a class="brand" href="index.html">' +
      '<span class="brand__mark">' + icon("layers", 14, 1.25) + "</span>" +
      '<span class="brand__word">Glass</span>' +
      "</a>" +
      '<div class="nav__links">' + links + "</div>" +
      '<div class="nav__actions">' +
      '<button type="button" class="btn btn--ghost btn--icon" data-theme-toggle ' +
      'aria-label="' + (dark ? "Use the light theme" : "Use the dark theme") + '" ' +
      'title="' + (dark ? "Use the light theme" : "Use the dark theme") + '">' +
      icon(dark ? "moon" : "sun", 16) +
      "</button>" +
      '<button type="button" class="btn btn--ghost btn--sm" data-cart-open aria-label="Cart">' +
      icon("bag", 16) +
      '<span class="only-sm">Cart</span>' +
      (count > 0 ? '<span class="cart-count">' + count + "</span>" : "") +
      "</button>" +
      accountActions +
      "</div>" +
      "</nav>" +
      "</header>"
    );
  }

  function drawerMarkup() {
    return (
      '<div class="drawer" id="cart-drawer" aria-hidden="true">' +
      '<div class="drawer__scrim" data-cart-close></div>' +
      '<aside class="drawer__panel" role="dialog" aria-modal="true" aria-label="Your cart">' +
      '<div class="drawer__head">' +
      '<h2 class="drawer__title">Your cart</h2>' +
      '<p class="drawer__sub" data-drawer-sub></p>' +
      "</div>" +
      '<div class="drawer__body" data-drawer-body></div>' +
      '<div class="drawer__foot" data-drawer-foot></div>' +
      "</aside>" +
      "</div>"
    );
  }

  function initialOf(account) {
    var source = (account.name || account.email || "G").trim();
    return escapeHtml(source.charAt(0).toUpperCase() || "G");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ensureDrawer() {
    if (document.getElementById("cart-drawer")) return;
    var holder = document.createElement("div");
    holder.innerHTML = drawerMarkup();
    document.body.appendChild(holder.firstChild);
  }

  function renderHeader() {
    // The first render swaps the placeholder for the real header, so every
    // later render has to find that header rather than the placeholder.
    var mount = document.querySelector("[data-header], .site-header");
    if (!mount) return;
    var open = document.querySelector("[data-menu].is-open");
    mount.outerHTML = headerMarkup();
    if (open) {
      var menu = document.querySelector("[data-menu]");
      var trigger = document.querySelector("[data-menu-trigger]");
      if (menu) menu.classList.add("is-open");
      if (trigger) trigger.setAttribute("aria-expanded", "true");
    }
    ensureDrawer();
    renderDrawer();
  }

  function drawerLine(line) {
    return (
      '<li class="line">' +
      '<a class="line__thumb" href="product.html?slug=' + line.slug + '" data-cart-close>' +
      glassObject(line.form, { className: "", label: line.name }) +
      "</a>" +
      '<div class="line__body">' +
      '<div class="line__top">' +
      "<div>" +
      '<a class="line__name" href="product.html?slug=' + line.slug + '" data-cart-close>' +
      escapeHtml(line.name) + "</a>" +
      '<p class="line__meta">' + formatPrice(line.unitPriceCents, line.currency) + " per seat</p>" +
      "</div>" +
      '<p class="line__total">' + formatPrice(line.lineTotalCents, line.currency) + "</p>" +
      "</div>" +
      '<div class="line__controls">' +
      '<button type="button" class="qty__btn" aria-label="Reserve one fewer seat of ' +
      escapeHtml(line.name) + '" data-line-minus="' + line.slug + '"' +
      (line.quantity <= 1 ? " disabled" : "") + ">" + icon("minus", 12) + "</button>" +
      '<span class="qty__value">' + line.quantity + "</span>" +
      '<button type="button" class="qty__btn" aria-label="Reserve another seat of ' +
      escapeHtml(line.name) + '" data-line-plus="' + line.slug + '"' +
      (line.quantity >= Math.min(MAX_SEATS, line.seats) ? " disabled" : "") + ">" +
      icon("plus", 12) + "</button>" +
      '<button type="button" class="qty__btn qty__btn--danger" aria-label="Remove ' +
      escapeHtml(line.name) + '" data-line-remove="' + line.slug + '">' +
      icon("trash", 14) + "</button>" +
      "</div>" +
      "</div>" +
      "</li>"
    );
  }

  function renderDrawer() {
    var drawer = document.getElementById("cart-drawer");
    if (!drawer) return;

    var sub = drawer.querySelector("[data-drawer-sub]");
    var body = drawer.querySelector("[data-drawer-body]");
    var foot = drawer.querySelector("[data-drawer-foot]");
    var account = session();
    var state = cart();

    if (!account) {
      sub.textContent = "Seats you reserve will be held here.";
      body.innerHTML =
        '<div class="empty">' +
        '<div class="empty__icon">' + icon("bag", 20, 1.25) + "</div>" +
        "<div>" +
        '<p class="empty__title">Sign in to reserve a seat</p>' +
        '<p class="empty__body">Your cart is tied to your account, so it is still here when the next build ships.</p>' +
        "</div>" +
        '<a class="btn btn--primary" href="signin.html?returnTo=catalog.html">Sign in</a>' +
        "</div>";
      foot.innerHTML = "";
      return;
    }

    sub.textContent =
      state.itemCount > 0
        ? state.itemCount + " " + pluralize(state.itemCount, "seat") + " reserved at early-access pricing"
        : "Seats you reserve will be held here.";

    if (!state.lines.length) {
      body.innerHTML =
        '<div class="empty">' +
        '<div class="empty__icon">' + icon("bag", 20, 1.25) + "</div>" +
        "<div>" +
        '<p class="empty__title">Nothing here yet</p>' +
        '<p class="empty__body">Four apps, all in development. Early access is open.</p>' +
        "</div>" +
        '<a class="btn btn--outline" href="catalog.html" data-cart-close>See the suite</a>' +
        "</div>";
      foot.innerHTML = "";
      return;
    }

    body.innerHTML = '<ul style="padding:0;list-style:none">' + state.lines.map(drawerLine).join("") + "</ul>";
    foot.innerHTML =
      '<div class="summary__total" style="margin:0">' +
      "<span>Total</span>" +
      '<span class="tabular">' + formatPriceLabel(state.totalCents, state.currency) + "</span>" +
      "</div>" +
      '<p class="summary__note" style="margin-top:0.5rem">One payment, lifetime licence. No subscription.</p>' +
      '<a class="btn btn--primary btn--lg btn--block" style="margin-top:1.25rem" href="checkout.html" data-cart-close>Continue to checkout</a>';
  }

  function openDrawer() {
    var drawer = document.getElementById("cart-drawer");
    if (!drawer) return;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
  }

  function closeDrawer() {
    var drawer = document.getElementById("cart-drawer");
    if (!drawer) return;
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
  }

  /* ============================================================
     Wiring
     ============================================================ */

  function addToCartFromPage(slug, name, quantity) {
    if (!session()) {
      var returnTo = window.location.pathname.split("/").pop() + window.location.search;
      window.location.href = "signin.html?returnTo=" + encodeURIComponent(returnTo || "catalog.html");
      return;
    }
    addToCart(slug, quantity || 1);
    toast(name ? name + " added to your cart" : "Added to your cart");
    refresh();
    openDrawer();
  }

  function revealAll(root) {
    var targets = (root || document).querySelectorAll(".reveal:not(.is-in)");
    if (!("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(targets, function (node) {
        node.classList.add("is-in");
      });
      return;
    }
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "-80px 0px -40px 0px" },
    );
    Array.prototype.forEach.call(targets, function (node) {
      observer.observe(node);
    });
  }

  function bindShell() {
    document.addEventListener("click", function (event) {
      var target = event.target.closest ? event.target : null;

      if (!target) return;

      var themeButton = target.closest("[data-theme-toggle]");
      if (themeButton) {
        toggleTheme();
        return;
      }

      var opener = target.closest("[data-cart-open]");
      if (opener) {
        renderDrawer();
        openDrawer();
        return;
      }

      if (target.closest("[data-cart-close]")) {
        closeDrawer();
        return;
      }

      var menuTrigger = target.closest("[data-menu-trigger]");
      if (menuTrigger) {
        var wrap = menuTrigger.closest(".menu-wrap");
        var menu = wrap.querySelector("[data-menu]");
        var open = menu.classList.toggle("is-open");
        menuTrigger.setAttribute("aria-expanded", open ? "true" : "false");
        return;
      }

      if (!target.closest("[data-menu]")) {
        Array.prototype.forEach.call(document.querySelectorAll("[data-menu].is-open"), function (node) {
          node.classList.remove("is-open");
        });
      }

      if (target.closest("[data-sign-out]")) {
        signOut();
        window.location.href = "index.html";
        return;
      }

      var plus = target.closest("[data-line-plus]");
      if (plus) {
        var slug = plus.getAttribute("data-line-plus");
        var line = cart().lines.filter(function (item) {
          return item.slug === slug;
        })[0];
        if (line) {
          setQuantity(slug, line.quantity + 1);
          refresh();
        }
        return;
      }

      var minus = target.closest("[data-line-minus]");
      if (minus) {
        var slugMinus = minus.getAttribute("data-line-minus");
        var count = cart().lines.filter(function (item) {
          return item.slug === slugMinus;
        })[0];
        if (count) {
          setQuantity(slugMinus, count.quantity - 1);
          refresh();
        }
        return;
      }

      var remove = target.closest("[data-line-remove]");
      if (remove) {
        removeFromCart(remove.getAttribute("data-line-remove"));
        refresh();
        return;
      }

      var add = target.closest("[data-add-to-cart]");
      if (add) {
        addToCartFromPage(
          add.getAttribute("data-add-to-cart"),
          add.getAttribute("data-add-name"),
          Number(add.getAttribute("data-add-quantity") || 1),
        );
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeDrawer();
        Array.prototype.forEach.call(document.querySelectorAll("[data-menu].is-open"), function (node) {
          node.classList.remove("is-open");
        });
      }
    });
  }

  /* Re-render the header count and the drawer, then let the page redraw itself. */
  function refresh() {
    renderHeader();
    renderDrawer();
    if (typeof window.glassOnCartChange === "function") {
      window.glassOnCartChange();
    }
  }

  function init() {
    var theme = store.get("glass-theme", null);
    document.documentElement.classList.toggle("dark", theme !== "light");
    ensureDrawer();
    renderHeader();
    bindShell();
    revealAll(document);
  }

  window.Glass = {
    MAX_SEATS: MAX_SEATS,
    PRODUCTS: PRODUCTS,
    PLATFORMS: PLATFORMS,
    SORT_LABELS: SORT_LABELS,
    list: list,
    findProduct: findProduct,
    formatPrice: formatPrice,
    formatPriceLabel: formatPriceLabel,
    formatOrderDate: formatOrderDate,
    formatMemberSince: formatMemberSince,
    pluralize: pluralize,
    icon: icon,
    glassObject: glassObject,
    escapeHtml: escapeHtml,
    session: session,
    signInEmail: signInEmail,
    signInGuest: signInGuest,
    updateName: updateName,
    signOut: signOut,
    cart: cart,
    addToCart: addToCart,
    setQuantity: setQuantity,
    removeFromCart: removeFromCart,
    clearCart: clearCart,
    orders: orders,
    placeOrder: placeOrder,
    findOrder: findOrder,
    toast: toast,
    refresh: refresh,
    renderHeader: renderHeader,
    renderDrawer: renderDrawer,
    openDrawer: openDrawer,
    closeDrawer: closeDrawer,
    revealAll: revealAll,
    store: store,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
