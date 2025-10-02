/* CodexMiroir Timeline App */

document.addEventListener('alpine:init', () => {
    Alpine.data('app', () => ({
        userId: 'u_merlin',
        backendUrl: 'http://localhost:7071',
        days: [],
        allDays: [], // Speichert alle Tage vom Server
        error: null,
        isBusinessMode: true, // Standard: Geschäftlich
        dialog: { show: false, mode: 'create', date: '', slot: null },
        task: {
            id: '',
            kind: 'business',
            title: '',
            description: '',
            deadline: '',
            fixed: false,
            fixedDate: '',
            fixedTime: ''
        },

        init() {
            // Calculate timeline from today to end of next week
            const today = new Date();
            const nextWeekEnd = new Date(today);
            const daysUntilSunday = 7 - today.getDay() + 7; // Days until next Sunday
            nextWeekEnd.setDate(today.getDate() + daysUntilSunday);
            
            this.dateFrom = today.toISOString().split('T')[0];
            this.dateTo = nextWeekEnd.toISOString().split('T')[0];
            
            // Theme initialisieren
            this.applyTheme();
            
            this.load();
        },
        
        emptyTask() {
            return {
                id: '', // Backend wird UUID generieren
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
                const res = await fetch(`${this.backendUrl}/timeline/${this.userId}?dateFrom=${this.dateFrom}&dateTo=${this.dateTo}`);
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
            this.applyTheme();
            this.filterDays();
        },

        applyTheme() {
            const html = document.documentElement;
            if (this.isBusinessMode) {
                // Dark Theme für Geschäftlich
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

            this.days = this.allDays.filter(day => {
                const date = new Date(day.date + 'T00:00:00');
                const dayOfWeek = date.getDay(); // 0 = Sonntag, 6 = Samstag
                
                if (this.isBusinessMode) {
                    // Geschäftlich: Nur Werktage (Mo-Fr)
                    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
                } else {
                    // Privat: Nur Wochenende (Sa-So)
                    if (dayOfWeek !== 0 && dayOfWeek !== 6) return false;
                }
                
                // Tasks filtern
                day.slots.forEach(slot => {
                    if (slot.assignment && slot.assignment.taskId) {
                        const taskKind = slot.assignment.kind;
                        if (this.isBusinessMode && taskKind === 'personal') {
                            // Geschäftsmodus: Private Tasks ausblenden
                            slot.assignment = { taskId: null, kind: null, title: null };
                        } else if (!this.isBusinessMode && taskKind === 'business') {
                            // Privat-Modus: Geschäftliche Tasks ausblenden
                            slot.assignment = { taskId: null, kind: null, title: null };
                        }
                    }
                });
                
                return true;
            });
        },

        async edit(taskId) {
            try {
                this.error = null;
                const res = await fetch(`${this.backendUrl}/tasks/${this.userId}/${taskId}`);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();
                
                // Parse fixed datetime if exists
                let fixedDate = '';
                let fixedTime = '';
                if (data.fixed && data.fixedDateTime) {
                    const dt = new Date(data.fixedDateTime);
                    fixedDate = dt.toISOString().split('T')[0];
                    
                    // Map time to time slot labels
                    const hour = dt.getHours();
                    if (hour >= 6 && hour < 12) {
                        fixedTime = 'AM'; // Morgens
                    } else if (hour >= 12 && hour < 18) {
                        fixedTime = 'PM'; // Mittags
                    } else {
                        fixedTime = 'EV'; // Abends
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
                    // Map time slot labels to specific times
                    const timeMap = {
                        'AM': '09:00:00',  // Morgens: 9:00
                        'PM': '14:00:00',  // Mittags: 14:00
                        'EV': '19:00:00'   // Abends: 19:00
                    };
                    const specificTime = timeMap[this.task.fixedTime] || '09:00:00';
                    payload.fixedDateTime = `${this.task.fixedDate}T${specificTime}`;
                }
                
                if (this.dialog.mode === 'edit') {
                    const res = await fetch(`${this.backendUrl}/tasks/${this.userId}/${this.task.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    if (!res.ok) throw new Error('Update failed: HTTP ' + res.status);
                } else {
                    const res1 = await fetch(`${this.backendUrl}/tasks/${this.userId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    if (!res1.ok) throw new Error('Create failed: HTTP ' + res1.status);
                    
                    // Hole die Task-ID aus der Antwort
                    const createdTask = await res1.json();
                    const taskId = createdTask.id;
                    
                    if (this.dialog.date && this.dialog.slot !== null) {
                        // Manuelle Zuweisung zu einem spezifischen Slot
                        const res2 = await fetch(`${this.backendUrl}/timeline/${this.userId}/assign`, {
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
                        const res2 = await fetch(`${this.backendUrl}/timeline/${this.userId}/autofill`, {
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
            }
        },

        async prio(taskId) {
            try {
                this.error = null;
                const res = await fetch(`${this.backendUrl}/timeline/${this.userId}/prioritize`, {
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
            return { AM: 'Morgens', PM: 'Mittags', EV: 'Abends' }[l] || l;
        },

        kind(k) {
            return { business: 'Geschäftlich', personal: 'Privat', work: 'Geschäftlich' }[k] || k;
        },

        isCurrent(date, slotLabel) {
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            
            // Prüfe ob es heute ist
            if (date !== today) return false;
            
            const currentHour = now.getHours();
            
            // Bestimme welcher Slot gerade aktuell ist basierend auf der Uhrzeit
            if (slotLabel === 'AM' && currentHour >= 6 && currentHour < 12) return true;
            if (slotLabel === 'PM' && currentHour >= 12 && currentHour < 18) return true;
            if (slotLabel === 'EV' && (currentHour >= 18 || currentHour < 6)) return true;
            
            return false;
        },

        isPast(date, slotLabel) {
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            const currentHour = now.getHours();
            
            // Wenn es ein vergangenes Datum ist
            if (date < today) return true;
            
            // Wenn es heute ist, prüfe den Slot
            if (date === today) {
                if (slotLabel === 'AM' && currentHour >= 12) return true;  // Morgens ist vorbei ab 12:00
                if (slotLabel === 'PM' && currentHour >= 18) return true;  // Mittags ist vorbei ab 18:00
                // Abends (EV) ist nie "vergangen" am selben Tag
            }
            
            return false;
        },

        async moveDown(taskId) {
            try {
                this.error = null;
                
                // Zuerst die Task-Daten abrufen
                const taskRes = await fetch(`${this.backendUrl}/tasks/${this.userId}/${taskId}`);
                if (!taskRes.ok) throw new Error('Task fetch failed: HTTP ' + taskRes.status);
                const taskData = await taskRes.json();
                
                // Dann autofill für den nächsten freien Slot ab heute
                const today = new Date().toISOString().split('T')[0];
                const res = await fetch(`${this.backendUrl}/timeline/${this.userId}/autofill`, {
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
        }
    }));
});
