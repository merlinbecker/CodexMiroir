# Automerge for Chore PRs and Issues

This repository is configured to automatically handle Pull Requests and Issues labeled with "chore".

## How it works

### For Pull Requests
1. **Labeling**: PRs labeled with "chore" are automatically eligible for automerge
2. **Checks**: The automerge workflow waits for all checks to complete and ensures none are failing
3. **Quality Analysis**: SonarCloud quality analysis is automatically skipped for chore PRs to speed up the process
4. **Merge**: Once all conditions are met, the PR is automatically merged using squash merge

### For Issues
1. **Labeling**: Issues labeled with "chore" are automatically processed
2. **Detection**: System detects if the issue is from GitHub Copilot or contains copilot-related content
3. **Processing**: Chore issues are automatically closed with an explanatory comment
4. **Efficiency**: This prevents chore issues from cluttering the issue tracker while maintaining audit trail

## What qualifies as a chore PR or Issue

### Chore PRs typically include:
- Documentation updates
- Code formatting changes
- Dependency updates
- Configuration file updates
- Non-functional code changes (refactoring without behavior changes)

### Chore Issues typically include:
- GitHub Copilot-generated documentation requests
- Maintenance task suggestions
- Routine cleanup recommendations
- Automated issue creation from copilot workflows

## Workflow behavior

### SonarCloud Quality Analysis
- **Regular PRs**: Full quality analysis with radar charts and metrics
- **Chore PRs**: Skipped to avoid unnecessary overhead for non-functional changes

### Automerge Conditions for PRs
- PR must be labeled with "chore"
- PR must be open (not draft, not already merged)
- PR must have no merge conflicts
- No status checks can be failing
- No check runs can be failing or cancelled

### Auto-close Conditions for Issues
- Issue must be labeled with "chore"
- Issue must be open (not already closed)
- System will detect if issue is copilot-related for appropriate messaging

### Merge Method for PRs
- Chore PRs are merged using **squash merge** to maintain a clean commit history
- Commit message format: `Auto-merge: [Original PR Title]`
- A comment is added to the PR indicating it was automatically merged

### Close Method for Issues
- Chore issues are closed with status "completed"
- A comment is added explaining the auto-close reason
- Different messaging for copilot-generated vs regular chore issues

## Manual override

### For Chore PRs
If you need to prevent automerge for a chore PR:
1. Remove the "chore" label
2. Convert to draft status
3. The automerge workflow will skip the PR

### For Chore Issues
If you need to prevent auto-close for a chore issue:
1. Remove the "chore" label before opening the issue
2. If already closed, remove the label and reopen
3. Use different labels like "documentation" or "enhancement" instead

## Troubleshooting

### If automerge fails for PRs:
- Check the Actions tab for detailed error messages
- Ensure all failing checks are resolved
- Verify the PR is not in draft status
- Confirm there are no merge conflicts

### If auto-close fails for Issues:
- Check the Actions tab for detailed error messages
- Verify the issue has the "chore" label
- Confirm repository permissions allow issue management
- Check if the issue is already closed or locked