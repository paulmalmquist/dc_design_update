// Shared trust boundary for worker-published screenshot metadata. Never accept this via app edits.
export function approvedScreenshot(record, id, now = Date.now()) {
  if (!record || record.approved !== true || !/^[a-z][a-z0-9-]{1,63}$/.test(id)) return null;
  if (!new RegExp(`^screenshots/${id}-[a-f0-9]{12}\\.jpg$`).test(record.path || '')) return null;
  const captured = Date.parse(record.capturedAt), expires = Date.parse(record.expiresAt);
  if (!Number.isFinite(captured) || !Number.isFinite(expires) || captured > now || expires <= now || expires <= captured) return null;
  return {path: record.path, capturedAt: record.capturedAt, expiresAt: record.expiresAt, approved: true};
}

export function captureMessage(capture) {
  const messages = {queued: 'Screenshot queued.', running: 'Capturing a safe preview…', succeeded: 'Screenshot captured.', failed: 'Capture failed. Check the worker configuration and retry.', not_configured: 'A site administrator must configure an approved safe-preview route first.'};
  return capture ? messages[capture.status] || 'Screenshot unavailable.' : 'No screenshot yet. Ask a site administrator to configure automatic capture.';
}
