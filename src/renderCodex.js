
const { app } = require('@azure/functions');
const { list, getTextBlob } = require("../shared/storage");
const { parseTask, sortKey } = require("../shared/parsing");

function htmlEscape(s) { 
  return (s || "").replace(/[&<>"']/g, c => ({ 
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    "\"":"&quot;",
    "'":"&#39;" 
  }[c])); 
}

app.http('renderCodex', {
  methods: ['GET'],
  authLevel: 'function',
  route: 'codex',
  handler: async (request, context) => {
    const url = new URL(request.url);
    const format = (url.searchParams.get('format') || process.env.RENDER_DEFAULT_FORMAT || "json").toLowerCase();
    
    // Lade alle Task-Dateien aus Cache
    const files = await list("raw/tasks/");
    const tasks = [];
    for (const name of files) {
      if (!name.endsWith(".md")) continue;
      const md = await getTextBlob(name);
      if (!md) continue;
      const t = parseTask(md);
      if (t.typ !== "task") continue;
      tasks.push({ file: name, ...t });
    }

    // Filter offene
    const open = tasks.filter(t => t.status === "offen");

    // Gruppieren nach Datum + Slot
    const groups = new Map();
    for (const t of open) {
      const d = t.fixedSlot?.datum || "ohne-datum";
      const z = t.fixedSlot?.zeit || "ohne-slot";
      const key = `${d}|${z}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    }

    // Sortieren
    const ordered = [...groups.entries()]
      .sort(([a],[b]) => {
        const [da, za] = a.split("|");
        const [db, zb] = b.split("|");
        const ka = sortKey(da, za);
        const kb = sortKey(db, zb);
        return ka.localeCompare(kb);
      })
      .map(([k, arr]) => ({ slot: k, items: arr }));

    if (format === "html") {
      let html = `<!doctype html><meta charset="utf-8"><title>Codex Timeline</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Arial,sans-serif;margin:20px}
h1{font-size:20px;margin:0 0 12px}
section{margin:16px 0;padding:12px;border:1px solid #ddd;border-radius:10px}
.slot{font-weight:600;margin-bottom:8px}
.item{margin-left:12px}
.badge{display:inline-block;font-size:12px;padding:2px 6px;border-radius:6px;border:1px solid #bbb;margin-left:6px}
.tag{margin-left:4px}
</style>
<h1>Codex Miroir – Offene Tasks</h1>`;
      for (const group of ordered) {
        const [d, z] = group.slot.split("|");
        html += `<section><div class="slot">${htmlEscape(d)} – ${htmlEscape(z)}</div>`;
        for (const it of group.items) {
          const title = it.file.split("/").pop().replace(/^\d{4}-\d{2}-\d{2}_/, "").replace(/\.md$/,"").replace(/-/g," ");
          html += `<div class="item">• ${htmlEscape(title)} <span class="badge">${htmlEscape(it.kategorie || "?")}</span>${
            it.deadline ? `<span class="badge">DL: ${htmlEscape(it.deadline)}</span>` : ""
          }${
            (it.tags||[]).map(t => `<span class="tag">#${htmlEscape(t)}</span>`).join("")
          }</div>`;
        }
        html += `</section>`;
      }
      
      return { 
        headers: { "content-type": "text/html; charset=utf-8" }, 
        body: html 
      };
    }

    // JSON
    return {
      headers: { "content-type": "application/json; charset=utf-8" },
      jsonBody: {
        generatedAt: new Date().toISOString(),
        groups: ordered.map(g => ({
          slot: g.slot,
          items: g.items.map(it => ({
            file: it.file,
            kategorie: it.kategorie,
            status: it.status,
            deadline: it.deadline || null,
            fixedSlot: it.fixedSlot || null,
            tags: it.tags || []
          }))
        }))
      }
    };
  }
});
