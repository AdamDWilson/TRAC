# TRAC Web Tools

Source for the interactive tools published on the TRAC website ([tenants.bc.ca](https://tenants.bc.ca)) under `/tools/`. All tools are pure client-side static sites — no backend.

## Current Tools

- **Template Letter Generator** — `template-letters/` — helps BC tenants generate letters to landlords (notice to end tenancy, repairs requests, etc.) consistent with the Residential Tenancy Act. See [`template-letters/README.md`](template-letters/README.md) for adding or modifying letter templates.

## Environments

| Env | Trigger | Output | Where it lives |
| --- | --- | --- | --- |
| **Test** | every push to `main` | uploaded as a Pages artifact | Served by GitHub Pages — used to preview changes before release. |
| **Production** | a `v*` tag (e.g. `v1`, `v2.3`) | `deploy` branch | Cloned + symlinked into `/tools/` on the TRAC webserver by the hosting integrator. |

Both environments are built from the same `build.sh` and contain identical assets — only the build-info label differs.

### Releasing to production

```bash
git tag v1                  # or v2, v1.1, etc.
git push origin v1
```

The `Publish production` workflow runs, validates, builds with `BUILD_ENV=production`, and force-pushes the result as a single orphan commit to the `deploy` branch.

### One-time GitHub Pages setup

In repo Settings → Pages, set **Source** to **GitHub Actions**. No branch needed — the test workflow uploads the built artifact directly to Pages.

## Deployment (production)

The `deploy` branch contains the build output **at its root** — cloning it produces `template-letters/` and `build-info.txt` directly in the working tree (no `dist/` wrapper). The integrator clones the branch and symlinks the clone root to `/tools/`.

```bash
# Initial deploy
git clone --single-branch -b deploy https://github.com/<org>/TRAC.git /opt/trac-deploy
ln -snf /opt/trac-deploy /var/www/tenants.bc.ca/tools
# After this: /var/www/tenants.bc.ca/tools/template-letters/    serves the app
#             /var/www/tenants.bc.ca/tools/build-info.txt       reports the build

# To update
cd /opt/trac-deploy && git pull
```

### Checking what's deployed

Each build emits `/tools/build-info.txt`:

```
Build: 2026-05-10T18:00:00Z
Ref:   v1
SHA:   abc1234
Env:   production
```

Curl it from anywhere to confirm what the integrator has on the server:

```bash
curl https://tenants.bc.ca/tools/build-info.txt
```

## Local Development

Run a local server against the source tree (no build step needed for development):

```bash
python3 -m http.server 8000 --directory template-letters
```

Then open <http://localhost:8000>.

## Validating Templates

The template letter generator includes a Python validator that checks every registered template has the required files and that every variable in a letter is defined in the form:

```bash
python3 template-letters/validate_templates.py
```

This runs in CI before every publish.

## Building

The build is normally invoked by CI. You can run it locally to verify what will be deployed:

```bash
./build.sh
python3 -m http.server 8000 --directory dist/template-letters
```

`build.sh` uses an rsync **allowlist** — only `*.html`, `*.css`, `*.js`, `*.json`, and `*.letter.md` are copied. New files of those types in existing tool directories are picked up automatically; new file *types* (images, fonts, etc.) require adding a pattern to the `INCLUDES` array in `build.sh`. Adding a new top-level tool requires one line in the `TOOLS` array.
