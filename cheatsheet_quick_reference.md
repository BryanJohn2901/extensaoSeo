# 🔥 Quick Reference - SEO Analyzer Extension

## ⚡ Quick Start (2 minutos)

```bash
# 1. Criar projeto
mkdir seo-analyzer-pro && cd seo-analyzer-pro

# 2. Instalar dependências
npm install webpack webpack-cli @babel/core @babel/preset-env babel-loader chart.js html2pdf.js

# 3. Build
npm run build

# 4. Carregar em chrome://extensions/
# Abra Chrome → Extensões → Modo desenvolvedor → Carregar extensão não empacotada
```

---

## 📁 Estrutura Mínima

```
seo-analyzer-pro/
├── manifest.json              ← CRÍTICO
├── webpack.config.js          ← CRÍTICO
├── package.json               ← CRÍTICO
├── .babelrc
├── .gitignore
├── src/
│   ├── popup/
│   │   ├── popup.html         ← Interface
│   │   ├── popup.js           ← Lógica
│   │   └── popup.css          ← Estilos
│   ├── content/
│   │   └── content-script.js  ← Análise DOM (crítico!)
│   ├── background/
│   │   └── background-script.js ← Processamento
│   └── utils/
│       └── storage.js         ← Chrome Storage API
├── public/
│   └── icons/
│       ├── icon-16.png
│       ├── icon-48.png
│       ├── icon-128.png
│       └── icon-256.png
└── dist/                      ← Gerado automaticamente
```

---

## 🎯 3 Arquivos CRÍTICOS

### 1. `manifest.json` (identidade da extensão)
```json
{
  "manifest_version": 3,
  "name": "SEO Analyzer Pro",
  "version": "1.0.0",
  "permissions": ["activeTab", "tabs", "storage", "scripting"],
  "host_permissions": ["<all_urls>"],
  "background": { "service_worker": "dist/background-script.js" },
  "action": { "default_popup": "src/popup/popup.html" },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["dist/content-script.js"],
    "run_at": "document_idle"
  }]
}
```

### 2. `src/content/content-script.js` (análise)
```javascript
const SEOAnalyzer = {
  runFullAnalysis() {
    return {
      url: window.location.href,
      meta: {
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content')
      },
      headings: {
        h1: document.querySelectorAll('h1').length,
        h2: document.querySelectorAll('h2').length
      },
      images: {
        total: document.querySelectorAll('img').length,
        withAlt: Array.from(document.querySelectorAll('img')).filter(i => i.alt).length
      },
      technical: {
        isHTTPS: window.location.protocol === 'https:',
        hasMobileViewport: !!document.querySelector('meta[name="viewport"]')
      }
    };
  }
};

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === 'REQUEST_ANALYSIS') {
    sendResponse({ success: true, data: SEOAnalyzer.runFullAnalysis() });
  }
});
```

### 3. `src/popup/popup.html` (interface)
```html
<body>
  <div id="results">
    <h2 id="scoreValue">--</h2>
    <button id="exportBtn">Exportar JSON</button>
  </div>
  <script src="popup.js"></script>
</body>
```

---

## 🛠️ Comandos Essenciais

```bash
# Setup
npm install
npm init -y

# Build
npm run build           # Production
npm run dev            # Development (watch mode)

# Testes
npm test               # Jest
npm test -- --watch    # Watch mode

# Code quality
npm run lint
npm run format

# Clean
rm -rf dist node_modules
```

---

## 🔄 Fluxo de Desenvolvimento

```
┌─────────────────────┐
│  Editar arquivo     │
│  (popup.js, etc)    │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  npm run build      │
│  (compila .js)      │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Recarregar em      │
│ chrome://extensions │
│  (ícone reload)     │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Testar no navegador│
│  (F5 na página)     │
└─────────────────────┘
```

---

## 📊 Checklist Diário

### Antes de começar:
- [ ] `npm run build` sem erros?
- [ ] Extensão carregada em chrome://extensions/?
- [ ] DevTools do Chrome aberto (F12)?

### Depois de editar código:
- [ ] `npm run build` ✅
- [ ] Recarregar em chrome://extensions/ (clique no ícone)
- [ ] Testar no navegador (F5)
- [ ] Verificar console do popup (DevTools popup)

### Antes de commitar:
- [ ] `npm test` passa?
- [ ] `npm run lint` sem erros?
- [ ] `npm run build` sem warnings?

---

## 🐛 Debug Rápido

### Popup não funciona
```javascript
// Adicione console.log em popup.js
document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ Popup carregado');
  // seu código aqui
});

// Abra DevTools: Inspecionar → Clique em popup → Console
```

### Content script não funciona
```javascript
// Adicione em content-script.js
console.log('✅ Content script iniciado');

// Abra DevTools na página → Console
```

### Background script não funciona
```javascript
// chrome://extensions/ → Detalhes → "Abrir página pop-up"
// Vá na aba "Console"
```

---

## 💾 Padrões de Código

### Comunicação Popup ↔ Content Script
```javascript
// Popup envia mensagem
chrome.tabs.sendMessage(tabId, 
  { type: 'REQUEST_ANALYSIS' },
  (response) => console.log(response.data)
);

// Content script responde
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === 'REQUEST_ANALYSIS') {
    sendResponse({ data: myAnalysisData });
  }
});
```

### Salvar no Storage
```javascript
// Salvar
chrome.storage.local.set({ key: value }, () => {
  console.log('✅ Salvo');
});

// Recuperar
chrome.storage.local.get('key', (result) => {
  console.log(result.key);
});
```

### Atualizar Badge do Ícone
```javascript
chrome.action.setBadgeText({ text: '5', tabId });
chrome.action.setBadgeBackgroundColor({ color: '#10b981', tabId });
```

---

## 📋 HTML Template Mínimo

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <h1>🔍 SEO Analyzer</h1>
  
  <div id="loading" style="display:none">
    <p>Analisando...</p>
  </div>
  
  <div id="results">
    <p>Score: <span id="score">--</span>/10</p>
    <ul id="checks"></ul>
    <button id="export">Exportar JSON</button>
  </div>
  
  <script src="popup.js"></script>
</body>
</html>
```

---

## 🎨 CSS Mínimo

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  width: 450px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f7fa;
  color: #333;
}

.popup-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px;
}

.check-item {
  display: flex;
  padding: 12px;
  background: white;
  border-radius: 6px;
  margin: 8px 0;
}

.score-number {
  font-size: 48px;
  font-weight: bold;
  color: #667eea;
}

button {
  background: #667eea;
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

button:hover {
  background: #764ba2;
}
```

---

## 🚨 Erros Comuns

| Erro | Solução |
|------|---------|
| "Cannot find module 'webpack'" | `npm install webpack webpack-cli` |
| Popup vazio | Verificar popup.html path em manifest.json |
| Content script não funciona | Recarregar página (F5) depois de build |
| "Manifest validation error" | Usar JSONLint para validar JSON |
| Extensão não aparece | Modo desenvolvedor desativado em chrome://extensions |
| Badge não atualiza | Usar `chrome.action` não `chrome.browserAction` |

---

## 📦 Dependências Mínimas

```json
{
  "devDependencies": {
    "@babel/core": "^7.20.0",
    "@babel/preset-env": "^7.20.0",
    "babel-loader": "^9.1.0",
    "webpack": "^5.75.0",
    "webpack-cli": "^5.0.0"
  },
  "dependencies": {
    "chart.js": "^3.9.1",
    "html2pdf.js": "^0.10.1"
  }
}
```

---

## ⏱️ Timeline

```
Hora 0:     npm install
Hora 0:30   Criar pasta/arquivos
Hora 1:00   Build primeiro
Hora 1:30   Carregar Chrome
Hora 2:00   Popup funcionando
Hora 3:00   Content script funcionando
Hora 4:00   Storage funcionando
Hora 5:00   Testes + Polish
```

---

## 🎯 Próxima Etapa Após MVP

Quando popup estiver 100% funcional:

```
✅ MVP (Fase 1):
└─ Popup simples
└─ Content script
└─ Background script
└─ Chrome Storage

↓

🟡 Fase 2:
├─ Relatório em React
├─ Gráficos com Chart.js
├─ Exportar PDF
└─ Feature flags (Free vs Pro)

↓

🟢 Fase 3:
├─ Integração Stripe
├─ Backend Node.js
├─ Email sequence
└─ Chrome Web Store
```

---

## 📞 Quick Links

- [Chrome Extension API](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Guide](https://developer.chrome.com/docs/extensions/mv3/)
- [Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
- [JSONLint](https://jsonlint.com/)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)

---

## ✅ Checklist MVP

- [ ] Pasta seo-analyzer-pro criada
- [ ] `npm install` executado
- [ ] manifest.json validado
- [ ] content-script.js codificado
- [ ] popup.html/js/css criados
- [ ] background-script.js codificado
- [ ] `npm run build` sucesso
- [ ] Extensão carregada em Chrome
- [ ] Popup abre ao clicar ícone
- [ ] Análise funciona em 3+ sites
- [ ] Botão Exportar funciona
- [ ] Git commit feito

**Quando tudo ✅: Parabéns! Você tem MVP funcional!**

---

## 🎁 Bonus: Package.json Pronto

```json
{
  "name": "seo-analyzer-pro",
  "version": "1.0.0",
  "description": "Professional SEO analysis Chrome extension",
  "scripts": {
    "dev": "webpack --mode development --watch",
    "build": "webpack --mode production",
    "test": "jest",
    "lint": "eslint src/",
    "format": "prettier --write src/"
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

Copie e crie como `package.json` na raiz.

---

**Pronto para começar? Execute:**
```bash
npm install && npm run build
```

Depois carregue em `chrome://extensions/` 🚀
