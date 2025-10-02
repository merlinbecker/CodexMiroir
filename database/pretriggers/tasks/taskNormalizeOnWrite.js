/**
 * Normalisiert und ergänzt ein Task-Dokument vor dem Speichern in der Datenbank.
 *
 * - Setzt Standardwerte für type ("task") und status ("open"), falls nicht vorhanden.
 * - Normalisiert und dedupliziert die Tags (Kleinschreibung, keine Duplikate).
 * - Setzt createdAt, falls nicht vorhanden, und aktualisiert updatedAt immer auf jetzt.
 * - Schreibt das normalisierte Dokument zurück in die Anfrage.
 */
function taskNormalizeOnWrite(){
  const req = getContext().getRequest();
  const doc = req.getBody();
  // Standardwert für type
  doc.type = doc.type || "task";
  // Standardwert für status
  doc.status = doc.status || "open";
  // Tags normalisieren: alles zu String, kleinschreiben, Duplikate entfernen
  doc.tags = Array.from(new Set((doc.tags||[]).map(t=>String(t).toLowerCase())));
  // createdAt nur setzen, wenn noch nicht vorhanden
  if (!doc.createdAt) doc.createdAt = new Date().toISOString();
  // updatedAt immer auf aktuellen Zeitpunkt setzen
  doc.updatedAt = new Date().toISOString();
  req.setBody(doc);
}
