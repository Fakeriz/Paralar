// lib/statement-import.js
// Logika murni (tanpa React/Supabase) untuk impor rekening koran bank.
// Sengaja 100% client-side: statement bank adalah data sensitif, jadi parsing
// dan normalisasi jalan di device — yang dikirim ke server hanya baris final
// saat user menekan "Impor".

// ---------------------------------------------------------------------------
// 1. File parsing (CSV/XLS/XLSX via xlsx)
// ---------------------------------------------------------------------------

export async function parseStatementFile(file) {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const ws = wb.Sheets?.[wb.SheetNames?.[0]]
  if (!ws) throw new Error('empty')
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' })
  // Cari baris header: baris pertama dengan >= 2 sel non-kosong (lewati judul laporan bank)
  let hi = -1
  for (let i = 0; i < Math.min(aoa.length, 20); i++) {
    const row = aoa[i] || []
    const nonEmpty = row.filter((c) => String(c ?? '').trim() !== '').length
    if (nonEmpty >= 2) { hi = i; break }
  }
  if (hi < 0) throw new Error('empty')
  const headers = (aoa[hi] || []).map((h) => String(h ?? '').trim())
  const body = (aoa.slice(hi + 1) || []).filter((r) =>
    (r || []).some((c) => String(c ?? '').trim() !== '')
  )
  if (!body.length) throw new Error('empty')
  return { fileName: file?.name || 'statement', headers, rows: body }
}

// ---------------------------------------------------------------------------
// 2. Deteksi mapping kolom (multilingual: EN / MS / ID / TR)
// ---------------------------------------------------------------------------

const ROLE_KEYWORDS = {
  date: ['date', 'tanggal', 'tarikh', 'tarih', 'datum'],
  desc: ['desc', 'narrat', 'keterangan', 'catatan', 'perihal', 'detail', 'rincian', 'uraian', 'aciklama', 'açıklama', 'memo'],
  amount: ['amount', 'jumlah', 'nominal', 'value', 'tutar', 'miktar', 'nilai'],
  debit: ['debit', 'pengeluaran', 'keluar', 'withdrawal'],
  credit: ['credit', 'kredit', 'pemasukan', 'masuk', 'deposit'],
  balance: ['balance', 'baki', 'saldo', 'bakiye'],
  type: ['type', 'tipe', 'jenis', 'tür', 'tur'],
  currency: ['currency', 'curr', 'mata uang', 'mata wang', 'para birimi'],
}

const normH = (s) => String(s ?? '').trim().toLowerCase()

function findCol(headers, keys, used) {
  for (let i = 0; i < headers.length; i++) {
    if (used.has(i)) continue
    const h = normH(headers[i])
    if (!h) continue
    if (keys.some((k) => h.includes(k))) { used.add(i); return i }
  }
  return -1
}

export function detectMapping(headers) {
  const used = new Set()
  const mapping = {
    date: findCol(headers, ROLE_KEYWORDS.date, used),
    desc: findCol(headers, ROLE_KEYWORDS.desc, used),
    amount: findCol(headers, ROLE_KEYWORDS.amount, used),
    debit: findCol(headers, ROLE_KEYWORDS.debit, used),
    credit: findCol(headers, ROLE_KEYWORDS.credit, used),
    balance: findCol(headers, ROLE_KEYWORDS.balance, used),
    type: findCol(headers, ROLE_KEYWORDS.type, used),
    currency: findCol(headers, ROLE_KEYWORDS.currency, used),
  }
  // Prioritas: pasangan debit/kredit > kolom tipe > satu kolom bertanda
  let dirMode = 'signed'
  if (mapping.debit >= 0 && mapping.credit >= 0) dirMode = 'split'
  else if (mapping.type >= 0) dirMode = 'type_col'
  return { mapping, dirMode }
}

// ---------------------------------------------------------------------------
// 3. Normalisasi nilai
// ---------------------------------------------------------------------------

export function parseAmount(v) {
  if (typeof v === 'number' && isFinite(v)) return v
  let s = String(v ?? '').trim()
  if (!s) return null
  let neg = false
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1).trim() } // (1,234.56) = negatif
  s = s.replace(/[^\d.,-]/g, '')
  if (!s || s === '-' || s === '.' || s === ',') return null
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    // pemisah terakhir = desimal → "1.234,56" (ID) atau "1,234.56" (EN)
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (hasComma) {
    const pcs = s.split(',')
    if (pcs.length > 2) s = pcs.join('')                 // 1,234,567
    else if (/^-?\d{1,3},\d{3}$/.test(s)) s = pcs.join('') // 1,234 → ribuan
    else s = s.replace(',', '.')                          // 12,5 → desimal
  } else if (hasDot) {
    // "10.000" (ID: sepuluh ribu) vs "10.50" (desimal) — heuristik: grup tepat
    // 3 digit setelah titik + ≤3 digit sebelumnya → pemisah ribuan ala ID/MY.
    const pcs = s.split('.')
    if (pcs.length > 2 && /^-?\d{1,3}$/.test(pcs[0]) && pcs.slice(1).every((p) => /^\d{3}$/.test(p))) s = pcs.join('')
    else if (/^-?\d{1,3}\.\d{3}$/.test(s)) s = s.replace('.', '')
  }
  const n = parseFloat(s)
  if (!isFinite(n)) return null
  return neg ? -Math.abs(n) : n
}

export function normalizeDate(v) {
  if (v == null || v === '') return null
  if (v instanceof Date && !isNaN(v.getTime())) return v
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    // Serial date Excel
    const d = new Date(Math.round((v - 25569) * 86400 * 1000))
    return isNaN(d.getTime()) ? null : d
  }
  const s = String(v).trim()
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    return isNaN(d.getTime()) ? null : d
  }
  // Day-first default (ID/MY): DD/MM/YYYY. Jika salah satu > 12, itu pasti harinya.
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/)
  if (m) {
    const a = Number(m[1]), b = Number(m[2])
    const y = Number(m[3].length === 2 ? '20' + m[3] : m[3])
    let day = a, mon = b
    if (a > 12 && b <= 12) { day = a; mon = b }
    else if (b > 12 && a <= 12) { day = b; mon = a }
    const d = new Date(y, mon - 1, day)
    return isNaN(d.getTime()) ? null : d
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

const normT = (s) => String(s ?? '').trim().toLowerCase()

export function normalizeType(v, amount) {
  const s = normT(v)
  if (/(income|credit|kredit|masuk|pemasukan|pendapatan|gelir)/.test(s)) return 'income'
  if (/(expense|debit|keluar|pengeluaran|perbelanjaan|gider|belanja)/.test(s)) return 'expense'
  if (/(transfer|pindah|kirim|havale)/.test(s)) return 'transfer'
  return amount != null && amount < 0 ? 'expense' : 'income'
}

export function normalizeDesc(s) {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export const fmtDateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// ---------------------------------------------------------------------------
// 4. Normalisasi baris → transaksi kanonis
// ---------------------------------------------------------------------------

export function normalizeRows(aoa, mapping, dirMode, defaultCurrency = 'MYR') {
  const out = []
  const cell = (row, i) => (i >= 0 && row ? row[i] : '')
  for (const row of aoa) {
    let amount = null
    let type = 'expense'
    if (dirMode === 'split') {
      const d = parseAmount(cell(row, mapping.debit)) || 0
      const c = parseAmount(cell(row, mapping.credit)) || 0
      if (!d && !c) continue
      if (d && !c) { amount = Math.abs(d); type = 'expense' }
      else if (c && !d) { amount = Math.abs(c); type = 'income' }
      else { amount = Math.abs(c - d); type = c >= d ? 'income' : 'expense' }
    } else {
      amount = parseAmount(cell(row, mapping.amount))
      if (amount == null) continue
      type = dirMode === 'type_col' ? normalizeType(cell(row, mapping.type), amount) : (amount < 0 ? 'expense' : 'income')
      amount = Math.abs(amount)
    }
    const date = normalizeDate(cell(row, mapping.date))
    const desc = String(cell(row, mapping.desc) ?? '').trim()
    if (!date && !desc) continue
    const balRaw = mapping.balance >= 0 ? parseAmount(cell(row, mapping.balance)) : null
    const curRaw = String(cell(row, mapping.currency) || '').trim().toUpperCase()
    out.push({
      date: date || new Date(),
      dateStr: fmtDateStr(date || new Date()),
      desc: desc || '(no description)',
      amount,
      type,
      currency: /^[A-Z]{3}$/.test(curRaw) ? curRaw : defaultCurrency,
      balanceAfter: balRaw,
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// 5. Fingerprint & dedup
// ---------------------------------------------------------------------------

// cyrb53 — hash non-kriptografis, cukup untuk fingerprint dedup client-side
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

export function rowFingerprint(r) {
  const s = [r.dateStr, Number(r.amount).toFixed(2), (r.currency || '').toUpperCase(), normalizeDesc(r.desc)].join('|')
  return cyrb53(s).toString(16)
}

export function rowKey(r) {
  return [r.dateStr, Number(r.amount).toFixed(2), (r.currency || '').toUpperCase(), normalizeDesc(r.desc)].join('|')
}

// Tandai duplikat di dalam file yang sama
export function markInFileDuplicates(rows) {
  const counts = {}
  for (const r of rows) { const k = rowFingerprint(r); counts[k] = (counts[k] || 0) + 1 }
  for (const r of rows) r.dupInFile = counts[rowFingerprint(r)] > 1
  return rows
}

// ---------------------------------------------------------------------------
// 6. Validasi: balance continuity & rentang tanggal
// ---------------------------------------------------------------------------

export function checkBalanceContinuity(rows) {
  // Validasi mapping kolom: saldo[i] harus = saldo[i-1] ± nominal[i].
  // Baris duplikat (fingerprint sama) hanya dihitung sekali agar tidak
  // memicu false positive — duplikat sudah ditangani penanda dedup.
  const seen = new Set()
  const withBal = rows.filter((r) => {
    if (r.balanceAfter == null) return false
    const k = rowFingerprint(r)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  if (withBal.length < 2) return { checked: false }
  const sorted = [...withBal].sort((a, b) => a.date - b.date)
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1], cur = sorted[i]
    const expected = prev.balanceAfter + (cur.type === 'income' ? cur.amount : -cur.amount)
    if (Math.abs(expected - cur.balanceAfter) > 0.01) {
      return { checked: true, ok: false, at: cur.dateStr }
    }
  }
  return { checked: true, ok: true }
}

export function getDateRange(rows) {
  if (!rows.length) return null
  let min = rows[0].date, max = rows[0].date
  for (const r of rows) {
    if (r.date < min) min = r.date
    if (r.date > max) max = r.date
  }
  return { min, max, minStr: fmtDateStr(min), maxStr: fmtDateStr(max) }
}

export function rangesOverlap(a, b) {
  return a.min <= b.max && b.min <= a.max
}

// ---------------------------------------------------------------------------
// 7. Pembelajaran kategori lokal (tanpa AI, tanpa server)
// ---------------------------------------------------------------------------

const CATMAP_KEY = 'paralar_import_catmap'
const catKeyOf = (desc) => normalizeDesc(desc).split(' ').slice(0, 3).join(' ')

export function suggestCategory(desc) {
  try {
    const map = JSON.parse(localStorage.getItem(CATMAP_KEY) || '{}')
    return map[catKeyOf(desc)] || null
  } catch { return null }
}

export function learnCategory(desc, category) {
  try {
    const map = JSON.parse(localStorage.getItem(CATMAP_KEY) || '{}')
    map[catKeyOf(desc)] = category
    const keys = Object.keys(map)
    if (keys.length > 500) delete map[keys[0]]
    localStorage.setItem(CATMAP_KEY, JSON.stringify(map))
  } catch { /* abaikan */ }
}

// ---------------------------------------------------------------------------
// 8. Preset mapping per user (opsional, tersimpan lokal)
// ---------------------------------------------------------------------------

const PRESET_KEY = 'paralar_import_presets'

export function listMappingPresets() {
  try { return JSON.parse(localStorage.getItem(PRESET_KEY) || '[]') } catch { return [] }
}

export function saveMappingPreset(name, mapping, dirMode) {
  try {
    const list = listMappingPresets().filter((p) => p.name !== name)
    list.unshift({ name, mapping, dirMode, at: new Date().toISOString() })
    localStorage.setItem(PRESET_KEY, JSON.stringify(list.slice(0, 10)))
  } catch { /* abaikan */ }
}
