import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { chunkTaskRequestSchema, updateTaskSchema } from "@shared/schema";
import { chunkTask, reprioritizeTasks } from "./services/openai";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get tasks for a specific mode
  app.get("/api/tasks/:mode", async (req, res) => {
    try {
      const mode = req.params.mode as 'professional' | 'private';
      if (mode !== 'professional' && mode !== 'private') {
        return res.status(400).json({ error: "Mode must be 'professional' or 'private'" });
      }
      
      const tasks = await storage.getTasks(mode);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  // Get active task for a mode
  app.get("/api/tasks/:mode/active", async (req, res) => {
    try {
      const mode = req.params.mode as 'professional' | 'private';
      if (mode !== 'professional' && mode !== 'private') {
        return res.status(400).json({ error: "Mode must be 'professional' or 'private'" });
      }
      
      const activeTask = await storage.getActiveTask(mode);
      res.json(activeTask || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active task" });
    }
  });

  // Add new task with chunking
  app.post("/api/tasks/chunk", async (req, res) => {
    try {
      const validatedData = chunkTaskRequestSchema.parse(req.body);
      
      // Use OpenAI to chunk the task
      const chunks = await chunkTask(validatedData.title, validatedData.description);
      
      // Get next order for the mode
      const nextOrder = await storage.getNextTaskOrder(validatedData.mode);
      
      // Create tasks for each chunk, preserving original title context
      const createdTasks = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const displayTitle = chunks.length > 1 
          ? `${validatedData.title} — ${chunk.title}`
          : chunk.title;
        const task = await storage.createTask({
          title: displayTitle,
          description: chunk.description,
          estimatedMinutes: chunk.estimatedMinutes,
          remainingMinutes: chunk.estimatedMinutes,
          mode: validatedData.mode,
          status: 'pending',
          order: nextOrder + i,
          deadline: null,
        });
        createdTasks.push(task);
      }
      
      // Auto-activate first task if no active task exists
      const activeTask = await storage.getActiveTask(validatedData.mode);
      if (!activeTask && createdTasks.length > 0) {
        await storage.updateTask(createdTasks[0].id, { status: 'active' });
      }
      
      res.json(createdTasks);
    } catch (error) {
      console.error("Error creating chunked tasks:", error);
      res.status(500).json({ error: "Failed to create tasks" });
    }
  });

  // Update task
  app.patch("/api/tasks/:id", async (req, res) => {
    try {
      const taskId = req.params.id;
      const updates = updateTaskSchema.parse(req.body);
      
      const updatedTask = await storage.updateTask(taskId, updates);
      if (!updatedTask) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      res.json(updatedTask);
    } catch (error) {
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // Manually activate a specific task
  app.post("/api/tasks/:mode/activate", async (req, res) => {
    try {
      const mode = req.params.mode as 'professional' | 'private';
      const { taskId } = req.body;
      
      if (mode !== 'professional' && mode !== 'private') {
        return res.status(400).json({ error: "Mode must be 'professional' or 'private'" });
      }
      
      if (!taskId) {
        return res.status(400).json({ error: "taskId is required" });
      }
      
      // Get the task to ensure it exists and is in the right mode
      const task = await storage.getTaskById(taskId);
      if (!task || task.mode !== mode) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      // Deactivate current active task
      const currentActive = await storage.getActiveTask(mode);
      if (currentActive) {
        await storage.updateTask(currentActive.id, { status: 'pending' });
      }
      
      // Activate the new task
      await storage.updateTask(taskId, { status: 'active' });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error activating task:", error);
      res.status(500).json({ error: "Failed to activate task" });
    }
  });

  // Complete current task and activate next
  app.post("/api/tasks/:mode/complete-current", async (req, res) => {
    try {
      const mode = req.params.mode as 'professional' | 'private';
      if (mode !== 'professional' && mode !== 'private') {
        return res.status(400).json({ error: "Mode must be 'professional' or 'private'" });
      }
      
      // Get current active task
      const activeTask = await storage.getActiveTask(mode);
      if (activeTask) {
        await storage.updateTask(activeTask.id, { 
          status: 'completed',
          completedAt: new Date()
        });
      }
      
      // Get next pending task and activate it
      const pendingTasks = await storage.getTasks(mode);
      const nextTask = pendingTasks.find(task => task.status === 'pending');
      
      if (nextTask) {
        await storage.updateTask(nextTask.id, { status: 'active' });
      }
      
      res.json({ success: true, nextTask: nextTask || null });
    } catch (error) {
      res.status(500).json({ error: "Failed to complete task" });
    }
  });

  // Move unworkable task to end
  app.post("/api/tasks/:id/move-to-end", async (req, res) => {
    try {
      const taskId = req.params.id;
      const task = await storage.getTaskById(taskId);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      // Get max order for the mode and set task to end
      const nextOrder = await storage.getNextTaskOrder(task.mode as 'professional' | 'private');
      await storage.updateTask(taskId, { 
        order: nextOrder,
        status: 'pending'
      });
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to move task" });
    }
  });

  // Auto-reprioritize tasks based on deadlines
  app.post("/api/tasks/:mode/reprioritize", async (req, res) => {
    try {
      const mode = req.params.mode as 'professional' | 'private';
      if (mode !== 'professional' && mode !== 'private') {
        return res.status(400).json({ error: "Mode must be 'professional' or 'private'" });
      }
      
      const tasks = await storage.getTasks(mode);
      const pendingTasks = tasks.filter(task => task.status === 'pending');
      
      if (pendingTasks.length <= 1) {
        return res.json({ message: "No reprioritization needed" });
      }
      
      const repriorityResult = await reprioritizeTasks({
        tasks: pendingTasks.map(task => ({
          id: task.id,
          title: task.title,
          description: task.description,
          estimatedMinutes: task.estimatedMinutes,
          deadline: task.deadline || undefined,
        }))
      });
      
      // Apply new order
      await storage.reorderTasks(mode, repriorityResult.reorderedTaskIds);
      
      res.json({
        success: true,
        reasoning: repriorityResult.reasoning
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to reprioritize tasks" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
