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
  // A round played with predictions records the player's call for each story.
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
    const calls = state.predictions;
    if (
      calls !== undefined &&
      !(
        calls &&
        typeof calls === 'object' &&
        Object.values(calls).every((kind) => KINDS.includes(kind))
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
  const unjudged = (bug, state) =>
    !!state.predictions &&
    !!storyOf(bug, state)?.finding &&
    !state.predictions[storyKey(bug)];
  function awaitsPrediction(bug, state) {
    assertState(state);
    return unjudged(bug, state);
  }
  function getBugText(bug, state) {
    if (state) assertState(state);
    if (!bug || !componentIds.includes(bug.component))
      throw new RangeError('Unknown bug component.');
    if (state && unjudged(bug, state))
      return freeze({
        title: 'Not yet judged',
        subtitle: 'Will it clear, or will it stay?',
      });
    // A story with its own subtitle replaces the component's caption.
    const story = state && storyOf(bug, state);
    if (story?.subtitle)
      return freeze({ title: story.title, subtitle: story.subtitle });
    const { title, subtitle } = COMPONENTS.find((c) => c.id === bug.component)
      .captions[bug.kind === 'clearable' ? 'clearable' : 'persistent'];
    return freeze({ title, subtitle });
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
    // Until the call is made, the finding stands in for the story.
    const waiting = unjudged(current, state);
    const reason = waiting
      ? detail.finding
      : (repairPending(state, current.component) &&
          detail.reasonBeforeRepair) ||
        detail.reason;
    return freeze({
      component: c.id,
      label: c.label,
      score: scores(state)[c.id],
      title: waiting ? detail.finding : detail.title,
      reason,
      action: waiting
        ? 'Predict whether it will clear or stay'
        : current.cleared
          ? 'Resolved within this example'
          : detail.action,
      status: waiting
        ? 'Not yet judged'
        : current.cleared
          ? 'Cleared in this example'
          : current.kind === 'clearable'
            ? 'Available repair'
            : 'Unresolved with these tools',
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
  const DEBRIEF_STATUSES = freeze([
    { id: 'unjudged', heading: 'Not yet judged' },
    { id: 'repairable', heading: 'Still repairable' },
    { id: 'persistent', heading: 'Unresolved with these tools' },
    { id: 'repaired', heading: 'Repaired this round' },
  ]);
  const points = (n) => n + ' Bleile point' + (n === 1 ? '' : 's');
  const statusOf = (bug, state) =>
    unjudged(bug, state)
      ? 'unjudged'
      : bug.cleared
        ? 'repaired'
        : bug.kind === 'clearable'
          ? 'repairable'
          : 'persistent';
  const storiesOf = (source) =>
    Object.entries(source.concerns).flatMap(([component, stories]) =>
      Object.entries(stories).map(([kind, story]) => ({
        key: component + '-' + kind,
        kind,
        story,
      })),
    );
  // The debrief is read from the bugs as they are now: their component, kind
  // and cleared flag. Bugs that tell the same story share one row.
  function debrief(state) {
    assertState(state);
    const source = config(state.scenario),
      rows = new Map();
    const tally = () => ({
      ...(state.predictions && { unjudged: 0 }),
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
          title:
            status === 'repaired'
              ? source.concerns[bug.component].clearable.action
              : detail.title,
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
    const list = [...rows.values()],
      complete = counts.repairable === 0 && !counts.unjudged;
    const made = storiesOf(source).filter((s) => state.predictions?.[s.key]);
    const summary = counts.unjudged
      ? points(counts.unjudged) + ' still await your prediction.'
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
      study: { title: source.title, subtitle: source.subtitle },
      verdict: verdict(state),
      remaining: (counts.unjudged || 0) + counts.repairable + counts.persistent,
      counts,
      complete,
      summary,
      pointsNote: POINTS_NOTE,
      ...(state.predictions && {
        predictions: {
          total: storiesOf(source).filter((s) => s.story.finding).length,
          made: made.length,
          correct: made.filter((s) => state.predictions[s.key] === s.kind)
            .length,
        },
      }),
      groups: DEBRIEF_STATUSES.filter((s) => s.id in counts).map((s) => ({
        ...s,
        points: counts[s.id],
        rows: list.filter((r) => r.status === s.id),
      })),
    });
  }

  function transition(state, id, kind, guess) {
    assertState(state);
    const bug = state.bugs.find((b) => b.id === id);
    if (!bug) throw new RangeError('Unknown bug: ' + id);
    const waiting = unjudged(bug, state);
    if (
      (kind === 'reveal' && bug.seen) ||
      (kind === 'clear' &&
        (bug.cleared || !bug.seen || bug.kind !== 'clearable' || waiting)) ||
      (kind === 'predict' && (!bug.seen || !waiting))
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
    const text = getBugText(
      bug,
      predictions ? { ...state, predictions } : state,
    );
    const event = {
      kind,
      bugId: id,
      component: bug.component,
      delta: kind === 'clear' ? -1 : 0,
      before,
      after: before - (kind === 'clear' ? 1 : 0),
      ...text,
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
  // One call settles every bug of that story, and it cannot be changed.
  function predict(state, id, guess) {
    if (!KINDS.includes(guess))
      throw new RangeError('Unknown prediction: ' + guess);
    return transition(state, id, 'predict', guess);
  }
  function verdict(state) {
    assertState(state);
    // The verdict would give calls away, so it waits for them.
    if (state.bugs.some((b) => unjudged(b, state)))
      return freeze({
        heading: 'Your calls come first',
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
    awaitsPrediction,
    verdict,
    getBugText,
    getBugDetails,
    debrief,
  });
});
