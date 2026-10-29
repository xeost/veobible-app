import {
  validateContent,
  type SiteSnapshot
} from '../../../../packages/website/content'
export async function saveSnapshot(
  db: D1Database,
  input: unknown,
  actor: string,
  nonce = ''
): Promise<SiteSnapshot> {
  const content = validateContent(input)
  const text = JSON.stringify(content)
  if (new TextEncoder().encode(text).byteLength > 1800000)
    throw new Error('Website release exceeds storage limit')
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text + nonce)
  )
  const revision = Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('')
  await db
    .prepare(
      'INSERT OR IGNORE INTO website_releases(revision,content,created_by) VALUES(?,?,?)'
    )
    .bind(revision, text, actor.slice(0, 100))
    .run()
  return { ...content, revision }
}
export async function devBuild(db: D1Database, input: unknown, actor: string) {
  const snapshot = await saveSnapshot(db, input, actor)
  await db
    .prepare('UPDATE website_state SET dev_revision=? WHERE id=1')
    .bind(snapshot.revision)
    .run()
  return snapshot.revision
}
export async function stage(db: D1Database, input: unknown, actor: string) {
  const snapshot = await saveSnapshot(db, input, actor, crypto.randomUUID())
  const result = await db
    .prepare(
      'UPDATE website_state SET revision=?,busy=1 WHERE id=1 AND busy=0 RETURNING id'
    )
    .bind(snapshot.revision)
    .all()
  if (!result.results.length)
    throw new Error('A website update is already in progress')
  return snapshot.revision
}
export async function finish(
  db: D1Database,
  revision: string,
  success: boolean
) {
  await db
    .prepare(
      'UPDATE website_state SET busy=0,deployed_revision=CASE WHEN ? THEN ? ELSE deployed_revision END,revision=CASE WHEN ? THEN revision ELSE deployed_revision END WHERE id=1 AND revision=?'
    )
    .bind(Number(success), revision, Number(success), revision)
    .run()
}
export async function readSnapshot(
  db: D1Database,
  isDevelopment = false
): Promise<SiteSnapshot | null> {
  const row = await db
    .prepare(
      `SELECT r.revision,r.content FROM website_state s JOIN website_releases r ON r.revision=s.${isDevelopment ? 'dev_revision' : 'revision'} WHERE s.id=1`
    )
    .first<{ revision: string; content: string }>()
  return row
    ? { ...validateContent(JSON.parse(row.content)), revision: row.revision }
    : null
}

export async function deployedSnapshot(
  db: D1Database
): Promise<SiteSnapshot | null> {
  const row = await db
    .prepare(
      'SELECT r.revision,r.content FROM website_state s JOIN website_releases r ON r.revision=s.deployed_revision WHERE s.id=1'
    )
    .first<{ revision: string; content: string }>()
  return row
    ? { ...validateContent(JSON.parse(row.content)), revision: row.revision }
    : null
}
