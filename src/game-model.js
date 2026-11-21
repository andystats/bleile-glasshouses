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
  function initialState(scenario = 'rwd') {
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
    return freeze({ scenario, bugs, history: [] });
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
        !['clearable', 'persistent'].includes(b.kind) ||
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
  function getBugText(bug, state) {
    if (state) assertState(state);
    if (!bug || !componentIds.includes(bug.component))
      throw new RangeError('Unknown bug component.');
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
    const reason =
      (repairPending(state, current.component) && detail.reasonBeforeRepair) ||
      detail.reason;
    return freeze({
      component: c.id,
      label: c.label,
      score: scores(state)[c.id],
      title: detail.title,
      reason,
      action: current.cleared ? 'Resolved within this example' : detail.action,
      status: current.cleared
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
    { id: 'repairable', heading: 'Still repairable' },
    { id: 'persistent', heading: 'Unresolved with these tools' },
    { id: 'repaired', heading: 'Repaired this round' },
  ]);
  const points = (n) => n + ' Bleile point' + (n === 1 ? '' : 's');
  const statusOf = (bug) =>
    bug.cleared
      ? 'repaired'
      : bug.kind === 'clearable'
        ? 'repairable'
        : 'persistent';
  // The debrief is read from the bugs as they are now: their component, kind
  // and cleared flag. Bugs that tell the same story share one row.
  function debrief(state) {
    assertState(state);
    const source = config(state.scenario),
      rows = new Map();
    const counts = { repairable: 0, repaired: 0, persistent: 0 };
    const perComponent = Object.fromEntries(
      componentIds.map((id) => [
        id,
        { repairable: 0, repaired: 0, persistent: 0 },
      ]),
    );
    for (const bug of state.bugs) {
      const status = statusOf(bug),
        key = bug.component + '-' + status;
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
        });
      }
      const row = rows.get(key);
      row.points++;
      if (bug.seen) row.found++;
    }
    const list = [...rows.values()],
      complete = counts.repairable === 0;
    const summary = !complete
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
      remaining: counts.repairable + counts.persistent,
      counts,
      complete,
      summary,
      pointsNote: POINTS_NOTE,
      groups: DEBRIEF_STATUSES.map((s) => ({
        ...s,
        points: counts[s.id],
        rows: list.filter((r) => r.status === s.id),
      })),
    });
  }

  function transition(state, id, kind) {
    assertState(state);
    const bug = state.bugs.find((b) => b.id === id);
    if (!bug) throw new RangeError('Unknown bug: ' + id);
    if (
      (kind === 'reveal' && bug.seen) ||
      (kind === 'clear' &&
        (bug.cleared || !bug.seen || bug.kind !== 'clearable'))
    )
      return freeze({ state, event: null });
    const before = total(state),
      bugs = state.bugs.map((b) =>
        b.id === id
          ? { ...b, seen: true, cleared: kind === 'clear' || b.cleared }
          : { ...b },
      );
    const text = getBugText(bug, state);
    const event = {
      kind,
      bugId: id,
      component: bug.component,
      delta: kind === 'clear' ? -1 : 0,
      before,
      after: before - (kind === 'clear' ? 1 : 0),
      ...text,
    };
    const next = {
      scenario: state.scenario,
      bugs,
      history: [...state.history, event],
    };
    return freeze({ state: next, event });
  }
  const reveal = (state, id) => transition(state, id, 'reveal');
  const clear = (state, id) => transition(state, id, 'clear');
  function verdict(state) {
    assertState(state);
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
    verdict,
    getBugText,
    getBugDetails,
    debrief,
  });
});
