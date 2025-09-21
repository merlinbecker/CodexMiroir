import { type Task, type InsertTask, type UpdateTask, type AccessToken, type InsertAccessToken, tasks, accessTokens } from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, lt } from "drizzle-orm";

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
  
  // Token management
  createAccessToken(token: InsertAccessToken): Promise<AccessToken>;
  getAccessToken(token: string): Promise<AccessToken | undefined>;
  updateTokenLastUsed(token: string): Promise<void>;
  deleteExpiredTokens(): Promise<number>;
  revokeToken(tokenId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getTasks(mode: 'professional' | 'private'): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.mode, mode))
      .orderBy(tasks.order);
  }

  async getTaskById(id: string): Promise<Task | undefined> {
    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id));
    return task || undefined;
  }

  async getActiveTask(mode: 'professional' | 'private'): Promise<Task | undefined> {
    const [activeTask] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.mode, mode), eq(tasks.status, 'active')));
    return activeTask || undefined;
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const [task] = await db
      .insert(tasks)
      .values(insertTask)
      .returning();
    return task;
  }

  async updateTask(id: string, updates: UpdateTask): Promise<Task | undefined> {
    // Add completedAt timestamp when status changes to completed
    const updateData = { ...updates };
    if (updates.status === 'completed' && !updates.completedAt) {
      updateData.completedAt = new Date();
    }

    const [updatedTask] = await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id))
      .returning();
    return updatedTask || undefined;
  }

  async deleteTask(id: string): Promise<boolean> {
    const result = await db
      .delete(tasks)
      .where(eq(tasks.id, id))
      .returning({ id: tasks.id });
    return result.length > 0;
  }

  async reorderTasks(mode: 'professional' | 'private', taskIds: string[]): Promise<void> {
    // Update each task's order based on its position in the taskIds array
    for (let i = 0; i < taskIds.length; i++) {
      await db
        .update(tasks)
        .set({ order: i })
        .where(and(eq(tasks.id, taskIds[i]), eq(tasks.mode, mode)));
    }
  }

  async getNextTaskOrder(mode: 'professional' | 'private'): Promise<number> {
    const [result] = await db
      .select({ maxOrder: tasks.order })
      .from(tasks)
      .where(eq(tasks.mode, mode))
      .orderBy(desc(tasks.order))
      .limit(1);
    
    return (result?.maxOrder ?? -1) + 1;
  }

  // Token management methods
  async createAccessToken(token: InsertAccessToken): Promise<AccessToken> {
    const [accessToken] = await db
      .insert(accessTokens)
      .values(token)
      .returning();
    return accessToken;
  }

  async getAccessToken(token: string): Promise<AccessToken | undefined> {
    const [accessToken] = await db
      .select()
      .from(accessTokens)
      .where(eq(accessTokens.token, token));
    return accessToken || undefined;
  }

  async updateTokenLastUsed(token: string): Promise<void> {
    await db
      .update(accessTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(accessTokens.token, token));
  }

  async deleteExpiredTokens(): Promise<number> {
    const result = await db
      .delete(accessTokens)
      .where(lt(accessTokens.expiresAt, new Date()))
      .returning({ id: accessTokens.id });
    return result.length;
  }

  async revokeToken(tokenId: string): Promise<boolean> {
    const result = await db
      .delete(accessTokens)
      .where(eq(accessTokens.id, tokenId))
      .returning({ id: accessTokens.id });
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
