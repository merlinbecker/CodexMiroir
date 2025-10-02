// Main entry point for Azure Functions v4 Programming Model
import { app } from "@azure/functions";

// Import all functions
import "./assignToSlot.js";
import "./autoFill.js";
import "./createTask.js";
import "./deleteTask.js";
import "./getTask.js";
import "./getTimeline.js";
import "./prioritizeTask.js";
import "./serveStatic.js";
import "./updateTask.js";

export default app;
