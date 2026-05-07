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
          // URL invalida, ignorar
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
      console.error('Erro na analise:', error);
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
            // Background nao respondeu (normal na primeira vez)
          }
        }
      );
    }
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    SEOAnalyzer.sendToBackground();
  });
} else {
  SEOAnalyzer.sendToBackground();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'REQUEST_ANALYSIS') {
    const analysis = SEOAnalyzer.runFullAnalysis();
    sendResponse({ success: true, data: analysis });
  }
});
