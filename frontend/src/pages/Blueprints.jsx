import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, ArrowRight, Bookmark, CheckCircle, Clock, Code, Copy, Cpu, Download, Eye, FileText, HardDrive, Search, Settings, Shield, Star, X, Zap } from 'lucide-react';
import { useState } from 'react';

// Mock Blueprint Data
const blueprintsData = [
    {
        id: 1,
        title: "Hardened Nginx Proxy",
        category: "Network",
        description: "Zero-config reverse proxy with automatic SSL via Let's Encrypt and A+ security headers.",
        difficulty: "Advanced",
        tags: ["Nginx", "SSL", "Reverse Proxy", "Security"],
        deployTime: "3 min",
        cpu: "2 CPU",
        ram: "512 MB",
        rating: 4.8,
        reviews: 156,
        recommended: true,
        recentlyUsed: true,
        docs: "Configure Nginx with automatic SSL renewal, HTTP/2 support, and security headers.",
        config: "worker_processes auto;\nworker_connections 2048;\nenableSSL true;",
        code: `#!/bin/bash
# Hardened Nginx Installation (Cross-Platform)
set -euo pipefail

UNAME="$(uname -s)"
echo "Detecting OS: $UNAME"

# Sudo handling (Linux only). Prompts at most once.
SUDO_SESSION_STARTED=0
ensure_sudo() {
  if [[ $EUID -eq 0 ]]; then
    return 0
  fi
  if [[ $SUDO_SESSION_STARTED -eq 0 ]]; then
    sudo -v
    SUDO_SESSION_STARTED=1
    ( while true; do sudo -n true; sleep 60; kill -0 "$$" || exit; done ) 2>/dev/null &
  fi
}

CONFIG_PATH=""

if [[ "$UNAME" == "Darwin" ]]; then
  if [[ $EUID -eq 0 ]]; then
    echo "Error: Do not run this script with sudo/root on macOS (Homebrew blocks root)."
    exit 1
  fi

  if ! command -v brew >/dev/null 2>&1; then
    echo "Homebrew is required. Install it from https://brew.sh/"
    exit 1
  fi

  echo "Installing Nginx + Certbot on macOS..."
  brew install nginx certbot
  CONFIG_PATH="$(brew --prefix)/etc/nginx"
elif [[ "$UNAME" == "Linux" ]]; then
  echo "Installing Nginx + Certbot on Linux..."
  ensure_sudo
  if command -v apt >/dev/null 2>&1; then
    sudo apt update
    sudo apt install -y nginx certbot python3-certbot-nginx
    CONFIG_PATH="/etc/nginx"
  elif command -v yum >/dev/null 2>&1; then
    sudo yum install -y nginx certbot python3-certbot-nginx
    CONFIG_PATH="/etc/nginx"
  else
    echo "No supported package manager found (apt/yum)."
    exit 1
  fi
else
  echo "❌ Unsupported OS. Use WSL on Windows."
  exit 1
fi

echo "Configuring SSL..."
if [[ "$UNAME" == "Linux" ]]; then
  sudo certbot certonly --standalone -d example.com --agree-tos --non-interactive || true
else
  certbot certonly --standalone -d example.com --agree-tos --non-interactive || true
fi

echo "Setting security headers..."
if [[ "$UNAME" == "Darwin" ]]; then
  tee "$CONFIG_PATH/conf.d/security.conf" > /dev/null << 'EOF'
add_header Strict-Transport-Security "max-age=31536000" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header X-Content-Type-Options "nosniff" always;
EOF
  brew services restart nginx
else
  ensure_sudo
  sudo tee "$CONFIG_PATH/conf.d/security.conf" > /dev/null << 'EOF'
add_header Strict-Transport-Security "max-age=31536000" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header X-Content-Type-Options "nosniff" always;
EOF
  sudo systemctl restart nginx
fi

echo "✓ Nginx hardened successfully"`
    },
    {
        id: 2,
        title: "Docker Fleet Hardening",
        category: "Security",
        description: "Applies CIS Docker benchmarks to prevent container breakout and unauthorized access.",
        difficulty: "Critical",
        tags: ["Docker", "Security", "CIS", "Containers"],
        deployTime: "5 min",
        cpu: "1 CPU",
        ram: "256 MB",
        rating: 4.9,
        reviews: 213,
        recommended: true,
        recentlyUsed: false,
        docs: "Hardens Docker daemon with CIS security benchmarks. Enables content trust and resource limits.",
        config: "enable-icc=false\nuserland-proxy=false\nlog-driver=json-file",
        code: `#!/bin/bash
# Docker CIS Hardening (Cross-Platform)
set -euo pipefail

UNAME="$(uname -s)"
echo "Detecting OS: $UNAME"

# Sudo handling (Linux only). Prompts at most once.
SUDO_SESSION_STARTED=0
ensure_sudo() {
  if [[ $EUID -eq 0 ]]; then
    return 0
  fi
  if [[ $SUDO_SESSION_STARTED -eq 0 ]]; then
    sudo -v
    SUDO_SESSION_STARTED=1
    ( while true; do sudo -n true; sleep 60; kill -0 "$$" || exit; done ) 2>/dev/null &
  fi
}

if [[ "$UNAME" == "Darwin" ]]; then
  echo "macOS detected - Docker Desktop uses native architecture"
  DOCKER_CONFIG="$HOME/.docker"
  mkdir -p "$DOCKER_CONFIG"
elif [[ "$UNAME" == "Linux" ]]; then
  echo "Linux detected - Configuring Docker daemon"
  DOCKER_CONFIG="/etc/docker"
  ensure_sudo
  sudo mkdir -p "$DOCKER_CONFIG"
else
  echo "❌ Unsupported OS. Use WSL on Windows."
  exit 1
fi

echo "Configuring Docker daemon security..."
if [[ "$UNAME" == "Darwin" ]]; then
  cat > "$DOCKER_CONFIG/daemon.json" << 'EOF'
{
  "icc": false,
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "live-restore": true
}
EOF
  echo "⚠️ Manual Step: Open Docker Desktop → Settings → Docker Engine and paste the config"
else
  ensure_sudo
  sudo tee "$DOCKER_CONFIG/daemon.json" > /dev/null << 'EOF'
{
  "icc": false,
  "userland-proxy": false,
  "log-driver": "json-file",
  "storage-driver": "overlay2",
  "live-restore": true,
  "userns-remap": "default"
}
EOF
  echo "dockremap:100000:65536" | sudo tee -a /etc/subuid /etc/subgid || true
  sudo systemctl restart docker
fi
echo "✓ Docker hardened successfully"`
    },
    {
        id: 3,
        title: "PostgreSQL Auto-Scaler",
        category: "Database",
        description: "Optimizes shared buffers and worker processes based on hardware profile.",
        difficulty: "Beginner",
        tags: ["PostgreSQL", "Database", "Performance", "Auto-scaling"],
        deployTime: "2 min",
        cpu: "1 CPU",
        ram: "1 GB",
        rating: 4.6,
        reviews: 98,
        recommended: false,
        recentlyUsed: false,
        docs: "Automatically tunes PostgreSQL parameters for optimal performance on your hardware.",
        config: "max_connections=200\nshared_buffers=4GB\nwork_mem=20MB",
        code: `#!/bin/bash
# PostgreSQL Auto-Scaler (Cross-Platform)
set -euo pipefail

UNAME="$(uname -s)"
echo "Detecting OS: $UNAME"

# Sudo handling (Linux only). Prompts at most once.
SUDO_SESSION_STARTED=0
ensure_sudo() {
  if [[ $EUID -eq 0 ]]; then
    return 0
  fi
  if [[ $SUDO_SESSION_STARTED -eq 0 ]]; then
    sudo -v
    SUDO_SESSION_STARTED=1
    ( while true; do sudo -n true; sleep 60; kill -0 "$$" || exit; done ) 2>/dev/null &
  fi
}

run_psql() {
  if [[ "$UNAME" == "Linux" ]] && id postgres >/dev/null 2>&1; then
    ensure_sudo
    sudo -u postgres psql "$@"
  else
    psql "$@"
  fi
}

# Calculate available RAM based on OS
if [[ "$UNAME" == "Darwin" ]]; then
    echo "Detecting RAM on macOS..."
    TOTAL_RAM=$(($(sysctl -n hw.memsize) / 1024 / 1024))
    PG_SOCKET="/tmp"
elif [[ "$UNAME" == "Linux" ]]; then
    echo "Detecting RAM on Linux..."
    TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
    PG_SOCKET="/var/run/postgresql"
else
    echo "❌ Unsupported OS. Use WSL on Windows."
    exit 1
fi

SCALED_BUFFERS=$((TOTAL_RAM / 4))
WORK_MEM=$((SCALED_BUFFERS / 4))
MAINT_MEM=$((SCALED_BUFFERS / 2))

echo "Optimizing PostgreSQL for $TOTAL_RAM MB RAM..."
echo "shared_buffers: \${SCALED_BUFFERS}MB, work_mem: \${WORK_MEM}MB, maintenance_work_mem: \${MAINT_MEM}MB"

run_psql -h "$PG_SOCKET" << EOF
ALTER SYSTEM SET shared_buffers = '\${SCALED_BUFFERS}MB';
ALTER SYSTEM SET work_mem = '\${WORK_MEM}MB';
ALTER SYSTEM SET maintenance_work_mem = '\${MAINT_MEM}MB';
SELECT pg_reload_conf();
EOF

echo "✓ PostgreSQL optimized successfully"`
    },
    {
        id: 4,
        title: "MERN Stack Deployer",
        category: "Cloud",
        description: "One-click deployment for MongoDB, Express, React, Node.js with PM2.",
        difficulty: "Advanced",
        tags: ["MERN", "Node", "MongoDB", "Full Stack"],
        deployTime: "8 min",
        cpu: "2 CPU",
        ram: "2 GB",
        rating: 4.7,
        reviews: 323,
        recommended: false,
        recentlyUsed: true,
        docs: "Complete MERN stack setup with MongoDB connection, PM2 process management, and Nginx proxy.",
        config: "NODE_ENV=production\nPORT=3000\nDB_HOST=localhost:27017",
        code: `#!/bin/bash
# MERN Stack Deployer (Cross-Platform)
set -euo pipefail

UNAME="$(uname -s)"
echo "Detecting OS: $UNAME"

# NPM registry/network preflight (fails fast with actionable hints)
NPM_REGISTRY="\${NPM_REGISTRY:-https://registry.npmjs.org/}"

check_npm_network() {
  echo "Checking connectivity to npm registry: $NPM_REGISTRY"

  # DNS/HTTPS check (curl is available by default on macOS; Linux typically has it too)
  if command -v curl >/dev/null 2>&1; then
    if ! curl -Is --max-time 8 "$NPM_REGISTRY" >/dev/null 2>&1; then
      echo "❌ Cannot reach $NPM_REGISTRY (DNS/Network/Proxy issue)."
      echo
      echo "Fix ideas:"
      echo "  - Verify internet: open a website / try: curl -I https://example.com"
      echo "  - If behind a proxy, export HTTP(S)_PROXY and NO_PROXY before running."
      echo "  - Check npm registry config: npm config get registry"
      echo "  - Set registry explicitly: npm config set registry '$NPM_REGISTRY'"
      echo "  - macOS DNS quick try: networksetup -setdnsservers Wi-Fi 1.1.1.1 8.8.8.8"
      echo
      exit 1
    fi
  fi

  # npm ping (more specific)
  if command -v npm >/dev/null 2>&1; then
    npm config set registry "$NPM_REGISTRY" >/dev/null 2>&1 || true
    if ! npm ping --silent >/dev/null 2>&1; then
      echo "❌ npm cannot reach the registry (check proxy/DNS)."
      echo "Try: npm config set registry '$NPM_REGISTRY'"
      exit 1
    fi
  fi
}

# Sudo handling (Linux only). Prompts at most once.
SUDO_SESSION_STARTED=0
ensure_sudo() {
  if [[ $EUID -eq 0 ]]; then
    return 0
  fi
  if [[ $SUDO_SESSION_STARTED -eq 0 ]]; then
    sudo -v
    SUDO_SESSION_STARTED=1
    ( while true; do sudo -n true; sleep 60; kill -0 "$$" || exit; done ) 2>/dev/null &
  fi
}

install_mongodb_macos() {
  if [[ $EUID -eq 0 ]]; then
    echo "Error: Do not run this installer with sudo/root on macOS (Homebrew blocks root)."
    exit 1
  fi
  if ! command -v brew >/dev/null 2>&1; then
    echo "Homebrew is required. Install it from https://brew.sh/"
    exit 1
  fi

  brew tap mongodb/brew

  formula=""
  for f in mongodb-community@8.0 mongodb-community@7.0 mongodb-community@6.0 mongodb-community; do
    if brew info "$f" >/dev/null 2>&1; then
      formula="$f"
      break
    fi
  done

  if [[ -z "$formula" ]]; then
    echo "Could not find a MongoDB Community formula via Homebrew."
    echo "Try: brew search mongodb-community"
    exit 1
  fi

  brew install "$formula"
  brew services start "$formula" || true

  sleep 2
  if pgrep mongod >/dev/null 2>&1; then
    echo "✓ MongoDB service started successfully"
  else
    echo "⚠️  MongoDB service may not be running - check manually"
  fi
}

APP_DIR="\${APP_DIR:-}"

has_package_json() {
  local candidate="$1"
  [[ -n "$candidate" && -f "$candidate/package.json" ]]
}

looks_like_node_app() {
  local candidate="$1"
  if ! has_package_json "$candidate"; then
    return 1
  fi

  grep -q '"start"' "$candidate/package.json" || grep -q '"dev"' "$candidate/package.json"
}

auto_detect_app_dir() {
  local candidates=()
  local git_root=""

  candidates+=("$(pwd)")

  if command -v git >/dev/null 2>&1; then
    git_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
    if [[ -n "$git_root" ]]; then
      candidates+=("$git_root")
    fi
  fi

  candidates+=("$HOME/UniFix" "$HOME/mern-app" "$HOME/projects" "$HOME/Projects" "$HOME/Desktop")

  for candidate in "\${candidates[@]}"; do
    if looks_like_node_app "$candidate"; then
      APP_DIR="$candidate"
      return 0
    fi
  done

  if command -v find >/dev/null 2>&1; then
    while IFS= read -r package_file; do
      local candidate
      candidate="$(dirname "$package_file")"
      case "$candidate" in
        */node_modules/*|*/.next/*|*/dist/*|*/build/*) continue ;;
      esac
      if looks_like_node_app "$candidate"; then
        APP_DIR="$candidate"
        return 0
      fi
    done < <(find "$HOME" -maxdepth 4 -name package.json 2>/dev/null)
  fi

  return 1
}

if [[ "$UNAME" == "Darwin" ]]; then
  echo "Installing Node.js and MongoDB on macOS..."
  if [[ $EUID -eq 0 ]]; then
    echo "Error: Do not run this script with sudo/root on macOS."
    exit 1
  fi

  brew install node
  install_mongodb_macos
  if [[ -z "$APP_DIR" ]]; then
    auto_detect_app_dir || APP_DIR="$HOME/mern-app"
  fi
elif [[ "$UNAME" == "Linux" ]]; then
  echo "Installing Node.js and MongoDB on Linux..."
  ensure_sudo

  if command -v apt >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt update
    sudo apt install -y nodejs

    # NOTE: 'mongodb-org' requires the official MongoDB repo. If this fails, follow MongoDB's docs for your distro.
    sudo apt install -y mongodb-org || true

    sudo systemctl daemon-reload || true
    sudo systemctl start mongod || true
    sudo systemctl enable mongod || true
  elif command -v yum >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo yum install -y nodejs
    sudo yum install -y mongodb-org || true
    sudo systemctl start mongod || true
    sudo systemctl enable mongod || true
  else
    echo "No supported package manager found (apt/yum)."
    exit 1
  fi

  if [[ -z "$APP_DIR" ]]; then
    auto_detect_app_dir || APP_DIR="/var/www/mern-app"
  fi
  sudo mkdir -p "$APP_DIR"
  sudo chown -R "$(whoami)" "$APP_DIR"
else
  echo "❌ Unsupported OS. Use WSL on Windows."
  exit 1
fi

echo "Deploying MERN application..."
mkdir -p "$APP_DIR"
cd "$APP_DIR"

if [[ ! -f package.json ]]; then
  echo "❌ No package.json found in: $APP_DIR"
  echo
  echo "This blueprint expects an existing MERN app directory."
  echo "Auto-detection did not find one with a usable start/dev script."
  echo "Set APP_DIR to your real project root before running, for example:"
  echo '  export APP_DIR="$HOME/path-to-your-mern-project"'
  echo
  echo "Then re-run the script."
  exit 1
fi

if [[ ! -w "$APP_DIR" ]]; then
  echo "❌ App directory is not writable: $APP_DIR"
  exit 1
fi

echo "Using app directory: $APP_DIR"

check_npm_network

if ! command -v pm2 >/dev/null 2>&1; then
  echo "Installing PM2..."
  npm install -g pm2
fi

npm install

if npm run | grep -q " build"; then
  npm run build
else
  echo "No build script found in package.json, skipping build."
fi

if npm run | grep -q " start"; then
  pm2 start "npm start" --name "mern-app" --instances 2
else
  echo "❌ No start script found in package.json."
  exit 1
fi

if [[ "$UNAME" == "Darwin" ]]; then
  pm2 save
  pm2 startup launchd -u "$(whoami)" --hp "$HOME"
else
  ensure_sudo
  sudo pm2 startup systemd -u "$(whoami)" --hp "/home/$(whoami)"
  pm2 save
fi

echo "✓ MERN stack deployed successfully"`
    },
    {
        id: 5,
        title: "Prometheus Monitoring",
        category: "Cloud",
        description: "Complete monitoring stack with Prometheus, Grafana, and AlertManager.",
        difficulty: "Advanced",
        tags: ["Prometheus", "Grafana", "Monitoring", "Observability"],
        deployTime: "6 min",
        cpu: "2 CPU",
        ram: "1.5 GB",
        rating: 4.5,
        reviews: 167,
        recommended: true,
        recentlyUsed: false,
        docs: "Deploy Prometheus for metrics collection, Grafana for visualization, and AlertManager for alerts.",
        config: "scrape_interval: 15s\nevaluation_interval: 15s",
        code: `#!/bin/bash
# Prometheus Monitoring Stack (Cross-Platform)
set -euo pipefail

UNAME="$(uname -s)"
echo "Detecting OS: $UNAME"

# Sudo handling (Linux only). Prompts at most once.
SUDO_SESSION_STARTED=0
ensure_sudo() {
  if [[ $EUID -eq 0 ]]; then
    return 0
  fi
  if [[ $SUDO_SESSION_STARTED -eq 0 ]]; then
    sudo -v
    SUDO_SESSION_STARTED=1
    ( while true; do sudo -n true; sleep 60; kill -0 "$$" || exit; done ) 2>/dev/null &
  fi
}

if [[ "$UNAME" == "Darwin" ]]; then
    echo "Installing Prometheus stack on macOS..."
    brew install prometheus grafana node_exporter
    brew services start prometheus
    brew services start grafana
    echo "ℹ️  Grafana running at http://localhost:3000 (admin/admin)"
elif [[ "$UNAME" == "Linux" ]]; then
    echo "Installing Prometheus stack on Linux..."
    ensure_sudo
    
    # Create prometheus user
    sudo useradd --no-create-home --shell /bin/false prometheus || true
    
    # Install from prebuilt binaries
    cd /tmp
    if command -v wget &> /dev/null; then
        wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz
    else
        curl -L -O https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz
    fi
    tar xvf prometheus-2.45.0.linux-amd64.tar.gz
    sudo cp prometheus-2.45.0.linux-amd64/prometheus /usr/local/bin/
    sudo chown prometheus:prometheus /usr/local/bin/prometheus
    
    # Install Grafana
    if command -v apt &> /dev/null; then
        sudo apt install -y grafana-server
    elif command -v yum &> /dev/null; then
        sudo yum install -y grafana
    fi
    
    sudo systemctl enable prometheus grafana-server
    sudo systemctl start prometheus grafana-server
    echo "ℹ️  Grafana running at http://localhost:3000 (admin/admin)"
else
    echo "❌ Unsupported OS. Use WSL on Windows."
    exit 1
fi

echo "✓ Monitoring stack deployed"`
    },
    {
        id: 6,
        title: "Kubernetes Cluster Setup",
        category: "Cloud",
        description: "Automated K3s installation with secure defaults for production.",
        difficulty: "Critical",
        tags: ["Kubernetes", "K3s", "Containers", "Orchestration"],
        deployTime: "10 min",
        cpu: "4 CPU",
        ram: "4 GB",
        rating: 4.8,
        reviews: 289,
        recommended: true,
        recentlyUsed: false,
        docs: "Deploy lightweight Kubernetes cluster using K3s with TLS, RBAC, and network policies.",
        config: "K3S_VERSION=latest\nISCISI_DEPLOY=true\nTRAEFIK_ENABLED=true",
        code: `#!/bin/bash
# Kubernetes Cluster Setup with K3s (Cross-Platform)
set -euo pipefail

UNAME="$(uname -s)"
echo "Detecting OS: $UNAME"

# Sudo handling (Linux only). Prompts at most once.
SUDO_SESSION_STARTED=0
ensure_sudo() {
  if [[ $EUID -eq 0 ]]; then
    return 0
  fi
  if [[ $SUDO_SESSION_STARTED -eq 0 ]]; then
    sudo -v
    SUDO_SESSION_STARTED=1
    ( while true; do sudo -n true; sleep 60; kill -0 "$$" || exit; done ) 2>/dev/null &
  fi
}

if [[ "$UNAME" == "Darwin" ]]; then
    echo "Installing K3s on macOS..."
    echo "⚠️  Note: K3s is primarily for Linux."
    echo "Install Docker Desktop manually and enable Kubernetes:"
    echo "  Docker Desktop → Settings → Kubernetes → Enable Kubernetes"
    echo "Then verify with: kubectl get nodes"
elif [[ "$UNAME" == "Linux" ]]; then
    echo "Installing K3s on Linux..."
    ensure_sudo
    # Ensure curl is available
    if ! command -v curl &> /dev/null; then
        if command -v apt &> /dev/null; then
            sudo apt update && sudo apt install -y curl
        elif command -v yum &> /dev/null; then
            sudo yum install -y curl
        fi
    fi
    
    curl -sfL https://get.k3s.io | sudo sh -
    
    # Add k3s to PATH
    export PATH=$PATH:/usr/local/bin
    
    # Wait for node to be ready
    echo "Waiting for K3s cluster to initialize..."
    sleep 10
    
    if command -v k3s &> /dev/null; then
        k3s kubectl get nodes
    elif command -v kubectl &> /dev/null; then
        kubectl get nodes
    fi
else
    echo "❌ Unsupported OS. Use WSL on Windows or Docker Desktop with Kubernetes."
    exit 1
fi

echo "✓ Kubernetes cluster deployment initiated successfully"`
    }
];

// Toast Notification Component
const Toast = ({ message, type }) => (
  <motion.div
    initial={{ opacity: 0, y: 20, x: 100 }}
    animate={{ opacity: 1, y: 0, x: 0 }}
    exit={{ opacity: 0, y: -20, x: 100 }}
    className={`fixed bottom-6 right-6 flex items-center gap-3 px-6 py-3 rounded-xl shadow-2xl backdrop-blur-xl border ${
      type === 'success' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-200' : 'bg-red-500/20 border-red-500/30 text-red-200'
    }`}
  >
    {type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
    <span className="font-medium text-sm">{message}</span>
  </motion.div>
);

// Difficulty Badge Component
const DifficultyBadge = ({ difficulty }) => {
  const colors = {
    Beginner: 'bg-blue-500/20 text-blue-200 border-blue-500/30',
    Advanced: 'bg-amber-500/20 text-amber-200 border-amber-500/30',
    Critical: 'bg-red-500/20 text-red-200 border-red-500/30',
  };
  
  return (
    <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${colors[difficulty] || colors.Beginner}`}>
      {difficulty}
    </span>
  );
};

// Modal: Source Code Viewer
const SourceModal = ({ blueprint, onClose }) => (
  <AnimatePresence>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[80vh] rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white">{blueprint.title}</h2>
            <p className="text-sm text-slate-400 mt-1">{blueprint.description}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 px-6 pt-4 border-b border-white/10 overflow-x-auto">
          <button className="px-4 py-2 text-sm font-medium text-sky-300 border-b-2 border-sky-500 whitespace-nowrap flex items-center gap-2">
            <Code size={16} />
            Code
          </button>
          <button className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-300 whitespace-nowrap flex items-center gap-2">
            <FileText size={16} />
            Docs
          </button>
          <button className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-300 whitespace-nowrap flex items-center gap-2">
            <Settings size={16} />
            Config
          </button>
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-auto p-6">
          <pre className="bg-slate-950/80 p-4 rounded-lg border border-white/5 text-sm text-slate-300 font-mono leading-relaxed overflow-x-auto">
            <code>{blueprint.code}</code>
          </pre>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 border-t border-white/10 bg-slate-950/50">
          <button
            onClick={() => {
              navigator.clipboard.writeText(blueprint.code);
              alert('Code copied to clipboard!');
            }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/30 transition-colors font-medium"
          >
            <Copy size={16} />
            Copy Code
          </button>
          <button
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-slate-300 hover:bg-white/20 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  </AnimatePresence>
);

// Modal: Deploy Configurator
const DeployModal = ({ blueprint, onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [deploying, setDeploying] = useState(false);
  const [config, setConfig] = useState({
    port: '3000',
    env: 'production',
  });

  const handleDeploy = async () => {
    setStep(3);
    setDeploying(true);

    if (window.electronAPI) {
      const baseName = blueprint.title.replace(/\s+/g, '_').toLowerCase();
      const res = await window.electronAPI.saveScript(`${baseName}.sh`, blueprint.code);
      if (res.success) onSuccess(`${blueprint.title} script saved locally.`);
    } else {
      const blob = new Blob([blueprint.code], { type: 'text/x-sh' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${blueprint.title.replace(/\s+/g, '_').toLowerCase()}.sh`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onSuccess(`${blueprint.title} script downloaded.`);
    }
    
    setDeploying(false);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <h2 className="text-xl font-bold text-white">Export Script: {blueprint.title}</h2>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <X size={20} className="text-slate-400" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Progress Steps */}
            <div className="flex items-center justify-between">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step >= s ? 'bg-sky-500 text-white' : 'bg-white/10 text-slate-400'}`}>
                    {s}
                  </div>
                  {s < 3 && <div className={`flex-1 h-1 mx-2 ${step > s ? 'bg-sky-500' : 'bg-white/10'}`} />}
                </div>
              ))}
            </div>

            {/* Step Content */}
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                  <h3 className="font-semibold text-white">Configure Export</h3>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Port</label>
                    <input
                      type="text"
                      value={config.port}
                      onChange={(e) => setConfig({ ...config, port: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder-slate-500 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/20"
                      placeholder="3000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Environment</label>
                    <select
                      value={config.env}
                      onChange={(e) => setConfig({ ...config, env: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/20"
                    >
                      <option value="development">Development</option>
                      <option value="production">Production</option>
                      <option value="staging">Staging</option>
                    </select>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                  <h3 className="font-semibold text-white">Review & Confirm</h3>
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Blueprint:</span>
                      <span className="text-white font-medium">{blueprint.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Port:</span>
                      <span className="text-white font-medium">{config.port}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Environment:</span>
                      <span className="text-white font-medium capitalize">{config.env}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Estimated Time:</span>
                      <span className="text-white font-medium">{blueprint.deployTime}</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="step3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4 text-center">
                  {deploying ? (
                    <>
                      <div className="flex justify-center mb-4">
                        <div className="w-12 h-12 rounded-full border-4 border-sky-500/20 border-t-sky-500 animate-spin" />
                      </div>
                      <h3 className="font-semibold text-white">Saving script...</h3>
                      <p className="text-sm text-slate-400">Preparing the script for local use.</p>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-center mb-4">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                          <CheckCircle size={24} className="text-emerald-300" />
                        </div>
                      </div>
                      <h3 className="font-semibold text-white">Export Complete</h3>
                      <p className="text-sm text-slate-400">{blueprint.title} has been saved for local use.</p>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Actions */}
          <div className="flex gap-3 p-6 border-t border-white/10 bg-slate-950/50">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                disabled={deploying}
                className="flex-1 px-4 py-2 rounded-lg bg-white/10 text-slate-300 hover:bg-white/20 transition-colors font-medium disabled:opacity-50"
              >
                Back
              </button>
            )}
            <button
              onClick={() => {
                if (step === 1) {
                  setStep(2);
                  return;
                }
                if (step === 2) {
                  handleDeploy();
                  return;
                }
                if (!deploying) {
                  onClose();
                }
              }}
              disabled={deploying && step !== 3}
              className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:shadow-lg hover:shadow-sky-500/20 transition-all font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {step === 1 && 'Configure'}
              {step === 2 && 'Save Script'}
              {step === 3 && (deploying ? 'Saving...' : 'Done')}
              {step < 3 && <ArrowRight size={16} />}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Main Blueprints Component
const Blueprints = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [sourceModal, setSourceModal] = useState(null);
    const [deployModal, setDeployModal] = useState(null);
    const [toast, setToast] = useState(null);
    const [savedBlueprints, setSavedBlueprints] = useState([]);

    const categories = ['All', 'Security', 'Network', 'Database', 'Cloud'];

    const filtered = blueprintsData.filter(b => {
        const matchSearch = b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          b.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchCategory = activeCategory === 'All' || b.category === activeCategory;
        return matchSearch && matchCategory;
    });

    const recommended = blueprintsData.filter(b => b.recommended);
    const averageRating = (blueprintsData.reduce((sum, item) => sum + (item.rating || 0), 0) / blueprintsData.length).toFixed(1);

    return (
        <main className="min-h-screen bg-slate-950 text-slate-100">
            <div className="relative overflow-hidden pb-20">
                <div className="absolute inset-x-0 top-0 h-[440px] bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.18),transparent_26%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.14),transparent_24%),radial-gradient(circle_at_18%_22%,rgba(245,158,11,0.08),transparent_18%)] pointer-events-none" />

                <div className="relative mx-auto max-w-7xl space-y-8 px-6 pt-10 lg:px-10">
                    <motion.section
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/80 p-8 shadow-[0_60px_140px_rgba(15,23,42,0.45)] backdrop-blur-2xl lg:p-10"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 opacity-95" />
                        <div className="absolute -right-10 top-0 h-52 w-52 rounded-full bg-sky-500/10 blur-3xl" />
                        <div className="absolute bottom-0 left-24 h-44 w-44 rounded-full bg-violet-500/10 blur-3xl" />
                        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
                            <div className="max-w-3xl">
                                <div className="mb-4 inline-flex items-center gap-3 rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm text-amber-200 shadow-[0_20px_60px_rgba(245,158,11,0.12)]">
                                    <Star size={14} className="text-amber-300" />
                                    Curated infrastructure launchpads
                                </div>
                                <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                                    Blueprint a stack that feels
                                    <span className="bg-gradient-to-r from-sky-300 via-white to-violet-300 bg-clip-text text-transparent"> production-ready before day one</span>
                                </h1>
                                <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
                                    Explore high-signal deployment templates, security packs, and infrastructure starters designed to feel more like a premium catalog than a plain script list.
                                </p>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-3 xl:w-[430px]">
                                <div className="rounded-[24px] border border-sky-400/15 bg-sky-400/10 px-4 py-4">
                                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-200/80">Blueprints</div>
                                    <div className="mt-2 text-2xl font-black text-white">{blueprintsData.length}</div>
                                </div>
                                <div className="rounded-[24px] border border-emerald-400/15 bg-emerald-400/10 px-4 py-4">
                                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-200/80">Recommended</div>
                                    <div className="mt-2 text-2xl font-black text-white">{recommended.length}</div>
                                </div>
                                <div className="rounded-[24px] border border-violet-400/15 bg-violet-400/10 px-4 py-4">
                                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-violet-200/80">Avg Rating</div>
                                    <div className="mt-2 flex items-center gap-2 text-2xl font-black text-white"><Star size={16} className="text-violet-300" />{averageRating}</div>
                                </div>
                            </div>
                        </div>
                    </motion.section>

                    {/* Search Bar */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="mb-8 relative"
                    >
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search blueprints by name or tag..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-[26px] border border-white/10 bg-slate-950/70 py-4 pl-12 pr-6 text-white placeholder-slate-500 shadow-[0_30px_80px_rgba(15,23,42,0.25)] transition-all focus:border-sky-500/50 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-sky-500/20"
                        />
                    </motion.div>

                    {/* Category Filter */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.15 }}
                        className="mb-12 flex gap-3 overflow-x-auto pb-4"
                    >
                        {categories.map((cat, i) => (
                            <motion.button
                                key={cat}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setActiveCategory(cat)}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 + i * 0.05 }}
                                className={`px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                                    activeCategory === cat
                                        ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/20'
                                        : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10'
                                }`}
                            >
                                {cat}
                            </motion.button>
                        ))}
                    </motion.div>

                    {/* Recommended Section */}
                    {recommended.length > 0 && activeCategory === 'All' && searchTerm === '' && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.25 }}
                            className="mb-12"
                        >
                            <div className="flex items-center gap-2 mb-6">
                                <Star size={20} className="text-amber-400" />
                                <h2 className="text-xl font-bold text-white">Recommended for You</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {recommended.map((b, i) => (
                                    <BlueprintCard
                                        key={b.id}
                                        blueprint={b}
                                        index={i}
                                        onView={() => setSourceModal(b)}
                                        onSource={() => setSourceModal(b)}
                                        onDeploy={() => setDeployModal(b)}
                                        onSave={() => {
                                            setSavedBlueprints([...savedBlueprints, b.id]);
                                            setToast({ message: `${b.title} saved!`, type: 'success' });
                                            setTimeout(() => setToast(null), 3000);
                                        }}
                                    />
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Main Grid */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                    >
                        {filtered.length > 0 ? (
                            <>
                                <div className="mb-6">
                                    <p className="text-sm text-slate-400">{filtered.length} blueprint(s) found</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {filtered.map((b, i) => (
                                        <BlueprintCard
                                            key={b.id}
                                            blueprint={b}
                                            index={i}
                                            onView={() => setSourceModal(b)}
                                            onSource={() => setSourceModal(b)}
                                            onDeploy={() => setDeployModal(b)}
                                            onSave={() => {
                                                setSavedBlueprints([...savedBlueprints, b.id]);
                                                setToast({ message: `${b.title} saved!`, type: 'success' });
                                                setTimeout(() => setToast(null), 3000);
                                            }}
                                            isSaved={savedBlueprints.includes(b.id)}
                                        />
                                    ))}
                                </div>
                            </>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center justify-center py-20 text-center"
                            >
                                <Search size={48} className="text-slate-600 mb-4" />
                                <h3 className="text-xl font-semibold text-slate-400 mb-2">No blueprints found</h3>
                                <p className="text-slate-500">Try adjusting your search or filters</p>
                            </motion.div>
                        )}
                    </motion.div>
                </div>
            </div>

            {/* Modals */}
            <AnimatePresence>
                {sourceModal && <SourceModal blueprint={sourceModal} onClose={() => setSourceModal(null)} />}
                {deployModal && <DeployModal blueprint={deployModal} onClose={() => setDeployModal(null)} onSuccess={(msg) => {
                    setToast({ message: msg, type: 'success' });
                    setTimeout(() => setToast(null), 3000);
                }} />}
                {toast && <Toast message={toast.message} type={toast.type} />}
            </AnimatePresence>
        </main>
    );
};

// Blueprint Card Component
const BlueprintCard = ({ blueprint, index, onView, onSource, onDeploy, onSave, isSaved }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      whileHover={{ y: -5 }}
      className="group relative h-full overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/80 backdrop-blur-xl shadow-[0_40px_120px_rgba(15,23,42,0.35)] transition-all hover:border-sky-500/30 hover:shadow-[0_50px_140px_rgba(56,189,248,0.12)]"
    >
      {/* Gradient Glow on Hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-sky-500/0 via-transparent to-violet-500/0 opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
      <div className="absolute -inset-1 bg-gradient-to-r from-sky-500/0 via-sky-500/0 to-violet-500/0 group-hover:from-sky-500/20 group-hover:to-violet-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />

      <div className="relative flex h-full flex-col p-6">
        {/* Top Section */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500/20 to-blue-600/20 border border-sky-500/30 group-hover:from-sky-500/30 group-hover:to-blue-600/30 transition-all">
            {blueprint.category === 'Security' ? (
              <Shield size={20} className="text-sky-300" />
            ) : blueprint.category === 'Cloud' ? (
              <Zap size={20} className="text-sky-300" />
            ) : (
              <Cpu size={20} className="text-sky-300" />
            )}
          </div>
          <DifficultyBadge difficulty={blueprint.difficulty} />
        </div>

        {/* Title & Description */}
        <h3 className="mb-2 text-xl font-semibold text-white transition-colors group-hover:text-sky-300">{blueprint.title}</h3>
        <p className="mb-5 flex-1 text-sm leading-6 text-slate-400">{blueprint.description}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {blueprint.tags.slice(0, 3).map((tag, i) => (
            <span key={i} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-300">
              {tag}
            </span>
          ))}
        </div>

        {/* Stats Row */}
        <div className="mb-6 flex items-center justify-between border-y border-white/10 py-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Clock size={14} />
            {blueprint.deployTime}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Cpu size={14} />
            {blueprint.cpu}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <HardDrive size={14} />
            {blueprint.ram}
          </div>
        </div>

        {/* Rating */}
        {blueprint.rating && (
          <div className="flex items-center gap-1 mb-6">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  size={14}
                  className={i < Math.floor(blueprint.rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}
                />
              ))}
            </div>
            <span className="text-xs text-slate-400 ml-2">
              {blueprint.rating} ({blueprint.reviews})
            </span>
          </div>
        )}

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-3 mt-auto">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onSource}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition-all text-xs font-medium"
          >
            <Code size={14} />
            Source
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onDeploy}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:shadow-lg hover:shadow-sky-500/20 transition-all text-xs font-semibold"
          >
            <Download size={14} />
            Deploy
          </motion.button>
        </div>

        {/* Secondary Buttons Row */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onView}
            className="p-2 rounded-lg border border-white/10 hover:bg-white/5 transition-all text-slate-400 hover:text-slate-300"
            title="Preview"
          >
            <Eye size={16} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onSave}
            className={`p-2 rounded-lg border transition-all ${
              isSaved
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                : 'border-white/10 hover:bg-white/5 text-slate-400 hover:text-slate-300'
            }`}
            title="Save"
          >
            <Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded-lg border border-white/10 hover:bg-white/5 transition-all text-slate-400 hover:text-slate-300"
            title="Customize"
          >
            <Settings size={16} />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default Blueprints;
