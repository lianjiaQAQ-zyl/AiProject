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
  let jump;
  button.addEventListener("click", () => {
    toggleClickAudio();
    jump?.cancel();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    jump = sprite.animate([{ translate: "0 0" }, { translate: "0 -19px", offset: 0.42 }, { translate: "0 0" }],
      { duration: 340, easing: "ease-out" });
  });
}
