const Database = require('better-sqlite3')
const path = require('path')
const os = require('os')
const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
// Try to guess the path. Electron app name usually defaults to name in package.json
const dbPath = path.join(appData, 'taggedviewer', 'taggedviewer-db-v2.sqlite')
console.log('Opening DB:', dbPath)

try {
  const db = new Database(dbPath, { readonly: true })
  const rows = db
    .prepare('SELECT id, filepath, scanned_at FROM images ORDER BY scanned_at ASC LIMIT 10')
    .all()
  console.log('Results (scanned_at ASC):')
  rows.forEach((r) => console.log(r))

  console.log('---')
  const count = db.prepare('SELECT COUNT(*) as c FROM images').get().c
  console.log('Total images:', count)
} catch (e) {
  console.error('Failed to open DB:', e)
}
