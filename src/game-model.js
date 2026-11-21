(function (root, factory) {
  'use strict';
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./game-content.js') : root.BleileContent);
  root.BleileGame = api;
  if (node) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (content) {
  'use strict';
  function freeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }
  const COMPONENTS = freeze(content.COMPONENTS);
  const componentIds = COMPONENTS.map((c) => c.id);
  // A component's score in a study is the number of bugs its stories carry.
  const SCENARIOS = freeze(
    content.SCENARIOS.map((s) => {
      const count = (id, kind) => s.concerns[id]?.[kind]?.points || 0;
      return {
        ...s,
        scores: Object.fromEntries(
          componentIds.map((id) => [
            id,
            count(id, 'clearable') + count(id, 'persistent'),
          ]),
        ),
        clearable: Object.fromEntries(
          componentIds
            .filter((id) => count(id, 'clearable'))
            .map((id) => [id, count(id, 'clearable')]),
        ),
      };
    }),
  );
  const config = (id) => {
    const value = SCENARIOS.find((s) => s.id === id);
    if (!value) throw new RangeError('Unknown scenario: ' + id);
    return value;
  };
  const KINDS = ['clearable', 'persistent'];
  // A round played with predictions records the player's prediction for each story.
  function initialState(scenario = 'rwd', { predict = false } = {}) {
    const source = config(scenario),
      bugs = [];
    for (const c of COMPONENTS)
      for (let i = 0; i < source.scores[c.id]; i++)
        bugs.push({
          id: c.id + '-' + i,
          component: c.id,
          kind: i < (source.clearable[c.id] || 0) ? 'clearable' : 'persistent',
          cleared: false,
          seen: false,
        });
    return freeze({
      scenario,
      bugs,
      history: [],
      ...(predict && { predictions: {} }),
    });
  }
  function assertState(state) {
    if (!state || !Array.isArray(state.bugs) || !Array.isArray(state.history))
      throw new TypeError('Invalid game state.');
    const source = config(state.scenario),
      counts = Object.fromEntries(componentIds.map((id) => [id, 0])),
      ids = new Set();
    for (const b of state.bugs) {
      if (
        !b ||
        !componentIds.includes(b.component) ||
        !KINDS.includes(b.kind) ||
        typeof b.id !== 'string' ||
        ids.has(b.id) ||
        typeof b.cleared !== 'boolean' ||
        typeof b.seen !== 'boolean'
      )
        throw new TypeError('Invalid bug.');
      if (b.cleared && (!b.seen || b.kind !== 'clearable'))
        throw new TypeError('Only a revealed, clearable bug can be cleared.');
      ids.add(b.id);
      counts[b.component]++;
    }
    for (const id of componentIds)
      if (counts[id] !== source.scores[id])
        throw new RangeError('The initial infestation must be preserved.');
    const predictions = state.predictions;
    if (
      predictions !== undefined &&
      !(
        predictions &&
        typeof predictions === 'object' &&
        Object.values(predictions).every((kind) => KINDS.includes(kind))
      )
    )
      throw new TypeError('Invalid predictions.');
  }
  function total(state) {
    assertState(state);
    return state.bugs.filter((b) => !b.cleared).length;
  }
  function scores(state) {
    assertState(state);
    const result = Object.fromEntries(componentIds.map((id) => [id, 0]));
    for (const b of state.bugs) if (!b.cleared) result[b.component]++;
    return freeze(result);
  }
  const storyOf = (bug, state) =>
    config(state.scenario).concerns[bug.component]?.[bug.kind];
  const repairPending = (state, component) =>
    state.bugs.some(
      (b) => b.component === component && b.kind === 'clearable' && !b.cleared,
    );
  // A story with a finding shows no color until the player has predicted it.
  const storyKey = (bug) => bug.component + '-' + bug.kind;
  const unpredicted = (bug, state) =>
    !!state.predictions &&
    !!storyOf(bug, state)?.finding &&
    !state.predictions[storyKey(bug)];
  // While a study has findings left to predict, anything that would give an
  // answer away is withheld.
  const withheld = (state) => state.bugs.some((b) => unpredicted(b, state));
  // Where a bug stands. The heading titles its group in the round review, the
  // status names it in the bug's details, and an action, where given,
  // replaces the story's.
  const STATUSES = freeze([
    {
      id: 'unpredicted',
      heading: 'Not yet predicted',
      status: 'Not yet predicted',
      action: 'Predict whether it will clear or stay',
    },
    {
      id: 'repairable',
      heading: 'Still repairable',
      status: 'Available repair',
    },
    {
      id: 'persistent',
      heading: 'Unresolved with these tools',
      status: 'Unresolved with these tools',
    },
    {
      id: 'repaired',
      heading: 'Repaired this round',
      status: 'Cleared in this example',
      action: 'Resolved within this example',
    },
  ]);
  const statusOf = (bug, state) =>
    unpredicted(bug, state)
      ? 'unpredicted'
      : bug.cleared
        ? 'repaired'
        : bug.kind === 'clearable'
          ? 'repairable'
          : 'persistent';
  function getBugText(bug, state) {
    if (state) assertState(state);
    if (!bug || !componentIds.includes(bug.component))
      throw new RangeError('Unknown bug component.');
    if (state && unpredicted(bug, state))
      return 'Will it clear, or will it stay?';
    // A story with its own caption replaces the component's.
    return (
      (state && storyOf(bug, state)?.caption) ||
      COMPONENTS.find((c) => c.id === bug.component).captions[
        bug.kind === 'clearable' ? 'clearable' : 'persistent'
      ]
    );
  }
  function getBugDetails(bug, state) {
    assertState(state);
    if (!bug || typeof bug.id !== 'string')
      throw new RangeError('Unknown bug.');
    const current = state.bugs.find((b) => b.id === bug.id);
    if (
      !current ||
      current.component !== bug.component ||
      current.kind !== bug.kind
    )
      throw new RangeError('Unknown bug for this study.');
    const c = COMPONENTS.find((c) => c.id === current.component);
    const detail = storyOf(current, state);
    if (!detail)
      throw new RangeError('No story exists for this bug in this study.');
    // Until the prediction is made, the finding stands in for the story.
    const standing = STATUSES.find((s) => s.id === statusOf(current, state));
    const reason =
      standing.id === 'unpredicted'
        ? detail.finding
        : (repairPending(state, current.component) &&
            detail.reasonBeforeRepair) ||
          detail.reason;
    return freeze({
      component: c.id,
      label: c.label,
      score: scores(state)[c.id],
      reason,
      action: standing.action || detail.action,
      status: standing.status,
      sizeNote:
        'Size follows this component’s concern level; each bug is one Bleile point.',
    });
  }

  const ROADMAP_BASE = content.ROADMAP_BASE;
  const ROADMAP_STEPS = freeze(
    Object.fromEntries(
      COMPONENTS.map((c) => [
        c.id,
        { ...c.step, url: ROADMAP_BASE + '#' + c.step.anchor },
      ]),
    ),
  );
  const POINTS_NOTE =
    'Bleile points are informal game tokens for study gaps and possible repairs. They do not measure bias or decide the verdict.';
  const points = (n) => n + ' Bleile point' + (n === 1 ? '' : 's');
  // How many stories ask for a prediction, how many the player has made and
  // how many were right.
  function predictionTally(source, predictions) {
    const stories = Object.entries(source.concerns).flatMap(
      ([component, kinds]) =>
        Object.entries(kinds).map(([kind, story]) => ({
          guess: predictions[storyKey({ component, kind })],
          kind,
          story,
        })),
    );
    const guessed = stories.filter((s) => s.guess);
    return {
      total: stories.filter((s) => s.story.finding).length,
      made: guessed.length,
      correct: guessed.filter((s) => s.guess === s.kind).length,
    };
  }
  // The debrief is read from the bugs as they are now (component, kind and
  // cleared flag) and from the predictions made. Bugs that tell the same story
  // share one row.
  function debrief(state) {
    assertState(state);
    const source = config(state.scenario),
      rows = new Map();
    const tally = () => ({
      ...(state.predictions && { unpredicted: 0 }),
      repairable: 0,
      repaired: 0,
      persistent: 0,
    });
    const counts = tally();
    const perComponent = Object.fromEntries(
      componentIds.map((id) => [id, tally()]),
    );
    for (const bug of state.bugs) {
      const status = statusOf(bug, state),
        key = storyKey(bug) + '-' + status,
        guess = state.predictions?.[storyKey(bug)];
      counts[status]++;
      perComponent[bug.component][status]++;
      if (!rows.has(key)) {
        const c = COMPONENTS.find((c) => c.id === bug.component),
          detail = getBugDetails(bug, state);
        rows.set(key, {
          component: c.id,
          label: c.label,
          status,
          points: 0,
          found: 0,
          // Headed by the repair made, the finding to predict, or the component.
          title:
            status === 'repaired'
              ? storyOf(bug, state).action
              : status === 'unpredicted'
                ? detail.reason
                : c.label,
          reason: detail.reason,
          action: detail.action,
          matters: c.definition,
          step: ROADMAP_STEPS[c.id],
          sameComponent: perComponent[c.id],
          ...(guess && { guess, correct: guess === bug.kind }),
        });
      }
      const row = rows.get(key);
      row.points++;
      if (bug.seen) row.found++;
    }
    // Bugs come blue first within a component, so within a component the
    // unpredicted rows are put in order of their wording: position must not
    // give the color away.
    const place = (r) => componentIds.indexOf(r.component);
    const list = [...rows.values()],
      rowsOf = (status) => {
        const found = list.filter((r) => r.status === status);
        return status === 'unpredicted'
          ? found.sort(
              (a, b) =>
                place(a) - place(b) || a.title.localeCompare(b.title, 'en'),
            )
          : found;
      },
      complete = counts.repairable === 0 && !counts.unpredicted;
    const summary = counts.unpredicted
      ? points(counts.unpredicted) + ' not yet predicted.'
      : !complete
        ? (counts.repaired
            ? 'You have repaired ' + points(counts.repaired) + ' so far. '
            : 'No repairs yet. ') +
          points(counts.repairable) +
          ' can still be repaired here.'
        : 'Every available repair is done. These records still leave ' +
          points(counts.persistent) +
          ' unresolved.';
    return freeze({
      scenario: state.scenario,
      study: { title: source.title },
      verdict: verdict(state),
      remaining: total(state),
      counts,
      complete,
      summary,
      pointsNote: POINTS_NOTE,
      ...(state.predictions && {
        predictions: predictionTally(source, state.predictions),
      }),
      groups: STATUSES.filter(
        (s) => s.id !== 'unpredicted' || counts.unpredicted,
      ).map((s) => ({
        id: s.id,
        heading: s.heading,
        points: counts[s.id],
        rows: rowsOf(s.id),
      })),
    });
  }

  function transition(state, id, kind, guess) {
    assertState(state);
    const bug = state.bugs.find((b) => b.id === id);
    if (!bug) throw new RangeError('Unknown bug: ' + id);
    if (
      (kind === 'reveal' && bug.seen) ||
      (kind === 'clear' &&
        (bug.cleared ||
          !bug.seen ||
          bug.kind !== 'clearable' ||
          unpredicted(bug, state))) ||
      (kind === 'predict' && (!bug.seen || !unpredicted(bug, state)))
    )
      return freeze({ state, event: null });
    const before = total(state),
      bugs = state.bugs.map((b) =>
        b.id === id
          ? { ...b, seen: true, cleared: kind === 'clear' || b.cleared }
          : { ...b },
      );
    const predictions =
      kind === 'predict'
        ? { ...state.predictions, [storyKey(bug)]: guess }
        : state.predictions;
    const caption = getBugText(bug, { ...state, predictions });
    const event = {
      kind,
      bugId: id,
      component: bug.component,
      delta: kind === 'clear' ? -1 : 0,
      before,
      after: before - (kind === 'clear' ? 1 : 0),
      caption,
      ...(kind === 'predict' && { guess, correct: guess === bug.kind }),
    };
    const next = {
      scenario: state.scenario,
      bugs,
      history: [...state.history, event],
      ...(predictions && { predictions }),
    };
    return freeze({ state: next, event });
  }
  const reveal = (state, id) => transition(state, id, 'reveal');
  const clear = (state, id) => transition(state, id, 'clear');
  // One prediction settles every bug of that story, and it cannot be changed.
  function predict(state, id, guess) {
    if (!KINDS.includes(guess))
      throw new RangeError('Unknown prediction: ' + guess);
    return transition(state, id, 'predict', guess);
  }
  function verdict(state) {
    assertState(state);
    // The verdict would give predictions away, so it waits for them.
    if (withheld(state))
      return freeze({
        heading: 'Predictions come first',
        subtitle: 'Predict each concern to see what this study can repair.',
      });
    const { heading, subtitle } = config(state.scenario).verdicts.find(
      (v) => !v.untilRepaired || repairPending(state, v.untilRepaired),
    );
    return freeze({ heading, subtitle });
  }
  return freeze({
    COMPONENTS,
    SCENARIOS,
    ROADMAP_BASE,
    ROADMAP_STEPS,
    initialState,
    total,
    scores,
    reveal,
    clear,
    predict,
    unpredicted,
    withheld,
    verdict,
    getBugText,
    getBugDetails,
    debrief,
  });
});
