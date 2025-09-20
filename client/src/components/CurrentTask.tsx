import { Calendar, Clock, Check } from 'lucide-react';
import type { Task } from '@shared/schema';

interface CurrentTaskProps {
  task: Task | null;
  onComplete: () => void;
  isCompleting: boolean;
}

export function CurrentTask({ task, onComplete, isCompleting }: CurrentTaskProps) {
  if (!task) {
    return (
      <section className="p-4 flex-shrink-0">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-4">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Aktuelle Aufgabe
            </span>
          </div>
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground" data-testid="text-no-active-task">
              Keine aktive Aufgabe. Fügen Sie eine neue Aufgabe hinzu, um zu beginnen.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  const formatDeadline = (deadline: Date | null) => {
    if (!deadline) return 'Keine Frist';
    
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Heute';
    if (days === 1) return 'Morgen';
    if (days < 7) return `In ${days} Tagen`;
    return deadline.toLocaleDateString('de-DE');
  };

  return (
    <section className="p-4 flex-shrink-0">
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Aktuelle Aufgabe
            </span>
          </div>
          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span data-testid="text-remaining-time">
              {formatTime(task.remainingMinutes)}
            </span>
          </div>
        </div>
        
        <h2 className="text-lg font-semibold mb-2" data-testid="text-task-title">
          {task.title}
        </h2>
        
        <p className="text-sm text-muted-foreground leading-relaxed mb-4" data-testid="text-task-description">
          {task.description}
        </p>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span data-testid="text-task-deadline">
              {formatDeadline(task.deadline)}
            </span>
          </div>
          
          <button 
            onClick={onComplete}
            disabled={isCompleting}
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-complete-task"
          >
            <Check className="w-3 h-3 mr-1 inline" />
            {isCompleting ? 'Wird abgeschlossen...' : 'Abschließen'}
          </button>
        </div>
      </div>
    </section>
  );
}
