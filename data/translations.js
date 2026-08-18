// data/translations.js
const LanguageContext = React.createContext({
  lang: 'fr',
  setLang: () => {},
  t: (key) => key,
  dir: 'ltr'
});

// ==========================================
// UTILITAIRE : Détection automatique LTR / RTL
// ==========================================
window.getTextDirection = (text) => {
  if (!text) return 'ltr';
  const trimmed = String(text).trim();
  if (!trimmed) return 'ltr';
  
  // Regex pour détecter les caractères arabes (inclut arabe de base et étendu)
  const arabicRegex = /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  
  return arabicRegex.test(trimmed) ? 'rtl' : 'ltr';
};

// Composant React wrapper pour appliquer la direction automatiquement
window.AutoDir = ({ children, text, className = '', as: Component = 'span', ...props }) => {
  // Priorité : prop 'text', sinon le contenu 'children' s'il s'agit d'une chaîne
  const contentToCheck = text !== undefined ? text : (typeof children === 'string' ? children : '');
  const direction = window.getTextDirection(contentToCheck);
  
  // Ajoute automatiquement text-right pour RTL et text-left pour LTR si aucune classe de texte n'est fournie
  const alignmentClass = className.includes('text-') ? '' : (direction === 'rtl' ? 'text-right' : 'text-left');
  
  return (
    <Component 
      dir={direction} 
      className={`${className} ${alignmentClass}`.trim()} 
      {...props}
    >
      {children}
    </Component>
  );
};

window.LanguageProvider = ({ children }) => {
  const [lang, setLangState] = React.useState(() => {
    return localStorage.getItem('sari_lang') || 'fr';
  });
  const [translations, setTranslations] = React.useState({});

  // Charger le fichier JSON de la langue pour l'UI
  React.useEffect(() => {
    fetch(`data/${lang}.json`)
      .then(res => {
        if (!res.ok) throw new Error('Fichier non trouvé');
        return res.json();
      })
      .then(data => setTranslations(data))
      .catch(err => {
        console.error(`Erreur chargement ${lang}.json:`, err);
        // Fallback sur français
        if (lang !== 'fr') {
          fetch('data/fr.json')
            .then(res => res.json())
            .then(data => setTranslations(data));
        }
      });
  }, [lang]);

  const setLang = (newLang) => {
    setLangState(newLang);
    localStorage.setItem('sari_lang', newLang);
    
    if (newLang === 'ar') {
      document.documentElement.setAttribute('dir', 'rtl');
      document.documentElement.setAttribute('lang', 'ar');
    } else {
      document.documentElement.setAttribute('dir', 'ltr');
      document.documentElement.setAttribute('lang', newLang);
    }
  };

  // Fonction de traduction avec support des clés imbriquées
  const t = (key, params = {}) => {
    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        console.warn(`⚠️ Traduction manquante: ${key}`);
        return key;
      }
    }
    
    // Support des paramètres : t('greeting', {name: 'Ahmed'})
    if (typeof value === 'string') {
      return value.replace(/\{\{(\w+)\}\}/g, (match, param) => params[param] || match);
    }
    
    return value;
  };

  React.useEffect(() => {
    setLang(lang);
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dir: lang === 'ar' ? 'rtl' : 'ltr' }}>
      {children}
    </LanguageContext.Provider>
  );
};

window.useTranslation = () => React.useContext(LanguageContext);