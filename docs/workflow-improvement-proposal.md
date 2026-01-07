# GitHub Actions Workflow Improvement Proposal

**Date:** January 2026  
**Status:** Proposal  
**Audience:** Backstage Community Plugins Maintainers

## Executive Summary

This document proposes 7 high-impact, low-risk improvements to GitHub Actions workflows in the `backstage/community-plugins` repository. Each proposal is designed to:

- **Reduce manual maintainer effort** on repetitive tasks
- **Improve contributor experience** through better feedback and guidance
- **Leverage existing infrastructure** (scripts, metadata, workflows)
- **Avoid policy enforcement** or subjective scoring

All proposals are **opt-in, transparent, and easy to review**.

---

## Context: Current Workflow Ecosystem

### Existing Workflows (Audit Summary)

The repository currently has **17 workflows** that handle:

1. **PR Management**: `pr.yml`, `ci.yml`, `add-workspace-label.yml`
2. **Changeset Automation**: `automate_changeset_feedback.yml`, `automate_renovate_changesets.yml`
3. **Release Management**: `release.yml`, `release_workspace.yml`, `version-bump.yml`, `auto-version-bump.yml`
4. **Maintenance**: `automate-staleness.yml`, `cron.yml`, `deprecate-archived-plugins.yml`
5. **Documentation**: `regenerate_issue_templates.yml`, `upgrade-dashboard.yml`
6. **Dependency Management**: `renovate.yml`

### Existing Scripts (Key Assets)

The repository has **14+ utility scripts** in `/scripts` and `/scripts/ci`:

- **Workspace Discovery**: `list-workspaces.js`, `list-workspaces-with-changes.js`
- **Metadata Extraction**: `list-compatibility.js`, `list-maintainer-workspaces.js`
- **Validation**: `verify-changesets.js`, `verify-lockfile-duplicates.js`
- **Dashboard Generation**: `generate-upgrade-dashboard.js`

### Repository Characteristics

- **108 workspaces** with independent releases and changesets
- **CODEOWNERS** file with per-workspace ownership
- **bcp.json** configuration per workspace (opt-in features like `autoVersionBump`, `knipReports`)
- **backstage.json** tracks Backstage version compatibility per workspace
- **Monorepo with workspace isolation**: Each workspace is portable and self-contained

---

## Identified Pain Points

### For Maintainers

1. **Repetitive manual PR review effort** for common mistakes (missing changesets, lockfile issues, docs not updated)
2. **No visibility into ownership** when triaging PRs (which maintainers care about which workspaces?)
3. **Difficult to track workspace health** (compatibility, deprecations, test coverage)
4. **Back-and-forth on PR structure** (should this be multiple PRs? wrong workspace affected?)
5. **No automated doc consistency checks** (README structure, required sections)
6. **Manual triage of "good first issue" candidates** (identifying simple, isolated tasks)

### For Contributors

1. **Unclear what to test/build** before submitting PRs
2. **No early feedback** on common mistakes (missing changeset, wrong format)
3. **Difficult to discover** which workspaces are active, maintained, or deprecated
4. **No guidance** on workspace-specific requirements (bcp.json features)
5. **Unclear PR scope** (multi-workspace changes detection)

---

## Proposed Workflow Improvements

### 1. Enhanced PR Preview Comment with Workspace Context

**Problem It Solves:**
- Maintainers manually check CODEOWNERS, backstage.json, and bcp.json for each PR
- Contributors don't know which workspace owners to ping for review
- No visibility into workspace compatibility or special configurations

**Why It Fits This Repo:**
- Leverages existing metadata (`CODEOWNERS`, `backstage.json`, `bcp.json`)
- Builds on existing `list-workspaces-with-changes.js` script
- Reuses workspace detection from `ci.yml`

**Workflow Logic:**

**Trigger:** `pull_request_target` (types: opened, synchronize)

**Steps:**
1. Detect changed workspaces (reuse `list-workspaces-with-changes.js`)
2. For each workspace, extract:
   - CODEOWNERS (from `.github/CODEOWNERS`)
   - Backstage version (from `backstage.json`)
   - Special flags (from `bcp.json` if exists)
3. Post a summary comment:
   ```markdown
   ## 📦 Affected Workspaces
   
   | Workspace | Backstage Version | Auto Version Bump | Owners |
   |-----------|-------------------|-------------------|---------|
   | acr       | 1.45.3            | ✅                | @owner1 |
   | tech-radar| 1.45.1            | ❌                | @owner2 |
   
   **Note:** Owners listed above will be automatically requested for review.
   ```
4. Auto-request reviews from CODEOWNERS for affected workspaces

**Why Maintainers Would Appreciate It:**
- Saves 2-3 minutes per PR on manual CODEOWNERS lookup
- Surfacing version compatibility early helps prioritize reviews
- Contributors get clear guidance on who to engage

**Implementation Complexity:** Low (extends existing PR labeling workflow)

---

### 2. Pre-Merge PR Health Check Summary

**Problem It Solves:**
- Contributors don't know if they've missed required steps (changeset, prettier, etc.)
- Maintainers have to manually remind contributors about common issues
- No single source of truth for "is this PR ready to merge?"

**Why It Fits This Repo:**
- Builds on existing CI checks (`ci.yml` already runs these checks)
- Aggregates status from existing required checks
- Does NOT enforce—just provides visibility

**Workflow Logic:**

**Trigger:** `pull_request` (types: opened, synchronize), `check_suite` (completed)

**Steps:**
1. Wait for CI to complete
2. Aggregate results from:
   - Changeset verification (`verify-changesets.js`)
   - Lockfile check (`verify-lockfile-duplicates.js`)
   - CI build/test/lint status
   - API report changes
   - Prettier check
3. Post/update a status comment:
   ```markdown
   ## ✅ PR Health Check
   
   | Check | Status | Details |
   |-------|--------|---------|
   | Changesets | ✅ | Found in acr workspace |
   | Lockfile | ✅ | No duplicates detected |
   | CI Build | ✅ | All workspaces passed |
   | Prettier | ❌ | Run `yarn prettier:fix` |
   | API Reports | ⚠️ | New API changes detected |
   
   **Note:** This is informational only. Maintainers make final merge decisions.
   ```

**Why Maintainers Would Appreciate It:**
- Reduces back-and-forth comments like "please add changeset"
- Contributors self-correct before requesting review
- Clear aggregated view of PR status

**Implementation Complexity:** Medium (needs to aggregate multiple check results)

---

### 3. Multi-Workspace PR Detection and Guidance

**Problem It Solves:**
- PRs affecting multiple workspaces should often be split for easier review
- No automated detection of cross-workspace changes
- Maintainers manually suggest splitting PRs

**Why It Fits This Repo:**
- Reuses `list-workspaces-with-changes.js` detection logic
- Aligns with repository's workspace isolation model
- Purely informational—doesn't block PRs

**Workflow Logic:**

**Trigger:** `pull_request_target` (types: opened, synchronize)

**Steps:**
1. Detect changed workspaces (reuse existing script)
2. If more than 1 workspace affected:
   - Post a comment:
     ```markdown
     ## 🔍 Multi-Workspace PR Detected
     
     This PR affects **3 workspaces**: acr, tech-radar, analytics
     
     **Guidance:** Consider splitting this into separate PRs for easier review:
     - One PR per workspace simplifies testing and release
     - Maintainers can merge changes independently
     - Reduces risk of conflicts
     
     If these changes are intentionally coupled, please explain why in the PR description.
     ```
3. Add label: `multi-workspace`

**Why Maintainers Would Appreciate It:**
- Prompts contributors to think about PR scope
- Makes it easier to review and merge changes incrementally
- Reduces cognitive load on reviewers

**Implementation Complexity:** Low (extends workspace detection)

---

### 4. Automated Documentation Consistency Check

**Problem It Solves:**
- Plugin READMEs have inconsistent structure (installation steps, configuration, etc.)
- Maintainers manually request README updates during PR review
- No automated check for required documentation sections

**Why It Fits This Repo:**
- Many plugins follow a common README structure (see `workspaces/acr/plugins/acr/README.md`)
- Can build on existing workspace structure conventions
- Helps new contributors understand documentation standards

**Workflow Logic:**

**Trigger:** `pull_request` (when plugin files change)

**Steps:**
1. Detect if PR adds/modifies plugin packages (check for `plugins/*/package.json` changes)
2. For each plugin, check if `README.md` exists and contains:
   - Installation section (keywords: "install", "yarn add", "npm install")
   - Configuration section (keywords: "app-config", "configuration", "setup")
   - Usage section (keywords: "usage", "how to", "getting started")
3. Post a review comment if sections are missing:
   ```markdown
   ## 📝 Documentation Check
   
   **Plugin:** `@backstage-community/plugin-acr`
   
   Missing recommended sections in README.md:
   - [ ] Installation instructions
   - [x] Configuration steps
   - [ ] Usage examples
   
   **Tip:** See [plugin template](link) for recommended structure.
   ```

**Why Maintainers Would Appreciate It:**
- Reduces manual README review comments
- Ensures consistent documentation quality
- Contributors get early feedback on documentation

**Implementation Complexity:** Medium (needs README parsing)

---

### 5. Workspace Compatibility Quick Reference in CI

**Problem It Solves:**
- Difficult to see at a glance which Backstage version a workspace targets
- Maintainers need to manually check `backstage.json` during PR review
- Contributors might submit PRs against outdated workspace versions

**Why It Fits This Repo:**
- Builds on existing `backstage.json` metadata
- Leverages existing `upgrade-dashboard.yml` logic
- Helps prioritize upgrade work

**Workflow Logic:**

**Trigger:** `pull_request` (when workspace files change)

**Steps:**
1. Detect changed workspaces
2. For each workspace, read `backstage.json`
3. Fetch latest Backstage version from `https://versions.backstage.io/v1/tags/main/manifest.json`
4. Calculate version difference (reuse logic from `generate-upgrade-dashboard.js`)
5. Add a check annotation with compatibility status:
   ```markdown
   ## 🔄 Backstage Compatibility
   
   **Workspace:** acr  
   **Current Version:** 1.45.3  
   **Latest Version:** 1.46.1  
   **Status:** 🟡 1 minor version behind
   
   [View upgrade helper](https://backstage.github.io/upgrade-helper/?from=1.45.3&to=1.46.1)
   ```

**Why Maintainers Would Appreciate It:**
- Quick visibility into workspace version status
- Helps prioritize which workspaces need attention
- Links to upgrade resources

**Implementation Complexity:** Low (reuses existing dashboard logic)

---

### 6. First-Time Contributor Welcome and Checklist

**Problem It Solves:**
- First-time contributors miss common requirements (DCO sign-off, changeset)
- Maintainers repeat the same onboarding comments
- No automated welcome message with repository-specific guidance

**Why It Fits This Repo:**
- Reduces onboarding friction for new contributors
- Complements existing CONTRIBUTING.md
- Provides actionable checklist

**Workflow Logic:**

**Trigger:** `pull_request_target` (type: opened), filter by `github.event.pull_request.author_association == 'FIRST_TIME_CONTRIBUTOR'`

**Steps:**
1. Detect first-time contributor
2. Post welcome comment:
   ```markdown
   ## 👋 Welcome to Backstage Community Plugins!
   
   Thank you for your contribution! Here's a quick checklist to help you get started:
   
   - [ ] I've read the [CONTRIBUTING.md](link) guide
   - [ ] I've added a changeset (run `yarn changeset` in the workspace)
   - [ ] I've run `yarn prettier:fix` to format my code
   - [ ] I've tested my changes locally
   - [ ] I've signed my commits (DCO)
   
   **Need help?** Join us on [Discord](link) in the #community-plugins channel!
   
   A maintainer will review your PR soon. In the meantime, you can check the CI results above.
   ```

**Why Maintainers Would Appreciate It:**
- Reduces repetitive onboarding comments
- Contributors are better prepared for review
- Improves contributor retention

**Implementation Complexity:** Very Low (simple comment bot)

---

### 7. Dependency Update Impact Analysis (for Renovate PRs)

**Problem It Solves:**
- Renovate creates many dependency update PRs
- Maintainers need to manually assess breaking change risk
- No automated summary of what's affected by a dependency update

**Why It Fits This Repo:**
- Builds on existing `automate_renovate_changesets.yml` workflow
- Helps maintainers prioritize Renovate PRs
- Leverages existing workspace detection

**Workflow Logic:**

**Trigger:** `pull_request` (when author is Renovate and files match `workspaces/*/package.json` or `workspaces/*/yarn.lock`)

**Steps:**
1. Detect which workspaces have dependency changes
2. For each package update, check:
   - Semver difference (major/minor/patch)
   - Number of workspaces affected
3. Post a summary comment:
   ```markdown
   ## 🔧 Dependency Update Impact
   
   **Updated Package:** `@backstage/core-plugin-api`  
   **Version:** 1.8.0 → 1.9.0 (minor)  
   **Affected Workspaces:** 12
   
   | Workspace | Current Version | New Version |
   |-----------|----------------|-------------|
   | acr       | 1.8.0          | 1.9.0       |
   | analytics | 1.8.0          | 1.9.0       |
   | ...       | ...            | ...         |
   
   **Breaking Changes:** None detected (minor version bump)
   
   **Recommendation:** Low risk. Consider merging after CI passes.
   ```

**Why Maintainers Would Appreciate It:**
- Quick assessment of update scope
- Helps prioritize which Renovate PRs to merge first
- Reduces time spent reading changelogs

**Implementation Complexity:** Medium (needs package.json diffing)

---

## Recommendation: Implementation Priority

### Phase 1 (Immediate - Low Hanging Fruit)
1. **First-Time Contributor Welcome** (Proposal 6) - Very Low complexity, high contributor impact
2. **Enhanced PR Preview Comment** (Proposal 1) - Low complexity, builds on existing infrastructure

### Phase 2 (Short Term - High Value)
3. **Multi-Workspace PR Detection** (Proposal 3) - Low complexity, high maintainer time savings
4. **Workspace Compatibility Quick Reference** (Proposal 5) - Low complexity, reuses existing logic

### Phase 3 (Medium Term - Maintainer Efficiency)
5. **Pre-Merge PR Health Check** (Proposal 2) - Medium complexity, reduces review cycles
6. **Dependency Update Impact Analysis** (Proposal 7) - Medium complexity, improves Renovate workflow

### Phase 4 (Long Term - Quality Improvement)
7. **Automated Documentation Consistency Check** (Proposal 4) - Medium complexity, long-term quality gains

---

## Design Principles (Why Maintainers Will Appreciate These)

### 1. **Builds on What Exists**
- Every proposal reuses existing scripts, metadata, or workflow patterns
- No new infrastructure or external dependencies
- Fits naturally into current maintainer workflows

### 2. **Informational, Not Enforcement**
- Workflows provide **guidance and visibility**, not blocking checks
- Maintainers retain final decision-making authority
- No "plugin health scores" or subjective metrics

### 3. **Opt-In and Transparent**
- All workflow outputs are posted as comments (reviewable)
- Can be disabled per-workspace using GitHub workflow `if:` conditions
- Clear logging for debugging

### 4. **Reduces Cognitive Load**
- Aggregates information maintainers would manually gather
- Surfaces relevant context automatically (owners, versions, etc.)
- Prompts contributors to self-correct common mistakes

### 5. **Respects Existing Triage**
- Does NOT replace maintainer issue triage
- Complements existing PR review process
- Saves time on repetitive, non-judgmental tasks

---

## Success Metrics (How to Measure Impact)

### For Maintainers
- **Time saved per PR review:** Target 5-10 minutes saved on average PR
- **Reduced back-and-forth:** Fewer comments requesting changesets, prettier, etc.
- **Faster triage:** Quicker identification of workspace owners and compatibility

### For Contributors
- **Reduced PR rejection rate:** Fewer PRs closed due to missing requirements
- **Faster first response:** Automated guidance reduces wait time for initial feedback
- **Clearer expectations:** Better documentation leads to higher quality PRs

### Repository Health
- **Fewer multi-workspace PRs:** More focused, reviewable changes
- **Improved documentation consistency:** Higher percentage of plugins with complete READMEs
- **Better Renovate PR handling:** Faster dependency updates with lower risk

---

## Appendix: Technical Implementation Notes

### Shared Utilities to Build

1. **Workspace Metadata Extractor** (`scripts/ci/extract-workspace-metadata.js`)
   - Combines CODEOWNERS, backstage.json, bcp.json parsing
   - Returns structured JSON for workflows to consume
   - Reusable across multiple workflows

2. **Check Result Aggregator** (`scripts/ci/aggregate-check-results.js`)
   - Fetches GitHub Check Run API results
   - Formats status table for PR comments
   - Used by Proposal 2

3. **README Structure Validator** (`scripts/ci/validate-readme-structure.js`)
   - Parses README markdown
   - Checks for required sections
   - Returns checklist of missing sections

### GitHub API Permissions Required

All workflows need minimal permissions:
- `pull-requests: write` (for posting comments)
- `contents: read` (for reading files)
- `checks: read` (for reading check status)

No additional tokens or secrets required beyond existing `GITHUB_TOKEN`.

---

## Conclusion

These 7 proposals are designed to be:
- **High-impact** (save maintainer time, improve contributor experience)
- **Low-risk** (build on existing infrastructure, no enforcement)
- **Easy to implement** (reuse scripts, metadata, and patterns)
- **Aligned with maintainer empathy** (reduce cognitive load, not add it)

Next steps:
1. Review proposals with maintainers
2. Prioritize which workflows to implement first
3. Implement Phase 1 (low-hanging fruit)
4. Gather feedback and iterate

---

**Questions or feedback?** Please comment on the PR or reach out in the #community-plugins Discord channel.
