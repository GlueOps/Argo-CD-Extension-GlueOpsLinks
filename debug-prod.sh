#!/bin/bash
# Debug script for production cluster

echo "🔍 Debugging ArgoCD Extension Configuration"
echo ""

# Switch to production context (update this with your actual context name)
echo "Current context:"
kubectl config current-context
echo ""

echo "1. Check if proxy extension is enabled:"
kubectl get configmap argocd-cmd-params-cm -n argocd -o yaml | grep -A2 "server.enable.proxy.extension" || echo "   ❌ NOT ENABLED"
echo ""

echo "2. Check extension backend configuration:"
kubectl get configmap argocd-cm -n argocd -o yaml | grep -A10 "extension.config" || echo "   ❌ NOT CONFIGURED"
echo ""

echo "3. Check RBAC for extensions:"
kubectl get configmap argocd-rbac-cm -n argocd -o yaml | grep -A5 "extensions" || echo "   ❌ NO RBAC"
echo ""

echo "4. Check if extension files are installed:"
kubectl exec -n argocd $(kubectl get pods -n argocd -l app.kubernetes.io/name=argocd-server -o jsonpath='{.items[0].metadata.name}') -- ls -lh /tmp/extensions/resources/glueops-links-extension/ 2>/dev/null || echo "   ❌ EXTENSION FILES NOT FOUND"
echo ""

echo "5. Check ArgoCD server pod age (should be recent if restarted):"
kubectl get pods -n argocd -l app.kubernetes.io/name=argocd-server -o wide
echo ""

echo "6. Check ArgoCD server logs for extension errors:"
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-server --tail=30 | grep -i "extension\|proxy" || echo "   No extension logs found"
