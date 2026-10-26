'use server'

import { unsubscribe, type UnsubscribeScope } from '@/lib/newsletter-unsubscribe'

export type UnsubscribeFormState =
  | { status: 'idle' }
  | { status: 'invalid' }
  | { status: 'done'; scope: UnsubscribeScope; removed: string[]; recordedAt: string | null }

/** No session check on purpose: the link's token is the only credential, as CAN-SPAM requires no login. */
export async function unsubscribeFromPage(
  _state: UnsubscribeFormState,
  formData: FormData,
): Promise<UnsubscribeFormState> {
  const scope = formData.get('scope')
  if (scope !== 'these' && scope !== 'all') return { status: 'invalid' }

  const result = await unsubscribe(formData.get('token'), scope, 'page')
  if (!result.ok) return { status: 'invalid' }
  return { status: 'done', scope, removed: result.removed, recordedAt: result.recordedAt?.toISOString() ?? null }
}
