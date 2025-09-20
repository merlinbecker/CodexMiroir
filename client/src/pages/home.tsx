import { useEffect } from 'react';
import { ModeToggle } from '@/components/ModeToggle';
import { CurrentTask } from '@/components/CurrentTask';
import { TaskQueue } from '@/components/TaskQueue';
import { TaskInput } from '@/components/TaskInput';
import { useTaskManager } from '@/hooks/use-task-manager';

export default function Home() {
  const {
    currentMode,
    setCurrentMode,
    activeTask,
    pendingTasks,
    isLoading,
    addTask,
    completeCurrentTask,
    moveTaskToEnd,
    isAddingTask,
    isCompletingTask,
  } = useTaskManager();

  // Initialize theme based on current mode
  useEffect(() => {
    if (currentMode === 'professional') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [currentMode]);

  // Register service worker for PWA
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-sm mx-auto min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground" data-testid="text-loading">
            Lade Aufgaben...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto min-h-screen flex flex-col bg-background text-foreground transition-all duration-300 ease-in-out">
      <ModeToggle 
        currentMode={currentMode} 
        onModeChange={setCurrentMode}
      />
      
      <CurrentTask 
        task={activeTask || null}
        onComplete={completeCurrentTask}
        isCompleting={isCompletingTask}
      />
      
      <TaskQueue 
        tasks={pendingTasks}
        onMoveToEnd={moveTaskToEnd}
      />
      
      <TaskInput 
        currentMode={currentMode}
        onAddTask={addTask}
        isAddingTask={isAddingTask}
      />
    </div>
  );
}
