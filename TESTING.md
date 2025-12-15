# Testing Guide

## Full Deployment Test with KIND

This document describes the complete testing process for the ArgoCD GlueOps Extension.

### Prerequisites

- `kind` installed
- `kubectl` configured
- `gh` CLI installed and authenticated

### Test Process

1. **Create KIND Cluster**
   ```bash
   kind create cluster --name argocd-test
   ```

2. **Install ArgoCD**
   ```bash
   kubectl create namespace argocd
   kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
   kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=300s
   ```

3. **Download Extension from GitHub Release**
   ```bash
   curl -L -o extension.tar.gz https://github.com/venkatamutyala/argocd-glueops-extension/releases/download/v1.0.0/extension.tar.gz
   ```

4. **Deploy Extension**
   ```bash
   kubectl create configmap extension-tar \
     --from-file=extension.tar.gz=extension.tar.gz \
     -n argocd
   
   kubectl patch configmap argocd-cmd-params-cm -n argocd --type merge \
     -p '{"data":{"server.enable.proxy.extension":"true"}}'
   
   kubectl patch configmap argocd-cm -n argocd --type merge \
     -p '{"data":{"extension.config":"extensions:\n- name: app-links-extension\n  backend:\n    services:\n    - url: https://postman-echo.com"}}'
   
   kubectl patch configmap argocd-rbac-cm -n argocd --type merge \
     -p '{"data":{"policy.csv":"p, role:org-admin, extensions, invoke, app-links-extension, allow\np, role:admin, extensions, invoke, app-links-extension, allow\np, role:readonly, extensions, invoke, app-links-extension, allow\ng, admin, role:admin\ng, argocd, role:org-admin"}}'
   
   kubectl patch deployment argocd-server -n argocd --type json -p '[{"op":"add","path":"/spec/template/spec/initContainers","value":[{"name":"argocd-extension-installer","image":"quay.io/argoprojlabs/argocd-extension-installer:v0.0.5@sha256:27e72f047298188e2de1a73a1901013c274c4760c92f82e6e46cd5fbd0957c6b","env":[{"name":"EXTENSION_NAME","value":"app-links-extension"},{"name":"EXTENSION_URL","value":"file:///extension/extension.tar.gz"},{"name":"EXTENSION_VERSION","value":"1.0.0"},{"name":"EXTENSION_ENABLED","value":"true"}],"volumeMounts":[{"name":"extensions","mountPath":"/tmp/extensions/"},{"name":"extension-tar","mountPath":"/extension","readOnly":true}],"securityContext":{"runAsUser":1000,"allowPrivilegeEscalation":false}}]},{"op":"add","path":"/spec/template/spec/volumes/-","value":{"name":"extensions","emptyDir":{}}},{"op":"add","path":"/spec/template/spec/volumes/-","value":{"name":"extension-tar","configMap":{"name":"extension-tar"}}},{"op":"add","path":"/spec/template/spec/containers/0/volumeMounts/-","value":{"name":"extensions","mountPath":"/tmp/extensions/"}}]'
   
   kubectl rollout restart deployment argocd-server -n argocd
   kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=300s
   ```

5. **Verify Installation**
   ```bash
   kubectl exec -n argocd $(kubectl get pods -n argocd -l app.kubernetes.io/name=argocd-server -o jsonpath='{.items[0].metadata.name}') \
     -- ls -lh /tmp/extensions/resources/app-links-extension/extension.js
   ```

### Expected Results

- ✅ Extension file exists at `/tmp/extensions/resources/app-links-extension/extension.js`
- ✅ Extension file size is ~3.9KB
- ✅ ArgoCD server pod is running
- ✅ Extension is loaded and accessible in ArgoCD UI

### Cleanup

```bash
kind delete cluster --name argocd-test
```

