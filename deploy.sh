#!/usr/bin/env bash
# Copiloto -> GitHub Pages. Corre esto UNA vez: bash ~/copiloto/deploy.sh
set -e
cd "$(dirname "$0")"

OWNER="$(gh api user -q .login)"
REPO="copiloto"

echo "==> Cuenta GitHub: $OWNER"
echo "==> Creando repo público '$REPO' y subiendo..."
git remote remove origin 2>/dev/null || true
gh repo create "$REPO" --public --source=. --remote=origin --push

echo "==> Activando GitHub Pages (rama main, raíz)..."
gh api --method POST "repos/$OWNER/$REPO/pages" \
  --field 'source[branch]=main' --field 'source[path]=/' 2>/dev/null \
  || gh api --method PUT "repos/$OWNER/$REPO/pages" \
       --field 'source[branch]=main' --field 'source[path]=/' 2>/dev/null || true

URL="https://$OWNER.github.io/$REPO/"
echo ""
echo "======================================================"
echo "  LISTO. Tu tablero (dale ~1 min a que compile):"
echo "  $URL"
echo "======================================================"
echo ""
echo "En el iPad: abre esa URL en Safari -> Compartir -> Anadir a inicio."
