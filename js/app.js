'use strict';
/* ===== Utilitas ===== */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const D = () => Store.data;
const rp = n => (n < 0 ? '-' : '') + 'Rp' + Math.abs(Math.round(n)).toLocaleString('id-ID');
const parseRp = v => { const s = String(v ?? '').trim().replace(/^rp\.?\s*/i, '').replace(/[.\s]/g, '').replace(',', '.'); return s === '' ? NaN : Number(s); }; // terima “150.000”, “Rp150000”, dll.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const parse = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const fmtDate = s => parse(s).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
const lastDay = (y, m) => new Date(y, m, 0).getDate();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const mkP = s => ({ start: s, end: addDays(s, 9) });                       // 1 periode = 10 hari sejak tanggal mulai
const periodOf = s => mkP(addDays(D().budget.anchor, Math.floor(daysBetween(D().budget.anchor, s) / 10) * 10)); // siklus dari tanggal acuan
const prevPeriod = p => mkP(addDays(p.start, -10));
const plabel = p => `${fmtDate(p.start)} – ${fmtDate(p.end)}`;
const bar = (p, cls='success') => `<div class="progress" style="height:8px"><div class="progress-bar bg-${cls}" style="width:${Math.min(100,Math.max(0,p))}%"></div></div>`;
const status = p => p >= 100 ? ['danger','Terlampaui'] : p >= 80 ? ['warning','Hampir habis'] : ['success','Aman'];
const badge = p => { const [c,t] = status(p); return `<span class="badge text-bg-${c}">${t}</span>`; };

function toast(msg, type='success') {
  const el = document.createElement('div');
  el.className = `toast align-items-center text-bg-${type} border-0`;
  el.innerHTML = `<div class="d-flex"><div class="toast-body">${esc(msg)}</div><button class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  $('#toasts').append(el);
  const t = new bootstrap.Toast(el, { delay: 3500 }); t.show();
  el.addEventListener('hidden.bs.toast', () => el.remove());
}
function download(name, text, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ===== Perhitungan ===== */
const inR = r => D().transactions.filter(t => t.date >= r.start && t.date <= r.end);
const sumT = (arr, type) => arr.filter(t => t.type === type).reduce((a, t) => a + t.amount, 0);
const saved = g => g.history.reduce((a, h) => a + (h.type === 'add' ? h.amount : -h.amount), 0);
const totalSaved = () => D().goals.reduce((a, g) => a + saved(g), 0);
// Dana tabungan bukan pemasukan/pengeluaran; hanya memindahkan uang dari saldo ke tabungan.
const balance = () => sumT(D().transactions, 'income') - sumT(D().transactions, 'expense') - totalSaved();
const expCats = () => [...Store.EXP, ...D().customCategories.expense];
const incCats = () => [...Store.INC, ...D().customCategories.income];
const byCat = arr => { const o = {}; arr.filter(t => t.type === 'expense').forEach(t => o[t.category] = (o[t.category] || 0) + t.amount); return o; };
const sortTx = (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id);

/* ===== Filter periode ===== */
const mkF = () => ({ mode:'p10', month: today().slice(0,7), start: periodOf(today()).start, from: today().slice(0,7)+'-01', to: today() });
let F;
function getRange(f) {
  const month = /^\d{4}-\d{2}$/.test(f.month) ? f.month : today().slice(0,7);
  const [y, m] = month.split('-').map(Number);
  if (f.mode === 'month') return { start:`${month}-01`, end:`${month}-${pad(lastDay(y,m))}`, label:'Bulan ' + new Date(y,m-1,1).toLocaleDateString('id-ID',{month:'long',year:'numeric'}) };
  if (f.mode === 'custom') {
    let a = f.from || today(), b = f.to || today(); if (a > b) [a, b] = [b, a];
    return { start:a, end:b, label:`${fmtDate(a)} – ${fmtDate(b)}` };
  }
  const p = mkP(DATE_RE.test(f.start) ? f.start : periodOf(today()).start); return { ...p, label: plabel(p) };
}
function filterHTML(k, onlyP10) {
  const f = F[k], o = (v,t) => `<option value="${v}" ${f.mode===v?'selected':''}>${t}</option>`;
  const p10 = onlyP10 || f.mode === 'p10', st = DATE_RE.test(f.start) ? f.start : periodOf(today()).start;
  return `<div class="filter-bar d-flex flex-wrap gap-2 align-items-end" data-f="${k}">
    ${onlyP10 ? '' : `<div><label>Periode</label><select class="form-select form-select-sm" data-k="mode">${o('p10','Per 10 hari')}${o('month','Bulanan')}${o('custom','Rentang khusus')}</select></div>`}
    ${p10 ? `<div><label>Mulai tanggal (10 hari)</label><div class="input-group input-group-sm"><button class="btn btn-outline-secondary" data-act="shift-p" data-dir="-1" title="10 hari sebelumnya"><i class="bi bi-chevron-left"></i></button><input type="date" class="form-control" data-k="start" value="${st}"><button class="btn btn-outline-secondary" data-act="shift-p" data-dir="1" title="10 hari berikutnya"><i class="bi bi-chevron-right"></i></button></div></div><div><button class="btn btn-sm btn-outline-success" data-act="cur-p">Periode ini</button></div>`
    : f.mode === 'custom' ? `<div><label>Dari</label><input type="date" class="form-control form-control-sm" data-k="from" value="${f.from}"></div><div><label>Sampai</label><input type="date" class="form-control form-control-sm" data-k="to" value="${f.to}"></div>`
    : `<div><label>Bulan</label><input type="month" class="form-control form-control-sm" data-k="month" value="${f.month}"></div>`}
  </div>`;
}

/* ===== Grafik ===== */
const charts = {};
function chart(id, cfg, has) {
  const box = $('#' + id + 'Box'); if (!box) return;
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  if (!has) { box.innerHTML = '<div class="empty">Belum ada data pada periode ini.</div>'; return; }
  if (typeof Chart === 'undefined') { box.innerHTML = '<div class="empty">Grafik tidak dapat dimuat. Periksa koneksi internet untuk memuat Chart.js.</div>'; return; }
  box.innerHTML = `<canvas id="${id}"></canvas>`;
  charts[id] = new Chart($('#' + id), { ...cfg, options: { responsive:true, maintainAspectRatio:false, ...cfg.options } });
}
const PALETTE = ['#15803d','#22c55e','#86efac','#0f766e','#2dd4bf','#65a30d','#a3e635','#ca8a04','#f59e0b','#94a3b8','#64748b'];
const stat = (label, val, icon, extra='', hero=false) => `<div class="col-6 col-lg-4 col-xl"><div class="panel stat h-100 ${hero?'hero':''}"><div class="d-flex justify-content-between align-items-start"><div><div class="l">${label}</div><div class="v">${val}</div></div><div class="i"><i class="bi ${icon}"></i></div></div>${extra?`<div class="small mt-1 ${hero?'':'text-muted'}">${extra}</div>`:''}</div></div>`;
const goalBar = g => { const s = saved(g), p = s / g.target * 100; return `<div class="mb-3"><div class="d-flex justify-content-between small"><b>${esc(g.name)}</b><span>${Math.min(100,Math.round(p))}%</span></div>${bar(p)}<div class="small text-muted">${rp(s)} dari ${rp(g.target)}</div></div>`; };

function barSeries(tx, r) {
  const monthly = (parse(r.end) - parse(r.start)) / 864e5 > 62;
  const m = {};
  tx.forEach(t => { const k = monthly ? t.date.slice(0,7) : t.date; (m[k] = m[k] || { income:0, expense:0 })[t.type] += t.amount; });
  const keys = Object.keys(m).sort();
  const lab = k => monthly ? new Date(+k.slice(0,4), +k.slice(5)-1, 1).toLocaleDateString('id-ID',{month:'short',year:'2-digit'}) : fmtDate(k).replace(/ \d{4}$/, '');
  return { labels: keys.map(lab), inc: keys.map(k => m[k].income), exp: keys.map(k => m[k].expense) };
}
const fmtTick = v => 'Rp' + Number(v).toLocaleString('id-ID');
const moneyOpts = { scales: { y: { beginAtZero:true, ticks: { callback: fmtTick } } }, plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label || c.label}: ${rp(c.parsed.y ?? c.parsed)}` } } } };

/* ===== View: Dashboard ===== */
/* Panel utama dashboard: anggaran 10 hari yang sedang berlaku (selalu periode berjalan, tidak terpengaruh filter). */
/* Mode anggaran yang dipakai: ikuti preferensi, tetapi bila mode itu belum punya anggaran sedangkan mode lain sudah, pakai mode yang sudah terisi. */
function budgetMode() {
  const B = D().budget, pref = D().prefs.defMode === 'month' ? 'month' : 'p10';
  const has = { p10: B.total > 0, month: B.total > 0 || !!(B.month && B.month.total > 0) };
  return has[pref] || !(has.p10 || has.month) ? pref : (pref === 'p10' ? 'month' : 'p10');
}
/* Anggaran rentang khusus yang mencakup hari ini (bila ada, yang paling baru dimulai didahulukan). */
function customNow() {
  const c = D().budget.custom || {}, t = today();
  const hit = Object.keys(c).map(k => k.split('_')).filter(([s, e]) => s <= t && t <= e).sort((x, y) => y[0].localeCompare(x[0]))[0];
  return hit ? { start: hit[0], end: hit[1], set: c[hit.join('_')] } : null;
}
function budgetNow() {
  const cn = customNow(), mode = cn ? 'custom' : budgetMode(), [yy, mm] = today().split('-').map(Number);
  const bp = cn ? { start: cn.start, end: cn.end } : mode === 'month' ? { start: `${yy}-${pad(mm)}-01`, end: `${yy}-${pad(mm)}-${pad(lastDay(yy, mm))}` } : periodOf(today());
  const b0 = cn ? cn.set : budgetFor(mode, bp), spent = sumT(inR(bp), 'expense'), total = b0.total, cb = b0.categories;
  if (!total) return '<div class="panel mb-3"><h2 class="h6 mb-1">Anggaran berlaku</h2><p class="small text-muted mb-2">Anggaran belum diatur. Tentukan anggaran agar sisa uang dan peringatan bisa dipantau.</p><a href="#anggaran" class="btn btn-success btn-sm">Atur anggaran</a></div>';
  const pct = total ? spent / total * 100 : 0, [cls] = status(pct), left = daysBetween(today(), bp.end) + 1, cs = byCat(inR(bp));
  const msg = pct >= 100 ? `<div class="alert alert-danger py-2 small mb-2"><i class="bi bi-exclamation-octagon"></i> Anggaran periode ini sudah terpakai ${Math.round(pct)}%. Tahan pengeluaran non-esensial.</div>`
    : pct >= 80 ? `<div class="alert alert-warning py-2 small mb-2"><i class="bi bi-exclamation-triangle"></i> Anggaran sudah terpakai ${Math.round(pct)}%. Sisa ${rp(total - spent)} untuk ${left} hari lagi.</div>` : '';
  const rows = expCats().filter(c => cb[c] || cs[c]).map(c => { const bb = cb[c] || 0, s = cs[c] || 0, pc = bb ? s / bb * 100 : 100;
    return `<div class="col-md-6"><div class="d-flex justify-content-between small"><span>${esc(c)}</span><span class="text-muted">${rp(s)}${bb ? ' / ' + rp(bb) : ' · tanpa anggaran'}</span></div>${bb ? bar(pc, status(pc)[0]) : ''}</div>`; }).join('');
  return `<div class="panel mb-3">
    <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2"><div><h2 class="h6 mb-0">Anggaran berlaku ${badge(pct)}${cn ? ' <span class="badge text-bg-secondary">Rentang khusus</span>' : ''}</h2><div class="small text-muted">${plabel(bp)} · ${left} hari lagi</div></div><a href="#anggaran" class="small">Atur anggaran</a></div>
    ${msg}
    <div class="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-1"><div><span class="fs-4 fw-bold">${rp(total - spent)}</span> <span class="text-muted small">sisa dari ${rp(total)}</span></div><div class="small text-muted">Terpakai ${rp(spent)} · ${Math.round(pct)}%</div></div>
    ${bar(pct, cls)}
    ${rows ? `<details class="mt-2"><summary>Rincian per kategori</summary><div class="row g-3 mt-0">${rows}</div></details>` : ''}
  </div>`;
}
function viewDashboard() {
  const r = getRange(F.dash), tx = inR(r), inc = sumT(tx,'income'), exp = sumT(tx,'expense');
  const recent = [...D().transactions].sort(sortTx).slice(0, 6);
  $('#view-dashboard').innerHTML = `
  ${D().prefs.hideWarn ? '' : `<div class="alert alert-warning alert-dismissible small"><i class="bi bi-info-circle"></i> Data MoneyMate tersimpan di browser & perangkat ini dan tidak tersinkron antarperangkat. Buat cadangan di menu Pengaturan.<button class="btn-close" data-act="hide-warn"></button></div>`}
  <div class="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3"><div><h1 class="h3 m-0">Dashboard</h1><div class="small text-muted">${esc(r.label)}</div></div>${filterHTML('dash')}</div>
  ${budgetNow()}
  <div class="row g-3 mb-3">
    ${stat('Total saldo', rp(balance()), 'bi-wallet2', 'Di luar dana tabungan', true)}
    ${stat('Pemasukan', rp(inc), 'bi-arrow-down-left', 'Periode terpilih')}
    ${stat('Pengeluaran', rp(exp), 'bi-arrow-up-right', 'Periode terpilih')}
    ${stat('Total tabungan', rp(totalSaved()), 'bi-piggy-bank', `${D().goals.length} target`)}
  </div>
  <div class="row g-3 mb-3">
    <div class="col-lg-7"><div class="panel"><h2 class="h6">Pemasukan & pengeluaran</h2><div class="chart-box" id="chBarBox"></div></div></div>
    <div class="col-lg-5"><div class="panel"><h2 class="h6">Pengeluaran per kategori</h2><div class="chart-box" id="chPieBox"></div></div></div>
  </div>
  <div class="row g-3">
    <div class="col-lg-7"><div class="panel"><div class="d-flex justify-content-between"><h2 class="h6">Transaksi terbaru</h2><a href="#transaksi" class="small">Lihat semua</a></div>
      ${recent.length ? `<div class="table-responsive"><table class="table align-middle mb-0"><tbody>${recent.map(t => `<tr><td><b>${esc(t.name)}</b><div class="small text-muted">${esc(t.category)} · ${fmtDate(t.date)}</div></td><td class="text-end fw-semibold ${t.type==='income'?'text-success':'text-danger'}">${t.type==='income'?'+':'-'}${rp(t.amount)}</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="empty py-4">Belum ada transaksi. <button class="btn btn-success btn-sm mt-2" data-act="new-tx">Catat transaksi pertama</button></div>`}</div></div>
    <div class="col-lg-5"><div class="panel"><div class="d-flex justify-content-between"><h2 class="h6">Target tabungan</h2><a href="#tabungan" class="small">Kelola</a></div>
      ${D().goals.length ? D().goals.slice(0,4).map(goalBar).join('') : '<div class="empty py-4">Belum ada target tabungan.</div>'}</div></div>
  </div>`;
  const s = barSeries(tx, r);
  chart('chBar', { type:'bar', data:{ labels:s.labels, datasets:[{label:'Pemasukan',data:s.inc,backgroundColor:'#15803d'},{label:'Pengeluaran',data:s.exp,backgroundColor:'#bbf7d0'}] }, options:moneyOpts }, tx.length > 0);
  const c = byCat(tx), ck = Object.keys(c);
  chart('chPie', { type:'doughnut', data:{ labels:ck, datasets:[{data:ck.map(k=>c[k]),backgroundColor:PALETTE}] }, options:{ plugins:{ legend:{position:'bottom'}, tooltip:{callbacks:{label:x=>`${x.label}: ${rp(x.parsed)}`}} } } }, ck.length > 0);
}

/* ===== View: Transaksi ===== */
function viewTx() {
  const sel = $('#fCat'), cur = sel.value;
  sel.innerHTML = '<option value="">Semua kategori</option>' + [...new Set([...expCats(), ...incCats()])].map(c => `<option>${esc(c)}</option>`).join('');
  sel.value = cur;
  const q = $('#fSearch').value.trim().toLowerCase(), ft = $('#fType').value, fc = sel.value, fm = $('#fMethod').value, a = $('#fFrom').value, b = $('#fTo').value;
  const list = D().transactions.filter(t => (!q || (t.name + ' ' + t.note).toLowerCase().includes(q)) && (!ft || t.type === ft) && (!fc || t.category === fc) && (!fm || t.method === fm) && (!a || t.date >= a) && (!b || t.date <= b)).sort(sortTx);
  $('#txCount').textContent = `${list.length} transaksi ditampilkan dari ${D().transactions.length}`;
  $('#txBody').innerHTML = list.length ? list.map(t => `<tr><td class="text-nowrap">${fmtDate(t.date)}</td><td><b>${esc(t.name)}</b>${t.note ? `<div class="small text-muted">${esc(t.note)}</div>` : ''}</td><td>${esc(t.category)}</td><td>${esc(t.method)}</td><td class="text-end fw-semibold text-nowrap ${t.type==='income'?'text-success':'text-danger'}">${t.type==='income'?'+':'-'}${rp(t.amount)}</td><td class="text-end text-nowrap"><button class="btn btn-sm btn-outline-secondary" data-act="edit-tx" data-id="${t.id}" title="Edit"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger" data-act="del-tx" data-id="${t.id}" title="Hapus"><i class="bi bi-trash"></i></button></td></tr>`).join('')
    : `<tr><td colspan="6" class="text-center text-muted py-4">${D().transactions.length ? 'Tidak ada transaksi yang cocok dengan filter.' : 'Belum ada transaksi. Klik “Tambah transaksi” untuk memulai.'}</td></tr>`;
}
const txModal = () => bootstrap.Modal.getOrCreateInstance('#txModal');
function fillTxCats(sel) { $('#txCat').innerHTML = ($('#txType').value === 'expense' ? expCats() : incCats()).map(c => `<option>${esc(c)}</option>`).join(''); if (sel) $('#txCat').value = sel; }
function openTx(id) {
  const t = id && D().transactions.find(x => x.id === id);
  $('#txTitle').textContent = t ? 'Edit transaksi' : 'Tambah transaksi';
  $('#txId').value = t ? t.id : '';
  $('#txName').value = t ? t.name : ''; $('#txType').value = t ? t.type : 'expense';
  $('#txAmount').value = t ? t.amount : ''; $('#txDate').value = t ? t.date : today();
  $('#txMethod').value = t ? t.method : 'Tunai'; $('#txNote').value = t ? t.note : '';
  fillTxCats(t && t.category); txModal().show();
}

/* ===== View: Anggaran ===== */
const scaleSet = (s, k) => ({ total: Math.round(s.total * k), categories: Object.fromEntries(Object.entries(s.categories).map(([c, v]) => [c, Math.round(v * k)])) });
const rangeKey = r => `${r.start}_${r.end}`;
/* Anggaran per mode: 10 hari = pengaturan utama; bulanan & rentang khusus punya pengaturan sendiri, atau dihitung otomatis dari anggaran 10 hari. */
function budgetFor(mode, r) {
  const B = D().budget, base = { total: B.total, categories: B.categories };
  if (mode === 'month') return B.month ? { ...B.month, saved: true } : { ...scaleSet(base, 3), saved: false };
  if (mode === 'custom') { const s = B.custom && B.custom[rangeKey(r)]; return s ? { ...s, saved: true } : { ...scaleSet(base, (daysBetween(r.start, r.end) + 1) / 10), saved: false }; }
  return { ...base, saved: true };
}
function prevRange(mode, r) {
  if (mode === 'month') { const [y, m] = r.start.split('-').map(Number), d = new Date(y, m - 2, 1); return { start: ymd(d), end: ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0)) }; }
  if (mode === 'custom') { const len = daysBetween(r.start, r.end) + 1; return { start: addDays(r.start, -len), end: addDays(r.start, -1) }; }
  return mkP(addDays(r.start, -10));
}
/* Saran pembagian anggaran dalam persen (patokan umum untuk mahasiswa). Hanya mengisi kolom, tidak menyimpan otomatis. */
let tplKos = false;
const TPL = {
  tanpa: [['Tabungan',10],['Makanan',40],['Transportasi',13],['Paket Data',9],['Pendidikan',7],['Hiburan',6],['Skincare',4],['Gym',3],['Belanja',3],['Kebutuhan Lainnya',5]],
  kos:   [['Tabungan',10],['Kos',35],['Makanan',27],['Transportasi',8],['Paket Data',5],['Pendidikan',4],['Hiburan',3],['Skincare',2],['Gym',2],['Belanja',2],['Kebutuhan Lainnya',2]]
};
const tplKey = () => tplKos ? 'kos' : 'tanpa';
const tplList = () => { const ov = (D().prefs.tpl || {})[tplKey()] || {}; return TPL[tplKey()].map(([c, p]) => [c, c in ov ? ov[c] : p]); }; // persen bawaan + ubahan pengguna
const tplSum = () => tplList().reduce((a, [, p]) => a + p, 0);
const tplSumHTML = () => { const x = Math.round(tplSum() * 10) / 10; return x > 100 ? `<span class="text-danger">Jumlah ${x}% — melebihi 100%, kurangi sebagian.</span>` : x < 100 ? `<span class="text-muted">Jumlah ${x}% — sisa ${Math.round((100 - x) * 10) / 10}% belum dialokasikan.</span>` : '<span class="text-success">Jumlah 100% ✓</span>'; };
const tplAmount = (total, pct) => { const step = total >= 200000 ? 1000 : 100; return Math.round(total * pct / 100 / step) * step; };
function budgetTemplate(total, cb) {
  const rows = tplList().map(([c, p]) => `<tr><td>${c === 'Tabungan' ? '<i class="bi bi-piggy-bank text-success"></i> Tabungan (disisihkan)' : esc(c)}</td><td><div class="input-group input-group-sm" style="width:110px"><input type="number" min="0" max="100" step="0.5" class="form-control text-end" data-tplc="${esc(c)}" value="${p}"><span class="input-group-text">%</span></div></td></tr>`).join('');
  return `<div class="panel mb-3"><div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2"><h2 class="h6 m-0"><i class="bi bi-percent"></i> Pembagian anggaran (persen)</h2>
    <select id="tplKos" class="form-select form-select-sm" style="max-width:240px"><option value="0" ${tplKos ? '' : 'selected'}>Kos dibayar terpisah</option><option value="1" ${tplKos ? 'selected' : ''}>Kos masuk anggaran</option></select></div>
    <p class="small text-muted">Ubah persennya sesuai kebutuhanmu; perubahan tersimpan otomatis. Patokan awal: kebutuhan pokok 60–70%, gaya hidup ±15%, tabungan minimal 10%.</p>
    <div class="table-responsive"><table class="table table-sm align-middle mb-1"><thead><tr><th>Kategori</th><th>Persen</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="small mb-2" id="tplSum">${tplSumHTML()}</div>
    <button class="btn btn-outline-success btn-sm" data-act="apply-tpl">Masukkan ke isian anggaran</button> <button class="btn btn-link btn-sm text-muted" data-act="reset-tpl">Kembalikan ke saran awal</button>
    <div class="small text-muted mt-1">Belum tersimpan sebagai anggaran sampai kamu klik “Simpan anggaran”.</div></div>`;
}
function viewBudget() {
  const mode = F.bud.mode, r = getRange(F.bud), tx = inR(r), spent = sumT(tx, 'expense');
  const b = budgetFor(mode, r), total = b.total, cb = b.categories, pct = total ? spent / total * 100 : 0;
  const cs = byCat(tx), [bc] = status(pct), cats = expCats(), catSum = cats.reduce((a, c) => a + (cb[c] || 0), 0);
  const name = mode === 'month' ? 'bulanan' : mode === 'custom' ? 'rentang khusus' : 'per 10 hari';
  const k = mode === 'month' ? '× 3' : `× ${(Math.round((daysBetween(r.start, r.end) + 1) / 10 * 100) / 100).toLocaleString('id-ID')}`;
  const customs = Object.entries(D().budget.custom || {}).sort((x, y) => y[0].localeCompare(x[0]));
  const customList = customs.length ? `<div class="panel mb-3"><h2 class="h6">Rentang khusus tersimpan</h2><div class="d-flex flex-wrap gap-2">${customs.map(([k, v]) => { const [s, e] = k.split('_'), old = e < today(); return `<div class="btn-group btn-group-sm"><button class="btn btn-outline-${old ? 'secondary' : 'success'}" data-act="open-custom" data-from="${s}" data-to="${e}">${plabel({ start: s, end: e })} · ${rp(v.total)}${old ? ' · selesai' : ' · aktif'}</button><button class="btn btn-outline-danger" data-act="del-custom" data-from="${s}" data-to="${e}" title="Hapus anggaran ini"><i class="bi bi-trash"></i></button></div>`; }).join('')}</div>${customs.some(([k]) => k.split('_')[1] < today()) ? '<button class="btn btn-sm btn-link text-danger px-0 mt-2" data-act="clean-custom">Hapus semua yang sudah selesai</button>' : ''}<div class="form-text">Anggaran rentang khusus hanya berlaku untuk tanggal yang persis sama dan tampil di Dashboard selama rentangnya mencakup hari ini.</div></div>` : '';
  const alert = !total ? '<div class="alert alert-info">Anggaran belum diatur. Isi total anggaran dan anggaran tiap kategori di bawah, lalu klik “Simpan anggaran”.</div>' : pct >= 100 ? `<div class="alert alert-danger"><i class="bi bi-exclamation-octagon"></i> Anggaran ${name} sudah terpakai ${Math.round(pct)}%. Tahan dulu pengeluaran non-esensial.</div>`
    : pct >= 80 ? `<div class="alert alert-warning"><i class="bi bi-exclamation-triangle"></i> Anggaran sudah terpakai ${Math.round(pct)}% (≥ 80%). Sisa ${rp(total - spent)}.</div>` : '';
  const tpl = budgetTemplate(total, cb);
  const first = D().transactions.filter(t => t.type === 'expense').map(t => t.date).sort()[0];
  let hist = '', n = 0, pp = prevRange(mode, r);
  for (let i = 0; first && i < 120 && n < 6 && pp.end >= first; i++, pp = prevRange(mode, pp)) {
    const s = sumT(inR(pp), 'expense'); if (!s) continue; // lewati periode tanpa pengeluaran
    const pt = budgetFor(mode, pp).total, pc = pt ? s / pt * 100 : 0; n++;
    hist += `<tr><td>${plabel(pp)}</td><td class="text-end">${rp(s)}</td><td class="text-end">${rp(pt - s)}</td><td style="min-width:120px">${bar(pc, status(pc)[0])}<div class="small text-muted">${Math.round(pc)}%</div></td><td>${badge(pc)}</td></tr>`;
  }
  $('#view-anggaran').innerHTML = `
  <div class="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3"><div><h1 class="h3 m-0">Anggaran ${name}</h1><div class="small text-muted">${esc(r.label)}${r.start <= today() && today() <= r.end ? ' · sedang berjalan' : ''}</div></div>${filterHTML('bud')}</div>
  ${alert}
  ${customList}
  <div class="row g-3 mb-3">${stat('Total anggaran', rp(total), 'bi-cash-stack')}${stat('Total pengeluaran', rp(spent), 'bi-bag')}${stat('Sisa uang', rp(total - spent), 'bi-wallet')}
    <div class="col-12 col-lg-4 col-xl"><div class="panel stat h-100"><div class="l">Anggaran terpakai</div><div class="v">${(Math.round(pct*10)/10).toLocaleString('id-ID')}%</div>${bar(pct, bc)}</div></div></div>
  ${tpl}
  <div class="panel mb-3"><h2 class="h6">Pengaturan anggaran ${name}</h2>
    ${b.saved ? '' : `<div class="alert alert-info small py-2">Belum diatur khusus. Angka di bawah dihitung otomatis dari anggaran 10 hari (${k}). Ubah lalu simpan untuk menetapkannya${mode === 'custom' ? ' pada rentang tanggal ini' : ''}.</div>`}
    <p class="small text-muted">${mode === 'month' ? 'Berlaku untuk setiap bulan.' : mode === 'custom' ? 'Hanya berlaku untuk rentang tanggal yang dipilih.' : 'Berlaku untuk setiap periode 10 hari.'} Pengeluaran dihitung berdasarkan tanggal transaksi.</p>
    <div class="row g-2 mb-3"><div class="col-sm-6 col-lg-4"><label class="form-label small">Total anggaran (Rp)</label><input id="bTotal" type="text" inputmode="numeric" autocomplete="off" class="form-control" value="${total}"></div>
    ${mode === 'p10' ? `<div class="col-sm-6 col-lg-5"><label class="form-label small">Siklus 10 hari dimulai dari tanggal</label><input id="bAnchor" type="date" class="form-control" value="${D().budget.anchor}"><div class="form-text">Periode dihitung tiap 10 hari dari tanggal ini (mis. saat uang saku masuk). Mengubahnya menggeser batas periode, termasuk riwayat.</div></div>` : ''}</div>
    <div class="table-responsive"><table class="table align-middle"><thead><tr><th>Kategori</th><th style="width:170px">Anggaran (Rp)</th><th class="text-end">Terpakai</th><th style="min-width:130px">Progres</th></tr></thead><tbody>
    ${cats.map(c => { const bb = cb[c] || 0, s = cs[c] || 0, pc = bb ? s / bb * 100 : (s ? 100 : 0);
      return `<tr><td>${esc(c)}</td><td><input type="text" inputmode="numeric" autocomplete="off" class="form-control form-control-sm" data-bcat="${esc(c)}" value="${bb}"></td><td class="text-end">${rp(s)}</td><td>${bb || s ? bar(pc, status(pc)[0]) + `<div class="small text-muted">${bb ? Math.round(pc) + '%' : 'Tanpa anggaran'} ${bb && pc >= 80 ? badge(pc) : ''}</div>` : '<span class="small text-muted">—</span>'}</td></tr>`; }).join('')}
    </tbody></table></div>
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2"><div class="small ${catSum > total ? 'text-danger' : 'text-muted'}">Jumlah anggaran kategori: ${rp(catSum)} ${catSum > total ? '(melebihi total anggaran)' : ''}</div><div class="d-flex gap-2">${mode !== 'p10' && b.saved ? '<button class="btn btn-outline-secondary" data-act="reset-budget">Kembali ke otomatis</button>' : ''}<button class="btn btn-success" data-act="save-budget">Simpan anggaran</button></div></div></div>
  <div class="panel"><h2 class="h6">Riwayat ${mode === 'month' ? 'bulan' : mode === 'custom' ? 'rentang' : 'periode'} sebelumnya</h2><div class="table-responsive"><table class="table align-middle mb-0"><thead><tr><th>Periode</th><th class="text-end">Pengeluaran</th><th class="text-end">Sisa</th><th>Terpakai</th><th>Status</th></tr></thead><tbody>${hist || '<tr><td colspan="5" class="text-center text-muted py-3">Belum ada riwayat. Akan muncul setelah ada pengeluaran pada periode sebelumnya.</td></tr>'}</tbody></table></div></div>`;
}

/* ===== View: Tabungan ===== */
function viewGoals() {
  $('#view-tabungan').innerHTML = `
  <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3"><div><h1 class="h3 m-0">Tabungan</h1><div class="small text-muted">Total tersimpan ${rp(totalSaved())} · Saldo tersedia ${rp(balance())}</div></div><button class="btn btn-success" data-act="new-goal"><i class="bi bi-plus-lg"></i> Target baru</button></div>
  <div class="alert alert-light border small">Dana yang dialokasikan ke tabungan dipindahkan dari saldo. Nilainya tidak dihitung sebagai pengeluaran maupun pemasukan baru.</div>
  <div class="row g-3">${D().goals.length ? D().goals.map(g => {
    const s = saved(g), p = s / g.target * 100, dl = Math.ceil((parse(g.deadline) - parse(today())) / 864e5);
    const hist = [...g.history].sort((a,b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 30);
    return `<div class="col-md-6"><div class="panel h-100">
      <div class="d-flex justify-content-between"><h2 class="h6 mb-1">${esc(g.name)}</h2>${p >= 100 ? '<span class="badge text-bg-success">Tercapai</span>' : ''}</div>
      <div class="small text-muted mb-2">Target ${fmtDate(g.deadline)} · ${dl > 0 ? dl + ' hari lagi' : dl === 0 ? 'hari ini' : 'lewat ' + (-dl) + ' hari'}</div>
      ${bar(p)}<div class="d-flex justify-content-between small mt-1 mb-2"><span>${rp(s)} dari ${rp(g.target)}</span><b>${Math.round(p)}%</b></div>
      <div class="d-flex flex-wrap gap-1 mb-2"><button class="btn btn-sm btn-success" data-act="fund-add" data-id="${g.id}">Tambah dana</button><button class="btn btn-sm btn-outline-success" data-act="fund-wd" data-id="${g.id}">Tarik dana</button><button class="btn btn-sm btn-outline-secondary" data-act="edit-goal" data-id="${g.id}"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-outline-danger" data-act="del-goal" data-id="${g.id}"><i class="bi bi-trash"></i></button></div>
      <details><summary>Riwayat (${g.history.length})</summary>${hist.length ? `<ul class="list-unstyled small mt-2 mb-0">${hist.map(h => `<li class="d-flex justify-content-between border-bottom py-1"><span>${fmtDate(h.date)} ${h.note ? '· ' + esc(h.note) : ''}</span><span class="${h.type==='add'?'text-success':'text-danger'} fw-semibold">${h.type==='add'?'+':'-'}${rp(h.amount)} <a href="#" class="text-muted ms-1" data-act="del-fund" data-id="${g.id}" data-eid="${h.id}"><i class="bi bi-x"></i></a></span></li>`).join('')}</ul>` : '<div class="small text-muted mt-2">Belum ada riwayat.</div>'}</details>
    </div></div>`; }).join('') : '<div class="col-12"><div class="panel empty py-5">Belum ada target tabungan. Buat target pertama, misalnya dana darurat atau laptop.</div></div>'}</div>`;
}
const modal = id => bootstrap.Modal.getOrCreateInstance(id);
function openGoal(id) {
  const g = id && D().goals.find(x => x.id === id);
  $('#goalTitle').textContent = g ? 'Edit target' : 'Target tabungan baru';
  $('#goalId').value = g ? g.id : ''; $('#goalName').value = g ? g.name : '';
  $('#goalTarget').value = g ? g.target : ''; $('#goalDate').value = g ? g.deadline : addDays(today(), 90); modal('#goalModal').show();
}
function openFund(id, type) {
  const g = D().goals.find(x => x.id === id); if (!g) return;
  $('#fundGoal').value = id; $('#fundType').value = type; $('#fundAmount').value = ''; $('#fundNote').value = ''; $('#fundDate').value = today();
  $('#fundTitle').textContent = (type === 'add' ? 'Tambah dana: ' : 'Tarik dana: ') + g.name;
  $('#fundInfo').textContent = type === 'add' ? `Saldo tersedia: ${rp(balance())}` : `Dana terkumpul: ${rp(saved(g))}`;
  modal('#fundModal').show();
}

/* ===== View: Laporan ===== */
function viewReport() {
  const r = getRange(F.rep), tx = inR(r), inc = sumT(tx,'income'), exp = sumT(tx,'expense');
  const len = Math.round((parse(r.end) - parse(r.start)) / 864e5) + 1, pr = { start: addDays(r.start, -len), end: addDays(r.start, -1) };
  const ptx = inR(pr), pinc = sumT(ptx,'income'), pexp = sumT(ptx,'expense');
  const mv = D().goals.map(g => ({ g, net: g.history.filter(h => h.date >= r.start && h.date <= r.end).reduce((a,h) => a + (h.type==='add'?h.amount:-h.amount), 0) }));
  const net = mv.reduce((a,x) => a + x.net, 0), cs = byCat(tx), ck = Object.keys(cs).sort((a,b) => cs[b]-cs[a]);
  const chg = (c, p) => p ? `${c >= p ? '+' : ''}${((c-p)/p*100).toFixed(1).replace('.',',')}%` : '—';
  const row = (l, c, p) => `<tr><td>${l}</td><td class="text-end">${rp(c)}</td><td class="text-end">${rp(p)}</td><td class="text-end">${chg(c,p)}</td></tr>`;
  $('#view-laporan').innerHTML = `
  <div class="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3"><div><h1 class="h3 m-0">Laporan</h1><div class="small text-muted">${esc(r.label)}</div></div>${filterHTML('rep')}</div>
  <div class="row g-3 mb-3">${stat('Pemasukan', rp(inc), 'bi-arrow-down-left')}${stat('Pengeluaran', rp(exp), 'bi-arrow-up-right')}${stat('Selisih', rp(inc-exp), 'bi-calculator')}${stat('Tabungan bersih', rp(net), 'bi-piggy-bank', 'Setoran dikurangi penarikan')}</div>
  <div class="row g-3 mb-3">
    <div class="col-lg-6"><div class="panel h-100"><h2 class="h6">Perbandingan antarperiode</h2><div class="small text-muted mb-2">Dibanding ${plabel(pr)}</div><table class="table table-sm mb-0"><thead><tr><th></th><th class="text-end">Ini</th><th class="text-end">Sebelumnya</th><th class="text-end">Ubah</th></tr></thead><tbody>${row('Pemasukan',inc,pinc)}${row('Pengeluaran',exp,pexp)}${row('Selisih',inc-exp,pinc-pexp)}</tbody></table></div></div>
    <div class="col-lg-6"><div class="panel h-100"><h2 class="h6">Pengeluaran per kategori</h2>${ck.length ? ck.map(c => `<div class="mb-2"><div class="d-flex justify-content-between small"><span>${esc(c)}</span><span>${rp(cs[c])} · ${Math.round(cs[c]/exp*100)}%</span></div>${bar(cs[c]/exp*100)}</div>`).join('') : '<div class="empty py-4">Tidak ada pengeluaran.</div>'}</div></div>
  </div>
  <div class="panel mb-3"><h2 class="h6">Perkembangan tabungan</h2>${D().goals.length ? `<div class="table-responsive"><table class="table align-middle mb-0"><thead><tr><th>Target</th><th class="text-end">Terkumpul</th><th class="text-end">Target</th><th style="min-width:130px">Progres</th><th class="text-end">Mutasi periode</th></tr></thead><tbody>${mv.map(({g,net}) => { const s = saved(g); return `<tr><td>${esc(g.name)}</td><td class="text-end">${rp(s)}</td><td class="text-end">${rp(g.target)}</td><td>${bar(s/g.target*100)}<div class="small text-muted">${Math.round(s/g.target*100)}%</div></td><td class="text-end ${net<0?'text-danger':''}">${net>0?'+':''}${rp(net)}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="text-muted small">Belum ada target tabungan.</div>'}</div>
  <div class="panel"><div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2"><h2 class="h6 m-0">Riwayat transaksi (${tx.length})</h2>
    <div class="d-flex gap-2"><select id="csvSep" class="form-select form-select-sm"><option value=",">Pemisah koma (,)</option><option value=";">Pemisah titik koma (;)</option></select><button class="btn btn-success btn-sm text-nowrap" data-act="export-csv"><i class="bi bi-filetype-csv"></i> Ekspor CSV</button></div></div>
    <div class="small text-muted mb-2">Tips: jika Excel menampilkan semua data dalam satu kolom, pilih pemisah titik koma.</div>
    <div class="table-responsive"><table class="table table-sm align-middle mb-0"><tbody>${tx.length ? [...tx].sort(sortTx).map(t => `<tr><td class="text-nowrap">${fmtDate(t.date)}</td><td>${esc(t.name)}<div class="small text-muted">${esc(t.category)} · ${esc(t.method)}</div></td><td class="text-end text-nowrap ${t.type==='income'?'text-success':'text-danger'}">${t.type==='income'?'+':'-'}${rp(t.amount)}</td></tr>`).join('') : '<tr><td class="text-center text-muted py-3">Tidak ada transaksi pada periode ini.</td></tr>'}</tbody></table></div></div>`;
}
function exportCSV() {
  const r = getRange(F.rep), sep = $('#csvSep').value, tx = inR(r).sort((a,b) => a.date.localeCompare(b.date));
  if (!tx.length) return toast('Tidak ada transaksi untuk diekspor.', 'warning');
  const cell = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const lines = [['Tanggal','Nama','Jenis','Kategori','Nominal','Metode','Catatan'].map(cell).join(sep)];
  tx.forEach(t => lines.push([t.date, t.name, t.type === 'income' ? 'Pemasukan' : 'Pengeluaran', t.category, t.amount, t.method, t.note].map(cell).join(sep)));
  download(`moneymate-transaksi-${r.start}_${r.end}.csv`, '\uFEFF' + lines.join('\r\n'), 'text/csv;charset=utf-8');
}

/* ===== View: Pengaturan ===== */
function viewSettings() {
  $('#defMode').value = D().prefs.defMode === 'month' ? 'month' : 'p10';
  const list = (type, title, base) => `<div class="mb-3"><div class="small fw-semibold mb-1">${title}</div><div class="d-flex flex-wrap gap-1">${base.map(c => `<span class="badge text-bg-light border">${esc(c)}</span>`).join('')}${D().customCategories[type].map(c => `<span class="badge text-bg-success">${esc(c)} <a href="#" class="text-white ms-1" data-act="del-cat" data-type="${type}" data-name="${esc(c)}"><i class="bi bi-x"></i></a></span>`).join('')}</div></div>`;
  $('#catList').innerHTML = list('expense', 'Pengeluaran', Store.EXP) + list('income', 'Pemasukan', Store.INC);
}

/* ===== Navigasi & render ===== */
const NAV = [['dashboard','Dashboard','bi-grid-1x2'],['transaksi','Transaksi','bi-arrow-left-right'],['anggaran','Anggaran','bi-pie-chart'],['tabungan','Tabungan','bi-piggy-bank'],['laporan','Laporan','bi-bar-chart'],['pengaturan','Pengaturan','bi-gear']];
const RENDER = { dashboard: viewDashboard, transaksi: viewTx, anggaran: viewBudget, tabungan: viewGoals, laporan: viewReport, pengaturan: viewSettings };
let current = 'dashboard';
function render() {
  try { RENDER[current](); } catch (e) { console.error(e); toast('Terjadi kesalahan saat menampilkan halaman.', 'danger'); }
  if (!Store.storageOk && !$('#storeWarn')) $('.main').insertAdjacentHTML('afterbegin', '<div class="alert alert-danger" id="storeWarn"><b>Data tidak bisa disimpan.</b> Browser memblokir penyimpanan lokal (mode privat, dibuka dari dalam pratinjau/aplikasi lain, atau pengaturan privasi). Buka <code>index.html</code> langsung di Chrome/Edge/Firefox biasa, atau jalankan <code>python -m http.server</code> lalu buka <code>http://localhost:8000</code>.</div>');
}
function go(name) {
  if (!RENDER[name]) name = 'dashboard';
  current = name; Store.setPref('page', name);
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  $$('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === name));
  window.scrollTo(0, 0); render();
}

/* ===== Event ===== */
document.addEventListener('change', e => {
  const w = e.target.closest('[data-f]');
  if (w && e.target.dataset.k) { F[w.dataset.f][e.target.dataset.k] = e.target.value; render(); }
});
$('#txToolbar').addEventListener('input', viewTx);
document.addEventListener('input', e => {
  const c = e.target.dataset && e.target.dataset.tplc; if (!c) return;
  const v = Number(e.target.value), ok = e.target.value !== '' && Number.isFinite(v) && v >= 0 && v <= 100;
  e.target.classList.toggle('is-invalid', !ok);
  if (ok) { const t = JSON.parse(JSON.stringify(D().prefs.tpl || {})), k = tplKey(); (t[k] = t[k] || {})[c] = v; Store.setPref('tpl', t); }
  $('#tplSum').innerHTML = tplSumHTML();
});
document.addEventListener('change', e => { if (e.target.id === 'tplKos') { tplKos = e.target.value === '1'; render(); } });
$('#txType').addEventListener('change', () => fillTxCats());

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const id = b.dataset.id, act = b.dataset.act; if (b.tagName === 'A') e.preventDefault();
  switch (act) {
    case 'new-tx': openTx(); break;
    case 'edit-tx': openTx(id); break;
    case 'del-tx': { const t = D().transactions.find(x => x.id === id); if (t && confirm(`Hapus transaksi “${t.name}” (${rp(t.amount)})?`)) { Store.deleteTx(id); toast('Transaksi dihapus.'); } break; }
    case 'reset-filter': ['fSearch','fType','fCat','fMethod','fFrom','fTo'].forEach(i => $('#' + i).value = ''); viewTx(); break;
    case 'shift-p': { const f = F[b.closest('[data-f]').dataset.f]; f.start = addDays(DATE_RE.test(f.start) ? f.start : periodOf(today()).start, 10 * Number(b.dataset.dir)); render(); break; }
    case 'del-custom': { const c = { ...(D().budget.custom || {}) }; delete c[rangeKey({ start: b.dataset.from, end: b.dataset.to })];
      if (confirm('Hapus anggaran rentang khusus ini?')) { Store.setBudget({ ...D().budget, custom: c }); toast('Anggaran rentang khusus dihapus.'); } break; }
    case 'clean-custom': { const c = { ...(D().budget.custom || {}) }; Object.keys(c).forEach(k => { if (k.split('_')[1] < today()) delete c[k]; });
      if (confirm('Hapus semua anggaran rentang khusus yang sudah lewat?')) { Store.setBudget({ ...D().budget, custom: c }); toast('Anggaran yang sudah selesai dihapus.'); } break; }
    case 'open-custom': Object.assign(F.bud, { mode: 'custom', from: b.dataset.from, to: b.dataset.to }); render(); break;
    case 'cur-p': F[b.closest('[data-f]').dataset.f].start = periodOf(today()).start; render(); break;
    case 'hide-warn': Store.setPref('hideWarn', true); break;
    case 'save-budget': {
      let total = parseRp($('#bTotal').value); const cats = {};
      if (!Number.isFinite(total) || total < 0) return toast('Total anggaran harus berupa angka valid.', 'danger');
      for (const i of $$('[data-bcat]')) { const v = i.value.trim() === '' ? 0 : parseRp(i.value); if (!Number.isFinite(v) || v < 0) return toast(`Anggaran “${i.dataset.bcat}” tidak valid.`, 'danger'); if (v > 0) cats[i.dataset.bcat] = v; }
      if (!total) total = Object.values(cats).reduce((x, y) => x + y, 0); // total kosong → jumlah anggaran kategori
      const mode = F.bud.mode, B = D().budget;
      if (mode === 'month') Store.setBudget({ ...B, month: { total, categories: cats } });
      else if (mode === 'custom') Store.setBudget({ ...B, custom: { ...(B.custom || {}), [rangeKey(getRange(F.bud))]: { total, categories: cats } } });
      else {
        const anchor = $('#bAnchor').value; if (!DATE_RE.test(anchor)) return toast('Tanggal mulai siklus wajib diisi.', 'danger');
        Store.setBudget({ ...B, total, anchor, categories: cats }); ['dash','rep','bud'].forEach(k => F[k].start = periodOf(today()).start);
      }
      Store.storageOk ? toast(`Anggaran ${mode === 'month' ? 'bulanan' : mode === 'custom' ? 'rentang khusus' : 'per 10 hari'} disimpan.`) : toast('Gagal menyimpan: penyimpanan browser diblokir.', 'danger'); break;
    }
    case 'apply-tpl': {
      const total = parseRp($('#bTotal').value);
      if (!Number.isFinite(total) || total <= 0) return toast('Isi total anggaran dulu.', 'danger');
      if (tplSum() > 100) return toast(`Jumlah persen ${Math.round(tplSum() * 10) / 10}% melebihi 100%. Kurangi dulu.`, 'danger');
      const map = Object.fromEntries(tplList());
      $$('[data-bcat]').forEach(i => { const c = i.dataset.bcat; if (c in map) i.value = tplAmount(total, map[c]); else if (Store.EXP.includes(c)) i.value = 0; });
      toast('Saran dimasukkan ke isian. Periksa lalu klik “Simpan anggaran”.'); break;
    }
    case 'reset-tpl': Store.setPref('tpl', { ...(D().prefs.tpl || {}), [tplKey()]: {} }); render(); toast('Persen dikembalikan ke saran awal.'); break;
    case 'reset-budget': {
      const B = D().budget;
      if (F.bud.mode === 'month') Store.setBudget({ ...B, month: null });
      else { const c = { ...(B.custom || {}) }; delete c[rangeKey(getRange(F.bud))]; Store.setBudget({ ...B, custom: c }); }
      toast('Kembali ke perhitungan otomatis.'); break;
    }
    case 'new-goal': openGoal(); break;
    case 'edit-goal': openGoal(id); break;
    case 'del-goal': { const g = D().goals.find(x => x.id === id); if (g && confirm(`Hapus target “${g.name}”? Dana ${rp(saved(g))} akan kembali ke saldo.`)) { Store.deleteGoal(id); toast('Target dihapus.'); } break; }
    case 'fund-add': openFund(id, 'add'); break;
    case 'fund-wd': openFund(id, 'withdraw'); break;
    case 'del-fund': if (confirm('Hapus catatan riwayat ini? Total terkumpul akan menyesuaikan.')) Store.deleteFund(id, b.dataset.eid); break;
    case 'export-csv': exportCSV(); break;
    case 'export-json': download(`moneymate-cadangan-${today()}.json`, Store.exportJSON(), 'application/json'); toast('Cadangan diunduh.'); break;
    case 'del-cat': {
      const { type, name } = b.dataset;
      if (D().transactions.some(t => t.type === type && t.category === name)) return toast('Kategori masih dipakai transaksi, tidak bisa dihapus.', 'warning');
      if (confirm(`Hapus kategori “${name}”?`)) Store.removeCategory(type, name); break;
    }
    case 'reset-all':
      if (confirm('Hapus SELURUH data MoneyMate dari browser ini? Tindakan ini tidak dapat dibatalkan.') && confirm('Yakin? Semua transaksi, anggaran, dan tabungan akan hilang.')) { Store.reset(); toast('Semua data dihapus.'); }
      break;
  }
});

$('#txForm').addEventListener('submit', e => {
  e.preventDefault();
  const amount = parseRp($('#txAmount').value), name = $('#txName').value.trim(), date = $('#txDate').value;
  if (!name) return toast('Nama transaksi wajib diisi.', 'danger');
  if (!Number.isFinite(amount) || amount <= 0) return toast('Nominal harus angka lebih dari nol.', 'danger');
  if (!date) return toast('Tanggal wajib diisi.', 'danger');
  const t = { name, type: $('#txType').value, amount: Math.round(amount), category: $('#txCat').value, date, method: $('#txMethod').value, note: $('#txNote').value.trim() };
  const id = $('#txId').value;
  id ? Store.updateTx(id, t) : Store.addTx(t);
  txModal().hide(); toast(id ? 'Transaksi diperbarui.' : 'Transaksi ditambahkan.');
});
$('#goalForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#goalName').value.trim(), target = parseRp($('#goalTarget').value), deadline = $('#goalDate').value;
  if (!name) return toast('Nama target wajib diisi.', 'danger');
  if (!Number.isFinite(target) || target <= 0) return toast('Nominal target harus lebih dari nol.', 'danger');
  if (!deadline) return toast('Tanggal target wajib diisi.', 'danger');
  Store.saveGoal($('#goalId').value, { name, target: Math.round(target), deadline });
  modal('#goalModal').hide(); toast('Target disimpan.');
});
$('#fundForm').addEventListener('submit', e => {
  e.preventDefault();
  const g = D().goals.find(x => x.id === $('#fundGoal').value), type = $('#fundType').value, amount = parseRp($('#fundAmount').value), date = $('#fundDate').value;
  if (!g) return;
  if (!Number.isFinite(amount) || amount <= 0) return toast('Nominal harus angka lebih dari nol.', 'danger');
  if (!date) return toast('Tanggal wajib diisi.', 'danger');
  if (type === 'add' && amount > balance()) return toast(`Saldo tidak cukup. Saldo tersedia ${rp(balance())}.`, 'danger');
  if (type === 'withdraw' && amount > saved(g)) return toast(`Dana terkumpul hanya ${rp(saved(g))}.`, 'danger');
  Store.addFund(g.id, { type, amount: Math.round(amount), date, note: $('#fundNote').value.trim() });
  modal('#fundModal').hide(); toast(type === 'add' ? 'Dana ditambahkan ke tabungan.' : 'Dana ditarik ke saldo.');
});
$('#catForm').addEventListener('submit', e => {
  e.preventDefault();
  const type = $('#catType').value, name = $('#catName').value.trim();
  if (!name) return;
  if ([...(type === 'expense' ? expCats() : incCats())].some(c => c.toLowerCase() === name.toLowerCase())) return toast('Kategori sudah ada.', 'warning');
  Store.addCategory(type, name); $('#catName').value = ''; toast('Kategori ditambahkan.');
});
$('#importFile').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  const rd = new FileReader();
  rd.onload = () => {
    if (!confirm('Impor akan MENGGANTI seluruh data saat ini dengan isi file. Lanjutkan?')) { e.target.value = ''; return; }
    const res = Store.importJSON(String(rd.result));
    res.ok ? toast('Data berhasil dipulihkan.') : toast('Impor gagal: ' + res.error, 'danger');
    e.target.value = '';
  };
  rd.onerror = () => toast('File tidak dapat dibaca.', 'danger');
  rd.readAsText(file);
});

/* ===== Mulai ===== */
Store.init();
/* Atur ulang filter ke periode saat ini. Bila ada anggaran rentang khusus yang mencakup hari ini, Dashboard dan Anggaran ikut rentang itu. */
function resetFilters(keepRep) {
  const m = D().prefs.defMode === 'month' ? 'month' : 'p10', cn = customNow();
  F.dash = mkF(); F.dash.mode = m;
  F.bud = mkF(); F.bud.mode = budgetMode();
  if (cn) [F.dash, F.bud].forEach(f => Object.assign(f, { mode: 'custom', from: cn.start, to: cn.end }));
  if (!keepRep || !F.rep) { F.rep = mkF(); F.rep.mode = m; }
}
F = {}; resetFilters();
Store.onChange(render);
/* Bila tab dibiarkan terbuka sampai hari berganti, pindahkan semua filter ke periode terbaru. */
let seenDay = today();
function checkNewDay() { if (today() === seenDay) return; seenDay = today(); resetFilters(true); render(); }
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkNewDay(); });
window.addEventListener('focus', checkNewDay);
setInterval(checkNewDay, 60000);
Store.onExternal(() => { toast('Data diperbarui dari tab lain.', 'info'); render(); });
document.addEventListener('change', e => {
  if (e.target.id !== 'defMode') return;
  const v = e.target.value === 'month' ? 'month' : 'p10';
  Store.setPref('defMode', v); ['dash', 'rep', 'bud'].forEach(k => F[k].mode = v); toast('Periode bawaan disimpan.');
});
$('#sideNav').innerHTML = NAV.map(([k,l,i]) => `<a href="#${k}" data-nav="${k}" class="nav-mm"><i class="bi ${i}"></i>${l}</a>`).join('');
$('#bottomNav').innerHTML = NAV.map(([k,l,i]) => `<a href="#${k}" data-nav="${k}"><i class="bi ${i}"></i>${l}</a>`).join('');
window.addEventListener('hashchange', () => go(location.hash.slice(1)));
go(location.hash.slice(1) || D().prefs.page);
if (Store.loadError) toast('Data tersimpan rusak dan tidak dapat dibaca. Aplikasi dimulai dari kosong (salinan data rusak disimpan terpisah).', 'warning');