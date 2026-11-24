/* ==========================================================================
   LUMIBELLE — script.js (shared by every page)
   Each section runs only if the page contains its elements.

   Element IDs used:
   - product.html : #filter-bar, #product-list
   - order.html   : #orderForm, #customerName, #contact, #items, #total, #note
   - admin.html   : #ordersTable (tbody inside it)
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------------
     Config
     ------------------------------------------------------------------------ */
  var PRODUCTS_URL = "products.json";

  var ORDER_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbxJ5h8vK9vnzySIWVEN93ZTFQjG51DYrjTPIWYjnr6ZKrLXCbrNjvkNdD3fFh5QnL7Nnw/exec";

  var ORDERS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vR2o0j7ZbIAT5sZuYNpSyyx_KEHBoNwR4ue9hxodPNSVVyMPwZ5DjJVe1_wl9QG4uNGkcUxcTlYFt6L/pub?gid=0&single=true&output=csv";

  var MOODS = [
    { key: "all", label: "ทั้งหมด" },
    { key: "fresh", label: "Fresh" },
    { key: "sweet", label: "Sweet" },
    { key: "confident", label: "Confident" },
    { key: "romance", label: "Romance" }
  ];

  var TYPE_LABELS = { spray: "สเปรย์", rollon: "โรลออน" };

  /* ------------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------------ */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function formatPrice(n) {
    return Number(n).toLocaleString("th-TH");
  }

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function validMood(value) {
    if (!value) return "all";
    value = String(value).toLowerCase();
    return MOODS.some(function (m) { return m.key === value; }) ? value : "all";
  }

  /* ------------------------------------------------------------------------
     1) product.html — product cards + mood filter
     ------------------------------------------------------------------------ */
  function initProducts() {
    var filterBar = document.getElementById("filter-bar");
    var list = document.getElementById("product-list");
    if (!filterBar || !list) return;

    filterBar.classList.add("mood-filter");
    list.classList.add("product-grid");

    var products = [];
    var currentMood = validMood(getParam("mood"));

    function buildOrderUrl(p) {
      var itemName = p.size ? p.name + " " + p.size : p.name;
      return (
        "order.html?item=" + encodeURIComponent(itemName) +
        "&price=" + encodeURIComponent(p.price)
      );
    }

    function buildCard(p) {
      var card = el("article", "card mood mood--" + p.mood);

      var media = el("a", "card__media");
      media.href = buildOrderUrl(p);
      var img = document.createElement("img");
      img.src = p.image;
      img.alt = p.name;
      img.loading = "lazy";
      media.appendChild(img);

      var body = el("div", "card__body");

      var meta = el("div", "card__meta");
      meta.appendChild(el("span", "mood-dot"));
      meta.appendChild(el("span", null, TYPE_LABELS[p.type] || p.type));

      var title = el("h3", "card__title", p.name);

      var foot = el("div", "card__foot");
      var priceBox = el("div");
      var price = el("span", "price", formatPrice(p.price));
      price.appendChild(el("small", null, "บาท"));
      priceBox.appendChild(price);
      if (p.size) {
        priceBox.appendChild(document.createElement("br"));
        priceBox.appendChild(el("span", "muted", p.size));
      }

      var btn = el("a", "btn", "สั่งซื้อ");
      btn.href = buildOrderUrl(p);

      foot.appendChild(priceBox);
      foot.appendChild(btn);

      body.appendChild(meta);
      body.appendChild(title);
      body.appendChild(foot);

      card.appendChild(media);
      card.appendChild(body);
      return card;
    }

    function render() {
      list.innerHTML = "";
      var shown = products.filter(function (p) {
        return currentMood === "all" || p.mood === currentMood;
      });

      if (!shown.length) {
        list.appendChild(el("p", "muted", "ไม่พบสินค้าในหมวดนี้"));
        return;
      }
      shown.forEach(function (p) { list.appendChild(buildCard(p)); });
    }

    function updateButtons() {
      Array.prototype.forEach.call(filterBar.querySelectorAll("button"), function (b) {
        var active = b.dataset.mood === currentMood;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }

    function setMood(mood) {
      currentMood = mood;
      updateButtons();
      render();
      if (window.history && history.replaceState) {
        var url = new URL(window.location.href);
        if (mood === "all") url.searchParams.delete("mood");
        else url.searchParams.set("mood", mood);
        history.replaceState(null, "", url);
      }
    }

    // Build filter buttons
    filterBar.innerHTML = "";
    MOODS.forEach(function (m) {
      var b = el("button", m.key === "all" ? "" : "mood mood--" + m.key);
      b.type = "button";
      b.dataset.mood = m.key;
      if (m.key !== "all") b.appendChild(el("span", "mood-dot"));
      b.appendChild(el("span", null, m.label));
      b.addEventListener("click", function () { setMood(m.key); });
      filterBar.appendChild(b);
    });
    updateButtons();

    // Load products
    fetch(PRODUCTS_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        products = data;
        render();
      })
      .catch(function (err) {
        console.error(err);
        list.innerHTML = "";
        list.appendChild(el("p", "muted", "ไม่สามารถโหลดสินค้าได้ กรุณารีเฟรชหน้านี้"));
      });
  }

  /* ------------------------------------------------------------------------
     2) order.html — prefill form + submit
     ------------------------------------------------------------------------ */
  function initOrder() {
    var form = document.getElementById("orderForm");
    if (!form) return;

    var itemsInput = document.getElementById("items");
    var totalInput = document.getElementById("total");

    // Prefill from URL parameters (both fields)
    var item = getParam("item");
    var price = getParam("price");
    if (itemsInput && item) itemsInput.value = item;
    if (totalInput && price) totalInput.value = price;

    function val(id) {
      var node = document.getElementById(id);
      return node ? node.value : "";
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var payload = {
        customerName: val("customerName"),
        contact: val("contact"),
        items: val("items"),
        total: val("total"),
        note: val("note")
      };

      fetch(ORDER_ENDPOINT, {
        method: "POST",
        body: JSON.stringify(payload)
      })
      .then(() => { window.location.href = 'thankyou.html'; })
      .catch(error => {
        console.error(error);
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      });
    });
  }

  /* ------------------------------------------------------------------------
     3) admin.html — load CSV and render table
     ------------------------------------------------------------------------ */

  // Minimal CSV parser: handles quoted fields, escaped quotes ("") and
  // line breaks inside quotes. Returns an array of rows (arrays of strings).
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;

    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM

    for (var i = 0; i < text.length; i++) {
      var c = text[i];

      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
      } else {
        field += c;
      }
    }

    if (field !== "" || row.length) {
      row.push(field);
      rows.push(row);
    }

    // drop completely empty rows
    return rows.filter(function (r) {
      return r.some(function (cell) { return cell.trim() !== ""; });
    });
  }

  function initAdmin() {
    var table = document.getElementById("ordersTable");
    if (!table) return;

    var tbody = table.querySelector("tbody");
    if (!tbody) return;

    function showMessage(msg) {
      tbody.innerHTML = "";
      var tr = document.createElement("tr");
      var td = el("td", "muted", msg);
      td.colSpan = 6;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    showMessage("กำลังโหลดข้อมูล...");

    fetch(ORDERS_CSV_URL, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text);
        rows.shift(); // remove header row

        if (!rows.length) {
          showMessage("ยังไม่มีรายการสั่งซื้อ");
          return;
        }

        // Newest first (sheet appends new orders at the bottom)
        rows.reverse();

        tbody.innerHTML = "";
        rows.forEach(function (r) {
          var tr = document.createElement("tr");
          // columns: date/time, name, contact, items, total, note
          for (var i = 0; i < 6; i++) {
            var value = r[i] !== undefined ? r[i] : "";
            tr.appendChild(el("td", null, value));
          }
          tbody.appendChild(tr);
        });
      })
      .catch(function (err) {
        console.error(err);
        showMessage("ไม่สามารถโหลดข้อมูลได้ กรุณารีเฟรชหน้านี้");
      });
  }

  /* ------------------------------------------------------------------------
     Init
     ------------------------------------------------------------------------ */
  function init() {
    initProducts();
    initOrder();
    initAdmin();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
