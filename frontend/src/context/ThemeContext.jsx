import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();
const defaultSettings = {
  theme: 'dark',
  accent: '#58a6ff',
  aiModel: 'ollama',
  autoSave: true,
  secureMode: true,
  automation: true,
  notifications: true,
  debugMode: false,
  verboseLogs: false,
  apiKeysEnabled: true,
};

const readStoredSettings = () => {
  if (typeof window === 'undefined') {
    return defaultSettings;
  }

  const saved = window.localStorage.getItem('unifix_settings');
  if (!saved) {
    return defaultSettings;
  }

  try {
    return { ...defaultSettings, ...JSON.parse(saved) };
  } catch (error) {
    console.warn('Failed to parse saved settings', error);
    return defaultSettings;
  }
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [settings, setSettings] = useState(readStoredSettings);
  const [theme, setTheme] = useState(() => readStoredSettings().theme);
  const [accent, setAccent] = useState(() => readStoredSettings().accent);

  // Apply theme to DOM when theme or accent changes
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.dataset.theme = theme;
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--primary', accent);
  }, [theme, accent]);

  const updateTheme = (newTheme) => {
    setTheme(newTheme);
    setSettings(prev => ({ ...prev, theme: newTheme }));
  };

  const updateAccent = (newAccent) => {
    setAccent(newAccent);
    setSettings(prev => ({ ...prev, accent: newAccent }));
  };

  const saveSettings = (newSettings) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    window.localStorage.setItem('unifix_settings', JSON.stringify(updatedSettings));

    // Update theme and accent if they changed
    if (newSettings.theme) setTheme(newSettings.theme);
    if (newSettings.accent) setAccent(newSettings.accent);
  };

  const value = {
    theme,
    accent,
    settings,
    updateTheme,
    updateAccent,
    saveSettings,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
