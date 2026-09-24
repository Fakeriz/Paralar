import { convert } from './rates'
import { roundMoney } from './currencies'

// Synchronously compute the updated accounts array with new balances
export function computeBalanceDelta(accounts = [], tx, sign = 1, rates) {
  if (!Array.isArray(accounts) || !tx) return accounts
  const amt = Number(tx?.amount) || 0
  const fee = Number(tx?.fee) || 0

  return accounts.map((acc) => {
    let delta = 0
    if (tx.type === 'expense' && acc.id === tx.account_id) {
      delta = -sign * convert(amt, tx.currency, acc.currency, rates)
    } else if (tx.type === 'income' && acc.id === tx.account_id) {
      delta = sign * convert(amt, tx.currency, acc.currency, rates)
    } else if (tx.type === 'transfer') {
      if (acc.id === tx.account_id) {
        delta = -sign * convert(amt + fee, tx.currency, acc.currency, rates)
      } else if (acc.id === tx.to_account_id) {
        delta = sign * convert(amt, tx.currency, acc.currency, rates)
      }
    }
    if (delta !== 0) {
      const next = roundMoney((Number(acc.balance) || 0) + delta, acc.currency)
      return { ...acc, balance: next }
    }
    return acc
  })
}

// Apply (sign=+1) or revert (sign=-1) a transaction's effect on account balances.
export async function applyTxToBalances(store, accounts = [], tx, sign = 1, rates) {
  if (!store || !tx) return
  const find = (id) => accounts.find((a) => a?.id === id)
  const upd = async (acc, delta) => {
    if (!acc || !delta) return
    const next = roundMoney((Number(acc.balance) || 0) + delta, acc.currency)
    await store.updateAccount(acc.id, { balance: next })
    acc.balance = next
  }
  const amt = Number(tx.amount) || 0
  const fee = Number(tx.fee) || 0
  const updates = []

  if (tx.type === 'expense') {
    const acc = find(tx.account_id)
    if (acc) updates.push(upd(acc, -sign * convert(amt, tx.currency, acc.currency, rates)))
  } else if (tx.type === 'income') {
    const acc = find(tx.account_id)
    if (acc) updates.push(upd(acc, sign * convert(amt, tx.currency, acc.currency, rates)))
  } else if (tx.type === 'transfer') {
    const from = find(tx.account_id)
    const to = find(tx.to_account_id)
    if (from) updates.push(upd(from, -sign * convert(amt + fee, tx.currency, from.currency, rates)))
    if (to) updates.push(upd(to, sign * convert(amt, tx.currency, to.currency, rates)))
  }

  if (updates.length > 0) {
    await Promise.all(updates)
  }
}

// Safe arithmetic evaluator for the calculator keypad: supports + - * / and decimals
export function evaluateExpression(expr) {
  const s = String(expr || '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/,/g, '.').replace(/\s/g, '')
  if (!s) return 0
  const tokens = s.match(/(\d+\.?\d*|\.\d+|[+\-*/])/g) || []
  const out = []
  const ops = []
  const prec = { '+': 1, '-': 1, '*': 2, '/': 2 }
  let prevWasOp = true
  for (const tk of tokens) {
    if (/[+\-*/]/.test(tk)) {
      if (prevWasOp) { if (tk === '-') { out.push(0) } else continue }
      while (ops.length && prec[ops[ops.length - 1]] >= prec[tk]) out.push(ops.pop())
      ops.push(tk)
      prevWasOp = true
    } else {
      out.push(parseFloat(tk))
      prevWasOp = false
    }
  }
  while (ops.length) out.push(ops.pop())
  const st = []
  for (const tk of out) {
    if (typeof tk === 'number') st.push(tk)
    else {
      const b = st.pop() ?? 0
      const a = st.pop() ?? 0
      st.push(tk === '+' ? a + b : tk === '-' ? a - b : tk === '*' ? a * b : b === 0 ? 0 : a / b)
    }
  }
  const r = st.pop() ?? 0
  return Number.isFinite(r) ? r : 0
}

export function toLocalDatetimeValue(d) {
  const pad = (n) => String(n).padStart(2, '0')
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const now = new Date()
    return `${d}T${pad(now.getHours())}:${pad(now.getMinutes())}`
  }
  const x = d ? new Date(d) : new Date()
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`
}

// Downscale an image file to a data URL (keeps receipt previews small)
export function fileToDataUrl(file, maxSize = 1000) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null)
    if (!file.type?.startsWith('image/')) {
      const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = reject
    img.src = url
  })
}
