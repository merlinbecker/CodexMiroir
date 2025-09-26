const { describe, test, expect } = require('@jest/globals');

describe('Automerge Chore Logic', () => {
  describe('Label Detection', () => {
    test('should detect chore label', () => {
      const labels = ['chore', 'documentation'];
      const hasChoreLabel = labels.includes('chore');
      expect(hasChoreLabel).toBe(true);
    });

    test('should not detect chore label when not present', () => {
      const labels = ['bug', 'enhancement'];
      const hasChoreLabel = labels.includes('chore');
      expect(hasChoreLabel).toBe(false);
    });

    test('should handle empty labels array', () => {
      const labels = [];
      const hasChoreLabel = labels.includes('chore');
      expect(hasChoreLabel).toBe(false);
    });
  });

  describe('Issue Qualification Logic', () => {
    test('should qualify open issue with chore label', () => {
      const issue = { state: 'open', labels: [{ name: 'chore' }] };
      const labels = issue.labels.map(label => label.name);
      const hasChoreLabel = labels.includes('chore');
      const shouldProcess = issue.state === 'open' && hasChoreLabel;
      expect(shouldProcess).toBe(true);
    });

    test('should not qualify closed issue even with chore label', () => {
      const issue = { state: 'closed', labels: [{ name: 'chore' }] };
      const labels = issue.labels.map(label => label.name);
      const hasChoreLabel = labels.includes('chore');
      const shouldProcess = issue.state === 'open' && hasChoreLabel;
      expect(shouldProcess).toBe(false);
    });

    test('should not qualify open issue without chore label', () => {
      const issue = { state: 'open', labels: [{ name: 'bug' }] };
      const labels = issue.labels.map(label => label.name);
      const hasChoreLabel = labels.includes('chore');
      const shouldProcess = issue.state === 'open' && hasChoreLabel;
      expect(shouldProcess).toBe(false);
    });
  });

  describe('Copilot Detection Logic', () => {
    test('should detect copilot user by login', () => {
      const user = { login: 'copilot', type: 'Bot' };
      const isFromCopilot = user.login === 'copilot' || 
                           user.type === 'Bot';
      expect(isFromCopilot).toBe(true);
    });

    test('should detect copilot user by type', () => {
      const user = { login: 'github-actions[bot]', type: 'Bot' };
      const isFromCopilot = user.login === 'copilot' || 
                           user.type === 'Bot';
      expect(isFromCopilot).toBe(true);
    });

    test('should detect copilot mention in body', () => {
      const issueBody = 'This issue was created by @copilot for documentation';
      const isFromCopilot = issueBody.includes('@copilot');
      expect(isFromCopilot).toBe(true);
    });

    test('should detect copilot mention in title', () => {
      const issueTitle = 'Copilot suggestion: Update documentation';
      const isFromCopilot = issueTitle.toLowerCase().includes('copilot');
      expect(isFromCopilot).toBe(true);
    });

    test('should not detect copilot for regular user', () => {
      const user = { login: 'regular-user', type: 'User' };
      const issueBody = 'Regular issue without copilot';
      const issueTitle = 'Regular issue title';
      const isFromCopilot = user.login === 'copilot' || 
                           user.type === 'Bot' ||
                           issueBody.includes('@copilot') ||
                           issueTitle.toLowerCase().includes('copilot');
      expect(isFromCopilot).toBe(false);
    });
  });

  describe('Check Status Logic', () => {
    test('should consider PR ready when no failed checks', () => {
      const statuses = [];
      const checkRuns = [];

      const hasFailedStatuses = statuses.some(status => status.state === 'failure' || status.state === 'error');
      const hasFailedCheckRuns = checkRuns.some(run => 
        run.status === 'completed' && (run.conclusion === 'failure' || run.conclusion === 'cancelled')
      );
      
      const readyToMerge = !hasFailedStatuses && !hasFailedCheckRuns;
      expect(readyToMerge).toBe(true);
    });

    test('should not be ready when status checks fail', () => {
      const statuses = [
        { state: 'success' },
        { state: 'failure' }
      ];
      const checkRuns = [];

      const hasFailedStatuses = statuses.some(status => status.state === 'failure' || status.state === 'error');
      const hasFailedCheckRuns = checkRuns.some(run => 
        run.status === 'completed' && (run.conclusion === 'failure' || run.conclusion === 'cancelled')
      );
      
      const readyToMerge = !hasFailedStatuses && !hasFailedCheckRuns;
      expect(readyToMerge).toBe(false);
    });

    test('should not be ready when check runs fail', () => {
      const statuses = [];
      const checkRuns = [
        { status: 'completed', conclusion: 'success' },
        { status: 'completed', conclusion: 'failure' }
      ];

      const hasFailedStatuses = statuses.some(status => status.state === 'failure' || status.state === 'error');
      const hasFailedCheckRuns = checkRuns.some(run => 
        run.status === 'completed' && (run.conclusion === 'failure' || run.conclusion === 'cancelled')
      );
      
      const readyToMerge = !hasFailedStatuses && !hasFailedCheckRuns;
      expect(readyToMerge).toBe(false);
    });

    test('should be ready with successful checks', () => {
      const statuses = [
        { state: 'success' },
        { state: 'success' }
      ];
      const checkRuns = [
        { status: 'completed', conclusion: 'success' },
        { status: 'completed', conclusion: 'neutral' }
      ];

      const hasFailedStatuses = statuses.some(status => status.state === 'failure' || status.state === 'error');
      const hasFailedCheckRuns = checkRuns.some(run => 
        run.status === 'completed' && (run.conclusion === 'failure' || run.conclusion === 'cancelled')
      );
      
      const readyToMerge = !hasFailedStatuses && !hasFailedCheckRuns;
      expect(readyToMerge).toBe(true);
    });

    test('should handle pending checks gracefully', () => {
      const statuses = [{ state: 'pending' }];
      const checkRuns = [{ status: 'in_progress' }];

      const hasFailedStatuses = statuses.some(status => status.state === 'failure' || status.state === 'error');
      const hasFailedCheckRuns = checkRuns.some(run => 
        run.status === 'completed' && (run.conclusion === 'failure' || run.conclusion === 'cancelled')
      );
      
      const readyToMerge = !hasFailedStatuses && !hasFailedCheckRuns;
      expect(readyToMerge).toBe(true); // No failures = ready to merge
    });
  });

  describe('PR State Validation', () => {
    test('should not merge closed PR', () => {
      const pr = { state: 'closed', merged: false, draft: false };
      const isReady = pr.state === 'open' && !pr.merged && !pr.draft;
      expect(isReady).toBe(false);
    });

    test('should not merge already merged PR', () => {
      const pr = { state: 'open', merged: true, draft: false };
      const isReady = pr.state === 'open' && !pr.merged && !pr.draft;
      expect(isReady).toBe(false);
    });

    test('should not merge draft PR', () => {
      const pr = { state: 'open', merged: false, draft: true };
      const isReady = pr.state === 'open' && !pr.merged && !pr.draft;
      expect(isReady).toBe(false);
    });

    test('should merge open, non-draft, non-merged PR', () => {
      const pr = { state: 'open', merged: false, draft: false };
      const isReady = pr.state === 'open' && !pr.merged && !pr.draft;
      expect(isReady).toBe(true);
    });
  });
});