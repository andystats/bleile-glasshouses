(() => {
  'use strict';
  const $ = (id) => document.getElementById(id),
    G = window.BleileGame;
  // Opened with ?predict, a study that has findings asks for a prediction on
  // each concern before its color is shown.
  const predict = new URLSearchParams(location.search).has('predict');
  const states = Object.fromEntries(
    G.SCENARIOS.map((s) => [s.id, G.initialState(s.id, { predict })]),
  );
  // The bugs in each house that have already had their first-look sound.
  const heard = Object.fromEntries(G.SCENARIOS.map((s) => [s.id, new Set()]));
  let state = states.rwd,
    selected = null,
    asked = null,
    opener = null,
    sound = false,
    audio = null,
    light = true,
    ambient = false,
    wide = false,
    focusing = false,
    toastTimer,
    hintTimer,
    cycle = 0,
    panel = 0,
    introSeen = false,
    lightBeforeWelcome = true,
    renderQueued = false;
  // A bug whose story is not yet predicted shows no color.
  const kindOf = (bug) =>
    G.unpredicted(bug, state) ? 'unpredicted' : bug.kind;
  const CLOSING =
    'Every available repair is done. Open Review this round for your closing debrief.';
  // What the player reads for each kind of bug. The color also names the
  // sound slot for the first look at a bug of that kind.
  const KIND_COPY = {
    clearable: {
      color: 'blue',
      card: 'Blue · available repair',
      found: 'Blue. Hold Space to clear.',
    },
    persistent: {
      color: 'coral',
      card: 'Coral · reveal only',
      found: 'Coral. Reveal only.',
    },
    unpredicted: {
      color: 'pale',
      card: 'Pale · not yet predicted',
      found: 'Not yet predicted. Press Space to predict its color.',
    },
  };
  const icon =
    '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M9 26 29 9l26 10v32L31 59 9 49Z M9 26l22 10 24-17 M31 36v23 M29 9l2 27 M9 26v23 M18 18l23 9v28 M40 13l-19 18v23 M9 39l22 10 24-16"/><path d="m18 46 10 4v-9l-10-4z" opacity=".3"/></svg>';
  for (const [i, s] of G.SCENARIOS.entries()) {
    const button = document.createElement('button');
    button.className = 'house-card';
    button.dataset.scenario = s.id;
    button.setAttribute('aria-pressed', String(s.id === state.scenario));
    button.innerHTML = `<span class="number">0${i + 1}</span>${icon}<div><h3>${s.title}</h3><span class="card-score"><b>${G.total(states[s.id])}</b> <span>Bleile points</span></span></div>`;
    button.addEventListener('click', () => switchScenario(s.id));
    $('houses').append(button);
  }
  for (const c of G.COMPONENTS) {
    const dt = document.createElement('dt'),
      dd = document.createElement('dd');
    dt.textContent = c.short;
    dd.textContent = c.definition;
    $('glossary').append(dt, dd);
    const row = document.createElement('div');
    row.className = 'profile-row';
    row.dataset.component = c.id;
    row.innerHTML = `<div><span>${c.short}</span><b></b></div><div class="profile-track"><span class="profile-fill"></span></div>`;
    $('profile-bars').append(row);
    const step = document.createElement('li');
    step.textContent = c.short;
    $('welcome-steps').append(step);
  }
  const scene = new BleileScene($('world'), {
    onReveal: (id) => transition('reveal', id),
    onClear: (id) => transition('clear', id),
    onSelect: select,
  });
  // The build embeds a recording for each sound slot it finds in src/sounds.
  // A slot with no recording plays its chime, if it has one.
  const CHIMES = { pop: [660, 880, 1320], start: [392, 587] };
  const recordings = {};
  function loadRecordings() {
    for (const [slot, data] of Object.entries(window.BleileSounds)) {
      if (slot in recordings) continue;
      recordings[slot] = null;
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      // A recording that cannot be decoded leaves its slot on the chime.
      audio
        .decodeAudioData(bytes.buffer)
        .then((buffer) => (recordings[slot] = buffer))
        .catch(() => {});
    }
  }
  function play(slot) {
    if (!sound) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      loadRecordings();
      if (recordings[slot]) {
        const source = audio.createBufferSource(),
          g = audio.createGain();
        source.buffer = recordings[slot];
        g.gain.value = 0.4;
        source.connect(g);
        g.connect(audio.destination);
        source.start();
        return;
      }
      const at = audio.currentTime;
      (CHIMES[slot] || []).forEach((frequency, i) => {
        const o = audio.createOscillator(),
          g = audio.createGain();
        o.type = 'sine';
        o.frequency.value = frequency;
        g.gain.setValueAtTime(0, at + i * 0.07);
        g.gain.linearRampToValueAtTime(0.018, at + i * 0.07 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, at + i * 0.07 + 0.45);
        o.connect(g);
        g.connect(audio.destination);
        o.start(at + i * 0.07);
        o.stop(at + i * 0.07 + 0.5);
      });
    } catch {
      sound = false;
      $('sound').textContent = 'Sound unavailable';
      $('sound').setAttribute('aria-pressed', 'false');
    }
  }
  function toast(message) {
    $('toast').textContent = message;
    $('toast').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 1800);
  }
  // The opening hint is one-time guidance, not a prerequisite tied to new discoveries.
  function dismissHint() {
    clearTimeout(hintTimer);
    $('beam-instruction').hidden = true;
  }
  function syncTabStop() {
    const id = selected || state.bugs.find((b) => !b.cleared)?.id;
    for (const b of $('hotspots').querySelectorAll('button'))
      b.tabIndex = b.dataset.bug === id ? 0 : -1;
  }
  function updateFocusButton(bug) {
    const kind = bug && kindOf(bug),
      unpredicted = kind === 'unpredicted',
      blue = kind === 'clearable' && !bug.cleared,
      canClear = blue && light;
    $('focus').disabled = !(canClear || (unpredicted && light));
    $('focus-label').textContent = canClear
      ? 'Hold to neutralize'
      : unpredicted && light
        ? 'Predict its color'
        : blue || unpredicted
          ? 'Turn spotlight on'
          : bug
            ? 'Reveal only'
            : 'Aim at a bug';
    $('focus').setAttribute(
      'aria-label',
      canClear
        ? 'Hold to neutralize this blue bug'
        : blue
          ? 'Turn the spotlight on to neutralize this blue bug'
          : unpredicted
            ? light
              ? 'Predict whether this bug is blue or coral'
              : 'Turn the spotlight on to predict this bug'
            : bug
              ? 'This coral bug cannot be neutralized with the available tools'
              : 'Aim at a blue bug to neutralize it',
    );
  }
  function positionInspection() {
    if ($('inspection').hidden || !selected) return;
    if (innerWidth <= 600) {
      $('inspection').style.left = '';
      $('inspection').style.top = '';
      return;
    }
    const n = scene.getDebug().bugPositions.find((b) => b.id === selected);
    if (!n) return;
    const card = $('inspection'),
      world = $('world'),
      w = card.offsetWidth,
      h = card.offsetHeight,
      offset = 26;
    let x = n.x + offset;
    if (x + w > world.clientWidth - 12) x = n.x - w - offset;
    let y = n.y - h - 22;
    if (y < 110) y = n.y + 26;
    x = Math.max(12, Math.min(x, world.clientWidth - w - 12));
    y = Math.max(110, Math.min(y, world.clientHeight - h - 14));
    card.style.left = x + 'px';
    card.style.top = world.offsetTop + y + 'px';
  }
  function showInspection(bug) {
    const detail = G.getBugDetails(bug, state),
      kind = kindOf(bug);
    $('inspection').dataset.kind = kind;
    $('inspection').dataset.bug = bug.id;
    $('inspect-name').textContent = detail.label;
    $('inspect-score').textContent = detail.score + ' / 10';
    $('inspect-reason').textContent = detail.reason;
    $('inspect-kind').textContent = KIND_COPY[kind].card;
    $('inspect-action').textContent = detail.action;
    $('inspect-size').textContent = detail.sizeNote;
    $('inspection').hidden = false;
    positionInspection();
  }
  function select(id) {
    if (!id) {
      defaultCaption();
      syncTabStop();
      return;
    }
    const bug = state.bugs.find((b) => b.id === id && !b.cleared);
    if (!bug) {
      defaultCaption();
      return;
    }
    dismissHint();
    selected = id;
    syncTabStop();
    const c = G.COMPONENTS.find((c) => c.id === bug.component),
      copy = G.getBugText(bug, state),
      kind = kindOf(bug);
    if (!heard[state.scenario].has(id)) {
      heard[state.scenario].add(id);
      play(KIND_COPY[kind].color);
    }
    $('bug-mark').dataset.kind = kind;
    $('focus-title').textContent =
      c.short +
      ' · ' +
      (kind === 'persistent'
        ? 'reveal only'
        : !light
          ? 'spotlight needed'
          : kind === 'clearable'
            ? 'hold to neutralize'
            : 'predict its color');
    $('focus-subtitle').textContent = copy;
    updateFocusButton(bug);
    showInspection(bug);
  }
  function transition(kind, id, guess) {
    const bug = state.bugs.find((b) => b.id === id);
    if (!bug) return null;
    const result = G[kind](state, id, guess);
    if (!result.event) return null;
    state = result.state;
    states[state.scenario] = state;
    if (kind === 'reveal') scheduleRender();
    else render();
    if (kind === 'clear') {
      const done = G.debrief(state).complete;
      play('pop');
      toast(
        '−1 ' +
          G.COMPONENTS.find((c) => c.id === bug.component).short +
          (done ? ' · closing debrief ready' : ''),
      );
      $('announcement').textContent =
        result.event.caption +
        '. ' +
        points(G.total(state)) +
        ' remain' +
        (G.total(state) === 1 ? 's' : '') +
        '.' +
        (done ? ' ' + CLOSING : '');
      if (selected === id) {
        $('focus-title').textContent = 'One concern cleared.';
        $('focus-subtitle').textContent = G.getBugText(bug, state);
        selected = null;
        $('inspection').hidden = true;
        updateFocusButton(null);
      }
    }
    dismissHint();
    return result.event;
  }
  // The spotlight follows the pointer, so the choice is offered in a dialog.
  function askPrediction() {
    const bug = state.bugs.find((b) => b.id === selected);
    if (!light || !bug || kindOf(bug) !== 'unpredicted') return;
    setFocusing(false);
    if ($('predict').open || $('world').classList.contains('graphics-paused'))
      return;
    const detail = G.getBugDetails(bug, state);
    asked = bug.id;
    opener = document.activeElement;
    $('predict-title').textContent = detail.label;
    $('predict-finding').textContent = detail.reason;
    $('predict-ask').hidden = false;
    $('predict-result').hidden = true;
    $('predict').showModal();
    $('predict-title').focus();
  }
  function answerPrediction(guess) {
    // A prediction needs a seen bug.
    transition('reveal', asked);
    const event = transition('predict', asked, guess);
    // A second activation finds the story already predicted.
    if (!event) {
      $('predict').close();
      return;
    }
    if (selected) select(selected);
    syncAvailability();
    const bug = state.bugs.find((b) => b.id === asked),
      detail = G.getBugDetails(bug, state);
    // The answer shows the bug's color, so its sound plays now.
    play(KIND_COPY[bug.kind].color);
    $('predict-result').dataset.kind = bug.kind;
    $('predict-outcome').textContent =
      (event.correct ? 'Correct. ' : 'Not this time. ') +
      'It is ' +
      KIND_COPY[bug.kind].color +
      ': this study ' +
      (bug.kind === 'clearable' ? 'can' : 'cannot') +
      ' clear it.';
    $('predict-reason').textContent = detail.reason;
    $('predict-action').textContent =
      detail.status + ': ' + detail.action + '.';
    $('predict-ask').hidden = true;
    $('predict-result').hidden = false;
    $('predict-continue').focus();
  }
  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    queueMicrotask(() => {
      if (renderQueued) {
        renderQueued = false;
        render();
      }
    });
  }
  function render() {
    renderQueued = false;
    const config = G.SCENARIOS.find((s) => s.id === state.scenario),
      score = G.total(state),
      profile = G.scores(state),
      v = G.verdict(state);
    $('scene-number').textContent =
      'HOUSE 0' +
      (G.SCENARIOS.indexOf(config) + 1) +
      ' / 0' +
      G.SCENARIOS.length;
    $('scene-title').textContent = config.title;
    $('scene-subtitle').textContent = config.subtitle;
    $('score').textContent = score;
    $('seen').textContent = state.bugs.filter((b) => b.seen).length;
    $('cleared').textContent = state.bugs.filter((b) => b.cleared).length;
    $('verdict-title').textContent = v.heading;
    $('verdict-subtitle').textContent = v.subtitle;
    const withheld = G.withheld(state);
    $('legend-pale').hidden = !withheld;
    $('profile-bars').classList.toggle('withheld', withheld);
    if ($('profile').open) renderDebrief();
    for (const row of $('profile-bars').children) {
      row.querySelector('b').textContent =
        profile[row.dataset.component] + ' / 10';
      row.querySelector('.profile-fill').style.width =
        profile[row.dataset.component] * 10 + '%';
    }
    for (const b of $('houses').children) {
      b.setAttribute(
        'aria-pressed',
        String(b.dataset.scenario === state.scenario),
      );
      b.querySelector('b').textContent = G.total(states[b.dataset.scenario]);
    }
    scene.setState({
      ...state,
      bugs: state.predictions
        ? state.bugs.map((b) => ({ ...b, kind: kindOf(b) }))
        : state.bugs,
      scores: profile,
      background: config.background,
    });
    syncTabStop();
    syncAvailability();
  }
  // The round review is rebuilt from the model's debrief of the current state, so it needs no WebGL.
  function points(n) {
    return n + ' Bleile point' + (n === 1 ? '' : 's');
  }
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function debriefRow(row) {
    const item = el('li', 'debrief-row');
    const details = el('details');
    const summary = el('summary');
    const count = el('span', 'debrief-row-count', String(row.points));
    count.setAttribute('aria-label', points(row.points));
    summary.append(document.createTextNode(row.title + ' '), count);
    details.append(summary);
    if (row.status !== 'unpredicted') details.append(el('p', '', row.reason));
    details.append(el('p', '', row.matters));
    if (row.guess)
      details.append(
        el(
          'p',
          '',
          'You predicted ' +
            KIND_COPY[row.guess].color +
            (row.correct ? ': correct.' : ': not this time.'),
        ),
      );
    if (row.status === 'repaired') {
      const remaining =
        row.sameComponent.repairable +
        row.sameComponent.persistent +
        (row.sameComponent.unpredicted || 0);
      if (remaining)
        details.append(
          el(
            'p',
            'debrief-action',
            'The ' +
              row.label.toLowerCase() +
              ' component still has ' +
              points(remaining) +
              ' to review.',
          ),
        );
    } else {
      details.append(el('p', 'debrief-action', row.action));
      if (row.found)
        details.append(
          el(
            'p',
            '',
            'Found ' + row.found + ' of ' + row.points + ' in this group.',
          ),
        );
    }
    const link = el('a', '', 'Step ' + row.step.number + ' · ' + row.step.name);
    link.href = row.step.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.setAttribute(
      'aria-label',
      'Roadmap step ' +
        row.step.number +
        ', ' +
        row.step.name +
        ', for ' +
        row.label,
    );
    item.append(details, link);
    return item;
  }
  function renderDebrief() {
    const d = G.debrief(state),
      box = $('debrief-groups');
    $('profile-title').textContent = d.complete
      ? 'Closing debrief'
      : 'Round review';
    $('profile-subtitle').textContent =
      d.study.title + ' · ' + points(d.remaining) + ' remaining';
    $('debrief-verdict').textContent =
      d.verdict.heading + '. ' + d.verdict.subtitle;
    $('debrief-summary').textContent = d.summary;
    const tally = d.predictions;
    $('debrief-predictions').hidden = !tally?.total;
    if (tally?.total) {
      const left = tally.total - tally.made;
      $('debrief-predictions').textContent = [
        tally.made &&
          'Your predictions: ' +
            tally.correct +
            ' of ' +
            tally.made +
            ' correct.',
        left &&
          left +
            (left === 1 ? ' prediction' : ' predictions') +
            ' still to make.',
      ]
        .filter(Boolean)
        .join(' ');
    }
    $('debrief-note').textContent = d.pointsNote;
    box.replaceChildren(
      ...d.groups.map((group) => {
        const section = el('section', 'debrief-group'),
          heading = el('h3'),
          id = 'debrief-' + group.id;
        section.dataset.status = group.id;
        heading.id = id;
        section.setAttribute('aria-labelledby', id);
        heading.append(
          el('span', '', group.heading),
          el('span', 'debrief-count', points(group.points)),
        );
        section.append(heading);
        if (group.rows.length) {
          const list = el('ul', 'debrief-rows');
          list.append(...group.rows.map(debriefRow));
          section.append(list);
        }
        return section;
      }),
    );
  }
  function syncAvailability() {
    const unavailable = !scene.getDebug().available || $('scene').hidden;
    $('world').classList.toggle('graphics-paused', unavailable);
    for (const id of ['light', 'ambient', 'wide', 'find-next'])
      $(id).disabled = unavailable;
    if (unavailable) {
      $('focus').disabled = true;
      $('inspection').hidden = true;
    }
  }
  function defaultCaption() {
    $('focus-title').textContent = 'Find what is hidden.';
    $('focus-subtitle').textContent = 'Sweep the glasshouse with light.';
    $('bug-mark').removeAttribute('data-kind');
    selected = null;
    $('inspection').hidden = true;
    updateFocusButton(null);
  }
  function switchScenario(id) {
    setFocusing(false);
    state = states[id];
    cycle = 0;
    defaultCaption();
    $('toast').classList.remove('visible');
    dismissHint();
    render();
    scene.setLight(light);
    scene.setAmbient(ambient);
    $('announcement').textContent =
      G.SCENARIOS.find((s) => s.id === id).subtitle +
      '. ' +
      points(G.total(state)) +
      '.';
  }
  function syncSwitch(id, value) {
    const button = $(id);
    button.setAttribute('aria-checked', String(Boolean(value)));
    button.querySelector('.switch-state').textContent = value ? 'ON' : 'OFF';
  }
  function setLight(value) {
    light = value;
    scene.setLight(value);
    syncSwitch('light', value);
    if (!value) setFocusing(false);
    syncSceneSelection();
  }
  function setAmbient(value) {
    ambient = Boolean(value);
    scene.setAmbient(ambient);
    syncSwitch('ambient', ambient);
    syncSceneSelection();
    $('announcement').textContent = ambient
      ? 'Corner lamp on. Existing knowledge lights nearby concerns; no Bleile points are removed.'
      : 'Corner lamp off.';
  }
  function syncSceneSelection() {
    const d = scene.getDebug(),
      id = d.targetId;
    if (id && d.visibleIds.includes(id)) select(id);
    else defaultCaption();
  }
  function setFocusing(value) {
    if (value && !light) return;
    focusing = value;
    scene.setFocusing(value);
    $('focus').classList.toggle('active', value);
    // The scene has now aimed this press at a bug. On an unpredicted bug the
    // press asks for the prediction instead of starting a repair.
    if (value) askPrediction();
  }
  function findNext() {
    if (!scene.getDebug().available || $('scene').hidden) return;
    const remaining = state.bugs.filter((b) => !b.cleared);
    if (!remaining.length) return;
    const unseen = remaining.filter((b) => !b.seen);
    const unpredicted = remaining.filter((b) => kindOf(b) === 'unpredicted');
    const blue = remaining.filter((b) => kindOf(b) === 'clearable');
    const pool =
      [unseen, unpredicted, blue].find((bugs) => bugs.length) || remaining;
    const b = pool[cycle % pool.length];
    cycle++;
    setLight(true);
    const aimed = scene.aimAt(b.id);
    syncSceneSelection();
    if (!aimed) return;
    $('announcement').textContent =
      G.COMPONENTS.find((c) => c.id === b.component).short +
      '. ' +
      KIND_COPY[kindOf(b)].found;
  }
  for (const b of document.querySelectorAll('[data-predict]'))
    b.addEventListener('click', () => answerPrediction(b.dataset.predict));
  $('find-next').addEventListener('click', findNext);
  $('world').addEventListener('pointerdown', () => {
    if (light) setFocusing(true);
  });
  window.addEventListener('pointerup', () => {
    if (focusing) setFocusing(false);
  });
  window.addEventListener('pointercancel', () => setFocusing(false));
  $('light').addEventListener('click', () => setLight(!light));
  $('ambient').addEventListener('click', () => setAmbient(!ambient));
  $('wide').addEventListener('click', () => {
    wide = !wide;
    scene.setWide(wide);
    $('wide').setAttribute('aria-pressed', String(wide));
  });
  $('focus').addEventListener('pointerdown', (e) => {
    if (e.currentTarget.disabled) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setFocusing(true);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
    $('focus').addEventListener(type, () => setFocusing(false));
  // Enter and assistive technology send a click with no pointer press, on the
  // main button or a bug. A repair needs a hold, but a prediction does not.
  $('focus').addEventListener('click', (e) => {
    if (e.detail === 0) askPrediction();
  });
  // The pointer may have moved the spotlight since this bug took focus.
  $('hotspots').addEventListener('click', (e) => {
    if (e.detail !== 0) return;
    scene.aimAt(e.target.dataset.bug);
    askPrediction();
  });
  $('predict').addEventListener('close', () => {
    // A coral prediction disables the main button, which then cannot take
    // focus back.
    if (opener?.disabled) $('find-next').focus();
    // A prediction can be the action that completes the round.
    if (!G.debrief(state).complete) return;
    toast('Closing debrief ready');
    $('announcement').textContent = CLOSING;
  });
  document.addEventListener('keydown', (e) => {
    if (
      e.code !== 'Space' ||
      e.repeat ||
      document.querySelector('dialog[open]')
    )
      return;
    const el = e.target;
    if (!el.matches('body,html,#scene,#world,#focus,#find-next,.bug-target'))
      return;
    e.preventDefault();
    setFocusing(true);
  });
  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      setFocusing(false);
    }
  });
  for (const type of ['webglcontextlost', 'webglcontextrestored'])
    $('scene').addEventListener(type, () => {
      syncAvailability();
      if (type === 'webglcontextrestored') syncSceneSelection();
    });
  window.addEventListener('resize', () => {
    setFocusing(false);
    requestAnimationFrame(positionInspection);
  });
  window.addEventListener('blur', () => setFocusing(false));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) setFocusing(false);
  });
  $('sound').addEventListener('click', () => {
    sound = !sound;
    $('sound').textContent = sound ? 'Sound on' : 'Sound off';
    $('sound').setAttribute('aria-pressed', String(sound));
    if (sound) play('start');
  });
  $('restart').addEventListener('click', () => {
    states[state.scenario] = G.initialState(state.scenario, { predict });
    heard[state.scenario].clear();
    scene.setState({ scenario: 'reset', bugs: [] });
    switchScenario(state.scenario);
    $('announcement').textContent = 'This house has been reset.';
  });
  for (const [button, dialog] of [
    ['guide-open', 'guide'],
    ['profile-open', 'profile'],
    ['notes-open', 'notes'],
  ]) {
    $(button).addEventListener('click', () => {
      setFocusing(false);
      if (dialog === 'profile') renderDebrief();
      if (dialog === 'notes')
        $('notes-example').hidden = Object.values(states).some(G.withheld);
      $(dialog).showModal();
      $(dialog).scrollTop = 0;
    });
  }
  for (const b of document.querySelectorAll('[data-close]'))
    b.addEventListener('click', () => $(b.dataset.close).close());
  for (const dialog of document.querySelectorAll('dialog'))
    dialog.addEventListener('click', (e) => {
      if (e.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        dialog.close();
    });
  // The welcome screen is a title followed by one intro panel each for the
  // bugs, the light and the verdict. A returning player starts without them.
  const INTRO_SEEN = 'bleile-intro-seen';
  const panels = [...document.querySelectorAll('.welcome-panel')];
  try {
    introSeen = localStorage.getItem(INTRO_SEEN) === '1';
  } catch {
    // Storage can be blocked. The intro then runs on every visit.
  }
  function showPanel(index) {
    panel = index;
    const cover = panel === 0,
      last = panel === panels.length - 1;
    panels.forEach((p, i) => (p.hidden = i !== panel));
    [...$('welcome-pips').children].forEach((pip, i) =>
      pip.classList.toggle('on', i === panel - 1),
    );
    $('welcome').dataset.panel = panel;
    $('welcome-back').hidden = cover;
    $('welcome-skip').hidden = cover || last;
    $('welcome-how').hidden = !cover || !introSeen;
    $('welcome-next-label').textContent = last
      ? 'Enter the glasshouse'
      : cover
        ? 'Start'
        : 'Next';
    // Hiding the focused button drops the focus, so the main button takes it.
    if (!$('welcome').contains(document.activeElement))
      $('welcome-next').focus();
  }
  // The glasshouse stays dark behind the welcome screen, so nothing is found
  // before the player enters.
  function openWelcome(index) {
    lightBeforeWelcome = light;
    setLight(false);
    showPanel(index);
    $('welcome').showModal();
  }
  $('welcome-next').addEventListener('click', () => {
    if (panel === panels.length - 1 || (panel === 0 && introSeen))
      $('welcome').close();
    else showPanel(panel + 1);
  });
  $('welcome-back').addEventListener('click', () => showPanel(panel - 1));
  $('welcome-how').addEventListener('click', () => showPanel(1));
  $('welcome').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' && panel < panels.length - 1)
      showPanel(panel + 1);
    if (e.key === 'ArrowLeft' && panel > 0) showPanel(panel - 1);
  });
  $('welcome').addEventListener('close', () => {
    introSeen = true;
    try {
      localStorage.setItem(INTRO_SEEN, '1');
    } catch {
      // Without storage the next visit shows the intro again.
    }
    setLight(lightBeforeWelcome);
    // The opening hint starts its clock once the glasshouse is in view.
    clearTimeout(hintTimer);
    hintTimer = setTimeout(dismissHint, 6000);
  });
  $('intro-open').addEventListener('click', () => {
    $('guide').close();
    openWelcome(1);
  });
  if (predict) {
    $('beam-instruction').textContent =
      'Inspect a bug and predict its color. Then hold on blue to clear.';
    $('welcome-predict').hidden = false;
  }
  render();
  openWelcome(0);
  window.BleileApp = {
    getState: () => state,
    getDebrief: () => G.debrief(state),
    getSceneDebug: () => scene.getDebug(),
    aimAt: (id) => {
      setLight(true);
      scene.aimAt(id);
    },
    setLight,
    setAmbient,
    setFocusing,
    switchScenario,
  };
})();
