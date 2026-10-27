import { pushPreviewSchema } from './vercel-build-steps'
import { connectToLocalNeonProxy } from './test-db-env'

const READY_ATTEMPTS = 60

async function waitForProxy(databaseUrl: string) {
  const { neon } = await import('@neondatabase/serverless')
  const sql = neon(databaseUrl)
  for (let attempt = 1; ; attempt++) {
    try {
      await sql`select 1`
      return
    } catch (error) {
      if (attempt >= READY_ATTEMPTS) throw error
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
}

async function main() {
  const databaseUrl = await connectToLocalNeonProxy()
  await waitForProxy(databaseUrl)
  await pushPreviewSchema(databaseUrl)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
