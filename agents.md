# ArgoCD GlueOps Links Extension

An ArgoCD UI extension that displays categorized application links fetched dynamically from a backend API. The extension integrates with ArgoCD's proxy extension system to display custom links in both the application status panel and details view.

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES5+), React (externalized from ArgoCD)
- **Build**: Webpack 5
- **Deployment**: Kubernetes, Helm, ArgoCD
- **CI/CD**: GitHub Actions
- **Distribution**: GitHub Releases (tarball format)

## Architecture

### Extension Structure
```
extension/src/index.js    → Main extension code (React component)
extension/webpack.config.js → Builds to extension/dist/extensions.js
```

### Deployment Flow
1. Webpack bundles `src/index.js` → `dist/extensions.js`
2. GitHub Action creates tarball: `resources/glueops-links-extension/extensions.js`
3. ArgoCD init container downloads tarball from GitHub release
4. Extension installed at: `/tmp/extensions/resources/glueops-links-extension/extensions.js`
5. ArgoCD server loads extension on startup

### API Integration
- Extension fetches: `/extensions/glueops-links-extension/api/v1/applications/{appName}/links`
- ArgoCD proxy forwards to backend URL configured in `helm-values.yaml`
- Required headers: `Argocd-Application-Name: {namespace}:{appName}`, `Argocd-Project-Name: {projectName}`

## Development Workflow

### Local Development
```bash
# Build extension
cd extension
npm install
npm run build

# Verify output
ls -la dist/extensions.js
```

### Testing
```bash
# Run automated test (creates Kind cluster, installs ArgoCD + extension)
./install-with-helm.sh

# Access ArgoCD
kubectl port-forward -n argocd svc/argocd-server 8080:80
# Open http://localhost:8080 (admin / password from script output)
```

### Release Process
1. Update version in `extension/package.json`
2. Update version in `helm-values.yaml` (2 places: EXTENSION_VERSION and EXTENSION_URL)
3. Commit: `git add -A && git commit -m "Release vX.X.X"`
4. Push: `git push origin main`
5. Tag: `git tag vX.X.X && git push origin vX.X.X`
6. Create release: `gh release create vX.X.X --title "vX.X.X" --notes "Release notes"`
7. GitHub Action automatically builds and uploads `extension.tar.gz`

## Code Style

### JavaScript Conventions
- **No transpilation** - ES5-compatible vanilla JS with React.createElement
- **IIFE wrapper** - Entire extension wrapped in `(function() { ... })()`
- **No JSX** - Use `React.createElement()` for all components
- **Inline styles** - All styling via style objects

### File Naming
- Output MUST be `extensions.js` (plural) not `extension.js`
- Tarball structure: `resources/glueops-links-extension/extensions.js`

### Version Management
- `extension/package.json` is source of truth
- Webpack injects `__EXTENSION_VERSION__` via DefinePlugin
- Keep `helm-values.yaml` version in sync

## Common Tasks

### Update API Endpoint
Edit `extension/src/index.js` line ~62:
```javascript
const response = await fetch(`/extensions/glueops-links-extension/api/v1/applications/${appName}/links`, {
```

### Change Backend URL
Edit `helm-values.yaml` line ~50:
```yaml
extension.config: |
  extensions:
  - name: glueops-links-extension
    backend:
      services:
      - url: https://api.glueops.dev
```

### Debug Extension Not Loading
```bash
# Check extension file exists
kubectl exec -n argocd <pod-name> -- ls -la /tmp/extensions/resources/glueops-links-extension/

# Check init container logs
kubectl logs -n argocd <pod-name> -c glueops-links-extension

# Verify tarball structure
tar -tzf extension.tar.gz
# Should show: resources/glueops-links-extension/extensions.js
```

### Fix Extension Not Appearing in UI
1. Check browser console for errors
2. Verify proxy extension enabled: `kubectl get cm argocd-cmd-params-cm -n argocd -o yaml | grep proxy`
3. Check RBAC policy includes extension permissions
4. Verify ArgoCD version >= 2.8.0

## Gotchas

### Critical Path Issues

**Tarball Structure (BREAKING)**
- ArgoCD expects: `/tmp/extensions/resources/glueops-links-extension/extensions.js`
- Common mistake: Creating `resources/extensions.js` (missing subdirectory)
- Correct build: `mkdir -p resources/glueops-links-extension && cp dist/extensions.js resources/glueops-links-extension/`

**Filename: extensions.js vs extension.js**
- Webpack outputs `extensions.js` (plural)
- Old docs may reference `extension.js` (singular)
- Webpack config line 8: `filename: 'extensions.js'`

**Version Sync**
- Three places must match: `package.json`, `helm-values.yaml` (2 locations), git tag
- Mismatch causes 404 when downloading from GitHub releases

**API Response Structure**
- Must include `metadata.last_updated` (ISO8601 timestamp)
- Must include `metadata.max_rows` (number, default 4)
- Categories array must include `status: "ok"|"empty"|"error"`

**React Externalization**
- Extension uses ArgoCD's bundled React
- Don't bundle React - use `externals: { react: 'React' }` in webpack

**Extension Name Consistency**
- Extension name: `glueops-links-extension` (with hyphens)
- Must match in: helm-values, webpack config, index.js registration, API path

### Known Issues

**Helm ConfigMap Not Applied**
- Sometimes `extension.config` doesn't apply during initial helm install
- Solution: Manually patch after install or run `helm upgrade`

**Port-Forward Instability**
- Kind cluster port-forwards can become stale
- Solution: Use `kubectl port-forward pod/<pod-name>` instead of `svc/<service-name>`

**Init Container Permissions**
- Init container runs as user 1000 (ubuntu)
- Extension files owned by that user
- Don't try to modify files from main container

## API Contract

### Request
```
GET /extensions/glueops-links-extension/api/v1/applications/{appName}/links
Headers:
  Argocd-Application-Name: {namespace}:{appName}
  Argocd-Project-Name: {projectName}
```

### Response
```json
{
  "categories": [
    {
      "id": "unique-id",
      "label": "Category Name",
      "icon": "🔗",
      "status": "ok",
      "links": [
        {"label": "Link Text", "url": "https://example.com"}
      ]
    }
  ],
  "metadata": {
    "last_updated": "2025-12-15T12:34:56Z",
    "max_rows": 3
  }
}
```

### Error States
- `status: "empty"` with `message: "No data"` - Shows muted message
- `status: "error"` with `message: "Error text"` - Shows muted message
- Network error/timeout - Shows "⚠️ Service Unavailable"

## Testing Checklist

Before releasing:
- [ ] Version updated in `package.json`
- [ ] Version updated in `helm-values.yaml` (2 places)
- [ ] Build succeeds: `npm run build`
- [ ] Tarball structure correct: `tar -tzf extension.tar.gz`
- [ ] Git tag matches package.json version
- [ ] GitHub Action completes successfully
- [ ] Tarball uploaded to GitHub release
- [ ] `./install-with-helm.sh` installs successfully
- [ ] Extension appears in ArgoCD UI
- [ ] API calls return expected data
- [ ] Error states display correctly
- [ ] Version number shows in UI

## File Locations

**Critical Files:**
- `extension/src/index.js` - Main extension code
- `extension/package.json` - Version source of truth
- `extension/webpack.config.js` - Build config
- `helm-values.yaml` - Deployment config
- `.github/workflows/release.yml` - CI/CD pipeline
- `install-with-helm.sh` - Automated test script

**Generated Files (gitignored):**
- `extension/dist/extensions.js` - Built extension
- `extension.tar.gz` - Distribution tarball
- `resources/` - Staging directory for tarball

## Backend Requirements

Your backend API must:
- Serve path: `/api/v1/applications/{appName}/links`
- Accept headers: `Argocd-Application-Name`, `Argocd-Project-Name`
- Return JSON matching the response structure above
- Handle CORS (or rely on ArgoCD proxy - recommended)

**Production Backend URL:** `https://api.glueops.dev`

**Path Resolution:**
Extension calls `/extensions/glueops-links-extension/api/v1/applications/guestbook/links`
→ ArgoCD proxies to `https://api.glueops.dev/api/v1/applications/guestbook/links`

## References

- [ArgoCD UI Extensions](https://argo-cd.readthedocs.io/en/stable/developer-guide/extensions/ui-extensions/)
- [ArgoCD Proxy Extensions](https://argo-cd.readthedocs.io/en/stable/developer-guide/extensions/proxy-extensions/)
- [Extension Installer](https://github.com/argoproj-labs/argocd-extension-installer)
