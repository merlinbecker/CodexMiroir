import { useState } from 'react';
import { Plus, Mic, MicOff, Moon, Sun, Calendar } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/use-speech';
import type { TaskMode } from '@/hooks/use-task-manager';

interface TaskInputProps {
  currentMode: TaskMode;
  onAddTask: (title: string, description: string, deadline?: Date) => void;
  isAddingTask: boolean;
  isReprioritizing?: boolean;
}

export function TaskInput({ currentMode, onAddTask, isAddingTask, isReprioritizing = false }: TaskInputProps) {
  const [taskInput, setTaskInput] = useState('');
  const [deadlineInput, setDeadlineInput] = useState('');
  const { 
    isListening, 
    transcript, 
    error, 
    startListening, 
    stopListening, 
    resetTranscript 
  } = useSpeechRecognition();

  const handleSubmit = () => {
    console.log('TaskInput handleSubmit called');
    const input = taskInput.trim() || transcript.trim();
    console.log('Input:', input);
    if (!input) {
      console.log('No input, returning');
      return;
    }

    // For simplicity, use the input as both title and description
    // In a real app, you might want to split or ask for more details
    const title = input.length > 50 ? input.substring(0, 50) + '...' : input;
    const description = input;
    const deadline = deadlineInput ? new Date(deadlineInput) : undefined;

    console.log('Calling onAddTask with:', title, description, deadline);
    onAddTask(title, description, deadline);
    setTaskInput('');
    setDeadlineInput('');
    resetTranscript();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const currentInput = taskInput || transcript;
  const isDarkMode = currentMode === 'professional';
  const isBlocked = isAddingTask || isReprioritizing;

  return (
    <section className="p-4 border-t border-border bg-card">
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <div className="flex-1 relative">
            <input 
              type="text" 
              placeholder="Neue Aufgabe hinzufügen..."
              value={currentInput}
              onChange={(e) => setTaskInput(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              data-testid="input-new-task"
              disabled={isBlocked}
            />
            {transcript && !taskInput && (
              <div className="absolute top-full left-0 mt-1 text-xs text-muted-foreground">
                Spracheingabe: {transcript}
              </div>
            )}
          </div>
        
          <button 
            onClick={handleVoiceToggle}
            className={`p-2 rounded-md transition-colors flex-shrink-0 ${
              isListening 
                ? 'bg-destructive text-destructive-foreground animate-pulse' 
                : 'bg-accent text-accent-foreground hover:bg-accent/80'
            }`}
            data-testid="button-voice-input"
            disabled={isBlocked}
          >
            {isListening ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>
          
          <button 
            onClick={handleSubmit}
            disabled={isBlocked || (!taskInput.trim() && !transcript.trim())}
            className="p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-add-task"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span className="text-xs">Frist (optional):</span>
          </div>
          <input 
            type="datetime-local" 
            value={deadlineInput}
            onChange={(e) => setDeadlineInput(e.target.value)}
            className="flex-1 px-2 py-1 bg-input border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            data-testid="input-task-deadline"
            disabled={isBlocked}
          />
        </div>
      </div>
      
      {error && (
        <div className="mt-2 text-xs text-destructive" data-testid="text-voice-error">
          {error}
        </div>
      )}
      
      <div className="flex items-center justify-center mt-2">
        <span className="text-xs text-muted-foreground" data-testid="text-current-mode">
          {isDarkMode ? (
            <>
              <Moon className="w-3 h-3 mr-1 inline" />
              Beruflicher Modus
            </>
          ) : (
            <>
              <Sun className="w-3 h-3 mr-1 inline" />
              Privater Modus
            </>
          )}
        </span>
      </div>
    </section>
  );
}
