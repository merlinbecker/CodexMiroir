/* CodexMiroir Timeline App */

// Constants
const TIME_SLOT_MAP = {
    AM: '09:00:00',  // Morgens: 9:00
    PM: '14:00:00',  // Mittags: 14:00
    EV: '19:00:00'   // Abends: 19:00
};

const SLOT_LABELS = {
    AM: 'Morgens',
    PM: 'Mittags',
    EV: 'Abends'
};

const TASK_KINDS = {
    business: 'Arbeit',
    personal: 'Privat',
    work: 'Arbeit'
};

const SLOT_HOURS = {
    AM: { start: 6, end: 12 },
    PM: { start: 12, end: 18 },
    EV: { start: 18, end: 24 }
};

document.addEventListener('alpine:init', () => {
    Alpine.data('app', () => ({
        userId: '',
        functionKey: '',
        days: [],
        allDays: [], // Speichert alle Tage vom Server
        error: null,
        saving: false, // Verhindert doppelte Save-Aufrufe
        isBusinessMode: true, // Standard: Arbeit
        dialog: { show: false, mode: 'create', date: '', slot: null },
        task: {
            // Keine ID - wird erst beim Speichern vom Backend generiert
            kind: 'business',
            title: '',
            description: '',
            deadline: '',
            fixed: false,
            fixedDate: '',
            fixedTime: ''
        },

        init() {
            // Extract function key from URL (query parameter or fragment)
            const urlParams = new URLSearchParams(window.location.search);
            this.functionKey = urlParams.get('code') || '';
            
            // If not in query, check fragment
            if (!this.functionKey && window.location.hash) {
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                this.functionKey = hashParams.get('code') || '';
            }
            
            // Load userId from localStorage or prompt
            this.userId = localStorage.getItem('codexmiroir_userId');
            if (!this.userId) {
                this.userId = prompt('Bitte geben Sie Ihren Benutzernamen ein (z.B. u_merlin):');
                if (this.userId) {
                    localStorage.setItem('codexmiroir_userId', this.userId);
                } else {
                    this.error = 'Benutzername erforderlich';
                    return;
                }
            }
            
            // Load business mode preference from localStorage
            const savedMode = localStorage.getItem('codexmiroir_businessMode');
            if (savedMode !== null) {
                this.isBusinessMode = savedMode === 'true';
            }
            
            // Calculate timeline for next 7 days (Rabbit R1 requirement)
            const today = new Date();
            const next7Days = new Date(today);
            next7Days.setDate(today.getDate() + 7);
            
            this.dateFrom = today.toISOString().split('T')[0];
            this.dateTo = next7Days.toISOString().split('T')[0];
            
            // Theme initialisieren
            this.applyTheme();
            
            // Auto-load timeline (Rabbit R1: always load next 7 days automatically)
            this.load();
            
            // Rabbit R1: Setup scroll listener for timeline navigation
            this.setupRabbitR1Controls();
        },
        
        // Helper method to build API URL with function key
        apiUrl(path) {
            if (this.functionKey) {
                return `/${path}${path.includes('?') ? '&' : '?'}code=${encodeURIComponent(this.functionKey)}`;
            }
            return `/${path}`;
        },
        
        updateUserId() {
            if (this.userId) {
                localStorage.setItem('codexmiroir_userId', this.userId);
            }
        },
        
        emptyTask() {
            return {
                // Keine ID - wird vom Backend automatisch generiert
                kind: this.isBusinessMode ? 'business' : 'personal',
                title: '',
                description: '',
                deadline: '',
                fixed: false,
                fixedDate: '',
                fixedTime: ''
            };
        },

        async load() {
            try {
                this.error = null;
                if (!this.userId) {
                    this.error = 'Bitte Benutzername eingeben';
                    return;
                }
                const res = await fetch(this.apiUrl(`api/timeline/${this.userId}?dateFrom=${this.dateFrom}&dateTo=${this.dateTo}`));
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();
                this.allDays = data.days || [];
                this.filterDays();
            } catch (e) {
                this.error = e.message;
            }
        },

        create(date, slotIdx) {
            this.task = this.emptyTask();
            this.dialog = { show: true, mode: 'create', date, slot: slotIdx };
        },

        createNewTask() {
            this.task = this.emptyTask();
            this.dialog = { show: true, mode: 'create', date: '', slot: null };
        },

        createAndAutoAssign() {
            this.task = this.emptyTask();
            this.dialog = { show: true, mode: 'create-auto', date: '', slot: null };
        },

        toggleMode() {
            // Toggle the mode
            this.isBusinessMode = !this.isBusinessMode;
            // Save preference to localStorage
            localStorage.setItem('codexmiroir_businessMode', this.isBusinessMode.toString());
            this.applyTheme();
            this.filterDays();
        },

        applyTheme() {
            const html = document.documentElement;
            if (this.isBusinessMode) {
                // Dark Theme für Arbeit
                html.setAttribute('data-theme', 'dark');
            } else {
                // Light Theme für Privat
                html.removeAttribute('data-theme');
            }
        },

        filterDays() {
            if (!this.allDays) {
                this.days = [];
                return;
            }

            this.days = this.allDays.map(day => {
                const date = new Date(day.date + 'T00:00:00');
                const dayOfWeek = date.getDay(); // 0 = Sonntag, 6 = Samstag
                const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
                const isWeekday = !isWeekend;
                
                // Check if day has any tasks that should be shown in current mode
                let hasRelevantTasks = false;
                const filteredSlots = day.slots.map(slot => {
                    // Create a deep copy to avoid modifying original data
                    const slotCopy = JSON.parse(JSON.stringify(slot));
                    
                    if (slotCopy.assignment && slotCopy.assignment.taskId) {
                        const taskKind = slotCopy.assignment.kind;
                        const isBusinessTask = (taskKind === 'business' || taskKind === 'work');
                        const isPersonalTask = (taskKind === 'personal');
                        
                        // Show task if it matches current mode
                        const shouldShowTask = (this.isBusinessMode && isBusinessTask) || 
                                             (!this.isBusinessMode && isPersonalTask);
                        
                        if (shouldShowTask) {
                            hasRelevantTasks = true;
                            return slotCopy; // Keep the slot as is
                        } else {
                            // Hide the task but keep the slot structure
                            slotCopy.assignment = { taskId: null, kind: null, source: null, taskTitle: null };
                            return slotCopy;
                        }
                    }
                    return slotCopy; // Empty slot or no assignment
                });
                
                // Show day if:
                // 1. It matches the mode's default schedule (business=weekdays, personal=weekends)
                // 2. OR it has relevant tasks (fixed appointments)
                const shouldShowDay = (this.isBusinessMode && isWeekday) || 
                                    (!this.isBusinessMode && isWeekend) || 
                                    hasRelevantTasks;
                
                if (shouldShowDay) {
                    return {
                        ...day,
                        slots: filteredSlots
                    };
                }
                
                return null;
            }).filter(day => day !== null);
        },

        async edit(taskId) {
            try {
                this.error = null;
                const res = await fetch(this.apiUrl(`api/tasks/${this.userId}/${taskId}`));
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();
                
                // Parse fixed datetime if exists
                let fixedDate = '';
                let fixedTime = '';
                if (data.fixed && data.fixedDateTime) {
                    const dt = new Date(data.fixedDateTime);
                    fixedDate = dt.toISOString().split('T')[0];
                    
                    // Map time to time slot labels based on hour ranges
                    const hour = dt.getHours();
                    if (hour >= SLOT_HOURS.AM.start && hour < SLOT_HOURS.AM.end) {
                        fixedTime = 'AM';
                    } else if (hour >= SLOT_HOURS.PM.start && hour < SLOT_HOURS.PM.end) {
                        fixedTime = 'PM';
                    } else {
                        fixedTime = 'EV';
                    }
                }
                
                this.task = {
                    id: data.id,
                    kind: data.kind,
                    title: data.title || '',
                    description: data.description || '',
                    deadline: data.deadline || '',
                    fixed: data.fixed || false,
                    fixedDate: fixedDate,
                    fixedTime: fixedTime
                };
                this.dialog = { show: true, mode: 'edit', date: '', slot: null };
            } catch (e) {
                this.error = e.message;
            }
        },

        async save() {
            try {
                this.error = null;
                
                // Verhindere mehrfache gleichzeitige Aufrufe
                if (this.saving) {
                    return;
                }
                this.saving = true;
                
                // Build payload with simplified fields
                const payload = {
                    kind: this.task.kind,
                    title: this.task.title,
                    description: this.task.description,
                    deadline: this.task.deadline || null,
                    fixed: this.task.fixed,
                    priority: 3
                };
                
                // Nur bei Edit die ID mitschicken
                if (this.dialog.mode === 'edit') {
                    payload.id = this.task.id;
                }
                
                // Add fixedDateTime if fixed is true
                if (this.task.fixed && this.task.fixedDate && this.task.fixedTime) {
                    const specificTime = TIME_SLOT_MAP[this.task.fixedTime] || TIME_SLOT_MAP.AM;
                    // Verwende lokale Zeitzone für feste Termine
                    payload.fixedDateTime = `${this.task.fixedDate}T${specificTime}+02:00`;
                }
                
                if (this.dialog.mode === 'edit') {
                    const res = await fetch(this.apiUrl(`api/tasks/${this.userId}/${this.task.id}`), {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    if (!res.ok) throw new Error('Update failed: HTTP ' + res.status);
                } else {
                    const res1 = await fetch(this.apiUrl(`api/tasks/${this.userId}`), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    if (!res1.ok) {
                        const errorText = await res1.text();
                        throw new Error(`Create failed: HTTP ${res1.status} - ${errorText}`);
                    }
                    
                    // Hole die Task-ID aus der Antwort
                    const createdTask = await res1.json();
                    const taskId = createdTask.id;
                    
                    if (this.task.fixed && this.task.fixedDate && this.task.fixedTime) {
                        // Feste Termine: Zuweisung zu dem spezifischen Datum und Slot
                        const slotMap = { 'AM': 0, 'PM': 1, 'EV': 2 };
                        const targetSlotIdx = slotMap[this.task.fixedTime] || 0;
                        
                        const res2 = await fetch(this.apiUrl(`api/timeline/${this.userId}/assign`), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                date: this.task.fixedDate,
                                slotIdx: targetSlotIdx,
                                task: {
                                    id: taskId,
                                    kind: this.task.kind,
                                    title: this.task.title,
                                    fixed: true
                                },
                                source: 'manual'
                            })
                        });
                        if (!res2.ok) throw new Error('Fixed assign failed: HTTP ' + res2.status);
                    } else if (this.dialog.date && this.dialog.slot !== null) {
                        // Manuelle Zuweisung zu einem spezifischen Slot (nicht-feste Termine)
                        const res2 = await fetch(this.apiUrl(`api/timeline/${this.userId}/assign`), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                date: this.dialog.date,
                                slotIdx: this.dialog.slot,
                                task: {
                                    id: taskId,
                                    kind: this.task.kind,
                                    title: this.task.title
                                },
                                source: 'manual'
                            })
                        });
                        if (!res2.ok) throw new Error('Assign failed: HTTP ' + res2.status);
                    } else if (this.dialog.mode === 'create-auto') {
                        // Automatische Zuweisung zum ersten freien Slot
                        const today = new Date().toISOString().split('T')[0];
                        const res2 = await fetch(this.apiUrl(`api/timeline/${this.userId}/autofill`), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                dateFrom: today,
                                task: {
                                    id: taskId,
                                    kind: this.task.kind,
                                    title: this.task.title
                                }
                            })
                        });
                        if (!res2.ok) throw new Error('AutoAssign failed: HTTP ' + res2.status);
                    }
                }
                
                this.dialog.show = false;
                await this.load();
            } catch (e) {
                this.error = e.message;
            } finally {
                this.saving = false;
            }
        },

        async prio(taskId) {
            try {
                this.error = null;
                const res = await fetch(this.apiUrl(`api/timeline/${this.userId}/prioritize`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ taskId })
                });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                await this.load();
            } catch (e) {
                this.error = e.message;
            }
        },

        format(d) {
            const date = new Date(d + 'T00:00:00');
            return date.toLocaleDateString('de-DE', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        },

        week(d) {
            const date = new Date(d + 'T00:00:00Z');
            const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            const dayNum = day.getUTCDay() || 7;
            day.setUTCDate(day.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
            return Math.ceil((((day - yearStart) / 86400000) + 1) / 7);
        },

        label(l) {
            return SLOT_LABELS[l] || l;
        },

        kind(k) {
            return TASK_KINDS[k] || k;
        },

        isCurrent(date, slotLabel) {
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            
            if (date !== today) return false;
            
            const currentHour = now.getHours();
            const slotHours = SLOT_HOURS[slotLabel];
            
            if (!slotHours) return false;
            
            // Special case for EV slot which wraps around midnight
            if (slotLabel === 'EV') {
                return currentHour >= slotHours.start || currentHour < 6;
            }
            
            return currentHour >= slotHours.start && currentHour < slotHours.end;
        },

        isPast(date, slotLabel) {
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            
            if (date < today) return true;
            
            if (date === today) {
                const currentHour = now.getHours();
                const slotHours = SLOT_HOURS[slotLabel];
                
                if (!slotHours) return false;
                
                // AM ist vorbei ab 12:00, PM ist vorbei ab 18:00
                if (slotLabel === 'AM' && currentHour >= slotHours.end) return true;
                if (slotLabel === 'PM' && currentHour >= slotHours.end) return true;
                // EV ist nie "vergangen" am selben Tag
            }
            
            return false;
        },

        async moveDown(taskId) {
            try {
                this.error = null;
                
                // Zuerst die Task-Daten abrufen
                const taskRes = await fetch(this.apiUrl(`api/tasks/${this.userId}/${taskId}`));
                if (!taskRes.ok) throw new Error('Task fetch failed: HTTP ' + taskRes.status);
                const taskData = await taskRes.json();
                
                // Dann autofill für den nächsten freien Slot ab heute
                const today = new Date().toISOString().split('T')[0];
                const res = await fetch(this.apiUrl(`api/timeline/${this.userId}/autofill`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        dateFrom: today,
                        task: {
                            id: taskData.id,
                            kind: taskData.kind,
                            title: taskData.title
                        }
                    })
                });
                if (!res.ok) throw new Error('Move down failed: HTTP ' + res.status);
                await this.load();
            } catch (e) {
                this.error = e.message;
            }
        },

        async deleteTask(taskId) {
            try {
                this.error = null;
                
                // Bestätigung vom Benutzer
                if (!confirm('Möchten Sie diesen Task wirklich löschen?')) {
                    return;
                }
                
                const res = await fetch(this.apiUrl(`api/tasks/${this.userId}/${taskId}`), {
                    method: 'DELETE'
                });
                if (!res.ok) throw new Error('Delete failed: HTTP ' + res.status);
                
                this.dialog.show = false;
                await this.load();
            } catch (e) {
                this.error = e.message;
            }
        },

        // Rabbit R1 specific controls
        setupRabbitR1Controls() {
            // Scroll listener: scroll up = timeline down, scroll down = timeline up
            let scrollTimeout;
            window.addEventListener('wheel', (e) => {
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    const timeline = document.querySelector('section[x-show="days.length"]');
                    if (timeline && this.days.length > 0) {
                        // Invert scroll: wheel up (negative) scrolls timeline down
                        // wheel down (positive) scrolls timeline up
                        const scrollAmount = -e.deltaY * 2;
                        timeline.scrollBy({ top: scrollAmount, behavior: 'smooth' });
                    }
                }, 10);
            }, { passive: true });

            // Side button long press detection
            let longPressTimer;
            const LONG_PRESS_DURATION = 800; // ms

            // Listen for side button events (could be mapped to specific keys)
            // Using 'r' key as a proxy for Rabbit R1 side button
            window.addEventListener('keydown', (e) => {
                if (e.key === 'r' || e.key === 'R') {
                    if (!longPressTimer) {
                        longPressTimer = setTimeout(() => {
                            this.triggerVoiceTranscription();
                        }, LONG_PRESS_DURATION);
                    }
                }
            });

            window.addEventListener('keyup', (e) => {
                if (e.key === 'r' || e.key === 'R') {
                    if (longPressTimer) {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                    }
                }
            });
        },

        triggerVoiceTranscription() {
            // Send postMessage to prepare agent for voice transcription
            const prompt = `Du bist ein Planner für Meetings und Tasks. Transkribiere die nächsten Sätze und finde heraus, welche Art von Task ich anlegen will. 

Gib mir ein JSON-Objekt zurück in dieser Form (es muss nicht vollständig sein):
{
  "kind": "work" | "personal" | "meeting",
  "title": "Kurzer Titel des Tasks",
  "description": "Detaillierte Beschreibung",
  "deadline": "YYYY-MM-DD" (optional),
  "fixed": false,
  "priority": 3,
  "tags": ["tag1", "tag2"] (optional),
  "project": { "id": "proj_id", "name": "Project Name" } (optional),
  "contact": { "name": "Name", "email": "email@example.com" } (optional)
}

Beispiele:
- "Meeting mit Marina am Freitag um 14 Uhr" → {"kind": "meeting", "title": "Meeting mit Marina", "fixed": true, "fixedDateTime": "2025-01-XX 14:00", "contact": {"name": "Marina"}}
- "CodexMiroir Sprint fertigstellen bis Ende der Woche" → {"kind": "work", "title": "CodexMiroir Sprint fertigstellen", "deadline": "2025-01-XX", "project": {"name": "CodexMiroir"}}
- "Einkaufen gehen" → {"kind": "personal", "title": "Einkaufen gehen"}

Warte jetzt auf die gesprochene Eingabe...`;

            // Send message to parent window or Rabbit R1 interface
            if (window.parent !== window) {
                window.parent.postMessage({
                    type: 'VOICE_TRANSCRIPTION_REQUEST',
                    prompt: prompt,
                    userId: this.userId
                }, '*');
            }

            // Also log to console for debugging
            console.log('Rabbit R1: Voice transcription mode activated');
            console.log('Prompt:', prompt);

            // Show visual feedback
            this.error = '🎤 Spracherkennung aktiviert - Sprechen Sie jetzt...';
            setTimeout(() => {
                if (this.error === '🎤 Spracherkennung aktiviert - Sprechen Sie jetzt...') {
                    this.error = null;
                }
            }, 5000);
        }
    }));
});
