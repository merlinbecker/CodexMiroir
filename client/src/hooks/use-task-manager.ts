import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { Task, ChunkTaskRequest } from '@shared/schema';

export type TaskMode = 'professional' | 'private';

export function useTaskManager() {
  const [currentMode, setCurrentMode] = useState<TaskMode>('professional');
  const queryClient = useQueryClient();

  // Get tasks for current mode
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ['/api/tasks', currentMode],
    staleTime: 30000, // Cache for 30 seconds
  });

  // Get active task for current mode
  const { data: activeTask, isLoading: activeTaskLoading } = useQuery<Task | null>({
    queryKey: ['/api/tasks', currentMode, 'active'],
    staleTime: 10000, // Cache for 10 seconds
  });

  // Add new task mutation
  const addTaskMutation = useMutation({
    mutationFn: async (request: ChunkTaskRequest) => {
      console.log('Adding task:', request);
      const response = await apiRequest('POST', '/api/tasks/chunk', request);
      console.log('Task added successfully');
      return response.json();
    },
    onSuccess: () => {
      console.log('Task mutation success, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', currentMode] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', currentMode, 'active'] });
    },
    onError: (error) => {
      console.error('Task mutation error:', error);
    },
  });

  // Complete current task mutation
  const completeTaskMutation = useMutation({
    mutationFn: async (mode: TaskMode) => {
      const response = await apiRequest('POST', `/api/tasks/${mode}/complete-current`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', currentMode] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', currentMode, 'active'] });
    },
  });

  // Export tasks as CSV
  const exportTasksCSV = useCallback(async (mode: TaskMode) => {
    try {
      const response = await fetch(`/api/tasks/${mode}/export/csv`);
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `codex-cache-${mode}-tasks-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
      throw error;
    }
  }, []);

  // Move task to end mutation
  const moveToEndMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await apiRequest('POST', `/api/tasks/${taskId}/move-to-end`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', currentMode] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', currentMode, 'active'] });
    },
  });

  // Reprioritize tasks mutation
  const reprioritizeMutation = useMutation({
    mutationFn: async (mode: TaskMode) => {
      const response = await apiRequest('POST', `/api/tasks/${mode}/reprioritize`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', currentMode] });
    },
  });

  // Auto-reprioritize every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (Array.isArray(tasks) && tasks.length > 1 && !reprioritizeMutation.isPending) {
        reprioritizeMutation.mutate(currentMode);
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [currentMode, tasks.length]); // Remove reprioritizeMutation from dependencies

  const addTask = useCallback((title: string, description: string) => {
    addTaskMutation.mutate({
      title,
      description,
      mode: currentMode,
    });
  }, [currentMode, addTaskMutation]);

  const completeCurrentTask = useCallback(() => {
    completeTaskMutation.mutate(currentMode);
  }, [currentMode, completeTaskMutation]);

  const moveTaskToEnd = useCallback((taskId: string) => {
    moveToEndMutation.mutate(taskId);
  }, [moveToEndMutation]);

  const pendingTasks = Array.isArray(tasks) ? tasks.filter((task: Task) => task.status === 'pending') : [];

  return {
    currentMode,
    setCurrentMode,
    activeTask,
    pendingTasks,
    isLoading: tasksLoading || activeTaskLoading,
    addTask,
    completeCurrentTask,
    moveTaskToEnd,
    exportTasksCSV,
    isAddingTask: addTaskMutation.isPending,
    isCompletingTask: completeTaskMutation.isPending,
    isReprioritizing: reprioritizeMutation.isPending,
  };
}
