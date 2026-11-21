const { test } = require('node:test');
const assert = require('node:assert/strict');
const G = require('../src/game-model.js');
const clone = (s) => JSON.parse(JSON.stringify(s));
const clearAll = (s, component) =>
  s.bugs
    .filter(
      (b) =>
        b.kind === 'clearable' && (!component || b.component === component),
    )
    .reduce((state, b) => G.clear(G.reveal(state, b.id).state, b.id).state, s);

test('three stipulated scenarios span 5, 24 and 94, with 0–10 per component', () => {
  assert.equal(G.COMPONENTS.length, 10);
  assert.deepEqual(
    G.SCENARIOS.map((c) => G.total(G.initialState(c.id))),
    [5, 24, 94],
  );
  for (const c of G.SCENARIOS) {
    const s = G.initialState(c.id);
    assert.deepEqual(G.scores(s), c.scores);
    assert(Object.values(G.scores(s)).every((v) => v >= 0 && v <= 10));
  }
  assert.match(G.SCENARIOS[0].subtitle, /well-run/i);
  const middle = G.initialState('rwd');
  assert.deepEqual(G.scores(middle), {
    question: 1,
    design: 1,
    confounding: 6,
    positivity: 4,
    consistency: 1,
    measurement: 3,
    censoring: 2,
    estimation: 2,
    sensitivity: 2,
    transport: 2,
  });
  assert.equal(middle.bugs.filter((b) => b.kind === 'clearable').length, 5);
  assert(G.total(middle) < G.total(G.initialState('poor')) / 3);
});

test('every study’s content is complete: each story carries points and text, and the last verdict always applies', () => {
  const kinds = ['clearable', 'persistent'],
    ids = G.COMPONENTS.map((c) => c.id);
  for (const c of G.COMPONENTS) {
    assert(c.label && c.short && c.definition, c.id);
    for (const kind of kinds)
      assert(c.captions[kind].title && c.captions[kind].subtitle, c.id);
  }
  assert.equal(new Set(G.SCENARIOS.map((s) => s.id)).size, G.SCENARIOS.length);
  for (const s of G.SCENARIOS) {
    assert(s.title && s.subtitle && s.card.heading && s.card.subtitle, s.id);
    assert.match(s.background, /^#[0-9a-f]{6}$/, s.id);
    for (const [component, stories] of Object.entries(s.concerns)) {
      const where = s.id + ' ' + component;
      assert(ids.includes(component), where);
      assert(Object.keys(stories).length > 0, where);
      for (const [kind, story] of Object.entries(stories)) {
        assert(kinds.includes(kind), where);
        assert(Number.isInteger(story.points) && story.points > 0, where);
        assert(story.title && story.reason && story.action, where);
        if (story.reasonBeforeRepair)
          assert(kind === 'persistent' && stories.clearable, where);
      }
    }
    const last = s.verdicts.at(-1);
    assert.equal(last.untilRepaired, undefined, s.id);
    for (const v of s.verdicts) {
      assert(v.heading && v.subtitle, s.id);
      if (v !== last) assert(s.concerns[v.untilRepaired]?.clearable, s.id);
    }
  }
});

test('all bugs exist initially but are unseen, and scenario state is independent', () => {
  const a = G.initialState(),
    b = G.initialState('rct'),
    snapshot = clone(b);
  assert(a.bugs.every((b) => !b.seen && !b.cleared));
  const next = G.reveal(a, a.bugs[0].id).state;
  assert.equal(next.bugs.length, a.bugs.length);
  assert.deepEqual(b, snapshot);
  assert.equal(a.bugs[0].seen, false);
  assert.equal(next.bugs[0].seen, true);
});

test('revelation never spawns bugs or increases any concern score', () => {
  for (const c of G.SCENARIOS) {
    let s = G.initialState(c.id),
      before = G.scores(s),
      count = s.bugs.length;
    for (const b of s.bugs) {
      const out = G.reveal(s, b.id);
      s = out.state;
      assert.equal(out.event.delta, 0);
      assert.equal(out.event.before, out.event.after);
      assert.equal(s.bugs.length, count);
      assert.deepEqual(G.scores(s), before);
    }
    assert(s.bugs.every((b) => b.seen));
  }
});

test('unseen and persistent bugs cannot be neutralized', () => {
  const s = G.initialState();
  const blue = s.bugs.find((b) => b.kind === 'clearable'),
    red = s.bugs.find((b) => b.kind === 'persistent');
  assert.equal(G.clear(s, blue.id).event, null);
  assert.strictEqual(G.clear(s, blue.id).state, s);
  const found = G.reveal(s, red.id).state;
  assert.equal(G.clear(found, red.id).event, null);
  assert.equal(G.total(found), 24);
});

test('recoveries produce 24→21→20→19 while positivity stays at 4', () => {
  let s = G.initialState();
  for (const [component, total] of [
    ['confounding', 21],
    ['measurement', 20],
    ['sensitivity', 19],
  ]) {
    s = clearAll(s, component);
    assert.equal(G.total(s), total);
    assert.equal(G.scores(s).positivity, 4);
  }
  assert.equal(G.scores(s).confounding, 3);
  assert.match(G.verdict(s).heading, /Missing comparisons/);
});

test('component scores are nonfungible: each neutralization only changes its own component', () => {
  let s = G.initialState();
  for (const bug of s.bugs.filter((b) => b.kind === 'clearable')) {
    s = G.reveal(s, bug.id).state;
    const before = G.scores(s),
      out = G.clear(s, bug.id);
    s = out.state;
    assert.equal(out.event.delta, -1);
    assert.equal(out.event.component, bug.component);
    for (const c of G.COMPONENTS)
      assert.equal(
        G.scores(s)[c.id],
        before[c.id] - (c.id === bug.component ? 1 : 0),
      );
  }
});

test('revealing or clearing twice has no duplicate event, history or points', () => {
  let s = G.initialState(),
    b = s.bugs.find((b) => b.kind === 'clearable');
  s = G.reveal(s, b.id).state;
  assert.strictEqual(G.reveal(s, b.id).state, s);
  assert.equal(G.reveal(s, b.id).event, null);
  s = G.clear(s, b.id).state;
  assert.equal(G.total(s), 23);
  assert.equal(s.history.length, 2);
  assert.strictEqual(G.clear(s, b.id).state, s);
  assert.equal(G.clear(s, b.id).event, null);
});

test('all blue bugs cleared leaves red concerns in every scenario', () => {
  for (const [id, expected] of [
    ['rct', 3],
    ['rwd', 19],
    ['poor', 78],
  ]) {
    const s = clearAll(G.initialState(id));
    assert.equal(G.total(s), expected);
    assert(
      s.bugs.filter((b) => !b.cleared).every((b) => b.kind === 'persistent'),
    );
    assert(Object.values(G.scores(s)).every((v) => v >= 0 && v <= 10));
  }
});

test('scenario and event objects are immutable without changing caller values', () => {
  const s = clone(G.initialState()),
    before = clone(s),
    id = s.bugs.find((b) => b.kind === 'clearable').id;
  const out = G.reveal(s, id);
  assert.deepEqual(s, before);
  assert(Object.isFrozen(out));
  assert(Object.isFrozen(out.state));
  assert(Object.isFrozen(out.state.bugs));
  assert(Object.isFrozen(out.state.bugs[0]));
  assert(Object.isFrozen(out.event));
  assert(Object.isFrozen(G.SCENARIOS[0].scores));
});

test('verdicts retain residual concerns and do not certify a treatment effect', () => {
  assert.match(G.verdict(G.initialState()).heading, /Confounding/);
  let partial = G.initialState();
  for (const b of partial.bugs
    .filter((b) => b.component === 'confounding' && b.kind === 'clearable')
    .slice(0, 2))
    partial = G.clear(G.reveal(partial, b.id).state, b.id).state;
  assert.equal(G.scores(partial).confounding, 4);
  assert.match(G.verdict(partial).heading, /Confounding/);
  assert.match(
    G.verdict(clearAll(partial, 'confounding')).subtitle,
    /Some subgroups still lack support/,
  );
  assert.match(
    G.verdict(clearAll(G.initialState())).subtitle,
    /does not repair positivity/,
  );
  assert.match(
    G.verdict(clearAll(G.initialState('rct'))).subtitle,
    /Follow-up and applicability/,
  );
  assert.match(
    G.verdict(clearAll(G.initialState('poor'))).subtitle,
    /cannot repair this design/,
  );
  const s = G.initialState(),
    b = s.bugs.find(
      (b) => b.component === 'sensitivity' && b.kind === 'clearable',
    );
  assert.match(G.getBugText(b, s).subtitle, /Only the specified departures/);
});

test('a story with its own subtitle replaces the component’s caption, in that study only', () => {
  const records = G.initialState(),
    poor = G.initialState('poor');
  const question = (s) => s.bugs.find((b) => b.component === 'question');
  assert.deepEqual(G.getBugText(question(records), records), {
    title: 'A few eligibility cases need review',
    subtitle: 'The population and one-year contrast are specified.',
  });
  assert.deepEqual(G.getBugText(question(poor), poor), {
    title: 'The question is underspecified',
    subtitle: 'Needs a clearer target.',
  });
  assert.deepEqual(
    G.getBugText(question(records)),
    G.getBugText(question(poor), poor),
  );
});

test('unknown scenarios, unknown bugs and malformed state are rejected', () => {
  assert.throws(() => G.initialState('imaginary'), /Unknown scenario/);
  assert.throws(() => G.reveal(G.initialState(), 'imaginary'), /Unknown bug/);
  const s = clone(G.initialState());
  s.bugs[0].cleared = true;
  assert.throws(() => G.total(s), /revealed, clearable/);
  assert.throws(() => G.scores({}), /Invalid game state/);
});

test('every active scenario/component has a specific immutable hover story', () => {
  for (const scenario of G.SCENARIOS) {
    const state = G.initialState(scenario.id);
    for (const bug of state.bugs) {
      const detail = G.getBugDetails(bug, state);
      assert.deepEqual(Object.keys(detail), [
        'component',
        'label',
        'score',
        'title',
        'reason',
        'action',
        'status',
        'sizeNote',
      ]);
      assert.equal(detail.component, bug.component);
      assert.equal(detail.score, scenario.scores[bug.component]);
      assert(
        detail.title.length > 5 &&
          detail.reason.length > 40 &&
          detail.action.length > 5,
      );
      assert.match(detail.sizeNote, /each bug is one Bleile point/);
      assert(Object.isFrozen(detail));
    }
  }
});

test('hover details follow the current component score without rewriting other components', () => {
  const before = G.initialState(),
    blue = before.bugs.find(
      (b) => b.component === 'confounding' && b.kind === 'clearable',
    );
  const red = before.bugs.find(
    (b) => b.component === 'confounding' && b.kind === 'persistent',
  );
  const positivity = before.bugs.find((b) => b.component === 'positivity');
  assert.equal(G.getBugDetails(blue, before).score, 6);
  assert.match(G.getBugDetails(blue, before).reason, /performance status/i);
  const after = clearAll(before, 'confounding');
  assert.equal(G.getBugDetails(red, after).score, 3);
  assert.match(
    G.getBugDetails(red, after).reason,
    /does not capture every shared cause/,
  );
  assert.equal(G.getBugDetails(positivity, after).score, 4);
  assert.match(
    G.getBugDetails(positivity, after).reason,
    /does not create the missing comparison/,
  );
  assert.equal(G.getBugDetails(blue, after).status, 'Cleared in this example');
  assert.equal(G.getBugDetails(blue, after).score, 3);
});

test('hover stories distinguish scenario-specific study failures from generic definitions', () => {
  const trial = G.initialState('rct'),
    records = G.initialState('rwd'),
    poor = G.initialState('poor');
  const story = (s, c, kind) =>
    G.getBugDetails(
      s.bugs.find((b) => b.component === c && (!kind || b.kind === kind)),
      s,
    );
  assert.match(story(trial, 'transport').reason, /excluded frailer patients/);
  assert.match(story(records, 'transport').reason, /selected clinics/);
  assert.match(story(poor, 'transport').reason, /convenience sample/);
  assert.match(
    story(records, 'design').reason,
    /start at the recorded treatment decision/,
  );
  assert.match(
    story(records, 'question').reason,
    /protocol specifies eligible patients/i,
  );
  assert.match(
    story(records, 'consistency').reason,
    /defines Treatment X and usual care consistently/,
  );
  assert.doesNotMatch(
    story(records, 'design').reason,
    /do not.*line up|need alignment/,
  );
  assert.match(story(poor, 'design').reason, /later receive Treatment X/);
  assert.notEqual(
    story(records, 'confounding', 'clearable').reason,
    story(records, 'confounding', 'persistent').reason,
  );
  assert.notEqual(
    story(poor, 'measurement', 'clearable').action,
    story(poor, 'measurement', 'persistent').action,
  );
});

test('hover actions distinguish available repairs from remaining assumptions and preserve sensitivity scope', () => {
  for (const scenario of G.SCENARIOS) {
    const state = G.initialState(scenario.id);
    for (const bug of state.bugs) {
      const detail = G.getBugDetails(bug, state);
      assert.equal(
        detail.status,
        bug.kind === 'clearable'
          ? 'Available repair'
          : 'Unresolved with these tools',
      );
      if (bug.component === 'sensitivity' && bug.kind === 'clearable')
        assert.match(detail.reason, /bounds|within that range|checked range/);
    }
  }
  const state = clearAll(G.initialState('poor'));
  const design = state.bugs.find((b) => b.component === 'design');
  assert.equal(G.getBugDetails(design, state).score, 10);
  assert.match(
    G.getBugDetails(design, state).reason,
    /Survival before treatment/,
  );
});

test('hover detail rejects unknown bugs, altered component identity, unsupported kinds and invalid state', () => {
  const s = G.initialState(),
    b = s.bugs[0];
  assert.throws(
    () =>
      G.getBugDetails(
        { id: 'unknown', component: 'question', kind: 'persistent' },
        s,
      ),
    /Unknown bug/,
  );
  assert.throws(
    () => G.getBugDetails({ ...b, component: 'confounding' }, s),
    /Unknown bug/,
  );
  assert.throws(
    () => G.getBugDetails({ ...b, kind: 'clearable' }, s),
    /Unknown bug/,
  );
  assert.throws(() => G.getBugDetails(null, s), /Unknown bug/);
  assert.throws(
    () => G.getBugDetails(b, { scenario: 'unknown', bugs: [], history: [] }),
    /Unknown scenario/,
  );
});

test('persistent hover stories distinguish planned work from completed recovery and checks', () => {
  const initial = G.initialState();
  for (const [component, beforeText, afterText] of [
    [
      'confounding',
      /Recovering performance status would still leave/,
      /The recovered performance status/,
    ],
    [
      'sensitivity',
      /The planned sensitivity check/,
      /The reassuring sensitivity check/,
    ],
  ]) {
    const red = initial.bugs.find(
      (b) => b.component === component && b.kind === 'persistent',
    );
    assert.match(G.getBugDetails(red, initial).reason, beforeText);
    const first = initial.bugs.find(
      (b) => b.component === component && b.kind === 'clearable',
    );
    const partial = G.clear(G.reveal(initial, first.id).state, first.id).state;
    const hasUnfinished = partial.bugs.some(
      (b) => b.component === component && b.kind === 'clearable' && !b.cleared,
    );
    assert.match(
      G.getBugDetails(red, partial).reason,
      hasUnfinished ? beforeText : afterText,
    );
    const complete = clearAll(initial, component);
    assert.match(G.getBugDetails(red, complete).reason, afterText);
    assert.doesNotMatch(G.getBugDetails(red, complete).reason, beforeText);
  }
  const measurementOnly = clearAll(initial, 'measurement');
  const sensitivity = initial.bugs.find(
    (b) => b.component === 'sensitivity' && b.kind === 'persistent',
  );
  assert.match(G.getBugDetails(sensitivity, measurementOnly).reason, /planned/);
});

const statusOf = (b) =>
  b.cleared ? 'repaired' : b.kind === 'clearable' ? 'repairable' : 'persistent';
const group = (d, id) => d.groups.find((g) => g.id === id);
const row = (d, status, component) =>
  group(d, status).rows.find((r) => r.component === component);
const allRows = (d) => d.groups.flatMap((g) => g.rows);
// Every row must restate the existing hover story for bugs with that component and status.
function assertRowsMatchState(d, s) {
  const rows = allRows(d);
  assert.equal(
    new Set(rows.map((r) => r.component + '|' + r.status)).size,
    rows.length,
    'one row per component and status',
  );
  assert.equal(
    rows.reduce((n, r) => n + r.points, 0),
    s.bugs.length,
  );
  for (const g of d.groups) {
    assert.equal(g.points, s.bugs.filter((b) => statusOf(b) === g.id).length);
    for (const r of g.rows) {
      assert.equal(r.status, g.id);
      const bugs = s.bugs.filter(
        (b) => b.component === r.component && statusOf(b) === r.status,
      );
      assert(bugs.length > 0);
      assert.equal(r.points, bugs.length);
      assert.equal(r.found, bugs.filter((b) => b.seen).length);
      const detail = G.getBugDetails(bugs[0], s),
        component = G.COMPONENTS.find((c) => c.id === r.component);
      if (r.status !== 'repaired') assert.equal(r.title, detail.title);
      assert.equal(r.reason, detail.reason);
      assert.equal(r.action, detail.action);
      assert.equal(r.label, component.label);
      assert.equal(r.matters, component.definition);
      assert.deepEqual(r.step, G.ROADMAP_STEPS[r.component]);
      for (const status of ['repairable', 'repaired', 'persistent'])
        assert.equal(
          r.sameComponent[status],
          s.bugs.filter(
            (b) => b.component === r.component && statusOf(b) === status,
          ).length,
        );
    }
  }
}

test('initial debrief lists every study’s concerns once per component and status, with nothing repaired', () => {
  for (const c of G.SCENARIOS) {
    const s = G.initialState(c.id),
      d = G.debrief(s),
      clearable = Object.values(c.clearable).reduce((a, b) => a + b, 0);
    assert.equal(d.scenario, c.id);
    assert.equal(d.study.title, c.title);
    assert.equal(d.study.subtitle, c.subtitle);
    assert.deepEqual(d.verdict, G.verdict(s));
    assert.deepEqual(d.counts, {
      repairable: clearable,
      repaired: 0,
      persistent: G.total(s) - clearable,
    });
    assert.equal(d.remaining, G.total(s));
    assert.equal(d.complete, false);
    assert.deepEqual(
      d.groups.map((g) => g.id),
      ['repairable', 'persistent', 'repaired'],
    );
    assert.deepEqual(group(d, 'repaired').rows, []);
    assert.match(d.summary, /No repairs yet/);
    assert(allRows(d).every((r) => r.found === 0));
    assertRowsMatchState(d, s);
  }
  const trial = G.debrief(G.initialState('rct'));
  assert.deepEqual(
    allRows(trial).map((r) => [r.component, r.status, r.points]),
    [
      ['measurement', 'repairable', 1],
      ['sensitivity', 'repairable', 1],
      ['censoring', 'persistent', 1],
      ['transport', 'persistent', 2],
    ],
  );
  assert.match(
    row(trial, 'persistent', 'transport').reason,
    /excluded frailer patients/,
  );
});

test('partial debrief separates repaired, still repairable and persisting points in one component', () => {
  const initial = G.initialState(),
    first = initial.bugs.find(
      (b) => b.component === 'confounding' && b.kind === 'clearable',
    );
  let s = G.clear(G.reveal(initial, first.id).state, first.id).state;
  let d = G.debrief(s);
  assert.deepEqual(d.counts, { repairable: 4, repaired: 1, persistent: 19 });
  assert.equal(d.remaining, 23);
  assert.equal(d.complete, false);
  assert.match(d.summary, /repaired 1 Bleile point so far/);
  assert.equal(row(d, 'repairable', 'confounding').points, 2);
  assert.equal(row(d, 'repaired', 'confounding').points, 1);
  assert.equal(row(d, 'persistent', 'confounding').points, 3);
  assert.deepEqual(row(d, 'repaired', 'confounding').sameComponent, {
    repairable: 2,
    repaired: 1,
    persistent: 3,
  });
  assert.equal(
    row(d, 'repairable', 'confounding').action,
    'Recover pretreatment performance status',
  );
  assert.equal(
    row(d, 'repaired', 'confounding').action,
    'Resolved within this example',
  );
  assert.equal(
    row(d, 'repaired', 'confounding').title,
    'Recover pretreatment performance status',
  );
  assert.match(row(d, 'persistent', 'confounding').reason, /would still leave/);
  assert.equal(group(d, 'repaired').rows.length, 1);
  assert.equal(row(d, 'repaired', 'positivity'), undefined);
  assert.equal(row(d, 'persistent', 'positivity').points, 4);
  assertRowsMatchState(d, s);
  const coral = s.bugs.find(
    (b) => b.component === 'confounding' && b.kind === 'persistent',
  );
  s = G.reveal(s, coral.id).state;
  d = G.debrief(s);
  assert.equal(row(d, 'persistent', 'confounding').found, 1);
  assert.equal(row(d, 'repairable', 'confounding').found, 0);
  assert.deepEqual(d.counts, { repairable: 4, repaired: 1, persistent: 19 });
});

test('closing debrief after all available repairs keeps the persisting rows in every study', () => {
  for (const [id, repaired, persistent] of [
    ['rct', 2, 3],
    ['rwd', 5, 19],
    ['poor', 16, 78],
  ]) {
    const s = clearAll(G.initialState(id)),
      d = G.debrief(s);
    assert.equal(d.complete, true);
    assert.deepEqual(d.counts, { repairable: 0, repaired, persistent });
    assert.equal(d.remaining, persistent);
    assert.equal(d.remaining, G.total(s));
    assert.deepEqual(group(d, 'repairable').rows, []);
    assert.equal(group(d, 'repairable').points, 0);
    assert.match(d.summary, /Every available repair is done/);
    assert(
      group(d, 'repaired').rows.every(
        (r) => r.action === 'Resolved within this example',
      ),
    );
    assert(
      group(d, 'persistent').rows.every(
        (r) => r.action !== 'Resolved within this example',
      ),
    );
    assertRowsMatchState(d, s);
  }
  const trial = G.debrief(clearAll(G.initialState('rct')));
  assert.deepEqual(
    group(trial, 'repaired').rows.map((r) => r.component),
    ['measurement', 'sensitivity'],
  );
  assert.deepEqual(
    group(trial, 'persistent').rows.map((r) => r.component),
    ['censoring', 'transport'],
  );
  assert.equal(row(trial, 'persistent', 'measurement'), undefined);
  const records = G.debrief(clearAll(G.initialState()));
  assert.match(
    row(records, 'persistent', 'confounding').reason,
    /The recovered performance status/,
  );
  assert.equal(row(records, 'repaired', 'confounding').points, 3);
  assert.equal(row(records, 'persistent', 'positivity').points, 4);
  const poor = G.debrief(clearAll(G.initialState('poor')));
  assert.equal(row(poor, 'repaired', 'consistency').points, 4);
  assert.equal(row(poor, 'persistent', 'consistency').points, 5);
  assert.deepEqual(row(poor, 'persistent', 'question').sameComponent, {
    repairable: 0,
    repaired: 0,
    persistent: 10,
  });
  assert.match(
    row(poor, 'persistent', 'design').reason,
    /Survival before treatment/,
  );
});

test('debrief follows the supplied bugs’ kind and cleared flags, not the scenario preset', () => {
  const s = clone(G.initialState()),
    confounding = s.bugs.filter((b) => b.component === 'confounding');
  confounding[3].kind = 'clearable';
  confounding[4].kind = 'clearable';
  for (const b of confounding.slice(0, 2)) {
    b.seen = true;
    b.cleared = true;
  }
  const snapshot = clone(s),
    d = G.debrief(s);
  assert.deepEqual(s, snapshot);
  assert.deepEqual(d.counts, { repairable: 5, repaired: 2, persistent: 17 });
  assert.equal(d.remaining, 22);
  assert.deepEqual(row(d, 'repaired', 'confounding').sameComponent, {
    repairable: 3,
    repaired: 2,
    persistent: 1,
  });
  assert.equal(row(d, 'repairable', 'confounding').points, 3);
  assert.equal(row(d, 'persistent', 'confounding').points, 1);
  assertRowsMatchState(d, s);
  assert.throws(() => G.debrief({}), /Invalid game state/);
});

test('roadmap steps use the eight live anchors and every debrief row links to its step', () => {
  const expected = {
    question: [1, 'question'],
    design: [1, 'trial'],
    confounding: [2, 'dag'],
    measurement: [3, 'observed-data'],
    censoring: [4, 'identify'],
    consistency: [4, 'identify'],
    positivity: [4, 'identify'],
    estimation: [6, 'estimators'],
    sensitivity: [7, 'checks'],
    transport: [8, 'causal-verdict'],
  };
  assert.equal(
    G.ROADMAP_BASE,
    'https://ishuryak.github.io/causal-roadmap-primer/preview/',
  );
  assert.deepEqual(
    Object.keys(G.ROADMAP_STEPS).sort(),
    G.COMPONENTS.map((c) => c.id).sort(),
  );
  for (const [component, [number, anchor]] of Object.entries(expected)) {
    const step = G.ROADMAP_STEPS[component];
    assert.equal(step.number, number);
    assert.equal(step.anchor, anchor);
    assert.equal(step.url, G.ROADMAP_BASE + '#' + anchor);
    assert(step.name.length > 2);
  }
  assert.equal(
    new Set(Object.values(G.ROADMAP_STEPS).map((s) => s.anchor)).size,
    8,
  );
  for (const c of G.SCENARIOS)
    for (const r of allRows(G.debrief(G.initialState(c.id))))
      assert.match(
        r.step.url,
        /^https:\/\/ishuryak\.github\.io\/causal-roadmap-primer\/preview\/#[a-z-]+$/,
      );
});

test('debrief is immutable and says plainly what Bleile points are; no visible dings or Bleiles remain', () => {
  const d = G.debrief(G.initialState('poor'));
  assert(Object.isFrozen(d));
  assert(Object.isFrozen(d.groups));
  assert(Object.isFrozen(group(d, 'persistent').rows[0]));
  assert(Object.isFrozen(d.counts));
  assert.match(d.pointsNote, /^Bleile points are informal game tokens/);
  assert.match(d.pointsNote, /gaps/);
  assert.match(d.pointsNote, /repair/);
  assert.match(d.pointsNote, /do not measure bias or decide the verdict/);
  const fs = require('node:fs'),
    path = require('node:path'),
    read = (file) =>
      fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
  for (const file of [
    'index.html',
    'app.js',
    'game-content.js',
    'game-model.js',
  ]) {
    assert.doesNotMatch(read(file), /\bdings?\b/i, file);
    assert.doesNotMatch(read(file), /Bleiles/, file);
  }
  const html = read('index.html');
  assert.match(html, /<title>Bleile · Glasshouses<\/title>/);
  assert.match(html, /id="profile-open"[^>]*>Review this round/);
  assert.match(html, /Bleile points<br>remaining/);
});
