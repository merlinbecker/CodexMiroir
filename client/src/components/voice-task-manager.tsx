import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Volume2, Settings } from 'lucide-react';
import { voiceCodexAPI } from '@/lib/voice-codex-api';
import { useToast } from '@/hooks/use-toast';

interface Task {
  slot: string;
  task: string;
  category: string;
  deadline: string;
}

interface VoiceTaskManagerProps {
  list: 'pro' | 'priv';
  className?: string;
}

export function VoiceTaskManager({ list, className }: VoiceTaskManagerProps) {
  const [isListening, setIsListening] = useState(false);
  const [currentTask, setCurrentTask] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const { toast } = useToast();

  // Load current tasks and current task on mount
  useEffect(() => {
    loadTasks();
    loadCurrentTask();
  }, [list]);

  const loadTasks = async () => {
    try {
      setIsLoading(true);
      const result = await voiceCodexAPI.getTasks(list);
      setTasks(result.tasks || []);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      toast({
        title: 'Fehler',
        description: 'Aufgaben konnten nicht geladen werden.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadCurrentTask = async () => {
    try {
      const result = await voiceCodexAPI.getCurrentTaskForVoice(list);
      setCurrentTask(result);
    } catch (error) {
      console.error('Failed to load current task:', error);
    }
  };

  const startVoiceRecognition = () => {
    try {
      const newRecognition = voiceCodexAPI.startVoiceRecognition(
        async (text) => {
          setIsListening(false);
          await processVoiceCommand(text);
        },
        (error) => {
          setIsListening(false);
          console.error('Voice recognition error:', error);
          toast({
            title: 'Spracherkennung fehlgeschlagen',
            description: 'Bitte versuche es erneut.',
            variant: 'destructive'
          });
        }
      );
      
      setRecognition(newRecognition);
      setIsListening(true);
      
      toast({
        title: 'Höre zu...',
        description: 'Sage deinen Befehl jetzt.'
      });
    } catch (error) {
      toast({
        title: 'Spracherkennung nicht verfügbar',
        description: 'Dein Browser unterstützt keine Spracherkennung.',
        variant: 'destructive'
      });
    }
  };

  const stopVoiceRecognition = () => {
    if (recognition) {
      recognition.stop();
      setRecognition(null);
    }
    setIsListening(false);
  };

  const processVoiceCommand = async (text: string) => {
    try {
      setIsLoading(true);
      const result = await voiceCodexAPI.processVoiceCommandAndExecute(text, list);
      
      toast({
        title: 'Befehl ausgeführt',
        description: result.response || 'Befehl wurde verarbeitet.'
      });

      // Refresh data if a task was created, completed, or moved
      if (result.executed && ['create_task', 'complete_task', 'push_to_end'].includes(result.intent)) {
        await loadTasks();
        await loadCurrentTask();
      }
      
      return result;
    } catch (error) {
      console.error('Voice command processing failed:', error);
      toast({
        title: 'Befehl fehlgeschlagen',
        description: 'Der Sprachbefehl konnte nicht verarbeitet werden.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const speakCurrentTask = () => {
    if (currentTask?.voiceResponse) {
      voiceCodexAPI.speakResponse(currentTask.voiceResponse);
    } else {
      voiceCodexAPI.speakResponse('Keine aktuelle Aufgabe gefunden.');
    }
  };

  const getThemeClasses = () => {
    return list === 'pro' 
      ? 'bg-gray-900 text-white border-gray-700' // Dark theme for professional
      : 'bg-white text-gray-900 border-gray-200'; // Light theme for private
  };

  const getAccentColor = () => {
    return list === 'pro' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700';
  };

  return (
    <div className={`${className} ${getThemeClasses()} rounded-lg p-6 space-y-6`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {list === 'pro' ? '💼 Berufliche Aufgaben' : '🏠 Private Aufgaben'}
        </h2>
        <div className="flex gap-2">
          <Button
            onClick={isListening ? stopVoiceRecognition : startVoiceRecognition}
            className={`${getAccentColor()} text-white`}
            disabled={isLoading}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {isListening ? 'Stop' : 'Sprache'}
          </Button>
          <Button
            onClick={speakCurrentTask}
            variant="outline"
            disabled={!currentTask?.hasTask}
          >
            <Volume2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Current Task - Prominent Display */}
      {currentTask?.hasTask ? (
        <Card className={`border-2 ${list === 'pro' ? 'border-blue-500' : 'border-green-500'}`}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>🎯 Aktuelle Aufgabe</span>
              <Badge variant={list === 'pro' ? 'default' : 'secondary'}>
                {currentTask.currentTask.slot}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <h3 className="text-xl font-semibold mb-2">
              {currentTask.currentTask.task}
            </h3>
            {currentTask.currentTask.category && (
              <p className="text-sm opacity-75 mb-1">
                Kategorie: {currentTask.currentTask.category}
              </p>
            )}
            {currentTask.currentTask.deadline && (
              <p className="text-sm opacity-75">
                Deadline: {currentTask.currentTask.deadline}
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="text-center py-8">
            <p className="text-lg opacity-75">
              Keine aktuelle Aufgabe geplant
            </p>
            <p className="text-sm opacity-50 mt-2">
              Sage "Erstelle Aufgabe: [Titel]" um eine neue Aufgabe zu erstellen
            </p>
          </CardContent>
        </Card>
      )}

      {/* Voice Commands Help */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🎤 Sprachbefehle</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div>
              <strong>"Erstelle Aufgabe: [Titel]"</strong>
              <br />
              <span className="opacity-75">Neue Aufgabe erstellen</span>
            </div>
            <div>
              <strong>"Aufgabe abschließen"</strong>
              <br />
              <span className="opacity-75">Aktuelle Aufgabe beenden</span>
            </div>
            <div>
              <strong>"Aufgabe verschieben"</strong>
              <br />
              <span className="opacity-75">Aufgabe ans Ende schieben</span>
            </div>
            <div>
              <strong>"Status anzeigen"</strong>
              <br />
              <span className="opacity-75">Aktuellen Status abrufen</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task Queue */}
      {tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📋 Warteschlange ({tasks.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tasks.map((task, index) => (
                <div
                  key={index}
                  className={`p-3 rounded border ${
                    index === 0 
                      ? `border-2 ${list === 'pro' ? 'border-blue-500' : 'border-green-500'} opacity-100` 
                      : 'border-gray-300 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{task.task}</span>
                    <div className="flex gap-2">
                      {task.category && (
                        <Badge variant="outline" className="text-xs">
                          {task.category}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {task.slot}
                      </Badge>
                    </div>
                  </div>
                  {task.deadline && (
                    <p className="text-xs opacity-75 mt-1">
                      Deadline: {task.deadline}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-current"></div>
          <p className="mt-2 text-sm opacity-75">Verarbeite...</p>
        </div>
      )}
    </div>
  );
}