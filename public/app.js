/* CodexMiroir Timeline App */

const BASE = 'http://localhost:7071';

document.addEventListener('alpine:init', () => {
    Alpine.data('app', () => ({
        userId: 'u_merlin',
        dateFrom: new Date().toISOString().split('T')[0],
        dateTo: new Date(Date.now() + 7*86400000).toISOString().split('T')[0],
        days: [],
        error: null,
        dialog: { show: false, mode: 'create', date: '', slot: null },
        task: { 
            id: 'task_' + Date.now(), 
            kind: 'business', 
            title: '', 
            description: '', 
            tags: '', 
            priority: 3, 
            deadline: '', 
            fixed: false, 
            projectId: '', 
            projectName: '', 
            contactName: '', 
            contactEmail: '', 
            devOpsUrl: '' 
        },
        quick: { id: '', kind: '', title: '', date: new Date().toISOString().split('T')[0] },
        
        emptyTask() {
            return { 
                id: 'task_' + Date.now(), 
                kind: 'business', 
                title: '', 
                description: '', 
                tags: '', 
                priority: 3, 
                deadline: '', 
                fixed: false, 
                projectId: '', 
                projectName: '', 
                contactName: '', 
                contactEmail: '', 
                devOpsUrl: '' 
            };
        },
        
        async load() {
            try {
                this.error = null;
                const res = await fetch(`${BASE}/timeline/${this.userId}?dateFrom=${this.dateFrom}&dateTo=${this.dateTo}`);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();
                this.days = data.days || [];
            } catch (e) {
                this.error = e.message;
            }
        },
        
        create(date, slotIdx) {
            this.dialog = { show: true, mode: 'create', date, slot: slotIdx };
            this.task = this.emptyTask();
        },
        
        async edit(taskId) {
            try {
                this.error = null;
                const res = await fetch(`${BASE}/tasks/${this.userId}/${taskId}`);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();
                this.task = {
                    id: data.id, 
                    kind: data.kind, 
                    title: data.title || '', 
                    description: data.description || '',
                    tags: (data.tags || []).join(', '), 
                    priority: data.priority || 3,
                    deadline: data.deadline || '', 
                    fixed: data.fixed || false,
                    projectId: data.project?.id || '', 
                    projectName: data.project?.name || '',
                    contactName: data.contact?.name || '', 
                    contactEmail: data.contact?.email || '',
                    devOpsUrl: data.external?.devOpsUrl || ''
                };
                this.dialog = { show: true, mode: 'edit', date: '', slot: null };
            } catch (e) {
                this.error = e.message;
            }
        },
        
        async save() {
            try {
                this.error = null;
                const payload = {
                    id: this.task.id, 
                    kind: this.task.kind, 
                    title: this.task.title,
                    description: this.task.description, 
                    priority: this.task.priority,
                    tags: this.task.tags.split(',').map(t => t.trim()).filter(t => t),
                    deadline: this.task.deadline || null, 
                    fixed: this.task.fixed
                };
                
                if (this.task.projectId || this.task.projectName) {
                    payload.project = { 
                        id: this.task.projectId || null, 
                        name: this.task.projectName || null 
                    };
                }
                
                if (this.task.contactName || this.task.contactEmail) {
                    payload.contact = { 
                        name: this.task.contactName || null, 
                        email: this.task.contactEmail || null 
                    };
                }
                
                if (this.task.devOpsUrl) {
                    payload.external = { 
                        devOpsUrl: this.task.devOpsUrl, 
                        calendarEventId: null 
                    };
                }
                
                if (this.dialog.mode === 'edit') {
                    const res = await fetch(`${BASE}/tasks/${this.userId}/${this.task.id}`, {
                        method: 'PUT', 
                        headers: { 'Content-Type': 'application/json' }, 
                        body: JSON.stringify(payload)
                    });
                    if (!res.ok) throw new Error('Update failed: HTTP ' + res.status);
                } else {
                    const res1 = await fetch(`${BASE}/tasks/${this.userId}`, {
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json' }, 
                        body: JSON.stringify(payload)
                    });
                    if (!res1.ok) throw new Error('Create failed: HTTP ' + res1.status);
                    
                    const res2 = await fetch(`${BASE}/timeline/${this.userId}/assign`, {
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
                
                this.dialog.show = false;
                await this.load();
            } catch (e) {
                this.error = e.message;
            }
        },
        
        async prio(taskId) {
            try {
                this.error = null;
                const res = await fetch(`${BASE}/timeline/${this.userId}/prioritize`, {
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
        
        async autofill() {
            try {
                this.error = null;
                const res1 = await fetch(`${BASE}/tasks/${this.userId}`, {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        id: this.quick.id, 
                        kind: this.quick.kind, 
                        title: this.quick.title, 
                        priority: 3 
                    })
                });
                if (!res1.ok) throw new Error('Create failed: HTTP ' + res1.status);
                
                const res2 = await fetch(`${BASE}/timeline/${this.userId}/autofill`, {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        dateFrom: this.quick.date, 
                        task: { 
                            id: this.quick.id, 
                            kind: this.quick.kind, 
                            title: this.quick.title 
                        } 
                    })
                });
                if (!res2.ok) throw new Error('AutoFill failed: HTTP ' + res2.status);
                
                this.quick = { id: '', kind: '', title: '', date: new Date().toISOString().split('T')[0] };
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
