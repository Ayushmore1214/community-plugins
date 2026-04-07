# Workflow Technical Specifications

This document provides detailed technical specifications for implementing the proposed GitHub Actions workflows. Each section corresponds to a proposal in `workflow-improvement-proposal.md`.

---

## 1. Enhanced PR Preview Comment with Workspace Context

### Workflow File: `.github/workflows/pr-workspace-context.yml`

#### Triggers
```yaml
on:
  pull_request_target:
    types: [opened, synchronize]
```

#### Required Permissions
```yaml
permissions:
  pull-requests: write
  contents: read
```

#### High-Level Steps

1. **Checkout repository**
   - Use `actions/checkout@v4` with PR head ref
   - Fetch base branch for diff comparison

2. **Setup Node.js**
   - Use existing Node 20.x setup action
   - Install dependencies with `yarn install --immutable`

3. **Detect changed workspaces**
   - Run: `node scripts/ci/list-workspaces-with-changes.js`
   - Output: JSON array of workspace names

4. **Extract workspace metadata** (new script needed)
   - For each workspace, run: `node scripts/ci/extract-workspace-metadata.js <workspace>`
   - Script reads:
     - `.github/CODEOWNERS` - parse workspace owners
     - `workspaces/<workspace>/backstage.json` - version
     - `workspaces/<workspace>/bcp.json` - feature flags
   - Returns JSON:
     ```json
     {
       "workspace": "acr",
       "owners": ["@backstage/community-plugins-maintainers", "@owner1"],
       "backstageVersion": "1.45.3",
       "autoVersionBump": true,
       "knipReports": false
     }
     ```

5. **Format and post comment**
   - Use `actions/github-script@v7` to:
     - Build markdown table from workspace metadata
     - Find existing bot comment (search for marker: `<!-- workspace-context -->`)
     - Update or create comment
     - Request reviews from CODEOWNERS (use `github.rest.pulls.requestReviewers`)

#### New Script: `scripts/ci/extract-workspace-metadata.js`

```javascript
#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import * as codeowners from 'codeowners-utils';

async function extractWorkspaceMetadata(workspace) {
  const rootPath = path.resolve(process.cwd());
  
  // Read CODEOWNERS (using same pattern as list-maintainer-workspaces.js)
  const codeownersPath = path.join(rootPath, '.github', 'CODEOWNERS');
  const codeOwnerEntries = await codeowners.loadOwners(codeownersPath);
  
  // Find owners for this workspace
  const owners = codeOwnerEntries
    .filter(c => c.pattern === `/workspaces/${workspace}`)
    .map(o => o.owners)
    .flat();
  
  // Read backstage.json
  const backstageJsonPath = path.join(rootPath, 'workspaces', workspace, 'backstage.json');
  let backstageVersion = 'unknown';
  if (fs.existsSync(backstageJsonPath)) {
    const backstageJson = JSON.parse(fs.readFileSync(backstageJsonPath, 'utf8'));
    backstageVersion = backstageJson.version || 'unknown';
  }
  
  // Read bcp.json
  const bcpJsonPath = path.join(rootPath, 'workspaces', workspace, 'bcp.json');
  let autoVersionBump = false;
  let knipReports = false;
  if (fs.existsSync(bcpJsonPath)) {
    const bcpJson = JSON.parse(fs.readFileSync(bcpJsonPath, 'utf8'));
    autoVersionBump = bcpJson.autoVersionBump || false;
    knipReports = bcpJson.knipReports || false;
  }
  
  return {
    workspace,
    owners: owners.filter(o => o !== '@backstage/community-plugins-maintainers'),
    backstageVersion,
    autoVersionBump,
    knipReports
  };
}

// CLI usage
const workspace = process.argv[2];
if (!workspace) {
  console.error('Usage: extract-workspace-metadata.js <workspace>');
  process.exit(1);
}

extractWorkspaceMetadata(workspace).then(metadata => {
  console.log(JSON.stringify(metadata));
}).catch(error => {
  console.error(error);
  process.exit(1);
});
```

---

## 2. Pre-Merge PR Health Check Summary

### Workflow File: `.github/workflows/pr-health-check.yml`

#### Triggers
```yaml
on:
  pull_request:
    types: [opened, synchronize]
  workflow_run:
    workflows: ["CI"]
    types: [completed]
```

#### Required Permissions
```yaml
permissions:
  pull-requests: write
  contents: read
  checks: read
```

#### High-Level Steps

1. **Get PR number**
   - For `workflow_run` events, extract PR number from triggering workflow

2. **Wait for all checks to complete**
   - Use polling or GitHub Checks API to wait for required checks
   - Timeout after 5 minutes

3. **Aggregate check results** (new script needed)
   - Run: `node scripts/ci/aggregate-check-results.js <pr-number>`
   - Script uses GitHub API to fetch:
     - CI workflow run status (via `GET /repos/{owner}/{repo}/commits/{ref}/check-runs`)
     - Parse specific step outputs for detailed status
   - Returns JSON:
     ```json
     {
       "changeset": { "status": "pass", "message": "Found in acr workspace" },
       "lockfile": { "status": "pass", "message": "No duplicates" },
       "ci": { "status": "pass", "message": "All workspaces passed" },
       "prettier": { "status": "fail", "message": "Run yarn prettier:fix" },
       "apiReports": { "status": "warning", "message": "API changes detected" }
     }
     ```

4. **Format and post status comment**
   - Build markdown table with status emojis
   - Include actionable next steps for failures
   - Add marker: `<!-- pr-health-check -->`

#### New Script: `scripts/ci/aggregate-check-results.js`

```javascript
#!/usr/bin/env node
import { Octokit } from '@octokit/rest';

async function aggregateCheckResults(prNumber) {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const { owner, repo } = getRepoInfo();
  
  // Get PR details
  const { data: pr } = await octokit.pulls.get({
    owner,
    repo,
    pull_number: prNumber
  });
  
  // Get check runs for PR head SHA
  const { data: checkRuns } = await octokit.checks.listForRef({
    owner,
    repo,
    ref: pr.head.sha
  });
  
  // Parse specific checks
  const results = {
    changeset: parseChangesetCheck(checkRuns),
    lockfile: parseLockfileCheck(checkRuns),
    ci: parseCICheck(checkRuns),
    prettier: parsePrettierCheck(checkRuns),
    apiReports: parseAPIReportCheck(checkRuns)
  };
  
  return results;
}

function parseChangesetCheck(checkRuns) {
  const changesetCheck = checkRuns.check_runs.find(c => 
    c.name.includes('verify changesets')
  );
  if (!changesetCheck) return { status: 'pending', message: 'Waiting...' };
  if (changesetCheck.conclusion === 'success') {
    return { status: 'pass', message: 'Changeset found' };
  }
  return { status: 'fail', message: 'Missing changeset - run `yarn changeset` in workspace' };
}

// Similar parsers for other checks...

// CLI usage
const prNumber = parseInt(process.argv[2]);
aggregateCheckResults(prNumber).then(results => {
  console.log(JSON.stringify(results));
});
```

---

## 3. Multi-Workspace PR Detection and Guidance

### Workflow File: `.github/workflows/pr-multi-workspace-detection.yml`

#### Triggers
```yaml
on:
  pull_request_target:
    types: [opened, synchronize]
```

#### High-Level Steps

1. **Detect changed workspaces**
   - Reuse: `node scripts/ci/list-workspaces-with-changes.js`

2. **Check workspace count**
   - If count > 1, proceed with guidance comment

3. **Post guidance comment**
   - Use `actions/github-script@v7`
   - List all affected workspaces
   - Provide splitting guidance
   - Add label: `multi-workspace`
   - Marker: `<!-- multi-workspace-detection -->`

4. **Add label**
   - Use `github.rest.issues.addLabels`

#### Implementation Note
- Very simple extension of existing workspace detection
- No new scripts needed
- All logic can be in workflow YAML

---

## 4. Automated Documentation Consistency Check

### Workflow File: `.github/workflows/pr-docs-check.yml`

#### Triggers
```yaml
on:
  pull_request:
    paths:
      - 'workspaces/*/plugins/*/**'
      - 'workspaces/*/packages/*/**'
```

#### High-Level Steps

1. **Detect changed plugin packages**
   - Use `git diff` to find changed `package.json` files
   - Filter for plugin paths: `workspaces/*/plugins/*/package.json`

2. **Validate README structure** (new script needed)
   - For each plugin, run: `node scripts/ci/validate-readme-structure.js <plugin-path>`
   - Script checks for sections:
     - Installation (regex: `/##\s+(Installation|Installing|Getting Started)/i`)
     - Configuration (regex: `/##\s+(Configuration|Setup|Config)/i`)
     - Usage (regex: `/##\s+(Usage|How to|Examples)/i`)
   - Returns JSON:
     ```json
     {
       "plugin": "@backstage-community/plugin-acr",
       "readmePath": "workspaces/acr/plugins/acr/README.md",
       "checks": {
         "installation": true,
         "configuration": true,
         "usage": false
       }
     }
     ```

3. **Post review comment for missing sections**
   - Use `github.rest.pulls.createReview` with `event: "COMMENT"`
   - Include checklist of missing sections
   - Link to plugin README template

#### New Script: `scripts/ci/validate-readme-structure.js`

```javascript
#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

function validateReadmeStructure(pluginPath) {
  const readmePath = path.join(pluginPath, 'README.md');
  
  if (!fs.existsSync(readmePath)) {
    return {
      plugin: path.basename(pluginPath),
      readmePath,
      exists: false,
      checks: {}
    };
  }
  
  const content = fs.readFileSync(readmePath, 'utf8');
  
  return {
    plugin: path.basename(pluginPath),
    readmePath,
    exists: true,
    checks: {
      installation: /##\s+(Installation|Installing|Getting Started)/i.test(content),
      configuration: /##\s+(Configuration|Setup|Config)/i.test(content),
      usage: /##\s+(Usage|How to|Examples)/i.test(content)
    }
  };
}

// CLI usage
const pluginPath = process.argv[2];
const result = validateReadmeStructure(pluginPath);
console.log(JSON.stringify(result));
```

---

## 5. Workspace Compatibility Quick Reference in CI

### Workflow File: `.github/workflows/pr-compatibility-check.yml`

#### Triggers
```yaml
on:
  pull_request:
    paths:
      - 'workspaces/*/backstage.json'
      - 'workspaces/**/package.json'
```

#### High-Level Steps

1. **Detect changed workspaces**
   - Reuse existing detection script

2. **Check compatibility** (reuse existing logic)
   - For each workspace, run adapted version of `generate-upgrade-dashboard.js`
   - Fetch latest Backstage version
   - Calculate version difference

3. **Post compatibility comment**
   - Show current vs. latest version
   - Link to upgrade helper
   - Include status emoji (🟢🟡🟠🔴)

#### Script Adaptation
- Extract compatibility checking logic from `generate-upgrade-dashboard.js` into reusable function
- New script: `scripts/ci/check-workspace-compatibility.js`

---

## 6. First-Time Contributor Welcome and Checklist

### Workflow File: `.github/workflows/first-time-contributor-welcome.yml`

#### Triggers
```yaml
on:
  pull_request_target:
    types: [opened]
```

#### High-Level Steps

1. **Check if first-time contributor**
   - Filter: `github.event.pull_request.author_association == 'FIRST_TIME_CONTRIBUTOR'`

2. **Post welcome comment**
   - Use `actions/github-script@v7`
   - Include checklist
   - Link to CONTRIBUTING.md and Discord
   - Marker: `<!-- first-time-welcome -->`

#### Implementation Note
- Simplest workflow to implement
- No new scripts needed
- Pure GitHub Actions workflow logic

---

## 7. Dependency Update Impact Analysis (for Renovate PRs)

### Workflow File: `.github/workflows/renovate-impact-analysis.yml`

#### Triggers
```yaml
on:
  pull_request:
    types: [opened, synchronize]
```

#### Filter Condition
```yaml
if: github.event.pull_request.user.login == 'renovate[bot]'
```

#### High-Level Steps

1. **Detect dependency changes** (new script needed)
   - Run: `node scripts/ci/analyze-dependency-changes.js`
   - Use `git diff` to compare `package.json` files
   - Parse version changes

2. **Count affected workspaces**
   - List all workspaces with dependency changes

3. **Determine update severity**
   - Parse semver diff (major/minor/patch)
   - Check if breaking changes expected

4. **Post impact summary**
   - Table showing affected workspaces
   - Semver analysis
   - Risk assessment

#### New Script: `scripts/ci/analyze-dependency-changes.js`

```javascript
#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import semver from 'semver';

// Helper function to extract workspace name from file path
function extractWorkspace(filePath) {
  // Extract workspace name from path like "workspaces/acr/package.json"
  const match = filePath.match(/^workspaces\/([^/]+)\//);
  return match ? match[1] : null;
}

function compareDependencies(oldDeps, newDeps) {
  const changes = [];
  for (const [pkg, newVersion] of Object.entries(newDeps || {})) {
    const oldVersion = oldDeps?.[pkg];
    if (oldVersion && oldVersion !== newVersion) {
      changes.push({
        package: pkg,
        oldVersion: oldVersion.replace(/^[\^~]/, ''),
        newVersion: newVersion.replace(/^[\^~]/, ''),
        type: semver.diff(oldVersion, newVersion)
      });
    }
  }
  return changes;
}

function analyzeDependencyChanges() {
  // Get changed package.json files
  const changedFiles = execSync('git diff --name-only origin/main...HEAD')
    .toString()
    .split('\n')
    .filter(f => f.endsWith('package.json') && f.trim() !== '');
  
  const changes = [];
  
  for (const file of changedFiles) {
    const workspace = extractWorkspace(file);
    if (!workspace) continue;
    
    try {
      // Get old and new package.json with error handling
      const oldContent = execSync(`git show origin/main:${file}`, { encoding: 'utf8' });
      const newContent = fs.readFileSync(file, 'utf8');
    
      const oldPkg = JSON.parse(oldContent);
      const newPkg = JSON.parse(newContent);
    
      // Compare dependencies
      const depChanges = compareDependencies(oldPkg.dependencies, newPkg.dependencies);
    
      if (depChanges.length > 0) {
        changes.push({ workspace, changes: depChanges });
      }
    } catch (error) {
      // File may not exist in base branch (new file) or be invalid JSON
      console.warn(`Warning: Could not process ${file}:`, error.message);
      continue;
    }
  }
  
  return changes;
}
```

---

## Shared Infrastructure

### Common Dependencies

All workflows can share:
- Node.js 20.x setup (via existing action)
- `yarn install --immutable` for dependencies
- `actions/github-script@v7` for GitHub API interactions
- `actions/checkout@v4` for repository access

### Script Organization

Recommended structure:
```
scripts/
  ci/
    list-workspaces-with-changes.js (existing)
    extract-workspace-metadata.js (new)
    aggregate-check-results.js (new)
    validate-readme-structure.js (new)
    check-workspace-compatibility.js (new - adapted from existing)
    analyze-dependency-changes.js (new)
```

### Testing Scripts Locally

All scripts should be testable via:
```bash
node scripts/ci/<script-name>.js [args]
```

Example:
```bash
# Test workspace metadata extraction
node scripts/ci/extract-workspace-metadata.js acr

# Test README validation
node scripts/ci/validate-readme-structure.js workspaces/acr/plugins/acr
```

---

## Error Handling

### Workflow Failure Behavior

All workflows should:
1. **Never block PRs** - workflows should be informational only
2. **Graceful degradation** - if a script fails, post a comment indicating the issue
3. **Clear error messages** - include script output in workflow logs
4. **Retry logic** - for API calls, implement exponential backoff

### Script Error Handling

All scripts should:
```javascript
try {
  // Main logic
} catch (error) {
  console.error('Error in <script-name>:', error.message);
  console.error(error.stack);
  process.exit(1);
}
```

---

## Performance Considerations

### Workflow Concurrency

Use concurrency groups to prevent duplicate runs:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number }}
  cancel-in-progress: true
```

### Caching

Leverage existing caching for:
- Node modules: `actions/cache@v4` with `node_modules` cache
- Yarn cache: Already implemented in repository

### API Rate Limits

- Use `GITHUB_TOKEN` (5000 requests/hour)
- Batch API calls where possible
- Cache CODEOWNERS parsing results

---

## Monitoring and Debugging

### Workflow Run Logs

All workflows should include:
```yaml
- name: Debug - Print environment
  run: |
    echo "PR number: ${{ github.event.pull_request.number }}"
    echo "Workspace: ${{ matrix.workspace }}"
```

### Comment Markers

Use HTML comments for bot tracking:
```markdown
<!-- workflow-name:workspace-context -->
```

This allows finding and updating existing comments.

---

## Maintenance Plan

### Workflow Updates

- All workflows should pin action versions with SHA hashes (security best practice)
- Review and update action versions quarterly
- Test workflows in fork before merging to main

### Script Maintenance

- Add unit tests for new scripts (optional but recommended)
- Document script inputs/outputs in JSDoc comments
- Version control script API changes

---

## Rollout Strategy

### Phase 1: Development and Testing
1. Create workflows in draft PRs
2. Test on fork repository
3. Gather maintainer feedback

### Phase 2: Staged Rollout
1. Enable workflows one at a time
2. Monitor for issues
3. Iterate based on feedback

### Phase 3: Full Deployment
1. Enable all workflows
2. Document in CONTRIBUTING.md
3. Communicate to community

---

## Appendix: Example Workflow YAMLs

### Example: First-Time Contributor Welcome

```yaml
name: First-Time Contributor Welcome

on:
  pull_request_target:
    types: [opened]

permissions:
  pull-requests: write

jobs:
  welcome:
    if: github.event.pull_request.author_association == 'FIRST_TIME_CONTRIBUTOR'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            const comment = `## 👋 Welcome to Backstage Community Plugins!

            Thank you for your contribution! Here's a quick checklist:

            - [ ] I've read [CONTRIBUTING.md](https://github.com/backstage/community-plugins/blob/main/CONTRIBUTING.md)
            - [ ] I've added a changeset (run \`yarn changeset\` in workspace)
            - [ ] I've run \`yarn prettier:fix\`
            - [ ] I've tested my changes locally
            - [ ] I've signed my commits (DCO)

            **Need help?** Join [Discord](https://discord.gg/backstage-687207715902193673)!

            <!-- first-time-welcome -->`;

            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: comment
            });
```

---

This technical specification provides implementation-ready details for all proposed workflows. Each workflow can be developed and tested independently.
