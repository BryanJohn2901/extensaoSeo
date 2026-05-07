# SEO Analyzer Pro

Extensão Chrome para análise de SEO em tempo real. Analisa qualquer página e retorna um score de 0 a 10 com verificações detalhadas.

## Funcionalidades

- Score SEO de 0 a 10 exibido no badge do ícone
- Verificação de title tag (tamanho ideal: 30–60 caracteres)
- Verificação de meta description (ideal: 120–160 caracteres)
- Contagem e validação de H1
- Detecção de HTTPS e mobile viewport
- Análise de alt text em imagens
- Contagem de palavras e tempo de leitura estimado
- Exportação dos dados em JSON
- Histórico das últimas 50 análises via Chrome Storage

## Estrutura

```
├── manifest.json
├── webpack.config.js
├── package.json
├── src/
│   ├── popup/          # Interface do usuário
│   ├── content/        # Análise do DOM da página
│   ├── background/     # Service worker e badge
│   └── utils/          # Chrome Storage API
└── public/icons/       # Ícones da extensão
```

## Instalação local

**Pré-requisitos:** Node.js 18+, Chrome/Chromium

```bash
npm install
npm run build
```

Depois em `chrome://extensions/`:
1. Ative **Modo do desenvolvedor**
2. Clique **Carregar extensão não empacotada**
3. Selecione esta pasta

## Desenvolvimento

```bash
npm run dev      # watch mode
npm run build    # build de produção
npm run lint     # checar código
npm test         # rodar testes
```

## Roadmap

- [x] MVP: análise básica + score + export JSON
- [ ] Fase 2: relatório completo em React, gráficos, export PDF
- [ ] Fase 3: plano Pro com Stripe, integração PageSpeed Insights, Chrome Web Store
