// Cancellable dwell behavior shared by mouse and keyboard interactions.
export function createPreviewController({show, hide, delay = 600, restoreDelay = 1500, set = setTimeout, clear = clearTimeout}) {
  let dwell, restore, current = null, active = false, disposed = false;
  return {
    enter(id) {
      if (disposed) return;
      clear(restore);
      if (id === current) return;
      clear(dwell); current = id;
      dwell = set(() => { if (!disposed && current === id) { show(id); active = true; } }, delay);
    },
    leave() {
      clear(dwell); clear(restore); current = null;
      if (active) restore = set(() => { if (!disposed) { active = false; hide(); } }, restoreDelay);
    },
    dispose() { disposed = true; clear(dwell); clear(restore); current = null; }
  };
}

export function wireCardPreview(rails, {show, hide, set, clear}) {
  const controller = createPreviewController({show, hide, set, clear});
  const abort = new AbortController(), options = {signal: abort.signal};
  let pointer = null, focus = null;
  const card = node => { const found = node?.closest?.('.tile'); return found && rails.contains(found) ? found : null; };
  const sync = () => { const active = focus || pointer; active ? controller.enter(active.dataset.id) : controller.leave(); };
  rails.addEventListener('pointerover', e => { if (e.pointerType === 'mouse') { pointer = card(e.target); sync(); } }, options);
  rails.addEventListener('pointerout', e => { if (e.pointerType === 'mouse') { pointer = card(e.relatedTarget); sync(); } }, options);
  rails.addEventListener('pointerleave', () => { pointer = null; sync(); }, options);
  rails.addEventListener('focusin', e => { focus = card(e.target); sync(); }, options);
  rails.addEventListener('focusout', e => { focus = card(e.relatedTarget); sync(); }, options);
  return () => { abort.abort(); controller.dispose(); };
}

export function createTransitionGuard() {
  let revision = 0;
  return {begin() { const token = ++revision; return () => token === revision; }, cancel() { revision++; }};
}
