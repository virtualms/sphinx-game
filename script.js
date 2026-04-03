/* La Sfinge — Game Logic
 * Answers are stored exclusively as SHA-256 hashes (CryptoJS).
 * Raw answers are never present in this file.
 */

'use strict';

// ── Riddle Database ──────────────────────────────────────────────────────────
// Each entry:  { title, text, hash }
// Hashes are SHA-256 of the normalised answer (lowercase, single-space trimmed).
// Correct answers (for reference only, never stored here):
//   1 → "uomo"
//   2 → "giorno e notte"
//   3 → "ombra"
//   4 → "tempo"
//   5 → "vento"
const RIDDLES = [
  {
    title: 'Ciò Che Sei',
    text:  'Chi è quell\'animale che al mattino cammina con quattro zampe, ' +
           'a mezzogiorno con due e alla sera con tre?',
    hash:  '1f4b501cdaf38b8ed380f8cfd95e8afaa72d20a2bd076a4607b2a935e1438969',
  },
  {
    title: 'Il Ciclo Infinito',
    text:  'Vi sono due sorelle, delle quali l\'una genera l\'altra ' +
           'e la seconda, a sua volta, genera la prima. Chi sono?',
    hash:  '2c9d2fc2108513bb1e1a69b814562f892195ca38ad446330afbe1ec47c9fad8c',
  },
  {
    title: 'Quello Che Non Esiste',
    text:  'Non ho voce, ma urlo se mi calpesti. ' +
           'Non ho ali, ma volo quando mi liberi. ' +
           'Sono il confine tra ciò che è stato e ciò che sarà, ' +
           'ma non esisto mai nel presente. Chi sono?',
    hash:  'e393d2af86a51b0b347db1a8c887857f99ea890543c1d1c1c64c4c7e39021004',
  },
  {
    title: 'L\'Inesorabile Divoratore',
    text:  'Questa cosa ogni cosa divora: ciò che ha vita, la fauna e la flora…',
    hash:  '8d6546721a1d106cf8d27f7326ebae7e83c1592aeb7479b8f7ec9d8d700d464f',
  },
  {
    title: 'Ovunque Pervade',
    text:  'Senza ali vola, senza voci urla, senza denti morde, senza bocca mormora.',
    hash:  '0b9c8acadd9f05997432738a1e38fa9561a0e781c39aba14fac7adee104559b1',
  },
];

// ── Prize URL ────────────────────────────────────────────────────────────────
// TODO: Replace with the actual prize/destination URL before deployment.
const PRIZE_URL = 'https://gifft.me/o/eg/v4n1sr36vufvetmyc83uhifc'; // ← update this URL

// ── Roman numerals ───────────────────────────────────────────────────────────
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

// ── State ────────────────────────────────────────────────────────────────────
let currentLevel = 0;
let isMusicPlaying = false;
let wrathLevel = 0; // 0-5, tracks consecutive wrong answers
let wrathMessageTimeout = null;
let isGameOver = false; // blocks all input after death

// ── DOM References ───────────────────────────────────────────────────────────
const screenIntro   = document.getElementById('screen-intro');
const screenRiddle  = document.getElementById('screen-riddle');
const screenVictory = document.getElementById('screen-victory');

const btnStart      = document.getElementById('btn-start');
const btnSubmit     = document.getElementById('btn-submit');
const btnRestart    = document.getElementById('btn-restart');
const btnMute       = document.getElementById('btn-mute');
const bgMusic       = document.getElementById('bg-music');
const victoryMusic  = document.getElementById('victory-music');
const errorSound    = document.getElementById('error-sound');
const deathSound    = document.getElementById('death-sound');
const screenDeath   = document.getElementById('screen-death');

const answerInput   = document.getElementById('answer-input');
const riddleTitle   = document.getElementById('riddle-title');
const riddleText    = document.getElementById('riddle-text');
const levelNumber   = document.getElementById('level-number');
const errorMsg      = document.getElementById('error-msg');
const progressBar   = document.getElementById('progress-bar');
const riddleCard    = document.getElementById('riddle-card');
const prizeLink     = document.getElementById('prize-link');
const wrathOverlay  = document.getElementById('wrath-overlay');
const wrathMessage  = document.getElementById('wrath-message');
const sandParticles = document.getElementById('sand-particles');

// ── Wrath Messages ───────────────────────────────────────────────────────────
const WRATH_MESSAGES = [
  '', // 0 errors
  'La Sfinge osserva...',
  'Non giocare con me, mortale...',
  'La tua arroganza mi offende!',
  'Un altro errore e la rovina sarà tua...',
  'LA SFINGE DECIDE LA TUA FINE',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalise a user answer: lowercase + collapse/trim whitespace.
 * @param {string} raw
 * @returns {string}
 */
function normalise(raw) {
  return raw.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Compute SHA-256 hex digest via CryptoJS.
 * @param {string} str
 * @returns {string}
 */
function sha256(str) {
  return CryptoJS.SHA256(str).toString(CryptoJS.enc.Hex);
}

/**
 * Show a screen and hide the others.
 * @param {HTMLElement} target
 */
function showScreen(target) {
  [screenIntro, screenRiddle, screenVictory].forEach(s => {
    if (s === target) {
      s.classList.remove('hidden');
      s.classList.add('active');
    } else {
      s.classList.remove('active');
      s.classList.add('hidden');
    }
  });
}

/**
 * Update the progress bar based on current level.
 */
function updateProgress() {
  const pct = (currentLevel / RIDDLES.length) * 100;
  progressBar.style.width = pct + '%';
}

/**
 * Render the current riddle onto the screen.
 */
function renderRiddle() {
  const riddle = RIDDLES[currentLevel];
  levelNumber.textContent = 'Enigma ' + ROMAN[currentLevel];
  riddleTitle.textContent = riddle.title;
  riddleText.textContent  = riddle.text;
  answerInput.value       = '';
  errorMsg.classList.add('hidden');
  updateProgress();

  // Animate card entrance
  riddleCard.classList.remove('animate__fadeInUp', 'animate__fadeIn');
  void riddleCard.offsetWidth; // force reflow to restart animation
  riddleCard.classList.add('animate__animated', 'animate__fadeInUp');
}

/**
 * Trigger the shake error animation on the riddle card.
 */
function triggerError() {
  errorMsg.classList.remove('hidden');

  // Flash input red
  answerInput.classList.add('error-flash');
  setTimeout(() => answerInput.classList.remove('error-flash'), 500);

  // Play error sound
  errorSound.currentTime = 0;
  errorSound.play().catch(() => {});

  // Increase wrath
  incrementWrath();
}

/**
 * Increment wrath level and apply visual effects.
 */
function incrementWrath() {
  if (wrathLevel >= 5) return;
  wrathLevel++;

  // Update overlay class
  wrathOverlay.className = 'wrath-overlay';
  if (wrathLevel > 0) {
    wrathOverlay.classList.add('level-' + wrathLevel);
  }

  // Screen shake
  if (wrathLevel >= 3) {
    document.body.classList.remove('shake-mild', 'shake-heavy');
    void document.body.offsetWidth;
    document.body.classList.add(wrathLevel >= 4 ? 'shake-heavy' : 'shake-mild');
    setTimeout(() => document.body.classList.remove('shake-mild', 'shake-heavy'), 600);
  }

  // Sphinx anger
  updateSphinxAnger();

  // Sand particles
  updateSandParticles();

  // Show wrath message
  showWrathMessage(wrathLevel);

  // DEATH at wrath level 5
  if (wrathLevel >= 5) {
    setTimeout(triggerDeath, 1500);
  }
}

/**
 * Reset wrath to calm state.
 */
function resetWrath() {
  wrathLevel = 0;
  wrathOverlay.className = 'wrath-overlay';
  document.body.classList.remove('shake-mild', 'shake-heavy');
  wrathMessage.classList.remove('visible');
  wrathMessage.classList.add('hidden');

  // Reset sphinx icons
  document.querySelectorAll('.sphinx-icon').forEach(icon => {
    icon.classList.remove('wroth', 'enraged');
  });

  // Clear sand particles
  sandParticles.innerHTML = '';

  // Clear any pending message timeout
  if (wrathMessageTimeout) {
    clearTimeout(wrathMessageTimeout);
    wrathMessageTimeout = null;
  }
}

/**
 * Update sphinx icon anger state.
 */
function updateSphinxAnger() {
  document.querySelectorAll('.sphinx-icon').forEach(icon => {
    icon.classList.remove('wroth', 'enraged');
    if (wrathLevel >= 4) {
      icon.classList.add('enraged');
    } else if (wrathLevel >= 2) {
      icon.classList.add('wroth');
    }
  });
}

/**
 * Generate sand particle elements.
 */
function updateSandParticles() {
  sandParticles.innerHTML = '';
  if (wrathLevel < 2) return;

  const count = wrathLevel * 15; // More particles as wrath increases
  for (let i = 0; i < count; i++) {
    const grain = document.createElement('div');
    grain.className = 'sand-grain';
    grain.style.left = Math.random() * 100 + '%';
    grain.style.animationDuration = (2 + Math.random() * 3) + 's';
    grain.style.animationDelay = Math.random() * 2 + 's';
    grain.style.opacity = 0.3 + Math.random() * 0.5;
    grain.style.width = (1 + Math.random() * 2) + 'px';
    grain.style.height = grain.style.width;
    sandParticles.appendChild(grain);
  }
}

/**
 * Show a wrath message temporarily.
 * @param {number} level
 */
function showWrathMessage(level) {
  if (level < 1 || level > 5) return;

  // Clear any existing timeout
  if (wrathMessageTimeout) {
    clearTimeout(wrathMessageTimeout);
  }

  const message = WRATH_MESSAGES[level];
  wrathMessage.textContent = message;
  wrathMessage.classList.remove('hidden');
  wrathMessage.classList.add('visible');

  // Hide message after delay (longer for higher levels)
  const displayTime = level >= 4 ? 3000 : level >= 3 ? 2500 : 2000;
  wrathMessageTimeout = setTimeout(() => {
    wrathMessage.classList.remove('visible');
    wrathMessage.classList.add('hidden');
  }, displayTime);
}

/**
 * Advance to the next level or show victory.
 */
function advanceLevel() {
  riddleCard.classList.add('correct-flash');
  riddleCard.addEventListener('animationend', () => {
    riddleCard.classList.remove('correct-flash', 'animate__animated', 'animate__fadeInUp');
    currentLevel++;
    // Reset wrath on correct answer!
    resetWrath();
    if (currentLevel >= RIDDLES.length) {
      showVictory();
    } else {
      renderRiddle();
    }
  }, { once: true });
}

/**
 * Launch the victory screen with confetti and heavy metal music.
 */
function showVictory() {
  prizeLink.href = PRIZE_URL;
  updateProgress(); // 100%
  showScreen(screenVictory);
  launchConfetti();
  playVictoryMusic();
}

/**
 * Stop background music and play victory heavy metal.
 */
function playVictoryMusic() {
  // Stop background music
  bgMusic.pause();
  bgMusic.currentTime = 0;
  isMusicPlaying = false;
  btnMute.textContent = '🔇';

  // Play victory music
  victoryMusic.play().catch(() => {});
}

/**
 * Trigger the Dark Souls "YOU DIED" screen.
 */
function triggerDeath() {
  isGameOver = true;

  // Stop all sounds
  bgMusic.pause();
  errorSound.pause();
  victoryMusic.pause();

  // Play death sound
  deathSound.currentTime = 0;
  deathSound.play().catch(() => {});

  // Show death screen
  screenDeath.classList.remove('hidden');
  screenDeath.classList.add('visible');

  // Disable all game controls
  btnSubmit.disabled = true;
  answerInput.disabled = true;
  btnStart.disabled = true;
  btnRestart.disabled = true;
  btnMute.disabled = true;

  // Listen for R key to refresh
  document.addEventListener('keydown', handleDeathRefresh);
}

/**
 * Handle R key press to restart after death.
 * @param {KeyboardEvent} e
 */
function handleDeathRefresh(e) {
  if (e.key === 'r' || e.key === 'R') {
    location.reload();
  }
}

/**
 * Fire canvas-confetti celebration.
 */
function launchConfetti() {
  const duration  = 4000;
  const end       = Date.now() + duration;
  const colors    = ['#c9a84c', '#e8c97a', '#fff7d4', '#7a5f1a', '#ffffff'];

  (function frame() {
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors,
    });
    confetti({
      particleCount: 5,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors,
    });
    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }());
}

// ── Event Handlers ────────────────────────────────────────────────────────────

btnStart.addEventListener('click', () => {
  if (isGameOver) return;
  currentLevel = 0;
  renderRiddle();
  showScreen(screenRiddle);
  answerInput.focus();
});

btnSubmit.addEventListener('click', checkAnswer);

answerInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    checkAnswer();
  }
});

btnRestart.addEventListener('click', () => {
  if (isGameOver) return;
  currentLevel = 0;
  // Stop victory music if playing
  victoryMusic.pause();
  victoryMusic.currentTime = 0;
  // Reset wrath
  resetWrath();
  showScreen(screenIntro);
});

/**
 * Toggle background music on/off.
 */
function toggleMusic() {
  if (isGameOver) return;
  if (isMusicPlaying) {
    bgMusic.pause();
    btnMute.textContent = '🔇';
  } else {
    bgMusic.play().catch(() => {});
    btnMute.textContent = '🔊';
  }
  isMusicPlaying = !isMusicPlaying;
}

btnMute.addEventListener('click', toggleMusic);

/**
 * Start music on first user interaction (browser autoplay policy).
 */
function startMusicOnce() {
  if (isGameOver) return;
  if (!isMusicPlaying && bgMusic.paused) {
    bgMusic.play().catch(() => {});
    isMusicPlaying = true;
    btnMute.textContent = '🔊';
  }
  // Remove listeners after first trigger
  btnStart.removeEventListener('click', startMusicOnce);
  answerInput.removeEventListener('focus', startMusicOnce);
}

btnStart.addEventListener('click', startMusicOnce);
answerInput.addEventListener('focus', startMusicOnce);

/**
 * Validate the current answer.
 */
function checkAnswer() {
  if (isGameOver) return;

  const raw        = answerInput.value;
  const normalised = normalise(raw);

  if (!normalised) {
    triggerError();
    return;
  }

  const digest   = sha256(normalised);
  const expected = RIDDLES[currentLevel].hash;

  if (digest === expected) {
    advanceLevel();
  } else {
    triggerError();
  }
}
