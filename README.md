# ArgoCD UI Extension - GlueOps

A UI extension for ArgoCD that displays dynamic quick links for applications, using Postman Echo as a demonstration backend via ArgoCD's proxy extension.

## Features

- Displays "GlueOps" section with quick links (Dashboard, Logs, Metrics, Documentation) for each ArgoCD application
- Links are fetched server-side through ArgoCD's proxy extension (using Postman Echo)
- Appears as a status panel extension and app view extension in ArgoCD UI
- Graceful offline handling - shows "No Data. Refresh Page" when backend is unavailable

## Architecture

- **Extension**: React component that registers with ArgoCD's `extensionsAPI`
- **Proxy Endpoint**: Hardcoded in extension code as `/extensions/app-links-extension/get?appName=...`
- **Backend URL**: Hardcoded in deployment script as `https://postman-echo.com`
- **Proxy Extension**: ArgoCD proxies extension requests to Postman Echo, avoiding CORS issues

## Prerequisites

- Kubernetes cluster
- ArgoCD v3.2.0 or later installed
- `kubectl` configured and pointing to your cluster
- `npm` and `node` for building the extension

## Quick Start

### Option 1: Install with Helm Chart (Recommended)

The easiest way to install ArgoCD with the GlueOps extension is using the Helm chart. The extension is automatically downloaded from GitHub releases - no manual download needed!

```bash
# Run the automated installation script
./install-with-helm.sh
```

Or manually:

```bash
# 1. Add Helm repo
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update

# 2. Install ArgoCD with extension (extension downloads automatically from GitHub)
helm install argocd argo/argo-cd -f helm-values.yaml -n argocd --create-namespace --wait
```

The extension is configured to download from: `https://github.com/venkatamutyala/argocd-glueops-extension/releases/download/v1.0.0/extension.tar.gz`

See [HELM.md](HELM.md) for detailed instructions.

### Option 2: Download from GitHub Release

The extension is available as a pre-built release on GitHub:

```bash
# Download the extension
curl -L -o extension.tar.gz https://github.com/venkatamutyala/argocd-glueops-extension/releases/download/v1.0.0/extension.tar.gz

# Create ConfigMap
kubectl create configmap extension-tar \
  --from-file=extension.tar.gz=extension.tar.gz \
  -n argocd

# Continue with deployment steps below
```

### Option 3: Automated Deployment Script

```bash
./deploy.sh
```

### Option 4: Manual Deployment

Follow the step-by-step instructions in [DEPLOY.md](DEPLOY.md) or see the detailed guide below.

## GitHub Repository

- **Repository**: https://github.com/venkatamutyala/argocd-glueops-extension
- **Latest Release**: https://github.com/venkatamutyala/argocd-glueops-extension/releases/latest
- **Extension Download URL**: https://github.com/venkatamutyala/argocd-glueops-extension/releases/download/v1.0.0/extension.tar.gz

## Deployment Steps

### 1. Install ArgoCD (if not already installed)

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=300s
```

### 2. Build the Extension

```bash
cd extension
npm install
npm run build
cd ..
```

### 3. Package the Extension

```bash
mkdir -p resources/app-links-extension
cp extension/dist/extension.js resources/app-links-extension/extension.js
tar -czf extension.tar.gz resources/
```

### 4. Deploy Everything

```bash
# Create extension ConfigMap
kubectl create configmap extension-tar \
  --from-file=extension.tar.gz=extension.tar.gz \
  -n argocd

# Enable proxy extension
kubectl patch configmap argocd-cmd-params-cm -n argocd --type merge \
  -p '{"data":{"server.enable.proxy.extension":"true"}}'

# Configure proxy extension backend (hardcoded Postman Echo URL)
kubectl patch configmap argocd-cm -n argocd --type merge \
  -p '{"data":{"extension.config":"extensions:\n- name: app-links-extension\n  backend:\n    services:\n    - url: https://postman-echo.com"}}'

# Configure RBAC for extensions
kubectl patch configmap argocd-rbac-cm -n argocd --type merge \
  -p '{"data":{"policy.csv":"p, role:org-admin, extensions, invoke, app-links-extension, allow\np, role:admin, extensions, invoke, app-links-extension, allow\np, role:readonly, extensions, invoke, app-links-extension, allow\ng, admin, role:admin\ng, argocd, role:org-admin"}}'

# Add extension installer to ArgoCD server
kubectl patch deployment argocd-server -n argocd --type json -p '[
  {"op":"add","path":"/spec/template/spec/initContainers","value":[{"name":"argocd-extension-installer","image":"quay.io/argoprojlabs/argocd-extension-installer:v0.0.5@sha256:27e72f047298188e2de1a73a1901013c274c4760c92f82e6e46cd5fbd0957c6b","env":[{"name":"EXTENSION_NAME","value":"app-links-extension"},{"name":"EXTENSION_URL","value":"file:///extension/extension.tar.gz"},{"name":"EXTENSION_VERSION","value":"1.0.0"},{"name":"EXTENSION_ENABLED","value":"true"}],"volumeMounts":[{"name":"extensions","mountPath":"/tmp/extensions/"},{"name":"extension-tar","mountPath":"/extension","readOnly":true}],"securityContext":{"runAsUser":1000,"allowPrivilegeEscalation":false}}]},
  {"op":"add","path":"/spec/template/spec/volumes/-","value":{"name":"extensions","emptyDir":{}}},
  {"op":"add","path":"/spec/template/spec/volumes/-","value":{"name":"extension-tar","configMap":{"name":"extension-tar"}}},
  {"op":"add","path":"/spec/template/spec/containers/0/volumeMounts/-","value":{"name":"extensions","mountPath":"/tmp/extensions/"}}
]'

# Restart ArgoCD server
kubectl rollout restart deployment argocd-server -n argocd
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=300s
```

### 5. Verify Installation

```bash
# Check extension is installed
kubectl exec -n argocd $(kubectl get pods -n argocd -l app.kubernetes.io/name=argocd-server -o jsonpath='{.items[0].metadata.name}') \
  -- ls -lh /tmp/extensions/resources/app-links-extension/extension.js
```

## Access ArgoCD

```bash
# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Port-forward to access UI
kubectl port-forward -n argocd svc/argocd-server 8080:443
```

Then open `https://localhost:8080` in your browser and log in with:
- Username: `admin`
- Password: (from command above)

## Usage

1. Navigate to any ArgoCD Application
2. The "GlueOps" tab/panel will appear
3. Hover over link groups (Dashboard, Logs, Metrics, Documentation) to see dropdown menus
4. Click on links to navigate to external resources

## Backend Configuration

This extension uses **Postman Echo** (https://postman-echo.com) as a demonstration backend. The extension:
- Calls Postman Echo's `/get` endpoint with the application name
- Extracts the app name from the echo response
- Generates links client-side based on the app name

To use your own backend, update the `extension.config` in `argocd-cm` to point to your service URL.

## Troubleshooting

### Extension not appearing
- Check extension is installed: `kubectl exec -n argocd <pod> -- ls /tmp/extensions/resources/app-links-extension/`
- Check browser console for errors
- Verify `extensions.js` is being served: `curl -k https://localhost:8080/extensions.js`

### 401 Unauthorized errors
- Verify RBAC policy includes: `p, role:admin, extensions, invoke, app-links-extension, allow`
- Check token is valid and not expired
- Ensure `Argocd-Application-Name` header format is `namespace:app-name`

### API calls failing
- Check proxy extension is enabled: `kubectl get configmap argocd-cmd-params-cm -n argocd -o jsonpath='{.data.server\.enable\.proxy\.extension}'`
- Verify backend URL in `argocd-cm`: `kubectl get configmap argocd-cm -n argocd -o jsonpath='{.data.extension\.config}'`
- Verify Postman Echo is accessible: `curl https://postman-echo.com/get?test=1`

## Project Structure

```
argocd-ui-extension/
├── extension/
│   ├── src/
│   │   └── index.js          # Extension source code
│   ├── package.json
│   ├── webpack.config.js
│   └── dist/                  # Built extension (generated)
├── k8s/                        # (No backend deployment needed - uses Postman Echo)
├── deploy.sh                  # Automated deployment script
├── DEPLOY.md                  # Quick deployment reference
├── README.md                  # This file
└── .gitignore
```

## References

- [ArgoCD UI Extensions Documentation](https://github.com/argoproj/argo-cd/tree/master/docs/developer-guide/extensions)
- [ArgoCD Proxy Extensions Documentation](https://github.com/argoproj/argo-cd/blob/master/docs/developer-guide/extensions/proxy-extensions.md)
- [ArgoCD Extension Installer](https://github.com/argoproj-labs/argocd-extension-installer)

