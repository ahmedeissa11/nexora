/* Nexora API helper — no UI. JSON. Empty NEXORA_API_BASE = same-origin. */
(function (root) {
  function apiBase() {
    var b = "";
    if (typeof root.NEXORA_API_BASE === "string") b = root.NEXORA_API_BASE.trim();
    else {
      var meta = typeof document !== "undefined" ? document.querySelector('meta[name="nexora-api-base"]') : null;
      if (meta) b = String(meta.getAttribute("content") || "").trim();
    }
    b = b.replace(/\/+$/, "");
    if (b && !/^https?:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(b)) b = "";
    return b;
  }

  function apiUrl(path) {
    var p = String(path || "");
    if (p.charAt(0) !== "/") p = "/" + p;
    return apiBase() + p;
  }

  async function apiRequest(method, path, body) {
    var opts = {
      method: method,
      credentials: apiBase() ? "include" : "same-origin",
      headers: { Accept: "application/json" },
    };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(apiUrl(path), opts);
    const data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      const err = new Error(data.error || "Request failed");
      err.status = res.status;
      throw err;
    }
    return data;
  }
  function apiGet(path) {
    return apiRequest("GET", path);
  }
  root.nexoraApiBase = apiBase;
  root.nexoraApiUrl = apiUrl;
  root.apiGet = apiGet;
  root.apiSend = apiRequest;
})(window);
