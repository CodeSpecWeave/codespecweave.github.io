'use strict';

const training = {
  flash: {
    name: 'MiMo-V2.6-Flash-SFT',
    rows: [
      { name: 'Vanilla', values: [59.00, 54.42, 74.20, 54.54, 60.54] },
      { name: 'SWE-PI', values: [66.33, 56.64, 76.60, 59.05, 64.66] },
      { name: 'MiMo Coding', values: [69.00, 50.74, 77.20, 59.44, 64.09] },
      { name: 'CodeSpecWeave', values: [70.67, 62.98, 77.40, 59.37, 67.60] },
    ],
  },
  v25: {
    name: 'MiMo-V2.5',
    rows: [
      { name: 'Vanilla', values: [47.00, 12.39, 69.27, 50.11, 44.69] },
      { name: 'SWE-PI', values: [44.00, 6.78, 68.00, 49.43, 42.05] },
      { name: 'MiMo Coding', values: [50.00, 18.62, 73.63, 53.81, 49.01] },
      { name: 'CodeSpecWeave', values: [52.00, 25.30, 72.00, 51.30, 50.15] },
    ],
  },
};

const frontier = [
  { name: 'GPT-6 Astra', harness: 'Codex', score: 74.0 },
  { name: 'Claude Opus 5', harness: 'Claude Code', score: 71.1 },
  { name: 'GPT-5.6 Sol', harness: 'Codex', score: 69.0 },
  { name: 'GPT-5.5', harness: 'Codex', score: 67.0 },
  { name: 'GPT-5.4', harness: 'Codex', score: 66.0 },
  { name: 'Qwen3.8-Max', harness: 'Claude Code', score: 65.0 },
  { name: 'MiMo-V2.6-Flash-SFT', harness: 'MimoAgent', score: 59.0 },
  { name: 'Kimi K3', harness: 'Claude Code', score: 55.0 },
  { name: 'MiMo-V2.5', harness: 'MimoAgent', score: 47.0 },
  { name: 'MiMo-V2.5-Pro', harness: 'MimoAgent', score: 44.0 },
];

const requirements = {
  proportional: {
    connections: ['proportional', 'minimum', 'order'],
    title: 'A fair split needs a shared policy.',
    description: 'Allocate hours in proportion to coin amounts. This decision must also respect minimum allocations and deterministic rounding in request order.',
    note: 'A locally correct ratio is not enough to satisfy the whole transaction contract.',
  },
  change: {
    connections: ['change', 'proportional', 'order'],
    title: 'Conserve hours before distributing them.',
    description: 'With change, split post-fee hours 50/50; the odd hour goes to change. Apply proportional allocation within the recipient share, then append non-zero-coin change last.',
    note: 'Without a change output, do not burn or discard hours just because change is absent.',
  },
  minimum: {
    connections: ['minimum', 'proportional', 'change'],
    title: 'A small payment still needs its share.',
    description: 'When the recipient share is large enough, every recipient must receive at least one hour. That lower bound must coexist with proportional allocation and exact conservation.',
    note: 'Rounding down independently can leave a recipient at zero even when enough hours exist.',
  },
  order: {
    connections: ['order', 'proportional', 'change'],
    title: 'Rounding is part of the public contract.',
    description: 'Break fractional-remainder ties by request order. Keep recipients in that same order, with non-zero-coin change last. Neither map iteration nor randomness may choose the result.',
    note: 'The allocation and output-construction paths must agree on a deterministic ordering.',
  },
  compatibility: {
    connections: ['compatibility', 'proportional', 'change'],
    title: 'New behavior needs the right boundary.',
    description: 'The new proportional policy applies to multiple recipients. A single-recipient request must retain its existing coin-hour cap and output values.',
    note: 'Applying the legacy cap to every request can truncate the new multi-recipient allocations.',
  },
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const scoreBarObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  entries.forEach(({ target, isIntersecting }) => {
    if (!isIntersecting) return;
    target.classList.remove('bar-pending');
    target.classList.add('bar-revealed');
    scoreBarObserver.unobserve(target);
  });
}, { threshold: 0.18 }) : null;

function observeScoreBars(container, replay = false) {
  container.querySelectorAll('[data-score-bar]').forEach((bar, i) => {
    if (bar.dataset.observed && !replay) return;
    bar.dataset.observed = 'true';
    bar.style.setProperty('--bar-delay', `${Math.min(i, 5) * 45}ms`);
    bar.classList.remove('bar-revealed', 'bar-pending');
    if (reducedMotion.matches || !scoreBarObserver) return;
    if (replay) void bar.offsetWidth;
    bar.classList.add('bar-pending');
    scoreBarObserver.observe(bar);
  });
}

function chooseRequirement(key) {
  const rule = requirements[key];
  $$('.requirement').forEach(button => {
    const selected = button.dataset.rule === key;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  $$('[data-node], [data-edge]').forEach(node => {
    const name = node.dataset.node || node.dataset.edge;
    node.classList.toggle('connected', rule.connections.includes(name));
    node.classList.toggle('selected', name === key);
  });
  $('#connection-count').textContent = `${rule.connections.length} connected requirements`;
  $('#rule-title').textContent = rule.title;
  $('#rule-description').textContent = rule.description;
  $('#rule-note').textContent = rule.note;
}
$$('.requirement').forEach(button => button.addEventListener('click', () => chooseRequirement(button.dataset.rule)));
chooseRequirement('proportional');

let activeBackbone = 'flash';
let activeBenchmark = 1;
const benchmarks = ['CodeSpecWeave-Bench', 'DeepSWE-v1.1', 'SWE-bench Verified', 'SWE-bench Pro', 'Four-benchmark average'];
const chart = $('#training-chart');
training.flash.rows.forEach((row, index) => {
  const element = document.createElement('div');
  element.className = `chart-row setting-${index}${index === 3 ? ' is-ours' : ''}`;
  const symbol = ['◇', 'π', '⌘', '✳'][index];
  element.innerHTML = `<span class="chart-row-name"><span class="setting-symbol" aria-hidden="true">${symbol}</span><span>${row.name}</span></span><div class="bar-track" data-score-bar aria-hidden="true"><div class="bar-fill comparison-fill"></div><span class="bar-reference"></span></div><span class="bar-value"></span><span class="train-delta"></span>`;
  chart.append(element);
});
function renderTraining() {
  const index = activeBenchmark;
  const model = training[activeBackbone];
  const base = model.rows[0].values[index];
  const ours = model.rows[3].values[index];
  const gain = ours - base;
  $('#result-benchmark').textContent = benchmarks[index];
  $('#benchmark-value').textContent = benchmarks[index];
  $$('[data-benchmark]').forEach(option => option.setAttribute('aria-selected', String(Number(option.dataset.benchmark) === index)));
  $('#gain-number').textContent = `${gain >= 0 ? '+' : ''}${gain.toFixed(2)}`;
  $('#base-value').innerHTML = `${base.toFixed(2)}<span>%</span>`;
  $('#ours-value').innerHTML = `${ours.toFixed(2)}<span>%</span>`;
  chart.style.setProperty('--base-width', `${base}%`);
  $$('.chart-row').forEach((row, i) => {
    const value = model.rows[i].values[index];
    row.style.setProperty('--bar-width', `${value}%`);
    row.querySelector('.bar-value').textContent = value.toFixed(2);
    const delta = value - base;
    const deltaElement = row.querySelector('.train-delta');
    deltaElement.textContent = i === 0 ? '—' : `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(2)} pp`;
    deltaElement.classList.toggle('negative', delta < 0);
  });
  chart.setAttribute('aria-label', `${benchmarks[index]} success rates for ${model.name}. ${model.rows.map(row => `${row.name}: ${row.values[index].toFixed(2)} percent`).join('. ')}.`);
  $$('[data-backbone]').forEach(button => {
    const selected = button.dataset.backbone === activeBackbone;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  if (!reducedMotion.matches) {
    $('#gain-number').animate([{ opacity: .45, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 300, easing: 'ease-out' });
  }
}
$$('[data-backbone]').forEach(button => button.addEventListener('click', () => {
  activeBackbone = button.dataset.backbone;
  renderTraining();
}));
const benchmarkTrigger = $('#benchmark-select');
const benchmarkMenu = $('#benchmark-options');
const benchmarkOptions = $$('[data-benchmark]');

function closeBenchmarkMenu(restoreFocus = false) {
  benchmarkMenu.hidden = true;
  benchmarkTrigger.setAttribute('aria-expanded', 'false');
  if (restoreFocus) benchmarkTrigger.focus({ preventScroll: true });
}

function openBenchmarkMenu(focusIndex = activeBenchmark) {
  benchmarkMenu.hidden = false;
  benchmarkTrigger.setAttribute('aria-expanded', 'true');
  const rect = benchmarkTrigger.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom - 14;
  const above = rect.top - 88;
  const opensUp = below < Math.min(benchmarkMenu.scrollHeight, 330) && above > below;
  benchmarkMenu.dataset.placement = opensUp ? 'top' : 'bottom';
  benchmarkMenu.style.maxHeight = `${Math.max(150, Math.min(330, opensUp ? above : below))}px`;
  $(`[data-benchmark="${focusIndex}"]`).focus({ preventScroll: true });
}

benchmarkTrigger.addEventListener('click', () => {
  if (benchmarkMenu.hidden) openBenchmarkMenu(); else closeBenchmarkMenu();
});
benchmarkTrigger.addEventListener('keydown', event => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    openBenchmarkMenu();
  } else if (event.key === 'Escape') {
    closeBenchmarkMenu(true);
  }
});
benchmarkOptions.forEach(option => option.addEventListener('click', () => {
  activeBenchmark = Number(option.dataset.benchmark);
  renderTraining();
  closeBenchmarkMenu(true);
}));
let pickerSearch = '';
let pickerSearchTime = 0;
benchmarkMenu.addEventListener('keydown', event => {
  const current = benchmarkOptions.indexOf(document.activeElement);
  let next = current;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    closeBenchmarkMenu(true);
    return;
  }
  if (event.key === 'Tab') {
    closeBenchmarkMenu(true);
    return;
  }
  if (event.key === 'ArrowDown') next = Math.min(current + 1, benchmarkOptions.length - 1);
  else if (event.key === 'ArrowUp') next = Math.max(current - 1, 0);
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = benchmarkOptions.length - 1;
  else if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
    const now = performance.now();
    pickerSearch = now - pickerSearchTime < 650 ? pickerSearch + event.key.toLowerCase() : event.key.toLowerCase();
    pickerSearchTime = now;
    const match = benchmarkOptions.findIndex(option => option.textContent.trim().toLowerCase().startsWith(pickerSearch));
    if (match >= 0) next = match;
  } else return;
  event.preventDefault();
  benchmarkOptions[next].focus({ preventScroll: true });
  benchmarkOptions[next].scrollIntoView({ block: 'nearest' });
});
document.addEventListener('pointerdown', event => {
  if (!$('.benchmark-picker').contains(event.target)) closeBenchmarkMenu();
});
window.addEventListener('resize', () => { if (!benchmarkMenu.hidden) closeBenchmarkMenu(true); });
renderTraining();
observeScoreBars(chart);

const tableBody = $('#results-table tbody');
['v25', 'flash'].forEach(key => {
  const model = training[key];
  const best = benchmarks.map((_, index) => Math.max(...model.rows.map(row => row.values[index])));
  const heading = document.createElement('tr');
  heading.className = 'model-group';
  heading.innerHTML = `<th colspan="6" scope="rowgroup">${model.name}</th>`;
  tableBody.append(heading);
  model.rows.forEach((row, i) => {
    const tr = document.createElement('tr');
    if (i === 3) tr.className = 'ours-row';
    tr.innerHTML = `<th scope="row">${row.name}</th>${row.values.map((value, index) => `<td${value === best[index] ? ' class="best"' : ''}>${value.toFixed(2)}</td>`).join('')}`;
    tableBody.append(tr);
  });
});
$('a[href="#full-results"]').addEventListener('click', () => { $('#full-results').open = true; });

let activeHarness = 'all';
let sortKey = 'score';
let sortDirection = -1;
const leaderboardRows = new Map();
const frameworkClass = { Codex: 'codex', 'Claude Code': 'claude', MimoAgent: 'mimo' };
function modelIcon(name) {
  if (name.startsWith('GPT')) return 'openai';
  if (name.startsWith('Claude')) return 'claude-color';
  if (name.startsWith('Qwen')) return 'qwen-color';
  if (name.startsWith('Kimi')) return 'kimi-color';
  return 'mimo';
}
frontier.forEach((model, index) => {
  const row = document.createElement('tr');
  row.className = `framework-${frameworkClass[model.harness]}${index === 0 ? ' top-model' : ''}`;
  row.dataset.name = model.name;
  const gap = frontier[0].score - model.score;
  row.innerHTML = `<td class="rank-column">${String(index + 1).padStart(2, '0')}</td><td class="model-column"><span class="model-name"><img class="model-icon" src="assets/model-icons/${modelIcon(model.name)}.svg" alt="" width="28" height="28"><span class="model-identity"><span class="model-title">${model.name}</span><small>${model.harness}</small></span></span></td><td class="framework-column"><span class="framework-pill"><i></i>${model.harness}</span></td><td class="score-column"><div class="score-meter" data-score-bar style="--score:${model.score}%"><span class="score-fill comparison-fill" aria-hidden="true"></span><b class="score-value">${model.score.toFixed(1)}<span>%</span></b></div></td><td class="gap-column">${gap === 0 ? '<span class="best-label">Best</span>' : `<span class="leader-gap">−${gap.toFixed(1)} <small>pp</small></span>`}</td>`;
  leaderboardRows.set(model.name, row);
});

function renderLeaderboard(harness = activeHarness) {
  activeHarness = harness;
  const body = $('#leaderboard-body');
  const before = new Map([...body.children].map(row => [row.dataset.name, row.getBoundingClientRect().top]));
  const models = frontier.filter(model => harness === 'all' || model.harness === harness).sort((a, b) => {
    return (sortKey === 'name' ? a.name.localeCompare(b.name) : a.score - b.score) * sortDirection;
  });
  body.replaceChildren(...models.map(model => leaderboardRows.get(model.name)));
  if (!reducedMotion.matches) {
    [...body.children].forEach((row, i) => {
      row.getAnimations().forEach(animation => animation.cancel());
      const previousTop = before.get(row.dataset.name);
      const delta = previousTop === undefined ? 9 : previousTop - row.getBoundingClientRect().top;
      row.animate([{ transform: `translateY(${delta}px)`, opacity: previousTop === undefined ? 0 : 1 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 430, delay: previousTop === undefined ? i * 25 : 0, easing: 'cubic-bezier(.22,1,.36,1)' });
    });
  }
  observeScoreBars(body);
  $('#leaderboard-count').textContent = `${models.length} configuration${models.length === 1 ? '' : 's'}${harness === 'all' ? '' : ` · ${harness}`}`;
  $$('[data-sort]').forEach(button => {
    const selected = button.dataset.sort === sortKey;
    button.parentElement.removeAttribute('aria-sort');
    if (selected) button.parentElement.setAttribute('aria-sort', sortDirection === -1 ? 'descending' : 'ascending');
    button.querySelector('span').textContent = selected ? (sortDirection === -1 ? '↓' : '↑') : '↕';
  });
  $$('[data-harness]').forEach(button => {
    const selected = button.dataset.harness === harness;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}
$$('[data-harness]').forEach(button => button.addEventListener('click', () => renderLeaderboard(button.dataset.harness)));
$$('[data-sort]').forEach(button => button.addEventListener('click', () => {
  const key = button.dataset.sort;
  sortDirection = key === sortKey ? -sortDirection : key === 'name' ? 1 : -1;
  sortKey = key;
  renderLeaderboard();
}));
$('#replay-results').addEventListener('click', () => observeScoreBars($('#leaderboard-body'), true));
renderLeaderboard();

function closeMenu() {
  $('#mobile-nav').hidden = true;
  $('.menu-toggle').setAttribute('aria-expanded', 'false');
  $('.menu-toggle').setAttribute('aria-label', 'Open menu');
}
$('.menu-toggle').addEventListener('click', () => {
  const expanded = $('.menu-toggle').getAttribute('aria-expanded') !== 'true';
  $('.menu-toggle').setAttribute('aria-expanded', String(expanded));
  $('.menu-toggle').setAttribute('aria-label', expanded ? 'Close menu' : 'Open menu');
  $('#mobile-nav').hidden = !expanded;
});
$$('#mobile-nav a').forEach(a => a.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('#mobile-nav').hidden) {
    closeMenu();
    $('.menu-toggle').focus();
  }
});
window.matchMedia('(min-width: 681px)').addEventListener('change', e => { if (e.matches) closeMenu(); });

if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.06 });
  $$('.reveal').forEach(element => revealObserver.observe(element));
  document.body.classList.add('motion-ready');
  const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        $$('.desktop-nav a').forEach(a => a.classList.toggle('current', a.hash === `#${entry.target.id}`));
      }
    });
  }, { rootMargin: '-12% 0px -65% 0px', threshold: 0 });
  $$('main section[id]').forEach(section => sectionObserver.observe(section));
}
let scrollScheduled = false;
function updateReadingProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  $('.reading-progress').style.width = `${max > 0 ? Math.min(100, window.scrollY / max * 100) : 0}%`;
  scrollScheduled = false;
}
window.addEventListener('scroll', () => {
  if (!scrollScheduled) {
    scrollScheduled = true;
    requestAnimationFrame(updateReadingProgress);
  }
}, { passive: true });
updateReadingProgress();

(() => {
  const canvas = $('#weave-canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const toggle = $('#motion-toggle');
  let width = 1, height = 1, time = 0, lastFrame = 0;
  let frame = 0, inView = true, paused = reducedMotion.matches;
  let pointer = { x: 0, y: 0 }, smooth = { x: 0, y: 0 };
  const colors = [[133,87,197],[159,132,194],[124,97,173],[183,139,193],[122,160,148]];
  const starts = [.23, .37, .52, .69, .80];
  const ends = [.39, .35, .48, .55, .27];
  function point(t, ribbon, strand) {
    const ease = t * t * (3 - 2 * t);
    const envelope = Math.pow(Math.sin(Math.PI * t), 1.2);
    const phase = ribbon * 1.23 + time * .105;
    const twist = t * Math.PI * 2.25 + phase;
    const spread = (strand - 10) / 20;
    const wave = Math.sin(twist);
    let x = width * (.005 + t * 1.02);
    let y = height * (starts[ribbon] * (1 - ease) + ends[ribbon] * ease);
    y += height * .235 * envelope * wave;
    y += spread * height * .071 * (0.24 + .76 * envelope) * Math.cos(twist * .8);
    x += spread * width * .038 * Math.sin(twist * .8) * envelope;
    y += smooth.y * 10 * envelope;
    x += smooth.x * 7 * envelope;
    return [x, y];
  }
  function draw() {
    ctx.clearRect(0, 0, width, height);
    smooth.x += (pointer.x - smooth.x) * .035;
    smooth.y += (pointer.y - smooth.y) * .035;
    const glow = ctx.createRadialGradient(width * .53, height * .49, 3, width * .53, height * .49, width * .43);
    glow.addColorStop(0, 'rgba(153,112,208,0.075)');
    glow.addColorStop(.5, 'rgba(173,146,207,0.025)');
    glow.addColorStop(1, 'rgba(173,146,207,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    [4, 1, 3, 0, 2].forEach(ribbon => {
      for (let strand = 0; strand <= 20; strand++) {
        const [r, g, b] = colors[ribbon];
        ctx.beginPath();
        for (let step = 0; step <= 155; step++) {
          const [x, y] = point(step / 155, ribbon, strand);
          if (step === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        const alpha = .28 + .32 * Math.sin(strand / 20 * Math.PI);
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, `rgba(${r},${g},${b},0)`);
        gradient.addColorStop(.14, `rgba(${r},${g},${b},${alpha * .58})`);
        gradient.addColorStop(.43, `rgba(${r},${g},${b},${alpha})`);
        gradient.addColorStop(.8, `rgba(${r},${g},${b},${alpha * .87})`);
        gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = strand === 10 ? 1.1 : .7;
        ctx.stroke();
      }
    });
    [0,2,4].forEach((ribbon, i) => {
      const t = .19 + ((time * .015 + i * .24) % .64);
      const [x,y] = point(t, ribbon, 10);
      ctx.fillStyle = ['#9066bc','#9471ad','#91a89b'][i];
      ctx.beginPath();ctx.arc(x,y,2.15,0,Math.PI * 2);ctx.fill();
      ctx.strokeStyle = '#f7f7f2';ctx.lineWidth = .8;ctx.stroke();
    });
  }
  function canAnimate() { return !paused && inView && !document.hidden; }
  function tick(now) {
    frame = 0;
    if (!canAnimate()) return;
    if (now - lastFrame > 32) {
      time += Math.min((now - lastFrame) / 1000, .06);
      lastFrame = now;
      draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function resume() {
    if (canAnimate() && !frame) { lastFrame = performance.now();frame = requestAnimationFrame(tick); }
    if (!canAnimate() && frame) { cancelAnimationFrame(frame);frame = 0; }
  }
  function updateToggle() {
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', paused ? 'Play thread animation' : 'Pause thread animation');
    toggle.firstElementChild.textContent = paused ? '▷' : 'Ⅱ';
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;height = rect.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }
  new ResizeObserver(resize).observe(canvas);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => { inView = entries[0].isIntersecting;resume(); }).observe(canvas);
  }
  canvas.parentElement.addEventListener('pointermove', event => {
    const rect = canvas.getBoundingClientRect();
    pointer = { x: (event.clientX - rect.left) / width - .5, y: (event.clientY - rect.top) / height - .5 };
  });
  canvas.parentElement.addEventListener('pointerleave', () => { pointer = { x: 0, y: 0 }; });
  toggle.addEventListener('click', () => { paused = !paused;updateToggle();resume(); });
  reducedMotion.addEventListener('change', event => { paused = event.matches;updateToggle();draw();resume(); });
  document.addEventListener('visibilitychange', resume);
  updateToggle();resize();resume();
})();
