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