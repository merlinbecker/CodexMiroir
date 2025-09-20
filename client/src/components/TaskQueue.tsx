import { ListOrdered, Calendar, Clock } from 'lucide-react';
import type { Task } from '@shared/schema';

interface TaskQueueProps {
  tasks: Task[];
  onMoveToEnd?: (taskId: string) => void;
}

export function TaskQueue({ tasks, onMoveToEnd }: TaskQueueProps) {
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
    <section className="flex-1 px-4 pb-4 overflow-hidden">
      <div className="flex items-center space-x-2 mb-3">
        <ListOrdered className="text-accent-foreground text-sm runic-icon" />
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Warteschlange
        </h3>
        <span className="text-xs text-muted-foreground" data-testid="text-queue-count">
          ({tasks.length} Aufgaben)
        </span>
      </div>
      
      {tasks.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground" data-testid="text-empty-queue">
            Keine Aufgaben in der Warteschlange.
          </p>
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto max-h-64" data-testid="container-task-queue">
          {tasks.map((task, index) => (
            <div 
              key={task.id} 
              className="bg-card border border-border rounded-md p-3"
              data-testid={`card-task-${task.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-xs text-muted-foreground font-mono">
                      #{index + 1}
                    </span>
                    <h4 className="text-sm font-medium" data-testid={`text-task-title-${task.id}`}>
                      {task.title}
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2" data-testid={`text-task-description-${task.id}`}>
                    {task.description}
                  </p>
                </div>
                <div className="flex flex-col items-end text-xs text-muted-foreground ml-2">
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span data-testid={`text-task-time-${task.id}`}>
                      {formatTime(task.estimatedMinutes)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1 mt-1">
                    <Calendar className="w-3 h-3" />
                    <span data-testid={`text-task-deadline-${task.id}`}>
                      {formatDeadline(task.deadline)}
                    </span>
                  </div>
                </div>
              </div>
              
              {onMoveToEnd && (
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={() => onMoveToEnd(task.id)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    data-testid={`button-move-to-end-${task.id}`}
                  >
                    Ans Ende verschieben
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
