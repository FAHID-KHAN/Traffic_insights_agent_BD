import { useTranslation } from 'react-i18next';

export default function LangSwitch() {
  const { i18n } = useTranslation();
  const current = i18n.language;

  const switchTo = (lang) => {
    if (lang === current) return;
    i18n.changeLanguage(lang);
    localStorage.setItem('tibd-lang', lang);
    document.documentElement.lang = lang;
  };

  return (
    <div className="lang-switch">
      <button
        className={`lang-opt${current === 'en' ? ' lang-active' : ''}`}
        onClick={() => switchTo('en')}
      >
        EN
      </button>
      <button
        className={`lang-opt${current === 'bn' ? ' lang-active' : ''}`}
        onClick={() => switchTo('bn')}
      >
        বাং
      </button>
    </div>
  );
}
