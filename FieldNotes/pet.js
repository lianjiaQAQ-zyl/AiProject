const frameCounts = [6, 8, 8, 4, 5, 8, 6, 6, 6];
const frameDuration = 125;

const spriteFrames = frameCounts.flatMap((count, row) =>
  Array.from({ length: count }, (_, column) => ({
    backgroundPosition: `${-column * 72}px ${-row * 78}px`,
    easing: "steps(1, end)"
  }))
);

const cycleTiming = {
  duration: spriteFrames.length * frameDuration,
  iterations: Infinity
};

const leftEdge = "0px";
const rightEdge = "calc(100% - var(--pet-width))";
const movementFrames = [
  { left: leftEdge, offset: 0 },
  { left: leftEdge, offset: frameCounts[0] / spriteFrames.length },
  { left: rightEdge, offset: (frameCounts[0] + frameCounts[1]) / spriteFrames.length },
  { left: leftEdge, offset: (frameCounts[0] + frameCounts[1] + frameCounts[2]) / spriteFrames.length },
  { left: leftEdge, offset: 1 }
];

let clickAudio;

function toggleClickAudio() {
  clickAudio ??= new Audio(new URL("./assets/pet-click.m4a", import.meta.url));
  if (!clickAudio.paused && !clickAudio.ended) {
    clickAudio.pause();
    clickAudio.currentTime = 0;
    return;
  }
  clickAudio.currentTime = 0;
  void clickAudio.play().catch(error => {
    if (error.name !== "AbortError") console.warn("桌宠音频播放失败。", error);
  });
}

export function mountPet(root) {
  const button = root.querySelector(".desktop-pet");
  if (!button) return;
  const sprite = button.querySelector(".pet-sprite");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const cycle = sprite.animate([...spriteFrames, spriteFrames[0]], cycleTiming);
  const movement = button.animate(movementFrames, cycleTiming);
  movement.startTime = cycle.startTime = document.timeline.currentTime;
  let jump;
  button.addEventListener("click", () => {
    toggleClickAudio();
    jump?.cancel();
    if (reducedMotion.matches) return;
    jump = sprite.animate([{ translate: "0 0" }, { translate: "0 -19px", offset: 0.42 }, { translate: "0 0" }],
      { duration: 340, easing: "ease-out" });
  });
}
