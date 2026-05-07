# 🚀 Guia Prático: Criar a Extensão Chrome SEO

## ⏱️ Tempo Total Estimado: 4-6 horas

---

## 📋 Pré-Requisitos

### Instalar no seu PC:
- ✅ Node.js 18+ (https://nodejs.org)
- ✅ Git (https://git-scm.com)
- ✅ VSCode ou editor de texto
- ✅ Chrome/Chromium atualizado

### Verificar instalação:
```bash
node --version    # v18.0.0 ou maior
npm --version     # 9.0.0 ou maior
git --version     # 2.0.0 ou maior
```

---

## 🎯 Fase 1: Setup Inicial (30 min)

### Passo 1.1: Criar pasta do projeto

```bash
# Criar pasta
mkdir seo-analyzer-pro
cd seo-analyzer-pro

# Inicializar Git
git init

# Criar estrutura de pastas
mkdir -p src/{popup,content,background,utils,styles}
mkdir -p public/icons
mkdir -p dist
```

### Passo 1.2: Criar `package.json`

Crie o arquivo `package.json` na raiz:

```json
{
  "name": "seo-analyzer-pro",
  "version": "1.0.0",
  "description": "Professional SEO analysis Chrome extension",
  "main": "dist/popup.js",
  "scripts": {
    "dev": "webpack --mode development --watch",
    "build": "webpack --mode production",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src/"
  },
  "devDependencies": {
    "@babel/core": "^7.20.0",
    "@babel/preset-env": "^7.20.0",
    "babel-loader": "^9.1.0",
    "webpack": "^5.75.0",
    "webpack-cli": "^5.0.0",
    "jest": "^29.3.0",
    "eslint": "^8.30.0",
    "prettier": "^2.8.0"
  },
  "dependencies": {
    "chart.js": "^3.9.1",
    "html2pdf.js": "^0.10.1"
  }
}
```

### Passo 1.3: Instalar dependências

```bash
npm install
```

**Tempo:** ~5 minutos

### Passo 1.4: Criar `webpack.config.js`

Crie na raiz do projeto:

```javascript
const path = require('path');

module.exports = [
  {
    name: 'popup',
    mode: 'production',
    entry: './src/popup/popup.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'popup.js'
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          }
        }
      ]
    }
  },
  {
    name: 'content',
    mode: 'production',
    entry: './src/content/content-script.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'content-script.js'
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          }
        }
      ]
    }
  },
  {
    name: 'background',
    mode: 'production',
    entry: './src/background/background-script.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'background-script.js'
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          }
        }
      ]
    }
  }
];
```

### Passo 1.5: Criar `.babelrc`

```json
{
  "presets": ["@babel/preset-env"]
}
```

### Passo 1.6: Criar `.gitignore`

```
node_modules/
dist/
.DS_Store
*.log
.env
.env.local
```

---

## 🔧 Fase 2: Criar Arquivos Core (1h)

### Passo 2.1: `manifest.json`

Crie `manifest.json` na raiz:

```json
{
  "manifest_version": 3,
  "name": "SEO Analyzer Pro",
  "version": "1.0.0",
  "description": "Professional SEO analysis. Free basic + Pro advanced features.",
  "permissions": [
    "activeTab",
    "tabs",
    "storage",
    "scripting"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "dist/background-script.js"
  },
  "action": {
    "default_popup": "src/popup/popup.html",
    "default_title": "SEO Analyzer Pro",
    "default_icon": {
      "16": "public/icons/icon-16.png",
      "48": "public/icons/icon-48.png",
      "128": "public/icons/icon-128.png"
    }
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["dist/content-script.js"],
      "run_at": "document_idle"
    }
  ],
  "icons": {
    "16": "public/icons/icon-16.png",
    "48": "public/icons/icon-48.png",
    "128": "public/icons/icon-128.png",
    "256": "public/icons/icon-256.png"
  },
  "web_accessible_resources": [
    {
      "resources": ["src/report/report.html"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

### Passo 2.2: `src/content/content-script.js`

Crie o arquivo de análise DOM:

```javascript
// ==========================================
// CONTENT SCRIPT - Executa na página do usuário
// ==========================================

const SEOAnalyzer = {
  
  data: {
    url: '',
    timestamp: new Date().toISOString(),
    meta: {},
    headings: {},
    links: {},
    images: {},
    keywords: {}
  },

  analyzeMeta() {
    const meta = {};
    
    meta.title = document.title || '';
    meta.titleLength = meta.title.length;
    meta.titleOptimal = meta.titleLength >= 30 && meta.titleLength <= 60;
    
    const descMeta = document.querySelector('meta[name="description"]');
    meta.description = descMeta?.getAttribute('content') || '';
    meta.descriptionLength = meta.description.length;
    meta.descriptionOptimal = meta.descriptionLength >= 120 && meta.descriptionLength <= 160;
    
    const viewport = document.querySelector('meta[name="viewport"]');
    meta.hasViewport = !!viewport;
    
    const charset = document.querySelector('meta[charset]');
    meta.hasCharset = !!charset;
    
    return meta;
  },

  analyzeHeadings() {
    const headings = {
      h1: [],
      h2: [],
      h3: [],
      distribution: {}
    };

    for (let i = 1; i <= 3; i++) {
      const tags = document.querySelectorAll(`h${i}`);
      headings[`h${i}`] = Array.from(tags).map(h => ({
        text: h.innerText.substring(0, 50),
        length: h.innerText.length
      }));
      headings.distribution[`h${i}`] = tags.length;
    }

    headings.h1Optimal = headings.distribution.h1 === 1;
    return headings;
  },

  analyzeLinks() {
    const links = {
      internal: 0,
      external: 0,
      total: 0
    };

    const currentDomain = new URL(window.location.href).hostname;
    const allLinks = document.querySelectorAll('a[href]');

    allLinks.forEach(link => {
      const href = link.getAttribute('href');
      
      if (href && href.startsWith('http')) {
        try {
          const linkDomain = new URL(href).hostname;
          links.total++;
          
          if (linkDomain === currentDomain) {
            links.internal++;
          } else {
            links.external++;
          }
        } catch (e) {
          // URL inválida, ignorar
        }
      }
    });

    return links;
  },

  analyzeImages() {
    const images = {
      total: 0,
      withAlt: 0,
      missingAlt: 0
    };

    const allImages = document.querySelectorAll('img');
    images.total = allImages.length;

    allImages.forEach(img => {
      const alt = img.getAttribute('alt') || '';
      if (alt.trim() === '') {
        images.missingAlt++;
      } else {
        images.withAlt++;
      }
    });

    return images;
  },

  analyzeContent() {
    const content = {
      wordCount: 0,
      paragraphs: 0,
      readingTime: 0
    };

    const bodyText = document.body.innerText;
    const words = bodyText.trim().split(/\s+/);
    content.wordCount = words.length;
    content.paragraphs = document.querySelectorAll('p').length;
    content.readingTime = Math.ceil(content.wordCount / 200);

    return content;
  },

  analyzeTechnical() {
    const technical = {
      protocol: window.location.protocol.replace(':', ''),
      isHTTPS: window.location.protocol === 'https:',
      hasCanonical: !!document.querySelector('link[rel="canonical"]'),
      lang: document.documentElement.getAttribute('lang') || '',
      mobile: this.isMobileFriendly()
    };

    return technical;
  },

  isMobileFriendly() {
    const viewport = document.querySelector('meta[name="viewport"]');
    return viewport?.getAttribute('content')?.includes('width=device-width') || false;
  },

  runFullAnalysis() {
    try {
      this.data.url = window.location.href;
      this.data.meta = this.analyzeMeta();
      this.data.headings = this.analyzeHeadings();
      this.data.links = this.analyzeLinks();
      this.data.images = this.analyzeImages();
      this.data.keywords = this.analyzeContent();
      this.data.technical = this.analyzeTechnical();

      return this.data;
    } catch (error) {
      console.error('Erro na análise:', error);
      return null;
    }
  },

  sendToBackground() {
    const analysis = this.runFullAnalysis();
    
    if (analysis) {
      chrome.runtime.sendMessage(
        { type: 'SEO_ANALYSIS_COMPLETE', data: analysis },
        (response) => {
          if (chrome.runtime.lastError) {
            console.log('Background não respondeu (normal na primeira vez)');
          }
        }
      );
    }
  }
};

// Executar análise quando página carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    SEOAnalyzer.sendToBackground();
  });
} else {
  SEOAnalyzer.sendToBackground();
}

// Listener para quando popup solicitar dados
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'REQUEST_ANALYSIS') {
    const analysis = SEOAnalyzer.runFullAnalysis();
    sendResponse({ success: true, data: analysis });
  }
});
```

### Passo 2.3: `src/background/background-script.js`

```javascript
// ==========================================
// BACKGROUND SCRIPT - Service Worker
// ==========================================

class AnalysisProcessor {
  constructor() {
    this.setupListeners();
  }

  setupListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'SEO_ANALYSIS_COMPLETE') {
        this.processAnalysis(request.data, sender.tab.id);
        sendResponse({ success: true });
      }
    });
  }

  processAnalysis(data, tabId) {
    if (!data || !data.url) {
      console.error('Invalid analysis data');
      return;
    }

    const score = this.calculateScore(data);
    
    // Atualizar badge
    chrome.action.setBadgeText({ 
      text: Math.round(score).toString(), 
      tabId 
    });
    
    chrome.action.setBadgeBackgroundColor({ 
      color: this.getScoreColor(score),
      tabId
    });

    // Salvar no storage
    this.saveToStorage(data, score);
  }

  calculateScore(data) {
    let score = 5;
    
    if (data.meta?.titleOptimal) score += 1;
    if (data.meta?.descriptionOptimal) score += 1;
    if (data.headings?.distribution?.h1 === 1) score += 1;
    if (data.technical?.mobile) score += 1;
    if (data.technical?.isHTTPS) score += 1;
    if (data.images?.total > 0 && (data.images.withAlt / data.images.total) >= 0.8) score += 1;
    if (data.keywords?.wordCount > 300) score += 1;
    
    return Math.min(score, 10);
  }

  getScoreColor(score) {
    if (score >= 8) return '#10b981'; // Green
    if (score >= 6) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  }

  saveToStorage(data, score) {
    const analysisWithScore = {
      ...data,
      score,
      analyzedAt: new Date().toISOString()
    };

    chrome.storage.local.get('analysisHistory', (result) => {
      const history = result.analysisHistory || [];
      history.unshift(analysisWithScore);
      const limited = history.slice(0, 50);
      
      chrome.storage.local.set({ 
        analysisHistory: limited,
        lastAnalysis: analysisWithScore
      });
    });
  }
}

// Inicializar
new AnalysisProcessor();
```

### Passo 2.4: `src/utils/storage.js`

```javascript
// ==========================================
// STORAGE UTILS - Interface com Chrome Storage
// ==========================================

class StorageManager {
  static async save(key, data) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: data }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  static async get(key) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(key, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result[key]);
        }
      });
    });
  }

  static async getAll() {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, resolve);
    });
  }

  static async clear() {
    return new Promise((resolve) => {
      chrome.storage.local.clear(resolve);
    });
  }
}

// Exportar para uso em popup
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
}
```

### Passo 2.5: `src/popup/popup.html`

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SEO Analyzer Pro</title>
    <link rel="stylesheet" href="popup.css">
</head>
<body>
    <div class="popup-container">
        
        <!-- Header -->
        <div class="popup-header">
            <h1>🔍 SEO Analyzer</h1>
            <button id="settingsBtn" class="settings-btn">⚙️</button>
        </div>

        <!-- Loading State -->
        <div id="loading" class="loading">
            <div class="spinner"></div>
            <p>Analisando página...</p>
        </div>

        <!-- Results Container -->
        <div id="results" class="results" style="display: none;">
            
            <!-- URL -->
            <div class="result-item">
                <small class="label">URL ANALISADA</small>
                <p id="urlDisplay" class="url-text"></p>
            </div>

            <!-- Score -->
            <div class="result-item score-card">
                <h3>Score SEO</h3>
                <div class="score-circle">
                    <span id="scoreValue" class="score-number">--</span>
                    <span class="score-text">/10</span>
                </div>
                <p id="scoreMsg" class="score-message"></p>
            </div>

            <!-- Checks -->
            <div class="results-section">
                <h3 class="section-title">✅ Verificações</h3>
                
                <div class="check-item">
                    <span id="titleCheck" class="check-icon">⚠️</span>
                    <div class="check-content">
                        <strong>Title Tag</strong>
                        <small id="titleMsg"></small>
                    </div>
                </div>

                <div class="check-item">
                    <span id="descCheck" class="check-icon">⚠️</span>
                    <div class="check-content">
                        <strong>Meta Description</strong>
                        <small id="descMsg"></small>
                    </div>
                </div>

                <div class="check-item">
                    <span id="h1Check" class="check-icon">⚠️</span>
                    <div class="check-content">
                        <strong>H1 Heading</strong>
                        <small id="h1Msg"></small>
                    </div>
                </div>

                <div class="check-item">
                    <span id="mobileCheck" class="check-icon">⚠️</span>
                    <div class="check-content">
                        <strong>Mobile Friendly</strong>
                        <small id="mobileMsg"></small>
                    </div>
                </div>

                <div class="check-item">
                    <span id="httpsCheck" class="check-icon">⚠️</span>
                    <div class="check-content">
                        <strong>HTTPS/SSL</strong>
                        <small id="httpsMsg"></small>
                    </div>
                </div>

                <div class="check-item">
                    <span id="imagesCheck" class="check-icon">⚠️</span>
                    <div class="check-content">
                        <strong>Image Alt Text</strong>
                        <small id="imagesMsg"></small>
                    </div>
                </div>

                <div class="check-item">
                    <span id="wordCountCheck" class="check-icon">ℹ️</span>
                    <div class="check-content">
                        <strong>Conteúdo</strong>
                        <small id="wordCountMsg"></small>
                    </div>
                </div>
            </div>

            <!-- Buttons -->
            <div class="popup-actions">
                <button id="exportBtn" class="btn btn-secondary">💾 Exportar JSON</button>
                <button id="reloadBtn" class="btn btn-primary">🔄 Recarregar</button>
            </div>
        </div>

        <!-- Error State -->
        <div id="error" class="error-message" style="display: none;">
            <p>❌ Erro ao analisar página</p>
            <small id="errorMsg"></small>
        </div>

    </div>

    <script src="popup.js"></script>
</body>
</html>
```

### Passo 2.6: `src/popup/popup.js`

```javascript
// ==========================================
// POPUP SCRIPT - Interface do usuário
// ==========================================

class PopupManager {
  constructor() {
    this.currentAnalysis = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.requestAnalysis();
  }

  setupEventListeners() {
    document.getElementById('exportBtn').addEventListener('click', () => this.exportJSON());
    document.getElementById('reloadBtn').addEventListener('click', () => this.requestAnalysis());
    document.getElementById('settingsBtn').addEventListener('click', () => this.showMessage('Configurações em breve!'));
  }

  requestAnalysis() {
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const error = document.getElementById('error');

    loading.style.display = 'block';
    results.style.display = 'none';
    error.style.display = 'none';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        this.showError('Aba não encontrada');
        return;
      }

      chrome.tabs.sendMessage(tabs[0].id, { type: 'REQUEST_ANALYSIS' }, (response) => {
        if (chrome.runtime.lastError) {
          // Tentar via storage
          chrome.storage.local.get('lastAnalysis', (result) => {
            if (result.lastAnalysis) {
              this.currentAnalysis = result.lastAnalysis;
              this.renderResults();
              loading.style.display = 'none';
              results.style.display = 'block';
            } else {
              this.showError('Não foi possível analisar esta página. Recarregue a página.');
              loading.style.display = 'none';
              error.style.display = 'block';
            }
          });
        } else if (response?.success) {
          this.currentAnalysis = response.data;
          this.renderResults();
          loading.style.display = 'none';
          results.style.display = 'block';
        } else {
          this.showError('Erro ao obter dados');
          loading.style.display = 'none';
          error.style.display = 'block';
        }
      });
    });
  }

  renderResults() {
    const data = this.currentAnalysis;
    
    // URL
    try {
      const hostname = new URL(data.url).hostname;
      document.getElementById('urlDisplay').textContent = hostname;
    } catch (e) {
      document.getElementById('urlDisplay').textContent = data.url;
    }

    // Calcular score
    const score = this.calculateScore();
    document.getElementById('scoreValue').textContent = score.toFixed(1);
    document.getElementById('scoreMsg').textContent = this.getScoreMessage(score);

    // Title
    this.setCheckItem('title', data.meta?.titleOptimal || false, 
      `${data.meta?.titleLength || 0} caracteres ${data.meta?.titleOptimal ? '✅' : '⚠️'}`);

    // Description
    this.setCheckItem('desc', data.meta?.descriptionOptimal || false,
      `${data.meta?.descriptionLength || 0} caracteres ${data.meta?.descriptionOptimal ? '✅' : '⚠️'}`);

    // H1
    const h1Count = data.headings?.distribution?.h1 || 0;
    this.setCheckItem('h1', h1Count === 1,
      `${h1Count} H1 encontrado(s) ${h1Count === 1 ? '✅' : '⚠️ (ideal: 1)'}`);

    // Mobile
    this.setCheckItem('mobile', data.technical?.mobile || false,
      data.technical?.mobile ? '✅ Detectado' : '❌ Não configurado');

    // HTTPS
    this.setCheckItem('https', data.technical?.isHTTPS || false,
      data.technical?.isHTTPS ? '✅ Seguro' : '❌ Inseguro');

    // Images Alt
    const totalImages = data.images?.total || 0;
    const imagesWithAlt = data.images?.withAlt || 0;
    const altPercentage = totalImages > 0 ? Math.round((imagesWithAlt / totalImages) * 100) : 0;
    this.setCheckItem('images', altPercentage === 100,
      `${altPercentage}% das imagens têm alt text`);

    // Word Count
    const wordCount = data.keywords?.wordCount || 0;
    const readingTime = data.keywords?.readingTime || 0;
    document.getElementById('wordCountMsg').textContent = 
      `${wordCount} palavras (${readingTime} min de leitura)`;
  }

  setCheckItem(id, isGood, message) {
    const icon = document.getElementById(`${id}Check`);
    const msg = document.getElementById(`${id}Msg`);
    
    icon.textContent = isGood ? '✅' : '⚠️';
    icon.className = `check-icon ${isGood ? 'good' : 'warning'}`;
    msg.textContent = message;
  }

  calculateScore() {
    const data = this.currentAnalysis;
    let score = 5;

    if (data.meta?.titleOptimal) score += 1;
    if (data.meta?.descriptionOptimal) score += 1;
    if (data.headings?.distribution?.h1 === 1) score += 1;
    if (data.technical?.mobile) score += 1;
    if (data.technical?.isHTTPS) score += 1;
    
    const totalImages = data.images?.total || 0;
    const imagesWithAlt = data.images?.withAlt || 0;
    if (totalImages > 0 && (imagesWithAlt / totalImages) >= 0.8) score += 1;
    
    if (data.keywords?.wordCount > 300) score += 1;
    
    return Math.min(score, 10);
  }

  getScoreMessage(score) {
    if (score >= 8) return '🔥 Excelente! Seu SEO está muito bom';
    if (score >= 6) return '👍 Bom, mas há melhorias possíveis';
    if (score >= 4) return '⚠️ Precisa de otimizações';
    return '❌ Muitos problemas identificados';
  }

  exportJSON() {
    if (!this.currentAnalysis) return;

    const dataStr = JSON.stringify(this.currentAnalysis, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `seo-analysis-${Date.now()}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
  }

  showError(message) {
    document.getElementById('errorMsg').textContent = message;
  }

  showMessage(message) {
    alert(message);
  }
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});
```

### Passo 2.7: `src/popup/popup.css`

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  width: 450px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: #f5f7fa;
  color: #333;
}

.popup-container {
  height: 600px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* HEADER */
.popup-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.popup-header h1 {
  font-size: 18px;
  font-weight: 600;
}

.settings-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  font-size: 18px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 4px;
  transition: all 0.2s;
}

.settings-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* LOADING */
.loading {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 40px 20px;
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e0e0e0;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* RESULTS */
.results {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.result-item {
  background: white;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 12px;
  border: 1px solid #e0e0e0;
}

.result-item .label {
  color: #999;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.result-item p {
  margin-top: 4px;
  word-break: break-all;
  font-size: 13px;
  color: #555;
}

/* SCORE CARD */
.score-card {
  text-align: center;
  background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
  border: 2px solid #667eea;
}

.score-card h3 {
  color: #667eea;
  font-size: 14px;
  margin-bottom: 12px;
}

.score-circle {
  display: flex;
  align-items: baseline;
  justify-content: center;
  margin: 16px 0;
}

.score-number {
  font-size: 48px;
  font-weight: bold;
  color: #667eea;
}

.score-text {
  font-size: 18px;
  color: #999;
  margin-left: 4px;
}

.score-message {
  font-size: 13px;
  color: #666;
  margin-top: 8px;
}

/* SECTIONS */
.results-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
  padding: 8px 0;
  border-bottom: 2px solid #667eea;
}

/* CHECK ITEMS */
.check-item {
  display: flex;
  align-items: flex-start;
  background: white;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 8px;
  border-left: 3px solid transparent;
}

.check-item .check-icon {
  font-size: 18px;
  margin-right: 12px;
  min-width: 20px;
  text-align: center;
}

.check-icon.good {
  color: #10b981;
}

.check-icon.warning {
  color: #f59e0b;
}

.check-content strong {
  display: block;
  font-size: 13px;
  color: #333;
  margin-bottom: 2px;
}

.check-content small {
  display: block;
  font-size: 11px;
  color: #999;
}

/* BUTTONS */
.popup-actions {
  display: flex;
  gap: 8px;
  padding: 16px;
  background: white;
  border-top: 1px solid #e0e0e0;
  flex-shrink: 0;
}

.btn {
  flex: 1;
  padding: 10px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  min-width: 100px;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
  border: 1px solid #ddd;
}

.btn-secondary:hover {
  background: #e8e8e8;
}

/* ERROR */
.error-message {
  padding: 20px;
  text-align: center;
  color: #dc2626;
}

.error-message p {
  font-weight: 600;
  margin-bottom: 8px;
}

/* SCROLLBAR */
.results::-webkit-scrollbar {
  width: 6px;
}

.results::-webkit-scrollbar-track {
  background: transparent;
}

.results::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 3px;
}

.results::-webkit-scrollbar-thumb:hover {
  background: #999;
}
```

---

## 🔨 Fase 3: Build & Teste (30 min)

### Passo 3.1: Criar ícones (placeholder)

Para não travar, vamos criar ícones simples:

```bash
# Criar ícones simples com ImageMagick (se tiver instalado)
# Ou use online: https://favicon-generator.org/

# Por enquanto, copie este SVG para 4 arquivos diferentes:
# public/icons/icon-16.png
# public/icons/icon-48.png
# public/icons/icon-128.png
# public/icons/icon-256.png
```

Atalho: crie um arquivo `public/icons/generate-icons.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Icon Generator</title>
</head>
<body>
    <h1>Geradores de ícones:</h1>
    <ul>
        <li><a href="https://favicon-generator.org/" target="_blank">Favicon Generator</a></li>
        <li><a href="https://www.canva.com/" target="_blank">Canva (design seu ícone)</a></li>
    </ul>
    <p>Salve como: icon-16.png, icon-48.png, icon-128.png, icon-256.png</p>
</body>
</html>
```

**Alternativa rápida**: use um ícone de placeholder do Google Drive ou crie com emoji

### Passo 3.2: Build da extensão

```bash
# Build production
npm run build

# Verificar se funcionou
ls -la dist/
# Deve ter: popup.js, content-script.js, background-script.js
```

### Passo 3.3: Carregar no Chrome

1. Abra `chrome://extensions/`
2. Ative "Modo do desenvolvedor" (canto superior direito)
3. Clique "Carregar extensão não empacotada"
4. Selecione a pasta `seo-analyzer-pro`
5. ✅ Pronto! A extensão está instalada

### Passo 3.4: Testar a extensão

1. Visite qualquer site (ex: google.com)
2. Clique no ícone da extensão (canto superior direito do Chrome)
3. Você deve ver:
   - URL do site
   - Score de 0-10
   - Lista de verificações (title, description, H1, etc)
   - Botões de "Exportar JSON" e "Recarregar"

### Passo 3.5: Testar exportação

1. Clique "Exportar JSON"
2. Um arquivo `seo-analysis-{timestamp}.json` deve baixar
3. Abra e veja os dados analisados

---

## 📝 Fase 4: Debug & Polimento (1h)

### Se o popup não aparecer:

1. Abra `chrome://extensions/`
2. Clique em "Detalhes" na extensão SEO Analyzer
3. Vá para "Exibições da extensão" → "Abrir página pop-up"
4. Abra DevTools (F12) e procure por erros
5. Procure em Mensagens → Erros do service worker

### Se a análise não funciona:

1. Visite um site
2. Abra DevTools do site (F12)
3. Vá na aba "Console"
4. Procure por mensagens de erro
5. Se houver, copie o erro para debugar

### Testar em diferentes sites:

```
✅ google.com (simples)
✅ wikipedia.org (complexo)
✅ seu-site-favorito.com
```

---

## 🚀 Fase 5: Adicionar ao Git (10 min)

```bash
# Configurar Git
git config user.name "Seu Nome"
git config user.email "seu.email@example.com"

# Adicionar arquivos
git add .

# Commit inicial
git commit -m "Initial commit: SEO Analyzer extension MVP"

# Se tiver GitHub:
git remote add origin https://github.com/seu-usuario/seo-analyzer-pro.git
git branch -M main
git push -u origin main
```

---

## ✅ Checklist de Conclusão

- [ ] `package.json` criado ✅
- [ ] `webpack.config.js` criado ✅
- [ ] `manifest.json` criado ✅
- [ ] Content script funciona ✅
- [ ] Background script funciona ✅
- [ ] Popup HTML/CSS/JS criado ✅
- [ ] Build sem erros ✅
- [ ] Extensão carregada no Chrome ✅
- [ ] Popup aparece ao clicar no ícone ✅
- [ ] Análise básica funciona ✅
- [ ] JSON export funciona ✅
- [ ] Repositório Git criado ✅

---

## 🎉 Parabéns!

Você tem uma **extensão Chrome funcional**!

**Próximos passos (Fase 2):**
1. Melhorar UI (cores, layouts)
2. Adicionar sistema de monetização (Pro vs Free)
3. Criar página de relatório completo
4. Integrar Google PageSpeed Insights
5. Publicar no Chrome Web Store

---

## 🆘 Troubleshooting

### Erro: "Cannot find module 'webpack'"
```bash
npm install
```

### Erro: "popup.js not found in dist"
```bash
npm run build
# Verificar se dist/ tem os arquivos
ls -la dist/
```

### Popup não aparece
```bash
# Recarregue a extensão:
chrome://extensions/ → Recarregar ícone na extensão
```

### Content script não funciona
```bash
# Recarregue a página:
F5 ou Ctrl+R
```

### Chrome diz "Manifest inválido"
```bash
# Verifique JSON:
npm install -g jsonlint
jsonlint manifest.json
```

---

## 📚 Documentação de Referência

- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)

---

**Pronto para começar? Execute:**

```bash
npm install && npm run build
```

Depois carregue em `chrome://extensions/` 🚀
