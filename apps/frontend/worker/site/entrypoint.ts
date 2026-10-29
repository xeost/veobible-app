import { WorkerEntrypoint } from 'cloudflare:workers'
import { devBuild, stage, finish, deployedSnapshot, readSnapshot } from './store'
export class SiteAdmin extends WorkerEntrypoint<{ DB: D1Database; SITE_LOCAL?: string }> {
  deployed() {
    return deployedSnapshot(this.env.DB)
  }
  development() {
    if (this.env.SITE_LOCAL !== 'true') throw new Error('Development only')
    return readSnapshot(this.env.DB, true)
  }
  devBuild(content: unknown, actor: string) {
    if (this.env.SITE_LOCAL !== 'true') throw new Error('Development only')
    return devBuild(this.env.DB, content, actor)
  }
  stage(content: unknown, actor: string) {
    return stage(this.env.DB, content, actor)
  }
  finish(revision: string, success: boolean) {
    return finish(this.env.DB, revision, success)
  }
}
