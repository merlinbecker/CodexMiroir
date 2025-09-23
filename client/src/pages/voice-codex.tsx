import React, { useState } from 'react';
import { VoiceTaskManager } from '@/components/voice-task-manager';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Moon, Sun, Mic, Zap } from 'lucide-react';

export default function VoiceCodexMiroir() {
  const [currentMode, setCurrentMode] = useState<'pro' | 'priv'>('pro');
  const [isDarkMode, setIsDarkMode] = useState(true);

  const toggleMode = () => {
    const newMode = currentMode === 'pro' ? 'priv' : 'pro';
    setCurrentMode(newMode);
    setIsDarkMode(newMode === 'pro'); // Dark for pro, light for priv
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'
    }`}>
      {/* Header */}
      <header className={`border-b ${
        isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
      } px-6 py-4`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold">
              🪞 Codex Miroir
            </h1>
            <span className="text-sm opacity-75 bg-blue-600 text-white px-2 py-1 rounded">
              Voice-Enhanced Migration
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Mode Toggle */}
            <div className="flex items-center space-x-3">
              <Sun className="w-4 h-4" />
              <Switch
                checked={isDarkMode}
                onCheckedChange={toggleMode}
                aria-label="Toggle mode"
              />
              <Moon className="w-4 h-4" />
            </div>
            
            <div className="text-right">
              <p className="font-medium">
                {currentMode === 'pro' ? '💼 Beruflich' : '🏠 Privat'}
              </p>
              <p className="text-xs opacity-75">
                {currentMode === 'pro' ? 'Dark Theme' : 'Light Theme'}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Migration Info Banner */}
        <Card className={`mb-8 ${
          isDarkMode ? 'bg-blue-900 border-blue-700' : 'bg-blue-50 border-blue-200'
        }`}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="w-5 h-5" />
              <span>Migration zu Azure Functions + Voice Interface</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <h4 className="font-semibold mb-1">✅ Phase 1 - Foundation</h4>
                <p className="opacity-75">Azure Functions mit 5 Core-Endpunkten</p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">✅ Phase 2 - Voice & AI</h4>
                <p className="opacity-75">Sprachbefehle mit OpenAI Integration</p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">🚧 Phase 3 - Frontend</h4>
                <p className="opacity-75">Voice-First Interface (Demo)</p>
              </div>
            </div>
            <div className="mt-4 p-3 rounded bg-black bg-opacity-20">
              <p className="text-xs">
                <strong>Backend:</strong> Azure Functions mit 8 Endpunkten (createTask, completeTask, pushToEnd, report, when, processCommand, decomposeTask, getCurrentTask)
                <br />
                <strong>Voice:</strong> Web Speech API mit deutschen Sprachbefehlen und OpenAI GPT-4 Integration
                <br />
                <strong>Storage:</strong> Azure Blob Storage mit Markdown-basierten Task-Dateien
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Voice Task Manager */}
        <VoiceTaskManager 
          list={currentMode} 
          className="mb-8"
        />

        {/* Feature Overview */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className={isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Mic className="w-5 h-5" />
                <span>Voice Features</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h4 className="font-semibold">🎯 Unterstützte Befehle</h4>
                <ul className="text-sm space-y-1 mt-1 opacity-75">
                  <li>• "Erstelle Aufgabe: [Titel]"</li>
                  <li>• "Aktuelle Aufgabe abschließen"</li>
                  <li>• "Aufgabe verschieben"</li>
                  <li>• "Status anzeigen"</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold">🤖 AI Integration</h4>
                <ul className="text-sm space-y-1 mt-1 opacity-75">
                  <li>• OpenAI GPT-4 für Sprachverständnis</li>
                  <li>• Automatische Task-Kategorisierung</li>
                  <li>• Fallback auf Pattern Matching</li>
                  <li>• Deutsche Antworten</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className={isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}>
            <CardHeader>
              <CardTitle>📋 FIFO Workflow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h4 className="font-semibold">⏰ Slot System</h4>
                <ul className="text-sm space-y-1 mt-1 opacity-75">
                  <li>• Beruflich: Mo-Fr, 2 Slots/Tag (9-12:30, 13:30-17)</li>
                  <li>• Privat: Mo-Fr Abends + Wochenende</li>
                  <li>• Jeder Slot = 3,5 Stunden</li>
                  <li>• Strikte FIFO-Reihenfolge</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold">📊 Datenformat</h4>
                <ul className="text-sm space-y-1 mt-1 opacity-75">
                  <li>• Markdown-basierte Speicherung</li>
                  <li>• Europäisches Datumsformat (dd.mm.yyyy)</li>
                  <li>• YAML Frontmatter für Metadaten</li>
                  <li>• Azure Blob Storage</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* API Status */}
        <Card className={`mt-6 ${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <CardHeader>
            <CardTitle>🔗 API Endpoints Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="space-y-1">
                <span className="text-green-500">✅ createTask</span>
                <br />
                <span className="text-green-500">✅ completeTask</span>
              </div>
              <div className="space-y-1">
                <span className="text-green-500">✅ pushToEnd</span>
                <br />
                <span className="text-green-500">✅ report</span>
              </div>
              <div className="space-y-1">
                <span className="text-green-500">✅ when</span>
                <br />
                <span className="text-green-500">✅ processCommand</span>
              </div>
              <div className="space-y-1">
                <span className="text-green-500">✅ decomposeTask</span>
                <br />
                <span className="text-green-500">✅ getCurrentTask</span>
              </div>
            </div>
            <div className="mt-4 p-3 rounded bg-green-500 bg-opacity-10 border border-green-500 border-opacity-20">
              <p className="text-sm text-green-400">
                Alle 8 Azure Functions Endpunkte implementiert und einsatzbereit.
                Backend-Migration abgeschlossen, bereit für Production-Deployment.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}