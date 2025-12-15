#!/bin/bash
set -e

echo "🚀 Deploying ArgoCD Quick Links Extension"
echo ""

# Check prerequisites
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install kubectl."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install Node.js and npm."
    exit 1
fi

# Build extension
echo "📦 Building extension..."
cd extension
npm install
npm run build
cd ..

# Package extension
echo "📦 Packaging extension..."
mkdir -p resources/app-links-extension
cp extension/dist/extension.js resources/app-links-extension/extension.js
tar -czf extension.tar.gz resources/
rm -rf resources/

# Create ConfigMap
echo "📦 Creating extension ConfigMap..."
kubectl create configmap extension-tar \
  --from-file=extension.tar.gz=extension.tar.gz \
  -n argocd \
  --dry-run=client -o yaml | kubectl apply -f -

# Enable proxy extension
echo "⚙️  Enabling proxy extension..."
kubectl patch configmap argocd-cmd-params-cm -n argocd --type merge \
  -p '{"data":{"server.enable.proxy.extension":"true"}}'

# Configure proxy extension backend (hardcoded Postman Echo URL)
echo "⚙️  Configuring proxy extension backend..."
kubectl patch configmap argocd-cm -n argocd --type merge \
  -p '{"data":{"extension.config":"extensions:\n- name: app-links-extension\n  backend:\n    services:\n    - url: https://postman-echo.com"}}'

# Configure RBAC
echo "⚙️  Configuring RBAC..."
kubectl patch configmap argocd-rbac-cm -n argocd --type merge \
  -p '{"data":{"policy.csv":"p, role:org-admin, extensions, invoke, app-links-extension, allow\np, role:admin, extensions, invoke, app-links-extension, allow\np, role:readonly, extensions, invoke, app-links-extension, allow\ng, admin, role:admin\ng, argocd, role:org-admin"}}'

# Add extension installer
echo "⚙️  Adding extension installer to ArgoCD server..."
kubectl patch deployment argocd-server -n argocd --type json -p '[
  {"op":"add","path":"/spec/template/spec/initContainers","value":[{"name":"argocd-extension-installer","image":"quay.io/argoprojlabs/argocd-extension-installer:v0.0.5@sha256:27e72f047298188e2de1a73a1901013c274c4760c92f82e6e46cd5fbd0957c6b","env":[{"name":"EXTENSION_NAME","value":"app-links-extension"},{"name":"EXTENSION_URL","value":"file:///extension/extension.tar.gz"},{"name":"EXTENSION_VERSION","value":"1.0.0"},{"name":"EXTENSION_ENABLED","value":"true"}],"volumeMounts":[{"name":"extensions","mountPath":"/tmp/extensions/"},{"name":"extension-tar","mountPath":"/extension","readOnly":true}],"securityContext":{"runAsUser":1000,"allowPrivilegeEscalation":false}}]},
  {"op":"add","path":"/spec/template/spec/volumes/-","value":{"name":"extensions","emptyDir":{}}},
  {"op":"add","path":"/spec/template/spec/volumes/-","value":{"name":"extension-tar","configMap":{"name":"extension-tar"}}},
  {"op":"add","path":"/spec/template/spec/containers/0/volumeMounts/-","value":{"name":"extensions","mountPath":"/tmp/extensions/"}}
]'

# Restart ArgoCD
echo "🔄 Restarting ArgoCD server..."
kubectl rollout restart deployment argocd-server -n argocd
echo "⏳ Waiting for ArgoCD to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=300s

# Verify
echo ""
echo "✅ Deployment complete!"
echo ""
echo "Verification:"
kubectl exec -n argocd $(kubectl get pods -n argocd -l app.kubernetes.io/name=argocd-server -o jsonpath='{.items[0].metadata.name}') \
  -- ls -lh /tmp/extensions/resources/app-links-extension/extension.js 2>/dev/null && echo "✅ Extension installed" || echo "❌ Extension not found"

echo "✅ Using Postman Echo as backend (https://postman-echo.com)"

echo ""
echo "Access ArgoCD:"
echo "  kubectl port-forward -n argocd svc/argocd-server 8080:443"
echo "  Then open https://localhost:8080"
