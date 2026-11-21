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
        clearable: 'Clarify the question',
        persistent: 'Needs a clearer target.',
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
        clearable: 'Check the study timeline',
        persistent: 'Needs a different design or argument.',
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
        clearable: 'Recover pretreatment records',
        persistent: 'Needs more evidence or stronger assumptions.',
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
        clearable: 'Review the comparison',
        persistent: 'Needs comparison data or a new question.',
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
        clearable: 'Resolve treatment coding',
        persistent: 'Needs a defensible treatment definition.',
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
        clearable: 'Validate the measurements',
        persistent: 'Needs validation beyond these records.',
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
        clearable: 'Recover follow-up',
        persistent: 'Needs evidence about the people lost.',
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
        clearable: 'Check the analysis',
        persistent: 'Needs further model checks.',
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
        clearable: 'Test the bias scenarios',
        persistent: 'Needs a broader sensitivity argument.',
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
        clearable: 'Check the new setting',
        persistent: 'Needs a separate transport argument.',
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
  //   finding (optional): what the player reads before predicting the color,
  //     in a round played with predictions: on the inspection card, in the
  //     prediction dialog and as the story's row in the round review. It
  //     states the concern without saying whether it clears. A study has one
  //     for every story or for none.
  //   reason, action: the inspection card, the round review and the result
  //     of a prediction.
  //   caption (optional): replaces the component's caption. In a round played
  //     with predictions it waits until its story is predicted.
  //   reasonBeforeRepair (optional, coral only): replaces the reason while a
  //     blue bug of the same component is still uncleared.
  // A study shows the first verdict that applies. A verdict with untilRepaired
  // applies while that component still has an uncleared blue bug; the last
  // verdict has none and always applies.
  const SCENARIOS = [
    {
      id: 'rct',
      title: 'The trial',
      subtitle: 'A well-run randomized study',
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
            reason:
              'One-year survival codes do not fully agree with the source records. The source audit can resolve the discrepancy in this trial.',
            action: 'Audit the survival codes',
          },
        },
        censoring: {
          persistent: {
            points: 1,
            reason:
              'Some randomized patients left follow-up before one year. Their survival outcomes are not in the available records.',
            action: 'Obtain follow-up or justify the missingness assumption',
          },
        },
        sensitivity: {
          clearable: {
            points: 1,
            reason:
              'The trial has not yet checked its specified missing-outcome scenarios. The stipulated check is reassuring within those bounds.',
            action: 'Check the specified scenarios',
          },
        },
        transport: {
          persistent: {
            points: 2,
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
            finding:
              'For a small set of borderline patients, the records do not show whether they met the eligibility criteria.',
            caption: 'The population and one-year contrast are specified.',
            reason:
              'The protocol specifies eligible patients, Treatment X versus usual care, and the difference in one-year survival. For a small set of borderline patients the records do not show whether the criteria were met. Reviewing the same records again cannot settle who belongs in the comparison.',
            action: 'Adjudicate the remaining eligibility cases',
          },
        },
        design: {
          persistent: {
            points: 1,
            finding:
              'For a few patients, the date of the treatment decision is missing or inconsistent in the records.',
            caption: 'The study otherwise aligns time zero.',
            reason:
              'Eligibility, treatment assignment and follow-up start at the recorded treatment decision for both strategies. For a few patients that date is missing or inconsistent in these records. The same records cannot establish when their follow-up should start.',
            action:
              'Establish the remaining decision dates from another source',
          },
        },
        confounding: {
          clearable: {
            points: 3,
            finding:
              'Performance status is absent from the analysis, although the pretreatment charts record it.',
            reason:
              'Most baseline factors are recorded, but performance status is absent from the analysis and recoverable from pretreatment charts. In this example it helps explain both treatment choice and one-year survival.',
            action: 'Recover pretreatment performance status',
          },
          persistent: {
            points: 3,
            finding:
              'Some shared causes of treatment choice and survival were never recorded.',
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
            finding:
              'A few subgroups appear under only one of the two treatments.',
            reason:
              'Most patients have both options represented, but a few subgroups appear under only one treatment in these records. Recovering performance status does not create the missing comparison.',
            action: 'Seek comparison data or reassess the subgroup question',
          },
        },
        consistency: {
          persistent: {
            points: 1,
            finding:
              'A few patients had a change in dose or schedule that the treatment definitions do not address.',
            caption: 'The treatment strategies are mostly consistent.',
            reason:
              'The protocol defines Treatment X and usual care consistently across clinics. A few patients had a change in dose or schedule. Whether that still counts as the same strategy is a decision about the definition, and no record can make it.',
            action: 'Decide which treatment versions each strategy includes',
          },
        },
        measurement: {
          clearable: {
            points: 1,
            finding:
              'One specified coding discrepancy is unchecked, and the source charts for it are on hand.',
            reason:
              'Most coding and timing checks are complete. Available source charts can resolve the remaining specified discrepancy and confirm pretreatment timing.',
            action: 'Complete the source-record validation',
          },
          persistent: {
            points: 2,
            finding:
              'A small set of health and survival records has no source documentation.',
            reason:
              'Most health and survival records have been checked, but a small set lacks source documentation. Auditing the available charts does not validate those missing sources.',
            action: 'Obtain validation for the remaining records',
          },
        },
        censoring: {
          persistent: {
            points: 2,
            finding:
              'A small group left follow-up before one year, and their outcomes are unknown.',
            reason:
              'One-year survival is known for most patients. A small group left follow-up, and the remaining records do not establish how their outcomes compare with those retained.',
            action: 'Recover the missing outcomes or assess their impact',
          },
        },
        estimation: {
          persistent: {
            points: 2,
            finding:
              'Estimates in small subgroups shift with the modeling choices.',
            reason:
              'Basic fit and uncertainty checks are complete for the main comparison. Estimates in small subgroups remain sensitive to modeling choices.',
            action: 'Check stability in the sparse subgroups',
          },
        },
        sensitivity: {
          clearable: {
            points: 1,
            finding:
              'The prespecified bias scenarios have not been examined yet.',
            reason:
              'The analysis has not yet examined its prespecified departures from the assumptions. In this example the checked range gives reassuring results.',
            action: 'Examine the specified bias scenarios',
          },
          persistent: {
            points: 1,
            finding:
              'Bias larger than, or different from, the prespecified scenarios is outside the planned check.',
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
            finding:
              'These records come from selected clinics, and the result may be applied elsewhere.',
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
            reason:
              'Eligibility, Treatment X, usual care and the start of the one-year survival window were chosen inconsistently. The reported comparison has no stable target.',
            action: 'Specify a coherent question and reassess',
          },
        },
        design: {
          persistent: {
            points: 10,
            reason:
              'Patients are labelled treated if they later receive Treatment X, while follow-up starts at clinic entry. Survival before treatment is therefore built into group assignment.',
            action: 'Redesign time zero and treatment assignment',
          },
        },
        confounding: {
          clearable: {
            points: 6,
            reason:
              'Pretreatment performance status is missing from the analysis even though some charts contain it. Recovering it can reduce this concern without repairing the study timeline.',
            action: 'Recover the available baseline charts',
          },
          persistent: {
            points: 4,
            reason:
              'Important reasons for choosing Treatment X were never recorded. Recovering the available charts leaves other common causes of treatment and survival unresolved.',
            action: 'Obtain new evidence about treatment decisions',
          },
        },
        positivity: {
          persistent: {
            points: 10,
            reason:
              'Treatment X is concentrated in patient profiles that have no usual-care counterparts in these records. Better coding cannot supply those missing comparisons.',
            action: 'Collect comparison data or redefine the question',
          },
        },
        consistency: {
          clearable: {
            points: 4,
            reason:
              'Some entries combine different Treatment X regimens, but source prescriptions identify their dose and schedule. These available records can resolve part of the ambiguity.',
            action: 'Recover dose and schedule from prescriptions',
          },
          persistent: {
            points: 5,
            reason:
              'Some prescriptions are missing and usual care was never specified consistently. Resolving available codes does not establish a coherent treatment strategy.',
            action: 'Define strategies and obtain missing treatment detail',
          },
        },
        measurement: {
          clearable: {
            points: 4,
            reason:
              'Several health and survival codes conflict with source charts that are still available. A chart audit can correct those documented errors.',
            action: 'Audit the available source charts',
          },
          persistent: {
            points: 5,
            reason:
              'Other outcomes and baseline health measures lack source documentation or reliable dates. A partial chart audit cannot validate those records.',
            action: 'Obtain reliable measurement and timing data',
          },
        },
        censoring: {
          persistent: {
            points: 9,
            reason:
              'Many patients vanish from the dataset before one-year survival is known. The study did not record why they left or obtain outcomes elsewhere.',
            action: 'Recover follow-up and investigate the losses',
          },
        },
        estimation: {
          persistent: {
            points: 9,
            reason:
              'The analysis pools incompatible follow-up windows and extrapolates across sparse treatment groups. A precise model output would not repair those design gaps.',
            action: 'Rebuild the design before reassessing the estimator',
          },
        },
        sensitivity: {
          clearable: {
            points: 2,
            reason:
              'The team can examine a few prespecified coding and confounding scenarios. The stipulated results narrow concern within that range only.',
            action: 'Run the available bias scenarios',
          },
          persistent: {
            points: 7,
            reason:
              'The available sensitivity scenarios do not cover the flawed timeline, missing comparisons or extensive loss to follow-up.',
            action: 'Reassess the unresolved design and bias mechanisms',
          },
        },
        transport: {
          persistent: {
            points: 9,
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
