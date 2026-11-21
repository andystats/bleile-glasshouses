(function (root, factory) {
  'use strict';
  const api = factory();
  root.BleileContent = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Everything the game says about the components and the three studies is
  // here. game-model.js holds the rules.
  const ROADMAP_BASE =
    'https://ishuryak.github.io/causal-roadmap-primer/preview/';

  // Each component points at the roadmap step where its assumption is argued.
  // Its captions are the general spotlight text for a blue (clearable) and a
  // coral (persistent) bug.
  const COMPONENTS = [
    {
      id: 'question',
      label: 'Research question',
      short: 'Question',
      definition:
        'Specify the people, treatment strategies, outcome and time horizon you want to compare.',
      step: { number: 1, name: 'Question', anchor: 'question' },
      captions: {
        clearable: {
          title: 'Clarify the question',
          subtitle: 'Specify the intended comparison.',
        },
        persistent: {
          title: 'The question is underspecified',
          subtitle: 'Needs a clearer target.',
        },
      },
    },
    {
      id: 'design',
      label: 'Study design',
      short: 'Design',
      definition:
        'Align eligibility, treatment assignment and follow-up so the records represent the comparison you intended.',
      step: { number: 1, name: 'Target trial', anchor: 'trial' },
      captions: {
        clearable: {
          title: 'Check the study timeline',
          subtitle: 'Align eligibility and follow-up.',
        },
        persistent: {
          title: 'A gap in the study design',
          subtitle: 'Needs a different design or argument.',
        },
      },
    },
    {
      id: 'confounding',
      label: 'Confounding',
      short: 'Confounding',
      definition:
        'Common causes of treatment choice and survival can make the groups differ before treatment. Important causes may be unrecorded.',
      step: { number: 2, name: 'Causal diagram', anchor: 'dag' },
      captions: {
        clearable: {
          title: 'Recover pretreatment records',
          subtitle: 'An important common cause is now recorded.',
        },
        persistent: {
          title: 'Unmeasured common causes',
          subtitle: 'Needs more evidence or stronger assumptions.',
        },
      },
    },
    {
      id: 'positivity',
      label: 'Treatment overlap',
      short: 'Positivity',
      definition:
        'Both treatment options must be possible for the people in the question. Sparse or missing comparisons leave parts of that question unsupported.',
      step: { number: 4, name: 'Identification', anchor: 'identify' },
      captions: {
        clearable: {
          title: 'Review the comparison',
          subtitle: 'A different question needs its own assessment.',
        },
        persistent: {
          title: 'Missing treatment comparisons',
          subtitle: 'Needs comparison data or a new question.',
        },
      },
    },
    {
      id: 'consistency',
      label: 'Treatment definition',
      short: 'Consistency',
      definition:
        'The treatment labels must correspond to the strategies being compared, with relevant versions of treatment specified.',
      step: { number: 4, name: 'Identification', anchor: 'identify' },
      captions: {
        clearable: {
          title: 'Resolve treatment coding',
          subtitle: 'Clarify the recorded treatment versions.',
        },
        persistent: {
          title: 'Ambiguous treatment versions',
          subtitle: 'Needs a defensible treatment definition.',
        },
      },
    },
    {
      id: 'measurement',
      label: 'Measurement',
      short: 'Measurement',
      definition:
        'Check that health, treatment and outcomes are recorded accurately, at the right times and with usable definitions.',
      step: { number: 3, name: 'Observed data', anchor: 'observed-data' },
      captions: {
        clearable: {
          title: 'Validate the measurements',
          subtitle: 'Check source records and timing.',
        },
        persistent: {
          title: 'Unresolved measurement error',
          subtitle: 'Needs validation beyond these records.',
        },
      },
    },
    {
      id: 'censoring',
      label: 'Follow-up',
      short: 'Censoring',
      definition:
        'When outcomes become unavailable, explain how the remaining records can represent those lost to follow-up.',
      step: { number: 4, name: 'Identification', anchor: 'identify' },
      captions: {
        clearable: {
          title: 'Recover follow-up',
          subtitle: 'Retrieve the available outcome records.',
        },
        persistent: {
          title: 'Incomplete follow-up',
          subtitle: 'Needs evidence about the people lost.',
        },
      },
    },
    {
      id: 'estimation',
      label: 'Estimation',
      short: 'Estimation',
      definition:
        'Choose an estimator for the target quantity and check its fit, stability and uncertainty.',
      step: { number: 6, name: 'Estimators', anchor: 'estimators' },
      captions: {
        clearable: {
          title: 'Check the analysis',
          subtitle: 'Examine fit and uncertainty.',
        },
        persistent: {
          title: 'Uncertain analytic fit',
          subtitle: 'Needs further model checks.',
        },
      },
    },
    {
      id: 'sensitivity',
      label: 'Sensitivity analysis',
      short: 'Sensitivity',
      definition:
        'Ask how the conclusion changes under plausible departures from the assumptions. A reassuring check covers only the departures examined.',
      step: { number: 7, name: 'Checks', anchor: 'checks' },
      captions: {
        clearable: {
          title: 'Test the bias scenarios',
          subtitle: 'Only the specified departures are checked.',
        },
        persistent: {
          title: 'Untested departures remain',
          subtitle: 'Needs a broader sensitivity argument.',
        },
      },
    },
    {
      id: 'transport',
      label: 'Applicability elsewhere',
      short: 'Transport',
      definition:
        'Applying a result to different people or settings needs an argument about which differences matter for the effect.',
      step: { number: 8, name: 'Causal verdict', anchor: 'causal-verdict' },
      captions: {
        clearable: {
          title: 'Check the new setting',
          subtitle: 'Reassess who the result can describe.',
        },
        persistent: {
          title: 'A different population',
          subtitle: 'Needs a separate transport argument.',
        },
      },
    },
  ];

  // These profiles and recoveries are stipulated teaching scenarios. A color
  // describes what the available investigation can address, not a universal
  // property of a causal assumption or a measured amount of bias.
  //
  // Each study lists its concerns by component and color. The stories are
  // fictional facts of these three worked examples.
  //   points: the number of bugs telling this story, one Bleile point each.
  //     A component's score is the sum over both colors, at most 10.
  //   title, reason, action: the inspection card and the round review.
  //   subtitle (optional): with the title, replaces the component's caption.
  //   reasonBeforeRepair (optional, coral only): replaces the reason while a
  //     blue bug of the same component is still uncleared.
  // A study shows the first verdict that applies. A verdict with untilRepaired
  // follows that component's repair itself, not a point total; the last
  // verdict always applies.
  const SCENARIOS = [
    {
      id: 'rct',
      title: 'The trial',
      subtitle: 'A well-run randomized study',
      card: { heading: 'Randomized', subtitle: 'Carefully designed' },
      background: '#081923',
      verdicts: [
        {
          heading: 'Strong starting design',
          subtitle: 'Follow-up and applicability still matter.',
        },
      ],
      concerns: {
        measurement: {
          clearable: {
            points: 1,
            title: 'A survival-code discrepancy',
            reason:
              'One-year survival codes do not fully agree with the source records. The source audit can resolve the discrepancy in this trial.',
            action: 'Audit the survival codes',
          },
        },
        censoring: {
          persistent: {
            points: 1,
            title: 'A few outcomes are unavailable',
            reason:
              'Some randomized patients left follow-up before one year. Their survival outcomes are not in the available records.',
            action: 'Obtain follow-up or justify the missingness assumption',
          },
        },
        sensitivity: {
          clearable: {
            points: 1,
            title: 'The missing-outcome check is unfinished',
            reason:
              'The trial has not yet checked its specified missing-outcome scenarios. The stipulated check is reassuring within those bounds.',
            action: 'Check the specified scenarios',
          },
        },
        transport: {
          persistent: {
            points: 2,
            title: 'The trial enrolled a selected population',
            reason:
              'This trial excluded frailer patients treated in routine care. Randomization within the trial does not establish the effect for those patients.',
            action: 'Build a separate transport argument',
          },
        },
      },
    },
    {
      id: 'rwd',
      title: 'The records',
      subtitle: 'A carefully designed observational study',
      card: { heading: 'Observational', subtitle: 'Recoverable information' },
      background: '#07121b',
      verdicts: [
        {
          untilRepaired: 'confounding',
          heading: 'Confounding obscures the comparison',
          subtitle: 'Recover information about treatment choice.',
        },
        {
          heading: 'Missing comparisons remain',
          subtitle:
            'Some subgroups still lack support; recovering confounders does not repair positivity.',
        },
      ],
      concerns: {
        question: {
          persistent: {
            points: 1,
            title: 'A few eligibility cases need review',
            subtitle: 'The population and one-year contrast are specified.',
            reason:
              'The protocol specifies eligible patients, Treatment X versus usual care, and the difference in one-year survival. A small set of borderline eligibility cases still needs review.',
            action: 'Adjudicate the remaining eligibility cases',
          },
        },
        design: {
          persistent: {
            points: 1,
            title: 'A few decision dates need review',
            subtitle: 'The study otherwise aligns time zero.',
            reason:
              'Eligibility, treatment assignment and follow-up start at the recorded treatment decision for both strategies. A few uncertain decision dates still need adjudication.',
            action: 'Review the remaining uncertain dates',
          },
        },
        confounding: {
          clearable: {
            points: 3,
            title: 'Pretreatment function can be recovered',
            reason:
              'Most baseline factors are recorded, but performance status is absent from the analysis and recoverable from pretreatment charts. In this example it helps explain both treatment choice and one-year survival.',
            action: 'Recover pretreatment performance status',
          },
          persistent: {
            points: 3,
            title: 'Other common causes are unrecorded',
            reason:
              'The recovered performance status does not capture every shared cause of treatment choice and survival. Other clinically relevant baseline differences remain unrecorded.',
            reasonBeforeRepair:
              'Recovering performance status would still leave other shared causes of treatment choice and survival unresolved. Other clinically relevant baseline differences remain unrecorded.',
            action: 'Seek additional evidence or justify the assumption',
          },
        },
        positivity: {
          persistent: {
            points: 4,
            title: 'A few subgroups have no comparison',
            reason:
              'Most patients have both options represented, but a few subgroups appear under only one treatment in these records. Recovering performance status does not create the missing comparison.',
            action: 'Seek comparison data or reassess the subgroup question',
          },
        },
        consistency: {
          persistent: {
            points: 1,
            title: 'A few treatment versions need review',
            subtitle: 'The treatment strategies are mostly consistent.',
            reason:
              'The protocol defines Treatment X and usual care consistently across clinics. A few changes in dose or schedule still need interpretation against those definitions.',
            action: 'Review the remaining treatment-version cases',
          },
        },
        measurement: {
          clearable: {
            points: 1,
            title: 'One validation check remains',
            reason:
              'Most coding and timing checks are complete. Available source charts can resolve the remaining specified discrepancy and confirm pretreatment timing.',
            action: 'Complete the source-record validation',
          },
          persistent: {
            points: 2,
            title: 'A limited validation gap remains',
            reason:
              'Most health and survival records have been checked, but a small set lacks source documentation. Auditing the available charts does not validate those missing sources.',
            action: 'Obtain validation for the remaining records',
          },
        },
        censoring: {
          persistent: {
            points: 2,
            title: 'Follow-up is nearly complete',
            reason:
              'One-year survival is known for most patients. A small group left follow-up, and the remaining records do not establish how their outcomes compare with those retained.',
            action: 'Recover the missing outcomes or assess their impact',
          },
        },
        estimation: {
          persistent: {
            points: 2,
            title: 'The main analysis has been checked',
            reason:
              'Basic fit and uncertainty checks are complete for the main comparison. Estimates in small subgroups remain sensitive to modeling choices.',
            action: 'Check stability in the sparse subgroups',
          },
        },
        sensitivity: {
          clearable: {
            points: 1,
            title: 'Specified bias scenarios are unchecked',
            reason:
              'The analysis has not yet examined its prespecified departures from the assumptions. In this example the checked range gives reassuring results.',
            action: 'Examine the specified bias scenarios',
          },
          persistent: {
            points: 1,
            title: 'Other departures remain untested',
            reason:
              'The reassuring sensitivity check covers only its specified scenarios. Larger or different unmeasured differences could still change the interpretation.',
            reasonBeforeRepair:
              'The planned sensitivity check covers only its specified scenarios. Larger or different unmeasured differences could still change the interpretation.',
            action: 'Broaden the sensitivity argument',
          },
        },
        transport: {
          persistent: {
            points: 2,
            title: 'Transfer beyond these clinics needs review',
            reason:
              'These records come from selected clinics with a defined study population. Applying the one-year comparison in other settings still needs evidence about relevant differences.',
            action: 'Assess the intended new population',
          },
        },
      },
    },
    {
      id: 'poor',
      title: 'The tangle',
      subtitle: 'A poorly specified and poorly designed study',
      card: { heading: 'Poorly specified', subtitle: 'Gaps throughout' },
      background: '#10111c',
      verdicts: [
        {
          heading: 'Fundamental gaps remain',
          subtitle: 'Better records cannot repair this design.',
        },
      ],
      concerns: {
        question: {
          persistent: {
            points: 10,
            title: 'The study never settled its target',
            reason:
              'Eligibility, Treatment X, usual care and the start of the one-year survival window were chosen inconsistently. The reported comparison has no stable target.',
            action: 'Specify a coherent question and reassess',
          },
        },
        design: {
          persistent: {
            points: 10,
            title: 'Treatment is assigned after follow-up starts',
            reason:
              'Patients are labelled treated if they later receive Treatment X, while follow-up starts at clinic entry. Survival before treatment is therefore built into group assignment.',
            action: 'Redesign time zero and treatment assignment',
          },
        },
        confounding: {
          clearable: {
            points: 6,
            title: 'Baseline charts were left unused',
            reason:
              'Pretreatment performance status is missing from the analysis even though some charts contain it. Recovering it can reduce this concern without repairing the study timeline.',
            action: 'Recover the available baseline charts',
          },
          persistent: {
            points: 4,
            title: 'Treatment decisions remain poorly explained',
            reason:
              'Important reasons for choosing Treatment X were never recorded. Recovering the available charts leaves other common causes of treatment and survival unresolved.',
            action: 'Obtain new evidence about treatment decisions',
          },
        },
        positivity: {
          persistent: {
            points: 10,
            title: 'The groups scarcely overlap',
            reason:
              'Treatment X is concentrated in patient profiles that have no usual-care counterparts in these records. Better coding cannot supply those missing comparisons.',
            action: 'Collect comparison data or redefine the question',
          },
        },
        consistency: {
          clearable: {
            points: 4,
            title: 'Several treatment codes can be untangled',
            reason:
              'Some entries combine different Treatment X regimens, but source prescriptions identify their dose and schedule. These available records can resolve part of the ambiguity.',
            action: 'Recover dose and schedule from prescriptions',
          },
          persistent: {
            points: 5,
            title: 'Other treatment versions remain ambiguous',
            reason:
              'Some prescriptions are missing and usual care was never specified consistently. Resolving available codes does not establish a coherent treatment strategy.',
            action: 'Define strategies and obtain missing treatment detail',
          },
        },
        measurement: {
          clearable: {
            points: 4,
            title: 'Source records can fix some coding errors',
            reason:
              'Several health and survival codes conflict with source charts that are still available. A chart audit can correct those documented errors.',
            action: 'Audit the available source charts',
          },
          persistent: {
            points: 5,
            title: 'Much of the measurement cannot be checked',
            reason:
              'Other outcomes and baseline health measures lack source documentation or reliable dates. A partial chart audit cannot validate those records.',
            action: 'Obtain reliable measurement and timing data',
          },
        },
        censoring: {
          persistent: {
            points: 9,
            title: 'Loss to follow-up is extensive',
            reason:
              'Many patients vanish from the dataset before one-year survival is known. The study did not record why they left or obtain outcomes elsewhere.',
            action: 'Recover follow-up and investigate the losses',
          },
        },
        estimation: {
          persistent: {
            points: 9,
            title: 'The model does not match the intended comparison',
            reason:
              'The analysis pools incompatible follow-up windows and extrapolates across sparse treatment groups. A precise model output would not repair those design gaps.',
            action: 'Rebuild the design before reassessing the estimator',
          },
        },
        sensitivity: {
          clearable: {
            points: 2,
            title: 'A limited bias check is available',
            reason:
              'The team can examine a few prespecified coding and confounding scenarios. The stipulated results narrow concern within that range only.',
            action: 'Run the available bias scenarios',
          },
          persistent: {
            points: 7,
            title: 'Major departures are still unexamined',
            reason:
              'The available sensitivity scenarios do not cover the flawed timeline, missing comparisons or extensive loss to follow-up.',
            action: 'Reassess the unresolved design and bias mechanisms',
          },
        },
        transport: {
          persistent: {
            points: 9,
            title: 'The claim extends far beyond these records',
            reason:
              'The study claims an effect for routine-care patients broadly, but its convenience sample comes from a few atypical clinics. The necessary transport argument is absent.',
            action: 'Name the target population and gather transport evidence',
          },
        },
      },
    },
  ];
  return { ROADMAP_BASE, COMPONENTS, SCENARIOS };
});
