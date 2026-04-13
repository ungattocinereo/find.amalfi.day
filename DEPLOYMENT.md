# Deployment

Three-tier deployment via GitHub Actions + Vercel CLI.

## Environments

| Environment | Trigger | URL | Vercel deploy mode |
|---|---|---|---|
| **prod** | GitHub Release published | `find.amalfi.day` | `--prod` |
| **stage** | Push to `main` | `find-amalfi-day-stage.vercel.app` | preview + stable alias |
| **dev** | Push to any other branch | auto-generated `*.vercel.app` (URL posted in PR comment) | preview |

When a feature branch is deleted, `cleanup-branch.yml` automatically removes all
preview deployments tagged with that branch (`meta githubBranch=<branch>`).

---

## One-time setup

### 1. Disable Vercel's automatic Git deploys ✅ (you've done this)

The workflows do all deploys explicitly. Vercel's auto-deploy must be off.

### 2. Create the required GitHub Secrets

**Repository Settings → Secrets and variables → Actions**

| Secret | How to get it |
|---|---|
| `VERCEL_TOKEN` ✅ | Vercel → Account Settings → Tokens → Create. |
| `VERCEL_ORG_ID` | See below — two options. |
| `VERCEL_PROJECT_ID` | See below — two options. |

#### Option A — get IDs from the Vercel Dashboard (no CLI needed)

- **`VERCEL_PROJECT_ID`**: Vercel Dashboard → open the project → **Settings → General** → scroll to "Project ID" → copy.
- **`VERCEL_ORG_ID`**:
  - If the project is under a Team: top-left team switcher → **Settings → General** → "Team ID".
  - If under a personal account: avatar (top right) → **Account Settings → General** → "Your ID".

Paste both into GitHub Secrets.

#### Option B — get IDs via the CLI

```bash
cd /Users/greg/Documents/Code/find.amalfi.day

# Use the same token you put in GitHub Secrets:
export VERCEL_TOKEN=<paste-token>

# Link the local repo to the Vercel project (creates .vercel/project.json):
npx vercel link --yes --token=$VERCEL_TOKEN

# Print the IDs:
cat .vercel/project.json
# → { "projectId": "...", "orgId": "..." }

# Cleanup — .vercel/ is gitignored so it won't be committed, but you can also delete it:
rm -rf .vercel
```

If `vercel link --yes` can't auto-pick the project (e.g. multiple projects exist),
omit `--yes` and answer the prompts.

### 3. DNS

Only one domain is needed:

```
find.amalfi.day  CNAME  cname.vercel-dns.com.
```

Already configured if `find.amalfi.day` is currently the production domain on
Vercel. `stage` and `dev` URLs live entirely on `*.vercel.app` — no DNS work.

### 4. Domains in Vercel

Make sure `find.amalfi.day` is set as the **Production** domain in Vercel
Dashboard → Project → Settings → Domains. The `*.vercel.app` subdomains for
stage and dev are issued automatically — nothing to add.

---

## How a deploy happens

### Feature branch push

1. Developer pushes to `feature/something`.
2. `deploy-dev.yml` runs:
   - Runs `vercel deploy` (preview).
   - Surfaces the unique deployment URL (e.g. `find-amalfi-day-abc123.vercel.app`).
   - If the push came from a PR, posts the URL as a PR comment.

### Merge to main

1. PR is merged into `main`.
2. `deploy-stage.yml` runs:
   - Runs `vercel deploy` (preview).
   - Aliases the new deployment to **`find-amalfi-day-stage.vercel.app`**
     (a stable URL that always points to the latest `main` build).

### Cutting a release

1. Create a release on GitHub (Releases → Draft new release → Publish).
2. `deploy-prod.yml` runs:
   - Checks out the release tag.
   - Runs `vercel deploy --prod`.
   - The `find.amalfi.day` domain (production domain in Vercel) automatically
     points to the new production deployment.

### Deleting a feature branch

1. Branch is deleted (e.g. after PR merge with auto-delete).
2. `cleanup-branch.yml` runs:
   - Lists all Vercel deployments tagged with `meta githubBranch=<branch>`.
   - Removes each one.

---

## Manual deploy (escape hatch)

```bash
export VERCEL_TOKEN=<token>
export VERCEL_ORG_ID=<orgId>
export VERCEL_PROJECT_ID=<projectId>

# Preview deploy
vercel deploy --token=$VERCEL_TOKEN

# Production deploy (instantly updates find.amalfi.day)
vercel deploy --prod --token=$VERCEL_TOKEN

# Re-alias an existing deployment to the stage URL
vercel alias set <deployment-url> find-amalfi-day-stage.vercel.app --token=$VERCEL_TOKEN

# Remove a deployment
vercel remove <deployment-url> --yes --token=$VERCEL_TOKEN
```

---

## Rollback

### Production
Vercel keeps every production deployment. **Vercel Dashboard → Project →
Deployments** → find a previous prod deployment → "Promote to Production".
Instant, no DNS change needed.

### Stage
Re-run `vercel alias set <previous-deployment> find-amalfi-day-stage.vercel.app`
or push a revert commit to `main`.

### Dev
Push another commit to the feature branch.
