export function mountPet(root) {
  const button = root.querySelector(".desktop-pet");
  if (!button) return;
  const sprite = button.querySelector(".pet-sprite");
  let jump;
  button.addEventListener("click", () => {
    jump?.cancel();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    jump = sprite.animate([{ translate: "0 0" }, { translate: "0 -19px", offset: 0.42 }, { translate: "0 0" }],
      { duration: 340, easing: "ease-out" });
  });
}
