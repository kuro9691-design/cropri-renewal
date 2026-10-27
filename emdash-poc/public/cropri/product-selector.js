(function () {
  'use strict';
  var prices = {
    white: { S: 880, M: 880, L: 880, XL: 880, XXL: 1100, XXXL: 1320 },
    color: { S: 957, M: 957, L: 957, XL: 957, XXL: 1298, XXXL: 1463 }
  };

  function init(selector) {
    if (selector.dataset.ready) return;
    selector.dataset.ready = 'true';
    var colors = Array.prototype.slice.call(selector.querySelectorAll('.cps-color'));
    var colorToggle = selector.querySelector('[data-color-toggle]');
    var mobileColors = window.matchMedia('(max-width: 767px)');
    var colorsExpanded = false;
    var sizes = Array.prototype.slice.call(selector.querySelectorAll('.cps-sizes button'));
    var quantity = selector.querySelector('[data-quantity]');
    var cta = selector.querySelector('[data-cta]');
    var modal = selector.querySelector('[data-stock-modal]');
    document.body.appendChild(modal);
    var stockQuantity = modal.querySelector('[data-stock-quantity]');
    var stockCta = modal.querySelector('[data-stock-cta]');
    var stock = window.CROPRI_5001_STOCK && window.CROPRI_5001_STOCK.stock || {};
    var lastTrigger = null;
    var bodyOverflow = '';
    var color = colors.find(function (item) { return item.classList.contains('is-selected'); }) || colors[0];
    var size = sizes.find(function (item) { return item.classList.contains('is-selected'); }) || sizes[0];
    function syncColorDisclosure() {
      var mobile = mobileColors.matches && colors.length > 8;
      colorToggle.hidden = !mobile;
      colorToggle.setAttribute('aria-expanded', mobile && colorsExpanded ? 'true' : 'false');
      colorToggle.textContent = mobile && colorsExpanded ? '閉じる' : 'カラーをもっと見る';
      colors.forEach(function (item, index) {
        item.hidden = mobile && !colorsExpanded && index >= 8;
      });
    }
    colorToggle.addEventListener('click', function () {
      if (!mobileColors.matches) return;
      var before = colorToggle.getBoundingClientRect().top;
      colorsExpanded = !colorsExpanded;
      syncColorDisclosure();
      if (!colorsExpanded) {
        window.requestAnimationFrame(function () {
          window.scrollBy(0, colorToggle.getBoundingClientRect().top - before);
        });
      }
    });
    function onColorWidthChange() {
      if (!mobileColors.matches) colorsExpanded = false;
      syncColorDisclosure();
    }
    if (mobileColors.addEventListener) mobileColors.addEventListener('change', onColorWidthChange);
    else mobileColors.addListener(onColorWidthChange);
    syncColorDisclosure();
    function findGallery() {
      try { return selector.dataset.gallery ? document.querySelector(selector.dataset.gallery) : null; }
      catch (e) { return null; }
    }

    function notifySelection() {
      selector.dispatchEvent(new CustomEvent('cropri:selection-change', { bubbles: true }));
    }

    function update() {
      selector.querySelector('[data-color-name]').textContent = color.dataset.name;
      selector.querySelector('[data-color-code]').textContent = color.dataset.code;
      selector.querySelector('[data-price]').textContent = prices[color.dataset.code === '0001' ? 'white' : 'color'][size.dataset.size].toLocaleString('ja-JP');
      var count = Number(quantity.value);
      var valid = Number.isInteger(count) && count >= 1 && count <= 499;
      cta.classList.toggle('is-disabled', !valid);
      cta.setAttribute('aria-disabled', valid ? 'false' : 'true');
      stockCta.classList.toggle('is-disabled', !valid);
      stockCta.setAttribute('aria-disabled', valid ? 'false' : 'true');
      if (!valid) { cta.removeAttribute('href'); stockCta.removeAttribute('href'); notifySelection(); return; }
      var url = new URL(selector.dataset.estimate, window.location.href);
      url.searchParams.set('sku', selector.dataset.sku);
      url.searchParams.set('color', color.dataset.name);
      url.searchParams.set('color_code', color.dataset.code);
      url.searchParams.set('size', size.dataset.size);
      url.searchParams.set('qty', String(count));
      cta.href = url.href;
      stockCta.href = url.href;
      notifySelection();
    }

    function refreshStock() {
      modal.querySelector('[data-stock-name]').textContent = color.dataset.name;
      modal.querySelector('[data-stock-code]').textContent = color.dataset.code;
      var values = stock[color.dataset.code] || {};
      modal.querySelectorAll('[data-stock-size]').forEach(function (button) {
        var selected = button.dataset.stockSize === size.dataset.size;
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
      modal.querySelectorAll('[data-stock-count]').forEach(function (cell) {
        var value = values[cell.dataset.stockCount];
        cell.textContent = Number.isInteger(value) && value >= 0 ? value.toLocaleString('ja-JP') + '枚' : '未取得';
      });
    }

    function openStock(button) {
      lastTrigger = button;
      stockQuantity.value = quantity.value;
      refreshStock();
      modal.hidden = false;
      bodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      modal.querySelector('[data-stock-close]').focus();
    }

    function closeStock() {
      if (modal.hidden) return;
      modal.hidden = true;
      document.body.style.overflow = bodyOverflow;
      if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
    }

    function chooseColor(button, showStock) {
        colors.forEach(function (item) {
          var selected = item === button;
          item.classList.toggle('is-selected', selected);
          item.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
        color = button;
        var note = selector.querySelector('[data-photo-note]');
        note.textContent = '写真は' + button.dataset.name + 'の参考画像です。画面上の色味は実物と異なる場合があります。';
        var gallery = findGallery();
        if (gallery && button.dataset.view) {
          gallery.dispatchEvent(new CustomEvent('cropri:select-image', { detail: {
            view: button.dataset.view, full: button.dataset.full, alt: button.dataset.name + ' 正面'
          } }));
        }
        update();
        refreshStock();
        if (showStock) openStock(button);
    }

    colors.forEach(function (button) {
      button.addEventListener('click', function () { chooseColor(button, true); });
    });

    function chooseSize(button) {
      if (!button) return;
      sizes.forEach(function (item) {
        var selected = item === button;
        item.classList.toggle('is-selected', selected);
        item.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
      size = button;
      update();
      refreshStock();
    }
    sizes.forEach(function (button) {
      button.addEventListener('click', function () { chooseSize(button); });
    });
    modal.querySelectorAll('[data-stock-size]').forEach(function (button) {
      button.addEventListener('click', function () {
        chooseSize(sizes.find(function (item) { return item.dataset.size === button.dataset.stockSize; }));
      });
    });
    modal.querySelector('[data-stock-prev]').addEventListener('click', function () {
      chooseColor(colors[(colors.indexOf(color) - 1 + colors.length) % colors.length], false);
    });
    modal.querySelector('[data-stock-next]').addEventListener('click', function () {
      chooseColor(colors[(colors.indexOf(color) + 1) % colors.length], false);
    });
    modal.querySelector('[data-stock-close]').addEventListener('click', closeStock);
    modal.querySelector('[data-stock-backdrop]').addEventListener('click', closeStock);
    document.addEventListener('keydown', function (event) {
      if (modal.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); closeStock(); return; }
      if (event.key !== 'Tab') return;
      var focusable = Array.prototype.slice.call(modal.querySelectorAll('button, input, a[href]'));
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (!modal.contains(document.activeElement)) { event.preventDefault(); first.focus(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    quantity.addEventListener('input', function () { stockQuantity.value = quantity.value; update(); });
    stockQuantity.addEventListener('input', function () { quantity.value = stockQuantity.value; update(); });
    cta.addEventListener('click', function (event) { if (cta.getAttribute('aria-disabled') === 'true') event.preventDefault(); });
    stockCta.addEventListener('click', function (event) { if (stockCta.getAttribute('aria-disabled') === 'true') event.preventDefault(); });
    update();
  }
  function scan() { document.querySelectorAll('.cropri-product-selector').forEach(init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
  if (document.body && window.MutationObserver) new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('elementor/frontend/init', scan);
}());
