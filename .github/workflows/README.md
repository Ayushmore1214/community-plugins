# Workflow Files Overview

This directory contains the implemented GitHub Actions workflows based on the proposals in `/docs/workflow-improvement-proposal.md`.

## New Workflow Files

### 1. pr-first-time-contributor-welcome.yml
**Purpose:** Welcomes first-time contributors with a helpful checklist  
**Triggers:** When a PR is opened by a first-time contributor  
**What it does:**
- Detects first-time contributors
- Posts a welcome message with checklist for contributing
- Links to CONTRIBUTING.md and Discord

**Phase:** 1 (Quick Win)

---

### 2. pr-workspace-context.yml
**Purpose:** Shows workspace metadata and auto-requests reviews from owners  
**Triggers:** When a PR is opened or updated  
**What it does:**
- Detects which workspaces are affected by the PR
- Extracts metadata from CODEOWNERS, backstage.json, and bcp.json
- Posts a table showing workspace owners, Backstage versions, and feature flags
- Auto-requests reviews from workspace owners

**Phase:** 1 (Quick Win)

---

### 3. pr-multi-workspace-detection.yml
**Purpose:** Detects and flags PRs that affect multiple workspaces  
**Triggers:** When a PR is opened or updated  
**What it does:**
- Identifies PRs affecting more than one workspace
- Posts guidance on splitting PRs for easier review
- Adds "multi-workspace" label to the PR

**Phase:** 2 (Short Term)

---

### 4. pr-documentation-check.yml
**Purpose:** Validates plugin README structure  
**Triggers:** When files in plugin directories are changed  
**What it does:**
- Checks if plugin READMEs exist
- Validates presence of required sections (Installation, Configuration, Usage)
- Posts a checklist of missing documentation sections

**Phase:** 4 (Long Term)

---

### 5. pr-compatibility-check.yml
**Purpose:** Shows Backstage version compatibility status  
**Triggers:** When backstage.json or package.json files are changed  
**What it does:**
- Fetches the latest Backstage version
- Compares workspace versions to the latest version
- Posts a compatibility table with upgrade helper links
- Uses emoji indicators (🟢🟡🟠🔴) to show status

**Phase:** 2 (Short Term)

---

### 6. pr-health-check.yml
**Purpose:** Aggregates CI check results into a single summary  
**Triggers:** When a PR is opened/updated or CI workflow completes  
**What it does:**
- Waits for CI checks to complete
- Aggregates results from changeset, lockfile, CI, prettier, and API report checks
- Posts a summary table showing pass/fail status for each check
- Updates in real-time as checks complete

**Phase:** 3 (Medium Term)

---

### 7. renovate-impact-analysis.yml
**Purpose:** Analyzes dependency updates from Renovate  
**Triggers:** When Renovate creates or updates a PR  
**What it does:**
- Parses package.json changes to identify dependency updates
- Calculates semver diff (major/minor/patch)
- Shows affected workspaces for each package update
- Provides risk assessment based on update type

**Phase:** 3 (Medium Term)

---

## Implementation Status

✅ **All 7 workflows are implemented and ready to use**

These workflows are:
- **Informational only** - They don't block PRs or enforce policies
- **Opt-in** - Can be disabled by removing/renaming workflow files
- **Transparent** - All outputs are posted as reviewable comments
- **Low-risk** - Built on existing infrastructure and scripts

## How to Enable/Disable

### Enable a workflow
Workflows are automatically enabled once merged to the main branch.

### Disable a workflow
To disable a specific workflow:
1. Rename the file with a `.disabled` extension, e.g., `pr-health-check.yml.disabled`
2. Or delete the workflow file entirely

### Test a workflow
To test workflows before enabling:
1. Push changes to a feature branch
2. Create a test PR
3. Monitor workflow runs in the Actions tab

## Workflow Permissions

All workflows use minimal permissions:
- `pull-requests: write` - To post comments
- `contents: read` - To read repository files
- `checks: read` - To read check run status (pr-health-check only)
- `issues: write` - To add labels (pr-multi-workspace-detection only)

No additional tokens or secrets are required beyond the default `GITHUB_TOKEN`.

## Security

All workflows:
- Use pinned action versions with SHA hashes
- Include `step-security/harden-runner` for audit logging
- Follow security best practices from existing workflows

## Maintenance

### Updating Action Versions
Action versions are pinned with SHA hashes and should be reviewed quarterly:
```yaml
uses: actions/checkout@1d96c772d19495a3b5c517cd2bc0cb401ea0529f # v4
```

To update:
1. Check for new versions of actions
2. Update the SHA hash and version comment
3. Test thoroughly before merging

### Monitoring
Monitor workflow runs in the Actions tab:
- Check for failures or errors
- Review posted comments for accuracy
- Gather feedback from maintainers and contributors

## Troubleshooting

### Workflow not running
- Check if the trigger conditions match (e.g., file paths, PR types)
- Verify workflow file has correct YAML syntax
- Check workflow permissions in repository settings

### Comment not posting
- Verify the workflow has `pull-requests: write` permission
- Check for API rate limits (rare)
- Review workflow logs for errors

### Incorrect metadata
- Verify CODEOWNERS file syntax
- Check backstage.json and bcp.json formats
- Review script outputs in workflow logs

## Related Documentation

- **Proposals:** `/docs/workflow-improvement-proposal.md`
- **Technical Specs:** `/docs/workflow-technical-specifications.md`
- **Quick Reference:** `/docs/workflow-proposals-quick-reference.md`
- **Overview:** `/docs/workflow-proposals-README.md`

## Support

For questions or issues with these workflows:
- Open an issue in the repository
- Ask in #community-plugins on Discord
- Tag @backstage/community-plugins-maintainers

---

**Last Updated:** January 2026  
**Version:** 1.0  
**Status:** Implemented and Ready for Use
