import matter from "gray-matter";

function parseTask(mdText) {
  const fm = matter(mdText);
  const d = fm.data || {};
  return {
    typ: d.typ,
    kategorie: d.kategorie,
    status: d.status,
    tags: d.tags || [],
    fixedSlot: d.fixedSlot || null,
    abgeschlossen_am: d.abgeschlossen_am || null,
    body: fm.content.trim(),
  };
}

const slotOrder = { morgens: 1, nachmittags: 2, abends: 3 };

function sortKey(dateStr, slot) {
  // dateStr expected dd.mm.yyyy; convert to yyyy-mm-dd for lexicographic sort
  const [dd, mm, yyyy] = (dateStr || "31.12.2999").split(".");
  const iso = `${yyyy}-${mm}-${dd}`;
  const s = slotOrder[slot] || 9;
  return `${iso}#${s}`;
}

export { parseTask, sortKey, slotOrder };