
import { app } from "@azure/functions";
import { getTextBlob, putTextBlob } from "../shared/storage.js";

const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const BRANCH = process.env.GITHUB_DEFAULT_BRANCH || process.env.GITHUB_BRANCH || "main";
const TOKEN = process.env.GITHUB_TOKEN;
const BASE = (process.env.GITHUB_BASE_PATH || "codex-miroir").replace(/\/+$/, "");

const COMMITTER = {
  name: process.env.GITHUB_COMMITTER_NAME || "Codex Miroir Bot",
  email: process.env.GITHUB_COMMITTER_EMAIL || "bot@example.com"
};

function b64(s) {
  return Buffer.from(s, "utf8").toString("base64");
}

async function gh(url, method = "GET", body) {
  const r = await fetch(`https://api.github.com${url}`, {
    method,
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "User-Agent": "codex-miroir",
      "Accept": "application/vnd.github.v3+json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`GitHub ${r.status} ${url} :: ${txt}`);
  }
  
  return r.json();
}

// Parse existing Markdown and update fields
function updateMarkdown(existingMd, updates) {
  const lines = existingMd.split('\n');
  const yamlStart = lines.indexOf('---');
  const yamlEnd = lines.indexOf('---', yamlStart + 1);
  
  if (yamlStart === -1 || yamlEnd === -1) {
    throw new Error("Invalid markdown format: missing YAML frontmatter");
  }
  
  const yamlLines = lines.slice(yamlStart + 1, yamlEnd);
  const bodyLines = lines.slice(yamlEnd + 1);
  
  // Update YAML fields
  const newYaml = yamlLines.map(line => {
    if (updates.kategorie && line.startsWith('kategorie:')) {
      return `kategorie: ${updates.kategorie}`;
    }
    if (updates.status && line.startsWith('status:')) {
      return `status: ${updates.status}`;
    }
    if (updates.hasOwnProperty('deadline') && line.startsWith('deadline:')) {
      return `deadline: ${updates.deadline || 'null'}`;
    }
    if (updates.tags && line.startsWith('tags:')) {
      return `tags: [${updates.tags.join(', ')}]`;
    }
    return line;
  });
  
  // Handle fixedSlot updates
  if (updates.fixedSlot !== undefined) {
    const fixedSlotIndex = newYaml.findIndex(l => l.includes('fixedSlot:'));
    if (updates.fixedSlot === null) {
      // Remove fixedSlot
      if (fixedSlotIndex !== -1) {
        newYaml.splice(fixedSlotIndex, 3); // Remove fixedSlot and its sub-fields
      }
      newYaml.push('fixedSlot: null');
    } else {
      // Update or add fixedSlot
      if (fixedSlotIndex !== -1) {
        newYaml.splice(fixedSlotIndex, 3);
      }
      newYaml.push(`fixedSlot:`);
      newYaml.push(`  datum: ${updates.fixedSlot.datum}`);
      newYaml.push(`  zeit: ${updates.fixedSlot.zeit}`);
    }
  }
  
  // Update body if provided
  const finalBody = updates.body !== undefined ? updates.body : bodyLines.join('\n');
  
  return ['---', ...newYaml, '---', '', finalBody].join('\n');
}

app.http("updateTask", {
  methods: ["PUT", "PATCH"],
  authLevel: "function",
  route: "api/tasks/{id}",
  handler: async (request, context) => {
    try {
      const id = request.params.id;
      const updates = await request.json();
      const path = `${BASE}/tasks/${id}.md`;
      
      // Get current file from GitHub
      const fileData = await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${BRANCH}`);
      const currentMd = Buffer.from(fileData.content, 'base64').toString('utf8');
      
      // Update markdown
      const newMd = updateMarkdown(currentMd, updates);
      
      // Commit back to GitHub
      const message = `[codex] update task ${id}`;
      const result = await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`, "PUT", {
        message,
        content: b64(newMd),
        sha: fileData.sha,
        branch: BRANCH,
        committer: COMMITTER
      });
      
      // Update cache
      await putTextBlob(`raw/tasks/${id}.md`, newMd, "text/markdown");
      
      return {
        status: 200,
        jsonBody: {
          ok: true,
          id,
          commitSha: result.commit.sha,
          htmlUrl: result.content.html_url
        }
      };
      
    } catch (e) {
      context.error(e);
      return {
        status: 500,
        jsonBody: { ok: false, error: String(e.message || e) }
      };
    }
  }
});
