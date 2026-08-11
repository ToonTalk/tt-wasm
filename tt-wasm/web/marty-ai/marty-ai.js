// Marty AI — give Marty the Martian a large language model.
// Loaded ONLY by the generated tt-ai.html (link.sh injects the tag); the faithful
// tt.html never references this file. No servers involved: the browser talks to
// the provider's API directly with the player's own key.
//
// Providers: Claude (Anthropic), OpenAI, Gemini (Google), and Chrome's built-in
// Gemini Nano (the Prompt API) when the browser has it. Cloud providers get the
// full knowledge corpus (prompt-cached server-side); Nano gets the small one.
(function () {
  'use strict';
  var LS_KEY = 'tt_marty_ai';

  var state = {
    provider: '', model: '', keys: {}, remember: false, speak: true,   // keys: per provider
    history: [],            // [{role:'user'|'assistant', content}]
    corpus: { full: null, nano: null },
    nano: { session: null, api: null },   // api: 'new' | 'legacy'
    busy: false,
    resumeChooser: null     // pause-chooser kind to re-show when the chat closes
  };

  // ------------------------------------------------------------ persona
  var PERSONA =
    'You are Marty the Martian, the friendly helper who floats beside the player ' +
    'in ToonTalk. Answer questions about ToonTalk: what things are, how to do ' +
    'things, why something happened, and ideas for what to build next.\n' +
    'Rules:\n' +
    '- Two or three short sentences unless the player asks for more detail.\n' +
    '- Be concrete: name the exact key, tool, or character (F2 calls Dusty...).\n' +
    '- Plain spoken sentences only: no markdown, no lists, no code blocks.\n' +
    '- If asked something unrelated to ToonTalk, answer kindly in one sentence ' +
    'and steer back to ToonTalk.\n' +
    '- Some questions end with a bracketed "[Game engine report: ...]" describing ' +
    'where the player is and what is in their hand or pocket RIGHT NOW; trust it ' +
    'as ground truth and use it to answer questions like "what am I holding?".\n\n' +
    'REFERENCE MATERIAL ABOUT TOONTALK:\n';

  function systemPrompt(tier) {
    return PERSONA + (tier === 'nano' ? state.corpus.nano : state.corpus.full);
  }

  function loadCorpus(tier) {
    var file = tier === 'nano' ? 'knowledge-nano.txt' : 'knowledge-full.txt';
    var slot = tier === 'nano' ? 'nano' : 'full';
    if (state.corpus[slot]) return Promise.resolve(state.corpus[slot]);
    return fetch('marty-ai/' + file, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('could not load ' + file + ' (' + r.status + ')');
      return r.text();
    }).then(function (t) { state.corpus[slot] = t; return t; });
  }

  // ------------------------------------------------------------ providers
  function readErr(r) {                       // best-effort readable API error
    return r.text().then(function (t) {
      try { var j = JSON.parse(t);
            t = (j.error && (j.error.message || j.error.status)) || t; } catch (e) {}
      throw new Error('HTTP ' + r.status + ': ' + String(t).slice(0, 300));
    });
  }

  var PROVIDERS = {
    claude: {
      label: 'Claude (Anthropic)', needsKey: true, defModel: 'claude-sonnet-5',
      keyHint: 'console.anthropic.com → API keys',
      listModels: function (cfg) {
        return fetch('https://api.anthropic.com/v1/models?limit=100', {
          headers: { 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01',
                     'anthropic-dangerous-direct-browser-access': 'true' }
        }).then(function (r) { return r.ok ? r.json() : readErr(r); })
          .then(function (j) { return j.data.map(function (m) { return m.id; }); });
      },
      chat: function (cfg, sys, history) {
        return fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': cfg.key,
                     'anthropic-version': '2023-06-01',
                     'anthropic-dangerous-direct-browser-access': 'true' },
          body: JSON.stringify({
            model: cfg.model, max_tokens: 700,
            // cache_control: the big corpus is cached server-side after the
            // first message, so later questions are fast and much cheaper.
            system: [{ type: 'text', text: sys, cache_control: { type: 'ephemeral' } }],
            messages: history
          })
        }).then(function (r) { return r.ok ? r.json() : readErr(r); })
          .then(function (j) {
            return j.content.filter(function (b) { return b.type === 'text'; })
                            .map(function (b) { return b.text; }).join('');
          });
      }
    },
    openai: {
      label: 'OpenAI', needsKey: true, defModel: 'gpt-5-mini',
      keyHint: 'platform.openai.com → API keys',
      listModels: function (cfg) {
        return fetch('https://api.openai.com/v1/models', {
          headers: { authorization: 'Bearer ' + cfg.key }
        }).then(function (r) { return r.ok ? r.json() : readErr(r); })
          .then(function (j) {
            return j.data.map(function (m) { return m.id; })
                         .filter(function (id) { return /^(gpt|o[0-9])/.test(id); })
                         .sort();
          });
      },
      chat: function (cfg, sys, history) {
        return fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'content-type': 'application/json',
                     authorization: 'Bearer ' + cfg.key },
          body: JSON.stringify({
            model: cfg.model,
            messages: [{ role: 'system', content: sys }].concat(history)
          })
        }).then(function (r) { return r.ok ? r.json() : readErr(r); })
          .then(function (j) { return j.choices[0].message.content; });
      }
    },
    gemini: {
      label: 'Gemini (Google)', needsKey: true, defModel: 'gemini-2.5-flash',
      keyHint: 'aistudio.google.com → Get API key',
      listModels: function (cfg) {
        return fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100', {
          headers: { 'x-goog-api-key': cfg.key }
        }).then(function (r) { return r.ok ? r.json() : readErr(r); })
          .then(function (j) {
            return (j.models || []).filter(function (m) {
              return (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0;
            }).map(function (m) { return m.name.replace(/^models\//, ''); });
          });
      },
      chat: function (cfg, sys, history) {
        var contents = history.map(function (m) {
          return { role: m.role === 'assistant' ? 'model' : 'user',
                   parts: [{ text: m.content }] };
        });
        return fetch('https://generativelanguage.googleapis.com/v1beta/models/' +
                     encodeURIComponent(cfg.model) + ':generateContent', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': cfg.key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: sys }] },
            contents: contents
          })
        }).then(function (r) { return r.ok ? r.json() : readErr(r); })
          .then(function (j) {
            var c = j.candidates && j.candidates[0];
            if (!c || !c.content || !c.content.parts) throw new Error('empty reply');
            return c.content.parts.map(function (p) { return p.text || ''; }).join('');
          });
      }
    },
    nano: {
      label: 'Chrome built-in (Gemini Nano)', needsKey: false, defModel: '(on this computer)',
      keyHint: 'no key needed — runs on this computer',
      // Some machines give Nano a much smaller per-session input quota than others
      // (Ken's laptop rejected the ~4KB briefing as "input too large"). So the
      // briefings come in shrinking tiers and we walk down until one fits.
      microSystem:
        'You are Marty the Martian, the friendly helper in ToonTalk, the animated ' +
        'world where children build real programs: robots are programs you train by ' +
        'demonstration, boxes hold things, birds carry messages to their nests, ' +
        'scales compare, trucks build houses, bombs recycle them, notebooks store ' +
        'things, sensors connect to the real world. Dusty the vacuum (F2) erases and ' +
        'moves things; erasing in a robot\'s thought bubble makes him accept more ' +
        'boxes. Pumpy (F3) resizes, the magic wand (F5) copies, Tooly the toolbox ' +
        '(F6) has fresh parts, F4 calls your notebook, F1 calls me. The Pause key ' +
        'opens time travel. Fly the helicopter by pointing where to go; hold the ' +
        'left mouse button (or D) to fly lower and land, U to rise - no spacebar. ' +
        'Answer in one to three short friendly spoken sentences, ' +
        'concrete about what to do, about ToonTalk only.',
      // availability(cb): cb(status string or null when usable)
      availability: function () {
        if (typeof LanguageModel !== 'undefined' && LanguageModel.availability) {
          state.nano.api = 'new';
          return LanguageModel.availability().then(function (a) {
            state.nano.avail = a;               // available | downloadable | downloading | unavailable
            return a === 'unavailable' ? 'not available on this computer' : null;
          });
        }
        if (window.ai && window.ai.languageModel && window.ai.languageModel.capabilities) {
          state.nano.api = 'legacy';
          return window.ai.languageModel.capabilities().then(function (c) {
            state.nano.avail = c.available === 'readily' ? 'available' : 'downloadable';
            return c.available === 'no' ? 'not available on this computer' : null;
          });
        }
        return Promise.resolve('needs desktop Chrome with the built-in model');
      },
      chat: function (cfg, sys, history, onStatus) {
        var last = history[history.length - 1].content;
        var self = this;
        // tier 0: full nano briefing; tier 1: one-paragraph micro briefing.
        var tiers = [sys, self.microSystem];
        function quotaish(e) {
          return /too.large|quota|exceed/i.test(String(e && (e.message || e.name)));
        }
        function create(sysText) {
          if (state.nano.api === 'new') {
            return LanguageModel.create({
              initialPrompts: [{ role: 'system', content: sysText }],
              monitor: function (m) {           // first use may download the model
                m.addEventListener('downloadprogress', function (e) {
                  if (onStatus) onStatus('Marty is downloading his little brain… ' +
                                         Math.round((e.loaded || 0) * 100) + '%');
                });
              }
            }).then(function (s) {
              try {                              // console diagnostic for quota mysteries
                if (s.inputQuota) console.log('[marty-ai] nano inputQuota=' + s.inputQuota);
                if (s.measureInputUsage) s.measureInputUsage(sysText).then(function (n) {
                  console.log('[marty-ai] nano briefing tokens=' + n);
                });
              } catch (e) {}
              return s;
            });
          }
          return window.ai.languageModel.create({ systemPrompt: sysText });
        }
        function dropSession() {
          if (state.nano.session) { try { state.nano.session.destroy(); } catch (e) {} }
          state.nano.session = null;
        }
        // reuse the session when we can; on failure retry fresh at the same tier
        // (session context full / stale), and on "too large" walk down a tier.
        function attempt(i, forceFresh) {
          var reusing = !forceFresh && state.nano.session && state.nano.tier === i;
          var p;
          if (reusing) p = Promise.resolve(state.nano.session);
          else {
            dropSession();
            p = create(tiers[i]).then(function (s) {
              state.nano.session = s; state.nano.tier = i; return s;
            });
          }
          return p.then(function (s) { return s.prompt(last); })
                  .catch(function (e) {
                    if (reusing) return attempt(i, true);
                    if (quotaish(e) && i + 1 < tiers.length) {
                      console.log('[marty-ai] nano tier ' + i + ' too large, trying smaller briefing');
                      if (onStatus) onStatus('Trying a smaller briefing for the little brain…');
                      return attempt(i + 1, true);
                    }
                    dropSession();
                    throw e;
                  });
        }
        return attempt(state.nano.tier || 0, false);
      }
    }
  };

  // ------------------------------------------------------------ settings persistence
  function loadCfg() {
    try {
      var j = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      state.provider = j.provider || ''; state.model = j.model || '';
      state.remember = !!j.remember; state.speak = j.speak !== false;
      if (j.remember) {
        state.keys = j.keys || {};
        if (j.key && j.provider && !state.keys[j.provider]) state.keys[j.provider] = j.key;  // old single-key format
      }
    } catch (e) {}
  }
  function saveCfg() {
    var j = { provider: state.provider, model: state.model,
              remember: state.remember, speak: state.speak };
    if (state.remember) j.keys = state.keys;
    try { localStorage.setItem(LS_KEY, JSON.stringify(j)); } catch (e) {}
  }
  function currentKey() { return state.keys[state.provider] || ''; }

  // ------------------------------------------------------------ tiny DOM helper
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k in n && k !== 'type') { try { n[k] = attrs[k]; } catch (e) { n.setAttribute(k, attrs[k]); } }
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }

  // ------------------------------------------------------------ settings dialog
  var dlg, dlgStatus, modelInput, keyInput, modelList;
  function buildDialog() {
    var provBox = el('div', { className: 'mai-prov' });
    Object.keys(PROVIDERS).forEach(function (id) {
      var r = el('input', { type: 'radio', name: 'mai-prov', value: id });
      r.addEventListener('change', function () { onProviderPick(id); });
      var lab = el('label', null, [r, el('span', { text: PROVIDERS[id].label })]);
      lab.dataset.prov = id;
      provBox.appendChild(lab);
    });
    modelInput = el('input', { type: 'text', id: 'mai-model', autocomplete: 'off' });
    modelList = el('datalist', { id: 'mai-models' });
    modelInput.setAttribute('list', 'mai-models');
    // type=text, masked by CSS (-webkit-text-security): a real password field beside a
    // text field reads as a LOGIN FORM to Chrome, which offered to save the model name
    // as a username and the key as a password (Ken's screenshot).
    keyInput = el('input', { type: 'text', id: 'mai-key', autocomplete: 'off', spellcheck: false });
    var remember = el('input', { type: 'checkbox' });
    var speak = el('input', { type: 'checkbox' });
    dlgStatus = el('div', { className: 'mai-status' });

    var listBtn = el('button', { type: 'button', text: 'List models' });
    listBtn.addEventListener('click', function () {
      var id = pickedProvider(); if (!id || id === 'nano') return;
      dlgStatus.className = 'mai-status'; dlgStatus.textContent = 'asking ' + PROVIDERS[id].label + '…';
      PROVIDERS[id].listModels({ key: keyInput.value.trim() }).then(function (ids) {
        modelList.textContent = '';
        ids.forEach(function (m) { modelList.appendChild(el('option', { value: m })); });
        modelInput.value = '';              // empty box => the datalist drops the FULL list
        try { modelInput.focus(); } catch (e) {}
        dlgStatus.textContent = ids.length + ' models — key works. Click the model box to choose, or leave it empty for the default.';
      }).catch(function (e) {
        dlgStatus.className = 'mai-status err'; dlgStatus.textContent = e.message;
      });
    });

    var cancel = el('button', { type: 'button', text: 'Cancel' });
    cancel.addEventListener('click', function () { dlg.close(); });
    var save = el('button', { type: 'button', text: 'Save', className: 'mai-primary' });
    save.addEventListener('click', function () {
      var id = pickedProvider();
      if (!id) { dlgStatus.className = 'mai-status err'; dlgStatus.textContent = 'pick a provider'; return; }
      if (PROVIDERS[id].needsKey && !keyInput.value.trim()) {
        dlgStatus.className = 'mai-status err'; dlgStatus.textContent = 'this provider needs an API key'; return;
      }
      state.provider = id;
      state.model = modelInput.value.trim() || PROVIDERS[id].defModel;
      state.keys[id] = keyInput.value.trim();
      state.remember = remember.checked; state.speak = speak.checked;
      state.nano.session = null;          // provider change invalidates any Nano session
      saveCfg(); dlg.close(); openPanel();
      addMsg('marty', 'New brain installed! Ask me anything about ToonTalk. ' +
                      'Ctrl+M opens or closes this chat any time — even while playing.');
    });

    dlg = el('dialog', { id: 'mai-dlg' }, [
      el('form', { method: 'dialog' }, [
        el('h3', { text: 'Give Marty an AI' }),
        provBox,
        el('label', null, [el('span', { text: 'Model:' }), modelInput, listBtn]),
        modelList,
        el('div', { className: 'mai-note', id: 'mai-modelnote' }),
        el('label', { id: 'mai-keyrow' }, [el('span', { text: 'API key:' }), keyInput]),
        el('div', { className: 'mai-note', id: 'mai-keynote' }),
        el('label', null, [remember, el('span', { text: 'Remember the key in this browser (stored unencrypted on this computer)' })]),
        el('label', null, [speak, el('span', { text: 'Marty speaks his answers out loud' })]),
        dlgStatus,
        el('div', { id: 'mai-btns' }, [cancel, save])
      ])
    ]);
    document.body.appendChild(dlg);

    // hydrate current settings
    remember.checked = state.remember; speak.checked = state.speak;
    if (state.provider) {
      var r = dlg.querySelector('input[value="' + state.provider + '"]');
      if (r) { r.checked = true; onProviderPick(state.provider); }
      modelInput.value = state.model;   // key hydration happens in onProviderPick
    }
    // grey out Nano if this browser can't do it
    PROVIDERS.nano.availability().then(function (why) {
      if (!why) return;
      var lab = dlg.querySelector('label[data-prov="nano"]');
      lab.className += ' mai-off'; lab.title = why;
      lab.querySelector('input').disabled = true;
    });
  }
  function pickedProvider() {
    var r = dlg.querySelector('input[name="mai-prov"]:checked');
    return r ? r.value : '';
  }
  var lastPickedProv = '';
  function onProviderPick(id) {
    var p = PROVIDERS[id];
    // Each provider keeps its own key: stash whatever was typed for the previous
    // provider, show what we have for this one (Ken: "when I switch provider the
    // API key remains, which is confusing" -- and he compares providers a lot).
    if (lastPickedProv && lastPickedProv !== id && PROVIDERS[lastPickedProv].needsKey) {
      state.keys[lastPickedProv] = keyInput.value.trim();
    }
    keyInput.value = state.keys[id] || '';
    lastPickedProv = id;
    document.getElementById('mai-keyrow').style.display = p.needsKey ? '' : 'none';
    document.getElementById('mai-keynote').textContent = p.needsKey ? ('Get a key at ' + p.keyHint) : p.keyHint;
    document.getElementById('mai-modelnote').textContent =
      id === 'nano' ? (state.nano.avail === 'available'
                        ? 'The model is built into Chrome and ready; nothing to choose.'
                        : 'Built into Chrome — the first question downloads the model once (large, may take a while).')
                    : 'Free text — or press List models to fetch what your key can use.';
    modelInput.disabled = (id === 'nano');
    // EMPTY box + the default in the placeholder. Two reports fixed at once (Ken):
    // a model chosen for one provider no longer survives switching to another (only
    // the SAVED model of the SAVED provider is kept), and a filled box no longer
    // filters the datalist down to nothing ("the box doesn't show the options until
    // the name is erased" -- a datalist only drops entries matching the current
    // text). Save treats an empty box as the default.
    modelInput.value = (state.provider === id && state.model) ? state.model : '';
    modelInput.placeholder = p.defModel + (id === 'nano' ? '' : ' — the default');
    modelList.textContent = '';
  }

  // ------------------------------------------------------------ chat panel
  var panel, log, input, micBtn;
  function buildPanel() {
    log = el('div', { id: 'mai-log' });
    input = el('input', { id: 'mai-in', type: 'text', placeholder: 'Ask Marty about ToonTalk…', autocomplete: 'off' });
    // keyCode 13 too: synthetic/legacy events can carry key names other than 'Enter'
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.keyCode === 13) send();
    });
    var sendBtn = el('button', { type: 'button', text: 'Send', title: 'Send' });
    sendBtn.addEventListener('click', send);
    micBtn = el('button', { type: 'button', id: 'mai-mic', text: '🎤', title: 'Speak to Marty' });
    micBtn.addEventListener('click', toggleMic);
    if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) micBtn.hidden = true;

    var gear = el('button', { type: 'button', text: '⚙', title: 'AI settings' });
    gear.addEventListener('click', function () { dlg.showModal(); });
    var close = el('button', { type: 'button', text: '×', title: 'Close' });
    close.addEventListener('click', closePanel);

    panel = el('div', { id: 'mai-panel', hidden: true }, [
      el('div', { id: 'mai-head' }, [el('b', { text: '🛸 Marty' }), gear, close]),
      log,
      el('div', { id: 'mai-row' }, [input, micBtn, sendBtn])
    ]);
    // Inside #fsbox so the panel still renders when the game is fullscreen.
    var fsbox = document.getElementById('fsbox') || document.body;
    fsbox.appendChild(panel);

    // In fullscreen the control row (outside #fsbox) is not rendered, so hang a
    // small opener inside the fullscreen element (CSS shows it only there).
    var fab = el('button', { id: 'mai-fab', type: 'button', text: '🛸',
                             title: 'Talk to Marty (Ctrl+M)' });
    fab.addEventListener('click', toggleOpen);
    fsbox.appendChild(fab);

    // Ctrl+M works even while the game holds pointer lock (no cursor to click
    // with): release the lock and open the chat. Capture phase + stopPropagation
    // keeps the keystroke away from the game's own window-level key handlers.
    window.addEventListener('keydown', function (e) {
      if (!e.ctrlKey || e.altKey || e.metaKey) return;
      if ((e.key || '').toLowerCase() !== 'm') return;
      e.preventDefault(); e.stopPropagation();
      toggleOpen();
    }, true);

    // Clicking the game while the chat is open means "back to playing": close the chat.
    // If we got here from the pause chooser (engine paused, chooser hidden), this click
    // answers it directly -- and doubles as the user gesture the pointer-lock retake
    // inside the answer needs. Ken: "I tried to return to the main app and it seemed to
    // ignore all mouse movements and events."
    var canvas = document.getElementById('ttcanvas');
    if (canvas) canvas.addEventListener('mousedown', function (e) {
      if (panel.hidden) return;
      if (state.resumeChooser !== null && globalThis.TT_pauseAnswer) {
        state.resumeChooser = null;
        hidePanel();
        e.stopImmediatePropagation(); e.preventDefault();   // resume-click only, not a game click
        globalThis.TT_pauseAnswer(1);
      } else {
        hidePanel();              // plain Ctrl+M chat: game was live; the click acts in-game too
      }
    }, true);
  }
  function toggleOpen() {
    if (!state.provider) { dlg.showModal(); return; }
    if (panel.hidden) {
      // Opening from the pause chooser (its own Ask Marty button, or Ctrl+M while it is
      // up): hide the chooser but leave the engine paused; closing the chat re-shows it.
      if (globalThis.TT_pauseOverlay && globalThis.TT_pauseHide) {
        state.resumeChooser = (globalThis.TT_pauseKind === undefined) ? 0 : globalThis.TT_pauseKind;
        globalThis.TT_pauseHide();
      }
      if (document.pointerLockElement) {
        globalThis.TT_chatUnlock = true;   // deliberate: keep pre.js from forwarding a synthetic Esc
        try { document.exitPointerLock(); } catch (e) {}
      }
      openPanel();
    } else closePanel();
  }
  function hidePanel() {
    panel.hidden = true;
    globalThis.TT_chatFreeze = false;      // hand follows the cursor again
  }
  function closePanel() {
    hidePanel();
    if (state.resumeChooser !== null && globalThis.TT_demoPause) {
      var kind = state.resumeChooser; state.resumeChooser = null;
      globalThis.TT_demoPause(kind);
    }
  }
  function openPanel() {
    panel.hidden = false;
    // The cursor now belongs to the chat: freeze the game's position feed so the hand
    // doesn't chase the pointer to the wall beside the panel (pre.js honours the flag).
    globalThis.TT_chatFreeze = true;
    input.focus();
  }

  function addMsg(kind, text) {
    var cls = kind === 'user' ? 'mai-user' : kind === 'err' ? 'mai-err'
            : kind === 'think' ? 'mai-think' : 'mai-marty';
    var d = el('div', { className: 'mai-msg ' + cls, text: text });
    log.appendChild(d); log.scrollTop = log.scrollHeight;
    return d;
  }

  // What the engine says about the player right now (location, hand, pocket) — an
  // EMSCRIPTEN_KEEPALIVE export built on the game's own describe() machinery, so the
  // AI can answer "what's in my pocket?" without the player pressing F1.
  function situation() {
    try {
      if (globalThis.TT_martyContext) return globalThis.TT_martyContext();
    } catch (e) {}
    return '';
  }

  function send() {
    var text = input.value.trim();
    if (!text || state.busy) return;
    if (!state.provider) { dlg.showModal(); return; }
    // Key not remembered and page was reloaded: ask for it again instead of a 401.
    if (PROVIDERS[state.provider].needsKey && !currentKey()) {
      dlgStatus.className = 'mai-status err';
      dlgStatus.textContent = 'Please enter your API key again (it was not remembered).';
      dlg.showModal(); return;
    }
    input.value = '';
    addMsg('user', text);
    // The situation rides on the USER turn, not the system prompt: the big system
    // block is prompt-cached, and editing it would miss the cache on every message.
    var ctx = situation();
    state.history.push({ role: 'user',
                         content: ctx ? text + '\n\n[Game engine report: ' + ctx + ']' : text });
    while (state.history.length > 12) state.history.shift();
    if (state.history[0] && state.history[0].role !== 'user') state.history.shift();
    state.busy = true;
    var thinking = addMsg('think', 'Marty is thinking…');
    var tier = state.provider === 'nano' ? 'nano' : 'full';
    var onStatus = function (t) { thinking.textContent = t; };
    loadCorpus(tier).then(function () {
      return PROVIDERS[state.provider].chat(
        { key: currentKey(), model: state.model }, systemPrompt(tier), state.history, onStatus);
    }).then(function (reply) {
      reply = (reply || '').trim() || '(no answer)';
      thinking.remove();
      addMsg('marty', reply);
      state.history.push({ role: 'assistant', content: reply });
      speakOut(reply);
    }).catch(function (e) {
      thinking.remove();
      state.history.pop();                       // failed turn: don't poison history
      var msg = e.message;
      // Chrome only starts the one-time Nano download from a real click.
      if (/user gesture/i.test(msg))
        msg = 'Chrome wants a real click before it downloads the little brain — press the Send button once.';
      addMsg('err', msg);
    }).finally(function () {
      state.busy = false;
      if (!panel.hidden) input.focus();   // not into a hidden input if the chat closed meanwhile
    });
  }

  // ------------------------------------------------------------ speech in/out
  var rec = null, recOn = false;
  function toggleMic() {
    if (recOn) { try { rec.stop(); } catch (e) {} return; }
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    rec = new SR();
    rec.lang = navigator.language || 'en-US';
    rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = function (ev) {
      var t = ev.results[0][0].transcript;
      input.value = t; send();
    };
    rec.onend = function () { recOn = false; micBtn.className = ''; };
    rec.onerror = function (ev) {
      recOn = false; micBtn.className = '';
      if (ev.error !== 'aborted' && ev.error !== 'no-speech')
        addMsg('err', 'microphone: ' + ev.error);
    };
    recOn = true; micBtn.className = 'rec';
    try { rec.start(); } catch (e) { recOn = false; micBtn.className = ''; }
  }
  function speakOut(text) {
    if (!state.speak || !window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    } catch (e) {}
  }

  // ------------------------------------------------------------ boot
  function boot() {
    loadCfg();
    buildPanel();       // panel first: dialog Save reveals it
    buildDialog();
    var btn = el('button', { id: 'aibtn', type: 'button', text: '🛸 Ask Marty' });
    btn.title = 'Give Marty an AI and ask him questions (Ctrl+M)';
    btn.addEventListener('click', toggleOpen);
    var controls = document.getElementById('controls');
    if (controls) controls.appendChild(btn); else document.body.appendChild(btn);
    // The opening screen is where people will look for this first (the game's
    // control row only appears once you are playing). The chat panel cannot
    // render on the launcher, so this button always opens the settings dialog
    // (a <dialog> lives in the top layer, so it shows over fullscreen too).
    // If a provider is saved here, the panel greets you once the game starts.
    var lrowBtn = document.getElementById('lplayground');
    if (lrowBtn && lrowBtn.parentNode) {
      var lbtn = el('button', { type: 'button', text: '🛸 Marty AI…' });
      lbtn.title = 'Give Marty an AI: Claude, OpenAI, Gemini, or Chrome built-in';
      lbtn.addEventListener('click', function () { dlg.showModal(); });
      lrowBtn.parentNode.appendChild(lbtn);
    }
    // The pause chooser sits at the very top z-index, so the chat cannot be used while it
    // is up (and in fullscreen it is the one reliably reachable surface — Esc opens it).
    // Add an Ask Marty choice to it: hides the chooser, keeps the engine paused, chats,
    // and the chooser returns when the chat closes.
    if (typeof globalThis.TT_demoPause === 'function') {
      var origPause = globalThis.TT_demoPause;
      globalThis.TT_demoPause = function (d) {
        origPause(d);
        var boxEl = document.getElementById('ttpause');
        if (!state.provider || !boxEl || boxEl.querySelector('.mai-pausebtn')) return;
        var r = document.createElement('div');
        r.style.cssText = 'padding:0 12px 14px;text-align:center';
        var b = document.createElement('button');
        b.className = 'mai-pausebtn';
        b.textContent = '🛸 Ask Marty (stays paused)';
        b.style.cssText = 'font:inherit;padding:4px 10px;width:100%;cursor:pointer';
        b.addEventListener('click', toggleOpen);
        r.appendChild(b);
        boxEl.firstChild.appendChild(r);
      };
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
