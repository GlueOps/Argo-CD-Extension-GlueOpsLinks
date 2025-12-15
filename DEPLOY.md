# Quick Deployment Guide

## One-Command Deployment (After ArgoCD is installed)

```bash
# 1. Build and package extension
cd extension && npm install && npm run build && cd ..
mkdir -p resources/app-links-extension
cp extension/dist/extension.js resources/app-links-extension/extension.js
tar -czf extension.tar.gz resources/

# 2. Deploy everything
kubectl create configmap extension-tar --from-file=extension.tar.gz=extension.tar.gz -n argocd
kubectl apply -f k8s/api-server.yaml
kubectl patch configmap argocd-cmd-params-cm -n argocd --type merge -p '{"data":{"server.enable.proxy.extension":"true"}}'
kubectl patch configmap argocd-cm -n argocd --type merge -p '{"data":{"extension.config":"extensions:\n- name: app-links-extension\n  backend:\n    services:\n    - url: http://app-links-api.argocd.svc.cluster.local:3000"}}'
kubectl patch configmap argocd-rbac-cm -n argocd --type merge -p '{"data":{"policy.csv":"p, role:org-admin, extensions, invoke, app-links-extension, allow\np, role:admin, extensions, invoke, app-links-extension, allow\np, role:readonly, extensions, invoke, app-links-extension, allow\ng, admin, role:admin\ng, argocd, role:org-admin"}}'
kubectl patch deployment argocd-server -n argocd --type json -p '[{"op":"add","path":"/spec/template/spec/initContainers","value":[{"name":"argocd-extension-installer","image":"quay.io/argoprojlabs/argocd-extension-installer:v0.0.5@sha256:27e72f047298188e2de1a73a1901013c274c4760c92f82e6e46cd5fbd0957c6b","env":[{"name":"EXTENSION_NAME","value":"app-links-extension"},{"name":"EXTENSION_URL","value":"file:///extension/extension.tar.gz"},{"name":"EXTENSION_VERSION","value":"1.0.0"},{"name":"EXTENSION_ENABLED","value":"true"}],"volumeMounts":[{"name":"extensions","mountPath":"/tmp/extensions/"},{"name":"extension-tar","mountPath":"/extension","readOnly":true}],"securityContext":{"runAsUser":1000,"allowPrivilegeEscalation":false}}]},{"op":"add","path":"/spec/template/spec/volumes/-","value":{"name":"extensions","emptyDir":{}}},{"op":"add","path":"/spec/template/spec/volumes/-","value":{"name":"extension-tar","configMap":{"name":"extension-tar"}}},{"op":"add","path":"/spec/template/spec/containers/0/volumeMounts/-","value":{"name":"extensions","mountPath":"/tmp/extensions/"}}]'
kubectl rollout restart deployment argocd-server -n argocd
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=300s

# 3. Verify
kubectl exec -n argocd $(kubectl get pods -n argocd -l app.kubernetes.io/name=argocd-server -o jsonpath='{.items[0].metadata.name}') -- ls -lh /tmp/extensions/resources/app-links-extension/extension.js
```

## Verification

```bash
# Check extension installed
kubectl exec -n argocd $(kubectl get pods -n argocd -l app.kubernetes.io/name=argocd-server -o jsonpath='{.items[0].metadata.name}') -- find /tmp/extensions -name "*.js"

# Check API server
kubectl get pods -n argocd -l app=app-links-api

# Test proxy endpoint (get token first)
TOKEN=$(curl -k -s 'https://localhost:8080/api/v1/session' -X POST -d 'username=admin&password=<password>' -H 'Content-Type: application/x-www-form-urlencoded' | jq -r '.token')
curl -k 'https://localhost:8080/extensions/app-links-extension/api/apps/<app-name>/links' \
  -H 'argocd-application-name: argocd:<app-name>' \
  -H 'argocd-project-name: default' \
  -b "argocd.token=${TOKEN}"
```
