import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key" 
});

export interface TaskChunk {
  title: string;
  description: string;
  estimatedMinutes: number;
}

export interface RepriorityRequest {
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    estimatedMinutes: number;
    deadline?: Date;
  }>;
}

export interface RepriorityResponse {
  reorderedTaskIds: string[];
  reasoning: string;
}

export async function chunkTask(title: string, description: string): Promise<TaskChunk[]> {
  try {
    const prompt = `
You are a task management AI. Break down the following task into smaller chunks, each taking approximately 3.5 hours (210 minutes) or less.

Task Title: ${title}
Task Description: ${description}

Please analyze this task and break it down into logical, actionable subtasks. Each subtask should:
1. Be completable in 3.5 hours or less
2. Have a clear, specific title
3. Include detailed description of what needs to be done
4. Be estimated in minutes

Respond with JSON in this exact format:
{
  "chunks": [
    {
      "title": "Specific subtask title",
      "description": "Detailed description of what to do",
      "estimatedMinutes": 210
    }
  ]
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result.chunks || [];
  } catch (error) {
    console.error("Error chunking task:", error);
    // Fallback: return original task if AI fails
    return [{
      title,
      description,
      estimatedMinutes: 210 // Default to 3.5 hours
    }];
  }
}

export async function reprioritizeTasks(request: RepriorityRequest): Promise<RepriorityResponse> {
  try {
    const prompt = `
You are a task prioritization AI. Analyze the following tasks and reorder them based on:
1. Urgency (deadline proximity)
2. Dependencies between tasks
3. Optimal workflow efficiency

Tasks:
${request.tasks.map((task, index) => `
${index + 1}. ID: ${task.id}
   Title: ${task.title}
   Description: ${task.description}
   Estimated Time: ${task.estimatedMinutes} minutes
   Deadline: ${task.deadline ? task.deadline.toISOString() : 'No deadline'}
`).join('\n')}

Reorder these tasks for optimal efficiency and deadline compliance. Respond with JSON in this exact format:
{
  "reorderedTaskIds": ["task-id-1", "task-id-2", "task-id-3"],
  "reasoning": "Brief explanation of the prioritization logic"
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return {
      reorderedTaskIds: result.reorderedTaskIds || request.tasks.map(t => t.id),
      reasoning: result.reasoning || "Unable to generate prioritization reasoning"
    };
  } catch (error) {
    console.error("Error reprioritizing tasks:", error);
    // Fallback: return original order
    return {
      reorderedTaskIds: request.tasks.map(t => t.id),
      reasoning: "Automatic prioritization failed, maintaining current order"
    };
  }
}
