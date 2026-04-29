import { NextRequest, NextResponse } from 'next/server'

import { and, eq } from 'drizzle-orm'
import crypto from 'crypto'
import { db } from '@/db'
import { bankConnections } from '@/db/schema/bankConnection'
import { syncConnection } from '@/lib/truelayer/sync'

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

function verifyWebhookSignature(payload: string, signature: string): boolean {
  const secret = process.env.TRUELAYER_WEBHOOK_SECRET

  if (!secret) {
    console.error('[TrueLayer] TRUELAYER_WEBHOOK_SECRET is not set')
    return false
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature.toLowerCase(), 'hex'),
      Buffer.from(expected.toLowerCase(), 'hex')
    )
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Supported TrueLayer webhook event types
// ---------------------------------------------------------------------------

type TrueLayerWebhookEvent =
  | { type: 'transaction_created'; account_id: string; transaction_id: string }
  | { type: 'transaction_settled'; account_id: string; transaction_id: string }
  | { type: 'transaction_pending'; account_id: string; transaction_id: string }
  | { type: 'consent_expired'; account_id: string }
  | { type: 'consent_revoked'; account_id: string }
  | { type: 'account_disconnected'; account_id: string }

// ---------------------------------------------------------------------------
// POST /api/bank/webhook
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  const signature =
    request.headers.get('tl-signature') ??
    request.headers.get('x-tl-signature') ??
    ''

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn('[TrueLayer] Webhook signature verification failed')

    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: TrueLayerWebhookEvent

  try {
    event = JSON.parse(rawBody) as TrueLayerWebhookEvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  console.info(
    `[TrueLayer] Webhook received: ${event.type} for account ${event.account_id}`
  )

  const [connection] = await db
    .select()
    .from(bankConnections)
    .where(eq(bankConnections.providerAccountId, event.account_id))
    .limit(1)

  if (!connection) {
    return NextResponse.json({ ok: true, note: 'unknown_account' })
  }

  const parishCouncilId = connection.parishCouncilId

  switch (event.type) {
    case 'transaction_created':
    case 'transaction_settled': {
      try {
        const result = await syncConnection({
          connection,
          parishCouncilId
        })

        console.info(
          `[TrueLayer] Sync complete for ${connection.accountName}: ` +
            `${result.imported} imported, ${result.skipped} skipped`
        )
      } catch (err) {
        console.error('[TrueLayer] Sync failed after webhook:', err)
      }

      break
    }

    case 'consent_expired': {
      await db
        .update(bankConnections)
        .set({
          status: 'EXPIRED',
          updatedAt: new Date()
        })
        .where(
          and(
            eq(bankConnections.parishCouncilId, parishCouncilId),
            eq(bankConnections.providerAccountId, event.account_id)
          )
        )

      console.warn(
        `[TrueLayer] Consent expired for account ${event.account_id}`
      )

      break
    }

    case 'consent_revoked':
    case 'account_disconnected': {
      await db
        .update(bankConnections)
        .set({
          status: 'REVOKED',
          updatedAt: new Date()
        })
        .where(
          and(
            eq(bankConnections.parishCouncilId, parishCouncilId),
            eq(bankConnections.providerAccountId, event.account_id)
          )
        )

      console.warn(
        `[TrueLayer] Consent revoked for account ${event.account_id}`
      )

      break
    }

    case 'transaction_pending':
      break

    default: {
      const unhandledEvent = event as { type?: string }

      console.info(
        `[TrueLayer] Unhandled event type: ${unhandledEvent.type ?? 'unknown'}`
      )
    }
  }

  return NextResponse.json({ ok: true })
}
