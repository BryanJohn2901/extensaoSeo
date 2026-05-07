class PopupManager {
  constructor() {
    this.data = null;
    this.init();
  }

  init() {
    document.getElementById('reloadBtn').addEventListener('click', () => this.requestAnalysis());
    document.getElementById('exportBtn').addEventListener('click', () => this.exportJSON());
    document.getElementById('retryBtn').addEventListener('click', () => this.requestAnalysis());
    document.getElementById('promptBtn').addEventListener('click', () => this.openPromptModal());
    document.getElementById('modalClose').addEventListener('click', () => this.closePromptModal());
    document.getElementById('copyPromptBtn').addEventListener('click', () => this.copyPrompt());
    document.getElementById('promptModal').addEventListener('click', e => { if (e.target === e.currentTarget) this.closePromptModal(); });
    document.getElementById('themeBtn').addEventListener('click', () => this.toggleTheme());
    this.initTheme();
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });
    this.requestAnalysis();
  }

  switchTab(id) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === id));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === 'tab-' + id));
  }

  // ─── THEME ───────────────────────────────────────────────────

  initTheme() {
    const saved = localStorage.getItem('seo-theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('seo-theme', next);
  }

  async requestAnalysis() {
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('main').style.display = 'none';
    document.getElementById('error').style.display = 'none';

    const tabs = await new Promise(r => chrome.tabs.query({ active: true, currentWindow: true }, r));
    if (!tabs[0]) return this.showError('Aba nao encontrada.');
    const tabId = tabs[0].id;

    // DOM analysis (meta, headings, links, keywords, etc.)
    const domData = await new Promise(resolve => {
      chrome.tabs.sendMessage(tabId, { type: 'REQUEST_ANALYSIS' }, response => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(response && response.data || null);
      });
    });

    if (!domData) {
      const stored = await new Promise(r => chrome.storage.local.get('lastAnalysis', r));
      if (stored.lastAnalysis) {
        await this.enrichTagsViaScripting(stored.lastAnalysis, tabId);
        return this.render(stored.lastAnalysis);
      }
      return this.showError('Recarregue a pagina (F5) e tente novamente.');
    }

    // JS-globals analysis — runs in the page's own JS context
    await this.enrichTagsViaScripting(domData, tabId);
    this.render(domData);
  }

  async enrichTagsViaScripting(data, tabId) {
    try {
      const results = await new Promise(resolve => {
        chrome.scripting.executeScript(
          { target: { tabId }, world: 'MAIN', func: detectTagsInPageContext },
          res => {
            if (chrome.runtime.lastError) resolve([]);
            else resolve(res);
          }
        );
      });
      const jsTags = results && results[0] && results[0].result || [];
      data.tags = this.mergeTags(data.tags || [], jsTags);
    } catch (e) {
      // scripting API not available on this page (chrome://, etc.)
    }
  }

  mergeTags(domTags, jsTags) {
    const merged = [];
    const seen = new Set();
    // JS globals take priority — they're post-load, reflect reality
    jsTags.forEach(t => { if (!seen.has(t.name)) { seen.add(t.name); merged.push({ ...t }); } });
    // DOM fallback for tags not yet initialized as globals
    domTags.forEach(t => {
      if (!seen.has(t.name)) { seen.add(t.name); merged.push({ ...t }); }
      else if (t.id) {
        const ex = merged.find(m => m.name === t.name);
        if (ex && !ex.id) ex.id = t.id;
      }
    });
    return merged;
  }

  render(data) {
    this.data = data;
    try { document.getElementById('urlDisplay').textContent = new URL(data.url).hostname; } catch (e) {}

    this.renderSEO();
    this.renderTags();
    this.renderLinks();
    this.renderContent();
    this.renderPlan();
    this.updateBadges();

    document.getElementById('loading').style.display = 'none';
    document.getElementById('main').style.display = 'flex';
  }

  // ─── SEO TAB ─────────────────────────────────────────────────

  renderSEO() {
    const score = this.calcScore();
    const cls   = this.scoreClass(score);

    // Number
    const el = document.getElementById('scoreValue');
    el.textContent = score.toFixed(1);
    el.className = 'score-number ' + cls;

    // SVG ring — circumference of r=32 is ~201
    const circ = 201;
    const arc  = document.getElementById('ringArc');
    arc.className = 'ring-arc ' + cls;
    arc.style.strokeDashoffset = (circ * (1 - score / 10)).toFixed(2);

    // Bar (fallback)
    document.getElementById('scoreFill').style.width = (score / 10 * 100) + '%';
    document.getElementById('scoreFill').className = 'score-fill ' + cls;
    document.getElementById('scoreMsg').textContent = this.scoreLabel(score);

    this.renderMetaTags();
    this.renderOG();
    this.renderHeadings();
    this.renderImagesSection();
    this.renderURLSection();
    this.renderPerfSection();
    this.renderSchema();
    this.renderChecks();
  }

  // ── Meta Tags card ──────────────────────────────────────────

  renderMetaTags() {
    const meta = this.data.meta || {};

    this.setMetaField('titleContent', 'titleBadge', meta.title, meta.titleLength, meta.titleOptimal, '(ausente)');
    this.setMetaField('descContent',  'descBadge',  meta.description, meta.descriptionLength, meta.descriptionOptimal, '(ausente)');

    // Canonical
    const canonEl = document.getElementById('canonicalContent');
    const canonBadge = document.getElementById('canonicalBadge');
    if (meta.canonical) {
      canonEl.textContent = meta.canonical;
      canonEl.classList.remove('absent');
      canonBadge.textContent = 'presente';
      canonBadge.className = 'len-badge badge-ok';
    } else {
      canonEl.textContent = '(ausente)';
      canonEl.classList.add('absent');
      canonBadge.textContent = 'ausente';
      canonBadge.className = 'len-badge badge-warn';
    }

    // Robots
    const robotsEl = document.getElementById('robotsContent');
    const robots = meta.robots || 'nao definido';
    robotsEl.textContent = robots;
    if (meta.isNoindex) { robotsEl.textContent += ' — NOINDEX detectado!'; robotsEl.style.color = '#dc2626'; }

    // Mini badges
    const mini = (id, label, ok) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<span class="mini-badge ' + (ok ? 'mini-ok' : 'mini-warn') + '">' + label + '</span>';
    };
    mini('charsetMini',   'Charset: ' + (meta.hasCharset ? 'sim' : 'nao'),  meta.hasCharset);
    mini('faviconMini',   'Favicon: ' + (meta.hasFavicon ? 'sim' : 'nao'),  meta.hasFavicon);
    mini('ampMini',       'AMP: '     + (meta.hasAMP    ? 'sim' : 'nao'),   meta.hasAMP);
    const hrefl = meta.hreflangTags && meta.hreflangTags.length;
    mini('hreflangMini',  'Hreflang: '+ (hrefl ? hrefl + ' idiomas' : 'nao'), hrefl > 0);
  }

  // ── Open Graph & Twitter Card card ──────────────────────────

  renderOG() {
    const meta = this.data.meta || {};
    const og   = meta.og || {};
    const tw   = meta.tw || {};

    const ogFields = [
      { label: 'og:title',       value: og.title,       ideal: 'Titulo da pagina' },
      { label: 'og:description', value: og.description, ideal: 'Descricao para redes sociais' },
      { label: 'og:image',       value: og.image,       ideal: 'URL da imagem de compartilhamento' },
      { label: 'og:url',         value: og.url,         ideal: 'URL canonica da pagina' },
    ];

    document.getElementById('ogGrid').innerHTML = ogFields.map(f =>
      '<div class="og-field">' +
        '<div class="og-field-head">' +
          '<span class="og-label">' + f.label + '</span>' +
          '<span class="og-status ' + (f.value ? 'og-ok' : 'og-miss') + '">' + (f.value ? 'presente' : 'ausente') + '</span>' +
        '</div>' +
        '<p class="og-value ' + (f.value ? '' : 'absent') + '">' + (f.value ? f.value.substring(0, 80) : f.ideal) + '</p>' +
      '</div>'
    ).join('');

    const twBadge = document.getElementById('twBadge');
    const twContent = document.getElementById('twContent');
    if (tw.present || tw.card) {
      twBadge.textContent = tw.card || 'presente';
      twBadge.className = 'len-badge badge-ok';
      twContent.innerHTML =
        (tw.title       ? '<p class="og-value">' + tw.title.substring(0, 70) + '</p>' : '') +
        (tw.description ? '<p class="og-value small" style="color:#777">' + tw.description.substring(0, 100) + '</p>' : '');
    } else {
      twBadge.textContent = 'ausente';
      twBadge.className = 'len-badge badge-warn';
      twContent.innerHTML = '<p class="og-value absent">Twitter Card nao configurado</p>';
    }
  }

  // ── Headings card ────────────────────────────────────────────

  renderHeadings() {
    const h = this.data.headings || {};
    const dist = h.distribution || {};

    // Distribution bar
    const LEVELS = ['h1','h2','h3','h4','h5','h6'];
    document.getElementById('headingDist').innerHTML =
      '<div class="h-dist-row">' +
      LEVELS.map(lv => {
        const n = dist[lv] || 0;
        const ok = lv === 'h1' ? n === 1 : n >= 0;
        const cls = lv === 'h1' && n !== 1 ? 'h-count bad' : n > 0 ? 'h-count ok' : 'h-count zero';
        return '<div class="h-dist-cell"><span class="h-tag">' + lv.toUpperCase() + '</span><span class="' + cls + '">' + n + '</span></div>';
      }).join('') +
      '</div>' +
      ((h.hierarchyIssues && h.hierarchyIssues.length)
        ? '<p class="h-issue">' + h.hierarchyIssues.join(' · ') + '</p>'
        : '<p class="h-ok">Hierarquia de headings correta</p>');

    // Tree — first 15
    const tree = (h.domOrder || []).slice(0, 15);
    document.getElementById('headingTree').innerHTML = tree.map(item =>
      '<div class="h-tree-row" style="padding-left:' + ((item.level - 1) * 12) + 'px">' +
        '<span class="h-tree-tag h-tag-' + item.level + '">H' + item.level + '</span>' +
        '<span class="h-tree-text">' + item.text + '</span>' +
      '</div>'
    ).join('') || '<p class="absent" style="font-size:12px;padding:6px 0">Nenhum heading encontrado</p>';
  }

  // ── Images card ──────────────────────────────────────────────

  renderImagesSection() {
    const img = this.data.images || {};
    if (!img.total) {
      document.getElementById('imageStats').innerHTML = '<p class="empty-msg">Nenhuma imagem encontrada.</p>';
      return;
    }

    const bar = (pct, cls) =>
      '<div class="img-bar-wrap"><div class="img-bar ' + cls + '" style="width:' + pct + '%"></div></div>' +
      '<span class="img-bar-pct">' + pct + '%</span>';

    document.getElementById('imageStats').innerHTML =
      '<div class="img-stat"><span class="img-stat-lbl">Total</span><strong>' + img.total + '</strong></div>' +
      '<div class="img-stat"><span class="img-stat-lbl">Alt text</span>' + bar(img.altCoverage || 0, img.altCoverage === 100 ? 'bar-ok' : 'bar-warn') + '</div>' +
      '<div class="img-stat"><span class="img-stat-lbl">Lazy load</span>' + bar(img.lazyCoverage || 0, img.lazyCoverage >= 80 ? 'bar-ok' : 'bar-warn') + '</div>' +
      '<div class="img-stat"><span class="img-stat-lbl">WebP</span>'      + bar(img.webpCoverage || 0, img.webpCoverage >= 50 ? 'bar-ok' : 'bar-warn') + '</div>';

    const missing = img.missingAltList || [];
    if (missing.length > 0) {
      document.getElementById('imageMissingAlt').innerHTML =
        '<p class="img-missing-title">Imagens sem alt text:</p>' +
        missing.map(s => '<div class="img-missing-item">' + s + '</div>').join('');
    }
  }

  // ── URL card ─────────────────────────────────────────────────

  renderURLSection() {
    const u = this.data.url_analysis || {};
    const row = (label, value, status) =>
      '<div class="url-row">' +
        '<span class="url-lbl">' + label + '</span>' +
        '<span class="url-val ' + (status === 'ok' ? 'val-ok' : status === 'bad' ? 'val-bad' : 'val-warn') + '">' + value + '</span>' +
      '</div>';

    document.getElementById('urlAnalysis').innerHTML =
      '<p class="meta-text small" style="margin-bottom:8px;word-break:break-all">' + (u.full || '') + '</p>' +
      row('Profundidade', u.depth + ' nivel(s)', u.depth <= 4 ? 'ok' : 'warn') +
      row('Comprimento', u.totalLength + ' chars', u.totalLength <= 100 ? 'ok' : 'warn') +
      row('Parametros', u.hasParams ? (u.params || '') : 'nenhum', u.hasParams ? 'warn' : 'ok') +
      row('Hifens na URL', u.hasHyphens ? 'sim (bom)' : 'nao', u.hasHyphens ? 'ok' : 'warn') +
      row('Underscores', u.hasUnderscores ? 'sim (evitar)' : 'nao', u.hasUnderscores ? 'warn' : 'ok') +
      row('Letras maiusculas', u.hasUpperCase ? 'sim (evitar)' : 'nao', u.hasUpperCase ? 'warn' : 'ok');
  }

  // ── Performance card ─────────────────────────────────────────

  renderPerfSection() {
    const p = this.data.performance || {};
    const row = (label, value, status) =>
      '<div class="url-row"><span class="url-lbl">' + label + '</span><span class="url-val ' +
      (status === 'ok' ? 'val-ok' : status === 'bad' ? 'val-bad' : 'val-warn') + '">' + value + '</span></div>';

    const hints = [p.hasPreconnect && 'preconnect', p.hasPreload && 'preload', p.hasDNSPrefetch && 'dns-prefetch'].filter(Boolean);

    document.getElementById('perfStats').innerHTML =
      row('Scripts externos',    p.scripts || 0,       'ok') +
      row('Scripts bloqueantes', p.scriptsBlocking || 0, (p.scriptsBlocking || 0) === 0 ? 'ok' : (p.scriptsBlocking || 0) <= 2 ? 'warn' : 'bad') +
      row('Scripts inline',      p.scriptsInline || 0, (p.scriptsInline || 0) <= 3 ? 'ok' : 'warn') +
      row('CSS externos',        p.cssExternal || 0,   'ok') +
      row('Iframes',             p.iframes || 0,        (p.iframes || 0) <= 2 ? 'ok' : 'warn') +
      row('Resource hints',      hints.length ? hints.join(', ') : 'nenhum', hints.length >= 2 ? 'ok' : 'warn');
  }

  // ── Schema card ──────────────────────────────────────────────

  renderSchema() {
    const meta = this.data.meta || {};
    const types = meta.schemaTypes || [];
    const count = meta.schemaCount || 0;

    if (count === 0) {
      document.getElementById('schemaInfo').innerHTML = '<p class="empty-msg">Nenhum dado estruturado (JSON-LD) encontrado.</p>';
    } else {
      document.getElementById('schemaInfo').innerHTML =
        '<p style="font-size:12px;color:#555;margin-bottom:8px">' + count + ' bloco(s) JSON-LD encontrado(s)</p>' +
        types.map(t => '<span class="schema-badge">' + t + '</span>').join(' ');
    }
  }

  setMetaField(contentId, badgeId, text, length, optimal, emptyLabel, rangeLabel) {
    const contentEl = document.getElementById(contentId);
    const badgeEl   = document.getElementById(badgeId);
    if (text) {
      contentEl.textContent = text;
      contentEl.classList.remove('absent');
      badgeEl.textContent   = length + ' chars';
      badgeEl.className     = 'len-badge ' + (optimal ? 'badge-ok' : 'badge-warn');
    } else {
      contentEl.textContent = emptyLabel;
      contentEl.classList.add('absent');
      badgeEl.textContent   = 'ausente';
      badgeEl.className     = 'len-badge badge-bad';
    }
  }

  renderChecks() {
    const d    = this.data;
    const meta = d.meta || {};
    const img  = d.images || {};
    const h    = d.headings || {};
    const h1   = (h.distribution && h.distribution.h1) || 0;
    const wc   = (d.keywords && d.keywords.wordCount) || 0;
    const url  = d.url_analysis || {};
    const perf = d.performance || {};
    const og   = meta.og || {};
    const cq   = d.contentQuality || {};

    const checks = [
      // ── Meta ──────────────────────────────────────────────
      { group: 'Meta', label: 'Title Tag',
        status: !meta.title ? 'bad' : meta.titleOptimal ? 'good' : 'warn',
        msg: !meta.title ? 'Ausente' : meta.titleLength + ' chars (ideal 30-60)' },

      { group: 'Meta', label: 'Meta Description',
        status: !meta.description ? 'bad' : meta.descriptionOptimal ? 'good' : 'warn',
        msg: !meta.description ? 'Ausente' : meta.descriptionLength + ' chars (ideal 120-160)' + (meta.descriptionHasCTA ? ' — tem CTA' : ' — adicionar call-to-action') },

      { group: 'Meta', label: 'Tag Canonical',
        status: meta.hasCanonical ? 'good' : 'warn',
        msg: meta.hasCanonical ? meta.canonical.substring(0, 60) : 'Ausente — risco de conteudo duplicado' },

      { group: 'Meta', label: 'Robots Meta',
        status: meta.isNoindex ? 'bad' : 'good',
        msg: meta.isNoindex ? 'NOINDEX — pagina nao sera indexada!' : (meta.robots || 'nao definido (padrao: index, follow)') },

      { group: 'Meta', label: 'Atributo Lang',
        status: meta.lang ? 'good' : 'warn',
        msg: meta.lang ? 'lang="' + meta.lang + '"' : 'Ausente — adicionar lang na tag <html>' },

      { group: 'Meta', label: 'Charset',
        status: meta.hasCharset ? 'good' : 'warn',
        msg: meta.hasCharset ? 'Declarado' : 'Meta charset ausente' },

      { group: 'Meta', label: 'Favicon',
        status: meta.hasFavicon ? 'good' : 'warn',
        msg: meta.hasFavicon ? 'Presente' : 'Favicon nao encontrado' },

      // ── Social ────────────────────────────────────────────
      { group: 'Social', label: 'Open Graph',
        status: (meta.og && meta.og.score) >= 4 ? 'good' : (meta.og && meta.og.score) >= 2 ? 'warn' : 'bad',
        msg: (meta.og && meta.og.score) + '/4 tags configuradas (title, description, image, url)' },

      { group: 'Social', label: 'OG Image',
        status: og.image ? 'good' : 'warn',
        msg: og.image ? og.image.substring(0, 60) : 'og:image ausente — imagem de compartilhamento nao definida' },

      { group: 'Social', label: 'Twitter Card',
        status: (meta.tw && meta.tw.present) ? 'good' : 'warn',
        msg: (meta.tw && meta.tw.card) ? 'card="' + meta.tw.card + '"' : 'Twitter Card nao configurado' },

      // ── Headings ──────────────────────────────────────────
      { group: 'Headings', label: 'H1',
        status: h1 === 0 ? 'bad' : h1 === 1 ? 'good' : 'warn',
        msg: h1 === 0 ? 'Nenhum H1 encontrado' : h1 === 1
          ? '"' + ((h.h1Texts && h.h1Texts[0]) || '').substring(0, 50) + '"'
          : h1 + ' H1s — deve ter exatamente 1' },

      { group: 'Headings', label: 'H2s presentes',
        status: h.hasH2 ? 'good' : 'warn',
        msg: h.hasH2 ? (h.distribution && h.distribution.h2) + ' H2(s) encontrados' : 'Nenhum H2 — estrutura de topicos ausente' },

      { group: 'Headings', label: 'Hierarquia de Headings',
        status: (h.hierarchyIssues && h.hierarchyIssues.length) ? 'warn' : 'good',
        msg: (h.hierarchyIssues && h.hierarchyIssues.length) ? h.hierarchyIssues.join(', ') : 'Hierarquia correta' },

      // ── Imagens ────────────────────────────────────────────
      { group: 'Imagens', label: 'Alt Text',
        status: img.altCoverage === 100 ? 'good' : img.altCoverage >= 80 ? 'warn' : 'bad',
        msg: img.total === 0 ? 'Sem imagens' : img.altCoverage + '% das imagens com alt (' + img.withAlt + '/' + img.total + ')' },

      { group: 'Imagens', label: 'Lazy Loading',
        status: img.total === 0 ? 'good' : img.lazyCoverage >= 80 ? 'good' : img.lazyCoverage > 0 ? 'warn' : 'warn',
        msg: img.total === 0 ? 'Sem imagens' : img.lazyCoverage + '% das imagens com loading="lazy"' },

      { group: 'Imagens', label: 'Formato WebP',
        status: img.total === 0 ? 'good' : img.webpCoverage >= 50 ? 'good' : 'warn',
        msg: img.total === 0 ? 'Sem imagens' : img.webpCoverage + '% das imagens em WebP' },

      // ── Tecnico ────────────────────────────────────────────
      { group: 'Tecnico', label: 'HTTPS / SSL',
        status: url.isHTTPS ? 'good' : 'bad',
        msg: url.isHTTPS ? 'Conexao segura (HTTPS)' : 'Pagina sem HTTPS — fator de ranqueamento' },

      { group: 'Tecnico', label: 'Mobile Friendly',
        status: (meta.hasViewport || (d.technical && d.technical.mobile)) ? 'good' : 'bad',
        msg: (meta.hasViewport || (d.technical && d.technical.mobile)) ? 'Meta viewport configurado' : 'Meta viewport ausente — indexacao mobile-first prejudicada' },

      { group: 'Tecnico', label: 'Dados Estruturados',
        status: (meta.schemaCount || 0) > 0 ? 'good' : 'warn',
        msg: (meta.schemaCount || 0) > 0
          ? (meta.schemaCount) + ' JSON-LD: ' + (meta.schemaTypes || []).join(', ')
          : 'Nenhum Schema.org encontrado — rich snippets nao disponiveis' },

      { group: 'Tecnico', label: 'Scripts Bloqueantes',
        status: (perf.scriptsBlocking || 0) === 0 ? 'good' : (perf.scriptsBlocking || 0) <= 2 ? 'warn' : 'bad',
        msg: (perf.scriptsBlocking || 0) === 0
          ? 'Nenhum script render-blocking'
          : (perf.scriptsBlocking) + ' script(s) bloqueando renderizacao (sem async/defer)' },

      // ── Conteudo ───────────────────────────────────────────
      { group: 'Conteudo', label: 'Volume de Conteudo',
        status: wc >= 300 ? 'good' : wc >= 100 ? 'warn' : 'bad',
        msg: wc + ' palavras — ' + (d.keywords && d.keywords.readingTime || 0) + ' min leitura' },

      { group: 'Conteudo', label: 'URL Limpa',
        status: url.isClean ? 'good' : 'warn',
        msg: url.isClean ? 'URL limpa e amigavel' :
          [url.hasParams && 'tem parametros', url.hasUnderscores && 'tem underscores', url.hasUpperCase && 'tem maiusculas'].filter(Boolean).join(', ') || 'URL pode ser melhorada' },

      { group: 'Conteudo', label: 'Textos Ancora',
        status: (cq.poorAnchorTexts || 0) === 0 ? 'good' : 'warn',
        msg: (cq.poorAnchorTexts || 0) === 0
          ? 'Nenhum ancora generico detectado'
          : (cq.poorAnchorTexts) + ' ancora(s) genericos ("clique aqui", "saiba mais", etc.)' },
    ];

    const icons = { good: '&#10003;', warn: '!', bad: '&#10005;' };
    const grouped = {};
    checks.forEach(c => { if (!grouped[c.group]) grouped[c.group] = []; grouped[c.group].push(c); });

    document.getElementById('checksContainer').innerHTML = Object.entries(grouped).map(([group, items]) =>
      '<div class="check-group">' +
        '<div class="check-group-label">' + group + '</div>' +
        items.map(c =>
          '<div class="check-item border-' + c.status + '">' +
            '<span class="check-icon icon-' + c.status + '">' + icons[c.status] + '</span>' +
            '<div class="check-body"><strong>' + c.label + '</strong><small>' + c.msg + '</small></div>' +
          '</div>'
        ).join('') +
      '</div>'
    ).join('');
  }

  calcScore() {
    const d    = this.data;
    const meta = d.meta || {};
    const img  = d.images || {};
    const h    = d.headings || {};
    const h1   = (h.distribution && h.distribution.h1) || 0;
    const wc   = (d.keywords && d.keywords.wordCount) || 0;
    const url  = d.url_analysis || {};
    const perf = d.performance || {};
    const og   = meta.og || {};
    const cq   = d.contentQuality || {};
    const isHTTPS  = url.isHTTPS || (d.technical && d.technical.isHTTPS);
    const isMobile = meta.hasViewport || (d.technical && d.technical.mobile);
    let ded = 0;

    // Meta
    if (!meta.title) ded += 2; else if (!meta.titleOptimal) ded += 0.8;
    if (!meta.description) ded += 2; else if (!meta.descriptionOptimal) ded += 0.8;
    if (!meta.hasCanonical) ded += 0.5;
    if (meta.isNoindex) ded += 1.5;
    if (!meta.hasCharset) ded += 0.2;
    if (!meta.hasFavicon) ded += 0.3;
    if (!meta.lang) ded += 0.3;

    // Social
    const ogScore = og.score || 0;
    if (ogScore < 2) ded += 0.5; else if (ogScore < 4) ded += 0.2;
    if (!og.image) ded += 0.3;
    if (!(meta.tw && meta.tw.present)) ded += 0.3;

    // Headings
    if (h1 === 0) ded += 1.5; else if (h1 > 1) ded += 0.5;
    if (!h.hasH2) ded += 0.3;
    if (h.hierarchyIssues && h.hierarchyIssues.length) ded += 0.3;

    // Images
    if (img.total > 0) {
      if ((img.altCoverage || 0) < 50) ded += 1;
      else if ((img.altCoverage || 0) < 80) ded += 0.5;
      if ((img.lazyCoverage || 0) < 30) ded += 0.3;
      if ((img.webpCoverage || 0) < 20) ded += 0.2;
    }

    // Technical
    if (!isHTTPS) ded += 2;
    if (!isMobile) ded += 1.5;
    if ((meta.schemaCount || 0) === 0) ded += 0.3;
    const blocking = perf.scriptsBlocking || 0;
    if (blocking > 2) ded += 0.5; else if (blocking > 0) ded += 0.2;

    // Content
    if (wc < 100) ded += 1; else if (wc < 300) ded += 0.5;
    if ((cq.poorAnchorTexts || 0) > 0) ded += 0.3;
    if (!url.isClean) ded += 0.3;

    return Math.max(0, Math.round((10 - ded) * 10) / 10);
  }

  scoreClass(s) { return s >= 8 ? 'green' : s >= 5 ? 'amber' : 'red'; }

  scoreLabel(s) {
    if (s >= 8) return 'Excelente — SEO bem otimizado';
    if (s >= 6) return 'Bom — ha melhorias possiveis';
    if (s >= 4) return 'Regular — varios pontos para otimizar';
    return 'Critico — muitos problemas identificados';
  }

  // ─── TAGS TAB ────────────────────────────────────────────────

  renderTags() {
    const tags     = this.data.tags || [];
    const webhooks = this.data.webhooks || [];

    // Group tags by category
    const grouped = {};
    tags.forEach(t => {
      if (!grouped[t.category]) grouped[t.category] = [];
      grouped[t.category].push(t);
    });

    const CATEGORY_COLOR = {
      'Tag Manager': '#5a67d8',
      'Analytics':   '#0891b2',
      'Ads':         '#7c3aed',
      'Heatmap':     '#d97706',
      'Chat':        '#059669',
      'CRM':         '#db2777',
      'Email':       '#dc2626'
    };

    if (tags.length === 0) {
      document.getElementById('tagsList').innerHTML = '<p class="empty-msg">Nenhuma tag detectada nesta pagina.</p>';
    } else {
      document.getElementById('tagsList').innerHTML = Object.entries(grouped).map(([cat, items]) =>
        '<div class="tag-group">' +
          '<p class="tag-group-label" style="color:' + (CATEGORY_COLOR[cat] || '#555') + '">' + cat + '</p>' +
          items.map(t =>
            '<div class="tag-item">' +
              '<span class="tag-dot" style="background:' + (CATEGORY_COLOR[cat] || '#555') + '"></span>' +
              '<div class="tag-info">' +
                '<span class="tag-name">' + t.name + '</span>' +
                (t.id ? '<span class="tag-id">' + t.id + '</span>' : '') +
              '</div>' +
              '<span class="tag-status">ativo</span>' +
            '</div>'
          ).join('') +
        '</div>'
      ).join('');
    }

    if (webhooks.length === 0) {
      document.getElementById('webhooksList').innerHTML = '<p class="empty-msg">Nenhum webhook detectado.</p>';
    } else {
      document.getElementById('webhooksList').innerHTML = webhooks.map(w =>
        '<div class="webhook-item">' +
          '<div class="webhook-name">' + w.name + '</div>' +
          '<div class="webhook-url">' + w.url + '</div>' +
        '</div>'
      ).join('');
    }
  }

  // ─── LINKS TAB ───────────────────────────────────────────────

  renderLinks() {
    const links = this.data.links || {};

    document.getElementById('statInternal').textContent  = links.internal || 0;
    document.getElementById('statExternal').textContent  = links.external || 0;
    document.getElementById('statRedirects').textContent = (links.redirects || []).length;
    document.getElementById('statNofollow').textContent  = links.nofollow || 0;

    // Redirects
    const redirects = links.redirects || [];
    if (redirects.length === 0) {
      document.getElementById('redirectsList').innerHTML = '<p class="empty-msg">Nenhum link de redirecionamento encontrado.</p>';
    } else {
      document.getElementById('redirectsList').innerHTML = redirects.map(r =>
        '<div class="link-item">' +
          '<span class="link-service">' + r.service + '</span>' +
          '<div class="link-detail">' +
            '<span class="link-text">' + r.text + '</span>' +
            '<span class="link-href">' + r.href + '</span>' +
          '</div>' +
        '</div>'
      ).join('');
    }

    // External domains
    const domains = links.topExternalDomains || [];
    if (domains.length === 0) {
      document.getElementById('externalDomainsList').innerHTML = '<p class="empty-msg">Nenhum dominio externo encontrado.</p>';
    } else {
      const max = domains[0].count;
      document.getElementById('externalDomainsList').innerHTML = domains.map(d =>
        '<div class="domain-row">' +
          '<span class="domain-name">' + d.domain + '</span>' +
          '<div class="domain-bar-wrap"><div class="domain-bar" style="width:' + Math.round(d.count / max * 100) + '%"></div></div>' +
          '<span class="domain-count">' + d.count + '</span>' +
        '</div>'
      ).join('');
    }

    // Forms
    const forms = links.forms || [];
    if (forms.length === 0) {
      document.getElementById('formsList').innerHTML = '<p class="empty-msg">Nenhum formulario encontrado.</p>';
    } else {
      document.getElementById('formsList').innerHTML = forms.map(f =>
        '<div class="form-item">' +
          '<span class="form-method ' + (f.method === 'POST' ? 'method-post' : 'method-get') + '">' + f.method + '</span>' +
          '<div class="form-detail">' +
            '<span class="form-action">' + f.action + '</span>' +
            '<span class="form-inputs">' + f.inputs + ' campo(s)</span>' +
          '</div>' +
        '</div>'
      ).join('');
    }
  }

  // ─── CONTENT TAB ─────────────────────────────────────────────

  renderContent() {
    const kw = this.data.keywords || {};
    document.getElementById('statWords').textContent      = kw.wordCount || 0;
    document.getElementById('statReading').textContent    = kw.readingTime || 0;
    document.getElementById('statParagraphs').textContent = kw.paragraphs || 0;

    const keywords = kw.topKeywords || [];
    if (keywords.length === 0) {
      document.getElementById('keywordsTable').innerHTML = '<p class="empty-msg">Nenhuma palavra-chave identificada.</p>';
      return;
    }
    const max = keywords[0].count;
    document.getElementById('keywordsTable').innerHTML = keywords.map((item, i) =>
      '<div class="kw-row">' +
        '<span class="kw-rank">' + (i + 1) + '</span>' +
        '<span class="kw-word">' + item.word + '</span>' +
        '<div class="kw-bar-wrap"><div class="kw-bar" style="width:' + Math.round(item.count / max * 100) + '%"></div></div>' +
        '<span class="kw-count">' + item.count + 'x</span>' +
      '</div>'
    ).join('');
  }

  // ─── PLAN TAB ────────────────────────────────────────────────

  renderPlan() {
    const actions = this.buildActionPlan();
    if (actions.length === 0) {
      document.getElementById('actionPlan').innerHTML = '';
      document.getElementById('allGood').style.display = 'block';
      return;
    }
    document.getElementById('allGood').style.display = 'none';
    const order = { critico: 0, importante: 1, recomendado: 2 };
    actions.sort((a, b) => order[a.p] - order[b.p]);
    document.getElementById('actionPlan').innerHTML = actions.map((a, i) =>
      '<div class="action-item action-' + a.p + '">' +
        '<div class="action-head">' +
          '<span class="action-num">' + (i + 1) + '</span>' +
          '<span class="action-badge badge-' + a.p + '">' + a.p.toUpperCase() + '</span>' +
          '<span class="action-impact">Impacto: ' + a.impact + '</span>' +
        '</div>' +
        '<p class="action-text">' + a.text + '</p>' +
      '</div>'
    ).join('');
  }

  buildActionPlan() {
    const d    = this.data;
    const meta = d.meta || {};
    const img  = d.images || {};
    const h    = d.headings || {};
    const h1   = (h.distribution && h.distribution.h1) || 0;
    const kw   = d.keywords || {};
    const url  = d.url_analysis || {};
    const perf = d.performance || {};
    const og   = meta.og || {};
    const cq   = d.contentQuality || {};
    const isHTTPS  = url.isHTTPS || (d.technical && d.technical.isHTTPS);
    const isMobile = meta.hasViewport || (d.technical && d.technical.mobile);
    const acts = [];

    if (!isHTTPS)
      acts.push({ p: 'critico', impact: 'Alto', text: 'Migrar para HTTPS. SSL e fator de ranqueamento confirmado pelo Google e aumenta a confianca do usuario.' });

    if (!isMobile)
      acts.push({ p: 'critico', impact: 'Alto', text: "Adicionar <meta name='viewport' content='width=device-width, initial-scale=1'>. Google usa indexacao mobile-first." });

    if (meta.isNoindex)
      acts.push({ p: 'critico', impact: 'Alto', text: 'Meta robots com NOINDEX detectado. Esta pagina nao sera indexada pelo Google. Remova o noindex se deseja que ela apareca nos resultados.' });

    if (!meta.title)
      acts.push({ p: 'critico', impact: 'Alto', text: 'Adicionar tag <title> com 30-60 caracteres incluindo a palavra-chave principal logo no inicio.' });
    else if (meta.titleLength < 30)
      acts.push({ p: 'importante', impact: 'Alto', text: 'Expandir o title (atual: ' + meta.titleLength + ' chars). Ideal entre 30-60 caracteres com palavra-chave principal.' });
    else if (meta.titleLength > 60)
      acts.push({ p: 'importante', impact: 'Medio', text: 'Reduzir o title (atual: ' + meta.titleLength + ' chars). Acima de 60 chars o Google trunca nos resultados de busca.' });

    if (!meta.description)
      acts.push({ p: 'critico', impact: 'Alto', text: 'Adicionar meta description com 120-160 caracteres. Inclua a palavra-chave e um call-to-action para aumentar o CTR.' });
    else if (meta.descriptionLength < 120)
      acts.push({ p: 'importante', impact: 'Alto', text: 'Expandir a meta description (atual: ' + meta.descriptionLength + ' chars). Ideal entre 120-160 caracteres com call-to-action.' });
    else if (meta.descriptionLength > 160)
      acts.push({ p: 'importante', impact: 'Medio', text: 'Reduzir a meta description (atual: ' + meta.descriptionLength + ' chars). Acima de 160 chars o Google trunca o texto.' });

    if (h1 === 0)
      acts.push({ p: 'critico', impact: 'Alto', text: 'Adicionar uma tag H1 unica com a palavra-chave principal. H1 e o titulo de maior peso para o Google.' });
    else if (h1 > 1)
      acts.push({ p: 'importante', impact: 'Medio', text: 'Manter apenas 1 H1 por pagina (atual: ' + h1 + '). Use H2 e H3 para subtitulos hierarquicos.' });

    if (!meta.hasCanonical)
      acts.push({ p: 'recomendado', impact: 'Medio', text: "Adicionar <link rel='canonical' href='URL'> para evitar penalizacao por conteudo duplicado." });

    const ogScore = og.score || 0;
    if (ogScore < 2)
      acts.push({ p: 'importante', impact: 'Medio', text: 'Configurar tags Open Graph (og:title, og:description, og:image, og:url). Essenciais para exibicao correta no Facebook, LinkedIn e WhatsApp.' });
    else if (ogScore < 4) {
      const missing4 = [!og.title && 'og:title', !og.description && 'og:description', !og.image && 'og:image', !og.url && 'og:url'].filter(Boolean);
      acts.push({ p: 'recomendado', impact: 'Medio', text: 'Completar tags Open Graph — faltam: ' + missing4.join(', ') });
    }

    if (!og.image && ogScore >= 2)
      acts.push({ p: 'importante', impact: 'Medio', text: 'Adicionar og:image (1200x630px). Sem imagem de compartilhamento o link fica sem preview visual nas redes sociais.' });

    if (!(meta.tw && meta.tw.present))
      acts.push({ p: 'recomendado', impact: 'Medio', text: "Adicionar Twitter Cards (<meta name='twitter:card' content='summary_large_image'>) para melhor preview no Twitter/X." });

    const missingAlt = img.missingAlt || 0;
    const total      = img.total || 0;
    if (missingAlt > 0)
      acts.push({ p: missingAlt > total * 0.5 ? 'importante' : 'recomendado', impact: 'Medio', text: 'Adicionar atributo alt em ' + missingAlt + ' imagem(ns). Alt text melhora acessibilidade e indexacao de imagens.' });

    if (total > 0 && (img.lazyCoverage || 0) < 30)
      acts.push({ p: 'recomendado', impact: 'Medio', text: 'Adicionar loading="lazy" nas imagens (' + (img.lazyCoverage || 0) + '% de cobertura atual). Reduz o tempo de carregamento inicial.' });

    if (total > 0 && (img.webpCoverage || 0) < 20)
      acts.push({ p: 'recomendado', impact: 'Medio', text: 'Converter imagens para formato WebP (' + (img.webpCoverage || 0) + '% de cobertura atual). WebP reduz o tamanho em 25-34% vs JPEG/PNG.' });

    if ((meta.schemaCount || 0) === 0)
      acts.push({ p: 'recomendado', impact: 'Alto', text: 'Adicionar dados estruturados JSON-LD (Schema.org). Habilita rich snippets no Google: estrelas, FAQ, breadcrumbs, etc.' });

    const blocking = perf.scriptsBlocking || 0;
    if (blocking > 0)
      acts.push({ p: blocking > 2 ? 'importante' : 'recomendado', impact: 'Medio', text: 'Adicionar atributo async ou defer em ' + blocking + ' script(s) bloqueantes. Scripts sem async/defer atrasam o First Contentful Paint.' });

    if ((kw.wordCount || 0) < 300)
      acts.push({ p: 'recomendado', impact: 'Medio', text: 'Aumentar o conteudo da pagina (atual: ' + (kw.wordCount || 0) + ' palavras). Paginas com 300+ palavras tendem a ranquear melhor.' });

    if (h.hierarchyIssues && h.hierarchyIssues.length > 0)
      acts.push({ p: 'recomendado', impact: 'Baixo', text: 'Corrigir hierarquia de headings: ' + h.hierarchyIssues.join('; ') });

    if (!h.hasH2 && h1 > 0)
      acts.push({ p: 'recomendado', impact: 'Baixo', text: 'Adicionar headings H2 para estruturar o conteudo em topicos. Facilita a leitura e o rastreamento.' });

    if ((cq.poorAnchorTexts || 0) > 0)
      acts.push({ p: 'recomendado', impact: 'Baixo', text: 'Substituir ' + cq.poorAnchorTexts + ' ancoras genericas ("clique aqui", "saiba mais") por textos descritivos com palavras-chave.' });

    if (!meta.hasFavicon)
      acts.push({ p: 'recomendado', impact: 'Baixo', text: 'Adicionar favicon ao site. Melhora o reconhecimento da marca nos resultados de busca e nas abas do navegador.' });

    if (!meta.lang)
      acts.push({ p: 'recomendado', impact: 'Baixo', text: "Adicionar atributo lang na tag <html> (ex: lang='pt-BR'). Ajuda buscadores a identificar o idioma da pagina." });

    return acts;
  }

  // ─── BADGES ──────────────────────────────────────────────────

  updateBadges() {
    const checks = this.data && document.querySelectorAll('.check-item.border-bad, .check-item.border-warn');
    const issues  = checks ? Array.from(checks).filter(c => c.classList.contains('border-bad')).length : 0;
    const actions = document.getElementById('actionPlan').children.length;
    const tagsCount = (this.data.tags || []).length;
    const redirectsCount = ((this.data.links || {}).redirects || []).length;

    this.setBadge('badge-seo',   issues,        'red');
    this.setBadge('badge-tags',  tagsCount,     'blue');
    this.setBadge('badge-links', redirectsCount,'orange');
    this.setBadge('badge-plan',  actions,       'red');
  }

  setBadge(id, count, color) {
    const el = document.getElementById(id);
    if (!el) return;
    if (count > 0) {
      el.textContent = count;
      el.className = 'tab-badge badge-' + color;
    } else {
      el.textContent = '';
      el.className = 'tab-badge';
    }
  }

  // ─── EXPORT ──────────────────────────────────────────────────

  exportJSON() {
    if (!this.data) return;
    const out = { ...this.data, score: this.calcScore(), actionPlan: this.buildActionPlan(), exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'seo-analysis-' + Date.now() + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── AI PROMPT ───────────────────────────────────────────────

  openPromptModal() {
    if (!this.data) return;
    document.getElementById('promptText').value = this.generateAIPrompt();
    document.getElementById('promptModal').style.display = 'flex';
  }

  closePromptModal() {
    document.getElementById('promptModal').style.display = 'none';
    const btn = document.getElementById('copyPromptBtn');
    btn.textContent = 'Copiar Prompt';
    btn.className = 'btn btn-primary';
  }

  copyPrompt() {
    const text = document.getElementById('promptText').value;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('copyPromptBtn');
      btn.textContent = 'Copiado!';
      btn.className = 'btn btn-copied';
      setTimeout(() => {
        btn.textContent = 'Copiar Prompt';
        btn.className = 'btn btn-primary';
      }, 2000);
    });
  }

  generateAIPrompt() {
    const d    = this.data;
    const meta = d.meta || {};
    const img  = d.images || {};
    const h    = d.headings || {};
    const h1   = (h.distribution && h.distribution.h1) || 0;
    const kw   = d.keywords || {};
    const url  = d.url_analysis || {};
    const perf = d.performance || {};
    const og   = meta.og || {};
    const score = this.calcScore();
    const actions = this.buildActionPlan();
    const isHTTPS = url.isHTTPS || (d.technical && d.technical.isHTTPS);
    const isMobile = meta.hasViewport || (d.technical && d.technical.mobile);

    const criticos    = actions.filter(a => a.p === 'critico');
    const importantes = actions.filter(a => a.p === 'importante');
    const recomendados = actions.filter(a => a.p === 'recomendado');

    const line = (label, value) => `- ${label}: ${value}`;
    const list = (arr, icon) => arr.length ? arr.map((a, i) => `${icon} ${i + 1}. ${a.text}`).join('\n') : '  Nenhum';

    const tags = (d.tags || []).map(t => t.name + (t.id ? ` (${t.id})` : '')).join(', ') || 'Nenhuma detectada';

    const headingH1 = h.h1Texts && h.h1Texts[0] ? `"${h.h1Texts[0]}"` : '(ausente)';
    const schemaTypes = (meta.schemaTypes || []).join(', ') || 'Nenhum';

    return `Sou responsavel pelo site abaixo e preciso de ajuda para corrigir os problemas de SEO identificados por uma ferramenta de analise. Por favor, me forneça solucoes praticas com o codigo HTML exato para cada correcao.

## Dados da Pagina Analisada

${line('URL', d.url || '(nao identificada)')}
${line('Score SEO atual', score + '/10')}
${line('Title', meta.title ? `"${meta.title}" (${meta.titleLength} chars)` : 'AUSENTE')}
${line('Meta Description', meta.description ? `"${meta.description.substring(0, 100)}..." (${meta.descriptionLength} chars)` : 'AUSENTE')}
${line('Canonical', meta.canonical || 'AUSENTE')}
${line('Robots', meta.robots || 'nao definido')}
${line('H1', h1 === 0 ? 'AUSENTE' : h1 === 1 ? headingH1 : h1 + ' H1s: ' + (h.h1Texts || []).join(' | '))}
${line('H2s', (h.distribution && h.distribution.h2) || 0)}
${line('HTTPS', isHTTPS ? 'Sim' : 'NAO')}
${line('Mobile Viewport', isMobile ? 'Sim' : 'NAO')}
${line('Open Graph', (og.score || 0) + '/4 tags (title, description, image, url)')}
${line('Twitter Card', (meta.tw && meta.tw.card) ? meta.tw.card : 'AUSENTE')}
${line('Dados Estruturados (Schema)', schemaTypes)}
${line('Imagens', img.total || 0)}
${line('  - Alt text', (img.altCoverage || 0) + '% de cobertura')}
${line('  - Lazy loading', (img.lazyCoverage || 0) + '% de cobertura')}
${line('  - Formato WebP', (img.webpCoverage || 0) + '% de cobertura')}
${line('Scripts bloqueantes', perf.scriptsBlocking || 0)}
${line('Volume de conteudo', (kw.wordCount || 0) + ' palavras')}
${line('Tags/Pixels detectados', tags)}

## Problemas Identificados

${criticos.length ? '### CRITICOS (impacto direto no ranqueamento)\n' + list(criticos, '🔴') : ''}

${importantes.length ? '### IMPORTANTES (melhoram significativamente o SEO)\n' + list(importantes, '🟡') : ''}

${recomendados.length ? '### RECOMENDADOS (boas praticas)\n' + list(recomendados, '🟢') : ''}

## O Que Preciso

Para cada problema acima, por favor:
1. Explique em 1 linha por que isso afeta o SEO
2. Forneça o codigo HTML/meta tag exato para corrigir, adaptado ao contexto do meu site
3. Se aplicavel, mostre um exemplo antes e depois

Comece pelos problemas CRITICOS e siga a ordem de prioridade.
Se precisar de mais contexto sobre o site para personalizar as sugestoes, pergunte.`.trim();
  }

  showError(msg) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display   = 'flex';
    document.getElementById('errorMsg').textContent  = msg;
  }
}

document.addEventListener('DOMContentLoaded', () => new PopupManager());

// ─── MAIN-WORLD TAG DETECTOR ──────────────────────────────────────────────────
// Esta funcao e serializada e injetada no contexto JS real da pagina
// (world: "MAIN"), permitindo acesso a window.gtag, window.fbq, etc.
function detectTagsInPageContext() {
  const tags = [];
  const add = (name, category, id) => tags.push({ name, category, id: id || '' });

  try {
    // ── Google Tag Manager ──────────────────────────────────────
    if (window.google_tag_manager) {
      const ids = Object.keys(window.google_tag_manager).filter(k => /^GTM-/.test(k));
      ids.length ? ids.forEach(id => add('Google Tag Manager', 'Tag Manager', id))
                 : add('Google Tag Manager', 'Tag Manager', '');
    } else if (Array.isArray(window.dataLayer)) {
      add('Google Tag Manager', 'Tag Manager', '');
    }

    // ── Google Analytics 4 ──────────────────────────────────────
    if (typeof window.gtag === 'function') {
      let id = '';
      if (Array.isArray(window.dataLayer)) {
        for (const item of window.dataLayer) {
          if (Array.isArray(item) && item[0] === 'config' && typeof item[1] === 'string' && item[1].startsWith('G-')) {
            id = item[1]; break;
          }
        }
      }
      add('Google Analytics 4', 'Analytics', id);
    }

    // ── Google Analytics Universal ───────────────────────────────
    if (typeof window.ga === 'function' || typeof window.GoogleAnalyticsObject !== 'undefined') {
      let id = '';
      try {
        const obj = window.GoogleAnalyticsObject ? window[window.GoogleAnalyticsObject] : window.ga;
        if (obj && obj.getAll) id = (obj.getAll()[0] || {get: () => ''}).get('trackingId') || '';
      } catch (e) {}
      add('Google Analytics Universal', 'Analytics', id);
    }

    // ── Google Ads ───────────────────────────────────────────────
    if (typeof window.gtag === 'function' && Array.isArray(window.dataLayer)) {
      for (const item of window.dataLayer) {
        if (Array.isArray(item) && item[0] === 'config' && typeof item[1] === 'string' && item[1].startsWith('AW-')) {
          add('Google Ads', 'Ads', item[1]); break;
        }
      }
    }

    // ── Facebook Pixel ───────────────────────────────────────────
    if (typeof window.fbq === 'function') {
      let id = '';
      try {
        if (window.fbq.getState) {
          const pixels = window.fbq.getState().pixels;
          if (pixels && pixels.length) id = String(pixels[0].id || '');
        }
      } catch (e) {}
      add('Facebook Pixel', 'Ads', id);
    }

    // ── HotJar ───────────────────────────────────────────────────
    if (typeof window.hj === 'function' || window.hjSiteSettings) {
      const id = window.hjSiteSettings && window.hjSiteSettings.site_id
        ? String(window.hjSiteSettings.site_id) : '';
      add('HotJar', 'Heatmap', id);
    }

    // ── Microsoft Clarity ────────────────────────────────────────
    if (typeof window.clarity === 'function') add('Microsoft Clarity', 'Heatmap', '');

    // ── LinkedIn Insight ─────────────────────────────────────────
    if (Array.isArray(window._linkedin_data_partner_ids) && window._linkedin_data_partner_ids.length) {
      add('LinkedIn Insight', 'Ads', String(window._linkedin_data_partner_ids[0]));
    } else if (typeof window._linkedin_partner_id !== 'undefined') {
      add('LinkedIn Insight', 'Ads', String(window._linkedin_partner_id));
    }

    // ── TikTok Pixel ─────────────────────────────────────────────
    if (typeof window.ttq !== 'undefined') add('TikTok Pixel', 'Ads', '');

    // ── Twitter / X Pixel ────────────────────────────────────────
    if (typeof window.twq === 'function') add('Twitter / X Pixel', 'Ads', '');

    // ── Pinterest ────────────────────────────────────────────────
    if (typeof window.pintrk === 'function') add('Pinterest Tag', 'Ads', '');

    // ── Snapchat ─────────────────────────────────────────────────
    if (typeof window.snaptr === 'function') add('Snapchat Pixel', 'Ads', '');

    // ── HubSpot ──────────────────────────────────────────────────
    if (window._hsq || window.HubSpotConversations || window.hsConversationsSettings)
      add('HubSpot', 'CRM', '');

    // ── Intercom ─────────────────────────────────────────────────
    if (typeof window.Intercom === 'function') {
      const id = window.intercomSettings && window.intercomSettings.app_id
        ? window.intercomSettings.app_id : '';
      add('Intercom', 'Chat', id);
    }

    // ── Crisp ────────────────────────────────────────────────────
    if (window.$crisp)
      add('Crisp Chat', 'Chat', window.CRISP_WEBSITE_ID || '');

    // ── Drift ────────────────────────────────────────────────────
    if (window.drift || window.driftt) add('Drift', 'Chat', '');

    // ── Zendesk ──────────────────────────────────────────────────
    if (window.zE || window.zEmbed) add('Zendesk', 'Chat', '');

    // ── Segment ──────────────────────────────────────────────────
    if (window.analytics && typeof window.analytics.track === 'function')
      add('Segment', 'Analytics', '');

    // ── Mixpanel ─────────────────────────────────────────────────
    if (window.mixpanel && typeof window.mixpanel.track === 'function')
      add('Mixpanel', 'Analytics', '');

    // ── Amplitude ────────────────────────────────────────────────
    if (window.amplitude && window.amplitude.getInstance)
      add('Amplitude', 'Analytics', '');

    // ── Klaviyo ──────────────────────────────────────────────────
    if (window._learnq) add('Klaviyo', 'Email', '');

    // ── ActiveCampaign ───────────────────────────────────────────
    if (window.vgo || window.ac_cvs) add('ActiveCampaign', 'Email', '');

    // ── RD Station ───────────────────────────────────────────────
    if (window.RdIntegration || window.RD || window.rdstation)
      add('RD Station', 'CRM', '');

  } catch (e) {}

  return tags;
}
