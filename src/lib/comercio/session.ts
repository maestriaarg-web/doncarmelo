import { cookies } from 'next/headers'
import { COMERCIO_COOKIE_NAME } from './constants'

const CINCO_ANIOS_EN_SEGUNDOS = 60 * 60 * 24 * 365 * 5

export async function getPuntoVentaId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(COMERCIO_COOKIE_NAME)?.value ?? null
}

export async function setPuntoVentaCookie(puntoVentaId: string) {
  const cookieStore = await cookies()
  cookieStore.set(COMERCIO_COOKIE_NAME, puntoVentaId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: CINCO_ANIOS_EN_SEGUNDOS,
    path: '/',
  })
}
