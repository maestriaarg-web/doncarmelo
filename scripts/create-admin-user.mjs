// scripts/create-admin-user.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

function loadEnvLocal() {
  const content = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8')
  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/)
    if (match) process.env[match[1]] ??= match[2]
  }
}

loadEnvLocal()

const [, , email, password] = process.argv

if (!email || !password) {
  console.error('Uso: node scripts/create-admin-user.mjs <email> <password>')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
})

if (error) {
  console.error('Error creando el usuario:', error.message)
  process.exit(1)
}

console.log('Usuario admin creado:', data.user.email, data.user.id)
