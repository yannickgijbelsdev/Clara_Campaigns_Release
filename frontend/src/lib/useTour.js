import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { getTourSteps } from "@/lib/tours";

export function startTour(pathname) {
  const steps = getTourSteps(pathname);
  if (!steps) return false;
  const usable = steps.filter((s) => !s.element || document.querySelector(s.element));
  if (!usable.length) return false;

  const d = driver({
    showProgress: usable.length > 1,
    allowClose: true,
    overlayColor: "rgba(15,23,42,0.55)",
    stagePadding: 6,
    stageRadius: 14,
    popoverClass: "clara-tour",
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Got it",
    steps: usable,
    onPopoverRender: (popover) => {
      const bear = document.createElement("img");
      bear.src = "/koodh-avatar.png";
      bear.alt = "";
      bear.className = "clara-tour-bear";
      popover.wrapper.prepend(bear);
    },
  });
  d.drive();
  return true;
}
