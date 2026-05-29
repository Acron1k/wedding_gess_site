/*
 * Подстановка текста в вариант приглашения.
 * 1. В HTML уже лежит текст по умолчанию (из content.js) — это fallback.
 * 2. При загрузке тянем сохранённый текст из /api/content и переопределяем.
 * 3. Слушаем сообщения от редактора (editor.html) для живого превью.
 *
 * Если /api недоступен (локальный просмотр, file://) — просто остаётся
 * дефолтный текст, страница не ломается.
 */
(function () {
  "use strict";

  var defaults = window.DEFAULT_CONTENT || {};

  function get(obj, path) {
    return path.split(".").reduce(function (o, k) {
      return o && o[k] != null ? o[k] : undefined;
    }, obj);
  }

  function deepMerge(a, b) {
    var out = {};
    var k;
    for (k in a) out[k] = a[k];
    for (k in b) {
      if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k])) {
        out[k] = deepMerge(a[k] || {}, b[k]);
      } else {
        out[k] = b[k];
      }
    }
    return out;
  }

  function apply(content) {
    var nodes = document.querySelectorAll("[data-c]");
    for (var i = 0; i < nodes.length; i++) {
      var v = get(content, nodes[i].getAttribute("data-c"));
      if (v != null) nodes[i].textContent = v;
    }
  }

  // 2. подтянуть сохранённый текст из БД
  if (typeof fetch === "function") {
    fetch("/api/content")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && data.content) apply(deepMerge(defaults, data.content));
      })
      .catch(function () { /* оффлайн — остаётся дефолт */ });
  }

  // 3. живой превью из редактора
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "wedding-preview" && e.data.content) {
      apply(deepMerge(defaults, e.data.content));
    }
  });
})();
