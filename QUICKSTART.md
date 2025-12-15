# Quick Start Guide

## For a Brand New ArgoCD Installation

### Step 1: Install ArgoCD

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=300s
```

### Step 2: Deploy the Extension

Run the automated deployment script:

```bash
./deploy.sh
```

Or follow the manual steps in [README.md](README.md).

### Step 3: Access ArgoCD

```bash
# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Port-forward
kubectl port-forward -n argocd svc/argocd-server 8080:443
```

Open `https://localhost:8080` and log in with username `admin` and the password from above.

### Step 4: Verify

1. Navigate to any ArgoCD Application
2. Look for "GlueOps" tab/panel
3. Hover over link groups to see dropdown menus
4. Click on the links to verify they work

## What Gets Deployed

- **Extension**: Installed into ArgoCD server at `/tmp/extensions/resources/app-links-extension/extension.js`
- **Proxy Endpoint**: Hardcoded in extension as `/extensions/app-links-extension/get?appName=...`
- **Backend URL**: Hardcoded in deployment script as `https://postman-echo.com` (configured in ArgoCD ConfigMap)
- **Proxy Extension**: ArgoCD proxies requests from extension to Postman Echo

## Files in This Project

- `extension/src/index.js` - Extension source code
- `deploy.sh` - Automated deployment script
- `README.md` - Full documentation
- `DEPLOY.md` - Quick deployment reference
