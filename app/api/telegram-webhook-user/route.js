import { NextResponse } from 'next/server'
import { sendTelegramMessage } from '@/lib/telegram'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req) {
  try {
    const body = await req.json()
    
    // Payload record dari webhook / trigger Supabase
    const record = body?.record || body

    const email = record?.email || 'Tidak diketahui'
    const name = record?.raw_user_meta_data?.full_name || record?.full_name || 'Tanpa Nama'
    const createdAt = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })

    const text = `🎉 *User Baru Mendaftar Paralar!*

👤 *Nama:* ${name}
📧 *Email:* ${email}
⏰ *Waktu:* ${createdAt}`

    await sendTelegramMessage(text)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error sending telegram user notification:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}