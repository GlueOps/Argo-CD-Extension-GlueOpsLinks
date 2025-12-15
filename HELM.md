# Installing ArgoCD with GlueOps Extension using Helm Chart

This guide shows how to install ArgoCD with the GlueOps extension using the official ArgoCD Helm chart. This is the **recommended** installation method.

## Quick Start

Run the automated installation script:

```bash
./install-with-helm.sh
```

This will handle everything automatically. For manual installation, see below.

## Prerequisites

- Kubernetes cluster
- `kubectl` configured
- `helm` v3.x installed
- `curl` for downloading the extension

## Installation Steps

### 1. Add ArgoCD Helm Repository

```bash
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update
```

### 2. Install ArgoCD with Extension

The extension is automatically downloaded from GitHub releases during installation. No manual download or ConfigMap creation needed!

```bash
kubectl create namespace argocd
```

```bash
helm install argocd argo/argo-cd \
  -f helm-values.yaml \
  -n argocd \
  --wait
```

### 5. Wait for ArgoCD to be Ready

```bash
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=300s
```

### 4. Get Admin Password

```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d && echo
```

### 5. Access ArgoCD

```bash
kubectl port-forward -n argocd svc/argocd-server 8080:443
```

Then open `https://localhost:8080` in your browser (accept the self-signed certificate).

## Verification

Check that the extension is installed:

```bash
kubectl exec -n argocd $(kubectl get pods -n argocd -l app.kubernetes.io/name=argocd-server -o jsonpath='{.items[0].metadata.name}') \
  -- ls -lh /tmp/extensions/resources/app-links-extension/extension.js
```

## Updating the Extension

To update to a new version:

1. Update the `EXTENSION_URL` in `helm-values.yaml` to point to the new release:
   ```yaml
   - name: EXTENSION_URL
     value: https://github.com/venkatamutyala/argocd-glueops-extension/releases/download/v1.0.1/extension.tar.gz
   ```

2. Upgrade the Helm release:
   ```bash
   helm upgrade argocd argo/argo-cd -f helm-values.yaml -n argocd
   ```

3. The extension will be automatically downloaded and installed on the next pod restart.

## Uninstallation

```bash
helm uninstall argocd -n argocd
```

No ConfigMap cleanup needed - the extension is downloaded directly from GitHub!

## Configuration

All configuration is done via `helm-values.yaml`:

- **Proxy Extension**: Enabled via `configs.params.server.enable.proxy.extension: "true"`
- **Backend URL**: Configured in `server.config.extension.config` (hardcoded to Postman Echo)
- **RBAC**: Configured in `configs.rbac.policy.csv`
- **Extension Installer**: Configured in `server.initContainers`
- **Volumes**: Configured in `server.volumes` and `server.volumeMounts`

## Troubleshooting

### Extension not loading

1. Check the init container logs:
   ```bash
   kubectl logs -n argocd <argocd-server-pod> -c argocd-extension-installer
   ```

2. Verify the extension URL is accessible:
   ```bash
   curl -I https://github.com/venkatamutyala/argocd-glueops-extension/releases/download/v1.0.0/extension.tar.gz
   ```

3. Check if extension file exists in pod:
   ```bash
   kubectl exec -n argocd <argocd-server-pod> -- ls -lh /tmp/extensions/resources/app-links-extension/
   ```

### Proxy extension not working

1. Verify proxy is enabled:
   ```bash
   kubectl get configmap argocd-cmd-params-cm -n argocd -o yaml | grep proxy
   ```

2. Check backend configuration:
   ```bash
   kubectl get configmap argocd-cm -n argocd -o yaml | grep -A 5 extension.config
   ```

3. If `extension.config` is missing from `argocd-cm` (even though it's in `helm-values.yaml`), manually patch it:
   ```bash
   kubectl patch configmap argocd-cm -n argocd --type merge \
     -p '{"data":{"extension.config":"extensions:\n- name: app-links-extension\n  backend:\n    services:\n    - url: https://postman-echo.com\n"}}'
   
   kubectl rollout restart deployment argocd-server -n argocd
   ```
   
   After patching, check the logs to confirm registration:
   ```bash
   kubectl logs -n argocd <argocd-server-pod> | grep -i "extensions configs updated"
   ```
   
   You should see: `extensions configs updated successfully`
   
   Note: This is a known issue where Helm may not apply `server.config.extension.config` to the ConfigMap during initial installation. The Helm values file is correct, but you may need to manually patch the ConfigMap or upgrade Helm release. After the ConfigMap is updated, ArgoCD will automatically detect the change and register the extension.

