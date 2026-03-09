// ─── Internationalization ─────────────────────────────────────────
(function () {
    function initI18n() {
        const langSelect = document.getElementById('langSelect');
        const translations = window.TRANSLATIONS || {};
        const languages = Object.keys(translations);

        function populateLangs() {
            languages.forEach(code => {
                const opt = document.createElement('option');
                opt.value = code;
                opt.text = translations[code].nativeName || code;
                langSelect.appendChild(opt);
            });
        }

        function applyTranslations(lang) {
            const dict = translations[lang] || translations['en'] || {};
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n'); if (!key) return;
                const text = dict[key];
                if (text !== undefined) {
                    if (el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea')
                        el.placeholder = text;
                    else
                        el.innerHTML = text;
                }
            });
            document.documentElement.lang = lang;
            if (lang === 'he' || lang === 'ar') {
                document.documentElement.dir = 'rtl';
                document.body.style.textAlign = 'right';
                document.body.classList.add('rtl');
            } else {
                document.documentElement.dir = 'ltr';
                document.body.style.textAlign = 'left';
                document.body.classList.remove('rtl');
            }
        }

        langSelect.addEventListener('change', e => {
            const v = e.target.value;
            localStorage.setItem('siteLang', v);
            applyTranslations(v);
        });

        populateLangs();
        const browserLang = (navigator.language || 'he').split('-')[0];
        const saved = localStorage.getItem('siteLang') || browserLang;
        langSelect.value = languages.includes(saved) ? saved
            : (languages.includes(browserLang) ? browserLang
            : (languages.includes('he') ? 'he'
            : (languages.includes('en') ? 'en' : languages[0])));
        applyTranslations(langSelect.value);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initI18n);
    } else {
        initI18n();
    }
})();
