import { feedbackMailto } from './feedback';

/** Errors the browser raises that do not break the app. */
const BENIGN = /ResizeObserver loop|Superseded/;

/** Whether an uncaught error is the app's own and worth telling the user about. */
export function isAppError(message: string, filename?: string, origin = location.origin): boolean {
  if (BENIGN.test(message)) return false;
  // Extensions and injected scripts report their own files; ours are on this origin (or unknown, for promises).
  return !filename || filename.startsWith(origin);
}

let shown = false;

/** A plain-DOM banner, so it still shows when the Svelte app itself has failed. */
export function showCrash(): void {
  if (shown) return;
  shown = true;
  const bar = document.createElement('div');
  bar.className = 'crash';
  bar.setAttribute('role', 'alert');
  bar.innerHTML =
    '<span>Something went wrong. Reloading usually fixes it; your saved measurements and bikes are kept.</span>';
  const reload = document.createElement('button');
  reload.type = 'button';
  reload.className = 'btn small primary';
  reload.textContent = 'Reload';
  reload.onclick = () => location.reload();
  const report = document.createElement('a');
  report.href = feedbackMailto('Bikefitter error');
  report.textContent = 'Tell me';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn small ghost';
  close.textContent = 'Dismiss';
  close.onclick = () => bar.remove();
  bar.append(reload, report, close);
  document.body.append(bar);
}

export function watchCrashes(): void {
  window.addEventListener('error', (ev) => {
    if (isAppError(String(ev.message ?? ''), ev.filename)) showCrash();
  });
  window.addEventListener('unhandledrejection', (ev) => {
    const r = ev.reason;
    if (isAppError(r instanceof Error ? r.message : String(r))) showCrash();
  });
}
