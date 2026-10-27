(() => {
  /* ===== 販売価格（すべて税込）=====
     シルク：ボディ（無地＋差額）＋場所ごとの版代とプリント代。
     DTG・DTF：下の digital。 */
  const SALE = {
    taxRate: 0.10,
    maxQty: 499,
    /* シルク：1か所・1枚あたりのプリント代（1色目／2色目以降1色ごと）。1枚から実際の枚数で計算 */
    bands: [
      { min:1,   max:3,   label:"1〜3枚",     first:935, add:275 },
      { min:4,   max:9,   label:"4〜9枚",     first:682, add:275 },
      { min:10,  max:19,  label:"10〜19枚",   first:572, add:220 },
      { min:20,  max:49,  label:"20〜49枚",   first:440, add:143 },
      { min:50,  max:99,  label:"50〜99枚",   first:242, add:99 },
      { min:100, max:299, label:"100〜299枚", first:165, add:66 },
      { min:300, max:499, label:"300〜499枚", first:88,  add:55 }
    ],
    /* シルクの版代（1色・1版）と1枚あたりの追加。通常・特大・そで */
    plate: { mid:9900, large:14300, sleeve:6050 },
    extra: { mid:0, large:55, sleeve:55 },   // 特大 +55円/枚、そで +55円/枚（1色ごと）
    blank: 880,   // 無地（ホワイトS〜XL）
    /* ボディの差額（1枚、ホワイトS〜XLとの差） */
    bodyAdj: {
      adult: { white:{S:0,M:0,L:0,XL:0,XXL:220,XXXL:440}, color:{S:77,M:77,L:77,XL:77,XXL:418,XXXL:583} },
      girls: { white:{"G-M":0,"G-L":0}, color:{"G-M":77,"G-L":77} },
      kids:  { white:Object.fromEntries(["90","100","110","120","130","140","150","160"].map(s=>[s,-44])),
               color:Object.fromEntries(["90","100","110","120","130","140","150","160"].map(s=>[s,33])) }
    },
    sizes: { adult:["S","M","L","XL","XXL","XXXL"], girls:["G-M","G-L"], kids:["90","100","110","120","130","140","150","160"] },
    products: {
      adult: { sku:"5001-01", label:"アダルト" },
      kids:  { sku:"5001-02", label:"キッズ" },
      girls: { sku:"5001-03", label:"ガールズ" }
    },
    dataDiscount: 1000,                 // 完全データ入稿の割引（新規デザインのみ）
    pack: 55,                           // 袋詰め 1枚
    /* ===== DTG・DTF（1か所あたりのプリント代・税込）=====
       1枚から実際の枚数で計算（シルクの「10枚分」ルールは使わない）。
       Tシャツ代（無地価格＋差額）に、プリントする場所ごとにこの金額を足す。色数による変動なし・版代なし。
       1〜4枚のご注文は少量手数料を1回だけ加算。 */
    digital: {
      bands: [
        { min:1,   max:1,   label:"1枚" },
        { min:2,   max:4,   label:"2〜4枚" },
        { min:5,   max:9,   label:"5〜9枚" },
        { min:10,  max:19,  label:"10〜19枚" },
        { min:20,  max:49,  label:"20〜49枚" },
        { min:50,  max:99,  label:"50〜99枚" },
        { min:100, max:499, label:"100〜499枚" }
      ],
      dtg: {
        white: { A6:[2200,1550,1100,950,800,650,550], A4:[2900,2200,1600,1450,1300,1050,800], A3:[3700,2900,2000,1700,1450,1200,950] },
        color: { A6:[2950,2200,1600,1350,1200,950,800], A4:[3900,3100,2250,1950,1700,1450,1200], A3:[4900,3900,2800,2350,2000,1700,1450] }
      },
      dtf: { A8:[1500,1100,850,750,650,550,450], A6:[2000,1400,1050,900,800,650,550], A4:[2700,1950,1600,1400,1300,1150,1000], A3:[3300,2500,2100,1900,1750,1550,1350] },
      smallFee: { maxQty:4, fee:2200 },   // 1〜4枚のご注文に1回だけ（データ作成・発注の手間代）
      sleeveSize: { dtg:"A6", dtf:"A8" }   // そでは小さいサイズで計算
    },
    shipping: { freeOver: 30000,        // 税込3万円以上で送料無料
      regions: [["九州・四国・中国・関西・中部",990],["関東・信越・北陸",990],["東北",1430],["北海道",2200],["沖縄",2750]] }
  };
  /* ============================================================ */


  const yen = n => Math.round(n).toLocaleString("ja-JP");
  const $ = id => document.getElementById(id);
  const productName = type => `${SALE.products[type].sku} ${SALE.products[type].label}`;
  let rowSeq = 0;
  const POS = [
    { key:"front",   name:"表面",   label:"表面（胸）",   view:"front",   sizes:[["none","なし"],["mid","通常"],["large","特大"]] },
    { key:"back",    name:"裏面",   label:"裏面（背中）", view:"back",    sizes:[["none","なし"],["mid","通常"],["large","特大"]] },
    { key:"rsleeve", name:"右そで", label:"右そで",       view:"rsleeve", sizes:[["none","なし"],["mid","あり"]] },
    { key:"lsleeve", name:"左そで", label:"左そで",       view:"lsleeve", sizes:[["none","なし"],["mid","あり"]] }
  ];
  const SIZE_NAME = { mid:"通常", large:"特大", A8:"A8", A6:"A6", A4:"A4", A3:"A3" };
  const METHODS = {
    silk: { name:"シルクスクリーン", short:"シルク", desc:"版を作って1色ずつ刷る方法。色数が少なく枚数が多いほどお得。発色がよく丈夫。" },
    dtg:  { name:"DTG（インクジェット）", short:"DTG", desc:"生地に直接フルカラーで印刷。色数に関係なく同じ料金で、写真やグラデーションも再現。版代なし。" },
    dtf:  { name:"DTF（フルカラー転写）", short:"DTF", desc:"フルカラーのシートを熱で圧着。濃い色のTシャツでも白地と同じ料金。細かい柄や小さなワンポイント向き。" }
  };
  const posSizes = (key) => {
    const sleeve = key==="rsleeve"||key==="lsleeve";
    if (state.method==="silk") return sleeve ? [["none","なし"],["mid","あり"]] : [["none","なし"],["mid","通常"],["large","特大"]];
    if (sleeve) return [["none","なし"],[SALE.digital.sleeveSize[state.method],"あり"]];
    return state.method==="dtf" ? [["none","なし"],["A8","A8"],["A6","A6"],["A4","A4"],["A3","A3"]] : [["none","なし"],["A6","A6"],["A4","A4"],["A3","A3"]];
  };
  const posLabel = (p) => `${p.name}${(p.key==="front"||p.key==="back") ? SIZE_NAME[p.st.size] : ""}${state.method==="silk" ? p.st.colors+"色" : ""}`;
  const freshPos = () => ({ front:{size:"none",colors:1}, back:{size:"none",colors:1}, rsleeve:{size:"none",colors:1}, lsleeve:{size:"none",colors:1} });

  // 入力例：アダルト・ブラック M10 L10 XL10 / 表面通常1色
  const state = {
    rows: [{ id: ++rowSeq, type:"adult", tone:"color", colorName:"ブラック", qty:{M:10,L:10,XL:10} }],
    pos: Object.assign(freshPos(), { front:{ size:"mid", colors:1 } }),
    data:false, repeat:false, pack:false, region:0, method:"silk", kidsPlate:"separate"
  };

  /* ---------- rows ---------- */
  function renderRows(){
    const wrap = $("cq-rows");
    wrap.innerHTML = "";
    state.rows.forEach((r, idx) => {
      const sizes = SALE.sizes[r.type];
      const el = document.createElement("div");
      el.className = "cq-row";
      el.innerHTML = `
        <div class="cq-row-top">
          <label class="cq-field">品番
            <select id="type-${r.id}">
              ${Object.keys(SALE.products).map(k=>`<option value="${k}" ${k===r.type?"selected":""}>${productName(k)}</option>`).join("")}
            </select>
          </label>
          <div class="cq-field">ボディ色
            <div class="cq-seg" role="group" aria-label="ボディ色">
              <button type="button" data-tone="white" aria-pressed="${r.tone==="white"}">ホワイト</button>
              <button type="button" data-tone="color" aria-pressed="${r.tone==="color"}">カラー</button>
            </div>
          </div>
          <label class="cq-field" ${r.tone==="white"?"hidden":""}>カラー名
            <input type="text" id="cname-${r.id}" value="${r.colorName||""}" placeholder="例：ネイビー" size="10">
          </label>
          ${state.rows.length>1?`<button type="button" class="cq-remove" data-remove>この行を削除</button>`:""}
        </div>
        <div class="cq-sizes">
          ${sizes.map(s=>{
            const q = r.qty[s]||"";
            return `<div class="cq-size ${q?"has":""}">
              <label for="q-${r.id}-${s}">${s}</label>
              <input id="q-${r.id}-${s}" type="number" inputmode="numeric" min="0" max="999" step="1" value="${q}" data-size="${s}" placeholder="0">
            </div>`;}).join("")}
        </div>
        <div class="cq-rowsum" id="rowsum-${r.id}"></div>`;
      wrap.appendChild(el);

      el.querySelector(`#type-${r.id}`).addEventListener("change", e => { r.type = e.target.value; r.qty = {}; renderRows(); update(); });
      el.querySelectorAll("[data-tone]").forEach(b => b.addEventListener("click", () => { r.tone = b.dataset.tone; renderRows(); update(); }));
      el.querySelector(`#cname-${r.id}`).addEventListener("input", e => { r.colorName = e.target.value; update(); });
      el.querySelectorAll("input[data-size]").forEach(inp => inp.addEventListener("input", () => {
        const v = Math.max(0, Math.floor(Number(inp.value)||0));
        if (v) r.qty[inp.dataset.size] = v; else delete r.qty[inp.dataset.size];
        inp.closest(".cq-size").classList.toggle("has", v>0);
        update();
      }));
      const rm = el.querySelector("[data-remove]");
      if (rm) rm.addEventListener("click", () => { state.rows.splice(idx,1); renderRows(); update(); });
    });
  }
  $("cq-add").addEventListener("click", () => {
    state.rows.push({ id: ++rowSeq, type:"adult", tone:"white", colorName:"", qty:{} });
    renderRows(); update();
    const last = state.rows[state.rows.length-1];
    const first = document.querySelector(`#q-${last.id}-M`) || document.querySelector(`[id^="q-${last.id}-"]`);
    if (first) first.focus();
  });

  /* ---------- method ---------- */
  function renderMethods(){
    const wrap = $("cq-methods");
    wrap.innerHTML = Object.entries(METHODS).map(([k,m]) => `<button type="button" class="cq-method" data-method="${k}" aria-pressed="${state.method===k}"><b>${m.name}</b><span>${m.desc}</span></button>`).join("");
    wrap.querySelectorAll("[data-method]").forEach(b => b.addEventListener("click", () => { setMethod(b.dataset.method); }));
  }
  /* 位置の大きさを方法に合わせて置きかえる（プリントする場所はそのまま） */
  function convertPos(p, key, to){
    if (p.size==="none") return p;
    const sleeve = key==="rsleeve"||key==="lsleeve";
    if (to==="silk") return { size: sleeve ? "mid" : (p.size==="A3"||p.size==="large" ? "large" : "mid"), colors: p.colors||1 };
    if (sleeve) return { size: SALE.digital.sleeveSize[to], colors: p.colors||1 };
    let s = p.size==="large" ? "A3" : p.size==="mid" ? "A4" : p.size;
    if (to==="dtg" && s==="A8") s = "A6";
    return { size:s, colors:p.colors||1 };
  }
  function setMethod(m){
    Object.keys(state.pos).forEach(k => { state.pos[k] = convertPos(state.pos[k], k, m); });
    state.method = m;
    renderMethods(); renderPos(); renderRef(); update();
  }

  /* ---------- print positions ---------- */
  const shirt = (side, size) => {
    const on = size!=="none";
    let area = "";
    if (side==="rsleeve") area = on ? `<rect x="11" y="24" width="10" height="9" fill="#F04B2A" transform="rotate(-33 16 28)"/>` : "";
    else if (side==="lsleeve") area = on ? `<rect x="79" y="24" width="10" height="9" fill="#F04B2A" transform="rotate(33 84 28)"/>` : "";
    else area = size==="mid"||size==="A4" ? `<rect x="36" y="36" width="28" height="36" fill="#F04B2A"/>` :
                size==="large"||size==="A3" ? `<rect x="31" y="32" width="38" height="46" fill="#F04B2A"/>` :
                size==="A6" ? `<rect x="41" y="36" width="18" height="24" fill="#F04B2A"/>` :
                size==="A8" ? `<rect x="54" y="34" width="10" height="13" fill="#F04B2A"/>` : "";
    const neck = side==="back" ? `<path d="M40 12 Q50 16 60 12" fill="none" stroke="#111" stroke-width="2"/>` :
                                 `<path d="M40 12 Q50 22 60 12" fill="none" stroke="#111" stroke-width="2"/>`;
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M30 10 L40 10 Q50 20 60 10 L70 10 L94 26 L84 42 L76 36 L76 94 L24 94 L24 36 L16 42 L6 26 Z" fill="#fff" stroke="#111" stroke-width="2" stroke-linejoin="round"/>${area}${neck}</svg>`;
  };
  function renderPos(){
    const wrap = $("cq-pos");
    wrap.innerHTML = "";
    const silk = state.method==="silk";
    $("cq-pos-h-colors").hidden = !silk;
    $("cq-pos-hint").textContent = silk ? "場所ごと・色ごとに版を作って刷ります" : "色数に関係なく、大きさと場所の数で決まります";
    $("cq-pos-note").textContent = silk ? "通常＝H30cm×W30cm以内　特大＝H50cm×W39cm以内（特大は版代と1枚あたりの料金が上がります）。そでは小さい版で刷ります。"
      : state.method==="dtg" ? "A6＝10.5×14.8cm以内　A4＝21×29.7cm以内　A3＝29.7×42cm以内。濃い色のTシャツは下地に白を刷るため、ホワイトより少し高くなります。そでは小さいサイズの料金です。"
      : "A8＝5.2×7.4cm以内（ワンポイント）　A6＝10.5×14.8cm以内　A4＝21×29.7cm以内　A3＝29.7×42cm以内。Tシャツの色に関係なく同じ料金です。そではA8の料金です。";
    POS.forEach(({key,label,view}) => {
      const sizes = posSizes(key);
      const p = state.pos[key];
      const el = document.createElement("div");
      el.className = "cq-pos";
      el.innerHTML = `${shirt(view,p.size)}
        <div class="cq-opts">
          <h3>${label}</h3>
          <div><div class="cq-sub">${sizes.length>2?"大きさ":"プリント"}</div>
            <div class="cq-seg" role="group" aria-label="${label}の大きさ">
              ${sizes.map(([v,t])=>`<button type="button" data-size="${v}" aria-pressed="${p.size===v}">${t}</button>`).join("")}
            </div></div>
          ${silk ? `<div><div class="cq-sub">色数</div>
            <div class="cq-colors" role="group" aria-label="${label}の色数">
              ${[1,2,3,4,5].map(n=>`<button type="button" data-colors="${n}" aria-pressed="${p.size!=="none"&&p.colors===n}" ${p.size==="none"?"disabled":""}>${n}色</button>`).join("")}
            </div></div>` : (p.size!=="none" ? `<div><span class="cq-fc">フルカラー（色数自由）</span></div>` : "")}
        </div>`;
      wrap.appendChild(el);
      el.querySelectorAll("[data-size]").forEach(b => b.addEventListener("click", () => { p.size = b.dataset.size; renderPos(); update(); }));
      el.querySelectorAll("[data-colors]").forEach(b => b.addEventListener("click", () => { p.colors = Number(b.dataset.colors); renderPos(); update(); }));
    });
  }

  /* ---------- options ---------- */
  $("cq-pack-p").textContent = SALE.pack;
  $("cq-data-p").textContent = yen(SALE.dataDiscount);
  $("cq-region").innerHTML = SALE.shipping.regions.map(([n,f],i)=>`<option value="${i}">${n}（${yen(f)}円・3万円以上無料）</option>`).join("");
  $("cq-data").addEventListener("change", e => { state.data = e.target.checked; update(); });
  $("cq-repeat").addEventListener("change", e => { state.repeat = e.target.checked; update(); });
  $("cq-pack").addEventListener("change", e => { state.pack = e.target.checked; update(); });
  $("cq-region").addEventListener("change", e => { state.region = Number(e.target.value); update(); });
  document.querySelectorAll("[data-kids-plate]").forEach(b => b.addEventListener("click", () => {
    state.kidsPlate = b.dataset.kidsPlate;
    document.querySelectorAll("[data-kids-plate]").forEach(x => x.setAttribute("aria-pressed", String(x===b)));
    update();
  }));
  function syncOptions(){ $("cq-data").checked = state.data; $("cq-repeat").checked = state.repeat; $("cq-pack").checked = state.pack; $("cq-region").value = String(state.region); }

  /* ---------- sale calculation（税込） ---------- */
  const silkSizeKey = (p) => (p.key==="rsleeve"||p.key==="lsleeve") ? "sleeve" : p.st.size;
  function silkPool(p, q, band){   // その場所の版代＋プリント代（税込）
    const k = silkSizeKey(p), c = p.st.colors;
    return SALE.plate[k]*c + (band.first + band.add*(c-1) + SALE.extra[k]*(k==="sleeve" ? c : 1))*q;
  }
  const silkPrintTotal = (active, q, band) => active.reduce((a, p) => a + silkPool(p, q, band), 0);
  function saleCalc(o){
    const P = o ? o.pos : state.pos;
    let qty = 0; const lines = [];
    (o && o.rows ? o.rows : state.rows).forEach(r => { let rq = 0; SALE.sizes[r.type].forEach(s => rq += r.qty[s]||0); qty += rq; lines.push({ r, rq }); });
    const active = POS.filter(({key}) => P[key].size!=="none").map(p => ({...p, st: P[p.key]}));
    const colorsTotal = active.reduce((a,p)=>a+p.st.colors,0);
    const largeCount = active.filter(p=>p.st.size==="large").length;
    const hasPrint = active.length > 0;
    const method = o ? o.method : state.method;
    const digi = method!=="silk";
    const bandList = digi ? SALE.digital.bands : SALE.bands;
    const bandAt = n => bandList.find(b => n>=b.min && n<=b.max) || null;
    const band = bandAt(qty);
    const kidsQty = lines.filter(l => l.r.type==="kids").reduce((n,l)=>n+l.rq,0);
    const standardQty = qty-kidsQty;
    const hasKids90 = lines.some(l => l.r.type==="kids" && (l.r.qty["90"]||0)>0);
    const hasSleevePrint = active.some(p => p.key==="rsleeve" || p.key==="lsleeve");
    const invalidKidsSleeve = hasKids90 && hasSleevePrint;
    const splitSilk = method==="silk" && state.kidsPlate==="separate" && kidsQty>0 && standardQty>0;
    const printGroups = splitSilk
      ? [{ key:"standard", label:"アダルト・ガールズ", qty:standardQty, band }, { key:"kids", label:"キッズ", qty:kidsQty, band }]
      : [{ key:"all", label:"", qty, band }];
    /* 1枚あたり（ホワイトS〜XL基準）。DTGはボディ色で変わるので tone ごとに出す */
    const digiPrint = (tone) => {
      if (!band) return 0;
      const i = SALE.digital.bands.indexOf(band);
      return active.reduce((s,p) => s + (method==="dtg" ? SALE.digital.dtg[tone][p.st.size][i] : SALE.digital.dtf[p.st.size][i]), 0);
    };
    /* シルク：版代とプリント代の税込合計（場所ごと）。1枚あたりに割って単価にする */
    const extraPlateTotal = splitSilk ? active.reduce((sum,p)=>sum + SALE.plate[silkSizeKey(p)]*p.st.colors,0) : 0;
    const silkPrint = (method==="silk" && band && qty) ? (silkPrintTotal(active, qty, band)+extraPlateTotal)/qty : 0;
    const unitFor = (tone, type="adult") => !hasPrint ? SALE.blank : !band ? 0
      : method==="silk" ? SALE.blank + silkPrint
      : SALE.blank + digiPrint(tone);
    const unit = unitFor("white"), unitColor = unitFor("color");
    let goods = 0, bodyPart = 0;
    lines.forEach(l => SALE.sizes[l.r.type].forEach(s => {
      const q = l.r.qty[s]||0, adj = SALE.bodyAdj[l.r.type][l.r.tone][s];
      goods += q*(unitFor(l.r.tone,l.r.type)+adj); bodyPart += q*(SALE.blank+adj);
    }));
    /* 10枚未満：足りない枚数分を、いちばん多いボディ色の1枚価格で */
    const mainTone = (() => { let w=0,c=0; lines.forEach(l=>{ if(l.r.tone==="white") w+=l.rq; else c+=l.rq; }); return c>w ? "color" : "white"; })();
    /* DTG・DTFの少量手数料：ただし合計が「5枚で頼んだときの合計」を超えないよう上限をつける */
    let smallCapped = false;
    const digiSmall = () => {
      const sf = SALE.digital.smallFee;
      if (qty > sf.maxQty) return 0;
      const nb = SALE.digital.bands.find(b => b.min === sf.maxQty+1);
      const ni = SALE.digital.bands.indexOf(nb);
      const printAt = (tone) => active.reduce((s,p) => s + (method==="dtg" ? SALE.digital.dtg[tone][p.st.size][ni] : SALE.digital.dtf[p.st.size][ni]), 0);
      let goodsNext = 0;
      lines.forEach(l => SALE.sizes[l.r.type].forEach(s => { const q = l.r.qty[s]||0; goodsNext += q*(SALE.blank + printAt(l.r.tone) + SALE.bodyAdj[l.r.type][l.r.tone][s]); }));
      const cap = goodsNext + (nb.min - qty)*(SALE.blank + printAt(mainTone) + SALE.bodyAdj.adult[mainTone].S);
      /* 通常は手数料をそのまま。合計が上限を超えるときは、上限に合わせて手数料を減らす（マイナス＝値引きになることもある） */
      if (goods + sf.fee <= cap) return sf.fee;
      smallCapped = true;
      return cap - goods;
    };
    const small = !(hasPrint && band && qty>0) ? 0
      : digi ? digiSmall()
      : 0;
    const xlPlate = 0;
    const data = (hasPrint && state.data && !state.repeat && qty) ? SALE.dataDiscount : 0;
    const pack = state.pack ? SALE.pack*qty : 0;
    const before = goods + small + xlPlate - data + pack;
    const shipFree = before >= SALE.shipping.freeOver;
    const ship = qty ? (shipFree ? 0 : SALE.shipping.regions[state.region][1]) : 0;
    const total = qty ? before + ship : 0;
    const exTax = Math.round(total/(1+SALE.taxRate));
    return { qty, lines, active, colorsTotal, largeCount, band, hasPrint, unit, unitColor, smallCapped, goods, bodyPart, small, xlPlate, data, pack, ship, shipFree, total, exTax, tax: total-exTax, method, kidsQty, standardQty, splitSilk, printGroups, hasKids90, invalidKidsSleeve };
  }

  /* ---------- シルクの明細（freee見積書と同じ形・税別） ----------
     決まりは社内の見積明細ルール（cropri_quote.py）と同じ計算。
     版代の行は固定額（LINE.plate）。基準の版代との差額はプリント代の単価に含める。 */
  const LINE = { plate:{ mid:6000, large:8000 } };   // 版代 1色（税別）
  const ex = v => Math.round(v/(1+SALE.taxRate));     // 税込 → 税別（四捨五入）
  function silkBreakdown(c){
    if (c.method!=="silk" || !c.qty || !c.hasPrint || !c.band || c.qty > SALE.maxQty) return null;
    const q = c.qty;
    const out = [], plates = [], prints = [];
    let labo = 0;   // 基準の税込合計（送料無料の判定に使う）
    c.lines.forEach(l => {
      const g = {};
      SALE.sizes[l.r.type].forEach(s => {
        const n = l.r.qty[s]||0; if (!n) return;
        const adj = SALE.bodyAdj[l.r.type][l.r.tone][s];
        const cls = (s==="XXL"||s==="XXXL") ? s : { adult:"S-XL", girls:"G-M・G-L", kids:"90-160" }[l.r.type];
        (g[cls] = g[cls] || { cls, adj, n:0 }).n += n;
        labo += (SALE.blank+adj)*n;
      });
      const col = l.r.tone==="white" ? "ホワイト" : (l.r.colorName ? `カラー（${l.r.colorName}）` : "カラー");
      Object.values(g).forEach(x => out.push({ d:`Tシャツ ${productName(l.r.type)} ${col} ${x.cls}`, n:x.n, u:"枚", p:ex(SALE.blank+x.adj) }));
    });
    c.active.forEach((p) => {
      const colors = p.st.colors, large = p.st.size==="large";
      const pool = silkPool(p, q, c.band) + (c.splitSilk ? SALE.plate[silkSizeKey(p)]*colors : 0);
      labo += pool;
      const nm = (p.key==="front"||p.key==="back") ? `${p.name}（${large?"特大":"通常"}サイズ・${colors}色）` : `${p.name}（${colors}色）`;
      const plateGroups = c.splitSilk ? ["アダルト・ガールズ用","キッズ用"] : [""];
      plateGroups.forEach(groupName => plates.push({ d:`版代 ${nm}${groupName?`・${groupName}`:""}`, n:colors, u:"版", p:LINE.plate[p.st.size] }));
      const plate = LINE.plate[p.st.size]*colors*plateGroups.length;
      prints.push({ d:`シルクプリント ${nm}${c.splitSilk?"・2原寸":""}`, n:q, u:"枚", p:Math.round((ex(pool)-plate)/q) });
    });
    const rest = [];
    if (state.pack) { rest.push({ d:"たたみ・袋詰め", n:q, u:"枚", p:ex(SALE.pack) }); labo += SALE.pack*q; }
    if (c.data) { rest.push({ d:"完全データ入稿 割引", n:1, u:"式", p:-ex(SALE.dataDiscount) }); labo -= SALE.dataDiscount; }
    const shipFree = labo >= SALE.shipping.freeOver, ship = shipFree ? 0 : SALE.shipping.regions[state.region][1];
    rest.push({ d:`送料（${shipFree ? "税込3万円以上 無料" : SALE.shipping.regions[state.region][0]}）`, n:1, u:"式", p:ex(ship) });
    rest.push({ d:"デザインデータ作成（修正2回まで）", n:1, u:"式", p:0 });
    const lines = out.concat(plates, prints, rest);
    const sub = lines.reduce((a, x) => a + Math.round(x.n*x.p), 0);
    const tax = Math.floor(sub*SALE.taxRate);
    return { lines, sub, tax, total: sub+tax, shipFree, ship };
  }

  function compareAll(){
    return Object.keys(METHODS).map(m => {
      const pos = {}; Object.keys(state.pos).forEach(k => { pos[k] = convertPos(state.pos[k], k, m); });
      const r = saleCalc({ method:m, pos });
      const bd = silkBreakdown(r);
      return { m, total: bd ? bd.total : r.total, qty: r.qty };
    });
  }

  /* ---------- 価格曲線（1〜100枚） ---------- */
  const CURVE_MAX = 100;
  const CURVE_COLORS = { silk:"var(--c-silk)", dtg:"var(--c-dtg)", dtf:"var(--c-dtf)" };
  let curveData = null, curveColors = null, curveSize = null;   // null＝今の設定
  /* グラフ用：絵の大きさを各方式のサイズに置きかえる（シルクはA3だけ特大、DTGにA8はないのでA6） */
  const sizeFor = (m, sz) => m==="silk" ? (sz==="A3" ? "large" : "mid") : (m==="dtg" && sz==="A8" ? "A6" : sz);
  function renderSizeChips(){
    $("cq-sz-btns").innerHTML = `<button type="button" data-sz="" aria-pressed="${curveSize===null}">今の設定</button>` +
      ["A8","A6","A4","A3"].map(z => `<button type="button" data-sz="${z}" aria-pressed="${curveSize===z}">${z}</button>`).join("");
    $("cq-sz-btns").querySelectorAll("[data-sz]").forEach(b => b.addEventListener("click", () => {
      curveSize = b.dataset.sz || null; renderCurve(saleCalc());
    }));
  }
  function silkColorsNow(){
    const act = Object.keys(state.pos).map(k => convertPos(state.pos[k], k, "silk")).filter(p => p.size!=="none");
    return act.length ? act.map(p => p.colors).join("＋") : "";
  }
  function renderColorChips(){
    const now = silkColorsNow();
    $("cq-cc-btns").innerHTML = `<button type="button" data-cc="" aria-pressed="${curveColors===null}">今の設定${now?`（${now}色）`:""}</button>` +
      [1,2,3,4,5].map(n => `<button type="button" data-cc="${n}" aria-pressed="${curveColors===n}">${n}色</button>`).join("");
    $("cq-cc-btns").querySelectorAll("[data-cc]").forEach(b => b.addEventListener("click", () => {
      curveColors = b.dataset.cc ? Number(b.dataset.cc) : null; renderCurve(saleCalc());
    }));
  }
  function curveSeries(tone){
    return Object.keys(METHODS).map(m => {
      const pos = {}; Object.keys(state.pos).forEach(k => {
        pos[k] = convertPos(state.pos[k], k, m);
        if (m==="silk" && curveColors && pos[k].size!=="none") pos[k] = { ...pos[k], colors: curveColors };
        if (curveSize && (k==="front"||k==="back") && pos[k].size!=="none") pos[k] = { ...pos[k], size: sizeFor(m, curveSize) };
      });
      const vals = [];
      for (let n = 1; n <= CURVE_MAX; n++) {
        const r = saleCalc({ method:m, pos, rows:[{ id:0, type:"adult", tone, colorName:"", qty:{ L:n } }] });
        vals.push((r.total - r.ship) / n);
      }
      return { m, vals, pos };
    });
  }
  function renderCurve(c){
    const sec = $("cq-curve-sec");
    sec.hidden = !c.hasPrint;
    if (!c.hasPrint) return;
    renderColorChips(); renderSizeChips();
    let w = 0, k = 0; c.lines.forEach(l => { if (l.r.tone==="white") w += l.rq; else k += l.rq; });
    const tone = k > w ? "color" : "white";
    $("cq-curve-note").textContent = `今のプリント位置で比較（${tone==="white"?"ホワイト":"カラー"}S〜XL・1〜${CURVE_MAX}枚）`;
    const series = curveSeries(tone);
    const narrow = $("cq-curve").clientWidth > 0 && $("cq-curve").clientWidth < 520;
    const W = narrow ? 360 : 640, H = narrow ? 300 : 280, L = narrow ? 48 : 56, R = narrow ? 44 : 64, T = 12, B = 28;
    $("cq-curve-svg").setAttribute("viewBox", `0 0 ${W} ${H}`);
    const xs = n => L + (Math.log(n) / Math.log(CURVE_MAX)) * (W - L - R);
    const all = series.flatMap(s => s.vals);
    const lo = Math.min(...all) * 0.9, hi = Math.max(...all) * 1.08;
    const ys = v => T + (1 - (Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * (H - T - B);
    const yt = [500,1000,1500,2000,3000,5000,7000,10000,15000,20000,30000,50000].filter(v => v >= lo && v <= hi);
    const xt = narrow ? [1,2,5,10,20,50,100] : [1,2,3,5,10,20,30,50,100];
    const path = vals => vals.map((v,i) => `${i?"L":"M"}${xs(i+1).toFixed(1)} ${ys(v).toFixed(1)}`).join("");
    const cq = Math.min(Math.max(c.qty,1), CURVE_MAX);
    // 右端のラベルが重ならないよう少しずらす
    const ends = series.map(s => ({ m:s.m, y:ys(s.vals[CURVE_MAX-1]) })).sort((a,b)=>a.y-b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i-1].y < 13) ends[i].y = ends[i-1].y + 13;
    const endY = Object.fromEntries(ends.map(e => [e.m, e.y]));
    let svg = `<g class="grid">${yt.map(v=>`<line x1="${L}" x2="${W-R}" y1="${ys(v)}" y2="${ys(v)}"/>`).join("")}</g>`;
    svg += `<g class="axis">${yt.map(v=>`<text x="${L-6}" y="${ys(v)+4}" text-anchor="end">${yen(v)}</text>`).join("")}`;
    svg += `${xt.map(n=>`<text x="${xs(n)}" y="${H-8}" text-anchor="middle">${n}枚</text>`).join("")}</g>`;
    if (c.qty) svg += `<line class="now" x1="${xs(cq)}" x2="${xs(cq)}" y1="${T}" y2="${H-B}"/>`;
    series.forEach(s => {
      svg += `<path class="ln" d="${path(s.vals)}" stroke="${CURVE_COLORS[s.m]}"/>`;
      svg += `<text class="lbl" x="${W-R+6}" y="${endY[s.m]+4}">${METHODS[s.m].short}</text>`;
    });
    svg += `<line class="sel" id="cq-sel" x1="0" x2="0" y1="${T}" y2="${H-B}"/>`;
    series.forEach(s => { svg += `<circle class="dot" id="cq-dot-${s.m}" cx="0" cy="0" r="5" fill="${CURVE_COLORS[s.m]}"/>`; });
    svg += `<rect id="cq-hit" x="${L}" y="${T}" width="${W-L-R}" height="${H-T-B}" fill="transparent"/>`;
    $("cq-curve-svg").innerHTML = svg;
    curveData = { series, xs, ys, W, L, R, T, H, B, cur: c.qty ? cq : 0 };
    if (curvePinned === null || lastQty !== c.qty) { curvePinned = null; lastQty = c.qty; }
    showAt(curvePinned || (c.qty ? cq : 10));
  }
  let curvePinned = null, lastQty = -1;
  /* 指定した枚数に点と線を動かし、上の数字をその枚数の価格にする */
  function showAt(n){
    if (!curveData) return;
    const { series, xs, ys, cur } = curveData;
    const sel = $("cq-sel"); sel.setAttribute("x1", xs(n)); sel.setAttribute("x2", xs(n));
    sel.style.opacity = (n === cur) ? 0 : 1;
    series.forEach(s => { const d = $(`cq-dot-${s.m}`); d.setAttribute("cx", xs(n)); d.setAttribute("cy", ys(s.vals[n-1])); });
    const main = pos => ["front","back"].map(k => pos[k]).find(p => p.size!=="none");
    const lbl = s => {
      const mp = main(s.pos);
      if (s.m==="silk") {
        const cols = curveColors ? (Object.values(s.pos).filter(p=>p.size!=="none").length>1 ? `各${curveColors}色` : `${curveColors}色`) : silkColorsNow()+"色";
        return `シルク（${cols}${mp ? "・"+SIZE_NAME[mp.size] : ""}）`;
      }
      return `${METHODS[s.m].short}${mp ? "（"+mp.size+"）" : ""}`;
    };
    $("cq-legend").innerHTML = series.map(s => `<li><i style="background:${CURVE_COLORS[s.m]}"></i>${lbl(s)} <b>${yen(s.vals[n-1])}円</b></li>`).join("")
      + `<li class="at">（<b>${n}枚</b>のとき・1枚あたり${n === cur ? "・今の枚数" : ""}）</li>`;
    const sl = $("cq-curve-n"); sl.value = Math.round(Math.log(n) / Math.log(CURVE_MAX) * 1000); sl.setAttribute("aria-valuetext", `${n}枚`);
    $("cq-curve-out").textContent = `${n}枚`;
    $("cq-curve-back").hidden = !cur || n === cur;
  }
  (function bindCurveHover(){
    const svgEl = $("cq-curve-svg");
    const rest = () => { if (curveData) showAt(curvePinned || curveData.cur || 10); };
    const nAt = e => {
      const r = svgEl.getBoundingClientRect(); const { W, L, R } = curveData;
      const x = (e.clientX - r.left) * (W / r.width);
      const t = Math.min(1, Math.max(0, (x - L) / (W - L - R)));
      return Math.min(CURVE_MAX, Math.max(1, Math.round(Math.exp(t * Math.log(CURVE_MAX)))));
    };
    svgEl.addEventListener("pointermove", e => { if (curveData) showAt(nAt(e)); });
    svgEl.addEventListener("pointerdown", e => { if (curveData) { curvePinned = nAt(e); showAt(curvePinned); } });
    svgEl.addEventListener("pointerleave", rest);
    $("cq-curve-n").addEventListener("input", e => { curvePinned = Math.min(CURVE_MAX, Math.max(1, Math.round(Math.exp(Number(e.target.value) / 1000 * Math.log(CURVE_MAX))))); showAt(curvePinned); });
    $("cq-curve-back").addEventListener("click", () => { curvePinned = null; rest(); });
    let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => renderCurve(saleCalc()), 150); });
  })();

  const KIDS_PRINT_LIMITS = {
    "90":{ body:[15,15], sleeve:null },
    "100":{ body:[20,20], sleeve:[8,7] }, "110":{ body:[20,20], sleeve:[8,7] },
    "120":{ body:[22,22], sleeve:[8,7] }, "130":{ body:[22,22], sleeve:[8,7] },
    "140":{ body:[27,30], sleeve:[8,7] }, "150":{ body:[27,30], sleeve:[8,7] },
    "160":{ body:[30,30], sleeve:[10,9] }
  };
  function selectedKidsSizes(c){
    const picked = [];
    c.lines.filter(l => l.r.type==="kids").forEach(l => SALE.sizes.kids.forEach(s => { if (l.r.qty[s]) picked.push(s); }));
    return [...new Set(picked)];
  }
  function kidsLimitText(c){
    const sizes = selectedKidsSizes(c);
    if (!sizes.length) return "";
    const body = sizes.map(s=>KIDS_PRINT_LIMITS[s].body).reduce((a,b)=>[Math.min(a[0],b[0]),Math.min(a[1],b[1])]);
    let sleeve = "";
    if (sizes.includes("90")) sleeve = " 90cmは袖プリント不可。";
    else {
      const sl = sizes.map(s=>KIDS_PRINT_LIMITS[s].sleeve).reduce((a,b)=>[Math.min(a[0],b[0]),Math.min(a[1],b[1])]);
      sleeve = ` 袖の目安はW${sl[0]}×H${sl[1]}cm以内。`;
    }
    return `選択中のキッズ（${sizes.join("・")}）のプリント可能範囲の目安は、胸・背がW${body[0]}×H${body[1]}cm以内です。${sleeve}`;
  }

  function update(){
    const c = saleCalc();
    POS.forEach(({key}, index) => {
      if (key!=="rsleeve" && key!=="lsleeve") return;
      const card = $("cq-pos").querySelectorAll(".cq-pos")[index];
      card?.querySelectorAll("[data-size]").forEach(button => {
        const unavailable = c.hasKids90 && button.dataset.size!=="none";
        button.disabled = unavailable;
        button.title = unavailable ? "90cmを含む見積もりでは袖プリントを選べません" : "";
      });
    });
    state.rows.forEach(r => {
      const l = c.lines.find(x=>x.r===r); const el = $(`rowsum-${r.id}`);
      if (el) el.innerHTML = l.rq ? `この行 <b class="cq-num">${l.rq}枚</b>` : "サイズごとの枚数を入力してください";
    });
    const splitNote = c.splitSilk ? "・別版2原寸" : "";
    $("cq-band").textContent = c.qty ? `合計 ${c.qty}枚${c.band?`（${c.band.label}の料金${splitNote}）`:""}` : "枚数未入力";
    const kidsRule = $("cq-kids-rule"), kidsChoice = $("cq-kids-choice");
    kidsRule.hidden = !(c.method==="silk" && c.kidsQty>0);
    kidsChoice.hidden = !(c.method==="silk" && c.kidsQty>0 && c.standardQty>0);
    $("cq-kids-limit").textContent = kidsRule.hidden ? "" : kidsLimitText(c);
    document.querySelectorAll("[data-kids-plate]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.kidsPlate===state.kidsPlate)));
    const selectedTones = new Set(c.lines.filter(l => l.rq).map(l => l.r.tone));
    const bodyTone = selectedTones.size > 1 ? "ホワイト・カラー混在" : selectedTones.has("color") ? "カラー" : "ホワイト";
    const itemAverage = c.qty ? c.goods / c.qty : 0;
    const averageLabel = c.hasPrint ? "商品・プリント平均" : "商品平均";
    $("cq-unit").innerHTML = !(c.qty && c.unit) ? "" : `${averageLabel} 1枚 ${yen(itemAverage)}円 <small>（${bodyTone}・送料／オプション除く）</small>`
      + (c.method!=="silk" && c.small > 0 ? `<br><small>＋少量手数料 ${yen(c.small)}円（${c.smallCapped ? `${SALE.digital.smallFee.maxQty+1}枚分の料金を上限に減額` : `${SALE.digital.smallFee.maxQty}枚以下のご注文に1回`}・単価には含みません）</small>` : "");
    $("cq-goods").textContent = `${yen(c.goods)}円`;
    $("cq-goods-d").textContent = !c.qty ? "" : c.hasPrint ? METHODS[c.method].short + "：" + c.active.map(posLabel).join("・") : "無地";
    $("cq-small-line").hidden = !c.small; $("cq-small").textContent = c.small < 0 ? `−${yen(-c.small)}円` : `${yen(c.small)}円`;
    $("cq-small-t").textContent = c.method==="silk" ? "小ロット料金" : c.small < 0 ? "上限調整" : "少量手数料";
    $("cq-small-d").textContent = c.method==="silk" ? "10枚に満たない分" : c.smallCapped ? `${SALE.digital.smallFee.maxQty+1}枚分の料金を上限に減額` : `${SALE.digital.smallFee.maxQty}枚以下のご注文に1回`;
    $("cq-xl-line").hidden = !c.xlPlate; $("cq-xl").textContent = `${yen(c.xlPlate)}円`; $("cq-xl-d").textContent = `${c.largeCount}か所`;
    $("cq-data-line").hidden = !c.data; $("cq-datav").textContent = `−${yen(c.data)}円`;
    $("cq-pack-line").hidden = !state.pack; $("cq-packv").textContent = `${yen(c.pack)}円`;
    $("cq-ship").textContent = !c.qty ? "—" : c.shipFree ? "無料" : `${yen(c.ship)}円`;
    $("cq-ship-d").textContent = !c.qty ? "" : c.shipFree ? "3万円以上で無料" : `あと${yen(SALE.shipping.freeOver-(c.total-c.ship))}円で無料`;
    const bd = silkBreakdown(c);
    c.bd = bd;
    $("cq-lines").hidden = !!bd;
    $("cq-bd").hidden = !bd;
    if (bd) {
      $("cq-bd-body").innerHTML = bd.lines.map(x => `<tr><td>${esc(x.d)}<span class="cq-detail">${yen(x.n)}${x.u} × ${x.p<0?"−":""}${yen(Math.abs(x.p))}円</span></td><td>${x.p<0?"−":""}${yen(Math.abs(Math.round(x.n*x.p)))}円</td></tr>`).join("");
      $("cq-bd-sub").textContent = `${yen(bd.sub)}円`;
      $("cq-bd-tax").textContent = `${yen(bd.tax)}円`;
    }
    const total = bd ? bd.total : c.total;
    $("cq-total").innerHTML = `${yen(total)}<small>円</small>`;
    $("cq-per").textContent = c.qty ? `1枚あたり ${yen(total/c.qty)}円（税込）` : "1枚あたり —";
    $("cq-taxnote").textContent = !c.qty ? "" : bd ? "明細は正式なお見積書（税別）と同じ形です" : `うち消費税 ${yen(c.tax)}円`;
    const alert = $("cq-alert");
    let msg = "";
    if (c.qty > SALE.maxQty) msg = `合計${c.qty}枚です。500枚以上は個別にお見積もりします。依頼ボタンの内容を添えてお問い合わせください。`;
    else if (c.invalidKidsSleeve) msg = "90cmは袖プリントに対応していません。右そで・左そでを『なし』にするか、90cmを別サイズへ変更してください。";
    else if (!c.qty) msg = "サイズごとの枚数を入力すると金額が出ます。";
    else if (c.splitSilk) msg = "アダルト・ガールズ用とキッズ用で原寸を分け、版代を追加しています。プリント単価の枚数帯は合計枚数です。小さい共通原寸でよい場合は『小さい原寸で共通版』へ切り替えられます。";
    else if (c.method==="silk" && c.hasPrint && c.qty < 10) msg = "シルクは1枚から作れますが、版代がかかるので少ない枚数ではDTG・DTFがお得なことが多いです。下の比較をご覧ください。";
    else if (c.small) msg = `${SALE.digital.smallFee.maxQty}枚以下のご注文は少量手数料${yen(SALE.digital.smallFee.fee)}円がかかります（合計は${SALE.digital.smallFee.maxQty+1}枚で頼んだときの金額が上限）。${SALE.digital.smallFee.maxQty+1}枚からはかかりません。`;
    alert.hidden = !msg; alert.textContent = msg;
    $("cq-cta").disabled = !c.qty || c.invalidKidsSleeve;
    highlightRef(c.band, c.method);
    renderCurve(c);
    const cmp = $("cq-compare");
    cmp.innerHTML = (c.qty && c.hasPrint && c.qty <= SALE.maxQty) ? `<span class="h">同じ場所をほかの方法で刷ると（税込）</span>` + compareAll().map(x =>
      `<div class="${x.m===c.method?"on":""}"><span>${METHODS[x.m].short}${x.m===c.method?"（選択中）":""}</span><span>${yen(x.total)}円</span></div>`).join("") : "";
    $("cq-form-total").textContent = c.qty ? `${yen(total)}円（税込）` : "—";
  }

  function summaryText(c){
    const L = ["【cropri 5001 見積もり依頼】"];
    c.lines.filter(l=>l.rq).forEach(l => {
      const col = l.r.tone==="white" ? "ホワイト" : (l.r.colorName ? `カラー（${l.r.colorName}）` : "カラー");
      const sizes = SALE.sizes[l.r.type].filter(s=>l.r.qty[s]).map(s=>`${s}×${l.r.qty[s]}`).join(" ");
      L.push(`・${productName(l.r.type)} ${col}：${sizes}（${l.rq}枚）`);
    });
    L.push(`プリント方法：${METHODS[c.method].name}`);
    L.push(`プリント：${c.hasPrint ? c.active.map(posLabel).join("、") : "なし"}`);
    const opts = [state.repeat?"追加注文":"", state.data?"完全データ入稿":"", state.pack?"袋詰めあり":""].filter(Boolean);
    L.push(`合計枚数：${c.qty}枚${opts.length?"／"+opts.join("／"):""}`);
    L.push(`お届け地域：${SALE.shipping.regions[state.region][0]}`);
    const bd = silkBreakdown(c);
    if (bd) {
      L.push("", "【明細（税別）】");
      bd.lines.forEach(x => L.push(`${x.d}　${x.n}${x.u} × ${x.p}円 ＝ ${Math.round(x.n*x.p)}円`));
      L.push(`小計（税別）${yen(bd.sub)}円／消費税 ${yen(bd.tax)}円`);
      L.push(`概算合計（税込）${yen(bd.total)}円`);
    } else {
      L.push(`概算合計（税込）${yen(c.total)}円（うち送料 ${c.shipFree?"無料":yen(c.ship)+"円"}）`);
    }
    return L.join("\n");
  }
  /* ---------- 見積もり依頼（管理者だけに届く。サイト上には公開しない） ---------- */
  const esc = t => String(t).replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  const CFG = window.CROPRI_ESTIMATOR || {};
  $("cq-cta").addEventListener("click", () => {
    $("cq-form").hidden = false; $("cq-cta").hidden = true;
    $("cq-form").querySelector("input[name=name]").focus();
  });
  $("cq-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, msg = $("cq-form-msg"), btn = f.querySelector("button[type=submit]");
    const c = saleCalc();
    if (!c.qty || c.qty > SALE.maxQty) { msg.textContent = "枚数を確認してください（500枚以上は個別のお見積もりです）。"; return; }
    if (c.invalidKidsSleeve) { msg.textContent = "90cmは袖プリントに対応していません。プリント位置またはサイズを変更してください。"; return; }
    if (!f.reportValidity()) return;
    if (!CFG.endpoint) { msg.textContent = "この画面からは送信できません（サイトの見積もりページから送信してください）。"; return; }
    const bd = silkBreakdown(c);
    const body = {
      name: f.name.value.trim(), email: f.email.value.trim(), tel: f.tel.value.trim(), message: f.message.value.trim(),
      website: f.website.value, summary: summaryText(c), total: bd ? bd.total : c.total, qty: c.qty, method: c.method,
      lines: bd ? bd.lines.map(x => ({ description:x.d, quantity:x.n, unit:x.u, unit_price:x.p })) : []
    };
    btn.disabled = true; msg.textContent = "送信しています…";
    try {
      const res = await fetch(CFG.endpoint, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.message || "送信できませんでした。");
      f.reset(); f.hidden = true;
      $("cq-done").hidden = false;
    } catch (err) {
      msg.textContent = `${err.message} 時間をおいてもう一度お試しいただくか、お問い合わせページからご連絡ください。`;
      btn.disabled = false;
    }
  });

  /* ---------- reference tables ---------- */
  const REF_QS = [1, 5, 10, 20, 30, 50, 100, 300];
  function renderRef(){
    const QS = REF_QS;
    const per = (q, size, colors) => {
      const band = SALE.bands.find(b => q>=b.min && q<=b.max);
      return SALE.blank + silkPool({ key:"front", st:{ size, colors } }, q, band)/q;
    };
    const row = (label, size, colors) => `<tr><th scope="row">${label}</th>${QS.map((q,i)=>`<td data-band="${i}">${yen(per(q,size,colors))}円</td>`).join("")}</tr>`;
    const t1 = `<table class="cq-table"><caption style="text-align:left;font-weight:700;padding:6px 0">1枚あたりの価格（ホワイトS〜XL・前面1か所・版代込み・税込）</caption>
      <thead><tr><th scope="col">枚数</th>${QS.map(q=>`<th scope="col">${q}枚</th>`).join("")}</tr></thead>
      <tbody>${row("通常・1色","mid",1)}${row("通常・2色","mid",2)}${row("特大・1色","large",1)}</tbody></table>
      <p class="cq-note" style="margin-top:8px">Tシャツ代・デザインデータ作成（修正2回まで）・版代・プリント代込み。プリントする場所ごと・色ごとに版代とプリント代がかかります。1枚から実際の枚数で計算します。</p>`;
    const a = SALE.bodyAdj.adult;
    const t2 = `<table class="cq-table" style="margin-top:16px"><caption style="text-align:left;font-weight:700;padding:6px 0">5001シリーズの無地価格（1枚・税込）</caption>
      <thead><tr><th scope="col">品番・サイズ</th><th scope="col">ホワイト</th><th scope="col">カラー</th></tr></thead>
      <tbody>
        <tr><th scope="row">5001-01 S〜XL</th><td>${yen(SALE.blank)}円</td><td>${yen(SALE.blank+a.color.S)}円</td></tr>
        <tr><th scope="row">5001-01 XXL</th><td>${yen(SALE.blank+a.white.XXL)}円</td><td>${yen(SALE.blank+a.color.XXL)}円</td></tr>
        <tr><th scope="row">5001-01 XXXL</th><td>${yen(SALE.blank+a.white.XXXL)}円</td><td>${yen(SALE.blank+a.color.XXXL)}円</td></tr>
        <tr><th scope="row">5001-02 90〜160</th><td>${yen(SALE.blank+SALE.bodyAdj.kids.white["90"])}円</td><td>${yen(SALE.blank+SALE.bodyAdj.kids.color["90"])}円</td></tr>
        <tr><th scope="row">5001-03 G-M・G-L</th><td>${yen(SALE.blank)}円</td><td>${yen(SALE.blank+a.color.S)}円</td></tr>
      </tbody></table>
      <p class="cq-note" style="margin-top:8px">プリントありの場合も、この差額が1枚ごとに加わります。送料は税込${yen(SALE.shipping.freeOver)}円以上で無料。</p>`;
    const db = SALE.digital.bands;
    const dRows = (tbl, names) => Object.entries(tbl).map(([sz,arr]) => `<tr><th scope="row">${names?names+" ":""}${sz}</th>${db.map((b,i)=>`<td data-band="${i}">${yen(arr[i])}円</td>`).join("")}</tr>`).join("");
    const tHead = `<thead><tr><th scope="col">大きさ</th>${db.map(b=>`<th scope="col">${b.label}</th>`).join("")}</tr></thead>`;
    const dNote = `1枚の価格＝Tシャツ代（無地価格＋差額）＋プリントする場所ごとのプリント代。色数による変動なし・版代なし。デザインデータ作成（修正2回まで）込み。1枚からご注文いただけます（${SALE.digital.smallFee.maxQty}枚以下は少量手数料${yen(SALE.digital.smallFee.fee)}円。ただし合計は${SALE.digital.smallFee.maxQty+1}枚で頼んだときの金額が上限）。`;
    const tDtg = `<table class="cq-table"><caption style="text-align:left;font-weight:700;padding:6px 0">DTG：1か所あたりのプリント代（税込）</caption>${tHead}
      <tbody>${dRows(SALE.digital.dtg.white,"ホワイト")}${dRows(SALE.digital.dtg.color,"カラー")}</tbody></table>
      <p class="cq-note" style="margin-top:8px">${dNote}</p>`;
    const tDtf = `<table class="cq-table"><caption style="text-align:left;font-weight:700;padding:6px 0">DTF：1か所あたりのプリント代（税込・Tシャツの色に関係なし）</caption>${tHead}
      <tbody>${dRows(SALE.digital.dtf,"")}</tbody></table>
      <p class="cq-note" style="margin-top:8px">${dNote}</p>`;
    const first = state.method==="silk" ? t1 : state.method==="dtg" ? tDtg : tDtf;
    $("cq-reftables").innerHTML = first + t2;
  }
  function highlightRef(band, method){
    const q = saleCalc().qty;
    const idx = !band ? -1 : (method && method!=="silk") ? SALE.digital.bands.indexOf(band) : REF_QS.reduce((a, x, i) => q >= x ? i : a, -1);
    document.querySelectorAll("#cq-reftables td[data-band]").forEach(td => td.classList.toggle("on", Number(td.dataset.band)===idx));
  }


  // 商品ページからの選択は許可した品番・サイズだけを受け付ける。
  const selection = new URLSearchParams(window.location.search);
  const selectedType = Object.keys(SALE.products).find(type => SALE.products[type].sku === selection.get("sku"));
  if (selectedType && SALE.sizes[selectedType].includes(selection.get("size"))) {
    const colorCode = selection.get("color_code") || "";
    const colorName = (selection.get("color") || "").trim();
    // renderRows の属性へ入るため、商品名に不要な記号は受け付けない。
    if (window.CROPRI_5001_COLORS && Object.prototype.hasOwnProperty.call(window.CROPRI_5001_COLORS, colorCode) && window.CROPRI_5001_COLORS[colorCode] === colorName) {
      const count = Number(selection.get("qty") || 1);
      const quantity = Number.isInteger(count) && count >= 1 && count <= SALE.maxQty ? count : 1;
      state.rows = [{ id: ++rowSeq, type: selectedType, tone: colorCode === "0001" ? "white" : "color", colorName, qty: { [selection.get("size")]: quantity } }];
    }
  }
  renderMethods(); renderRows(); renderPos(); renderRef(); syncOptions(); update();
})();
