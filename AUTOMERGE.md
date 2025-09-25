# Automerge for Chore PRs

This repository is configured to automatically merge Pull Requests labeled with "chore" once all required checks pass.

## How it works

1. **Labeling**: PRs labeled with "chore" are automatically eligible for automerge
2. **Checks**: The automerge workflow waits for all checks to complete and ensures none are failing
3. **Quality Analysis**: SonarCloud quality analysis is automatically skipped for chore PRs to speed up the process
4. **Merge**: Once all conditions are met, the PR is automatically merged using squash merge

## What qualifies as a chore PR

Chore PRs typically include:
- Documentation updates
- Code formatting changes
- Dependency updates
- Configuration file updates
- Non-functional code changes (refactoring without behavior changes)

## Workflow behavior

### SonarCloud Quality Analysis
- **Regular PRs**: Full quality analysis with radar charts and metrics
- **Chore PRs**: Skipped to avoid unnecessary overhead for non-functional changes

### Automerge Conditions
- PR must be labeled with "chore"
- PR must be open (not draft, not already merged)
- PR must have no merge conflicts
- No status checks can be failing
- No check runs can be failing or cancelled

### Merge Method
- Chore PRs are merged using **squash merge** to maintain a clean commit history
- Commit message format: `Auto-merge: [Original PR Title]`
- A comment is added to the PR indicating it was automatically merged

## Manual override

If you need to prevent automerge for a chore PR:
1. Remove the "chore" label
2. Convert to draft status
3. The automerge workflow will skip the PR

## Troubleshooting

If automerge fails:
- Check the Actions tab for detailed error messages
- Ensure all failing checks are resolved
- Verify the PR is not in draft status
- Confirm there are no merge conflicts