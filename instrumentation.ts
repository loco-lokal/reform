// Runs once when the server starts: bring the database schema up to date before serving requests.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { migrate } = await import('./lib/migrate')
    await migrate()
  }
}
