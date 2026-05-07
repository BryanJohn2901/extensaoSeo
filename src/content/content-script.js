const SEOAnalyzer = {

  analyzeMeta() {
    const meta = {};
    meta.title = document.title || '';
    meta.titleLength = meta.title.length;
    meta.titleOptimal = meta.titleLength >= 30 && meta.titleLength <= 60;

    const descEl = document.querySelector('meta[name="description"]');
    meta.description = descEl ? (descEl.getAttribute('content') || '') : '';
    meta.descriptionLength = meta.description.length;
    meta.descriptionOptimal = meta.descriptionLength >= 120 && meta.descriptionLength <= 160;

    const canon = document.querySelector('link[rel="canonical"]');
    meta.canonical = canon ? (canon.getAttribute('href') || '') : '';
    meta.hasCanonical = !!canon;

    const robots = document.querySelector('meta[name="robots"]');
    meta.robots = robots ? (robots.getAttribute('content') || '') : '';

    const ogTitle = document.querySelector('meta[property="og:title"]');
    meta.ogTitle = ogTitle ? (ogTitle.getAttribute('content') || '') : '';

    const ogDesc = document.querySelector('meta[property="og:description"]');
    meta.ogDescription = ogDesc ? (ogDesc.getAttribute('content') || '') : '';

    return meta;
  },

  analyzeHeadings() {
    const headings = { h1: [], h2: [], h3: [], distribution: {} };
    for (let i = 1; i <= 3; i++) {
      const tags = document.querySelectorAll('h' + i);
      headings['h' + i] = Array.from(tags).map(h => ({
        text: h.innerText.trim().substring(0, 80),
        length: h.innerText.trim().length
      }));
      headings.distribution['h' + i] = tags.length;
    }
    headings.h1Optimal = headings.distribution.h1 === 1;
    return headings;
  },

  analyzeImages() {
    const images = { total: 0, withAlt: 0, missingAlt: 0 };
    document.querySelectorAll('img').forEach(img => {
      images.total++;
      (img.getAttribute('alt') || '').trim() ? images.withAlt++ : images.missingAlt++;
    });
    return images;
  },

  analyzeContent() {
    const stopWords = new Set([
      'de','a','o','que','e','do','da','em','um','para','com','uma','os','no',
      'se','na','por','mais','as','dos','como','mas','ao','ele','das','seu',
      'sua','ou','ser','quando','muito','nos','já','também','pelo','pela','até',
      'isso','ela','entre','era','depois','sem','mesmo','aos','seus','nas','me',
      'esse','eles','você','essa','nem','suas','meu','minha','pelos','elas',
      'seja','qual','será','nós','lhe','essas','esses','pelas','este','dele',
      'tu','te','vocês','foi','são','está','tem','não','num','nessa','neste',
      'nesta','nesse','ter','sobre','aqui','ali','tudo','cada','onde','este',
      'the','and','or','but','in','on','at','to','for','of','with','by','from',
      'is','are','was','were','be','been','have','has','had','do','does','did',
      'will','would','could','should','may','might','this','that','these','those',
      'it','its','not','no','so','if','as','up','out','about','into','than',
      'then','there','when','where','who','which','what','how','all','each',
      'they','them','their','we','our','you','your','he','she','his','her',
      'can','just','an','also','been','being'
    ]);

    const elements = document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,td,th');
    let contentText = '';
    elements.forEach(el => { contentText += ' ' + el.innerText; });
    if (!contentText.trim()) contentText = document.body.innerText;

    const allWords = document.body.innerText.trim().split(/\s+/);

    const cleaned = contentText.toLowerCase()
      .replace(/[^a-záàâãéèêíïóôõöúüçñ\s]/gi, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w) && !/^\d+$/.test(w));

    const freq = {};
    cleaned.forEach(w => { freq[w] = (freq[w] || 0) + 1; });

    const topKeywords = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([word, count]) => ({ word, count }));

    return {
      wordCount: allWords.length,
      topKeywords,
      paragraphs: document.querySelectorAll('p').length,
      readingTime: Math.ceil(allWords.length / 200)
    };
  },

  analyzeTechnical() {
    return {
      isHTTPS: window.location.protocol === 'https:',
      hasCanonical: !!document.querySelector('link[rel="canonical"]'),
      lang: document.documentElement.getAttribute('lang') || '',
      mobile: !!(document.querySelector('meta[name="viewport"]') &&
        (document.querySelector('meta[name="viewport"]').getAttribute('content') || '').includes('width=device-width')),
      hasStructuredData: !!document.querySelector('script[type="application/ld+json"]')
    };
  },

  analyzeLinks() {
    const result = {
      internal: 0, external: 0, total: 0, nofollow: 0,
      redirects: [], topExternalDomains: [], forms: []
    };

    const currentDomain = new URL(window.location.href).hostname;
    const REDIRECT_SERVICES = new Set([
      'bit.ly','goo.gl','t.co','ow.ly','tinyurl.com','short.io','rebrand.ly',
      'cutt.ly','buff.ly','dlvr.it','ift.tt','tiny.cc','is.gd','lnkd.in','fb.me',
      'tr.im','snip.ly','shorturl.at','clck.ru','v.gd'
    ]);

    const externalDomains = {};

    document.querySelectorAll('a[href]').forEach(link => {
      const href = link.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;

      if (href.startsWith('http') || href.startsWith('//')) {
        try {
          const url = new URL(href.startsWith('//') ? 'https:' + href : href);
          result.total++;

          if ((link.getAttribute('rel') || '').includes('nofollow')) result.nofollow++;

          const isOwn = url.hostname === currentDomain || url.hostname === 'www.' + currentDomain;

          if (isOwn) {
            result.internal++;
          } else {
            result.external++;
            if (REDIRECT_SERVICES.has(url.hostname)) {
              result.redirects.push({
                href: href.substring(0, 120),
                text: link.textContent.trim().substring(0, 50) || '(sem texto)',
                service: url.hostname
              });
            } else {
              externalDomains[url.hostname] = (externalDomains[url.hostname] || 0) + 1;
            }
          }
        } catch (e) {}
      }
    });

    result.topExternalDomains = Object.entries(externalDomains)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count }));

    document.querySelectorAll('form').forEach(form => {
      result.forms.push({
        action: form.getAttribute('action') || '(sem action)',
        method: (form.getAttribute('method') || 'GET').toUpperCase(),
        inputs: form.querySelectorAll('input:not([type="hidden"]), select, textarea').length
      });
    });

    return result;
  },

  analyzeTags() {
    const scriptSrcs = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
    const inlineContent = Array.from(document.querySelectorAll('script:not([src])')).map(s => s.textContent).join('\n');
    const noscriptContent = Array.from(document.querySelectorAll('noscript')).map(n => n.innerHTML).join('\n');
    const allContent = scriptSrcs.join('\n') + '\n' + inlineContent + '\n' + noscriptContent;

    const TAGS = [
      {
        name: 'Google Tag Manager', category: 'Tag Manager',
        check: () => scriptSrcs.some(s => s.includes('googletagmanager.com/gtm.js')) || noscriptContent.includes('googletagmanager.com/ns.html'),
        getId: () => (allContent.match(/GTM-[A-Z0-9]+/) || [])[0] || ''
      },
      {
        name: 'Google Analytics 4', category: 'Analytics',
        check: () => scriptSrcs.some(s => s.includes('gtag/js')),
        getId: () => (allContent.match(/G-[A-Z0-9]{6,}/) || [])[0] || ''
      },
      {
        name: 'Google Analytics Universal', category: 'Analytics',
        check: () => scriptSrcs.some(s => s.includes('google-analytics.com/analytics.js')) || inlineContent.includes("ga('create'"),
        getId: () => (allContent.match(/UA-\d{4,}-\d+/) || [])[0] || ''
      },
      {
        name: 'Google Ads', category: 'Ads',
        check: () => scriptSrcs.some(s => s.includes('googleadservices.com') || s.includes('googlesyndication.com')),
        getId: () => (allContent.match(/AW-\d+/) || [])[0] || ''
      },
      {
        name: 'Facebook Pixel', category: 'Ads',
        check: () => scriptSrcs.some(s => s.includes('connect.facebook.net')) || inlineContent.includes("fbq('init'"),
        getId: () => { const m = inlineContent.match(/fbq\(['"]init['"],\s*['"](\d+)['"]/); return m ? m[1] : ''; }
      },
      {
        name: 'HotJar', category: 'Heatmap',
        check: () => scriptSrcs.some(s => s.includes('static.hotjar.com') || s.includes('hotjar.com')),
        getId: () => { const m = inlineContent.match(/hjid[:\s]+(\d+)/); return m ? m[1] : ''; }
      },
      {
        name: 'Microsoft Clarity', category: 'Heatmap',
        check: () => scriptSrcs.some(s => s.includes('clarity.ms')),
        getId: () => { const m = scriptSrcs.find(s => s.includes('clarity.ms')); return m ? (m.match(/\/([a-z0-9]{10,})/) || [])[1] || '' : ''; }
      },
      {
        name: 'LinkedIn Insight', category: 'Ads',
        check: () => scriptSrcs.some(s => s.includes('snap.licdn.com')),
        getId: () => { const m = inlineContent.match(/_linkedin_partner_id\s*=\s*['"]?(\d+)/); return m ? m[1] : ''; }
      },
      {
        name: 'TikTok Pixel', category: 'Ads',
        check: () => scriptSrcs.some(s => s.includes('analytics.tiktok.com')),
        getId: () => { const m = inlineContent.match(/ttq\.load\(['"]([A-Z0-9]+)['"]/); return m ? m[1] : ''; }
      },
      {
        name: 'Twitter / X Pixel', category: 'Ads',
        check: () => scriptSrcs.some(s => s.includes('ads-twitter.com') || s.includes('t.co/i/adsct')),
        getId: () => { const m = inlineContent.match(/twq\('init',\s*['"]([^'"]+)['"]/); return m ? m[1] : ''; }
      },
      {
        name: 'Pinterest Tag', category: 'Ads',
        check: () => inlineContent.includes('pintrk') || scriptSrcs.some(s => s.includes('pinimg.com')),
        getId: () => { const m = inlineContent.match(/pintrk\('load',\s*'(\d+)'/); return m ? m[1] : ''; }
      },
      {
        name: 'Snapchat Pixel', category: 'Ads',
        check: () => scriptSrcs.some(s => s.includes('sc-static.net')),
        getId: () => { const m = inlineContent.match(/snaptr\('init',\s*'([^']+)'/); return m ? m[1] : ''; }
      },
      {
        name: 'HubSpot', category: 'CRM',
        check: () => scriptSrcs.some(s => s.includes('hs-scripts.com') || s.includes('hubspot.com')),
        getId: () => { const m = scriptSrcs.find(s => s.includes('hs-scripts.com')); return m ? (m.match(/\/(\d+)\.js/) || [])[1] || '' : ''; }
      },
      {
        name: 'Intercom', category: 'Chat',
        check: () => scriptSrcs.some(s => s.includes('widget.intercom.io') || s.includes('intercomcdn.com')) || inlineContent.includes('window.Intercom'),
        getId: () => { const m = inlineContent.match(/app_id:\s*['"]([^'"]+)['"]/); return m ? m[1] : ''; }
      },
      {
        name: 'Crisp Chat', category: 'Chat',
        check: () => scriptSrcs.some(s => s.includes('client.crisp.chat')) || inlineContent.includes('CRISP_WEBSITE_ID'),
        getId: () => { const m = inlineContent.match(/CRISP_WEBSITE_ID\s*=\s*['"]([^'"]+)['"]/); return m ? m[1] : ''; }
      },
      {
        name: 'Zendesk', category: 'Chat',
        check: () => scriptSrcs.some(s => s.includes('zendesk.com')),
        getId: () => ''
      },
      {
        name: 'Drift', category: 'Chat',
        check: () => scriptSrcs.some(s => s.includes('js.driftt.com') || s.includes('drift.com')),
        getId: () => ''
      },
      {
        name: 'Segment', category: 'Analytics',
        check: () => scriptSrcs.some(s => s.includes('cdn.segment.com') || s.includes('cdn.segment.io')),
        getId: () => ''
      },
      {
        name: 'Mixpanel', category: 'Analytics',
        check: () => scriptSrcs.some(s => s.includes('cdn.mxpnl.com') || s.includes('mixpanel.com')),
        getId: () => ''
      },
      {
        name: 'Amplitude', category: 'Analytics',
        check: () => scriptSrcs.some(s => s.includes('cdn.amplitude.com')),
        getId: () => ''
      },
      {
        name: 'Klaviyo', category: 'Email',
        check: () => scriptSrcs.some(s => s.includes('klaviyo.com') || s.includes('static.klaviyo.com')),
        getId: () => { const m = scriptSrcs.find(s => s.includes('klaviyo.com')); return m ? (m.match(/company_id=([^&]+)/) || [])[1] || '' : ''; }
      },
      {
        name: 'ActiveCampaign', category: 'Email',
        check: () => scriptSrcs.some(s => s.includes('trackcmp.net')),
        getId: () => ''
      },
      {
        name: 'RD Station', category: 'CRM',
        check: () => scriptSrcs.some(s => s.includes('rdstation.com.br') || s.includes('d335luupugsy2.cloudfront.net')),
        getId: () => ''
      }
    ];

    return TAGS
      .filter(t => { try { return t.check(); } catch (e) { return false; } })
      .map(t => ({ name: t.name, category: t.category, id: (() => { try { return t.getId(); } catch (e) { return ''; } })() }));
  },

  detectWebhooks() {
    const formActions = Array.from(document.querySelectorAll('form[action]'))
      .map(f => f.getAttribute('action') || '');
    const inlineContent = Array.from(document.querySelectorAll('script:not([src])'))
      .map(s => s.textContent).join('\n');
    const allContent = formActions.join('\n') + '\n' + inlineContent;

    const PATTERNS = [
      { name: 'Zapier',           re: /https?:\/\/hooks\.zapier\.com\/hooks\/catch\/[^\s"'<>]+/ },
      { name: 'Make (Integromat)',re: /https?:\/\/hook\.(integromat|eu1\.make|us1\.make)\.com\/[^\s"'<>]+/ },
      { name: 'n8n',              re: /https?:\/\/[^\s"'<>]*\.n8n\.cloud\/webhook\/[^\s"'<>]+/ },
      { name: 'Pipedream',        re: /https?:\/\/[^\s"'<>]*pipedream\.net\/[^\s"'<>]+/ },
      { name: 'IFTTT',            re: /https?:\/\/maker\.ifttt\.com\/trigger\/[^\s"'<>]+/ },
      { name: 'Formspree',        re: /https?:\/\/formspree\.io\/f\/[^\s"'<>]+/ },
    ];

    const found = [];
    const seen = new Set();

    PATTERNS.forEach(({ name, re }) => {
      const match = allContent.match(re);
      if (match && !seen.has(name)) {
        seen.add(name);
        found.push({ name, url: match[0].substring(0, 80) });
      }
    });

    // detect services by form action domain
    const formServiceMap = [
      { domain: 'zapier.com',      name: 'Zapier (form)' },
      { domain: 'make.com',        name: 'Make (form)' },
      { domain: 'formspree.io',    name: 'Formspree' },
      { domain: 'netlify.com',     name: 'Netlify Forms' },
      { domain: 'getform.io',      name: 'Getform' },
      { domain: 'fabform.io',      name: 'Fabform' },
      { domain: 'pageclip.co',     name: 'Pageclip' },
      { domain: 'formspark.io',    name: 'Formspark' },
    ];

    formActions.forEach(action => {
      try {
        const u = new URL(action);
        formServiceMap.forEach(({ domain, name }) => {
          if (u.hostname.includes(domain) && !seen.has(name)) {
            seen.add(name);
            found.push({ name, url: action.substring(0, 80) });
          }
        });
      } catch (e) {}
    });

    return found;
  },

  runFullAnalysis() {
    try {
      return {
        url: window.location.href,
        timestamp: new Date().toISOString(),
        meta:      this.analyzeMeta(),
        headings:  this.analyzeHeadings(),
        links:     this.analyzeLinks(),
        images:    this.analyzeImages(),
        keywords:  this.analyzeContent(),
        technical: this.analyzeTechnical(),
        tags:      this.analyzeTags(),
        webhooks:  this.detectWebhooks()
      };
    } catch (error) {
      console.error('Erro na analise:', error);
      return null;
    }
  },

  sendToBackground() {
    const analysis = this.runFullAnalysis();
    if (analysis) {
      chrome.runtime.sendMessage(
        { type: 'SEO_ANALYSIS_COMPLETE', data: analysis },
        () => { if (chrome.runtime.lastError) {} }
      );
    }
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => SEOAnalyzer.sendToBackground());
} else {
  SEOAnalyzer.sendToBackground();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'REQUEST_ANALYSIS') {
    sendResponse({ success: true, data: SEOAnalyzer.runFullAnalysis() });
  }
});
