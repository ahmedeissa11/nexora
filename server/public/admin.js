/* NEXORA Admin Dashboard — isolated. Server remains the security boundary. */
(function (root) {
  "use strict";

  var state = {
    on: false,
    authed: false,
    user: null,
    parts: [],
    busy: false,
    modal: null,
    navOpen: false,
    searchTimer: 0,
    lists: {},
  };

  function el() {
    var node = document.getElementById("nexora-admin");
    if (!node && document.body) {
      node = document.createElement("div");
      node.id = "nexora-admin";
      node.hidden = true;
      node.setAttribute("aria-hidden", "true");
      document.body.appendChild(node);
    }
    return node;
  }

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
    var s = src.trim();
    if (!s || s.includes("..") || s.includes("\\") || /[:\s<>]/.test(s)) return "images/_studio.jpg";
    if (/^images\/[a-zA-Z0-9._/-]+$/.test(s)) return s;
    if (/^\/images\/[a-zA-Z0-9._/-]+$/.test(s)) return s.slice(1);
    return "images/_studio.jpg";
  }

  function money(n) {
    var x = Number(n);
    if (!Number.isFinite(x)) return "—";
    return "$" + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function when(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return h(iso);
    return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function qs(obj) {
    var p = new URLSearchParams();
    Object.keys(obj || {}).forEach(function (k) {
      if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") p.set(k, String(obj[k]));
    });
    var s = p.toString();
    return s ? "?" + s : "";
  }

  function api(method, path, body) {
    if (typeof root.apiSend === "function") return root.apiSend(method, path, body);
    var opts = {
      method: method,
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    return fetch(path, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error(data.error || "Request failed");
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  function section() {
    var p = state.parts[0] || "";
    if (!p) return "home";
    if (p === "products" || p === "orders" || p === "customers" || p === "content" || p === "audit") return p;
    return "home";
  }

  function icons() {
    return {
      dash: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
      products: '<svg viewBox="0 0 24 24"><path d="M4 8l8-4 8 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z"/><path d="M12 12v8M4 8l8 4 8-4"/></svg>',
      orders: '<svg viewBox="0 0 24 24"><path d="M7 7h10M7 12h10M7 17h6"/><rect x="4" y="4" width="16" height="16" rx="2"/></svg>',
      customers: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.2"/><path d="M5.2 19.2c1.4-3 3.8-4.5 6.8-4.5s5.4 1.5 6.8 4.5"/></svg>',
      content: '<svg viewBox="0 0 24 24"><path d="M6 5h12v14H6z"/><path d="M9 9h6M9 13h6"/></svg>',
      audit: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    };
  }

  function shell(inner) {
    var ic = icons();
    var sec = section();
    var email = state.user && state.user.email ? state.user.email : "";
    return (
      '<div class="ad-app">' +
        '<aside class="ad-sidebar">' +
          '<a class="ad-brand" href="#/admin">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.25"/><circle cx="12" cy="12" r="2.15" fill="currentColor"/><path d="M3.2 12h17.6" fill="none" stroke="currentColor" stroke-width="1" opacity="0.45"/></svg>' +
            "<span>NEXORA</span><em>OPS</em>" +
          "</a>" +
          '<nav class="ad-nav" aria-label="Admin">' +
            navLink("#/admin", "home", ic.dash, "Dashboard") +
            navLink("#/admin/products", "products", ic.products, "Products") +
            navLink("#/admin/orders", "orders", ic.orders, "Orders") +
            navLink("#/admin/customers", "customers", ic.customers, "Customers") +
            navLink("#/admin/content", "content", ic.content, "Content") +
            navLink("#/admin/audit", "audit", ic.audit, "Audit log") +
          "</nav>" +
          '<div class="ad-side-foot">' +
            '<div class="ad-user"><b>' + h(email) + "</b>Administrator</div>" +
            '<button type="button" class="ad-btn ad-btn-ghost" data-ad="logout" style="width:100%">Sign out</button>' +
            '<a class="ad-btn ad-btn-ghost" href="#/" style="width:100%;margin-top:8px">Storefront</a>' +
          "</div>" +
        "</aside>" +
        '<header class="ad-top">' +
          '<button type="button" class="ad-menu-btn" data-ad="menu" aria-label="Menu">' + ic.dash + "</button>" +
          '<div class="ad-crumb">House controls<span>/</span>' + h(titleFor(sec)) + "</div>" +
          '<div class="ad-top-note">Server-authoritative</div>' +
        "</header>" +
        '<main class="ad-main" id="ad-main">' + inner + "</main>" +
      "</div>" +
      '<div class="ad-drawer-back" data-ad="close-nav"></div>' +
      (state.modal ? modalHTML(state.modal) : "")
    );
  }

  function navLink(href, key, svg, label) {
    var on = section() === key ? " is-active" : "";
    return '<a href="' + href + '" class="' + on + '">' + svg + "<span>" + label + "</span></a>";
  }

  function titleFor(sec) {
    return (
      { home: "Dashboard", products: "Products", orders: "Orders", customers: "Customers", content: "Content", audit: "Audit log" }[sec] ||
      "Dashboard"
    );
  }

  function modalHTML(m) {
    return (
      '<div class="ad-modal-back" data-ad="modal-dismiss">' +
        '<div class="ad-modal" role="dialog" aria-modal="true">' +
          "<h3>" + h(m.title) + "</h3>" +
          "<p>" + h(m.body) + "</p>" +
          '<div class="row">' +
            '<button type="button" class="ad-btn ad-btn-ghost" data-ad="modal-cancel">Cancel</button>' +
            '<button type="button" class="ad-btn ' + (m.danger ? "ad-btn-danger" : "ad-btn-primary") + '" data-ad="modal-ok">' +
              h(m.confirmLabel || "Confirm") +
            "</button>" +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function flash(kind, msg) {
    if (!msg) return "";
    return '<div class="ad-flash ' + h(kind) + '">' + h(msg) + "</div>";
  }

  function pager(page, perPage, total, makeHref) {
    var pages = Math.max(1, Math.ceil((total || 0) / (perPage || 12)));
    if (page > pages) page = pages;
    var html = '<div class="ad-pager"><span>' + h(String(total || 0)) + " records · page " + h(String(page)) + " of " + h(String(pages)) + "</span><div class=\"pages\">";
    if (pages > 1) {
      html += '<a class="ad-btn ad-btn-ghost" href="' + h(makeHref(Math.max(1, page - 1))) + '">Prev</a>';
      html += '<a class="ad-btn ad-btn-ghost" href="' + h(makeHref(Math.min(pages, page + 1))) + '">Next</a>';
    }
    html += "</div></div>";
    return html;
  }

  function skeleton() {
    return (
      '<div class="ad-skel-row"><div class="ad-skel" style="height:28px;width:40%"></div></div>' +
      '<div class="ad-metrics">' +
        [1, 2, 3, 4].map(function () { return '<div class="ad-metric"><div class="ad-skel" style="height:12px;width:50%"></div><div class="ad-skel" style="height:24px;width:70%;margin-top:12px"></div></div>'; }).join("") +
      "</div>"
    );
  }

  function gate(kind, title, body, action) {
    return (
      '<div class="ad-gate">' +
        '<p class="ad-muted">' + h(kind) + "</p>" +
        "<h1>" + h(title) + "</h1>" +
        "<p>" + h(body) + "</p>" +
        (action || "") +
      "</div>"
    );
  }

  function paint(html, opts) {
    var node = el();
    if (!node) return;
    opts = opts || {};
    if (opts.gate) {
      node.innerHTML = '<div class="ad-app" style="grid-template-columns:1fr"><main class="ad-main">' + html + "</main></div>";
      return;
    }
    node.innerHTML = shell(html);
    node.classList.toggle("nav-open", !!state.navOpen);
  }

  function show() {
    var node = el();
    if (!node) return;
    document.body.classList.add("nexora-admin-on");
    node.hidden = false;
    node.classList.add("is-on");
    node.setAttribute("aria-hidden", "false");
    state.on = true;
  }

  function hide() {
    var node = el();
    document.body.classList.remove("nexora-admin-on");
    if (node) {
      node.hidden = true;
      node.classList.remove("is-on", "nav-open");
      node.setAttribute("aria-hidden", "true");
      node.innerHTML = "";
    }
    state.on = false;
    state.authed = false;
    state.navOpen = false;
    state.modal = null;
  }

  function openAccount() {
    if (typeof root.__nexoraOpenOverlay === "function") root.__nexoraOpenOverlay("account");
    else {
      var o = document.getElementById("account-overlay");
      if (o) {
        o.classList.add("open");
        o.setAttribute("aria-hidden", "false");
      }
    }
  }

  function authorize() {
    return api("GET", "/api/admin/session").then(function (data) {
      var user = data && data.user;
      if (!user || user.role !== "admin") {
        var err = new Error("Not allowed");
        err.status = 403;
        throw err;
      }
      state.user = user;
      state.authed = true;
      return user;
    });
  }

  function enter(parts) {
    state.parts = Array.isArray(parts) ? parts : [];
    show();
    paint(skeleton());
    authorize()
      .then(function () {
        return renderPage();
      })
      .catch(function (err) {
        state.authed = false;
        state.user = null;
        if (err && err.status === 401) {
          paint(
            gate(
              "401",
              "Sign in required",
              "House controls are only available to signed-in administrators. Use the existing account overlay — the server decides who may enter.",
              '<button type="button" class="ad-btn ad-btn-primary" data-ad="signin" style="margin-top:16px">Continue</button>'
            ),
            { gate: true }
          );
          openAccount();
          return;
        }
        if (err && err.status === 403) {
          paint(
            gate(
              "403",
              "Access denied",
              "This account is signed in, but the server does not grant administrator access. There is no frontend override.",
              '<a class="ad-btn ad-btn-ghost" href="#/" style="margin-top:16px">Return to Nexora</a>'
            ),
            { gate: true }
          );
          return;
        }
        paint(
          gate("Error", "Could not open controls", err && err.message ? err.message : "Something went wrong.", '<button type="button" class="ad-btn ad-btn-ghost" data-ad="retry" style="margin-top:16px">Retry</button>'),
          { gate: true }
        );
      });
  }

  function retry() {
    enter(state.parts || []);
  }

  function leave() {
    if (state.on) hide();
  }

  function humanError(err) {
    if (!err) return "Something went wrong.";
    if (err.status === 401) return "Sign in required. Your session may have expired.";
    if (err.status === 403) return "Not allowed.";
    if (err.status === 409) return err.message || "This change conflicts with current inventory or account rules.";
    if (err.status === 500) return "The house could not complete that request.";
    return err.message || "Request failed";
  }

  function handleAuthError(err) {
    if (err && err.status === 401) {
      state.authed = false;
      enter(state.parts);
      return true;
    }
    if (err && err.status === 403) {
      enter(state.parts);
      return true;
    }
    return false;
  }

  function renderPage() {
    if (!state.authed) return Promise.resolve();
    var p0 = state.parts[0] || "";
    var p1 = state.parts[1] || "";
    if (!p0) return renderDash();
    if (p0 === "products" && p1 === "new") return renderProductForm(null);
    if (p0 === "products" && p1) return renderProductForm(p1);
    if (p0 === "products") return renderProducts();
    if (p0 === "orders" && p1) return renderOrder(p1);
    if (p0 === "orders") return renderOrders();
    if (p0 === "customers" && p1) return renderCustomer(p1);
    if (p0 === "customers") return renderCustomers();
    if (p0 === "content") return renderContent();
    if (p0 === "audit") return renderAudit();
    return renderDash();
  }

  function metric(k, v, hint) {
    return '<article class="ad-metric"><div class="k">' + h(k) + '</div><div class="v">' + h(v) + "</div>" + (hint ? '<div class="h">' + h(hint) + "</div>" : "") + "</article>";
  }

  function renderDash() {
    paint(skeleton());
    return Promise.all([api("GET", "/api/admin/stats"), api("GET", "/api/admin/orders?perPage=8&page=1")])
      .then(function (pair) {
        var st = pair[0] || {};
        var orders = pair[1] || {};
        var p = st.products || {};
        var c = st.customers || {};
        var o = st.orders || {};
        var r = st.revenue || {};
        var by = o.byStatus || {};
        var html =
          "<h1 class=\"ad-h1\">Dashboard</h1>" +
          '<p class="ad-sub">Live figures from Postgres. Revenue is paid and dispatched orders only — never catalog prices, never pending or placed.</p>' +
          '<div class="ad-metrics">' +
            metric("Products", p.total, (p.active || 0) + " active") +
            metric("Active", p.active, (p.archived || 0) + " archived") +
            metric("Low stock", p.lowStock, "Physical ≤ 3") +
            metric("Customers", c.customers, (c.admins || 0) + " admins") +
            metric("Pending payment", o.pendingPayment || by.pending_payment || 0) +
            metric("Paid", o.paid || by.paid || 0) +
            metric("Dispatched", o.dispatched || by.dispatched || 0) +
            metric("Revenue", money(r.total), (r.paidOrderCount || 0) + " paid lots · USD") +
          "</div>" +
          '<div class="ad-split">' +
            '<section class="ad-card"><h2>Orders by status</h2>' +
              '<dl class="ad-kv">' +
                kv("Pending payment", o.pendingPayment || by.pending_payment || 0) +
                kv("Paid", o.paid || by.paid || 0) +
                kv("Dispatched", o.dispatched || by.dispatched || 0) +
                kv("Cancelled", by.cancelled || 0) +
                kv("Expired", by.expired || 0) +
                kv("Placed (legacy)", o.placed || by.placed || 0) +
              "</dl>" +
              '<p class="ad-muted" style="margin-top:12px">Placed orders are terminal and are excluded from revenue.</p>' +
            "</section>" +
            '<section class="ad-card"><h2>Recent orders</h2>' + recentOrders(orders.orders || []) + "</section>" +
          "</div>";
        paint(html);
      })
      .catch(function (err) {
        if (handleAuthError(err)) return;
        paint(gate("Error", "Stats unavailable", humanError(err), '<button type="button" class="ad-btn ad-btn-ghost" data-ad="retry">Retry</button>'));
      });
  }

  function kv(k, v) {
    return "<div><dt>" + h(k) + "</dt><dd>" + h(String(v)) + "</dd></div>";
  }

  function recentOrders(rows) {
    if (!rows.length) return '<div class="ad-empty" style="min-height:120px">No orders yet.</div>';
    return rows
      .map(function (o) {
        return (
          '<a href="#/admin/orders/' + h(o.id) + '" style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--ad-border)">' +
            "<span><b>" + h(o.id) + "</b><span class=\"ad-muted\"> · " + h(o.email) + "</span></span>" +
            '<span class="ad-pill st-' + h(o.status) + '">' + h(o.status) + "</span>" +
          "</a>"
        );
      })
      .join("");
  }

  function listQuery() {
    var hash = location.hash || "";
    var q = hash.split("?")[1] || "";
    return new URLSearchParams(q);
  }

  function renderProducts() {
    var q = listQuery();
    var page = Number(q.get("page") || 1) || 1;
    var search = q.get("q") || "";
    var active = q.get("active") || "";
    var sort = q.get("sort") || "name";
    paint(skeleton());
    var path = "/api/admin/products" + qs({ page: page, perPage: 20, q: search, active: active, sort: sort });
    return api("GET", path)
      .then(function (data) {
        var rows = data.products || [];
        var html =
          "<h1 class=\"ad-h1\">Products</h1>" +
          '<p class="ad-sub">Archive hides a piece from the storefront. Inventory never sets available stock directly.</p>' +
          '<form class="ad-toolbar" data-ad-search="products">' +
            '<input class="ad-field grow" name="q" value="' + h(search) + '" placeholder="Search name, id, slug…" />' +
            '<select class="ad-field" name="active"><option value="">All states</option><option value="true"' + (active === "true" ? " selected" : "") + ">Active</option><option value=\"false\"" + (active === "false" ? " selected" : "") + ">Archived</option></select>" +
            '<select class="ad-field" name="sort"><option value="name">Name</option><option value="price-asc">Price ↑</option><option value="price-desc">Price ↓</option><option value="stock">Stock</option><option value="created">Created</option></select>' +
            '<a class="ad-btn ad-btn-primary" href="#/admin/products/new">New piece</a>' +
          "</form>" +
          (rows.length
            ? '<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>Piece</th><th>Category</th><th>Price</th><th>Physical</th><th>Reserved</th><th>Available</th><th>State</th><th></th></tr></thead><tbody>' +
              rows
                .map(function (p) {
                  return (
                    "<tr>" +
                      '<td data-label="Piece"><div class="ad-prod-row"><img class="ad-thumb" src="' + h(safeSrc(p.image)) + '" alt=""><div><div class="ad-name">' + h(p.name) + '</div><div class="ad-muted">' + h(p.id) + "</div></div></div></td>" +
                      '<td data-label="Category">' + h(p.category) + "</td>" +
                      '<td data-label="Price">' + money(p.price) + "</td>" +
                      '<td data-label="Physical">' + h(p.physicalStock) + "</td>" +
                      '<td data-label="Reserved">' + h(p.reservedQty) + "</td>" +
                      '<td data-label="Available">' + h(p.available) + "</td>" +
                      '<td data-label="State"><span class="ad-pill ' + (p.isActive ? "on" : "off") + '">' + (p.isActive ? "Active" : "Archived") + "</span></td>" +
                      '<td data-label=""><div class="ad-actions"><a class="ad-btn ad-btn-ghost" href="#/admin/products/' + h(p.id) + '">Open</a></div></td>' +
                    "</tr>"
                  );
                })
                .join("") +
              "</tbody></table></div>"
            : '<div class="ad-empty">No products match.</div>') +
          pager(data.page || page, data.perPage || 20, data.total || 0, function (n) {
            return "#/admin/products" + qs({ page: n, q: search, active: active, sort: sort });
          });
        paint(html);
        var form = el().querySelector("[data-ad-search=products]");
        if (form) {
          form.sort.value = sort;
        }
      })
      .catch(function (err) {
        if (handleAuthError(err)) return;
        paint(gate("Error", "Could not load products", humanError(err), '<button type="button" class="ad-btn ad-btn-ghost" data-ad="retry">Retry</button>'));
      });
  }

  function specText(specs) {
    if (!Array.isArray(specs)) return "";
    return specs
      .map(function (pair) {
        if (Array.isArray(pair)) return pair[0] + " | " + pair[1];
        return "";
      })
      .join("\n");
  }

  function parseSpecs(text) {
    return String(text || "")
      .split("\n")
      .map(function (line) { return line.trim(); })
      .filter(Boolean)
      .map(function (line) {
        var i = line.indexOf("|");
        if (i < 0) return [line, "—"];
        return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
      });
  }

  function renderProductForm(id) {
    var creating = !id;
    paint(skeleton());
    var load = creating ? Promise.resolve(null) : api("GET", "/api/admin/products/" + encodeURIComponent(id));
    return load
      .then(function (p) {
        state._product = p;
        paint(productFormHTML(p, creating, null, null));
      })
      .catch(function (err) {
        if (handleAuthError(err)) return;
        paint(gate("Error", "Product unavailable", humanError(err), '<a class="ad-btn ad-btn-ghost" href="#/admin/products">Back</a>'));
      });
  }

  function productFormHTML(p, creating, notice, errMsg) {
    p = p || {};
    var title = creating ? "New piece" : p.name || p.id;
    return (
      "<h1 class=\"ad-h1\">" + h(title) + "</h1>" +
      '<p class="ad-sub">' + (creating ? "Create uses the product allowlist. Initial stock is physical, not available." : "Editing never writes available stock. Use the adjustment panel.") + "</p>" +
      flash(errMsg ? "err" : notice ? "ok" : "", errMsg || notice || "") +
      '<div class="ad-split">' +
        '<form class="ad-card ad-form" data-ad-form="product">' +
          field("id", "Id", p.id || "", creating, "one-off-sku") +
          field("slug", "Slug", p.slug || "", true, "defaults to id") +
          field("name", "Name", p.name || "", true) +
          field("category", "Category", p.category || "", true, "Headphones") +
          field("collection", "Collection", p.collection || "", true) +
          field("type", "Type", p.type || "", true) +
          field("price", "Price (USD)", p.price != null ? p.price : "", true, "128.00") +
          field("compareAt", "Compare at", p.compareAt != null ? p.compareAt : "", true, "optional") +
          field("image", "Image path", p.image || "", true, "images/one.jpg") +
          field("meta", "Meta", p.meta || "", true) +
          field("tag", "Tag", p.tag || "", true) +
          field("tagline", "Tagline", p.tagline || "", true) +
          '<div class="full"><label for="ad-blurb">Blurb</label><textarea class="ad-field" id="ad-blurb" name="blurb" maxlength="2000">' + h(p.blurb || "") + "</textarea></div>" +
          '<div class="full"><label for="ad-specs">Specs (Label | Value per line)</label><textarea class="ad-field" id="ad-specs" name="specs">' + h(specText(p.specs)) + "</textarea></div>" +
          (creating ? field("stock", "Initial physical stock", p.physicalStock != null ? p.physicalStock : 0, true) : "") +
          check("isActive", "Active in catalog", p.isActive !== false) +
          check("isFeatured", "Featured", !!p.isFeatured) +
          check("isDrop", "Drop", !!p.isDrop) +
          check("isArrival", "Arrival", !!p.isArrival) +
          '<div class="full ad-actions" style="margin-top:8px">' +
            '<button class="ad-btn ad-btn-primary" type="submit"' + (state.busy ? " disabled" : "") + ">" + (creating ? "Create" : "Save") + "</button>" +
            '<a class="ad-btn ad-btn-ghost" href="#/admin/products">Cancel</a>' +
            (!creating ? '<button type="button" class="ad-btn ad-btn-danger" data-ad="archive" data-id="' + h(p.id) + '">Archive</button>' : "") +
          "</div>" +
        "</form>" +
        (!creating ? inventoryPanel(p) : '<section class="ad-card"><h2>Note</h2><p class="ad-muted">After create, inventory adjustments are the only way to change physical stock.</p></section>') +
      "</div>"
    );
  }

  function field(name, label, value, enabled, ph) {
    return (
      "<div><label for=\"ad-" + name + "\">" + h(label) + "</label>" +
      '<input class="ad-field" id="ad-' + name + '" name="' + name + '" value="' + h(value) + '" ' + (enabled ? "" : "readonly ") + (ph ? 'placeholder="' + h(ph) + '"' : "") + " /></div>"
    );
  }

  function check(name, label, on) {
    return '<label class="ad-check"><input type="checkbox" name="' + name + '"' + (on ? " checked" : "") + " /> " + h(label) + "</label>";
  }

  function inventoryPanel(p) {
    var phys = Number(p.physicalStock || 0);
    var resv = Number(p.reservedQty || 0);
    var avail = Number(p.available || 0);
    return (
      '<section class="ad-card">' +
        "<h2>Inventory</h2>" +
        '<dl class="ad-kv">' +
          kv("Physical", phys) +
          kv("Reserved", resv) +
          kv("Available (computed)", avail) +
        "</dl>" +
        '<p class="ad-muted" style="margin:12px 0">Available is not writable. Negative deltas warn first and cannot go below reserved quantity.</p>' +
        '<form data-ad-form="inventory">' +
          '<label for="ad-delta">Delta</label>' +
          '<input class="ad-field" id="ad-delta" name="delta" type="number" step="1" required placeholder="-2 or 5" style="margin-bottom:10px" />' +
          '<label for="ad-reason">Reason</label>' +
          '<input class="ad-field" id="ad-reason" name="reason" required maxlength="200" placeholder="cycle count" style="margin-bottom:12px" />' +
          '<p class="ad-muted" id="ad-preview">Resulting physical: —</p>' +
          '<button class="ad-btn ad-btn-primary" type="submit" style="margin-top:10px"' + (state.busy ? " disabled" : "") + ">Record adjustment</button>" +
        "</form>" +
      "</section>"
    );
  }

  function readForm(form) {
    var data = {};
    [].forEach.call(form.elements, function (node) {
      if (!node.name) return;
      if (node.type === "checkbox") data[node.name] = !!node.checked;
      else data[node.name] = node.value;
    });
    return data;
  }

  function numOrNull(v) {
    if (v === "" || v == null) return null;
    var n = Number(v);
    return Number.isFinite(n) ? n : v;
  }

  function submitProduct(form) {
    if (state.busy) return;
    var creating = !state.parts[1] || state.parts[1] === "new";
    var raw = readForm(form);
    var body = {
      name: raw.name,
      slug: raw.slug,
      category: raw.category,
      collection: raw.collection,
      type: raw.type,
      price: numOrNull(raw.price),
      image: raw.image,
      meta: raw.meta,
      blurb: raw.blurb,
      tag: raw.tag || null,
      tagline: raw.tagline || null,
      compareAt: raw.compareAt === "" ? null : numOrNull(raw.compareAt),
      isActive: !!raw.isActive,
      isFeatured: !!raw.isFeatured,
      isDrop: !!raw.isDrop,
      isArrival: !!raw.isArrival,
      specs: parseSpecs(raw.specs),
    };
    if (!raw.slug) delete body.slug;
    if (creating) {
      body.id = raw.id;
      var st = parseInt(raw.stock, 10);
      if (Number.isInteger(st) && st >= 0) body.stock = st;
    }
    state.busy = true;
    var req = creating
      ? api("POST", "/api/admin/products", body)
      : api("PATCH", "/api/admin/products/" + encodeURIComponent(state.parts[1]), body);
    req
      .then(function (row) {
        state.busy = false;
        if (creating) {
          location.hash = "#/admin/products/" + encodeURIComponent(row.id);
          return;
        }
        state._product = row;
        paint(productFormHTML(row, false, "Saved.", null));
      })
      .catch(function (err) {
        state.busy = false;
        if (handleAuthError(err)) return;
        paint(productFormHTML(creating ? body : Object.assign({}, state._product, body), creating, null, humanError(err)));
      });
  }

  function submitInventory(form) {
    if (state.busy) return;
    var id = state.parts[1];
    var raw = readForm(form);
    var delta = parseInt(raw.delta, 10);
    var reason = String(raw.reason || "").trim();
    if (!Number.isInteger(delta) || delta === 0) {
      paint(productFormHTML(state._product, false, null, "Delta must be a non-zero integer."));
      return;
    }
    var go = function () {
      state.busy = true;
      api("POST", "/api/admin/products/" + encodeURIComponent(id) + "/inventory-adjustments", { delta: delta, reason: reason })
        .then(function () {
          return api("GET", "/api/admin/products/" + encodeURIComponent(id));
        })
        .then(function (row) {
          state.busy = false;
          state._product = row;
          paint(productFormHTML(row, false, "Adjustment recorded. Physical is now " + row.physicalStock + ".", null));
        })
        .catch(function (err) {
          state.busy = false;
          if (handleAuthError(err)) return;
          var msg = humanError(err);
          if (err.status === 409) msg = err.message || "Stock cannot be negative or fall below reserved quantity.";
          paint(productFormHTML(state._product, false, null, msg));
        });
    };
    if (delta < 0) {
      confirmModal(
        "Reduce physical stock?",
        "Delta " + delta + " will be applied to physical stock. The server will reject the change if the result is negative or below reserved quantity.",
        "Adjust",
        false,
        go
      );
      return;
    }
    go();
  }

  function archiveProduct(id) {
    confirmModal(
      "Archive this piece?",
      "The catalog, search, and checkout will treat it as gone. History is kept — this is not a hard delete.",
      "Archive",
      true,
      function () {
        api("DELETE", "/api/admin/products/" + encodeURIComponent(id))
          .then(function (row) {
            state._product = row;
            paint(productFormHTML(row, false, "Archived. Storefront will no longer list this piece.", null));
          })
          .catch(function (err) {
            if (handleAuthError(err)) return;
            paint(productFormHTML(state._product, false, null, humanError(err)));
          });
      }
    );
  }

  function confirmModal(title, body, confirmLabel, danger, onOk) {
    state.modal = { title: title, body: body, confirmLabel: confirmLabel, danger: danger, onOk: onOk };
    var node = el();
    if (!node) return;
    var existing = node.querySelector(".ad-modal-back");
    if (existing) existing.remove();
    node.insertAdjacentHTML("beforeend", modalHTML(state.modal));
  }

  function closeModal() {
    state.modal = null;
    var node = el();
    if (!node) return;
    var m = node.querySelector(".ad-modal-back");
    if (m) m.remove();
  }

  function renderOrders() {
    var q = listQuery();
    var page = Number(q.get("page") || 1) || 1;
    var search = q.get("q") || "";
    var status = q.get("status") || "";
    paint(skeleton());
    return api("GET", "/api/admin/orders" + qs({ page: page, perPage: 20, q: search, status: status }))
      .then(function (data) {
        var rows = data.orders || [];
        var html =
          "<h1 class=\"ad-h1\">Orders</h1>" +
          '<p class="ad-sub">Stripe remains payment authority. There is no mark-as-paid action.</p>' +
          '<form class="ad-toolbar" data-ad-search="orders">' +
            '<input class="ad-field grow" name="q" value="' + h(search) + '" placeholder="Search id or email…" />' +
            '<select class="ad-field" name="status">' +
              opt("", "All statuses", status) +
              opt("pending_payment", "Pending payment", status) +
              opt("paid", "Paid", status) +
              opt("dispatched", "Dispatched", status) +
              opt("cancelled", "Cancelled", status) +
              opt("expired", "Expired", status) +
              opt("placed", "Placed (legacy)", status) +
            "</select>" +
          "</form>" +
          (rows.length
            ? '<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Total</th><th>Created</th><th></th></tr></thead><tbody>' +
              rows
                .map(function (o) {
                  return (
                    "<tr>" +
                      '<td data-label="Order"><div class="ad-name">' + h(o.id) + "</div></td>" +
                      '<td data-label="Customer">' + h(o.email) + '<div class="ad-muted">' + h(o.firstName + " " + o.lastName) + "</div></td>" +
                      '<td data-label="Status"><span class="ad-pill st-' + h(o.status) + '">' + h(o.status) + "</span></td>" +
                      '<td data-label="Total">' + money(o.total) + "</td>" +
                      '<td data-label="Created">' + when(o.createdAt) + "</td>" +
                      '<td data-label=""><a class="ad-btn ad-btn-ghost" href="#/admin/orders/' + h(o.id) + '">Open</a></td>' +
                    "</tr>"
                  );
                })
                .join("") +
              "</tbody></table></div>"
            : '<div class="ad-empty">No orders match.</div>') +
          pager(data.page || page, data.perPage || 20, data.total || 0, function (n) {
            return "#/admin/orders" + qs({ page: n, q: search, status: status });
          });
        paint(html);
      })
      .catch(function (err) {
        if (handleAuthError(err)) return;
        paint(gate("Error", "Could not load orders", humanError(err), '<button type="button" class="ad-btn ad-btn-ghost" data-ad="retry">Retry</button>'));
      });
  }

  function opt(v, label, cur) {
    return '<option value="' + h(v) + '"' + (cur === v ? " selected" : "") + ">" + h(label) + "</option>";
  }

  function renderOrder(id) {
    paint(skeleton());
    return api("GET", "/api/admin/orders/" + encodeURIComponent(id))
      .then(function (o) {
        state._order = o;
        paint(orderHTML(o, null, null));
      })
      .catch(function (err) {
        if (handleAuthError(err)) return;
        paint(gate("Error", "Order unavailable", humanError(err), '<a class="ad-btn ad-btn-ghost" href="#/admin/orders">Back</a>'));
      });
  }

  function orderHTML(o, notice, errMsg) {
    var items = o.items || [];
    var actions = "";
    if (o.status === "pending_payment") {
      actions += '<button type="button" class="ad-btn ad-btn-danger" data-ad="cancel-order">Cancel order</button>';
    }
    if (o.status === "paid") {
      actions += '<button type="button" class="ad-btn ad-btn-primary" data-ad="dispatch-order">Dispatch</button>';
      actions += '<button type="button" class="ad-btn ad-btn-ghost" data-ad="cancel-order">Request cancellation</button>';
    }
    if (o.status === "dispatched") {
      actions += '<button type="button" class="ad-btn ad-btn-ghost" data-ad="cancel-order">Request cancellation</button>';
    }
    if (o.status === "placed") {
      actions += '<p class="ad-muted">Legacy placed orders are terminal. No dispatch or cancel.</p>';
    }
    return (
      "<h1 class=\"ad-h1\">" + h(o.id) + "</h1>" +
      '<p class="ad-sub">Snapshot prices from the order — not the live catalog. Payment status is never set here.</p>' +
      flash(errMsg ? "err" : notice ? "ok" : "", errMsg || notice || "") +
      '<div class="ad-split">' +
        '<section class="ad-card">' +
          '<span class="ad-pill st-' + h(o.status) + '">' + h(o.status) + "</span>" +
          '<dl class="ad-kv" style="margin-top:12px">' +
            kv("Email", o.email) +
            kv("Name", (o.firstName || "") + " " + (o.lastName || "")) +
            kv("Address", o.address) +
            kv("Total", money(o.total)) +
            kv("Subtotal", money(o.subtotal)) +
            kv("Created", when(o.createdAt)) +
            kv("Expires", when(o.expiresAt)) +
            kv("Paid", when(o.paidAt)) +
            kv("Dispatched", when(o.dispatchedAt)) +
            kv("Cancelled", when(o.cancelledAt)) +
            kv("Cancel requested", when(o.cancelRequestedAt)) +
            kv("Provider", o.paymentProvider || "—") +
          "</dl>" +
          '<div class="ad-actions" style="margin-top:16px">' + actions + '<a class="ad-btn ad-btn-ghost" href="#/admin/orders">Back</a></div>' +
        "</section>" +
        '<section class="ad-card"><h2>Lines</h2>' +
          (items.length
            ? items
                .map(function (it) {
                  return (
                    '<div style="display:grid;grid-template-columns:48px 1fr auto;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--ad-border)">' +
                      '<img class="ad-thumb" src="' + h(safeSrc(it.image)) + '" alt="">' +
                      "<div><div class=\"ad-name\">" + h(it.name) + '</div><div class="ad-muted">' + h(it.finish) + " · ×" + h(it.qty) + " · " + h(it.productId) + "</div></div>" +
                      "<div>" + money(it.unitPrice) + "</div>" +
                    "</div>"
                  );
                })
                .join("")
            : '<div class="ad-empty" style="min-height:80px">No lines.</div>') +
        "</section>" +
      "</div>"
    );
  }

  function cancelOrder() {
    var o = state._order;
    if (!o) return;
    var pending = o.status === "pending_payment";
    confirmModal(
      pending ? "Cancel this reservation?" : "Request cancellation?",
      pending
        ? "Pending payment will be cancelled and the inventory reservation released. Physical stock is unchanged."
        : "Paid and dispatched orders cannot be silently refunded. This records a cancellation request only.",
      pending ? "Cancel order" : "Request",
      true,
      function () {
        api("POST", "/api/admin/orders/" + encodeURIComponent(o.id) + "/cancel", {})
          .then(function (row) {
            state._order = row;
            paint(orderHTML(row, pending ? "Order cancelled. Reservation released." : "Cancellation requested.", null));
          })
          .catch(function (err) {
            if (handleAuthError(err)) return;
            paint(orderHTML(state._order, null, humanError(err)));
          });
      }
    );
  }

  function dispatchOrder() {
    var o = state._order;
    if (!o) return;
    confirmModal(
      "Dispatch this order?",
      "Only paid orders may be dispatched. This does not mark anything paid.",
      "Dispatch",
      false,
      function () {
        api("POST", "/api/admin/orders/" + encodeURIComponent(o.id) + "/dispatch", {})
          .then(function (row) {
            state._order = row;
            paint(orderHTML(row, "Dispatched.", null));
          })
          .catch(function (err) {
            if (handleAuthError(err)) return;
            paint(orderHTML(state._order, null, humanError(err)));
          });
      }
    );
  }

  function renderCustomers() {
    var q = listQuery();
    var page = Number(q.get("page") || 1) || 1;
    var search = q.get("q") || "";
    var role = q.get("role") || "";
    paint(skeleton());
    return api("GET", "/api/admin/customers" + qs({ page: page, perPage: 20, q: search, role: role }))
      .then(function (data) {
        var rows = data.customers || [];
        var html =
          "<h1 class=\"ad-h1\">Customers</h1>" +
          '<p class="ad-sub">Safe fields only. Hashes and session tokens are never returned by the API.</p>' +
          '<form class="ad-toolbar" data-ad-search="customers">' +
            '<input class="ad-field grow" name="q" value="' + h(search) + '" placeholder="Search email or name…" />' +
            '<select class="ad-field" name="role">' + opt("", "All roles", role) + opt("customer", "Customer", role) + opt("admin", "Admin", role) + "</select>" +
          "</form>" +
          (rows.length
            ? '<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>Email</th><th>Role</th><th>Orders</th><th>Joined</th><th></th></tr></thead><tbody>' +
              rows
                .map(function (u) {
                  return (
                    "<tr>" +
                      '<td data-label="Email"><div class="ad-name">' + h(u.email) + '</div><div class="ad-muted">' + h(u.name || "") + "</div></td>" +
                      '<td data-label="Role"><span class="ad-pill ' + h(u.role) + '">' + h(u.role) + "</span></td>" +
                      '<td data-label="Orders">' + h(u.orderCount != null ? u.orderCount : "—") + "</td>" +
                      '<td data-label="Joined">' + when(u.createdAt) + "</td>" +
                      '<td data-label=""><a class="ad-btn ad-btn-ghost" href="#/admin/customers/' + h(u.id) + '">Open</a></td>' +
                    "</tr>"
                  );
                })
                .join("") +
              "</tbody></table></div>"
            : '<div class="ad-empty">No customers match.</div>') +
          pager(data.page || page, data.perPage || 20, data.total || 0, function (n) {
            return "#/admin/customers" + qs({ page: n, q: search, role: role });
          });
        paint(html);
      })
      .catch(function (err) {
        if (handleAuthError(err)) return;
        paint(gate("Error", "Could not load customers", humanError(err), '<button type="button" class="ad-btn ad-btn-ghost" data-ad="retry">Retry</button>'));
      });
  }

  function renderCustomer(id) {
    paint(skeleton());
    return api("GET", "/api/admin/customers/" + encodeURIComponent(id))
      .then(function (u) {
        state._customer = u;
        paint(customerHTML(u, null, null));
      })
      .catch(function (err) {
        if (handleAuthError(err)) return;
        paint(gate("Error", "Customer unavailable", humanError(err), '<a class="ad-btn ad-btn-ghost" href="#/admin/customers">Back</a>'));
      });
  }

  function customerHTML(u, notice, errMsg) {
    return (
      "<h1 class=\"ad-h1\">" + h(u.email) + "</h1>" +
      '<p class="ad-sub">Role changes are audited. The last administrator cannot be demoted.</p>' +
      flash(errMsg ? "err" : notice ? "ok" : "", errMsg || notice || "") +
      '<section class="ad-card" style="max-width:560px">' +
        '<dl class="ad-kv">' +
          kv("Id", u.id) +
          kv("Name", u.name || "—") +
          kv("Role", u.role) +
          kv("Orders", u.orderCount != null ? u.orderCount : "—") +
          kv("Created", when(u.createdAt)) +
        "</dl>" +
        '<div class="ad-actions" style="margin-top:16px">' +
          (u.role === "admin"
            ? '<button type="button" class="ad-btn ad-btn-danger" data-ad="role" data-role="customer">Demote to customer</button>'
            : '<button type="button" class="ad-btn ad-btn-primary" data-ad="role" data-role="admin">Promote to admin</button>') +
          '<a class="ad-btn ad-btn-ghost" href="#/admin/customers">Back</a>' +
        "</div>" +
      "</section>"
    );
  }

  function changeRole(next) {
    var u = state._customer;
    if (!u) return;
    confirmModal(
      next === "admin" ? "Grant administrator access?" : "Remove administrator access?",
      next === "admin"
        ? "This person will be able to reach house controls after the server re-reads their role."
        : "The last remaining administrator cannot be demoted. This is enforced by the API.",
      next === "admin" ? "Promote" : "Demote",
      next !== "admin",
      function () {
        api("PATCH", "/api/admin/customers/" + encodeURIComponent(u.id), { role: next })
          .then(function (row) {
            state._customer = row;
            paint(customerHTML(row, "Role updated.", null));
          })
          .catch(function (err) {
            if (handleAuthError(err)) return;
            var msg = humanError(err);
            if (err.status === 409) msg = err.message || "Cannot demote the last admin.";
            paint(customerHTML(state._customer, null, msg));
          });
      }
    );
  }

  function renderContent() {
    var tab = state.parts[1] === "drops" ? "drops" : "articles";
    paint(skeleton());
    var load = tab === "drops" ? api("GET", "/api/admin/drops") : api("GET", "/api/admin/articles");
    return load
      .then(function (data) {
        var html =
          "<h1 class=\"ad-h1\">Content</h1>" +
          '<p class="ad-sub">Articles and drops only. Deals are product compare-at prices — edit them on the product.</p>' +
          '<div class="ad-tabs">' +
            '<a class="ad-tab' + (tab === "articles" ? " is-on" : "") + '" href="#/admin/content">Articles</a>' +
            '<a class="ad-tab' + (tab === "drops" ? " is-on" : "") + '" href="#/admin/content/drops">Drops</a>' +
          "</div>" +
          (tab === "drops" ? dropsHTML(data.drops || []) : articlesHTML(data.articles || []));
        paint(html);
      })
      .catch(function (err) {
        if (handleAuthError(err)) return;
        paint(gate("Error", "Content unavailable", humanError(err), '<button type="button" class="ad-btn ad-btn-ghost" data-ad="retry">Retry</button>'));
      });
  }

  function articlesHTML(rows) {
    return (
      '<form class="ad-card ad-form" data-ad-form="article" style="margin-bottom:16px">' +
        field("id", "Id", "", true, "note-id") +
        field("kind", "Kind", "Essay", true) +
        field("date", "Date", "", true, "07 Sep 2026") +
        field("title", "Title", "", true) +
        '<div class="full"><label>Excerpt</label><textarea class="ad-field" name="excerpt"></textarea></div>' +
        '<div class="full"><label>Body (one paragraph per line)</label><textarea class="ad-field" name="body"></textarea></div>' +
        '<div class="full"><button class="ad-btn ad-btn-primary" type="submit">Create article</button></div>' +
      "</form>" +
      (rows.length
        ? rows
            .map(function (a) {
              return (
                '<article class="ad-card" style="margin-bottom:10px" data-article-id="' + h(a.id) + '">' +
                  '<div class="ad-muted">' + h(a.kind) + " · " + h(a.date) + " · " + h(a.id) + "</div>" +
                  "<h2>" + h(a.title) + "</h2>" +
                  '<form data-ad-form="article-edit" data-id="' + h(a.id) + '">' +
                    '<input class="ad-field" name="title" value="' + h(a.title) + '" style="margin:8px 0" />' +
                    '<textarea class="ad-field" name="excerpt" style="margin-bottom:8px">' + h(a.excerpt || "") + "</textarea>" +
                    '<textarea class="ad-field" name="body">' + h(Array.isArray(a.body) ? a.body.join("\n") : "") + "</textarea>" +
                    '<input type="hidden" name="kind" value="' + h(a.kind) + '" />' +
                    '<input type="hidden" name="date" value="' + h(a.date) + '" />' +
                    '<div class="ad-actions" style="margin-top:10px">' +
                      '<button class="ad-btn ad-btn-primary" type="submit">Save</button>' +
                      '<button class="ad-btn ad-btn-danger" type="button" data-ad="del-article" data-id="' + h(a.id) + '">Delete</button>' +
                    "</div>" +
                  "</form>" +
                "</article>"
              );
            })
            .join("")
        : '<div class="ad-empty">No articles.</div>')
    );
  }

  function dropsHTML(rows) {
    return (
      '<form class="ad-card ad-form" data-ad-form="drop" style="margin-bottom:16px">' +
        '<div class="full"><label>Ends at (ISO)</label><input class="ad-field" name="endsAt" placeholder="2026-10-15T20:00:00.000Z" /></div>' +
        '<div class="full"><label>Product ids (comma separated)</label><input class="ad-field" name="items" placeholder="drift, halo, type" /></div>' +
        '<div class="full"><button class="ad-btn ad-btn-primary" type="submit">Create drop</button></div>' +
      "</form>" +
      (rows.length
        ? rows
            .map(function (d) {
              var ids = (d.items || []).map(function (it) { return it.productId; }).join(", ");
              return (
                '<article class="ad-card" style="margin-bottom:10px">' +
                  '<div class="ad-muted">' + h(d.id) + " · ends " + when(d.endsAt) + "</div>" +
                  '<form data-ad-form="drop-edit" data-id="' + h(d.id) + '">' +
                    '<input class="ad-field" name="endsAt" value="' + h(d.endsAt) + '" style="margin:8px 0" />' +
                    '<input class="ad-field" name="items" value="' + h(ids) + '" />' +
                    '<div class="ad-actions" style="margin-top:10px">' +
                      '<button class="ad-btn ad-btn-primary" type="submit">Save</button>' +
                      '<button class="ad-btn ad-btn-danger" type="button" data-ad="del-drop" data-id="' + h(d.id) + '">Delete</button>' +
                    "</div>" +
                  "</form>" +
                "</article>"
              );
            })
            .join("")
        : '<div class="ad-empty">No drops.</div>')
    );
  }

  function parseDropItems(text) {
    return String(text || "")
      .split(",")
      .map(function (s) { return s.trim(); })
      .filter(Boolean)
      .map(function (id, i) { return { productId: id, sort: i }; });
  }

  function renderAudit() {
    var q = listQuery();
    var page = Number(q.get("page") || 1) || 1;
    paint(skeleton());
    return api("GET", "/api/admin/audit" + qs({ page: page, perPage: 20 }))
      .then(function (data) {
        var rows = data.items || [];
        var html =
          "<h1 class=\"ad-h1\">Audit log</h1>" +
          '<p class="ad-sub">Read-only. Events are written by the server. Metadata is escaped as text.</p>' +
          (rows.length
            ? '<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>When</th><th>Action</th><th>Actor</th><th>Target</th><th>Meta</th></tr></thead><tbody>' +
              rows
                .map(function (a) {
                  var meta = a.metadata ? JSON.stringify(a.metadata) : "";
                  return (
                    "<tr>" +
                      '<td data-label="When">' + when(a.createdAt) + "</td>" +
                      '<td data-label="Action"><div class="ad-name">' + h(a.action) + "</div></td>" +
                      '<td data-label="Actor">' + h(a.actorId || "—") + "</td>" +
                      '<td data-label="Target">' + h(a.targetType) + " · " + h(a.targetId || "—") + "</td>" +
                      '<td data-label="Meta"><div class="ad-code">' + h(meta) + "</div></td>" +
                    "</tr>"
                  );
                })
                .join("") +
              "</tbody></table></div>"
            : '<div class="ad-empty">No audit events.</div>') +
          pager(data.page || page, data.perPage || 20, data.total || 0, function (n) {
            return "#/admin/audit" + qs({ page: n });
          });
        paint(html);
      })
      .catch(function (err) {
        if (handleAuthError(err)) return;
        paint(gate("Error", "Audit unavailable", humanError(err), '<button type="button" class="ad-btn ad-btn-ghost" data-ad="retry">Retry</button>'));
      });
  }

  function applySearch(kind, form) {
    var raw = readForm(form);
    var next = { page: 1 };
    if (raw.q) next.q = raw.q;
    if (kind === "products") {
      if (raw.active) next.active = raw.active;
      if (raw.sort) next.sort = raw.sort;
      location.hash = "#/admin/products" + qs(next);
    } else if (kind === "orders") {
      if (raw.status) next.status = raw.status;
      location.hash = "#/admin/orders" + qs(next);
    } else if (kind === "customers") {
      if (raw.role) next.role = raw.role;
      location.hash = "#/admin/customers" + qs(next);
    }
  }

  function debounceSearch(kind, form) {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(function () {
      applySearch(kind, form);
    }, 320);
  }

  function logout() {
    api("POST", "/api/auth/logout", {})
      .catch(function () {})
      .then(function () {
        if (typeof root.__nexoraApplyUser === "function") root.__nexoraApplyUser(null);
        location.hash = "#/";
      });
  }

  function bind() {
    var node = el();
    if (!node || node.getAttribute("data-bound") === "1") return;
    node.setAttribute("data-bound", "1");
    node.addEventListener("click", function (e) {
      var t = e.target.closest("[data-ad]");
      if (!t) {
        return;
      }
      var act = t.getAttribute("data-ad");
      if (act === "menu") {
        state.navOpen = !state.navOpen;
        node.classList.toggle("nav-open", state.navOpen);
        return;
      }
      if (act === "close-nav") {
        state.navOpen = false;
        node.classList.remove("nav-open");
        return;
      }
      if (act === "signin") {
        openAccount();
        return;
      }
      if (act === "retry") {
        retry();
        return;
      }
      if (act === "logout") {
        logout();
        return;
      }
      if (act === "modal-cancel" || act === "modal-dismiss") {
        closeModal();
        return;
      }
      if (act === "modal-ok") {
        var fn = state.modal && state.modal.onOk;
        closeModal();
        if (typeof fn === "function") fn();
        return;
      }
      if (act === "archive") {
        archiveProduct(t.getAttribute("data-id"));
        return;
      }
      if (act === "cancel-order") {
        cancelOrder();
        return;
      }
      if (act === "dispatch-order") {
        dispatchOrder();
        return;
      }
      if (act === "role") {
        changeRole(t.getAttribute("data-role"));
        return;
      }
      if (act === "del-article") {
        confirmModal("Delete this article?", "This removes the journal note from the public catalog.", "Delete", true, function () {
          api("DELETE", "/api/admin/articles/" + encodeURIComponent(t.getAttribute("data-id")))
            .then(function () { location.hash = "#/admin/content"; retry(); })
            .catch(function (err) { if (!handleAuthError(err)) { /* stay on page */ } });
        });
        return;
      }
      if (act === "del-drop") {
        confirmModal("Delete this drop?", "Drop items are removed. Products remain.", "Delete", true, function () {
          api("DELETE", "/api/admin/drops/" + encodeURIComponent(t.getAttribute("data-id")))
            .then(function () { location.hash = "#/admin/content/drops"; retry(); })
            .catch(function (err) { if (!handleAuthError(err)) { /* stay on page */ } });
        });
      }
    });
    node.addEventListener("submit", function (e) {
      var form = e.target;
      if (!form || !form.getAttribute) return;
      var kind = form.getAttribute("data-ad-form");
      var search = form.getAttribute("data-ad-search");
      if (search) {
        e.preventDefault();
        applySearch(search, form);
        return;
      }
      if (!kind) return;
      e.preventDefault();
      if (kind === "product") submitProduct(form);
      else if (kind === "inventory") submitInventory(form);
      else if (kind === "article") {
        var raw = readForm(form);
        api("POST", "/api/admin/articles", {
          id: raw.id,
          kind: raw.kind,
          date: raw.date,
          title: raw.title,
          excerpt: raw.excerpt,
          body: String(raw.body || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean),
        })
          .then(function () { retry(); })
          .catch(function (err) { if (!handleAuthError(err)) paint(gate("Error", "Could not create article", humanError(err), '<button type="button" class="ad-btn ad-btn-ghost" data-ad="retry">Back</button>')); });
      } else if (kind === "article-edit") {
        var ed = readForm(form);
        api("PATCH", "/api/admin/articles/" + encodeURIComponent(form.getAttribute("data-id")), {
          kind: ed.kind,
          date: ed.date,
          title: ed.title,
          excerpt: ed.excerpt,
          body: String(ed.body || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean),
        })
          .then(function () { retry(); })
          .catch(function (err) { if (!handleAuthError(err)) { /* stay on page */ } });
      } else if (kind === "drop") {
        var d = readForm(form);
        api("POST", "/api/admin/drops", { endsAt: d.endsAt, items: parseDropItems(d.items) })
          .then(function () { location.hash = "#/admin/content/drops"; retry(); })
          .catch(function (err) { if (!handleAuthError(err)) { /* stay on page */ } });
      } else if (kind === "drop-edit") {
        var de = readForm(form);
        api("PATCH", "/api/admin/drops/" + encodeURIComponent(form.getAttribute("data-id")), {
          endsAt: de.endsAt,
          items: parseDropItems(de.items),
        })
          .then(function () { retry(); })
          .catch(function (err) { if (!handleAuthError(err)) { /* stay on page */ } });
      }
    });
    node.addEventListener("input", function (e) {
      var form = e.target && e.target.form;
      if (form && form.getAttribute("data-ad-search")) {
        debounceSearch(form.getAttribute("data-ad-search"), form);
      }
      if (e.target && e.target.id === "ad-delta") {
        var prev = state._product ? Number(state._product.physicalStock || 0) : 0;
        var delta = parseInt(e.target.value, 10);
        var box = document.getElementById("ad-preview");
        if (box) {
          if (!Number.isInteger(delta)) box.textContent = "Resulting physical: —";
          else box.textContent = "Resulting physical: " + (prev + delta) + " · available would be physical minus reserved.";
        }
      }
    });
    node.addEventListener("change", function (e) {
      var form = e.target && e.target.form;
      if (form && form.getAttribute("data-ad-search") && e.target.tagName === "SELECT") {
        applySearch(form.getAttribute("data-ad-search"), form);
      }
    });
  }

  function bootBind() {
    var node = el();
    if (node) bind();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootBind);
  } else {
    bootBind();
  }

  root.NexoraAdmin = {
    enter: function (parts) {
      bootBind();
      enter(parts);
    },
    leave: leave,
    retry: retry,
  };
})(window);
