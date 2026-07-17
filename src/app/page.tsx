import { redirect } from 'next/navigation'
import { getPuntoVentaId } from '@/lib/comercio/session'
import { createServiceClient } from '@/lib/supabase/service'
import { ingresarConCelular } from './actions'

export default async function AccesoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const puntoVentaId = await getPuntoVentaId()

  if (puntoVentaId) {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('puntos_venta')
      .select('id')
      .eq('id', puntoVentaId)
      .eq('activo', true)
      .maybeSingle()

    if (data) redirect('/pedido')
  }

  const { error } = await searchParams

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-neutral-50 px-4">
      <form
        action={ingresarConCelular}
        className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <h1 className="mb-2 text-xl font-semibold text-neutral-900">Almacén Don Carmelo</h1>
        <p className="mb-6 text-sm text-neutral-500">
          Ingresá tu número de celular para hacer tu pedido.
        </p>

        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <label className="mb-1 block text-sm font-medium text-neutral-700">Celular</label>
        <input
          type="tel"
          name="celular"
          required
          placeholder="3492 40-1234"
          className="mb-6 w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        />

        <button
          type="submit"
          className="w-full rounded-md bg-neutral-900 px-4 py-3 text-base font-medium text-white hover:bg-neutral-800"
        >
          Ingresar
        </button>
      </form>
    </main>
  )
}
