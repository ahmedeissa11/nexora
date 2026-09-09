const PRODUCTS = [
  {
    id: "one",
    name: "Aether One",
    category: "Audio",
    collection: "Listen",
    type: "Reference headphones",
    tag: "Flagship",
    price: 890,
    image: "images/one.jpg",
    meta: "Audio  ·  42 h  ·  312 g",
    blurb: "Closed-back planar headphones, tuned in a treated room. Memory-foam seals. Forty-two hours of unhurried listening.",
    specs: [
      ["Drivers", "40 mm planar magnetic"],
      ["Response", "8 Hz – 40 kHz"],
      ["Battery", "42 hours"],
      ["Weight", "312 g"],
      ["Connect", "Bluetooth 5.4 / USB-C"],
    ],
  },
  {
    id: "drift",
    name: "Aether Drift",
    category: "Audio",
    collection: "Listen",
    type: "Wireless earbuds",
    price: 280,
    image: "images/drift.jpg",
    meta: "Audio  ·  28 h  ·  Case 48 g",
    blurb: "A compact in-ear pair with a matte case that disappears in a pocket. Tuned for speech and night records alike.",
    specs: [
      ["Drivers", "11 mm dynamic"],
      ["Case battery", "28 hours total"],
      ["Seal", "Three silicone sizes"],
      ["Weight", "5.1 g each"],
      ["Connect", "Bluetooth 5.4"],
    ],
  },
  {
    id: "field",
    name: "Aether Field",
    category: "Audio",
    collection: "Listen",
    type: "Portable speaker",
    price: 520,
    image: "images/field.jpg",
    meta: "Audio  ·  18 h  ·  IP54",
    blurb: "A cylindrical field speaker with a fabric grille and a low, even throw. Made to sit at the edge of a table and be forgotten.",
    specs: [
      ["Output", "Stereo dual driver"],
      ["Battery", "18 hours"],
      ["Enclosure", "Aluminum / knit"],
      ["Weight", "780 g"],
      ["Connect", "Bluetooth 5.3 / Aux"],
    ],
  },
  {
    id: "halo",
    name: "Aether Halo",
    category: "Light",
    collection: "Illuminate",
    type: "Sculptural lamp",
    price: 640,
    image: "images/halo.jpg",
    meta: "Light  ·  2700–4000 K  ·  Dim",
    blurb: "An arched desk lamp in milled aluminum. The head is a thin ring. The light is a pool, not a beam.",
    specs: [
      ["Temperature", "2700–4000 K"],
      ["Control", "Touch dim on base"],
      ["Finish", "Graphite aluminum"],
      ["Height", "48 cm"],
      ["Power", "USB-C 20 W"],
    ],
  },
  {
    id: "meridian",
    name: "Aether Meridian",
    category: "Time",
    collection: "Keep time",
    type: "Automatic watch",
    price: 1180,
    image: "images/meridian.jpg",
    meta: "Time  ·  40 mm  ·  40 h reserve",
    blurb: "A 40 mm automatic with a dark dial and no numerals. The strap is unsealed leather. It is meant to mark hours, not announce them.",
    specs: [
      ["Case", "40 mm DLC steel"],
      ["Movement", "Automatic, 40 h"],
      ["Crystal", "Sapphire, AR"],
      ["Water", "50 m"],
      ["Strap", "Vegetable-tanned leather"],
    ],
  },
  {
    id: "type",
    name: "Aether Type",
    category: "Desk",
    collection: "The desk",
    type: "Compact keyboard",
    price: 390,
    image: "images/type.jpg",
    meta: "Desk  ·  75%  ·  Hot-swap",
    blurb: "A low-profile 75% board in dark aluminum. Switches are chosen for a short, dry travel. No lights in the keys.",
    specs: [
      ["Layout", "75% compact"],
      ["Switches", "Tactile, hot-swap"],
      ["Plate", "Aluminum"],
      ["Cable", "Braided USB-C"],
      ["Weight", "890 g"],
    ],
  },
  {
    id: "vessel",
    name: "Aether Vessel",
    category: "Light",
    collection: "Illuminate",
    type: "Ceramic diffuser",
    price: 160,
    image: "images/vessel.jpg",
    meta: "Light  ·  Ceramic  ·  8 h",
    blurb: "A dark-fired ceramic vessel for quiet scent. The mist is slow. The form is a bottle that never needed a label.",
    specs: [
      ["Body", "Stoneware, matte"],
      ["Run time", "8 hours"],
      ["Capacity", "120 ml"],
      ["Power", "USB-C"],
      ["Care", "Rinse, air dry"],
    ],
  },
  {
    id: "arc",
    name: "Aether Arc",
    category: "Desk",
    collection: "The desk",
    type: "Desktop microphone",
    price: 440,
    image: "images/arc.jpg",
    meta: "Desk  ·  Cardioid  ·  USB-C",
    blurb: "A compact condenser on a small stand. Voiced for speech at a desk, with a grille that does not catch the light.",
    specs: [
      ["Pattern", "Cardioid condenser"],
      ["Sample", "24-bit / 48 kHz"],
      ["Connect", "USB-C"],
      ["Stand", "Integrated, weighted"],
      ["Finish", "Matte black metal"],
    ],
  },
];

PRODUCTS.forEach((p) => {
  const extra = {
    one: { rating: 4.9, reviews: 428, stock: 14 },
    drift: { rating: 4.7, reviews: 312, stock: 40 },
    field: { rating: 4.6, reviews: 198, stock: 18 },
    halo: { rating: 4.8, reviews: 87, stock: 11 },
    meridian: { rating: 4.9, reviews: 64, stock: 6 },
    type: { rating: 4.7, reviews: 221, stock: 15 },
    vessel: { rating: 4.5, reviews: 143, stock: 29 },
    arc: { rating: 4.6, reviews: 102, stock: 12 },
  }[p.id];
  if (extra) Object.assign(p, extra);
});
if (typeof CATALOG !== "undefined") PRODUCTS.push(...CATALOG);

const FINISHES = [
  { id: "graphite", name: "Graphite", color: "#6b717c" },
  { id: "midnight", name: "Midnight", color: "#1c1f27" },
  { id: "oxide", name: "Oxide", color: "#5c534c" },
];

const COLLECTIONS = [
  { id: "Headphones", category: "Headphones", categories: ["Headphones", "Audio"], title: "Headphones", note: "Reference, wireless, and open-back.", image: "images/one.jpg" },
  { id: "Smart Watches", category: "Smart Watches", categories: ["Smart Watches", "Time"], title: "Smart Watches", note: "Quiet instruments for the wrist.", image: "images/w-apex.jpg" },
  { id: "Keyboards", category: "Keyboards", categories: ["Keyboards", "Desk"], title: "Keyboards", note: "Mechanical boards for the desk.", image: "images/type.jpg" },
  { id: "Gaming Mice", category: "Mice", categories: ["Mice"], title: "Gaming Mice", note: "Light, matte, unhurried pointing.", image: "images/ms-gaming.jpg" },
  { id: "Speakers", category: "Speakers", categories: ["Speakers"], title: "Speakers", note: "Portable rooms of sound.", image: "images/sp-portable.jpg" },
  { id: "Sneakers", category: "Sneakers", categories: ["Sneakers"], title: "Sneakers", note: "Dark footwear for road and city.", image: "images/sn-runner-x.jpg" },
  { id: "Accessories", category: "Accessories", categories: ["Accessories", "Light"], title: "Accessories", note: "Charging, tracking, the small tools.", image: "images/ac-dock.jpg" },
];

const DROP_IDS = ["one", "nova-pro-wireless", "phantom-anc", "orbit-watch", "apex-smart-watch", "type"];
const DROP_END = Date.now() + (4 * 3600 + 12 * 60 + 36) * 1000;
const SEARCH_POPULAR = ["Headphones", "Smart Watches", "Keyboards", "Nova Pro", "Apex"];
const AURA_BY_CAT = {
  Audio: "aura-blue-violet",
  Headphones: "aura-blue-violet",
  Speakers: "aura-cyan-violet",
  Time: "aura-violet-blue",
  "Smart Watches": "aura-violet-blue",
  Desk: "aura-blue-indigo",
  Keyboards: "aura-blue-indigo",
  Mice: "aura-blue",
  Light: "aura-indigo",
  Sneakers: "aura-violet-cyan",
  Accessories: "aura-indigo",
};

const ARTICLES = [
  {
    id: "rooms",
    date: "14 Aug 2026",
    kind: "Essay",
    title: "On listening in rooms that forget you",
    excerpt: "A treated room is not an absence of sound. It is a decision about what is allowed to remain.",
    body: [
      "Most rooms insist. They clap back, they brighten the high notes, they make a voice sound like it is standing in a kitchen. We began Nexora by sitting in rooms that did the opposite — rooms that forgot you were there.",
      "The One was voiced in such a room. Not to impress a measurement, but to make a record feel like it had been placed on the table, not thrown at the wall. Planar drivers helped. Silence in the seal helped more.",
      "If an instrument is doing its work, you stop naming it. That is the only test we keep.",
    ],
  },
  {
    id: "graphite",
    date: "02 Jul 2026",
    kind: "Materials",
    title: "Graphite, oxide, and the refusal of shine",
    excerpt: "Three finishes. No seasonal colours. A small argument against objects that perform their newness.",
    body: [
      "Shine is a kind of shouting. It photographs well and ages badly. We mill aluminum and leave it graphite. We darken steel until it reads as shadow. Oxide is the warmest of the three — a brown that is almost not a colour.",
      "Midnight is not black. Black on a screen is a void. Midnight still has a temperature. Hold it near a window and it will admit a little blue.",
      "We will not add a fourth finish because a calendar asked us to.",
    ],
  },
];

const FOOTER_HTML = `
  <div class="foot-brand">
    <div class="brand-foot">
      <svg class="mark" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.25"/>
        <circle cx="12" cy="12" r="2.15" fill="currentColor"/>
        <path d="M3.2 12h17.6" fill="none" stroke="currentColor" stroke-width="1" opacity="0.45"/>
      </svg>
      <span>NEXORA</span>
    </div>
    <p class="lede">Technology, curated for those who appreciate quality, design and performance.</p>
    <p class="foot-place">Lisbon · Est. 2019</p>
  </div>
  <div>
    <h4>Shop</h4>
    <ul>
      <li><a href="#/shop">All products</a></li>
      <li><a href="#/arrivals">Arrivals</a></li>
      <li><a href="#/deals">Deals</a></li>
      <li><a href="#/compare">Compare</a></li>
    </ul>
  </div>
  <div>
    <h4>Categories</h4>
    <ul class="foot-cats">
      <li><a href="#/shop?cat=Headphones">Headphones</a></li>
      <li><a href="#/shop?cat=Smart Watches">Watches</a></li>
      <li><a href="#/shop?cat=Keyboards">Keyboards</a></li>
      <li><a href="#/shop?cat=Mice">Mice</a></li>
      <li><a href="#/shop?cat=Speakers">Speakers</a></li>
      <li><a href="#/shop?cat=Sneakers">Sneakers</a></li>
      <li><a href="#/shop?cat=Accessories">Accessories</a></li>
    </ul>
  </div>
  <div class="foot-mail">
    <h4>Stay updated</h4>
    <p class="lede">Drops and arrivals. Four notes a year. Nothing else.</p>
    <form class="mail-row" data-newsletter>
      <input class="field" type="email" required placeholder="Email" aria-label="Email" />
      <button class="btn btn-primary btn-sm" type="submit">Subscribe</button>
    </form>
  </div>
  <div class="legal">
    <span>© 2026 Nexora</span>
    <span class="legal-links">
      <a href="#/atelier">About</a>
      <a href="#/atelier">Shipping</a>
      <a href="#/atelier">Returns</a>
      <a href="#/journal">Journal</a>
    </span>
  </div>
`;

const CAT_CHIPS = [
  { id: "All", label: "All" },
  { id: "Headphones", label: "Headphones" },
  { id: "Smart Watches", label: "Watches" },
  { id: "Keyboards", label: "Keyboards" },
  { id: "Mice", label: "Mice" },
  { id: "Speakers", label: "Speakers" },
  { id: "Sneakers", label: "Sneakers" },
  { id: "Accessories", label: "Accessories" },
];

const PRICE_FILTERS = [
  { id: "All", label: "Any price" },
  { id: "0-150", label: "Under $150" },
  { id: "150-300", label: "$150–300" },
  { id: "300-600", label: "$300–600" },
  { id: "600+", label: "Over $600" },
];

const state = {
  view: "home",
  filter: "All",
  price: "All",
  sort: "featured",
  query: "",
  page: 1,
  perPage: 12,
  product: null,
  qty: 1,
  finish: "graphite",
  cart: loadCart(),
  wishlist: loadWish(),
  recent: loadRecent(),
  compare: [],
  user: null,
  orders: [],
  selectedOrderId: null,
  dropEndsAt: DROP_END,
  dropIds: DROP_IDS.slice(),
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function h(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeSrc(src) {
  if (typeof src !== "string") return "images/_studio.jpg";
  const s = src.trim();
  if (!s || s.includes("..") || s.includes("\\") || /[:\s<>]/.test(s)) return "images/_studio.jpg";
  if (/^images\/[a-zA-Z0-9._/-]+$/.test(s)) return s;
  if (/^\/images\/[a-zA-Z0-9._/-]+$/.test(s)) return s.slice(1);
  return "images/_studio.jpg";
}

function readCartStore() {
  try {
    const raw = JSON.parse(localStorage.getItem("nexora-cart") || localStorage.getItem("aether-cart") || "[]");
    if (Array.isArray(raw)) return { owner: "guest", items: raw };
    if (raw && typeof raw === "object" && Array.isArray(raw.items)) {
      return { owner: typeof raw.owner === "string" ? raw.owner : "guest", items: raw.items };
    }
  } catch {
    /* ignore */
  }
  return { owner: "guest", items: [] };
}

function loadCart() {
  return readCartStore().items;
}

function loadWish() {
  try {
    return JSON.parse(localStorage.getItem("nexora-wish") || localStorage.getItem("aether-wish") || "[]");
  } catch {
    return [];
  }
}

function loadRecent() {
  try {
    return JSON.parse(localStorage.getItem("nexora-recent") || "[]");
  } catch {
    return [];
  }
}

function saveCart() {
  const owner = state.user && state.user.id ? state.user.id : "guest";
  localStorage.setItem("nexora-cart", JSON.stringify({ owner, items: state.cart || [] }));
}

function clearLocalCart() {
  state.cart = [];
  state.cartTotals = null;
  localStorage.setItem("nexora-cart", JSON.stringify({ owner: "guest", items: [] }));
}

function linesFromServer(data) {
  return (data.items || []).map((i) => ({
    id: i.product.id,
    qty: i.qty,
    finish: i.finish,
  }));
}

function applyServerCart(data) {
  if (!data) return;
  state.cart = linesFromServer(data);
  state.cartTotals = {
    subtotal: data.subtotal,
    shipping: data.shipping,
    total: data.total,
  };
  saveCart();
  renderCart();
}

async function syncCartFromApi() {
  if (typeof apiGet !== "function") return;
  try {
    let data = await apiGet("/api/cart");
    const serverEmpty = !data.items || !data.items.length;
    const local = Array.isArray(state.cart) ? state.cart : [];
    const stored = readCartStore();
    const currentOwner = state.user && state.user.id ? state.user.id : "guest";
    const localOwner = stored.owner || "guest";
    const previousUserCart = currentOwner === "guest" && localOwner !== "guest";
    if (previousUserCart) {
      applyServerCart(data);
      return;
    }
    const canMigrate =
      serverEmpty &&
      local.length &&
      typeof apiSend === "function" &&
      (localOwner === "guest" || localOwner === currentOwner);
    if (canMigrate) {
      for (let i = 0; i < local.length; i++) {
        const line = local[i];
        try {
          data = await apiSend("POST", "/api/cart", {
            id: line.id,
            qty: line.qty,
            finish: line.finish || "graphite",
          });
        } catch (err) {
          /* drop unsellable cached lines */
        }
      }
    }
    applyServerCart(data);
  } catch (err) {
    /* keep local cache */
  }
}

function applyUser(user) {
  const previous = state.user;
  state.user = user || null;
  const dash = $("#dash-user");
  const actions = $("#dash-actions");
  const accTitle = $("#acc-title");
  if (dash) {
    if (user && user.email) {
      dash.textContent = "Signed in as " + user.email + ". Nothing follows unless you ask.";
    } else {
      dash.textContent = "Sign in to see orders and a quiet profile.";
    }
  }
  if (actions) actions.hidden = !(user && user.id);
  if (accTitle) accTitle.textContent = user && user.email ? "Your house" : "Sign in";
  const emailField = $("#chk-email");
  if (emailField && user && user.email && !emailField.value) emailField.value = user.email;
  if (!user) {
    state.orders = [];
    state.selectedOrderId = null;
    renderDashOrders();
    const stored = readCartStore();
    if (previous || (stored.owner && stored.owner !== "guest")) {
      clearLocalCart();
      renderCart();
    }
  } else {
    saveCart();
  }
}

function orderStatusLabel(status) {
  const map = {
    pending_payment: "Payment pending",
    paid: "Paid",
    dispatched: "Dispatched",
    cancelled: "Cancelled",
    expired: "Expired",
    placed: "Placed",
  };
  return map[status] || String(status || "");
}

function renderDashOrders() {
  const box = $("#dash-orders");
  const detail = $("#dash-detail");
  if (!box) return;
  if (!state.user) {
    box.textContent = "Sign in to see your orders.";
    if (detail) {
      detail.hidden = true;
      detail.innerHTML = "";
    }
    return;
  }
  const orders = Array.isArray(state.orders) ? state.orders : [];
  if (!orders.length) {
    box.textContent = "No orders yet. The house is quiet.";
    if (detail) {
      detail.hidden = true;
      detail.innerHTML = "";
    }
    return;
  }
  box.innerHTML = orders
    .map((o) => {
      const total = typeof o.total === "number" ? money(o.total) : "";
      const on = state.selectedOrderId === o.id ? "on" : "";
      return `<button type="button" class="btn btn-ghost btn-sm ${on}" data-order="${h(o.id)}" style="margin:0 6px 6px 0">${h(o.id)} · ${h(orderStatusLabel(o.status))} · ${h(total)}</button>`;
    })
    .join("");
  renderDashDetail();
}

function renderDashDetail() {
  const detail = $("#dash-detail");
  if (!detail) return;
  const id = state.selectedOrderId;
  const order = (state.orders || []).find((o) => o.id === id);
  if (!order) {
    detail.hidden = true;
    detail.innerHTML = "";
    return;
  }
  const lines = (order.items || [])
    .map((it) => {
      const line = typeof it.unitPrice === "number" ? money(it.unitPrice * (it.qty || 1)) : "";
      return `<div class="cart-line">
        <img src="${h(safeSrc(it.image))}" alt="" loading="lazy" decoding="async" />
        <div>
          <h3>${h(it.name)}</h3>
          <p>${h(it.finish || "")} · Qty ${h(it.qty)}</p>
        </div>
        <div class="line-side">${h(line)}</div>
      </div>`;
    })
    .join("");
  detail.hidden = false;
  detail.innerHTML = `<article class="prose-panel">
    <h3>${h(order.id)}</h3>
    <p>${h(orderStatusLabel(order.status))} · ${typeof order.total === "number" ? money(order.total) : ""} · complimentary shipping</p>
    ${lines || "<p>No lines on this order.</p>"}
  </article>`;
}

async function loadOrdersFromApi() {
  if (typeof apiGet !== "function" || !state.user) {
    state.orders = [];
    renderDashOrders();
    return;
  }
  try {
    const data = await apiGet("/api/orders");
    state.orders = Array.isArray(data) ? data : [];
  } catch (err) {
    state.orders = [];
  }
  renderDashOrders();
}

function isStripeCheckoutUrl(url) {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return u.hostname === "checkout.stripe.com" || u.hostname.endsWith(".stripe.com");
  } catch {
    return false;
  }
}

function resetCheckoutForm() {
  const wrap = $("#checkout-form-wrap");
  const success = $("#checkout-success");
  const btn = $("#checkout-submit");
  if (wrap) wrap.hidden = false;
  if (success) success.hidden = true;
  if (btn) btn.disabled = false;
}

function paintCheckoutOutcome(status, noteText) {
  const wrap = $("#checkout-form-wrap");
  const success = $("#checkout-success");
  const note = $("#checkout-success-note");
  const title = $("#checkout-success-title");
  const eye = $("#checkout-success-eyebrow");
  const ordersBtn = $("#checkout-orders");
  if (wrap) wrap.hidden = true;
  if (success) success.hidden = false;
  if (ordersBtn) ordersBtn.hidden = !state.user;
  const paid = status === "paid";
  const pending = !status || status === "pending_payment";
  if (eye) eye.textContent = paid ? "Confirmed" : pending ? "Reserved" : "Order";
  if (title) {
    if (paid) title.textContent = "Payment received.";
    else if (pending) title.textContent = "Your order is reserved.";
    else title.textContent = "This order was not paid.";
  }
  if (note && noteText) note.textContent = noteText;
}

async function settleCheckoutReturn() {
  const params = new URLSearchParams(location.search || "");
  const orderId = params.get("order");
  const returning = params.get("checkout_return") === "1" || Boolean(params.get("session_id"));
  const cancelled = params.get("checkout_cancel") === "1";
  if (!orderId || (!returning && !cancelled)) return;
  if (params.get("paid") === "true" || params.get("success") === "true") {
    /* URL flags are never proof of payment */
  }
  try {
    history.replaceState({}, "", location.pathname + (location.hash || ""));
  } catch (_e) {
    /* ignore */
  }
  if (typeof apiGet !== "function") return;
  try {
    const order = await apiGet("/api/orders/" + encodeURIComponent(orderId));
    let noteText = "This order is " + (order.status || "unknown") + ".";
    if (order.status === "paid") noteText = "Payment received. " + order.id;
    else if (order.status === "pending_payment") {
      noteText = cancelled
        ? "Checkout was closed. Order " + order.id + " is still reserved. Payment is pending."
        : "Payment is still pending. " + order.id;
    }
    paintCheckoutOutcome(order.status, noteText);
    openOverlay("checkout");
    if (state.user) await loadOrdersFromApi();
  } catch (err) {
    toast(err.message || "Could not refresh order");
  }
}

async function placeOrder(details) {
  if (typeof apiSend !== "function") return false;
  if (placeOrder._busy) return false;
  placeOrder._busy = true;
  try {
    const data = await apiSend("POST", "/api/orders", {
      first: details.first,
      last: details.last,
      email: details.email,
      address: details.address,
    });
    applyServerCart({ items: [], subtotal: 0, shipping: 0, total: 0 });
    if (data && data.orderId) {
      try {
        const pay = await apiSend(
          "POST",
          "/api/orders/" + encodeURIComponent(data.orderId) + "/checkout-session",
          {}
        );
        if (pay && isStripeCheckoutUrl(pay.url)) {
          window.location.href = pay.url;
          return true;
        }
      } catch (_err) {
        /* payments unavailable — pending reservation stands; never mark paid here */
      }
    }
    paintCheckoutOutcome(
      (data && data.status) || "pending_payment",
      data && data.orderId
        ? "Order " + data.orderId + " is reserved. Payment is pending — Stripe Checkout was not available."
        : "Payment is pending. Stripe Checkout was not available."
    );
    if (state.user) await loadOrdersFromApi();
    if (typeof loadCatalogFromApi === "function") {
      await loadCatalogFromApi();
      if (state.view === "home") renderHome();
      if (state.view === "shop") renderShop();
    }
    return true;
  } catch (err) {
    toast(err.message || "Could not place order");
    return false;
  } finally {
    placeOrder._busy = false;
  }
}

async function syncSessionFromApi() {
  if (typeof apiGet !== "function") return;
  try {
    const data = await apiGet("/api/me");
    applyUser(data && data.user);
  } catch (err) {
    applyUser(null);
  }
}

async function signIn(email, password) {
  if (typeof apiSend !== "function") {
    applyUser({ email: email || "you" });
    toast("Signed in — welcome back");
    closeOverlay("account");
    return;
  }
  try {
    let data;
    try {
      data = await apiSend("POST", "/api/auth/login", { email, password });
    } catch (err) {
      data = await apiSend("POST", "/api/auth/register", { email, password });
    }
    applyUser(data && data.user);
    await syncCartFromApi();
    await loadOrdersFromApi();
    closeOverlay("account");
    toast("Signed in — welcome back");
    if (window.NexoraAdmin && typeof window.NexoraAdmin.retry === "function" && /^#\/admin/.test(location.hash || "")) {
      window.NexoraAdmin.retry();
    }
  } catch (err) {
    toast(err.message || "Could not sign in");
  }
}

function saveWish() {
  localStorage.setItem("nexora-wish", JSON.stringify(state.wishlist));
}

function saveRecent() {
  localStorage.setItem("nexora-recent", JSON.stringify(state.recent || []));
}

function isWished(id) {
  if (!Array.isArray(state.wishlist)) state.wishlist = [];
  return state.wishlist.includes(id);
}

function toggleWish(id) {
  const p = productById(id);
  if (!p) return;
  if (isWished(id)) {
    state.wishlist = state.wishlist.filter((x) => x !== id);
    toast(`${p.name} removed from saved`);
  } else {
    state.wishlist.push(id);
    toast(`${p.name} saved`);
  }
  saveWish();
  updateWishBadge();
  renderWish();
  if (state.view === "shop") renderShop();
  if (state.view === "home") renderHome();
  if (state.view === "arrivals") renderArrivals();
  if (state.view === "deals") renderDeals();
  if (state.view === "product" && state.product) renderPDP(state.product.id);
  if (state.product && state.product.id === id) syncWishButton();
}

function updateWishBadge() {
  const b = $("#wish-badge");
  if (!b) return;
  const n = state.wishlist.length;
  b.textContent = n;
  b.classList.toggle("show", n > 0);
}

function syncWishButton() {
  const btn = $("#p-wish");
  if (!btn || !state.product) return;
  const on = isWished(state.product.id);
  btn.textContent = on ? "Saved" : "Save";
  btn.classList.toggle("btn-primary", on);
  btn.classList.toggle("btn-ghost", !on);
}

function priceHTML(p) {
  return p.compareAt
    ? `${money(p.price)}<span class="was">${money(p.compareAt)}</span>`
    : money(p.price);
}

function starsLabel(p) {
  if (!p.rating) return "";
  return `${p.rating.toFixed(1)} · ${p.reviews.toLocaleString("en-US")}`;
}

function inPrice(p, id) {
  if (id === "All") return true;
  if (id === "0-150") return p.price < 150;
  if (id === "150-300") return p.price >= 150 && p.price <= 300;
  if (id === "300-600") return p.price > 300 && p.price <= 600;
  if (id === "600+") return p.price > 600;
  return true;
}

function collectionCats(filter) {
  if (!filter || filter === "All") return null;
  if (filter.includes("|")) return filter.split("|");
  const col = COLLECTIONS.find((c) => c.id === filter || c.category === filter);
  if (col && col.categories) return col.categories;
  return [filter];
}

function productHaystack(p) {
  return [p && p.name, p && p.type, p && p.category, p && p.blurb]
    .map((x) => String(x || "").toLowerCase())
    .join(" ");
}

function filteredProducts() {
  let list = PRODUCTS.slice();
  const cats = collectionCats(state.filter);
  if (cats) list = list.filter((p) => cats.includes(p.category));
  list = list.filter((p) => inPrice(p, state.price));
  if (state.query) {
    const q = state.query.toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.blurb.toLowerCase().includes(q)
    );
  }
  if (state.sort === "price-asc") list.sort((a, b) => a.price - b.price);
  else if (state.sort === "price-desc") list.sort((a, b) => b.price - a.price);
  else if (state.sort === "rating") list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  else if (state.sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

function money(n) {
  return "$" + n.toLocaleString("en-US");
}

function productById(id) {
  return PRODUCTS.find((p) => p.id === id);
}

function cartCount() {
  return state.cart.reduce((s, i) => s + i.qty, 0);
}

function cartTotal() {
  return state.cart.reduce((s, i) => {
    const p = productById(i.id);
    return s + (p ? p.price * i.qty : 0);
  }, 0);
}

function toast(msg) {
  const el = $("#toast");
  if (!el) return;
  if (msg && typeof msg === "object") {
    msg = msg.message || msg.error || "";
    if (msg && typeof msg === "object") msg = msg.message || "";
  }
  el.textContent = String(msg == null ? "" : msg);
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2200);
}

function updateBadge() {
  const b = $("#cart-badge");
  const n = cartCount();
  b.textContent = n;
  b.classList.toggle("show", n > 0);
}

function auraClass(p) {
  return (p && p.aura) || AURA_BY_CAT[p && p.category] || "aura-blue-violet";
}

function stockQty(p) {
  return p && typeof p.stock === "number" ? p.stock : 24;
}

function isOutOfStock(p) {
  return stockQty(p) <= 0;
}

function stockCap(p) {
  const n = stockQty(p);
  return n <= 0 ? 1 : Math.min(99, n);
}

function stockMeta(p) {
  const n = stockQty(p);
  if (n <= 0) return { cls: "out", label: "Currently between lots", short: "Currently between lots." };
  if (n <= 10) return { cls: "limited", label: `${n} remaining`, short: `${n} remaining.` };
  return { cls: "", label: "In the house", short: "In the house. Complimentary shipping." };
}

function cardHTML(p) {
  const on = isWished(p.id) ? "on" : "";
  const comparing = (state.compare || []).includes(p.id) ? "on" : "";
  const st = stockMeta(p);
  const id = h(p.id);
  return `
    <article class="card" data-product="${id}">
      <div class="card-media aura ${h(auraClass(p))}">
        <img src="${h(safeSrc(p.image))}" alt="${h(p.name)}"  loading="lazy" decoding="async" />
        <button class="icon-btn wish-abs ${on}" data-wish="${id}" aria-label="Save ${h(p.name)}">
          <svg viewBox="0 0 24 24"><path d="M12 19s-7-4.35-7-9.15A3.85 3.85 0 0 1 12 6.8a3.85 3.85 0 0 1 7 3.05C19 14.65 12 19 12 19z"/></svg>
        </button>
      </div>
      <div class="card-body">
        <div class="card-top">
          <span class="eyebrow">${h(p.category)}</span>
          <span class="eyebrow stars">${h(starsLabel(p))}</span>
        </div>
        <div class="card-name">${h(p.name)}</div>
        <span class="stock-dot ${h(st.cls)}"><i></i>${h(st.label)}</span>
        <div class="card-foot">
          <span class="card-price">${priceHTML(p)}</span>
          <button class="btn btn-ghost btn-sm" data-add="${id}" ${isOutOfStock(p) ? "disabled" : ""}>${isOutOfStock(p) ? "Unavailable" : "Add"}</button>
        </div>
        <div class="card-actions">
          <button class="btn btn-ghost btn-sm" data-qv="${id}">Quick view</button>
          <button class="btn btn-ghost btn-sm ${comparing}" data-compare="${id}">Compare</button>
        </div>
      </div>
    </article>
  `;
}

function tileHTML(c) {
  const cats = c.categories || [c.category];
  const count = PRODUCTS.filter((p) => cats.includes(p.category)).length;
  return `
    <article class="tile aura aura-blue-indigo" data-collection="${h(c.category)}">
      <img src="${h(safeSrc(c.image))}" alt="${h(c.title)}" loading="lazy" decoding="async" />
      <div class="tile-copy">
        <p class="eyebrow">${count} piece${count === 1 ? "" : "s"}</p>
        <h3>${h(c.title)}</h3>
        <p class="tile-note">${h(c.note || "")}</p>
      </div>
    </article>
  `;
}

function articleCardHTML(a) {
  return `
    <article class="article-card" data-article="${h(a.id)}">
      <p class="eyebrow">${h(a.kind)}  ·  ${h(a.date)}</p>
      <h3>${h(a.title)}</h3>
      <p>${h(a.excerpt)}</p>
      <span class="more">Read note</span>
    </article>
  `;
}

function renderHome() {
  const featuredIds = [
    "nova-pro-wireless",
    "apex-smart-watch",
    "pulse-max",
    "aerosound-x",
    "drift",
    "halo",
    "type",
    "phantom-anc",
  ];
  const flagged = PRODUCTS.filter((p) => p.isFeatured);
  const featured = (flagged.length ? flagged : featuredIds.map(productById).filter(Boolean)).slice(0, 8);
  const homeGrid = $("#home-grid");
  if (homeGrid) homeGrid.innerHTML = featured.map(cardHTML).join("");
  const homeCol = $("#home-collections");
  if (homeCol) homeCol.innerHTML = COLLECTIONS.map(tileHTML).join("");
  const homeJournal = $("#home-journal");
  if (homeJournal) homeJournal.innerHTML = ARTICLES.map(articleCardHTML).join("");
  const drop = $("#drop-grid");
  const dropIds = Array.isArray(state.dropIds) && state.dropIds.length ? state.dropIds : DROP_IDS;
  if (drop) drop.innerHTML = dropIds.map(productById).filter(Boolean).map(cardHTML).join("");
  renderRecent();
  startDropClock();
}

function chipIsActive(id) {
  if (id === "All") return !state.filter || state.filter === "All";
  if (state.filter === id) return true;
  const chipCats = collectionCats(id) || [id];
  const current = collectionCats(state.filter) || [state.filter];
  return current.some((c) => chipCats.includes(c));
}

function renderShop() {
  const filters = $("#shop-filters");
  const grid = $("#shop-grid");
  const pager = $("#shop-pager");
  if (!filters || !grid) return;

  filters.innerHTML = CAT_CHIPS.map(
    (c) =>
      `<button class="chip ${chipIsActive(c.id) ? "active" : ""}" data-filter="${h(c.id)}">${h(c.label)}</button>`
  ).join("");

  const list = filteredProducts();
  const pages = Math.max(1, Math.ceil(list.length / state.perPage));
  if (state.page > pages) state.page = pages;
  if (state.page < 1) state.page = 1;
  const start = (state.page - 1) * state.perPage;
  const slice = list.slice(start, start + state.perPage);
  grid.innerHTML = slice.length
    ? slice.map(cardHTML).join("")
    : `<div class="cart-empty" style="grid-column:1/-1;min-height:200px">No pieces match these filters.</div>`;

  const count = $("#shop-count");
  if (count) {
    count.textContent = `${list.length} of ${PRODUCTS.length} pieces.`;
  }

  if (pager) {
    if (pages <= 1) {
      pager.innerHTML = "";
    } else {
      let html = `<button class="chip" data-page="${Math.max(1, state.page - 1)}">Prev</button>`;
      for (let i = 1; i <= pages; i++) {
        html += `<button class="chip ${i === state.page ? "active" : ""}" data-page="${i}">${i}</button>`;
      }
      html += `<button class="chip" data-page="${Math.min(pages, state.page + 1)}">Next</button>`;
      pager.innerHTML = html;
    }
  }

  const sort = $("#shop-sort");
  if (sort && sort.value !== state.sort) sort.value = state.sort;
  const priceSel = $("#shop-price");
  if (priceSel && priceSel.value !== state.price) priceSel.value = state.price;
  const q = $("#shop-q");
  if (q && document.activeElement !== q && q.value !== state.query) q.value = state.query;
}

function renderCollections() {
  const el = $("#collections-grid");
  if (el) el.innerHTML = COLLECTIONS.map(tileHTML).join("");
}

function renderJournal() {
  const el = $("#journal-grid");
  if (el) el.innerHTML = ARTICLES.map(articleCardHTML).join("");
}

function renderWish() {
  const box = $("#wish-items");
  if (!box) return;
  if (!state.wishlist.length) {
    box.innerHTML = `<div class="cart-empty">Nothing saved yet.<br/>The list is quiet.</div>`;
    return;
  }
  box.innerHTML = state.wishlist
    .map((id) => {
      const p = productById(id);
      if (!p) return "";
      return `
        <div class="cart-line" data-product="${h(p.id)}">
          <img src="${h(safeSrc(p.image))}" alt=""  loading="lazy" decoding="async" />
          <div>
            <h3>${h(p.name)}</h3>
            <p>${h(p.type)} · ${money(p.price)}</p>
            <button class="remove" data-wish="${h(p.id)}">Remove</button>
          </div>
          <button class="btn btn-ghost btn-sm" data-add="${h(p.id)}">Add</button>
        </div>
      `;
    })
    .join("");
}

function renderCart() {
  const box = $("#cart-items");
  const foot = $("#cart-foot");
  if (!state.cart.length) {
    box.innerHTML = `<div class="cart-empty">Your cart is empty.<br/>The house is quiet.</div>`;
    foot.style.display = "none";
    updateBadge();
    return;
  }
  foot.style.display = "flex";
  box.innerHTML = state.cart
    .map((item) => {
      const p = productById(item.id);
      if (!p) return "";
      const finish = FINISHES.find((f) => f.id === item.finish);
      const lineTotal =
        state.cartTotals && typeof state.cartTotals.total === "number"
          ? null
          : p.price * item.qty;
      return `
        <div class="cart-line">
          <img src="${h(safeSrc(p.image))}" alt=""  loading="lazy" decoding="async" />
          <div>
            <h3>${h(p.name)}</h3>
            <p>${h(finish ? finish.name : "")}</p>
            <div class="qty" style="margin-top:8px;height:30px">
              <button type="button" data-qty-delta="-1" data-id="${h(item.id)}" data-finish="${h(item.finish)}" aria-label="Decrease">−</button>
              <span>${h(item.qty)}</span>
              <button type="button" data-qty-delta="1" data-id="${h(item.id)}" data-finish="${h(item.finish)}" aria-label="Increase">+</button>
            </div>
            <button class="remove" data-remove="${h(item.id)}|${h(item.finish)}">Remove</button>
          </div>
          <div class="line-side">${money(lineTotal != null ? lineTotal : p.price * item.qty)}</div>
        </div>
      `;
    })
    .join("");
  const totals = state.cartTotals || {};
  const subtotal = typeof totals.subtotal === "number" ? totals.subtotal : cartTotal();
  const shipping = typeof totals.shipping === "number" ? totals.shipping : 0;
  const total = typeof totals.total === "number" ? totals.total : subtotal + shipping;
  const subEl = $("#cart-subtotal");
  const shipEl = $("#cart-shipping");
  const totEl = $("#cart-total");
  if (subEl) subEl.textContent = money(subtotal);
  if (shipEl) shipEl.textContent = shipping ? money(shipping) : "Complimentary";
  if (totEl) totEl.textContent = money(total);
  updateBadge();
}

function setCartQty(id, finish, qty) {
  const snapshot = (state.cart || []).map((i) => ({ id: i.id, qty: i.qty, finish: i.finish }));
  const snapshotTotals = state.cartTotals ? Object.assign({}, state.cartTotals) : null;
  if (qty < 1) return removeFromCart(id, finish);
  const line = state.cart.find((i) => i.id === id && i.finish === finish);
  if (!line) return Promise.resolve(false);
  line.qty = qty;
  state.cartTotals = null;
  saveCart();
  renderCart();
  if (typeof apiSend !== "function") return Promise.resolve(true);
  return apiSend("PATCH", "/api/cart", { id, qty, finish })
    .then((data) => {
      applyServerCart(data);
      return true;
    })
    .catch((err) => {
      state.cart = snapshot;
      state.cartTotals = snapshotTotals;
      saveCart();
      renderCart();
      toast(err.message || "Could not update cart");
      return false;
    });
}

function addToCart(id, qty, finish) {
  qty = qty == null ? 1 : qty;
  finish = finish || state.finish || "graphite";
  const p = productById(id);
  if (!p) return Promise.resolve(false);
  if (isOutOfStock(p)) {
    toast("This product is currently between lots");
    return Promise.resolve(false);
  }
  qty = Math.max(1, Math.min(stockCap(p), Number(qty) || 1));
  const snapshot = (state.cart || []).map((i) => ({ id: i.id, qty: i.qty, finish: i.finish }));
  const snapshotTotals = state.cartTotals ? Object.assign({}, state.cartTotals) : null;
  const existing = state.cart.find((i) => i.id === id && i.finish === finish);
  if (existing) existing.qty += qty;
  else state.cart.push({ id, qty, finish });
  state.cartTotals = null;
  saveCart();
  renderCart();

  if (typeof apiSend !== "function") {
    toast(`${p.name} added to cart`);
    return Promise.resolve(true);
  }

  return apiSend("POST", "/api/cart", { id, qty, finish })
    .then((data) => {
      applyServerCart(data);
      toast(`${p.name} added to cart`);
      return true;
    })
    .catch((err) => {
      state.cart = snapshot;
      state.cartTotals = snapshotTotals;
      saveCart();
      renderCart();
      toast(err.message || "Could not add to cart");
      return false;
    });
}

function removeFromCart(id, finish) {
  const snapshot = (state.cart || []).map((i) => ({ id: i.id, qty: i.qty, finish: i.finish }));
  const snapshotTotals = state.cartTotals ? Object.assign({}, state.cartTotals) : null;
  state.cart = state.cart.filter((i) => !(i.id === id && i.finish === finish));
  state.cartTotals = null;
  saveCart();
  renderCart();
  if (typeof apiSend !== "function") return Promise.resolve(true);
  return apiSend("DELETE", "/api/cart/" + encodeURIComponent(id) + "/" + encodeURIComponent(finish))
    .then((data) => {
      applyServerCart(data);
      return true;
    })
    .catch((err) => {
      state.cart = snapshot;
      state.cartTotals = snapshotTotals;
      saveCart();
      renderCart();
      toast(err.message || "Could not update cart");
      return false;
    });
}

function openOverlay(name) {
  const el = document.getElementById(name + "-overlay");
  if (!el) return;
  el.classList.add("open");
  el.setAttribute("aria-hidden", "false");
  if (name === "search") setTimeout(() => $("#search-input").focus(), 50);
}

function closeOverlay(name) {
  const el = document.getElementById(name + "-overlay");
  if (!el) return;
  el.classList.remove("open");
  el.setAttribute("aria-hidden", "true");
}

function closeAllOverlays() {
  $$(".overlay.open").forEach((el) => {
    el.classList.remove("open");
    el.setAttribute("aria-hidden", "true");
  });
}

function openProduct(id) {
  const p = productById(id);
  if (!p) return;
  state.product = p;
  state.qty = 1;
  state.finish = "graphite";
  rememberView(p.id);
  const img = $("#p-image");
  if (img) {
    img.src = safeSrc(p.image);
    img.alt = p.name;
  }
  const vis = $("#qv-visual");
  if (vis) vis.className = "product-visual aura " + auraClass(p);
  const meta = $("#p-meta");
  if (meta) meta.textContent = p.meta || p.category;
  const name = $("#p-name");
  if (name) name.textContent = p.name;
  const blurb = $("#p-blurb");
  if (blurb) blurb.textContent = p.blurb;
  const ratingEl = $("#p-rating");
  if (ratingEl) {
    ratingEl.textContent = p.rating
      ? p.rating.toFixed(1) + " rating · " + p.reviews.toLocaleString("en-US") + " notes"
      : "";
  }
  const priceEl = $("#p-price");
  if (priceEl) priceEl.innerHTML = priceHTML(p);
  const stockEl = $("#p-stock");
  if (stockEl) stockEl.textContent = stockMeta(p).short;
  const qtyVal = $("#qty-val");
  if (qtyVal) qtyVal.textContent = "1";
  const addBtn = $("#p-add");
  if (addBtn) {
    addBtn.disabled = isOutOfStock(p);
    addBtn.textContent = addBtn.disabled ? "Unavailable" : "Add to cart";
  }
  const buyBtn = $("#p-buy");
  if (buyBtn) buyBtn.disabled = isOutOfStock(p);
  syncWishButton();
  const fin = $("#p-finishes");
  if (fin) {
    fin.innerHTML = FINISHES.map(
      (f) =>
        `<button class="swatch ${f.id === state.finish ? "active" : ""}" data-finish="${h(f.id)}"><i style="background:${h(f.color)}"></i>${h(f.name)}</button>`
    ).join("");
  }
  const specs = $("#p-specs");
  if (specs && p.specs) {
    specs.innerHTML = p.specs.map(([k, v]) => `<div><dt>${h(k)}</dt><dd>${h(v)}</dd></div>`).join("");
  }
  openOverlay("product");
}

function openArticle(id) {
  const a = ARTICLES.find((x) => x.id === id);
  if (!a) return;
  const meta = $("#a-meta");
  const title = $("#a-title");
  const body = $("#a-body");
  if (meta) meta.textContent = `${a.kind}  ·  ${a.date}`;
  if (title) title.textContent = a.title;
  const paras = Array.isArray(a.body) ? a.body : typeof a.body === "string" ? [a.body] : [];
  if (body) body.innerHTML = paras.map((para) => `<p>${h(para)}</p>`).join("");
  openOverlay("article");
}

function setView(name) {
  state.view = name;
  if (name !== "product") {
    document.body.classList.remove("pdp-ambient-violet", "pdp-ambient-blue");
  }
  $$(".view").forEach((v) => v.classList.toggle("active", v.dataset.view === name));
  $$("[data-nav]").forEach((a) => {
    a.classList.toggle("active", a.dataset.nav === name);
  });
  const main = $("#main");
  if (main) main.scrollTop = 0;
  if (name === "shop") renderShop();
  if (name === "arrivals") renderArrivals();
  if (name === "deals") renderDeals();
  if (name === "compare") renderCompare();
  if (name === "home") renderHome();
  if (name === "collections") renderCollections();
  if (name === "journal") renderJournal();
  if (name === "dashboard") renderDashOrders();
  closeOverlay("menu");
}

function route() {
  const raw = (location.hash || "#/").replace(/^#/, "");
  const [path, qs] = raw.split("?");
  const parts = (path || "/").split("/").filter(Boolean);
  const params = new URLSearchParams(qs || "");
  const page = parts[0] || "home";
  if (page === "admin") {
    if (window.NexoraAdmin && typeof window.NexoraAdmin.enter === "function") {
      window.NexoraAdmin.enter(parts.slice(1), params);
    }
    return;
  }
  if (window.NexoraAdmin && typeof window.NexoraAdmin.leave === "function") {
    window.NexoraAdmin.leave();
  }
  if (page === "product" && parts[1]) {
    closeAllOverlays();
    setView("product");
    renderPDP(parts[1]);
    return;
  }
  if (page === "shop") {
    const cat = params.get("cat") || "All";
    if (state.filter !== cat) {
      state.filter = cat;
      state.page = 1;
    }
    closeAllOverlays();
    setView("shop");
    return;
  }
  const pages = ["home", "shop", "collections", "atelier", "journal", "arrivals", "deals", "compare", "dashboard"];
  if (pages.includes(page)) {
    closeAllOverlays();
    setView(page);
    return;
  }
  setView("home");
}

function renderSearch(q) {
  const query = (q || "").trim().toLowerCase();
  const hits = !query
    ? PRODUCTS.slice(0, 8)
    : PRODUCTS.filter((p) => productHaystack(p).includes(query)).slice(0, 24);
  const box = $("#search-results");
  if (!box) return;
  if (!hits.length) {
    box.innerHTML = `<div class="cart-empty" style="min-height:120px">No pieces match.</div>`;
    return;
  }
  box.innerHTML = hits
    .map(
      (p) => `
      <div class="search-hit" data-product="${h(p.id)}">
        <img src="${h(safeSrc(p.image))}" alt=""  loading="lazy" decoding="async" />
        <div>
          <h3>${h(p.name)}</h3>
          <p>${h(p.type)}</p>
        </div>
        <span class="card-price">${money(p.price)}</span>
      </div>`
    )
    .join("");
}


function rememberView(id) {
  if (!id) return;
  if (!Array.isArray(state.recent)) state.recent = [];
  state.recent = [id, ...state.recent.filter((x) => x !== id)].slice(0, 4);
  saveRecent();
}

function renderRecent() {
  const el = $("#recent-grid");
  const head = $("#recent-head");
  if (!el) return;
  const ids = state.recent || [];
  if (!ids.length) {
    if (head) head.hidden = true;
    el.innerHTML = "";
    return;
  }
  if (head) head.hidden = false;
  el.innerHTML = ids.map(productById).filter(Boolean).map(cardHTML).join("");
}

function renderArrivals() {
  const el = $("#arrivals-grid");
  if (!el) return;
  const flagged = PRODUCTS.filter((p) => p.isArrival);
  const originals = new Set(["one", "drift", "field", "halo", "meridian", "type", "vessel", "arc"]);
  const fallback = PRODUCTS.filter((p) => !originals.has(p.id)).slice(0, 12);
  const list = flagged.length ? flagged.slice(0, 12) : fallback;
  el.innerHTML = (list.length ? list : PRODUCTS.slice(0, 8)).map(cardHTML).join("");
}

function renderDeals() {
  const el = $("#deals-grid");
  if (!el) return;
  const list = PRODUCTS.filter((p) => p.compareAt);
  el.innerHTML = list.length
    ? list.map(cardHTML).join("")
    : `<div class="cart-empty" style="grid-column:1/-1;min-height:200px">No reduced pieces at the moment.</div>`;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function startDropClock() {
  const el = $("#drop-clock");
  if (!el) return;
  const tick = () => {
    const end = Number(state.dropEndsAt) || DROP_END;
    const ms = Math.max(0, end - Date.now());
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    el.textContent = pad2(h) + " : " + pad2(m) + " : " + pad2(sec);
  };
  tick();
  if (startDropClock._t) clearInterval(startDropClock._t);
  startDropClock._t = setInterval(tick, 1000);
}

function toggleCompare(id) {
  const p = productById(id);
  if (!p) return;
  const list = state.compare || [];
  if (list.includes(id)) {
    state.compare = list.filter((x) => x !== id);
  } else {
    if (list.length >= 4) {
      toast("Compare up to four pieces");
      return;
    }
    state.compare = [...list, id];
  }
  updateCompareBar();
  if (state.view === "home") renderHome();
  if (state.view === "shop") renderShop();
  if (state.view === "arrivals") renderArrivals();
  if (state.view === "deals") renderDeals();
  if (state.view === "compare") renderCompare();
}

function updateCompareBar() {
  const bar = $("#compare-bar");
  const label = $("#compare-label");
  const n = (state.compare || []).length;
  if (label) label.textContent = n ? n + " selected" : "0 selected";
  if (bar) bar.hidden = n === 0;
}

function renderCompare() {
  const el = $("#compare-table");
  if (!el) return;
  const items = (state.compare || []).map(productById).filter(Boolean);
  if (!items.length) {
    el.innerHTML = `<div class="cart-empty" style="min-height:180px">Select pieces from the catalog to compare.</div>`;
    return;
  }
  el.innerHTML = `<div class="compare-wrap">${items
    .map((p) => {
      const st = stockMeta(p);
      const id = h(p.id);
      return `
      <article class="compare-col">
        <img src="${h(safeSrc(p.image))}" alt="${h(p.name)}"  loading="lazy" decoding="async" />
        <div class="body">
          <h3>${h(p.name)}</h3>
          <div class="compare-row"><span>Price</span><span>${priceHTML(p)}</span></div>
          <div class="compare-row"><span>Type</span><span>${h(p.type)}</span></div>
          <div class="compare-row"><span>Category</span><span>${h(p.category)}</span></div>
          <div class="compare-row"><span>Rating</span><span>${p.rating ? h(p.rating.toFixed(1)) : "—"}</span></div>
          <div class="compare-row"><span>Availability</span><span>${h(st.label)}</span></div>
          ${(p.specs || [])
            .slice(0, 4)
            .map(([k, v]) => `<div class="compare-row"><span>${h(k)}</span><span>${h(v)}</span></div>`)
            .join("")}
          <div class="buy-row" style="margin-top:14px;margin-bottom:0">
            <button class="btn btn-primary btn-sm" data-add="${id}">Add</button>
            <button class="btn btn-ghost btn-sm" data-compare="${id}">Remove</button>
          </div>
        </div>
      </article>`;
    })
    .join("")}</div>`;
}

function reviewsFor(p) {
  return [
    { name: "A. Mendes", text: "Quiet, considered, and exactly as described. It recedes until you need it." },
    { name: "L. Rourke", text: "The finish is why it stayed on the desk. No glare, no announcement." },
    { name: "S. Ito", text: p.name + " feels finished, not assembled. A rare thing in this category." },
  ];
}

function renderPDP(id) {
  const p = productById(id);
  const root = $("#pdp");
  if (!root) return;
  if (!p) {
    root.innerHTML = `<div class="cart-empty">This piece is no longer in the house.</div>`;
    return;
  }
  state.product = p;
  state.qty = 1;
  state.finish = "graphite";
  rememberView(p.id);
  const st = stockMeta(p);
  const related = PRODUCTS.filter((x) => x.category === p.category && x.id !== p.id && !isOutOfStock(x)).slice(0, 4);
  const specs = p.specs || [];
  document.body.classList.toggle("pdp-ambient-violet", /Time|Watch|violet/i.test(p.category + auraClass(p)));
  document.body.classList.toggle("pdp-ambient-blue", /Audio|Headphones|Desk|Keyboard/i.test(p.category));
  const pid = h(p.id);
  root.innerHTML = `
    <article class="pdp-hero">
      <div class="pdp-visual aura ${h(auraClass(p))}">
        <img src="${h(safeSrc(p.image))}" alt="${h(p.name)}"  loading="lazy" decoding="async" />
      </div>
      <div class="pdp-copy">
        <p class="eyebrow">${h(p.meta || p.category)}</p>
        <h1>${h(p.name)}</h1>
        <p class="lede">${h(p.blurb)}</p>
        <p class="p-rating">${p.rating ? h(p.rating.toFixed(1) + " rating · " + p.reviews.toLocaleString("en-US") + " notes") : ""}</p>
        <p class="price">${priceHTML(p)}</p>
        <p class="hero-note stock-dot ${h(st.cls)}"><i></i>${h(st.short)}</p>
        <div class="finishes">
          ${FINISHES.map(
            (f) =>
              `<button class="swatch ${f.id === (state.finish || "graphite") ? "active" : ""}" type="button" data-finish="${h(f.id)}"><i style="background:${h(f.color)}"></i>${h(f.name)}</button>`
          ).join("")}
        </div>
        <div class="buy-row">
          <div class="qty">
            <button type="button" data-pdp-qty="-1" aria-label="Decrease">−</button>
            <span id="pdp-qty">${h(state.qty || 1)}</span>
            <button type="button" data-pdp-qty="1" aria-label="Increase">+</button>
          </div>
          <button class="btn btn-primary magnetic" data-add="${pid}" ${isOutOfStock(p) ? "disabled" : ""}>${isOutOfStock(p) ? "Unavailable" : "Add to cart"}</button>
          <button class="btn btn-ghost" data-buynow="${pid}" ${isOutOfStock(p) ? "disabled" : ""}>Buy now</button>
          <button class="btn btn-ghost" data-wish="${pid}">${isWished(p.id) ? "Saved" : "Save"}</button>
        </div>
      </div>
    </article>
    <div class="pdp-band">
      <h2>${h(p.tagline || p.tag || p.type)}</h2>
      <p>${h(p.blurb)}</p>
    </div>
    <div class="pdp-stats">
      ${specs.slice(0, 3).map(([k, v]) => `<div class="stat"><b>${h(v)}</b><span>${h(k)}</span></div>`).join("")}
    </div>
    <div class="grid-2" style="margin: 8px 0 22px">
      <article class="prose-panel">
        <h3>Specifications</h3>
        <dl class="specs" style="border:0;padding:0">
          ${specs.map(([k, v]) => `<div><dt>${h(k)}</dt><dd>${h(v)}</dd></div>`).join("")}
        </dl>
      </article>
      <article class="prose-panel">
        <h3>Notes from the house</h3>
        <div class="review-list">
          ${reviewsFor(p).map((r) => `<div class="review"><b>${h(r.name)}</b><p>${h(r.text)}</p></div>`).join("")}
        </div>
      </article>
    </div>
    ${
      related.length
        ? `<div class="section-head"><h2>You may also consider</h2></div>
    <div class="grid-4">${related.map(cardHTML).join("")}</div>`
        : ""
    }
  `;
}

function fillSearchPopular() {
  const el = $("#search-popular");
  if (!el) return;
  el.innerHTML = SEARCH_POPULAR.map((q) => `<button class="chip" data-popular="${h(q)}">${h(q)}</button>`).join("");
}

function bindSpotlight() {
  const spot = $("#spotlight");
  if (!spot || window.matchMedia("(pointer: coarse)").matches) return;
  document.addEventListener("pointermove", (e) => {
    spot.style.left = e.clientX + "px";
    spot.style.top = e.clientY + "px";
    spot.classList.add("on");
  });
}

function bindMagnetic() {
  if (window.matchMedia("(pointer: coarse)").matches) return;
  document.addEventListener("pointermove", (e) => {
    document.querySelectorAll(".magnetic").forEach((el) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      if (Math.hypot(x, y) < 90) {
        el.style.transform = "translate(" + x * 0.12 + "px," + y * 0.12 + "px)";
      } else {
        el.style.transform = "";
      }
    });
  });
}

function bindLogoEgg() {
  const logo = $("#nexora-logo");
  if (!logo) return;
  let n = 0;
  let t = 0;
  logo.addEventListener("click", () => {
    const now = Date.now();
    n = now - t > 2500 ? 1 : n + 1;
    t = now;
    if (n >= 5) {
      n = 0;
      openOverlay("system");
    }
  });
}

function bind() {
  document.addEventListener(
    "error",
    (e) => {
      const t = e.target;
      if (!t || t.tagName !== "IMG") return;
      if (t.getAttribute("data-fb") === "1") return;
      t.setAttribute("data-fb", "1");
      t.src = "images/_studio.jpg";
    },
    true
  );

  document.addEventListener("click", (e) => {
    const open = e.target.closest("[data-open]");
    if (open) {
      const name = open.dataset.open;
      if (name === "cart") renderCart();
      if (name === "wish") renderWish();
      if (name === "search") {
        fillSearchPopular();
        renderSearch($("#search-input") ? $("#search-input").value : "");
      }
      openOverlay(name);
    }

    const close = e.target.closest("[data-close]");
    if (close) closeOverlay(close.dataset.close);

    if (e.target.classList.contains("overlay")) {
      const id = e.target.id.replace("-overlay", "");
      closeOverlay(id);
    }

    const wishBtn = e.target.closest("[data-wish]");
    if (wishBtn) {
      e.preventDefault();
      e.stopPropagation();
      toggleWish(wishBtn.dataset.wish);
      return;
    }

    const add = e.target.closest("[data-add]");
    if (add) {
      e.preventDefault();
      e.stopPropagation();
      const pid = add.dataset.add;
      const onPdp = state.view === "product" && state.product && state.product.id === pid;
      const finish = onPdp ? state.finish || "graphite" : "graphite";
      const qty = onPdp ? state.qty || 1 : 1;
      addToCart(pid, qty, finish);
      return;
    }

    const qtyDelta = e.target.closest("[data-qty-delta]");
    if (qtyDelta) {
      e.preventDefault();
      e.stopPropagation();
      const id = qtyDelta.dataset.id;
      const finish = qtyDelta.dataset.finish || "graphite";
      const line = state.cart.find((i) => i.id === id && i.finish === finish);
      const next = (line ? line.qty : 1) + Number(qtyDelta.dataset.qtyDelta);
      setCartQty(id, finish, next);
      return;
    }

    const pdpQty = e.target.closest("[data-pdp-qty]");
    if (pdpQty) {
      e.preventDefault();
      e.stopPropagation();
      const delta = Number(pdpQty.dataset.pdpQty) || 0;
      const cap = state.product ? stockCap(state.product) : 99;
      state.qty = Math.max(1, Math.min(cap, (state.qty || 1) + delta));
      const span = $("#pdp-qty");
      if (span) span.textContent = String(state.qty);
      return;
    }

    const orderBtn = e.target.closest("[data-order]");
    if (orderBtn) {
      e.preventDefault();
      e.stopPropagation();
      const oid = orderBtn.dataset.order;
      state.selectedOrderId = oid;
      renderDashOrders();
      if (typeof apiGet === "function" && oid) {
        apiGet("/api/orders/" + encodeURIComponent(oid))
          .then((detail) => {
            if (!detail || !detail.id) return;
            const i = (state.orders || []).findIndex((o) => o.id === detail.id);
            if (i >= 0) state.orders[i] = detail;
            else state.orders = [detail].concat(state.orders || []);
            renderDashOrders();
          })
          .catch(() => {});
      }
      return;
    }

    const qv = e.target.closest("[data-qv]");
    if (qv) {
      e.preventDefault();
      e.stopPropagation();
      openProduct(qv.dataset.qv);
      return;
    }

    const cmp = e.target.closest("[data-compare]");
    if (cmp) {
      e.preventDefault();
      e.stopPropagation();
      toggleCompare(cmp.dataset.compare);
      return;
    }

    const buy = e.target.closest("[data-buynow]");
    if (buy) {
      e.preventDefault();
      e.stopPropagation();
      const pid = buy.dataset.buynow;
      const onPdp = state.view === "product" && state.product && state.product.id === pid;
      addToCart(pid, onPdp ? state.qty || 1 : 1, state.finish || "graphite").then((ok) => {
        if (!ok) return;
        closeAllOverlays();
        resetCheckoutForm();
        openOverlay("checkout");
      });
      return;
    }

    const pop = e.target.closest("[data-popular]");
    if (pop) {
      const input = $("#search-input");
      if (input) {
        input.value = pop.dataset.popular;
        renderSearch(pop.dataset.popular);
      }
      return;
    }

    const prod = e.target.closest("[data-product]");
    if (prod) {
      closeAllOverlays();
      location.hash = "#/product/" + prod.dataset.product;
      return;
    }

    const filter = e.target.closest("[data-filter]");
    if (filter) {
      const id = filter.dataset.filter;
      const next = !id || id === "All" ? "#/shop" : "#/shop?cat=" + encodeURIComponent(id);
      state.filter = id;
      state.page = 1;
      if ((location.hash || "") !== next) location.hash = next;
      else renderShop();
      return;
    }

    const price = e.target.closest("[data-price]");
    if (price) {
      state.price = price.dataset.price;
      state.page = 1;
      renderShop();
    }

    const pageBtn = e.target.closest("[data-page]");
    if (pageBtn) {
      state.page = parseInt(pageBtn.dataset.page, 10);
      renderShop();
      if ($("#main")) $("#main").scrollTop = 0;
    }

    const col = e.target.closest("[data-collection]");
    if (col) {
      const id = col.dataset.collection;
      state.filter = id;
      state.page = 1;
      location.hash = id && id !== "All" ? "#/shop?cat=" + encodeURIComponent(id) : "#/shop";
      return;
    }

    const art = e.target.closest("[data-article]");
    if (art) openArticle(art.dataset.article);

    const finish = e.target.closest("[data-finish]");
    if (finish) {
      state.finish = finish.dataset.finish;
      $$(".swatch").forEach((s) =>
        s.classList.toggle("active", s.dataset.finish === state.finish)
      );
    }

    const rem = e.target.closest("[data-remove]");
    if (rem) {
      const [id, fin] = rem.dataset.remove.split("|");
      removeFromCart(id, fin);
    }
  });

  const qtyMinus = $("#qty-minus");
  if (qtyMinus) {
    qtyMinus.addEventListener("click", () => {
      state.qty = Math.max(1, state.qty - 1);
      $("#qty-val").textContent = state.qty;
    });
  }
  const qtyPlus = $("#qty-plus");
  if (qtyPlus) {
    qtyPlus.addEventListener("click", () => {
      const cap = state.product ? stockCap(state.product) : 99;
      state.qty = Math.min(cap, (state.qty || 1) + 1);
      const span = $("#qty-val");
      if (span) span.textContent = state.qty;
    });
  }
  const pAdd = $("#p-add");
  if (pAdd) {
    pAdd.addEventListener("click", () => {
      if (!state.product) return;
      addToCart(state.product.id, state.qty, state.finish).then((ok) => {
        if (!ok) return;
        closeOverlay("product");
        renderCart();
        openOverlay("cart");
      });
    });
  }
  const pBuy = $("#p-buy");
  if (pBuy) {
    pBuy.addEventListener("click", () => {
      if (!state.product) return;
      addToCart(state.product.id, state.qty, state.finish).then((ok) => {
        if (!ok) return;
        closeOverlay("product");
        const wrap = $("#checkout-form-wrap");
        const success = $("#checkout-success");
        if (wrap) wrap.hidden = false;
        if (success) success.hidden = true;
        openOverlay("checkout");
      });
    });
  }
  const pFull = $("#p-full");
  if (pFull) {
    pFull.addEventListener("click", () => {
      if (!state.product) return;
      closeOverlay("product");
      location.hash = "#/product/" + state.product.id;
    });
  }

  const checkoutBtn = $("#checkout-btn");
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", () => {
      if (!state.cart.length) {
        toast("Your cart is empty");
        return;
      }
      closeOverlay("cart");
      resetCheckoutForm();
      openOverlay("checkout");
    });
  }

  const checkoutForm = $("#checkout-form");
  if (checkoutForm) {
    checkoutForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const btn = $("#checkout-submit") || checkoutForm.querySelector('[type="submit"]');
      if (btn) btn.disabled = true;
      Promise.resolve(
        placeOrder({
          first: ($("#chk-first") && $("#chk-first").value) || "",
          last: ($("#chk-last") && $("#chk-last").value) || "",
          email: ($("#chk-email") && $("#chk-email").value) || "",
          address: ($("#chk-addr") && $("#chk-addr").value) || "",
        })
      ).finally(() => {
        if (btn && !($("#checkout-success") && !$("#checkout-success").hidden)) btn.disabled = false;
      });
    });
  }

  const checkoutOrders = $("#checkout-orders");
  if (checkoutOrders) {
    checkoutOrders.addEventListener("click", () => {
      closeOverlay("checkout");
      location.hash = "#/dashboard";
    });
  }

  const dashLogout = $("#dash-logout");
  if (dashLogout) {
    dashLogout.addEventListener("click", async () => {
      try {
        if (typeof apiSend === "function") await apiSend("POST", "/api/auth/logout", {});
      } catch (_err) {
        /* session already gone */
      }
      applyUser(null);
      await syncCartFromApi();
      toast("Signed out");
    });
  }

  const accountForm = $("#account-form");
  if (accountForm) {
    accountForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = ($("#acc-email") && $("#acc-email").value) || "";
      const password = ($("#acc-pass") && $("#acc-pass").value) || "";
      signIn(email, password);
    });
  }
  const accDash = $("#acc-dash");
  if (accDash) {
    accDash.addEventListener("click", () => {
      closeOverlay("account");
      location.hash = "#/dashboard";
    });
  }

  document.addEventListener("submit", (e) => {
    if (e.target.matches("[data-newsletter]")) {
      e.preventDefault();
      const form = e.target;
      const input = form.querySelector('input[type="email"]');
      const email = input ? input.value : "";
      const done = () => {
        form.reset();
        toast("You are on the list");
      };
      if (typeof apiSend !== "function") {
        done();
        return;
      }
      apiSend("POST", "/api/subscribe", { email })
        .then(done)
        .catch(() => toast("Please check that email and try again"));
    }
  });

  const searchInput = $("#search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => renderSearch(e.target.value));
  }

  const pWish = $("#p-wish");
  if (pWish) {
    pWish.addEventListener("click", () => {
      if (state.product) toggleWish(state.product.id);
    });
  }
  const shopSort = $("#shop-sort");
  if (shopSort) {
    shopSort.addEventListener("change", (e) => {
      state.sort = e.target.value;
      state.page = 1;
      renderShop();
    });
  }
  const shopPrice = $("#shop-price");
  if (shopPrice) {
    shopPrice.addEventListener("change", (e) => {
      state.price = e.target.value;
      state.page = 1;
      renderShop();
    });
  }
  const shopQ = $("#shop-q");
  if (shopQ) {
    shopQ.addEventListener("input", (e) => {
      state.query = e.target.value.trim();
      state.page = 1;
      renderShop();
    });
  }

  const cmpClear = $("#compare-clear");
  if (cmpClear) {
    cmpClear.addEventListener("click", () => {
      state.compare = [];
      updateCompareBar();
      if (state.view === "compare") renderCompare();
      if (state.view === "shop") renderShop();
      if (state.view === "home") renderHome();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllOverlays();
    const typing = /input|textarea/i.test(e.target.tagName);
    if (e.key === "/" && !typing) {
      e.preventDefault();
      fillSearchPopular();
      renderSearch("");
      openOverlay("search");
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      fillSearchPopular();
      renderSearch($("#search-input") ? $("#search-input").value : "");
      openOverlay("search");
    }
  });

  bindSpotlight();
  bindMagnetic();
  bindLogoEgg();
  window.addEventListener("hashchange", route);
  window.__nexoraApplyUser = applyUser;
  window.__nexoraOpenOverlay = openOverlay;
  window.__nexoraCloseOverlay = closeOverlay;
}

async function loadCatalogFromApi() {
  if (typeof apiGet !== "function") return;
  try {
    const data = await apiGet("/api/products?perPage=100");
    if (data && Array.isArray(data.products) && data.products.length) {
      PRODUCTS.length = 0;
      PRODUCTS.push.apply(PRODUCTS, data.products);
    }
  } catch (err) {
    /* bundled catalog remains */
  }
}

async function loadHomeFromApi() {
  if (typeof apiGet !== "function") return;
  try {
    const data = await apiGet("/api/home");
    if (!data) return;
    if (data.drop && data.drop.endsAt) {
      const t = Date.parse(data.drop.endsAt);
      if (!Number.isNaN(t)) state.dropEndsAt = t;
    }
    if (data.drop && Array.isArray(data.drop.products) && data.drop.products.length) {
      state.dropIds = data.drop.products.map((p) => p.id).filter(Boolean);
    }
    const mark = (list, key) => {
      if (!Array.isArray(list)) return;
      const ids = new Set(list.map((p) => p && p.id).filter(Boolean));
      PRODUCTS.forEach((p) => {
        if (ids.has(p.id)) p[key] = true;
      });
    };
    mark(data.featured, "isFeatured");
    mark(data.arrivals, "isArrival");
    if (data.drop && Array.isArray(data.drop.products)) mark(data.drop.products, "isDrop");
  } catch (err) {
    /* keep local drop clock */
  }
}

async function loadArticlesFromApi() {
  if (typeof apiGet !== "function") return;
  try {
    const data = await apiGet("/api/articles");
    const list = data && Array.isArray(data.articles) ? data.articles : Array.isArray(data) ? data : [];
    if (list.length) {
      ARTICLES.length = 0;
      ARTICLES.push.apply(ARTICLES, list);
    }
  } catch (err) {
    /* bundled notes remain */
  }
}

function canonicalizeAdminPath() {
  const path = location.pathname || "/";
  if (path !== "/admin" && path.indexOf("/admin/") !== 0) return false;
  const rest = path.replace(/^\/admin\/?/, "");
  const hash = "#/admin" + (rest ? "/" + rest : "") + (location.search || "");
  try {
    history.replaceState({}, "", "/" + hash);
  } catch (_e) {
    location.replace("/" + hash);
    return true;
  }
  return false;
}

async function init() {
  if (canonicalizeAdminPath()) return;
  if (!Array.isArray(state.wishlist)) state.wishlist = [];
  if (!Array.isArray(state.recent)) state.recent = loadRecent();
  if (!Array.isArray(state.compare)) state.compare = [];
  if (!state.price) state.price = "All";
  if (!state.sort) state.sort = "featured";
  if (typeof state.query !== "string") state.query = "";
  if (typeof state.page !== "number") state.page = 1;
  if (typeof state.perPage !== "number") state.perPage = 12;
  fillSearchPopular();
  bind();
  route();
  await loadCatalogFromApi();
  await loadHomeFromApi();
  await loadArticlesFromApi();
  await syncSessionFromApi();
  await syncCartFromApi();
  await loadOrdersFromApi();
  await settleCheckoutReturn();
  $$("[data-footer]").forEach((el) => (el.innerHTML = FOOTER_HTML));
  renderCart();
  renderWish();
  updateBadge();
  updateWishBadge();
  updateCompareBar();
  route();
}

init();
