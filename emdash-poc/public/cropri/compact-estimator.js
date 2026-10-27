/* 既存の詳細見積UIを非表示で操作し、正本の計算結果だけを表示する。料金式は持たない。 */
(function () {
  'use strict';
  var positions = ['front', 'back', 'rsleeve', 'lsleeve'];
  var sizes = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  var root = document.querySelector('.cq-compact');
  if (!root || document.querySelectorAll('.cq-compact').length !== 1) return;
  var engine = root.querySelector('.cq-compact-engine');
  var row = engine && engine.querySelector('#cq-rows .cq-row');
  if (!row || document.querySelectorAll('#cq-rows').length !== 1) return; // 同ページの詳細見積との併設は不可。
  var qtyInput = root.querySelector('[data-compact-qty]');
  var total = root.querySelector('[data-compact-total]');
  var per = root.querySelector('[data-compact-per]');
  var note = root.querySelector('[data-compact-note]');
  var link = root.querySelector('[data-compact-link]');
  var largeLink = root.querySelector('[data-compact-large-link]');
  var product = root.querySelector('[data-compact-product]');
  var preview = root.querySelector('[data-compact-preview]');
  var previewLabel = root.querySelector('[data-compact-preview-label]');
  var previewLabels = {
    front: '表面：襟元（首リブ下）から約5cm下が上辺の目安',
    back: '裏面：背中の縦長の配置イメージ',
    rsleeve: '右そで：着用者の右側（図では左側）',
    lsleeve: '左そで：着用者の左側（図では右側）'
  };
  var selector = document.querySelector('.cropri-product-selector');
  var dirtyQty = false;
  var selectedPos = 'front';
  var selectedColors = '1';

  function selection() {
    var color = selector && selector.querySelector('.cps-color.is-selected');
    var size = selector && selector.querySelector('.cps-sizes button.is-selected');
    var code = color ? color.dataset.code : '0002';
    var name = color ? color.dataset.name : 'ブラック';
    var sizeName = size ? size.dataset.size : 'M';
    var registered = window.CROPRI_5001_COLORS || {};
    if (!Object.prototype.hasOwnProperty.call(registered, code) || registered[code] !== name || !sizes.includes(sizeName)) return null;
    return { sku: '5001-01', code: code, name: name, size: sizeName };
  }
  function clickIfDifferent(button) {
    if (button && button.getAttribute('aria-pressed') !== 'true') button.click();
  }
  function syncEngine(item, qty) {
    var currentRow = engine.querySelector('#cq-rows .cq-row');
    clickIfDifferent(currentRow.querySelector('[data-tone="' + (item.code === '0001' ? 'white' : 'color') + '"]'));
    currentRow = engine.querySelector('#cq-rows .cq-row'); // ボディ色変更で行が再生成される。
    var colorName = currentRow.querySelector('[id^="cname-"]');
    if (colorName && colorName.value !== item.name) {
      colorName.value = item.name;
      colorName.dispatchEvent(new Event('input', { bubbles: true }));
    }
    currentRow.querySelectorAll('input[data-size]').forEach(function (input) {
      var value = input.dataset.size === item.size ? String(qty) : '';
      if (input.value !== value) {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    var wrap = engine.querySelector('#cq-pos');
    positions.forEach(function (key, index) {
      var card = wrap.querySelectorAll('.cq-pos')[index];
      var size = key === selectedPos ? 'mid' : 'none';
      clickIfDifferent(card && card.querySelector('[data-size="' + size + '"]'));
    });
    var card = wrap.querySelectorAll('.cq-pos')[positions.indexOf(selectedPos)];
    clickIfDifferent(card && card.querySelector('[data-colors="' + selectedColors + '"]'));
    var actual = engine.querySelector('#cq-band').textContent;
    return actual.includes('合計 ' + qty + '枚');
  }
  function url(item, qty) {
    var target = new URL(root.dataset.estimateUrl, window.location.href);
    if (item) {
      target.searchParams.set('sku', item.sku);
      target.searchParams.set('color_code', item.code);
      target.searchParams.set('color', item.name);
      target.searchParams.set('size', item.size);
    }
    if (qty >= 1 && qty <= 499) target.searchParams.set('qty', String(qty));
    target.searchParams.set('print_pos', selectedPos);
    target.searchParams.set('ink_colors', selectedColors);
    target.hash = 'cq-cta';
    return target.href;
  }
  function render() {
    if (preview && previewLabel) {
      preview.dataset.pos = selectedPos;
      previewLabel.textContent = previewLabels[selectedPos];
    }
    var item = selection();
    var raw = qtyInput.value.trim();
    var count = Number(raw);
    var integer = raw !== '' && /^\d+$/.test(raw) && Number.isSafeInteger(count);
    product.textContent = item ? item.sku + ' アダルト / ' + item.name + ' / ' + item.size : '商品色・サイズを選択してください';
    largeLink.href = url(item, integer && count >= 1 && count <= 499 ? count : 0);
    total.hidden = true;
    per.hidden = true;
    link.setAttribute('aria-disabled', 'true');
    link.removeAttribute('href');
    if (!item) { note.textContent = '商品色・サイズを確認してください。'; return; }
    if (!integer || count < 1) { note.textContent = raw ? '1枚以上の整数で入力してください。' : '希望枚数を入力してください。'; return; }
    if (count >= 500) { note.textContent = '500枚以上は個別相談です。お問い合わせください。'; return; }
    link.href = url(item, count);
    link.setAttribute('aria-disabled', 'false');
    if (count >= 150) {
      note.textContent = '150枚以上は詳細見積もりで金額と条件を確認してください。';
      link.textContent = '150枚以上の詳細見積もりへ →';
      return;
    }
    link.textContent = 'この内容で詳しく見積・問い合わせ →';
    if (!syncEngine(item, count)) { note.textContent = '概算を更新できませんでした。詳細見積もりでご確認ください。'; return; }
    var calculated = engine.querySelector('#cq-total').textContent.trim();
    var perText = engine.querySelector('#cq-per').textContent.trim();
    if (!/^\d[\d,]*円$/.test(calculated) || !perText.includes('1枚あたり')) {
      note.textContent = '概算を更新できませんでした。詳細見積もりでご確認ください。';
      return;
    }
    total.textContent = calculated;
    per.textContent = perText;
    total.hidden = false;
    per.hidden = false;
    note.textContent = '現在の選択条件による概算です。';
  }
  qtyInput.addEventListener('input', function () { dirtyQty = true; render(); });
  root.querySelectorAll('[data-compact-pos]').forEach(function (button) {
    button.addEventListener('click', function () {
      selectedPos = button.dataset.compactPos;
      root.querySelectorAll('[data-compact-pos]').forEach(function (other) { other.setAttribute('aria-pressed', other === button ? 'true' : 'false'); });
      render();
    });
  });
  root.querySelectorAll('[data-compact-colors]').forEach(function (button) {
    button.addEventListener('click', function () {
      selectedColors = button.dataset.compactColors;
      root.querySelectorAll('[data-compact-colors]').forEach(function (other) { other.setAttribute('aria-pressed', other === button ? 'true' : 'false'); });
      render();
    });
  });
  link.addEventListener('click', function (event) { if (link.getAttribute('aria-disabled') === 'true') event.preventDefault(); });
  if (selector) {
    selector.addEventListener('cropri:selection-change', render);
    var topQty = selector.querySelector('[data-quantity]');
    if (topQty) topQty.addEventListener('input', function () { if (!dirtyQty) { qtyInput.value = topQty.value; render(); } });
  }
  render();
})();
