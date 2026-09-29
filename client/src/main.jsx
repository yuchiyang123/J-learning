import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { LocaleProvider } from './i18n/LocaleContext.jsx';
import { AuthProvider } from './auth/AuthContext.jsx';
import { SkinProvider } from './skins/SkinContext.jsx';
import { applySkin, getStoredSkin, loadSkin, DEFAULT_SKIN } from './skins/registry.js';
import './skins/shared.css';

// The skin's stylesheet is the whole look of the site, so load and apply it
// before the first render instead of flashing unstyled markup. If the chosen
// skin's chunk fails to load (stale deploy etc.), fall back to the default.
async function boot() {
  let initial;
  try {
    initial = await loadSkin(getStoredSkin());
  } catch {
    initial = await loadSkin(DEFAULT_SKIN);
  }
  applySkin(initial.meta, initial.mod);

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <LocaleProvider>
        <AuthProvider>
          <SkinProvider initial={initial}>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </SkinProvider>
        </AuthProvider>
      </LocaleProvider>
    </React.StrictMode>
  );
}

boot();
