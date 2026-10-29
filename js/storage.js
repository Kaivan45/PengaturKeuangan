'use strict';
/* Lapisan penyimpanan: semua akses localStorage lewat objek Store. */
const Store = (() => {
  const KEY = 'moneymate_data_v1';
  const EXP = ['Makanan','Transportasi','Kos','Paket Data','Skincare','Gym','Pendidikan','Hiburan','Belanja','Kebutuhan Lainnya'];
  const INC = ['Uang Saku','Beasiswa','Gaji','Penghasilan Sampingan','Lainnya'];
  const METHODS = ['Tunai','Transfer','E-Wallet'];
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  let data, listeners = [], loadError = false, storageOk = true, warned = false;
  const probe = () => { try { const k = KEY + '_test'; localStorage.setItem(k, '1'); const ok = localStorage.getItem(k) === '1'; localStorage.removeItem(k); return ok; } catch (e) { return false; } };

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const monthStart = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`; };
  const defaults = () => ({
    app: 'MoneyMate', version: 1, transactions: [], goals: [],
    customCategories: { expense: [], income: [] },
    budget: { total: 0, anchor: monthStart(), month: null, custom: {}, categories: {} },
    prefs: { page: 'dashboard', hideWarn: false, defMode: 'p10', tpl: {} }
  });
  const num = v => typeof v === 'number' && Number.isFinite(v);
  const validTx = t => t && typeof t === 'object' && typeof t.name === 'string' && ['income','expense'].includes(t.type) && num(t.amount) && t.amount > 0 && typeof t.category === 'string' && DATE.test(t.date) && METHODS.includes(t.method);
  const validEntry = h => h && ['add','withdraw'].includes(h.type) && num(h.amount) && h.amount > 0 && DATE.test(h.date);
  const validGoal = g => g && typeof g.name === 'string' && num(g.target) && g.target > 0 && DATE.test(g.deadline) && Array.isArray(g.history);

  /* Validasi & normalisasi. strict=true (impor) menolak data tidak valid; strict=false (muat) membuang yang rusak. */
  function normalize(o, strict) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('Format file tidak valid.');
    if (strict && o.app !== 'MoneyMate') throw new Error('Ini bukan file cadangan MoneyMate.');
    const d = defaults();
    if (o.transactions !== undefined) {
      if (!Array.isArray(o.transactions)) throw new Error('Daftar transaksi rusak.');
      const ok = o.transactions.filter(validTx);
      if (strict && ok.length !== o.transactions.length) throw new Error(`${o.transactions.length - ok.length} transaksi tidak valid.`);
      d.transactions = ok.map(t => ({ id: String(t.id || uid()), name: t.name.slice(0,100), type: t.type, amount: t.amount, category: t.category.slice(0,40), date: t.date, method: t.method, note: String(t.note || '').slice(0,300) }));
    }
    if (o.goals !== undefined) {
      if (!Array.isArray(o.goals)) throw new Error('Daftar target tabungan rusak.');
      const ok = o.goals.filter(g => validGoal(g) && g.history.every(validEntry));
      if (strict && ok.length !== o.goals.length) throw new Error(`${o.goals.length - ok.length} target tabungan tidak valid.`);
      d.goals = ok.map(g => ({ id: String(g.id || uid()), name: g.name.slice(0,60), target: g.target, deadline: g.deadline,
        history: g.history.map(h => ({ id: String(h.id || uid()), type: h.type, amount: h.amount, date: h.date, note: String(h.note || '').slice(0,100) })) }));
    }
    if (o.budget && typeof o.budget === 'object') {
      if (num(o.budget.total) && o.budget.total >= 0) d.budget.total = o.budget.total;
      if (typeof o.budget.anchor === 'string' && DATE.test(o.budget.anchor)) d.budget.anchor = o.budget.anchor;
      const set = x => { if (!x || typeof x !== 'object' || !num(x.total) || x.total < 0 || !x.categories || typeof x.categories !== 'object') return null; const c = {}; for (const [k, v] of Object.entries(x.categories)) if (num(v) && v >= 0) c[k] = v; return { total: x.total, categories: c, ...(num(x.savedAt) ? { savedAt: x.savedAt } : {}) }; };
      d.budget.month = set(o.budget.month);
      if (o.budget.custom && typeof o.budget.custom === 'object') for (const [k, v] of Object.entries(o.budget.custom)) { const s = set(v); if (/^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$/.test(k) && s) d.budget.custom[k] = s; }
      if (o.budget.categories && typeof o.budget.categories === 'object') {
        d.budget.categories = {};
        for (const [k, v] of Object.entries(o.budget.categories)) if (num(v) && v >= 0) d.budget.categories[k] = v;
      }
    }
    if (o.customCategories && typeof o.customCategories === 'object')
      for (const k of ['expense','income']) if (Array.isArray(o.customCategories[k])) d.customCategories[k] = [...new Set(o.customCategories[k].filter(x => typeof x === 'string' && x.trim()).map(x => x.trim().slice(0,30)))];
    if (o.prefs && typeof o.prefs === 'object') {
      const tp = {};
      if (o.prefs.tpl && typeof o.prefs.tpl === 'object') for (const k of ['tanpa', 'kos']) if (o.prefs.tpl[k] && typeof o.prefs.tpl[k] === 'object') { tp[k] = {}; for (const [c, v] of Object.entries(o.prefs.tpl[k])) if (num(v) && v >= 0 && v <= 100) tp[k][c] = v; }
      d.prefs = { ...d.prefs, page: String(o.prefs.page || 'dashboard'), hideWarn: !!o.prefs.hideWarn, defMode: o.prefs.defMode === 'month' ? 'month' : 'p10', tpl: tp };
    }
    // migrasi: anggaran bawaan lama (Rp500.000 + pembagian kategori) yang tidak pernah diubah dikosongkan
    const LEG = { 'Makanan':150000, 'Transportasi':100000, 'Paket Data':50000, 'Skincare':25000, 'Gym':25000, 'Kebutuhan Lainnya':150000 }, bc = d.budget.categories, ks = Object.keys(bc);
    if (d.budget.total === 500000 && !d.budget.month && !Object.keys(d.budget.custom).length && ks.length === 6 && ks.every(k => bc[k] === LEG[k])) { d.budget.total = 0; d.budget.categories = {}; }
    // pastikan kategori transaksi yang belum dikenal tetap tersedia
    for (const t of d.transactions) {
      const list = t.type === 'expense' ? EXP : INC, c = d.customCategories[t.type];
      if (!list.includes(t.category) && !c.includes(t.category)) c.push(t.category);
    }
    return d;
  }

  function save() {
    try { const json = JSON.stringify(data); localStorage.setItem(KEY, json); if (localStorage.getItem(KEY) !== json) throw new Error('verifikasi gagal'); storageOk = true; return true; }
    catch (e) { storageOk = false; if (!warned) { warned = true; alert('Gagal menyimpan data. Penyimpanan browser penuh atau diblokir.'); } return false; }
  }
  const commit = () => { save(); listeners.forEach(fn => fn()); };

  /* Sinkron antar-tab: bila tab lain menyimpan, muat ulang data agar tab ini tidak menimpanya dengan salinan lama. */
  const external = [];
  function reloadFromStorage() {
    try { const raw = localStorage.getItem(KEY); data = raw ? normalize(JSON.parse(raw), false) : defaults(); } catch (e) { return; }
    external.forEach(fn => fn());
  }
  window.addEventListener('storage', e => { if (e.key === KEY || e.key === null) reloadFromStorage(); });

  function init() {
    storageOk = probe();
    if (!storageOk) { data = defaults(); return; }
    // minta browser agar tidak menghapus data situs ini saat penyimpanan menipis
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (_) {}
    try {
      const raw = localStorage.getItem(KEY);
      data = raw ? normalize(JSON.parse(raw), false) : defaults();
    } catch (e) {
      loadError = true;
      try { localStorage.setItem(KEY + '_rusak', localStorage.getItem(KEY) || ''); } catch (_) {}
      data = defaults();
    }
  }

  return {
    EXP, INC, METHODS, uid,
    get data() { return data; },
    get loadError() { return loadError; },
    get storageOk() { return storageOk; },
    onChange: fn => listeners.push(fn),
    onExternal: fn => external.push(fn),
    init,
    addTx: t => { data.transactions.push({ ...t, id: uid() }); commit(); },
    updateTx: (id, t) => { const i = data.transactions.findIndex(x => x.id === id); if (i > -1) { data.transactions[i] = { ...t, id }; commit(); } },
    deleteTx: id => { data.transactions = data.transactions.filter(t => t.id !== id); commit(); },
    saveGoal: (id, g) => {
      if (id) { const x = data.goals.find(v => v.id === id); if (x) Object.assign(x, g); }
      else data.goals.push({ ...g, id: uid(), history: [] });
      commit();
    },
    deleteGoal: id => { data.goals = data.goals.filter(g => g.id !== id); commit(); },
    addFund: (goalId, e) => { const g = data.goals.find(x => x.id === goalId); if (g) { g.history.push({ ...e, id: uid() }); commit(); } },
    deleteFund: (goalId, entryId) => { const g = data.goals.find(x => x.id === goalId); if (g) { g.history = g.history.filter(h => h.id !== entryId); commit(); } },
    setBudget: b => { data.budget = b; commit(); },
    addCategory: (type, name) => { data.customCategories[type].push(name); commit(); },
    removeCategory: (type, name) => { data.customCategories[type] = data.customCategories[type].filter(c => c !== name); delete data.budget.categories[name]; commit(); },
    setPref: (k, v) => { data.prefs[k] = v; save(); },
    exportJSON: () => JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2),
    importJSON: text => {
      try { data = normalize(JSON.parse(text), true); commit(); return { ok: true }; }
      catch (e) { return { ok: false, error: e instanceof SyntaxError ? 'File bukan JSON yang valid.' : e.message }; }
    },
    reset: () => { data = defaults(); commit(); }
  };
})();