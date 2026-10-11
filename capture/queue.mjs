import {validateConfig} from './policy.mjs';

// Single-process dev adapter. Durable production queues implement this same lifecycle.
// mutate serializes database updates with API writes; capture never accepts a URL from a request.
export function createCaptureQueue({getDb, mutate, loadConfig, run, now = () => new Date().toISOString()}) {
  let draining = null;
  async function drain() {
    for (;;) {
      const entry = Object.entries(getDb().captures).find(([id, job]) => job.status === 'queued' && getDb().apps[id]);
      if (!entry) return;
      const [id, job] = entry;
      let config;
      try { config = validateConfig(await loadConfig()); }
      catch { config = null; }
      if (!config?.apps.some(a => a.id === id)) {
        await mutate(db => { if (db.captures[id] === job) Object.assign(job, {status: 'not_configured', finishedAt: now()}); });
        continue;
      }
      await mutate(db => { if (db.captures[id] === job) Object.assign(job, {status: 'running', startedAt: now()}); });
      let succeeded = false;
      try { const result = await run({config, onlyId: id, catalog: Object.values(getDb().apps)}); succeeded = result.captured === 1 && result.failed === 0; }
      catch { /* Detailed browser/auth errors stay off the client; no credentials in status metadata. */ }
      await mutate(db => {
        if (db.apps[id] && db.captures[id] === job) Object.assign(job, {status: succeeded ? 'succeeded' : 'failed', finishedAt: now()});
      });
    }
  }
  return {
    kick() {
      if (!draining) draining = drain().finally(() => { draining = null; });
      return draining;
    },
    async recover() {
      await mutate(db => { for (const job of Object.values(db.captures)) if (job.status === 'running') job.status = 'queued'; });
      return this.kick();
    }
  };
}
