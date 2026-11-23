// RideBike – Ausweichlösung für Umgebungen ohne Web-Worker (z. B. Dateivorschau im Chat):
// Die Kartenbibliothek bekommt dann einen „Worker“, der im Hauptthread läuft.
// Muss als ERSTES Modul geladen werden (vor maplibre-gl).
// © 2026 Florian Enders

const RealWorker = typeof window !== 'undefined' ? window.Worker : undefined;
const origCreate = typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL.bind(URL) : null;

/** Lassen sich Worker aus Blob-Adressen starten? */
export const WORKERS_OK = (() => {
  if (!RealWorker || !origCreate) return false;
  try {
    const u = origCreate(new Blob(['/**/'], { type: 'text/javascript' }));
    const w = new RealWorker(u);
    w.terminate();
    return true;
  } catch {
    return false;
  }
})();

// Skript-Blobs merken, um ihren Quelltext für den Ausweich-Worker zu haben
const scripts = new Map();
if (!WORKERS_OK && origCreate) {
  URL.createObjectURL = (obj) => {
    const url = origCreate(obj);
    if (obj instanceof Blob && /javascript/.test(obj.type)) scripts.set(url, obj);
    return url;
  };
}

function inlineWorker(source) {
  class WorkerGlobalScope {}
  const scope = new WorkerGlobalScope();
  const toWorker = new Set(), toMain = new Set();
  const deliver = (set, data, target) => Promise.resolve().then(() => {
    if (window.__rbWorkerLog) window.__rbWorkerLog.push((set === toWorker ? '→W ' : '←M ') + (data?.type || '?') + (data?.error ? ' ERR ' + JSON.stringify(data.error).slice(0, 200) : '')); for (const fn of [...set]) { try { fn({ data, target }); } catch (e) { console.error(e); } } }, 0);
  let mainOnMessage = null, workerOnMessage = null;

  const worker = {
    addEventListener: (t, fn) => { if (t === 'message') toMain.add(fn); },
    removeEventListener: (t, fn) => { if (t === 'message') toMain.delete(fn); },
    postMessage: (data) => deliver(toWorker, data, scope),
    terminate: () => { toWorker.clear(); toMain.clear(); },
    set onmessage(fn) { if (mainOnMessage) toMain.delete(mainOnMessage); mainOnMessage = fn; if (fn) toMain.add(fn); },
    get onmessage() { return mainOnMessage; },
    onerror: null
  };
  Object.assign(scope, {
    addEventListener: (t, fn) => { if (t === 'message') toWorker.add(fn); },
    removeEventListener: (t, fn) => { if (t === 'message') toWorker.delete(fn); },
    postMessage: (data) => deliver(toMain, data, worker),
    importScripts: () => {},
    close: () => worker.terminate(),
    location: window.location,
    navigator: window.navigator
  });
  Object.defineProperty(scope, 'onmessage', {
    set(fn) { if (workerOnMessage) toWorker.delete(workerOnMessage); workerOnMessage = fn; if (fn) toWorker.add(fn); },
    get() { return workerOnMessage; }
  });
  // eslint-disable-next-line no-new-func
  // Eigener „MessageChannel“ (Mikrotask) für die Aufgabenwarteschlange – Timer würden gedrosselt
  class InlineChannel {
    constructor() {
      const port2 = { onmessage: null, close() {} };
      const port1 = { postMessage: (d) => Promise.resolve().then(() => port2.onmessage?.({ data: d })), close() {} };
      this.port1 = port1; this.port2 = port2;
    }
  }
  new Function('self', 'WorkerGlobalScope', 'MessageChannel', source)(scope, WorkerGlobalScope, InlineChannel);
  return worker;
}

const sources = new Map();
/** Vor dem Anlegen der Karte aufrufen: richtet bei Bedarf den Ausweich-Worker ein */
export async function prepareWorkers(maplibregl) {
  if (WORKERS_OK) return false;
  maplibregl.setWorkerCount?.(1);
  for (const [url, blob] of scripts) if (!sources.has(url)) sources.set(url, await blob.text());
  window.Worker = function (url, opts) {
    const src = sources.get(String(url));
    if (src != null) return inlineWorker(src);
    return new RealWorker(url, opts);
  };
  console.warn('Web-Worker nicht erlaubt – Kartenaufbereitung läuft im Hauptthread');
  return true;
}
