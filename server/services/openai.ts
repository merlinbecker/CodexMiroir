import OpenAI from "openai";

// Using GPT-4 for reliable performance
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
    // Add timeout wrapper
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('OpenAI request timeout')), 10000); // 10 second timeout
    });

    const prompt = `
You are a task management AI. Analyze the following task and determine if it needs to be broken down into smaller chunks.

Task Title: ${title}
Task Description: ${description}

Guidelines:
1. If the task is simple and can be completed in 3.5 hours or less, return it as a single chunk unchanged
2. Only break down complex tasks that clearly require multiple distinct phases or steps
3. Each chunk should be completable in 3.5 hours or less
4. Each chunk should have a clear, specific title and detailed description

Examples of simple tasks that should NOT be chunked:
- "Buy groceries"
- "Test single task" 
- "Call John about meeting"
- "Write email to team"

Examples of complex tasks that SHOULD be chunked:
- "Plan comprehensive website redesign project"
- "Develop marketing campaign strategy"
- "Plan team meeting agenda" 

Respond with JSON in this exact format:
{
  "chunks": [
    {
      "title": "Specific subtask title",
      "description": "Detailed description of what to do",
      "estimatedMinutes": 120
    }
  ]
}
`;

    const openaiPromise = openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const response = await Promise.race([openaiPromise, timeoutPromise]);
    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result.chunks || [];
  } catch (error) {
    console.error("Error chunking task:", error);
    // Fallback: return original task if AI fails or times out
    return [{
      title,
      description,
      estimatedMinutes: 210 // Default to 3.5 hours
    }];
  }
}

export async function reprioritizeTasks(request: RepriorityRequest): Promise<RepriorityResponse> {
  try {
    // Add timeout wrapper for reprioritization too
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('OpenAI reprioritization timeout')), 8000); // 8 second timeout
    });

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

    const openaiPromise = openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const response = await Promise.race([openaiPromise, timeoutPromise]);
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
