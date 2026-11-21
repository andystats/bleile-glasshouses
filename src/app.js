(() => {
  'use strict';
  const $ = (id) => document.getElementById(id),
    G = window.BleileGame;
  // Opened with ?predict, a study that has findings asks for a call on each
  // concern before its color is shown.
  const predict = new URLSearchParams(location.search).has('predict');
  const states = Object.fromEntries(
    G.SCENARIOS.map((s) => [s.id, G.initialState(s.id, { predict })]),
  );
  let state = states.rwd,
    selected = null,
    asked = null,
    sound = false,
    audio = null,
    light = true,
    ambient = false,
    wide = false,
    focusing = false,
    toastTimer,
    hintTimer,
    cycle = 0,
    renderQueued = false;
  // A bug that still awaits the player's call shows no color.
  const kindOf = (bug) =>
    predict && G.awaitsPrediction(bug, state) ? 'unknown' : bug.kind;
  const icon =
    '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M9 26 29 9l26 10v32L31 59 9 49Z M9 26l22 10 24-17 M31 36v23 M29 9l2 27 M9 26v23 M18 18l23 9v28 M40 13l-19 18v23 M9 39l22 10 24-16"/><path d="m18 46 10 4v-9l-10-4z" opacity=".3"/></svg>';
  for (const [i, s] of G.SCENARIOS.entries()) {
    const button = document.createElement('button');
    button.className = 'house-card';
    button.dataset.scenario = s.id;
    button.setAttribute('aria-pressed', String(s.id === state.scenario));
    button.innerHTML = `<span class="number">0${i + 1}</span>${icon}<div><h3>${s.card.heading}</h3><p>${s.card.subtitle}</p><span class="card-score"><b>${G.total(states[s.id])}</b> <span>Bleile points</span></span></div>`;
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
  }
  const scene = new BleileScene($('world'), {
    onReveal: (id) => transition('reveal', id),
    onClear: (id) => transition('clear', id),
    onSelect: select,
  });
  function tone(kind) {
    if (!sound) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const at = audio.currentTime;
      const notes = kind === 'clear' ? [660, 880, 1320] : [392, 587];
      notes.forEach((frequency, i) => {
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
      waiting = kind === 'unknown',
      blue = kind === 'clearable' && !bug.cleared,
      canClear = blue && light;
    $('focus').disabled = !(canClear || (waiting && light));
    $('focus-label').textContent = canClear
      ? 'Hold to neutralize'
      : blue || waiting
        ? light
          ? 'Predict its color'
          : 'Turn spotlight on'
        : bug
          ? 'Reveal only'
          : 'Aim at a bug';
    $('focus').setAttribute(
      'aria-label',
      canClear
        ? 'Hold to neutralize this blue bug'
        : blue
          ? 'Turn the spotlight on to neutralize this blue bug'
          : waiting
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
    $('inspect-kind').textContent =
      kind === 'clearable'
        ? 'Blue · available repair'
        : kind === 'unknown'
          ? 'Pale · not yet judged'
          : 'Coral · reveal only';
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
    $('focus-subtitle').textContent =
      kind === 'clearable' ? copy.title : copy.subtitle;
    updateFocusButton(bug);
    showInspection(bug);
  }
  function transition(kind, id) {
    const bug = state.bugs.find((b) => b.id === id);
    if (!bug) return;
    const result = G[kind](state, id);
    if (!result.event) return;
    state = result.state;
    states[state.scenario] = state;
    if (kind === 'reveal') scheduleRender();
    else render();
    if (kind === 'clear') {
      const done = !state.bugs.some(
        (b) => kindOf(b) !== 'persistent' && !b.cleared,
      );
      tone('clear');
      toast(
        '−1 ' +
          G.COMPONENTS.find((c) => c.id === bug.component).short +
          (done ? ' · closing debrief ready' : ''),
      );
      $('announcement').textContent =
        result.event.title +
        '. ' +
        points(G.total(state)) +
        ' remain' +
        (G.total(state) === 1 ? 's' : '') +
        '.' +
        (done
          ? ' Every available repair is done. Open Review this round for your closing debrief.'
          : '');
      if (selected === id) {
        $('focus-title').textContent = 'One concern cleared.';
        $('focus-subtitle').textContent = G.getBugText(bug, state).title;
        selected = null;
        $('inspection').hidden = true;
        updateFocusButton(null);
      }
    }
    dismissHint();
  }
  // The call is made in a dialog, so the pointer is free to choose.
  function askPrediction(bug) {
    const detail = G.getBugDetails(bug, state);
    setFocusing(false);
    asked = bug.id;
    $('predict-title').textContent = detail.label;
    $('predict-finding').textContent = detail.reason;
    $('predict-ask').hidden = false;
    $('predict-result').hidden = true;
    $('predict').showModal();
    $('predict-title').focus();
  }
  function answerPrediction(guess) {
    transition('reveal', asked);
    const result = G.predict(state, asked, guess);
    if (!result.event) {
      $('predict').close();
      return;
    }
    state = result.state;
    states[state.scenario] = state;
    render();
    if (selected === asked) select(asked);
    const bug = state.bugs.find((b) => b.id === asked),
      detail = G.getBugDetails(bug, state);
    $('predict-result').dataset.kind = bug.kind;
    $('predict-outcome').textContent =
      (result.event.correct ? 'Correct. ' : 'Not this time. ') +
      (bug.kind === 'clearable'
        ? 'It is blue: this study can clear it.'
        : 'It is coral: it stays.');
    $('predict-reason').textContent = detail.reason;
    $('predict-action').textContent =
      detail.status + ': ' + detail.action + '.';
    $('predict-ask').hidden = true;
    $('predict-result').hidden = false;
    $('predict-continue').focus();
    dismissHint();
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
      bugs: predict
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
    if (row.status !== 'unjudged') details.append(el('p', '', row.reason));
    details.append(el('p', '', row.matters));
    if (row.guess)
      details.append(
        el(
          'p',
          '',
          'You called it ' +
            (row.guess === 'clearable' ? 'blue' : 'coral') +
            (row.correct ? ': correct.' : ': not this time.'),
        ),
      );
    if (row.status === 'repaired') {
      const remaining =
        row.sameComponent.repairable + row.sameComponent.persistent;
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
      d.study.title +
      ' · ' +
      d.study.subtitle +
      ' · ' +
      points(d.remaining) +
      ' remaining';
    $('debrief-verdict').textContent =
      d.verdict.heading + '. ' + d.verdict.subtitle;
    $('debrief-summary').textContent = d.summary;
    const calls = d.predictions,
      left = calls ? calls.total - calls.made : 0;
    $('debrief-calls').hidden = !calls?.total;
    if (calls?.total)
      $('debrief-calls').textContent = [
        calls.made &&
          'Your calls: ' + calls.correct + ' of ' + calls.made + ' correct.',
        left && left + (left === 1 ? ' call' : ' calls') + ' still to make.',
      ]
        .filter(Boolean)
        .join(' ');
    $('debrief-note').textContent = d.pointsNote;
    box.replaceChildren(
      ...d.groups
        .filter((group) => group.id !== 'unjudged' || group.points)
        .map((group) => {
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
    // A press on an unjudged bug asks for the call instead of starting a repair.
    const bug = value && state.bugs.find((b) => b.id === selected);
    if (bug && kindOf(bug) === 'unknown') askPrediction(bug);
  }
  function findNext() {
    if (!scene.getDebug().available || $('scene').hidden) return;
    const remaining = state.bugs.filter((b) => !b.cleared);
    if (!remaining.length) return;
    const unseen = remaining.filter((b) => !b.seen);
    const waiting = remaining.filter((b) => kindOf(b) === 'unknown');
    const blue = remaining.filter((b) => kindOf(b) === 'clearable');
    const pool = unseen.length
      ? unseen
      : waiting.length
        ? waiting
        : blue.length
          ? blue
          : remaining;
    const b = pool[cycle % pool.length];
    cycle++;
    setLight(true);
    const aimed = scene.aimAt(b.id);
    syncSceneSelection();
    if (!aimed) return;
    $('announcement').textContent =
      G.COMPONENTS.find((c) => c.id === b.component).short +
      '. ' +
      (kindOf(b) === 'clearable'
        ? 'Blue. Hold Space to clear.'
        : kindOf(b) === 'unknown'
          ? 'Not yet judged. Press Space to predict its color.'
          : 'Coral. Reveal only.');
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
    if (sound) tone('start');
  });
  $('restart').addEventListener('click', () => {
    states[state.scenario] = G.initialState(state.scenario, { predict });
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
  if (predict) {
    $('legend-pale').hidden = false;
    $('beam-instruction').textContent =
      'Inspect a bug and predict its color. Then hold on blue to clear.';
  }
  render();
  hintTimer = setTimeout(dismissHint, 6000);
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
