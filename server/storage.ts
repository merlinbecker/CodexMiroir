import { type Task, type InsertTask, type UpdateTask } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Task management
  getTasks(mode: 'professional' | 'private'): Promise<Task[]>;
  getTaskById(id: string): Promise<Task | undefined>;
  getActiveTask(mode: 'professional' | 'private'): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, updates: UpdateTask): Promise<Task | undefined>;
  deleteTask(id: string): Promise<boolean>;
  reorderTasks(mode: 'professional' | 'private', taskIds: string[]): Promise<void>;
  getNextTaskOrder(mode: 'professional' | 'private'): Promise<number>;
}

export class MemStorage implements IStorage {
  private tasks: Map<string, Task>;

  constructor() {
    this.tasks = new Map();
  }

  async getTasks(mode: 'professional' | 'private'): Promise<Task[]> {
    return Array.from(this.tasks.values())
      .filter(task => task.mode === mode)
      .sort((a, b) => a.order - b.order);
  }

  async getTaskById(id: string): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async getActiveTask(mode: 'professional' | 'private'): Promise<Task | undefined> {
    return Array.from(this.tasks.values())
      .find(task => task.mode === mode && task.status === 'active');
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const id = randomUUID();
    const now = new Date();
    const task: Task = {
      ...insertTask,
      id,
      createdAt: now,
      completedAt: null,
      status: insertTask.status || 'pending',
    };
    this.tasks.set(id, task);
    return task;
  }

  async updateTask(id: string, updates: UpdateTask): Promise<Task | undefined> {
    const existingTask = this.tasks.get(id);
    if (!existingTask) return undefined;

    const updatedTask: Task = {
      ...existingTask,
      ...updates,
      completedAt: updates.status === 'completed' && !existingTask.completedAt 
        ? new Date() 
        : existingTask.completedAt,
    };

    this.tasks.set(id, updatedTask);
    return updatedTask;
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.tasks.delete(id);
  }

  async reorderTasks(mode: 'professional' | 'private', taskIds: string[]): Promise<void> {
    const tasks = await this.getTasks(mode);
    const taskMap = new Map(tasks.map(task => [task.id, task]));

    taskIds.forEach((taskId, index) => {
      const task = taskMap.get(taskId);
      if (task) {
        task.order = index;
        this.tasks.set(taskId, task);
      }
    });
  }

  async getNextTaskOrder(mode: 'professional' | 'private'): Promise<number> {
    const tasks = await this.getTasks(mode);
    const maxOrder = tasks.reduce((max, task) => Math.max(max, task.order), -1);
    return maxOrder + 1;
  }
}

export const storage = new MemStorage();
