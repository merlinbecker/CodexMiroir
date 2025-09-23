# Refinement Backlog - Features nach Basis-Implementation

## Übersicht
Nach der erfolgreichen Implementierung der minimalistischen "Codex Miroir" Azure Function sollten folgende Features schrittweise hinzugefügt werden. **Priorität liegt auf Stabilität und Benutzerfreundlichkeit** vor komplexen Features.

## Sofortige Verbesserungen (Woche 1-2 nach Go-Live)

### 1.1 Frontend Verbesserungen
**Aufwand**: 4-6 Stunden

#### UI/UX Optimierungen
- **Responsive Design**: Mobile-optimierte Darstellung
- **Loading States**: Spinner während API-Calls  
- **Error Handling**: Benutzerfreundliche Fehlermeldungen
- **Keyboard Shortcuts**: Schnelle Navigation (Space = Complete, N = New Task)

#### Slot-Anzeige Verbesserung
```javascript
// Aktueller Slot prominent anzeigen
function SlotIndicator({ currentSlot, nextSlot }) {
  return (
    <div className="slot-indicator">
      <div className="current-slot">
        <span className="label">Aktuell:</span>
        <span className="slot">{formatSlot(currentSlot)}</span>
      </div>
      <div className="next-slot">
        <span className="label">Nächster:</span>
        <span className="slot">{formatSlot(nextSlot)}</span>
      </div>
    </div>
  );
}

function formatSlot(slot) {
  // "2025-W03-Mon-AM" → "Mo 20.01., Vormittag"
  const [year, week, day, period] = slot.split('-');
  const germanDays = { Mon: 'Mo', Tue: 'Di', Wed: 'Mi', Thu: 'Do', Fri: 'Fr', Sat: 'Sa', Sun: 'So' };
  const periods = { AM: 'Vormittag', PM: 'Nachmittag' };
  
  return `${germanDays[day]} ${getDateFromSlot(slot)}, ${periods[period]}`;
}
```

### 1.2 Markdown Optimierungen
**Aufwand**: 2-3 Stunden

#### Template Verbesserungen
```markdown
# Bessere Task-Templates
---
id: T-{COUNTER}
list: {LIST}
title: "{TITLE}"
status: geplant
created_at: {DD.MM.YYYY HH:MM}
scheduled_slot: {YYYY-Www-Day-Period}
duration_slots: 1
deadline: {DD.MM.YYYY HH:MM}
project: "{PROJECT}"
azure_devops: "{DEVOPS_URL}"
requester: "{PERSON}"
category_pro: {meeting|programmierung}
category_priv: {haushalt|projekt}
estimated_effort: {niedrig|mittel|hoch}
---

## Kontext & Ziel
{Was soll erreicht werden? Warum ist das wichtig?}

## Vorgehen
{Konkrete Schritte zur Umsetzung}

## Akzeptanzkriterien
- [ ] {Kriterium 1}
- [ ] {Kriterium 2}

## Notizen
{Zusätzliche Informationen, Links, etc.}

## Verlauf
- {DD.MM.YYYY HH:MM} → geplant in `{scheduled_slot}`
```

### 1.3 Performance Monitoring
**Aufwand**: 1-2 Stunden

#### Basic Logging
```javascript
// Erweiterte Logging-Funktion
function logAction(action, data, duration = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    action,
    duration: duration ? `${duration}ms` : null,
    list: data.list,
    success: true
  };
  
  console.log(JSON.stringify(logEntry));
  
  // Optional: An Application Insights senden
  if (process.env.APPINSIGHTS_INSTRUMENTATIONKEY) {
    // Send to Azure Monitor
  }
}
```

## Mittelfristige Erweiterungen (Monat 2-3)

### 2.1 Erweiterte Kalender-Features  
**Aufwand**: 8-12 Stunden

#### Intelligente Slot-Zuordnung
```javascript
class SlotManager {
  getNextOptimalSlot(list, taskData) {
    const { deadline, category, estimated_effort } = taskData;
    
    // Berücksichtige Deadline-Druck
    if (deadline && this.isUrgent(deadline)) {
      return this.getNextAvailableSlot(list);
    }
    
    // Optimiere nach Kategorie
    if (category === 'meeting') {
      return this.getPreferredMeetingSlot(list);
    }
    
    // Standard-Zuordnung
    return this.getNextAvailableSlot(list);
  }
  
  isUrgent(deadline) {
    const days = this.getDaysUntilDeadline(deadline);
    return days <= 2;
  }
}
```

#### Wochen-Übersicht
```javascript
// Neue API Action: getWeekOverview
async function getWeekOverview(query) {
  const { list, week } = query;
  const currentMd = await readText(`/codex-miroir/${list}/current.md`);
  const weekSection = extractWeek(currentMd, week);
  
  const slots = this.parseWeekSlots(weekSection);
  const totalHours = slots.length * 3.5;
  const availableSlots = this.getAvailableSlots(list, week);
  
  return {
    week,
    list,
    totalSlots: slots.length,
    totalHours,
    availableSlots: availableSlots.length,
    utilizationRate: (slots.length / (availableSlots.length + slots.length))
  };
}
```

### 2.2 Einfache Reporting-Features
**Aufwand**: 6-8 Stunden

#### Meeting vs. Task Ratio
```javascript
async function generateSimpleReport(query) {
  const { list, fromWeek, toWeek } = query;
  const archiveMd = await readText(`/codex-miroir/${list}/archive.md`);
  
  const weeks = this.getWeeksBetween(fromWeek, toWeek);
  let totalTasks = 0, meetings = 0, programming = 0;
  
  for (const week of weeks) {
    const weekSection = extractWeek(archiveMd, week);
    const stats = this.analyzeWeekSection(weekSection);
    
    totalTasks += stats.total;
    meetings += stats.meetings;
    programming += stats.programming;
  }
  
  return {
    period: `${fromWeek} bis ${toWeek}`,
    totalTasks,
    meetings,
    programming,
    meetingRatio: meetings / totalTasks,
    programmingRatio: programming / totalTasks,
    totalHours: totalTasks * 3.5
  };
}
```

### 2.3 Task-Verknüpfungen
**Aufwand**: 4-6 Stunden

#### Projekt-Gruppierung
```markdown
<!-- Erweiterte Task-Metadaten -->
---
project: "Migration Azure Functions"
epic: "Backend Modernisierung"
dependencies: ["T-001", "T-002"]
follows_up: "T-003"
---
```

#### Smart Queries
```javascript
// Neue API Actions
async function getTasksByProject(query) {
  const { list, project } = query;
  // Durchsuche alle Tasks nach Projekt
}

async function getUpcomingDeadlines(query) {
  const { list, days = 7 } = query;
  // Finde Tasks mit Deadline in nächsten X Tagen
}
```

## Experimentelle Features (Monat 4+)

### 3.1 Basis Voice Control
**Aufwand**: 10-15 Stunden

#### Einfache Sprachbefehle
```javascript
// Nur die wichtigsten Commands
const voiceCommands = {
  'complete': () => completeCurrentTask(),
  'next': () => showNextTasks(),
  'new task': () => openTaskCreation(),
  'push back': () => pushCurrentTaskToEnd()
};

// Browser Speech Recognition (keine OpenAI)
function setupVoiceControl() {
  if ('webkitSpeechRecognition' in window) {
    const recognition = new webkitSpeechRecognition();
    recognition.lang = 'de-DE';
    recognition.onresult = handleVoiceCommand;
  }
}
```

### 3.2 Bulk Operations
**Aufwand**: 6-8 Stunden

#### Task-Import/Export
```javascript
// CSV Import für größere Task-Listen
async function importTasksFromCSV(csvContent, list) {
  const lines = csvContent.split('\n');
  const tasks = lines.map(line => this.parseCSVLine(line));
  
  for (const taskData of tasks) {
    await createTask({
      list,
      ...taskData,
      created_at_iso: new Date().toISOString(),
      scheduled_slot: this.getNextSlot(list)
    });
  }
}
```

### 3.3 Team Features (Weit in der Zukunft)
**Aufwand**: 20-30 Stunden

#### Multi-User Support
- Shared Calendars für Teams
- Task-Delegation zwischen Benutzern
- Team-Reporting und Kapazitätsplanung

## Technische Verbesserungen

### Performance Optimizations
- **Caching**: Häufig genutzte Markdown-Dateien cachen
- **Batch Operations**: Mehrere Tasks auf einmal verarbeiten
- **Compression**: Große Markdown-Dateien komprimieren

### Security Enhancements
- **API Rate Limiting**: Schutz vor Missbrauch
- **Input Sanitization**: XSS-Schutz für Markdown-Content
- **Backup Strategy**: Automatische Backups der Blob Storage

### Monitoring & Observability
- **Health Checks**: Function Health Monitoring
- **Custom Metrics**: Task-Creation Rate, Response Times
- **Alerting**: Bei Fehlern oder Performance-Problemen

## Priorisierung

### Hoch (Sofort nach Go-Live)
1. Frontend UX Verbesserungen
2. Error Handling & Loading States
3. Mobile Responsive Design
4. Basic Performance Monitoring

### Mittel (Monat 2-3)
1. Erweiterte Kalender-Features
2. Einfache Reports
3. Task-Projekt-Verknüpfungen
4. Wochen-Übersicht

### Niedrig (Experimentell)
1. Voice Control (Browser-basiert)
2. CSV Import/Export
3. Advanced Analytics
4. Team Features

## Aufwand-Zusammenfassung

- **Sofortige Verbesserungen**: 8-12 Stunden
- **Mittelfristige Erweiterungen**: 20-30 Stunden  
- **Experimentelle Features**: 40-60 Stunden
- **Technische Verbesserungen**: 15-25 Stunden

**Gesamtaufwand für alle Refinements**: ~85-130 Stunden

## Empfehlung

**Phase 1** (erste 2 Wochen): Fokus auf Stabilität und Usability  
**Phase 2** (Monat 2-3): Produktivitäts-Features hinzufügen  
**Phase 3** (ab Monat 4): Experimentelle Features je nach Bedarf

Das Ziel sollte sein, das **minimalistische Konzept beizubehalten** und nur Features hinzuzufügen, die den Workflow messbar verbessern, ohne die Einfachheit zu gefährden.

---

**Wichtiger Hinweis**: Jedes neue Feature sollte erst nach erfolgreicher Nutzung der Basis-Implementation für mindestens 2-4 Wochen evaluiert werden. Die "Spiegelkodex"-Philosophie verlangt bewusste Zurückhaltung bei Feature-Ergänzungen.