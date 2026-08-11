const GAME_DURATION = 10;
const TARGET_SIZE = 72;
const EDGE_PADDING = 12;

const gameArea = document.querySelector("#game-area");
const intro = document.querySelector("#intro");
const result = document.querySelector("#result");
const target = document.querySelector("#target");
const scoreDisplay = document.querySelector("#score");
const timeDisplay = document.querySelector("#time");
const finalScore = document.querySelector("#final-score");
const startButton = document.querySelector("#start-button");
const retryButton = document.querySelector("#retry-button");

let score = 0;
let endTime = 0;
let timerId = null;
let playing = false;

function moveTarget() {
  const maxX = Math.max(0, gameArea.clientWidth - TARGET_SIZE - EDGE_PADDING * 2);
  const maxY = Math.max(0, gameArea.clientHeight - TARGET_SIZE - EDGE_PADDING * 2);
  target.style.left = `${EDGE_PADDING + Math.random() * maxX}px`;
  target.style.top = `${EDGE_PADDING + Math.random() * maxY}px`;
}

function updateTimer() {
  const remaining = Math.max(0, endTime - performance.now());
  timeDisplay.textContent = Math.ceil(remaining / 1000);

  if (remaining <= 0) {
    finishGame();
  }
}

function startGame() {
  score = 0;
  playing = true;
  scoreDisplay.textContent = "00";
  timeDisplay.textContent = GAME_DURATION;
  intro.hidden = true;
  result.hidden = true;
  target.hidden = false;
  moveTarget();

  endTime = performance.now() + GAME_DURATION * 1000;
  clearInterval(timerId);
  timerId = setInterval(updateTimer, 50);
}

function finishGame() {
  playing = false;
  clearInterval(timerId);
  timerId = null;
  timeDisplay.textContent = "0";
  target.hidden = true;
  finalScore.textContent = score;
  result.hidden = false;
}

function hitTarget(event) {
  event.preventDefault();
  if (!playing || performance.now() >= endTime) {
    finishGame();
    return;
  }

  score += 1;
  scoreDisplay.textContent = String(score).padStart(2, "0");
  target.classList.remove("pop");
  void target.offsetWidth;
  target.classList.add("pop");
  moveTarget();
}

startButton.addEventListener("click", startGame);
retryButton.addEventListener("click", startGame);
target.addEventListener("pointerdown", hitTarget);
window.addEventListener("resize", () => playing && moveTarget());
document.addEventListener("visibilitychange", () => {
  if (document.hidden && playing) finishGame();
});
