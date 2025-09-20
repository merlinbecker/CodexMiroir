import { Scroll, Moon, Sun } from 'lucide-react';
import type { TaskMode } from '@/hooks/use-task-manager';

interface ModeToggleProps {
  currentMode: TaskMode;
  onModeChange: (mode: TaskMode) => void;
}

export function ModeToggle({ currentMode, onModeChange }: ModeToggleProps) {
  const isDarkMode = currentMode === 'professional';

  const handleToggle = () => {
    const newMode = isDarkMode ? 'private' : 'professional';
    onModeChange(newMode);
    
    // Update document class for theme
    if (newMode === 'professional') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <header className="p-4 border-b border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Scroll className="text-primary text-lg runic-icon" data-testid="logo-icon" />
          <h1 className="text-lg font-semibold" data-testid="app-title">Codex Caché</h1>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-xs text-muted-foreground" data-testid="mode-label-private">Privat</span>
          <button 
            onClick={handleToggle}
            className="relative inline-flex h-6 w-11 items-center rounded-full bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-all duration-300 ease-in-out"
            data-testid="button-mode-toggle"
            aria-label={`Switch to ${isDarkMode ? 'private' : 'professional'} mode`}
          >
            <span className="sr-only">Toggle mode</span>
            <span 
              className={`inline-block h-4 w-4 transform rounded-full bg-primary transition-transform duration-300 ease-in-out ${
                isDarkMode ? 'translate-x-6' : 'translate-x-1'
              }`}
              data-testid="toggle-indicator"
            />
          </button>
          <span className="text-xs text-muted-foreground" data-testid="mode-label-professional">Beruflich</span>
        </div>
      </div>
    </header>
  );
}
