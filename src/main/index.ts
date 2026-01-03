/**
 * Entry point for both Main and Worker processes.
 * We avoid top-level imports of 'electron' modules like 'app' to prevent
 * crashes when running in UtilityProcess (worker mode).
 */

async function bootstrap() {
  if (process.argv.includes('--worker-mode')) {
    // Isolated Worker Branch
    // Dynamic import ensures that UI-sensitive electron modules used in main-app
    // are never loaded in this process.
    const { startWorkerMode } = await import('./worker-app')
    await startWorkerMode()
  } else {
    // Main UI Branch
    const { startMainApp } = await import('./main-app')
    startMainApp()
  }
}

bootstrap().catch((err) => {
  console.error('[Bootstrap Error]', err)
  process.exit(1)
})
