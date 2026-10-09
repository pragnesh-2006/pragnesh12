const essayInput = document.querySelector('#essay-input');
const wordCountNode = document.querySelector('#word-count');
const charCountNode = document.querySelector('#char-count');
const evaluateButton = document.querySelector('#evaluate-button');
const sampleButton = document.querySelector('#sample-button');
const rubricButton = document.querySelector('#rubric-button');
const rubricMenu = document.querySelector('#rubric-menu');
const toast = document.querySelector('#toast');
const emptyState = document.querySelector('#empty-state');
const resultContent = document.querySelector('#result-content');
const infoModal = document.querySelector('#info-modal');
const workspaceModal = document.querySelector('#workspace-modal');
const workspaceModalTitle = document.querySelector('#workspace-modal-title');
const workspaceModalDescription = document.querySelector('#workspace-modal-description');
const workspaceModalBody = document.querySelector('#workspace-modal-body');
const HISTORY_KEY = 'essaylens-evaluation-history-v1';
const SETTINGS_KEY = 'essaylens-profile-settings-v1';
const DEFAULT_SETTINGS = { workspaceName: 'Student workspace', profileName: 'Alex Morgan' };
const SKILLS = [
  { key: 'development', label: 'Development', color: '#8c73c6', description: 'How well ideas are explained and supported with relevant detail.' },
  { key: 'organization', label: 'Organization', color: '#55a69c', description: 'How clearly the essay is arranged into paragraphs and a readable sequence.' },
  { key: 'clarity', label: 'Clarity & focus', color: '#dfa34d', description: 'How directly the writing communicates a central idea and connects ideas.' },
  { key: 'language', label: 'Language & mechanics', color: '#86a84e', description: 'Vocabulary variety, sentence signals, capitalization, and punctuation.' },
];
let selectedRubric = 'General academic essay';
let lastFeedback = '';
let toastTimer;
let previousFocus = null;
let profileSettings = loadProfileSettings();
let evaluationHistory = loadHistory();

const sampleEssay = `Technology has become part of nearly every classroom. While some people worry that devices distract students, schools should use technology thoughtfully because it can make learning more accessible and help students build skills they will use beyond school.\n\nFirst, digital tools give students more ways to understand difficult ideas. A student who is learning about the solar system can explore an interactive model instead of relying only on a textbook picture. Videos, audio, and translation tools can also support students who learn differently or speak another language at home. These resources do not replace a teacher, but they give teachers more ways to explain a concept.\n\nTechnology can also help students practice skills that matter in modern workplaces. Researching a topic, checking whether a source is reliable, and working on a shared document all require careful thinking. Students need guidance as they practice, since the internet includes inaccurate information and notifications can interrupt concentration.\n\nFor these reasons, schools should not avoid technology or use it without a plan. Teachers can choose tools that support a specific lesson, set clear expectations, and make time for discussion away from screens. When used with purpose, technology can make the classroom more inclusive while helping students become thoughtful learners.`;

function loadHistory() {
  try {
    const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(stored) ? stored.filter((entry) => entry && entry.skills && Number.isFinite(entry.score)) : [];
  } catch {
    return [];
  }
}

function loadProfileSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return {
      workspaceName: typeof stored.workspaceName === 'string' && stored.workspaceName.trim() ? stored.workspaceName.trim().slice(0, 40) : DEFAULT_SETTINGS.workspaceName,
      profileName: typeof stored.profileName === 'string' && stored.profileName.trim() ? stored.profileName.trim().slice(0, 40) : DEFAULT_SETTINGS.profileName,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function applyProfileSettings() {
  document.querySelector('#workspace-name').textContent = profileSettings.workspaceName;
  document.querySelector('#profile-name').textContent = profileSettings.profileName;
  document.querySelector('#workspace-initial').textContent = Array.from(profileSettings.workspaceName.trim())[0]?.toUpperCase() || 'S';
  document.querySelector('#profile-initial').textContent = Array.from(profileSettings.profileName.trim())[0]?.toUpperCase() || 'A';
}

function persistProfileSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(profileSettings));
    return true;
  } catch {
    return false;
  }
}

function persistHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(evaluationHistory));
    document.querySelector('#evaluation-count').textContent = evaluationHistory.length.toString();
  } catch {
    showToast('This browser could not save evaluation history.');
  }
}

function currentSkillKey(item) {
  const displayName = item[selectedRubric === 'Argumentative essay' ? 'argumentative' : selectedRubric === 'Narrative essay' ? 'narrative' : 'general'];
  if (displayName === 'Development' || displayName === 'Evidence & reasoning' || displayName === 'Detail & imagery') return 'development';
  if (displayName === 'Organization' || displayName === 'Story & sequence') return 'organization';
  if (displayName === 'Clarity & focus' || displayName === 'Thesis & focus' || displayName === 'Story & focus') return 'clarity';
  return 'language';
}

function saveEvaluation(signals, score, tip) {
  const skills = {};
  signals.dimensions.forEach((item) => { skills[currentSkillKey(item)] = Math.round(item.value * 10) / 10; });
  evaluationHistory.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: new Date().toISOString(),
    rubric: selectedRubric,
    words: signals.words,
    score: Math.round(score * 10) / 10,
    skills,
    tip,
  });
  evaluationHistory = evaluationHistory.slice(-30);
  persistHistory();
}

function getWords(text) {
  return text.trim().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || [];
}

function updateCounts() {
  const text = essayInput.value;
  const words = getWords(text);
  wordCountNode.textContent = words.length.toLocaleString();
  charCountNode.textContent = text.length.toLocaleString();
  evaluateButton.disabled = words.length === 0;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2600);
}

function splitSentences(text) {
  return (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).map((part) => part.trim()).filter(Boolean);
}

function clamp(value, min = 0, max = 6) {
  return Math.max(min, Math.min(max, value));
}

function calculateSignals(text) {
  const words = getWords(text);
  const paragraphs = text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  const sentences = splitSentences(text);
  const lowerWords = words.map((word) => word.toLowerCase());
  const uniqueRatio = words.length ? new Set(lowerWords).size / words.length : 0;
  const averageSentenceLength = words.length / Math.max(sentences.length, 1);
  const transitions = (text.match(/\b(however|therefore|because|for example|in addition|first|second|finally|although|consequently|also|while|as a result|for instance)\b/gi) || []).length;
  const endingRate = sentences.length ? sentences.filter((sentence) => /[.!?]["')\]]?$/.test(sentence)).length / sentences.length : 0;
  const capitalRate = sentences.length ? sentences.filter((sentence) => /^[\s"'([{]*[A-Z]/.test(sentence)).length / sentences.length : 0;
  const longWords = words.filter((word) => word.length >= 7).length / Math.max(words.length, 1);

  const lengthScore = words.length < 45 ? 1.6 + words.length / 50 : words.length < 140 ? 2.5 + (words.length - 45) / 100 : words.length < 320 ? 3.45 + (words.length - 140) / 190 : Math.min(5.15, 4.35 + (words.length - 320) / 500);
  const structureScore = paragraphs.length < 2 ? 2.5 : paragraphs.length === 2 ? 3.55 : paragraphs.length === 3 ? 4.15 : Math.min(5.45, 4.4 + (paragraphs.length - 4) * 0.22);
  const developmentScore = clamp(2.7 + Math.min(words.length / 250, 1.25) + Math.min(transitions * 0.17, 0.75));
  const languageScore = clamp(2.4 + uniqueRatio * 3.3 + Math.min(longWords * 1.1, 0.55) + (averageSentenceLength >= 8 && averageSentenceLength <= 27 ? 0.45 : -0.2));
  const mechanicsScore = clamp(1.8 + endingRate * 1.45 + capitalRate * 1.25 + (text.includes('  ') ? -0.4 : 0) + (words.length > 100 ? 0.65 : 0));
  const clarityScore = clamp(2.45 + Math.min(transitions * 0.32, 1.15) + (paragraphs.length >= 3 ? 0.6 : 0) + (averageSentenceLength <= 30 ? 0.55 : -0.25) + Math.min(lengthScore / 9, 0.55));

  return {
    words: words.length,
    paragraphs: paragraphs.length,
    sentences: sentences.length,
    averageSentenceLength,
    transitions,
    uniqueRatio,
    dimensions: [
      { general: 'Development', argumentative: 'Evidence & reasoning', narrative: 'Detail & imagery', value: developmentScore },
      { general: 'Organization', argumentative: 'Organization', narrative: 'Story & sequence', value: structureScore },
      { general: 'Clarity & focus', argumentative: 'Thesis & focus', narrative: 'Story & focus', value: clarityScore },
      { general: 'Language & mechanics', argumentative: 'Language & mechanics', narrative: 'Language & mechanics', value: (languageScore + mechanicsScore) / 2 },
    ],
    languageScore,
    mechanicsScore,
    structureScore,
    developmentScore,
    clarityScore,
  };
}

function labelForScore(score) {
  if (score < 2.5) return { label: 'Getting started', title: 'A first draft to build on', color: '#d4a464' };
  if (score < 3.7) return { label: 'Developing', title: 'A foundation is taking shape', color: '#c8b768' };
  if (score < 4.8) return { label: 'Proficient', title: 'A thoughtful draft', color: '#aecb58' };
  return { label: 'Strong', title: 'A confident piece of writing', color: '#92b548' };
}

function createFeedback(signals) {
  const weakest = signals.dimensions.reduce((low, item) => item.value < low.value ? item : low, signals.dimensions[0]);
  const tips = {
    'Development': 'Choose one key idea and add a concrete example or explanation that shows why it matters.',
    'Evidence & reasoning': 'Support your main claim with a specific example, then explain how that evidence connects to your point.',
    'Detail & imagery': 'Add a sensory detail or a specific moment to help your reader picture the scene.',
    'Organization': signals.paragraphs < 3 ? 'Break the draft into clear paragraphs, with each paragraph developing one part of your idea.' : 'Check that each paragraph has a clear purpose and connects naturally to the next.',
    'Story & sequence': 'Make the order of events easy to follow by adding a clear transition between important moments.',
    'Clarity & focus': 'Try stating your central idea in one direct sentence near the beginning, then check each paragraph against it.',
    'Thesis & focus': 'Make your position explicit early, and use each body paragraph to develop one reason that supports it.',
    'Language & mechanics': signals.mechanicsScore < signals.languageScore ? 'Read the essay aloud once and check sentence endings, capitalization, and punctuation as you go.' : 'Try varying a few sentence openings and choosing precise words where an idea feels broad.',
  };
  return tips[weakest[ selectedRubric === 'Argumentative essay' ? 'argumentative' : selectedRubric === 'Narrative essay' ? 'narrative' : 'general' ]] || tips['Development'];
}

function displaySkillLabels(rubric) {
  if (rubric === 'Argumentative essay') return ['Evidence & reasoning', 'Organization', 'Thesis & focus', 'Language & mechanics'];
  if (rubric === 'Narrative essay') return ['Detail & imagery', 'Story & sequence', 'Story & focus', 'Language & mechanics'];
  return SKILLS.map((skill) => skill.label);
}

function renderSkillBreakdown(scores, rubric = selectedRubric) {
  const skillList = document.querySelector('#skill-list');
  skillList.replaceChildren();
  const labels = displaySkillLabels(rubric);
  SKILLS.forEach((skill, index) => {
    const value = Number(scores[skill.key]) || 0;
    const row = document.createElement('div');
    row.className = 'skill-row';
    const name = document.createElement('span');
    name.className = 'skill-name';
    name.textContent = labels[index];
    const track = document.createElement('span');
    track.className = 'skill-track';
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-label', `${labels[index]} score`);
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '6');
    track.setAttribute('aria-valuenow', value.toFixed(1));
    track.setAttribute('aria-valuetext', `${value.toFixed(1)} out of 6`);
    const fill = document.createElement('span');
    fill.className = 'skill-fill';
    fill.style.width = `${value / 6 * 100}%`;
    fill.style.backgroundColor = skill.color;
    track.append(fill);
    const numericValue = document.createElement('span');
    numericValue.className = 'skill-value';
    numericValue.textContent = value.toFixed(1);
    row.append(name, track, numericValue);
    skillList.append(row);
  });
}

function getScoresFromSignals(signals) {
  return {
    development: signals.developmentScore,
    organization: signals.structureScore,
    clarity: signals.clarityScore,
    language: (signals.languageScore + signals.mechanicsScore) / 2,
  };
}

function setActiveNav(id) {
  document.querySelectorAll('.nav-item').forEach((item) => {
    const active = item.id === id;
    item.classList.toggle('active', active);
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
}

function openWorkspaceModal(kind) {
  previousFocus = document.activeElement;
  workspaceModalBody.replaceChildren();
  if (kind === 'rubric') renderRubricView();
  if (kind === 'history') renderHistoryView();
  if (kind === 'insights') renderInsightsView();
  if (kind === 'tips') renderTipsView();
  if (kind === 'settings') renderSettingsView();
  workspaceModal.classList.remove('hidden');
  if (['rubric', 'history', 'insights'].includes(kind)) setActiveNav(`${kind}-link`);
  const firstFocus = kind === 'settings' ? workspaceModalBody.querySelector('input') : document.querySelector('#workspace-modal-close');
  firstFocus.focus();
}

function closeWorkspaceModal(restoreFocus = true) {
  workspaceModal.classList.add('hidden');
  if (restoreFocus && previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
}

function renderRubricView() {
  workspaceModalTitle.textContent = 'Scoring rubric & color key';
  workspaceModalDescription.textContent = 'Use the colored lines to match each skill score to its rubric description. Scores are demo estimates on a 0–6 scale.';

  const colorKey = document.createElement('div');
  colorKey.className = 'rubric-skill-list';
  SKILLS.forEach((skill) => {
    const row = document.createElement('div');
    row.className = 'rubric-skill-row';
    const line = document.createElement('span');
    line.className = 'rubric-color-line';
    line.style.backgroundColor = skill.color;
    const copy = document.createElement('span');
    copy.innerHTML = `<strong>${skill.label}</strong><small>${skill.description}</small>`;
    row.append(line, copy);
    colorKey.append(row);
  });
  workspaceModalBody.append(colorKey);

  const bandsTitle = document.createElement('h3');
  bandsTitle.className = 'rubric-subheading';
  bandsTitle.textContent = 'Score bands';
  workspaceModalBody.append(bandsTitle);
  const bands = [
    ['0.0–2.4', 'Getting started', 'A first draft to build on'],
    ['2.5–3.6', 'Developing', 'A foundation is taking shape'],
    ['3.7–4.7', 'Proficient', 'A thoughtful draft'],
    ['4.8–6.0', 'Strong', 'A confident piece of writing'],
  ];
  const bandList = document.createElement('div');
  bandList.className = 'rubric-band-list';
  bands.forEach(([range, label, note], index) => {
    const row = document.createElement('div');
    row.className = 'rubric-band-row';
    const band = document.createElement('span');
    band.className = `rubric-band band-${index + 1}`;
    band.textContent = range;
    const desc = document.createElement('span');
    desc.innerHTML = `<strong>${label}</strong><small>${note}</small>`;
    row.append(band, desc);
    bandList.append(row);
  });
  workspaceModalBody.append(bandList);
  const note = document.createElement('p');
  note.className = 'modal-note';
  note.textContent = 'The prototype uses simple text signals and rules. Choosing a rubric changes labels and feedback wording, but not the underlying demo scoring formula. These bands are not official grading.';
  workspaceModalBody.append(note);
}

function renderTipsView() {
  workspaceModalTitle.textContent = 'Writing tips';
  workspaceModalDescription.textContent = 'Practical revision strategies you can use with any essay. Choose one or two to focus on in your next draft.';
  const tips = [
    ['Lead with your main idea', 'Write a clear central claim near the beginning so your reader knows what the essay will explain or argue.'],
    ['Give each paragraph one job', 'Start each paragraph with a focused point, then make sure the supporting sentences develop that point.'],
    ['Use specific evidence', 'Replace broad statements with a concrete example, detail, or source. Explain how it supports your idea.'],
    ['Connect ideas for the reader', 'Use transitions where they clarify the relationship between points. Check that the reasoning flows, not just the transition words.'],
    ['Revise in two passes', 'First check ideas and organization. Then read aloud to catch unclear sentences, repeated words, and punctuation slips.'],
  ];
  const list = document.createElement('div');
  list.className = 'tips-list';
  tips.forEach(([title, body], index) => {
    const card = document.createElement('article');
    card.className = 'tip-card';
    const number = document.createElement('span');
    number.className = 'tip-number';
    number.textContent = String(index + 1).padStart(2, '0');
    const copy = document.createElement('span');
    const heading = document.createElement('strong');
    heading.textContent = title;
    const description = document.createElement('small');
    description.textContent = body;
    copy.append(heading, description);
    card.append(number, copy);
    list.append(card);
  });
  workspaceModalBody.append(list);
  const note = document.createElement('p');
  note.className = 'modal-note';
  note.textContent = 'Writing tips are general learning suggestions. Use the feedback on your essay to choose the one that best fits your draft.';
  workspaceModalBody.append(note);
}

function renderSettingsView() {
  workspaceModalTitle.textContent = 'Personalize your workspace';
  workspaceModalDescription.textContent = 'Change the workspace and profile names whenever you like. Name editing is available on the free plan.';
  const form = document.createElement('form');
  form.className = 'settings-form';
  const fields = [
    ['Workspace name', 'workspace-name-input', profileSettings.workspaceName, 'Shown in the workspace switcher.'],
    ['Your name', 'profile-name-input', profileSettings.profileName, 'Shown at the bottom of the sidebar.'],
  ];
  fields.forEach(([labelText, id, value, helpText]) => {
    const field = document.createElement('div');
    field.className = 'settings-field';
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = labelText;
    const input = document.createElement('input');
    input.id = id;
    input.name = id;
    input.type = 'text';
    input.value = value;
    input.maxLength = 40;
    input.required = true;
    input.autocomplete = 'off';
    const help = document.createElement('small');
    help.textContent = helpText;
    field.append(label, input, help);
    form.append(field);
  });
  const actions = document.createElement('div');
  actions.className = 'settings-actions';
  const save = document.createElement('button');
  save.type = 'submit';
  save.className = 'evaluate-button';
  save.innerHTML = '<span>Save names</span><svg viewBox="0 0 20 20"><path d="m4 10 4 4 8-8"/></svg>';
  actions.append(save);
  form.append(actions);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const workspaceName = form.elements['workspace-name-input'].value.trim();
    const profileName = form.elements['profile-name-input'].value.trim();
    if (!workspaceName || !profileName) {
      showToast('Enter both names before saving.');
      return;
    }
    profileSettings = { workspaceName: workspaceName.slice(0, 40), profileName: profileName.slice(0, 40) };
    applyProfileSettings();
    const saved = persistProfileSettings();
    closeWorkspaceModal();
    showToast(saved ? 'Names updated and saved in this browser.' : 'Names updated for this visit; browser storage is unavailable.');
  });
  workspaceModalBody.append(form);
  form.querySelector('input').focus();
}

function renderHistoryView() {
  workspaceModalTitle.textContent = 'My evaluations';
  workspaceModalDescription.textContent = 'Your recent score summaries are stored only in this browser. Essay text is not saved.';
  if (!evaluationHistory.length) {
    const empty = document.createElement('div');
    empty.className = 'workspace-empty';
    empty.innerHTML = '<strong>No evaluations yet</strong><span>Evaluate an essay and your score summary will show up here.</span>';
    const trySample = document.createElement('button');
    trySample.type = 'button';
    trySample.className = 'evaluate-button modal-action';
    trySample.innerHTML = '<span>Try a sample essay</span><svg viewBox="0 0 20 20"><path d="M4 10h12M11 5l5 5-5 5"/></svg>';
    trySample.addEventListener('click', () => { closeWorkspaceModal(); sampleButton.click(); essayInput.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    workspaceModalBody.append(empty, trySample);
    return;
  }

  const list = document.createElement('div');
  list.className = 'history-list';
  [...evaluationHistory].reverse().forEach((entry) => {
    const card = document.createElement('article');
    card.className = 'history-card';
    const header = document.createElement('div');
    header.className = 'history-card-header';
    const meta = document.createElement('div');
    meta.className = 'history-meta';
    const date = document.createElement('strong');
    date.textContent = new Date(entry.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    const subtitle = document.createElement('span');
    subtitle.textContent = `${entry.rubric} · ${entry.words} words`;
    meta.append(date, subtitle);
    const score = document.createElement('span');
    score.className = 'history-score';
    score.textContent = `${entry.score.toFixed(1)} / 6`;
    header.append(meta, score);
    const miniBars = document.createElement('div');
    miniBars.className = 'history-mini-bars';
    SKILLS.forEach((skill) => {
      const item = document.createElement('div');
      item.className = 'history-mini-row';
      const label = document.createElement('span');
      label.textContent = skill.label;
      const track = document.createElement('span');
      track.className = 'skill-track';
      const fill = document.createElement('span');
      fill.className = 'skill-fill';
      fill.style.width = `${(entry.skills[skill.key] || 0) / 6 * 100}%`;
      fill.style.backgroundColor = skill.color;
      track.append(fill);
      const value = document.createElement('b');
      value.textContent = Number(entry.skills[skill.key] || 0).toFixed(1);
      item.append(label, track, value);
      miniBars.append(item);
    });
    const tip = document.createElement('p');
    tip.className = 'history-tip';
    tip.textContent = entry.tip;
    const actions = document.createElement('div');
    actions.className = 'history-card-actions';
    const view = document.createElement('button');
    view.type = 'button';
    view.className = 'secondary-button';
    view.textContent = 'View breakdown';
    view.addEventListener('click', () => displaySavedEvaluation(entry));
    actions.append(view);
    card.append(header, miniBars, tip, actions);
    list.append(card);
  });
  workspaceModalBody.append(list);
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'clear-history-button';
  clear.textContent = 'Clear saved score history';
  clear.addEventListener('click', () => {
    if (!window.confirm('Clear saved score summaries from this browser?')) return;
    evaluationHistory = [];
    persistHistory();
    renderHistoryView();
    showToast('Saved score history cleared.');
  });
  workspaceModalBody.append(clear);
}

function renderInsightsView() {
  workspaceModalTitle.textContent = 'Writing insights';
  workspaceModalDescription.textContent = 'See how your demo writing scores vary across saved evaluations in this browser.';
  if (!evaluationHistory.length) {
    const empty = document.createElement('div');
    empty.className = 'workspace-empty';
    empty.innerHTML = '<strong>Your insights will build here</strong><span>Evaluate a few essays or drafts to compare score patterns and skill averages.</span>';
    const trySample = document.createElement('button');
    trySample.type = 'button';
    trySample.className = 'evaluate-button modal-action';
    trySample.innerHTML = '<span>Evaluate a sample</span><svg viewBox="0 0 20 20"><path d="M4 10h12M11 5l5 5-5 5"/></svg>';
    trySample.addEventListener('click', () => { closeWorkspaceModal(); sampleButton.click(); essayInput.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    workspaceModalBody.append(empty, trySample);
    return;
  }

  const overallAverage = evaluationHistory.reduce((sum, entry) => sum + entry.score, 0) / evaluationHistory.length;
  const latest = evaluationHistory[evaluationHistory.length - 1];
  const previous = evaluationHistory.length > 1 ? evaluationHistory[evaluationHistory.length - 2] : null;
  const delta = previous ? latest.score - previous.score : null;
  const metrics = document.createElement('div');
  metrics.className = 'insight-metrics';
  const metricsData = [
    ['Evaluations', evaluationHistory.length.toString()],
    ['Average demo score', `${overallAverage.toFixed(1)} / 6`],
    ['Latest change', delta === null ? 'First entry' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} pts`],
  ];
  metricsData.forEach(([label, value]) => {
    const metric = document.createElement('div');
    metric.className = 'insight-metric';
    const small = document.createElement('small');
    small.textContent = label;
    const strong = document.createElement('strong');
    strong.textContent = value;
    metric.append(small, strong);
    metrics.append(metric);
  });
  workspaceModalBody.append(metrics);

  const chartTitle = document.createElement('h3');
  chartTitle.className = 'rubric-subheading';
  chartTitle.textContent = 'Recent overall scores · out of 6';
  workspaceModalBody.append(chartTitle);
  const chart = document.createElement('div');
  chart.className = 'insight-chart';
  chart.setAttribute('role', 'img');
  chart.setAttribute('aria-label', `Recent overall essay scores: ${evaluationHistory.slice(-8).map((entry) => entry.score.toFixed(1)).join(', ')}`);
  evaluationHistory.slice(-8).forEach((entry) => {
    const column = document.createElement('div');
    column.className = 'chart-column';
    const barArea = document.createElement('div');
    barArea.className = 'chart-bar-area';
    const bar = document.createElement('span');
    bar.className = 'chart-bar';
    bar.style.height = `${entry.score / 6 * 100}%`;
    bar.title = `${entry.score.toFixed(1)} out of 6`;
    barArea.append(bar);
    const score = document.createElement('b');
    score.textContent = entry.score.toFixed(1);
    const date = document.createElement('small');
    date.textContent = new Date(entry.date).toLocaleDateString([], { month: 'short', day: 'numeric' });
    column.append(barArea, score, date);
    chart.append(column);
  });
  workspaceModalBody.append(chart);

  const averageTitle = document.createElement('h3');
  averageTitle.className = 'rubric-subheading';
  averageTitle.textContent = 'Average by skill';
  workspaceModalBody.append(averageTitle);
  const skillMeans = SKILLS.map((skill) => ({
    skill,
    value: evaluationHistory.reduce((sum, entry) => sum + Number(entry.skills[skill.key] || 0), 0) / evaluationHistory.length,
  }));
  const strongest = skillMeans.reduce((best, item) => item.value > best.value ? item : best, skillMeans[0]);
  const focus = skillMeans.reduce((lowest, item) => item.value < lowest.value ? item : lowest, skillMeans[0]);
  const summary = document.createElement('p');
  summary.className = 'insight-summary';
  summary.textContent = `Across these demo estimates, ${strongest.skill.label} is the highest average (${strongest.value.toFixed(1)}), while ${focus.skill.label} is the lowest (${focus.value.toFixed(1)}).`;
  workspaceModalBody.append(summary);
  const averages = document.createElement('div');
  averages.className = 'insight-skill-averages';
  skillMeans.forEach(({ skill, value: average }) => {
    const row = document.createElement('div');
    row.className = 'insight-average-row';
    const label = document.createElement('span');
    label.textContent = skill.label;
    const track = document.createElement('span');
    track.className = 'skill-track';
    const fill = document.createElement('span');
    fill.className = 'skill-fill';
    fill.style.width = `${average / 6 * 100}%`;
    fill.style.backgroundColor = skill.color;
    track.append(fill);
    const value = document.createElement('b');
    value.textContent = average.toFixed(1);
    row.append(label, track, value);
    averages.append(row);
  });
  workspaceModalBody.append(averages);
  const note = document.createElement('p');
  note.className = 'modal-note';
  note.textContent = 'These insights summarize this browser’s local demo estimates. They do not measure validated writing growth or official grades.';
  workspaceModalBody.append(note);
}

function displaySavedEvaluation(entry) {
  selectedRubric = entry.rubric;
  rubricButton.querySelector('span:nth-child(2)').textContent = selectedRubric;
  rubricMenu.querySelectorAll('.rubric-option').forEach((option) => {
    const selected = option.dataset.rubric === selectedRubric;
    option.classList.toggle('selected', selected);
    option.setAttribute('aria-selected', selected ? 'true' : 'false');
  });
  const descriptor = labelForScore(entry.score);
  document.querySelector('#score-value').textContent = entry.score.toFixed(1);
  document.querySelector('#score-label').textContent = descriptor.label;
  document.querySelector('#score-title').textContent = descriptor.title;
  document.querySelector('#score-summary').textContent = `Saved evaluation · ${entry.words} words · ${new Date(entry.date).toLocaleDateString()}.`;
  const degrees = entry.score / 6 * 360;
  document.querySelector('#score-ring').style.background = `conic-gradient(${descriptor.color} 0deg, #d9e99f ${degrees}deg, #eff1e9 ${degrees}deg 360deg)`;
  renderSkillBreakdown(entry.skills, entry.rubric);
  document.querySelector('#feedback-tip').textContent = entry.tip;
  lastFeedback = `EssayLens demo estimate: ${entry.score.toFixed(1)} out of 6 (${descriptor.label}).\n\nSkill breakdown:\n${SKILLS.map((skill, index) => `• ${displaySkillLabels(entry.rubric)[index]}: ${Number(entry.skills[skill.key] || 0).toFixed(1)} / 6`).join('\n')}\n\nOne thing to try next: ${entry.tip}\n\nThis is an illustrative demo estimate, not a validated or official grade.`;
  emptyState.classList.add('hidden');
  resultContent.classList.remove('hidden');
  document.querySelector('#results-subtitle').textContent = 'A saved snapshot from your local history';
  closeWorkspaceModal(false);
  setActiveNav('history-link');
  document.querySelector('#results-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.querySelector('#results-heading').focus({ preventScroll: true });
}

function showResults() {
  const text = essayInput.value.trim();
  const words = getWords(text);
  if (words.length < 30) {
    showToast('Add at least 30 words for a more useful estimate.');
    essayInput.focus();
    return;
  }

  evaluateButton.classList.add('loading');
  evaluateButton.disabled = true;
  evaluateButton.querySelector('span').textContent = 'Reading your essay';
  window.setTimeout(() => {
    const signals = calculateSignals(text);
    const score = signals.dimensions.reduce((sum, item) => sum + item.value, 0) / signals.dimensions.length;
    const rounded = Math.round(score * 10) / 10;
    const descriptor = labelForScore(rounded);
    const tip = createFeedback(signals);

    document.querySelector('#score-value').textContent = rounded.toFixed(1);
    document.querySelector('#score-label').textContent = descriptor.label;
    document.querySelector('#score-title').textContent = descriptor.title;
    document.querySelector('#score-summary').textContent = `Based on ${signals.words} words across ${signals.paragraphs} ${signals.paragraphs === 1 ? 'paragraph' : 'paragraphs'}.`;
    const degrees = rounded / 6 * 360;
    document.querySelector('#score-ring').style.background = `conic-gradient(${descriptor.color} 0deg, #d9e99f ${degrees}deg, #eff1e9 ${degrees}deg 360deg)`;
    document.querySelector('#feedback-tip').textContent = tip;
    lastFeedback = `EssayLens demo estimate: ${rounded.toFixed(1)} out of 6 (${descriptor.label}).\n\nSkill breakdown:\n${signals.dimensions.map((item) => `• ${item[selectedRubric === 'Argumentative essay' ? 'argumentative' : selectedRubric === 'Narrative essay' ? 'narrative' : 'general']}: ${item.value.toFixed(1)} / 6`).join('\n')}\n\nOne thing to try next: ${tip}\n\nThis is an illustrative demo estimate, not a validated or official grade.`;
    const skills = getScoresFromSignals(signals);
    renderSkillBreakdown(skills);
    saveEvaluation(signals, rounded, tip);

    emptyState.classList.add('hidden');
    resultContent.classList.remove('hidden');
    document.querySelector('#results-subtitle').textContent = 'A snapshot to guide your next revision';
    evaluateButton.classList.remove('loading');
    evaluateButton.querySelector('span').textContent = 'Evaluate essay';
    updateCounts();
    showToast('Your writing snapshot is ready.');
  }, 420);
}

function setRubric(name) {
  selectedRubric = name;
  rubricButton.querySelector('span:nth-child(2)').textContent = name;
  rubricMenu.querySelectorAll('.rubric-option').forEach((option) => {
    const selected = option.dataset.rubric === name;
    option.classList.toggle('selected', selected);
    option.setAttribute('aria-selected', selected ? 'true' : 'false');
  });
  rubricMenu.classList.remove('open');
  rubricButton.setAttribute('aria-expanded', 'false');
}

function openInfoModal() {
  previousFocus = document.activeElement;
  infoModal.classList.remove('hidden');
  document.querySelector('#modal-done').focus();
}

function closeInfoModal() {
  infoModal.classList.add('hidden');
  if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
}

essayInput.addEventListener('input', updateCounts);
essayInput.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') showResults();
});
evaluateButton.addEventListener('click', showResults);
sampleButton.addEventListener('click', () => {
  essayInput.value = sampleEssay;
  updateCounts();
  essayInput.focus();
  showToast('Sample essay added. Select Evaluate essay when you’re ready.');
});
rubricButton.addEventListener('click', () => {
  const isOpen = rubricMenu.classList.toggle('open');
  rubricButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
});
rubricMenu.querySelectorAll('.rubric-option').forEach((option) => option.addEventListener('click', () => setRubric(option.dataset.rubric)));
document.addEventListener('click', (event) => {
  if (!event.target.closest('.rubric-select-wrap')) {
    rubricMenu.classList.remove('open');
    rubricButton.setAttribute('aria-expanded', 'false');
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeInfoModal();
    closeWorkspaceModal();
    rubricMenu.classList.remove('open');
    rubricButton.setAttribute('aria-expanded', 'false');
  }
});
document.querySelector('#help-button').addEventListener('click', openInfoModal);
document.querySelector('#evaluate-link').addEventListener('click', () => setActiveNav('evaluate-link'));
document.querySelector('#about-link').addEventListener('click', (event) => { event.preventDefault(); openInfoModal(); });
document.querySelector('#tips-link').addEventListener('click', (event) => { event.preventDefault(); openWorkspaceModal('tips'); });
document.querySelector('#learn-more').addEventListener('click', openInfoModal);
document.querySelector('#footer-about').addEventListener('click', (event) => { event.preventDefault(); openInfoModal(); });
document.querySelector('#modal-close').addEventListener('click', closeInfoModal);
document.querySelector('#modal-done').addEventListener('click', closeInfoModal);
infoModal.addEventListener('click', (event) => { if (event.target === infoModal) closeInfoModal(); });
document.querySelector('#workspace-modal-close').addEventListener('click', closeWorkspaceModal);
workspaceModal.addEventListener('click', (event) => { if (event.target === workspaceModal) closeWorkspaceModal(); });
document.querySelector('#rubric-inline-link').addEventListener('click', () => openWorkspaceModal('rubric'));
document.querySelector('#rubric-link').addEventListener('click', (event) => { event.preventDefault(); openWorkspaceModal('rubric'); });
document.querySelector('#footer-rubric').addEventListener('click', (event) => { event.preventDefault(); openWorkspaceModal('rubric'); });
document.querySelector('#new-evaluation').addEventListener('click', () => {
  essayInput.value = '';
  updateCounts();
  emptyState.classList.remove('hidden');
  resultContent.classList.add('hidden');
  document.querySelector('#results-subtitle').textContent = 'A clearer view of your writing';
  setActiveNav('evaluate-link');
  essayInput.focus();
});
document.querySelector('#copy-feedback').addEventListener('click', async () => {
  if (!lastFeedback) return;
  try {
    await navigator.clipboard.writeText(lastFeedback);
    showToast('Feedback copied to clipboard.');
  } catch {
    showToast('Clipboard access is unavailable in this browser.');
  }
});
document.querySelector('#history-link').addEventListener('click', (event) => {
  event.preventDefault();
  openWorkspaceModal('history');
});
document.querySelector('#insights-link').addEventListener('click', (event) => {
  event.preventDefault();
  openWorkspaceModal('insights');
});
document.querySelector('#workspace-switcher').addEventListener('click', () => openWorkspaceModal('settings'));
document.querySelector('#profile-button').addEventListener('click', () => openWorkspaceModal('settings'));
document.querySelector('#result-menu-button').addEventListener('click', () => showToast('Use Copy feedback to save this writing snapshot.'));

applyProfileSettings();
document.querySelector('#evaluation-count').textContent = evaluationHistory.length.toString();
updateCounts();
