import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { chunkTaskRequestSchema, updateTaskSchema, createTokenRequestSchema } from "@shared/schema";
import { chunkTask, reprioritizeTasks } from "./services/openai";
import { TokenService } from "./services/token";
import { requireAuth, requireAdmin } from "./middleware/auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get tasks for a specific mode
  app.get("/api/tasks/:mode", requireAuth('read'), async (req, res) => {
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
  app.get("/api/tasks/:mode/active", requireAuth('read'), async (req, res) => {
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
  app.post("/api/tasks/chunk", requireAuth('write'), async (req, res) => {
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
          deadline: validatedData.deadline ? new Date(validatedData.deadline) : null,
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
  app.patch("/api/tasks/:id", requireAuth('write'), async (req, res) => {
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
  app.post("/api/tasks/:mode/activate", requireAuth('write'), async (req, res) => {
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
  app.post("/api/tasks/:mode/complete-current", requireAuth('write'), async (req, res) => {
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

  // Export tasks as CSV
  app.get("/api/tasks/:mode/export/csv", requireAuth('read'), async (req, res) => {
    try {
      const mode = req.params.mode as 'professional' | 'private';
      if (mode !== 'professional' && mode !== 'private') {
        return res.status(400).json({ error: "Mode must be 'professional' or 'private'" });
      }

      const allTasks = await storage.getTasks(mode);
      
      // CSV headers
      const headers = [
        'Title',
        'Description', 
        'Estimated Minutes',
        'Remaining Minutes',
        'Status',
        'Created At',
        'Completed At',
        'Duration (if completed)',
        'Mode'
      ];

      // Convert tasks to CSV rows
      const csvRows = allTasks.map(task => {
        const duration = task.completedAt && task.createdAt 
          ? Math.round((new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime()) / (1000 * 60))
          : '';
        
        return [
          `"${task.title.replace(/"/g, '""')}"`,
          `"${task.description.replace(/"/g, '""')}"`,
          task.estimatedMinutes,
          task.remainingMinutes,
          task.status,
          task.createdAt?.toISOString() || '',
          task.completedAt?.toISOString() || '',
          duration,
          task.mode
        ].join(',');
      });

      // Combine headers and rows
      const csvContent = [headers.join(','), ...csvRows].join('\n');

      // Set headers for file download
      const filename = `codex-cache-${mode}-tasks-${new Date().toISOString().split('T')[0]}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      res.send(csvContent);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      res.status(500).json({ error: "Failed to export CSV" });
    }
  });

  // Move unworkable task to end
  app.post("/api/tasks/:id/move-to-end", requireAuth('write'), async (req, res) => {
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
  app.post("/api/tasks/:mode/reprioritize", requireAuth('write'), async (req, res) => {
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

  // Token Management Routes
  
  // Create a new access token
  app.post("/api/tokens", requireAdmin, async (req, res) => {
    try {
      const tokenRequest = createTokenRequestSchema.parse(req.body);
      const accessToken = await TokenService.createToken(tokenRequest);
      
      // Clean up expired tokens while we're here
      await TokenService.cleanupExpiredTokens();
      
      // Generate the secure access URL
      const baseURL = `${req.protocol}://${req.get('host')}`;
      const accessURL = TokenService.generateAccessURL(accessToken.token, baseURL);
      
      res.json({
        id: accessToken.id,
        token: accessToken.token,
        permission: accessToken.permission,
        mode: accessToken.mode,
        expiresAt: accessToken.expiresAt,
        accessURL,
        createdAt: accessToken.createdAt,
      });
    } catch (error) {
      console.error("Error creating token:", error);
      res.status(500).json({ error: "Failed to create token" });
    }
  });

  // Validate a token (for debugging/admin purposes)
  app.post("/api/tokens/validate", requireAdmin, async (req, res) => {
    try {
      const { token, permission, mode } = req.body;
      const validation = await TokenService.validateToken(token, permission, mode);
      res.json(validation);
    } catch (error) {
      console.error("Error validating token:", error);
      res.status(500).json({ error: "Failed to validate token" });
    }
  });

  // Revoke a token
  app.delete("/api/tokens/:tokenId", requireAdmin, async (req, res) => {
    try {
      const tokenId = req.params.tokenId;
      const revoked = await storage.revokeToken(tokenId);
      
      if (revoked) {
        res.json({ success: true, message: "Token revoked successfully" });
      } else {
        res.status(404).json({ error: "Token not found" });
      }
    } catch (error) {
      console.error("Error revoking token:", error);
      res.status(500).json({ error: "Failed to revoke token" });
    }
  });

  // Clean up expired tokens
  app.post("/api/tokens/cleanup", requireAdmin, async (req, res) => {
    try {
      const deletedCount = await TokenService.cleanupExpiredTokens();
      res.json({ deletedCount, message: `Cleaned up ${deletedCount} expired tokens` });
    } catch (error) {
      console.error("Error cleaning up tokens:", error);
      res.status(500).json({ error: "Failed to cleanup tokens" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
