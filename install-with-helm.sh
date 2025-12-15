#!/bin/bash
set -e


kind delete cluster || true
kind create cluster

echo "🚀 Installing ArgoCD with GlueOps Extension using Helm Chart"
echo ""

# Check prerequisites
if ! command -v helm &> /dev/null; then
    echo "❌ helm not found. Please install Helm v3.x."
    exit 1
fi

if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install kubectl."
    exit 1
fi

# Add Helm repository
echo "📦 Adding ArgoCD Helm repository..."
helm repo add argo https://argoproj.github.io/argo-helm 2>/dev/null || true
helm repo update

# Create namespace
echo "📦 Creating namespace..."
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -

# Extension will be downloaded automatically from GitHub releases during installation
echo "✅ Extension will be downloaded from GitHub releases automatically"

# Install ArgoCD with Helm
echo "📦 Installing ArgoCD with Helm chart..."
if [ ! -f helm-values.yaml ]; then
    echo "❌ helm-values.yaml not found. Please ensure it exists in the current directory."
    exit 1
fi

helm upgrade --install argocd argo/argo-cd \
  -f helm-values.yaml \
  -n argocd \
  --wait \
  --timeout 10m

# Wait for ArgoCD to be ready
echo "⏳ Waiting for ArgoCD server to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=300s

# Verify extension installation
echo ""
echo "✅ Verifying extension installation..."
if kubectl exec -n argocd $(kubectl get pods -n argocd -l app.kubernetes.io/name=argocd-server -o jsonpath='{.items[0].metadata.name}') \
  -- ls -lh /tmp/extensions/resources/app-links-extension/extensions.js 2>/dev/null; then
    echo "✅ Extension installed successfully!"
else
    echo "❌ Extension not found. Check logs:"
    echo "   kubectl logs -n argocd <argocd-server-pod> -c app-links-extension"
    exit 1
fi

# Get admin password
echo ""
echo "📋 ArgoCD Admin Credentials:"
echo "   Username: admin"
echo "   Password: $(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)"
echo ""

echo "✅ Installation complete!"
echo ""
echo "Access ArgoCD:"
echo "  kubectl port-forward -n argocd svc/argocd-server 8080:80"
echo "  Then open http://localhost:8080"
echo ""



kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: guestbook
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/argoproj/argocd-example-apps.git
    targetRevision: HEAD
    path: guestbook
  destination:
    server: https://kubernetes.default.svc
    namespace: guestbook
EOF