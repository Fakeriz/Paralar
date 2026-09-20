import { NextResponse } from 'next/server'
import { FALLBACK_RATES } from '@/lib/rates'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GROQ_BASE = 'https://api.groq.com/openai/v1'
const WHISPER_MODEL = 'whisper-large-v3'
const LLAMA_MODEL = 'llama-3.3-70b-versatile'

const json = (data, status = 200) => NextResponse.json(data, { status })
const err = (message, status = 400) => NextResponse.json({ error: message }, { status })

// ---------------- Exchange rates (live provider + static fallback) ----------------
let ratesCache = { at: 0, data: null }
async function getRates() {
  const ONE_HOUR = 60 * 60 * 1000
  if (ratesCache.data && Date.now() - ratesCache.at < ONE_HOUR) return ratesCache.data
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(timer)
    if (res.ok) {
      const body = await res.json()
      if (body?.result === 'success' && body?.rates?.USD) {
        const data = { base: 'USD', rates: { ...FALLBACK_RATES, ...body.rates }, source: 'live', updated: new Date().toISOString() }
        ratesCache = { at: Date.now(), data }
        return data
      }
    }
  } catch (e) {
    console.warn('rates provider failed, using fallback:', e?.message)
  }
  const data = { base: 'USD', rates: FALLBACK_RATES, source: 'fallback', updated: new Date().toISOString() }
  ratesCache = { at: Date.now(), data }
  return data
}

// ---------------- Groq helpers ----------------
// Primary model per spec; Groq may retire models, so fall back to currently available ones.
const CHAT_MODEL_CHAIN = [process.env.GROQ_CHAT_MODEL || LLAMA_MODEL, 'openai/gpt-oss-120b', 'openai/gpt-oss-20b']
let activeChatModel = null

async function groqChat(messages, { jsonMode = true, temperature = 0.2, max_tokens = 800 } = {}) {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('Server is missing GROQ_API_KEY')
  const chain = activeChatModel ? [activeChatModel, ...CHAT_MODEL_CHAIN.filter((m) => m !== activeChatModel)] : CHAT_MODEL_CHAIN
  let lastError = null
  for (const model of chain) {
    const res = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        messages,
      }),
      cache: 'no-store',
    })
    const payload = await res.json().catch(() => ({}))
    if (res.ok) {
      activeChatModel = model
      return { content: payload?.choices?.[0]?.message?.content || '', model }
    }
    lastError = new Error(payload?.error?.message || `Groq chat failed (${res.status})`)
    const msg = (payload?.error?.message || '').toLowerCase()
    const modelIssue = res.status === 404 || msg.includes('does not exist') || msg.includes('decommissioned') || msg.includes('not have access')
    if (!modelIssue) throw lastError
  }
  throw lastError || new Error('Groq chat failed')
}

async function handleTranscribe(request) {
  const key = process.env.GROQ_API_KEY
  if (!key) return err('Server is missing GROQ_API_KEY', 500)
  const form = await request.formData()
  const input = form.get('file')
  const language = form.get('language')
  if (!input || typeof input === 'string' || typeof input.arrayBuffer !== 'function') return err('file is required')
  if (input.size <= 0 || input.size > 25 * 1024 * 1024) return err('Audio must be between 1 byte and 25 MB', 413)

  const outbound = new FormData()
  const bytes = await input.arrayBuffer()
  const type = input.type || 'audio/webm'
  const ext = type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : type.includes('wav') ? 'wav' : type.includes('mpeg') ? 'mp3' : 'webm'
  outbound.append('file', new Blob([bytes], { type }), input.name || `recording.${ext}`)
  outbound.append('model', WHISPER_MODEL)
  outbound.append('response_format', 'json')
  outbound.append('temperature', '0')
  if (typeof language === 'string' && /^[a-z]{2}$/i.test(language)) outbound.append('language', language.toLowerCase())

  const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: outbound,
    cache: 'no-store',
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) return err(payload?.error?.message || 'Groq transcription failed', res.status)
  return json({ text: (payload?.text || '').trim(), model: WHISPER_MODEL })
}

async function handleParse(request) {
  const body = await request.json().catch(() => ({}))
  const text = (body?.text || '').toString().trim()
  if (!text) return err('text is required')
  const homeCurrency = body?.homeCurrency || 'USD'
  const categories = Array.isArray(body?.categories) && body.categories.length ? body.categories : ['food', 'groceries', 'transport', 'shopping', 'bills', 'entertainment', 'health', 'education', 'travel', 'housing', 'personal', 'business', 'salary', 'freelance', 'investment', 'gift', 'other']
  const accounts = Array.isArray(body?.accounts) ? body.accounts : []
  const language = body?.language || 'en'

  const system = `You are Paralar, a multilingual (Indonesian, Malay, English, Turkish) finance transaction parser.
Extract ONE transaction from the user's spoken/typed text and return ONLY a JSON object with keys:
{
  "type": "expense" | "income" | "transfer",
  "amount": number,                       // numeric value only. "lima ringgit" = 5, "lima belas ribu" = 15000, "altmis lira" = 60, "2.5k" = 2500
  "currency": ISO 4217 code,              // infer from words: ringgit/RM -> MYR, rupiah/rupiah/ribu/juta/perak -> IDR, lira/TL -> TRY, dollar/$ -> USD, euro -> EUR, pound -> GBP, yen -> JPY, baht -> THB, peso -> PHP, dong -> VND, riyal -> SAR, dirham -> AED, sing dollar -> SGD. If unclear use "${homeCurrency}".
  "category": one of [${categories.map((c) => `"${c}"`).join(', ')}],
  "payment_method": "cash" | "qr" | "card" | "bank",   // e-wallets (TnG, GoPay, OVO, DANA, GrabPay, Papara, ShopeePay) -> "qr"; kad/kartu/card -> "card"; transfer/bank -> "bank"; default "cash"
  "account_name": string | null,         // best match from user's accounts: [${accounts.map((a) => `"${a}"`).join(', ')}] or the wallet/bank mentioned (e.g. "TnG")
  "merchant": string | null,
  "note": short human-readable description in the user's language (${language}),
  "confidence": number 0-1
}
Never include commentary. Amounts are always positive.`

  const { content: raw, model: usedModel } = await groqChat([
    { role: 'system', content: system },
    { role: 'user', content: text },
  ], { jsonMode: true, temperature: 0 })

  let parsed
  try { parsed = JSON.parse(raw) } catch { return err('Model returned invalid JSON', 502) }
  const out = {
    type: ['expense', 'income', 'transfer'].includes(parsed?.type) ? parsed.type : 'expense',
    amount: Math.abs(Number(parsed?.amount) || 0),
    currency: (parsed?.currency || homeCurrency).toString().toUpperCase().slice(0, 3),
    category: categories.includes(parsed?.category) ? parsed.category : 'other',
    payment_method: ['cash', 'qr', 'card', 'bank'].includes(parsed?.payment_method) ? parsed.payment_method : 'cash',
    account_name: parsed?.account_name || null,
    merchant: parsed?.merchant || null,
    note: parsed?.note || text,
    confidence: Number(parsed?.confidence) || 0.5,
    transcript: text,
    model: usedModel,
  }
  return json(out)
}

async function handleCoach(request) {
  const body = await request.json().catch(() => ({}))
  const messages = Array.isArray(body?.messages) ? body.messages.filter((m) => m?.role && m?.content).slice(-12) : []
  if (!messages.length) return err('messages are required')
  const ctx = body?.context || {}
  const language = body?.language || 'en'
  const langName = { id: 'Bahasa Indonesia', ms: 'Bahasa Melayu', en: 'English', tr: 'Turkish' }[language] || 'English'
  const system = `You are Paralar AI Financial Coach: a warm, concise, practical personal & small-business finance coach for Southeast Asia and Turkey.
Always answer in ${langName}. Keep answers short (max ~120 words), use bullet points when listing, and give concrete numbers based on the user's data when possible.
User financial context (home currency ${ctx?.homeCurrency || 'USD'}):
${JSON.stringify(ctx).slice(0, 4000)}`
  const { content: reply, model: usedModel } = await groqChat([{ role: 'system', content: system }, ...messages], { jsonMode: false, temperature: 0.5, max_tokens: 500 })
  return json({ reply, model: usedModel })
}

// ---------------- Gemini OCR via Emergent Universal Key ----------------
const RECEIPT_PROMPT = `You are an expert receipt OCR engine. Read this receipt image and return ONLY a JSON object (no markdown) with this exact schema:
{
  "merchant": string|null,            // store / business name e.g. "Era Superstore Sdn Bhd"
  "category": one of ["food","groceries","transport","shopping","bills","entertainment","health","education","travel","housing","personal","business","other"],
  "receipt_number": string|null,      // receipt / invoice / bill no e.g. "CS00102148"
  "date": string|null,                // ISO 8601 date if visible
  "currency": string|null,            // ISO code inferred from symbols: RM->MYR, Rp->IDR, TL/₺->TRY, $->USD, S$->SGD
  "subtotal": number|null,
  "tax": number|null,
  "total": number|null,               // grand total paid
  "payment_method": "cash"|"qr"|"card"|"bank"|null,
  "items": [ { "name": string, "qty": number, "price": number } ],  // every product line; price = line total
  "confidence": number
}
Use null for unreadable values and [] for no items. Amounts must be plain numbers.`

async function handleOcr(request) {
  const key = process.env.EMERGENT_LLM_KEY
  if (!key) return err('Server is missing EMERGENT_LLM_KEY', 500)
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

  let base64 = null
  const ct = request.headers.get('content-type') || ''
  if (ct.includes('multipart/form-data')) {
    const form = await request.formData()
    const file = form.get('image') || form.get('file')
    if (!file || typeof file.arrayBuffer !== 'function') return err('image file is required')
    if (file.size > 10 * 1024 * 1024) return err('Image must be 10 MB or smaller', 413)
    base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
  } else {
    const body = await request.json().catch(() => ({}))
    base64 = (body?.imageBase64 || body?.image || '').toString()
  }
  if (!base64) return err('image is required')
  base64 = base64.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '')

  const { LlmChat, UserMessage, ImageContent } = await import('emergentintegrations')
  const chat = new LlmChat(key, `receipt-${crypto.randomUUID()}`, 'You extract receipts accurately. Return only valid JSON.')
    .withModel('gemini', model)
    .withParams({ temperature: 0, max_tokens: 2000 })

  const reply = await chat.sendMessage(new UserMessage({ text: RECEIPT_PROMPT, file_contents: [new ImageContent(base64)] }))
  const text = typeof reply === 'string' ? reply : String(reply ?? '')
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  let receipt
  try {
    receipt = JSON.parse(cleaned)
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/)
    if (!m) return err('Model returned invalid JSON', 502)
    try { receipt = JSON.parse(m[0]) } catch { return err('Model returned invalid JSON', 502) }
  }
  const items = Array.isArray(receipt?.items) ? receipt.items.map((it) => ({ name: String(it?.name || 'Item'), qty: Number(it?.qty) || 1, price: Number(it?.price) || 0 })) : []
  return json({
    receipt: {
      merchant: receipt?.merchant || null,
      category: receipt?.category || 'other',
      receipt_number: receipt?.receipt_number || null,
      date: receipt?.date || null,
      currency: receipt?.currency ? String(receipt.currency).toUpperCase().slice(0, 3) : null,
      subtotal: receipt?.subtotal ?? null,
      tax: receipt?.tax ?? null,
      total: Number(receipt?.total) || items.reduce((s, i) => s + i.price, 0),
      payment_method: receipt?.payment_method || null,
      items,
      confidence: Number(receipt?.confidence) || 0.7,
    },
    model,
  })
}

// ---------------- Router ----------------
function route(request, params) {
  const path = (params?.path || []).join('/')
  return { path, method: request.method }
}

export async function GET(request, ctx) {
  const { path } = route(request, await ctx.params)
  try {
    if (path === '' || path === 'health') return json({ ok: true, app: 'Paralar', time: new Date().toISOString() })
    if (path === 'rates') return json(await getRates())
    return err('Not found', 404)
  } catch (e) {
    console.error('GET /api/' + path, e)
    return err(e?.message || 'Server error', 500)
  }
}

export async function POST(request, ctx) {
  const { path } = route(request, await ctx.params)
  try {
    if (path === 'ai/transcribe') return await handleTranscribe(request)
    if (path === 'ai/parse') return await handleParse(request)
    if (path === 'ai/coach') return await handleCoach(request)
    if (path === 'ai/ocr') return await handleOcr(request)
    return err('Not found', 404)
  } catch (e) {
    console.error('POST /api/' + path, e)
    return err(e?.message || 'Server error', 500)
  }
}
