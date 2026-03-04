// ==UserScript==
// @name         Popup Blocker (Safari iOS simple)
// @namespace    https://github.com/schomery/popup-blocker
// @version      0.1.0
// @description  Bloque les popups avec confirmation, autorise automatiquement le même origin, mémorise les refus par site, et ferme immédiatement les popups refusées.
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const STORE_KEY = '__pb_ios_rules_v1__';
  const sourceOrigin = location.origin;

  const readRules = () => {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    }
    catch {
      return {};
    }
  };

  const writeRules = rules => {
    localStorage.setItem(STORE_KEY, JSON.stringify(rules));
  };

  const hasSiteRefusal = () => {
    const rules = readRules();
    return rules[sourceOrigin]?.denyAll === true;
  };

  const denySiteForever = () => {
    const rules = readRules();
    rules[sourceOrigin] = {
      ...(rules[sourceOrigin] || {}),
      denyAll: true
    };
    writeRules(rules);
  };

  const resolveURL = raw => {
    if (!raw) {
      return 'about:blank';
    }
    try {
      return new URL(raw, location.href).href;
    }
    catch {
      return String(raw);
    }
  };

  const isSameOriginTarget = raw => {
    if (!raw || raw === 'about:blank') {
      return true;
    }
    try {
      return new URL(raw, location.href).origin === sourceOrigin;
    }
    catch {
      return false;
    }
  };

  const askPolicy = rawUrl => {
    if (hasSiteRefusal()) {
      return false;
    }

    const target = resolveURL(rawUrl);
    if (isSameOriginTarget(target)) {
      return true;
    }

    const ok = confirm(
      `Popup demandée:\n${target}\n\nOK = Autoriser\nAnnuler = Refuser (et ne plus redemander pour ce site)`
    );
    if (!ok) {
      denySiteForever();
    }
    return ok;
  };

  const openThenClose = (originalOpen, self, args) => {
    const popup = Reflect.apply(originalOpen, self, args);
    if (popup && typeof popup.close === 'function') {
      setTimeout(() => popup.close(), 0);
    }
    return null;
  };

  const originalOpen = window.open;
  window.open = new Proxy(originalOpen, {
    apply(target, self, args) {
      const rawUrl = args?.[0] || '';
      if (askPolicy(rawUrl)) {
        return Reflect.apply(target, self, args);
      }
      return openThenClose(target, self, args);
    }
  });

  const targetNeedsPopup = target => target === '_blank' || (target && !['_self', '_top', '_parent'].includes(target));

  const maybeBlockElementNavigation = (url, target, openAction) => {
    if (!targetNeedsPopup(target)) {
      return false;
    }
    if (askPolicy(url)) {
      return false;
    }
    openAction();
    return true;
  };

  document.addEventListener('click', event => {
    const a = event.target.closest('a[href]');
    if (!a) {
      return;
    }
    const blocked = maybeBlockElementNavigation(a.href, a.target, () => {
      const w = originalOpen.call(window, a.href, a.target || '_blank');
      if (w && typeof w.close === 'function') {
        setTimeout(() => w.close(), 0);
      }
    });

    if (blocked) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    const action = form.action || location.href;
    const blocked = maybeBlockElementNavigation(action, form.target, () => {
      const w = originalOpen.call(window, 'about:blank', form.target || '_blank');
      if (w && typeof w.close === 'function') {
        setTimeout(() => w.close(), 0);
      }
    });

    if (blocked) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
})();
