// New API service for voice-enhanced CodexMiroir Azure Functions
export class VoiceCodexAPI {
  private baseURL: string;
  private apiKey: string;

  constructor() {
    this.baseURL = import.meta.env.VITE_AZURE_FUNCTION_URL || 'https://codex-miroir-fn.azurewebsites.net/api/codex';
    this.apiKey = import.meta.env.VITE_API_KEY || '';
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey
    };
  }

  // Core task management (Phase 1)
  async createTask(list: 'pro' | 'priv', taskData: {
    id?: string;
    title: string;
    created_at_iso?: string;
    scheduled_slot?: string;
    category?: string;
    deadline_iso?: string;
    project?: string;
    azure_devops?: string;
    requester?: string;
    duration_slots?: number;
  }) {
    const response = await fetch(`${this.baseURL}?action=createTask`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        list,
        id: taskData.id || this.generateTaskId(),
        title: taskData.title,
        created_at_iso: taskData.created_at_iso || new Date().toISOString(),
        scheduled_slot: taskData.scheduled_slot || await this.getNextSlot(list),
        category: taskData.category,
        deadline_iso: taskData.deadline_iso,
        project: taskData.project,
        azure_devops: taskData.azure_devops,
        requester: taskData.requester,
        duration_slots: taskData.duration_slots || 1
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create task: ${response.statusText}`);
    }
    
    return response.json();
  }

  async completeTask(list: 'pro' | 'priv', taskPathAbs: string) {
    const response = await fetch(`${this.baseURL}?action=completeTask`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        list,
        taskPathAbs,
        closed_at_iso: new Date().toISOString()
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to complete task: ${response.statusText}`);
    }
    
    return response.json();
  }

  async pushToEnd(list: 'pro' | 'priv', taskPathAbs: string, newScheduledSlot?: string) {
    const nextSlot = newScheduledSlot || await this.getNextSlot(list);
    
    const response = await fetch(`${this.baseURL}?action=pushToEnd`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        list,
        taskPathAbs,
        new_scheduled_slot: nextSlot
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to reschedule task: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getTasks(list: 'pro' | 'priv') {
    const response = await fetch(`${this.baseURL}?action=report`, {
      method: 'GET',
      headers: this.headers,
      body: JSON.stringify({ list })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get tasks: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getNextSlot(list: 'pro' | 'priv') {
    const response = await fetch(`${this.baseURL}?action=when`, {
      method: 'GET',
      headers: this.headers,
      body: JSON.stringify({ list })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get next slot: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result.nextSlot;
  }

  // Voice command processing (Phase 2)
  async processVoiceCommand(text: string, list: 'pro' | 'priv') {
    const response = await fetch(`${this.baseURL}?action=processCommand`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ text, list })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to process voice command: ${response.statusText}`);
    }
    
    return response.json();
  }

  async decomposeTask(list: 'pro' | 'priv', taskData: {
    title: string;
    description?: string;
    estimated_hours?: number;
  }) {
    const response = await fetch(`${this.baseURL}?action=decomposeTask`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        list,
        title: taskData.title,
        description: taskData.description,
        estimated_hours: taskData.estimated_hours
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to decompose task: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getCurrentTaskForVoice(list: 'pro' | 'priv') {
    const response = await fetch(`${this.baseURL}?action=getCurrentTask`, {
      method: 'GET',
      headers: this.headers,
      body: JSON.stringify({ list })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get current task: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Utility methods
  private generateTaskId(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `T-${timestamp.toString().slice(-6)}${random.toString().padStart(3, '0')}`;
  }

  // Voice interface helpers
  startVoiceRecognition(onResult: (text: string) => void, onError?: (error: any) => void) {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      throw new Error('Speech recognition not supported in this browser');
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'de-DE';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      onResult(text);
    };

    recognition.onerror = (event: any) => {
      if (onError) onError(event.error);
    };

    recognition.start();
    return recognition;
  }

  speakResponse(text: string, lang: string = 'de-DE') {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      speechSynthesis.speak(utterance);
    }
  }

  // Voice command shortcuts
  async processVoiceCommandAndExecute(text: string, list: 'pro' | 'priv') {
    try {
      const result = await this.processVoiceCommand(text, list);
      
      // Speak the response
      if (result.response) {
        this.speakResponse(result.response);
      }
      
      return result;
    } catch (error) {
      console.error('Voice command error:', error);
      this.speakResponse('Entschuldigung, es gab einen Fehler bei der Verarbeitung deines Befehls.');
      throw error;
    }
  }
}

// Export singleton instance
export const voiceCodexAPI = new VoiceCodexAPI();