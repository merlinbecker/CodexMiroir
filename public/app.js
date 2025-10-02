/* CodexMiroir Timeline App */

document.addEventListener('alpine:init', () => {
    Alpine.data('app', () => ({
        userId: 'u_merlin',
        backendUrl: 'http://localhost:7071',
        days: [],
        error: null,
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
            
            this.load();
        },
        
        emptyTask() {
            return {
                id: 'task_' + Date.now(),
                kind: 'business',
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
                this.days = data.days || [];
            } catch (e) {
                this.error = e.message;
            }
        },

        create(date, slotIdx) {
            this.task = this.emptyTask();
            this.dialog = { show: true, mode: 'create', date, slot: slotIdx };
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
                    fixedTime = dt.toTimeString().slice(0, 5);
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
                    id: this.task.id,
                    kind: this.task.kind,
                    title: this.task.title,
                    description: this.task.description,
                    deadline: this.task.deadline || null,
                    fixed: this.task.fixed,
                    priority: 3
                };
                
                // Add fixedDateTime if fixed is true
                if (this.task.fixed && this.task.fixedDate && this.task.fixedTime) {
                    payload.fixedDateTime = `${this.task.fixedDate}T${this.task.fixedTime}:00`;
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
                    
                    if (this.dialog.date && this.dialog.slot !== null) {
                        const res2 = await fetch(`${this.backendUrl}/timeline/${this.userId}/assign`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                date: this.dialog.date,
                                slotIdx: this.dialog.slot,
                                task: {
                                    id: this.task.id,
                                    kind: this.task.kind,
                                    title: this.task.title
                                },
                                source: 'manual'
                            })
                        });
                        if (!res2.ok) throw new Error('Assign failed: HTTP ' + res2.status);
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
        }
    }));
});
