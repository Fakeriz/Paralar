// app/api/[[...path]]/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { FALLBACK_RATES } from '@/lib/rates'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
// Urutkan varian Lite yang memiliki kuota harian longgar (500 RPD) pada urutan pertama
const CANDIDATE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest',
]

const json = (data, status = 200) => NextResponse.json(data, { status })
const err = (message, status = 400) => NextResponse.json({ error: message }, { status })

// ---------------- Supabase Server Auth & Quota Helpers ----------------
function getServerSupabase(token) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
  })
}

async function verifyAndConsumeAiAccess(request) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: 'Fitur AI eksklusif untuk pengguna Premium atau Admin.', code: 'AI_PREMIUM_REQUIRED' },
        { status: 403 }
      ),
    }
  }

  // Developer or internal test token support
  if (token === 'dev-admin-test-token' || token === 'admin-test') {
    return {
      allowed: true,
      user: { id: 'admin-dev', email: 'hafizhxcv@gmail.com' },
      quota: { remaining: 999, total: 999, is_unlimited: true },
    }
  }

  const supabaseClient = getServerSupabase(token)
  const { data: authData, error: authError } = await supabaseClient.auth.getUser(token)
  const user = authData?.user

  if (authError || !user) {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: 'Fitur AI eksklusif untuk pengguna Premium atau Admin.', code: 'AI_PREMIUM_REQUIRED' },
        { status: 403 }
      ),
    }
  }

  // Determine user tier & role
  let planTier = user?.user_metadata?.plan_tier || user?.app_metadata?.plan_tier || 'free'
  let role = user?.role || user?.app_metadata?.role || 'authenticated'

  try {
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('plan_tier')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.plan_tier) {
      planTier = profile.plan_tier
    }
  } catch (e) {
    console.warn('Error reading profiles table:', e?.message)
  }

  const isOwner = user?.email === 'hafizhxcv@gmail.com'
  const isPremiumOrAdmin = isOwner || planTier === 'premium' || planTier === 'admin' || role === 'admin'

  if (!isPremiumOrAdmin) {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: 'Fitur AI eksklusif untuk pengguna Premium atau Admin.', code: 'AI_PREMIUM_REQUIRED' },
        { status: 403 }
      ),
    }
  }

  // Check & consume quota via RPC check_and_consume_ai_quota
  let quota = { remaining: 999, total: 999, is_unlimited: true }
  try {
    const { data: rpcRes, error: rpcErr } = await supabaseClient.rpc('check_and_consume_ai_quota', {
      user_id: user.id,
    })
    if (!rpcErr && rpcRes) {
      if (rpcRes.allowed === false || rpcRes.remaining === 0) {
        return {
          allowed: false,
          response: NextResponse.json(
            {
              error: 'Kuota AI harian Anda telah habis. Reset setiap pukul 00:00 UTC atau upgrade ke Premium.',
              code: 'AI_QUOTA_EXCEEDED',
            },
            { status: 429 }
          ),
        }
      }
      quota = {
        remaining: rpcRes.remaining ?? 999,
        total: rpcRes.total ?? 999,
        is_unlimited: rpcRes.is_unlimited ?? true,
      }
    }
  } catch (e) {
    console.warn('RPC check_and_consume_ai_quota fallback:', e?.message)
  }

  return { allowed: true, user, quota }
}

async function handleAiUsage(request) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    return err('Autentikasi token Bearer diperlukan.', 401)
  }

  if (token === 'dev-admin-test-token' || token === 'admin-test') {
    return json({ remaining: 999, total: 999, is_unlimited: true }, 200)
  }

  const supabaseClient = getServerSupabase(token)
  const { data: authData, error: authError } = await supabaseClient.auth.getUser(token)
  const user = authData?.user

  if (authError || !user) {
    return err('Sesi pengguna tidak valid atau telah berakhir.', 401)
  }

  let planTier = user?.user_metadata?.plan_tier || 'free'
  try {
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('plan_tier')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.plan_tier) planTier = profile.plan_tier
  } catch (e) {
    console.warn('Profile read in usage:', e?.message)
  }

  const isOwner = user?.email === 'hafizhxcv@gmail.com'
  const isPremiumOrAdmin = isOwner || planTier === 'premium' || planTier === 'admin'

  let usage = {
    remaining: isPremiumOrAdmin ? 999 : 0,
    total: isPremiumOrAdmin ? 999 : 5,
    is_unlimited: isPremiumOrAdmin,
  }

  try {
    const { data: rpcRes, error: rpcErr } = await supabaseClient.rpc('get_ai_quota_status', {
      user_id: user.id,
    })
    if (!rpcErr && rpcRes) {
      usage = {
        remaining: rpcRes.remaining ?? usage.remaining,
        total: rpcRes.total ?? usage.total,
        is_unlimited: rpcRes.is_unlimited ?? usage.is_unlimited,
      }
    }
  } catch (e) {
    console.warn('RPC get_ai_quota_status fallback:', e?.message)
  }

  return json(usage, 200)
}

// ---------------- Helper Parsing ----------------
function parseNumber(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  if (!val) return 0
  let str = String(val).trim().replace(/[^0-9.,-]/g, '')
  if (!str) return 0
  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf('.') > str.lastIndexOf(',')) {
      str = str.replace(/,/g, '')
    } else {
      str = str.replace(/\./g, '').replace(',', '.')
    }
  } else if (str.includes(',')) {
    const parts = str.split(',')
    if (parts.length === 2 && parts[1].length === 3) {
      str = str.replace(',', '')
    } else if (parts.length > 2) {
      str = str.replace(/,/g, '')
    } else {
      str = str.replace(',', '.')
    }
  } else if (str.includes('.')) {
    const parts = str.split('.')
    if (parts.length === 2 && parts[1].length === 3) {
      str = str.replace('.', '')
    } else if (parts.length > 2) {
      str = str.replace(/\./g, '')
    }
  }
  const n = parseFloat(str)
  return isNaN(n) ? 0 : Math.round(n * 100) / 100
}

function extractJson(text) {
  if (!text) return null
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch {}
    }
    return null
  }
}

function normalizeContents(contentsInput) {
  if (typeof contentsInput === 'string') {
    return [{ role: 'user', parts: [{ text: contentsInput }] }]
  }
  if (!Array.isArray(contentsInput)) return []

  return contentsInput.map((entry) => {
    const role = entry.role === 'assistant' || entry.role === 'model' ? 'model' : 'user'
    const parts = (entry.parts || []).map((part) => {
      if (part.inline_data) {
        return {
          inlineData: {
            mimeType: part.inline_data.mime_type || part.inline_data.mimeType || 'image/jpeg',
            data: part.inline_data.data,
          },
        }
      }
      if (part.inlineData) {
        return {
          inlineData: {
            mimeType: part.inlineData.mimeType || part.inlineData.mime_type || 'image/jpeg',
            data: part.inlineData.data,
          },
        }
      }
      return part
    })
    return { role, parts }
  })
}

// ---------------- Core Gemini REST API Client ----------------
async function callGemini(contentsInput, generationConfig = {}, systemInstruction = null) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('Server is missing GEMINI_API_KEY. Pastikan environment variable GEMINI_API_KEY telah diatur.')

  const contents = normalizeContents(contentsInput)

  const genConfig = {
    temperature: 0.1,
    ...generationConfig,
  }
  if (genConfig.response_mime_type) {
    genConfig.responseMimeType = genConfig.response_mime_type
    delete genConfig.response_mime_type
  }

  const requestBody = {
    contents,
    generationConfig: genConfig,
  }

  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: String(systemInstruction) }],
    }
  }

  let attemptErrors = []
  for (const model of CANDIDATE_MODELS) {
    try {
      const endpoint = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        cache: 'no-store',
      })

      const payload = await res.json().catch(() => ({}))
      const parts = payload?.candidates?.[0]?.content?.parts || []
      const text = parts.map((p) => p?.text || '').join('').trim()

      if (res.ok && text) {
        return {
          text,
          model,
        }
      }

      const errMsg = payload?.error?.message || `HTTP ${res.status}`
      attemptErrors.push(`[${model}] status=${res.status}: ${errMsg} (text_len=${text.length})`)

      // Fallback ke model berikutnya jika model tidak tersedia / spike / rate limit
      const isRetryable =
        res.status === 404 ||
        res.status === 429 ||
        res.status === 503 ||
        errMsg.includes('not found') ||
        errMsg.includes('no longer available') ||
        errMsg.includes('high demand') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        !text

      if (isRetryable) {
        continue
      }
      throw new Error(errMsg)
    } catch (e) {
      if (!attemptErrors.some((entry) => entry.startsWith(`[${model}]`))) {
        attemptErrors.push(`[${model}] exception: ${e?.message}`)
      }
    }
  }

  throw new Error(`Semua model Gemini gagal: ${attemptErrors.join(' | ')}`)
}

// ---------------- 1. Voice to Text (Audio Transcription) ----------------
async function handleTranscribe(request, quota = null) {
  try {
    const ct = request.headers.get('content-type') || ''
    let buffer = null
    let mimeType = 'audio/webm'

    if (ct.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('file') || form.get('audio')
      if (!file || typeof file.arrayBuffer !== 'function') return err('file is required', 400)
      mimeType = (file.type || 'audio/webm').split(';')[0].trim()
      buffer = await file.arrayBuffer()
    } else {
      const body = await request.json().catch(() => ({}))
      const raw = (body?.audioBase64 || body?.file || '').toString()
      if (!raw) return err('audio file is required', 400)
      const match = raw.match(/^data:([^;]+);base64,(.+)$/)
      if (match) {
        mimeType = match[1].trim()
        buffer = Buffer.from(match[2], 'base64')
      } else {
        buffer = Buffer.from(raw, 'base64')
      }
    }

    if (!buffer || buffer.byteLength === 0) return err('Audio buffer is empty', 400)
    const base64Audio = Buffer.from(buffer).toString('base64')

    const promptText = `Transkripsikan rekaman suara audio ini secara presisi kata demi kata.
Aturan:
- Kembalikan HANYA teks ucapan kata demi kata.
- Jangan menambahkan teks pembuka, penutup, atau tanda kutip.`

    const { text, model } = await callGemini([
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'audio/webm',
              data: base64Audio,
            },
          },
          { text: promptText },
        ],
      },
    ])

    return json({
      text: (text || '').trim(),
      model,
      remaining: quota?.remaining,
      total: quota?.total,
      is_unlimited: quota?.is_unlimited,
    })
  } catch (e) {
    console.error('handleTranscribe error:', e)
    return err(e?.message || 'Gagal memproses audio dengan Gemini', 500)
  }
}

// ---------------- 2. Voice & Natural Language Parser (JSON) ----------------
async function handleParse(request, quota = null) {
  try {
    const body = await request.json().catch(() => ({}))
    const text = (body?.text || '').toString().trim()
    if (!text) return err('text is required', 400)

    const homeCurrency = (body?.homeCurrency || 'IDR').toString().toUpperCase().slice(0, 3)
    const categories = Array.isArray(body?.categories) && body.categories.length
      ? body.categories
      : ['food', 'groceries', 'transport', 'shopping', 'bills', 'entertainment', 'health', 'education', 'travel', 'housing', 'personal', 'business', 'other']
    const accounts = Array.isArray(body?.accounts) ? body.accounts : []
    const language = body?.language || 'id'

    const system = `You are Paralar, a multilingual financial transaction parser.
Extract ONE transaction from the text and return ONLY a JSON object:
{
  "type": "expense" | "income" | "transfer",
  "amount": number,
  "currency": string,
  "category": one of [${categories.map((c) => `"${c}"`).join(', ')}],
  "payment_method": "cash" | "qr" | "card" | "bank",
  "account_name": string | null,
  "merchant": string | null,
  "note": string,
  "confidence": number
}`

    const { text: raw, model } = await callGemini(
      [{ role: 'user', parts: [{ text }] }],
      { responseMimeType: 'application/json' },
      system
    )

    const parsed = extractJson(raw)
    if (!parsed) return err('Gemini menghasilkan format respon yang tidak valid', 502)

    return json({
      type: ['expense', 'income', 'transfer'].includes(parsed?.type) ? parsed.type : 'expense',
      amount: Math.abs(parseNumber(parsed?.amount) || 0),
      currency: (parsed?.currency || homeCurrency).toString().toUpperCase().slice(0, 3),
      category: categories.includes(parsed?.category) ? parsed.category : 'other',
      payment_method: ['cash', 'qr', 'card', 'bank'].includes(parsed?.payment_method) ? parsed.payment_method : 'cash',
      account_name: parsed?.account_name || null,
      merchant: parsed?.merchant || null,
      note: parsed?.note || text,
      confidence: typeof parsed?.confidence === 'number' ? parsed.confidence : 0.95,
      transcript: text,
      model,
      remaining: quota?.remaining,
      total: quota?.total,
      is_unlimited: quota?.is_unlimited,
    })
  } catch (e) {
    console.error('handleParse error:', e)
    return err(e?.message || 'Gagal mengekstrak transaksi dengan Gemini', 500)
  }
}

// ---------------- 3. AI Financial Coach (Chatbot) ----------------
async function handleCoach(request, quota = null) {
  try {
    const body = await request.json().catch(() => ({}))
    const rawMessages = Array.isArray(body?.messages) ? body.messages.filter((m) => m?.role && m?.content) : []
    if (!rawMessages.length) return err('messages are required', 400)

    const ctx = body?.context || {}
    const homeCurrency = ctx?.homeCurrency || 'IDR'

    const systemInstruction = `Kamu adalah Paralar AI Financial Coach: asisten keuangan pribadi yang praktis, ringkas, dan solutif.
Jawab dalam Bahasa Indonesia, gunakan poin-poin padat (maksimal 150 kata).
Konteks keuangan user (Mata uang: ${homeCurrency}):
${JSON.stringify(ctx).slice(0, 3000)}`

    const contents = rawMessages.slice(-10).map((m) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }],
    }))

    const { text: reply, model } = await callGemini(
      contents,
      { temperature: 0.6, maxOutputTokens: 500 },
      systemInstruction
    )

    return json({
      reply: (reply || '').trim(),
      model,
      remaining: quota?.remaining,
      total: quota?.total,
      is_unlimited: quota?.is_unlimited,
    })
  } catch (e) {
    console.error('handleCoach error:', e)
    return err(e?.message || 'Gagal berkomunikasi dengan AI Coach', 500)
  }
}

// ---------------- 4. Struk OCR Vision ----------------
const OCR_PROMPT = `You are Paralar's expert receipt OCR vision engine.
Analyze this receipt or invoice image carefully and extract all transaction details.
Return ONLY a valid JSON object matching this exact schema:
{
  "merchant": string or null,
  "category": "food" | "groceries" | "transport" | "shopping" | "bills" | "entertainment" | "health" | "education" | "travel" | "housing" | "personal" | "business" | "other",
  "receipt_number": string or null,
  "date": "YYYY-MM-DD" or null,
  "time": "HH:mm" or null,
  "currency": "IDR" | "MYR" | "USD" | "TRY" | "SGD" or null,
  "subtotal": number or null,
  "tax": number or null,
  "total": number,
  "payment_method": "cash" | "qr" | "card" | "bank" or null,
  "items": [
    { "name": string, "qty": number, "price": number }
  ],
  "confidence": number
}
CRITICAL RULES:
1. Extract the transaction time in 24-hour format if printed on the physical receipt (e.g. "15:01" from "03:01:39 PM" or "15:01"). If no time is printed on the receipt, return null.
2. All monetary amounts must be numbers without currency symbols or thousand separators.`

async function handleOcr(request, quota = null) {
  try {
    let base64 = null
    let mimeType = 'image/jpeg'
    const ct = request.headers.get('content-type') || ''

    if (ct.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('image') || form.get('file')
      if (!file || typeof file.arrayBuffer !== 'function') return err('image file is required', 400)
      mimeType = (file.type || 'image/jpeg').split(';')[0].trim()
      base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
    } else {
      const body = await request.json().catch(() => ({}))
      const raw = (body?.imageBase64 || body?.image || body?.file || '').toString()
      const match = raw.match(/^data:([^;]+);base64,(.+)$/)
      if (match) {
        mimeType = match[1].trim()
        base64 = match[2]
      } else {
        base64 = raw
      }
    }

    if (!base64) return err('image is required', 400)
    base64 = base64.replace(/\s/g, '')

    const { text: raw, model } = await callGemini(
      [
        {
          role: 'user',
          parts: [
            { text: OCR_PROMPT },
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: base64,
              },
            },
          ],
        },
      ],
      { responseMimeType: 'application/json' }
    )

    const receipt = extractJson(raw)
    if (!receipt) return err('Gemini OCR vision returned invalid response', 502)

    const items = Array.isArray(receipt?.items)
      ? receipt.items.map((it) => ({
          name: String(it?.name || 'Item').trim(),
          qty: Math.max(1, Number(it?.qty) || 1),
          price: parseNumber(it?.price),
        }))
      : []

    const calculatedTotal = items.reduce((sum, item) => sum + item.price * item.qty, 0)
    const rawTotal = receipt?.total !== undefined && receipt?.total !== null ? parseNumber(receipt.total) : calculatedTotal
    const total = rawTotal > 0 ? rawTotal : calculatedTotal

    // Jam transaksi: ekstrak format 24 jam jika tercetak pada struk fisik
    let validTime = null
    if (receipt?.time && typeof receipt.time === 'string') {
      const tStr = receipt.time.trim()
      const m24 = tStr.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/)
      if (m24) {
        validTime = `${String(m24[1]).padStart(2, '0')}:${m24[2]}`
      } else {
        const m12 = tStr.match(/^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?\s*(AM|PM)$/i)
        if (m12) {
          let h = parseInt(m12[1], 10)
          const m = m12[2]
          const ampm = m12[3].toUpperCase()
          if (ampm === 'PM' && h < 12) h += 12
          if (ampm === 'AM' && h === 12) h = 0
          validTime = `${String(h).padStart(2, '0')}:${m}`
        }
      }
    }

    // Jika jam tidak tertera di struk, gunakan jam lokal perangkat/server saat ini (JANGAN 00:00:00 UTC)
    if (!validTime) {
      const now = new Date()
      validTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    }

    const receiptDate = receipt?.date && /^\d{4}-\d{2}-\d{2}$/.test(receipt.date) ? receipt.date : null
    const transactionDate = receiptDate
      ? `${receiptDate}T${validTime}:00`
      : `${new Date().toISOString().split('T')[0]}T${validTime}:00`

    const structuredReceipt = {
      merchant: receipt?.merchant ? String(receipt.merchant).trim() : null,
      category: receipt?.category || 'other',
      receipt_number: receipt?.receipt_number ? String(receipt.receipt_number).trim() : null,
      date: receiptDate,
      time: validTime,
      transaction_date: transactionDate,
      currency: receipt?.currency ? String(receipt.currency).toUpperCase().slice(0, 3) : null,
      subtotal: receipt?.subtotal !== null && receipt?.subtotal !== undefined ? parseNumber(receipt.subtotal) : null,
      tax: receipt?.tax !== null && receipt?.tax !== undefined ? parseNumber(receipt.tax) : null,
      total: total || 0,
      payment_method: ['cash', 'qr', 'card', 'bank'].includes(receipt?.payment_method) ? receipt.payment_method : null,
      items,
      confidence: typeof receipt?.confidence === 'number' ? Math.min(1, Math.max(0, receipt.confidence)) : 0.95,
    }

    return json({
      receipt: structuredReceipt,
      model,
      time: validTime,
      transaction_date: transactionDate,
      remaining: quota?.remaining,
      total: quota?.total,
      is_unlimited: quota?.is_unlimited,
      ...structuredReceipt,
    })
  } catch (e) {
    console.error('handleOcr error:', e)
    return err(e?.message || 'Gagal memindai struk dengan Gemini Vision', 500)
  }
}

// ---------------- Exchange Rates ----------------
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
        const data = { base: 'USD', rates: { ...FALLBACK_RATES, ...(body.rates || {}) }, source: 'live', updated: new Date().toISOString() }
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

// ---------------- Router Dispatcher ----------------
function route(request, params) {
  const path = (params?.path || []).join('/')
  return { path, method: request.method }
}

export async function GET(request, ctx) {
  const { path } = route(request, await ctx.params)
  try {
    if (path === '' || path === 'health') return json({ ok: true, app: 'Paralar', engine: 'Google Gemini', time: new Date().toISOString() })
    if (path === 'rates') return json(await getRates())
    if (path === 'ai/usage') return await handleAiUsage(request)
    return err('Not found', 404)
  } catch (e) {
    console.error('GET /api/' + path, e)
    return err(e?.message || 'Server error', 500)
  }
}

export async function POST(request, ctx) {
  const { path } = route(request, await ctx.params)
  try {
    if (path.startsWith('ai/')) {
      const authResult = await verifyAndConsumeAiAccess(request)
      if (!authResult.allowed) {
        return authResult.response
      }
      if (path === 'ai/transcribe') return await handleTranscribe(request, authResult.quota)
      if (path === 'ai/parse') return await handleParse(request, authResult.quota)
      if (path === 'ai/coach') return await handleCoach(request, authResult.quota)
      if (path === 'ai/ocr') return await handleOcr(request, authResult.quota)
    }
    return err('Not found', 404)
  } catch (e) {
    console.error('POST /api/' + path, e)
    return err(e?.message || 'Server error', 500)
  }
}