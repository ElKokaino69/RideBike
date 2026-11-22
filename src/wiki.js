// RideBike – Wikipedia-Highlights zu Orten (Text: CC BY-SA, Wikipedia)
// © 2026 Florian Enders
const cache = new Map();

async function titleFor(p) {
  if (p.wiki) {
    const m = p.wiki.match(/^([a-z-]{2,8}):(.+)$/);
    return m ? { lang: m[1], title: m[2] } : { lang: 'de', title: p.wiki };
  }
  if (!p.wikidata) return null;
  const u = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(p.wikidata)}&props=sitelinks&sitefilter=dewiki|enwiki&format=json&origin=*`;
  const j = await (await fetch(u)).json();
  const sl = j.entities?.[p.wikidata]?.sitelinks || {};
  if (sl.dewiki) return { lang: 'de', title: sl.dewiki.title };
  if (sl.enwiki) return { lang: 'en', title: sl.enwiki.title };
  return null;
}

/** Kurzfassung + Bild eines Wikipedia-Artikels, oder null */
export async function wikiSummary(p) {
  const key = p.wiki || p.wikidata;
  if (!key) return null;
  if (cache.has(key)) return cache.get(key);
  const job = (async () => {
    const t = await titleFor(p);
    if (!t) return null;
    const r = await fetch(`https://${t.lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t.title.replace(/ /g, '_'))}`);
    if (!r.ok) return null;
    const j = await r.json();
    if (j.type === 'disambiguation' || !j.extract) return null;
    return {
      title: j.title, lang: t.lang, text: j.extract.length > 420 ? j.extract.slice(0, 400).replace(/\s\S*$/, '') + ' …' : j.extract,
      img: j.thumbnail?.source || '', url: j.content_urls?.mobile?.page || j.content_urls?.desktop?.page || `https://${t.lang}.wikipedia.org/wiki/${encodeURIComponent(t.title)}`
    };
  })().catch(() => null);
  cache.set(key, job);
  const res = await job;
  if (!res) cache.delete(key);
  return res;
}
