import { signIn } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <form
        action={signIn}
        className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <h1 className="mb-6 text-xl font-semibold text-neutral-900">Panel Don Carmelo</h1>

        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <label className="mb-1 block text-sm font-medium text-neutral-700">Email</label>
        <input
          type="email"
          name="email"
          required
          className="mb-4 w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        />

        <label className="mb-1 block text-sm font-medium text-neutral-700">Contraseña</label>
        <input
          type="password"
          name="password"
          required
          className="mb-6 w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        />

        <button
          type="submit"
          className="w-full rounded-md bg-neutral-900 px-4 py-2.5 text-base font-medium text-white hover:bg-neutral-800"
        >
          Ingresar
        </button>
      </form>
    </main>
  )
}
