#!/bin/bash
# Replace full package.json with a minimal one so EB only installs bcrypt.
# Everything else is already bundled into dist/index.cjs by esbuild.
set -e
cd /var/app/staging

cat > package.json << 'EOF'
{
  "name": "ayurvedicdoc",
  "version": "1.0.0",
  "description": "Minimal runtime deps for EB — all others are bundled.",
  "dependencies": {
    "bcryptjs": "^2.4.3"
  }
}
EOF

rm -f package-lock.json
