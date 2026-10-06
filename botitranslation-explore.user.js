// ==UserScript==
// @name         BotiTranslation Explore Fix
// @namespace    https://github.com/Elfidro/BotiTranslationMobile
// @version      1.0.0
// @description  Fixes repeated / missing novels on the Explore page's infinite scroll (loads the list in large stable chunks and pages through it locally) and adds a Hide button per novel, with a "Hidden novels" panel in the sidebar to undo.
// @author       Elfidro
// @homepageURL  https://github.com/Elfidro/BotiTranslationMobile
// @supportURL   https://github.com/Elfidro/BotiTranslationMobile/issues
// @updateURL    https://raw.githubusercontent.com/Elfidro/BotiTranslationMobile/main/botitranslation-explore.user.js
// @downloadURL  https://raw.githubusercontent.com/Elfidro/BotiTranslationMobile/main/botitranslation-explore.user.js
// @match        https://www.botitranslation.com/explore*
// @match        https://botitranslation.com/explore*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // The Explore page infinite-scrolls GET .../api/v1/content/books?pageNumber=N
  // (axios, i.e. XMLHttpRequest). The server sorts on a column that is the same
  // for every book, so with the site's pageSize=20 the row order changes between
  // requests: pages overlap, books repeat and others never show up. Large pages
  // (1000) come back complete and disjoint, so this script intercepts the
  // page's requests, loads the list in 1000-book chunks per filter combination
  // (only as far as you scroll: "All" is ~20,000 books / ~45 MB) and serves the
  // site's 20-book pages from it with a cursor. Hidden books are skipped when
  // serving, so hiding mid-scroll never skips or repeats one.

  var STORE_KEY = 'boti-hidden-books';
  var CHUNK = 1000;   // books per upstream request
  var PREFETCH = 300; // load the next chunk when fewer unserved books than this are left

  // ---------------------------------------------------------------- storage

  function loadHidden() {
    try {
      var o = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
    } catch (e) {
      return {};
    }
  }

  function saveHidden() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(hidden));
    } catch (e) { /* storage blocked: keep the in-memory copy */ }
  }

  var hidden = loadHidden();

  function isHidden(id) {
    return Object.prototype.hasOwnProperty.call(hidden, String(id));
  }

  function hiddenCount() {
    return Object.keys(hidden).length;
  }

  // ---------------------------------------------------------- XHR intercept

  var proto = window.XMLHttpRequest.prototype;
  var origOpen = proto.open;
  var origSetHeader = proto.setRequestHeader;
  var origSend = proto.send;
  var origAbort = proto.abort;
  var STATE = new WeakMap();

  // filter key -> loaded books + cursor state, see newEntry()
  var caches = {};

  function parseBooksUrl(url) {
    var u;
    try { u = new URL(url, location.href); } catch (e) { return null; }
    if (!/\/api\/v1\/content\/books\/?$/.test(u.pathname)) return null;
    if (!u.searchParams.has('pageNumber')) return null;
    var pairs = [];
    u.searchParams.forEach(function (v, k) {
      if (k !== 'pageNumber' && k !== 'pageSize') pairs.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    pairs.sort();
    return {
      url: u,
      key: u.origin + u.pathname + '?' + pairs.join('&'),
      pageNumber: parseInt(u.searchParams.get('pageNumber'), 10) || 1,
      pageSize: parseInt(u.searchParams.get('pageSize'), 10) || 20
    };
  }

  function urlWithPaging(info, pageNumber, size) {
    var u = new URL(info.url.href);
    u.searchParams.set('pageNumber', String(pageNumber));
    u.searchParams.set('pageSize', String(size));
    return u.href;
  }

  function getJson(url, req) {
    return fetch(url, {
      method: 'GET',
      headers: req.headers, // Accept, lang, site-domain (+ Authorization when signed in)
      credentials: req.withCredentials ? 'include' : 'omit'
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      if (!j || j.code !== 0 || !j.data || !Array.isArray(j.data.list)) {
        throw new Error('bad response: ' + (j && j.message));
      }
      return j.data;
    });
  }

  function dedupe(list) {
    var seen = {};
    return list.filter(function (b) {
      var id = b && b.id != null ? String(b.id) : null;
      if (id === null || seen[id]) return false;
      seen[id] = true;
      return true;
    });
  }

  function makeData(size, visibleCount, totalPages, slice) {
    return {
      pageSize: size,
      totalCount: visibleCount,
      totalPages: totalPages,
      list: slice
    };
  }

  function newEntry(info, req) {
    return {
      info: info,       // any request of this filter key (URL template for chunks)
      req: req,         // latest intercepted request (headers for chunk fetches)
      list: [],         // books loaded so far, in chunk order, unique by id
      seen: {},         // id -> true for everything in `list`
      nextChunk: 1,
      total: null,      // server's totalCount, known after the first chunk
      complete: false,  // every book is in `list`
      loading: null,    // in-flight chunk promise
      served: {},       // id -> true, books handed to the page in this pass
      cursor: 0         // index in `list` where the next page starts looking
    };
  }

  function append(entry, books) {
    for (var i = 0; i < books.length; i++) {
      var b = books[i];
      var id = b && b.id != null ? String(b.id) : null;
      if (id === null || entry.seen[id]) continue;
      entry.seen[id] = true;
      entry.list.push(b);
    }
  }

  // Load the next 1000-book chunk. After the last one, if the chunks somehow
  // missed books (list shorter than totalCount), fetch everything in a single
  // request and append whatever is missing.
  function loadMore(entry) {
    if (entry.loading) return entry.loading;
    if (entry.complete) return Promise.resolve();
    var p;
    if (entry.total !== null && (entry.nextChunk - 1) * CHUNK >= entry.total) {
      p = entry.list.length >= entry.total
        ? Promise.resolve()
        : getJson(urlWithPaging(entry.info, 1, entry.total), entry.req).then(function (d) { append(entry, d.list); });
      p = p.then(function () { entry.complete = true; });
    } else {
      p = getJson(urlWithPaging(entry.info, entry.nextChunk, CHUNK), entry.req).then(function (d) {
        entry.total = parseInt(d.totalCount, 10) || 0;
        append(entry, d.list);
        entry.nextChunk++;
        if (!d.list.length) entry.complete = true; // ran past the end
      });
    }
    entry.loading = p.then(function () {
      entry.loading = null;
    }, function (err) {
      entry.loading = null;
      throw err;
    });
    return entry.loading;
  }

  // loaded books after the cursor that can still be served
  function available(entry) {
    var n = 0;
    for (var i = entry.cursor; i < entry.list.length; i++) {
      var id = String(entry.list[i].id);
      if (!entry.served[id] && !isHidden(id)) n++;
    }
    return n;
  }

  function ensure(entry, need) {
    if (entry.complete || available(entry) >= need) return Promise.resolve();
    return loadMore(entry).then(function () { return ensure(entry, need); });
  }

  function prefetch(entry) {
    if (!entry.complete && !entry.loading && available(entry) < PREFETCH) {
      loadMore(entry).catch(function () {}); // retried on the next page request
    }
  }

  // Not-yet-loaded books count as remaining too. An over-estimate only costs
  // one extra (empty) page request at the very end; an under-estimate would
  // stop the scroll early.
  function totalPagesFor(entry, info, left) {
    var unloaded = entry.complete || entry.total === null ? 0 : Math.max(0, entry.total - entry.list.length);
    return info.pageNumber + Math.ceil((left + unloaded) / info.pageSize);
  }

  // Take the next `size` books after the cursor that are neither hidden nor
  // already served in this pass. totalPages is reported as "this page plus
  // whatever is left", because the page stops asking once
  // pageNumber > totalPages; ceil(visible / size) would end the scroll a page
  // early after hiding books that were already shown.
  function servePage(entry, info) {
    var list = entry.list;
    var size = info.pageSize;
    var out = [];
    var i = entry.cursor;
    for (; i < list.length && out.length < size; i++) {
      var id = String(list[i].id);
      if (entry.served[id] || isHidden(id)) continue;
      entry.served[id] = true;
      out.push(list[i]);
    }
    entry.cursor = i;
    var known = entry.complete ? list.length : Math.max(list.length, entry.total || 0);
    var visible = Math.max(0, known - hiddenCount());
    return makeData(size, visible, totalPagesFor(entry, info, available(entry)), out);
  }

  // First page before the first chunk has arrived: serve the server's own
  // page 1 so the list appears as fast as before. Its ids go into `served`,
  // so the cursor pass skips them later.
  function quickFirstPage(entry, info, req) {
    return getJson(info.url.href, req).then(function (d) {
      if (available(entry) >= info.pageSize) return servePage(entry, info);
      var out = [];
      dedupe(d.list).forEach(function (b) {
        var id = String(b.id);
        if (isHidden(id) || entry.served[id]) return;
        entry.served[id] = true;
        out.push(b);
      });
      var total = parseInt(d.totalCount, 10) || 0;
      var rest = Math.max(0, total - out.length);
      return makeData(info.pageSize, total, info.pageNumber + Math.ceil(rest / info.pageSize), out);
    }, function () {
      return ensure(entry, info.pageSize).then(function () { return servePage(entry, info); });
    });
  }

  function getEntry(info, req) {
    var entry = caches[info.key];
    if (!entry) entry = caches[info.key] = newEntry(info, req);
    entry.req = req;
    return entry;
  }

  function defineValue(xhr, name, value) {
    Object.defineProperty(xhr, name, { configurable: true, get: function () { return value; } });
  }

  function fire(xhr, type, n) {
    var ev;
    try {
      ev = type === 'readystatechange'
        ? new Event(type)
        : new ProgressEvent(type, { lengthComputable: true, loaded: n, total: n });
    } catch (e) {
      ev = document.createEvent('Event');
      ev.initEvent(type, false, false);
    }
    // dispatchEvent also runs the on<type> handler properties (axios uses onloadend)
    xhr.dispatchEvent(ev);
  }

  function deliver(xhr, req, data) {
    if (req.aborted) return;
    var body = { code: 0, message: 'success', data: data };
    var text = JSON.stringify(body);
    defineValue(xhr, 'readyState', 4);
    defineValue(xhr, 'status', 200);
    defineValue(xhr, 'statusText', 'OK');
    defineValue(xhr, 'responseURL', req.absUrl);
    defineValue(xhr, 'responseText', text);
    defineValue(xhr, 'response', xhr.responseType === 'json' ? body : text);
    xhr.getAllResponseHeaders = function () { return 'content-type: application/json\r\n'; };
    xhr.getResponseHeader = function (name) {
      return String(name).toLowerCase() === 'content-type' ? 'application/json' : null;
    };
    fire(xhr, 'readystatechange');
    fire(xhr, 'load', text.length);
    fire(xhr, 'loadend', text.length);
  }

  // Books already on screen count as served. Normally that is exactly what
  // `served` holds anyway; it matters when the script started late (some
  // userscript managers inject after the first page has rendered).
  function markRendered(entry) {
    var links = document.querySelectorAll('.list .card .info a[href*="/book/"]');
    for (var i = 0; i < links.length; i++) {
      var m = /\/book\/(\d+)/.exec(links[i].getAttribute('href'));
      if (m) entry.served[m[1]] = true;
    }
  }

  function intercept(xhr, req, info, sendArgs) {
    req.withCredentials = !!xhr.withCredentials;
    var entry = getEntry(info, req);
    if (info.pageNumber === 1) {
      entry.served = {};
      entry.cursor = 0;
    }
    markRendered(entry);
    var p;
    if (info.pageNumber === 1 && available(entry) < info.pageSize && !entry.complete) {
      loadMore(entry).catch(function () {}); // start the first chunk alongside
      p = quickFirstPage(entry, info, req);
    } else {
      p = ensure(entry, info.pageSize).catch(function (err) {
        if (!available(entry)) throw err; // nothing to serve: fall back
      }).then(function () { return servePage(entry, info); });
    }
    p.then(function (data) {
      deliver(xhr, req, data);
      prefetch(entry);
    }, function (err) {
      // could not build the page ourselves: let the original request through
      try { console.warn('[BotiTranslation Explore Fix] falling back to the site request:', err); } catch (e) {}
      if (!req.aborted) origSend.apply(xhr, sendArgs);
    });
  }

  proto.open = function (method, url) {
    STATE.set(this, { method: String(method).toUpperCase(), url: String(url), headers: {}, aborted: false });
    return origOpen.apply(this, arguments);
  };

  proto.setRequestHeader = function (name, value) {
    var req = STATE.get(this);
    if (req) req.headers[name] = value;
    return origSetHeader.apply(this, arguments);
  };

  proto.abort = function () {
    var req = STATE.get(this);
    if (req) req.aborted = true;
    return origAbort.apply(this, arguments);
  };

  proto.send = function () {
    var req = STATE.get(this);
    var info = req && req.method === 'GET' ? parseBooksUrl(req.url) : null;
    if (!info) return origSend.apply(this, arguments);
    req.absUrl = info.url.href;
    intercept(this, req, info, arguments);
  };

  // ------------------------------------------------------------------- DOM

  var CSS = [
    '.list .card .btns .boti-hide-btn{width:auto !important;padding:0 14px !important;opacity:.75}',
    '.list .card .btns .boti-hide-btn:hover{opacity:1}',
    '.list .card.boti-hiding{transition:opacity .2s;opacity:0}',
    '.boti-hidden-panel .boti-hidden-toggle{cursor:pointer;user-select:none}',
    '.boti-hidden-panel .boti-caret{display:inline-block;font-size:12px;margin-left:4px;opacity:.6}',
    '.boti-hidden-body{padding:0 0 10px 24px;font-size:13px}',
    '.boti-hidden-row{display:flex;align-items:baseline;gap:6px;padding:4px 0;border-bottom:1px solid rgba(128,128,128,.25)}',
    '.boti-hidden-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.85}',
    '.boti-hidden-body a{flex:none;cursor:pointer;text-decoration:none}',
    '.boti-hidden-body a:hover{text-decoration:underline}',
    '.boti-hidden-empty{opacity:.6;padding:4px 0}',
    '.boti-unhide-all{display:inline-block;margin-top:8px}'
  ].join('\n');

  var panelOpen = false;

  function injectStyle() {
    if (document.getElementById('boti-explore-style')) return;
    var style = document.createElement('style');
    style.id = 'boti-explore-style';
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function cardInfo(card) {
    var link = card.querySelector('.info a[href*="/book/"]');
    var m = link && /\/book\/(\d+)/.exec(link.getAttribute('href'));
    if (!m) return null;
    var nameLink = card.querySelector('.book-name a') || link;
    return { id: m[1], title: (nameLink.textContent || '').replace(/\s+/g, ' ').trim() };
  }

  function processCards() {
    var cards = document.querySelectorAll('.list .card');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var info = cardInfo(card);
      if (!info) continue;
      if (isHidden(info.id)) {
        card.parentNode.removeChild(card);
        continue;
      }
      if (card.querySelector('.boti-hide-btn')) continue;
      var btns = card.querySelector('.btns');
      if (!btns) continue;
      var btn = document.createElement('div');
      btn.className = 'btn btn-second boti-hide-btn';
      btn.setAttribute('data-boti-id', info.id);
      btn.setAttribute('title', 'Hide this novel from Explore');
      btn.textContent = 'Hide';
      btns.appendChild(btn);
    }
  }

  function hideBook(card) {
    var info = cardInfo(card);
    if (!info) return;
    hidden[info.id] = { title: info.title, at: Date.now() };
    saveHidden();
    renderPanel();
    card.classList.add('boti-hiding');
    setTimeout(function () {
      if (card.parentNode) card.parentNode.removeChild(card);
    }, 200);
  }

  function unhide(id) {
    delete hidden[id];
    saveHidden();
    renderPanel();
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function findPanelAnchor() {
    var filters = document.querySelector('.filters');
    if (!filters) return null;
    var genre = filters.querySelector('.filter-item[data-filter="genre"]');
    var genreFilter = genre && genre.closest('.filter');
    if (genreFilter && genreFilter.parentNode === filters) return { parent: filters, after: genreFilter };
    var all = filters.querySelectorAll(':scope > .filter:not(.boti-hidden-panel)');
    if (all.length) return { parent: filters, after: all[all.length - 1] };
    return null; // filters are built after the genre list loads
  }

  function ensurePanel() {
    var panels = document.querySelectorAll('.boti-hidden-panel');
    for (var i = 1; i < panels.length; i++) panels[i].parentNode.removeChild(panels[i]);
    var panel = panels[0];
    var anchor = findPanelAnchor();
    if (!anchor) return;
    if (!panel) {
      panel = el('div', 'filter boti-hidden-panel');
      var toggle = el('div', 'all boti-hidden-toggle');
      toggle.setAttribute('role', 'button');
      toggle.setAttribute('tabindex', '0');
      panel.appendChild(toggle);
      panel.appendChild(el('div', 'boti-hidden-body'));
    }
    if (anchor.after.nextSibling !== panel) {
      anchor.parent.insertBefore(panel, anchor.after.nextSibling);
    }
    renderPanel();
  }

  function renderPanel() {
    var panel = document.querySelector('.boti-hidden-panel');
    if (!panel) return;
    var toggle = panel.querySelector('.boti-hidden-toggle');
    var body = panel.querySelector('.boti-hidden-body');
    var ids = Object.keys(hidden).sort(function (a, b) {
      return ((hidden[b] && hidden[b].at) || 0) - ((hidden[a] && hidden[a].at) || 0);
    });

    toggle.textContent = 'Hidden novels (' + ids.length + ')';
    toggle.appendChild(el('span', 'boti-caret', panelOpen ? '▾' : '▸'));
    toggle.setAttribute('aria-expanded', panelOpen ? 'true' : 'false');
    body.style.display = panelOpen ? '' : 'none';

    body.textContent = '';
    if (!ids.length) {
      body.appendChild(el('div', 'boti-hidden-empty', 'Nothing hidden.'));
      return;
    }
    ids.forEach(function (id) {
      var title = (hidden[id] && hidden[id].title) || ('Book ' + id);
      var row = el('div', 'boti-hidden-row');
      var name = el('span', 'boti-hidden-title', title);
      name.setAttribute('title', title);
      var link = el('a', 'boti-unhide', 'Unhide');
      link.href = '#';
      link.setAttribute('data-boti-id', id);
      row.appendChild(name);
      row.appendChild(link);
      body.appendChild(row);
    });
    var all = el('a', 'boti-unhide-all', 'Unhide all');
    all.href = '#';
    body.appendChild(all);
  }

  function onClick(e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var hideBtn = t.closest('.boti-hide-btn');
    if (hideBtn) {
      e.preventDefault();
      var card = hideBtn.closest('.card');
      if (card) hideBook(card);
      return;
    }
    if (t.closest('.boti-hidden-toggle')) {
      panelOpen = !panelOpen;
      renderPanel();
      return;
    }
    var un = t.closest('.boti-unhide');
    if (un) {
      e.preventDefault();
      unhide(un.getAttribute('data-boti-id'));
      return;
    }
    if (t.closest('.boti-unhide-all')) {
      e.preventDefault();
      var n = hiddenCount();
      if (n > 1 && !window.confirm('Unhide all ' + n + ' novels?')) return;
      hidden = {};
      saveHidden();
      renderPanel();
    }
  }

  function onKey(e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.closest && e.target.closest('.boti-hidden-toggle')) {
      e.preventDefault();
      panelOpen = !panelOpen;
      renderPanel();
    }
  }

  function initDom() {
    injectStyle();
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);

    // another tab hid / unhid something
    window.addEventListener('storage', function (e) {
      if (e.key !== STORE_KEY) return;
      hidden = loadHidden();
      renderPanel();
      processCards();
    });

    var list = document.getElementById('listContainer') || document.querySelector('.list');
    if (list) new MutationObserver(processCards).observe(list, { childList: true });
    var filters = document.querySelector('.filters');
    if (filters) new MutationObserver(ensurePanel).observe(filters, { childList: true });
    processCards();
    ensurePanel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDom);
  } else {
    initDom();
  }
})();
