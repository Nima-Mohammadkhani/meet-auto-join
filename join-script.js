// Injected into meet.google.com after the extension opens the tab.
// Runs in an isolated world: has access to chrome.storage / chrome.runtime,
// but not to the page's own JS. Only DOM access is needed here.

(function () {
  const NAME_RE = /(your\s*name|display\s*name|^name$|نام\s*شما|نام)/i;
  const JOIN_RE = /(join now|ask to join|present now|join meeting|اکنون بپیوندید|درخواست پیوستن|بپیوندید)/i;
  const MIC_OFF_RE = /turn off microphone|میکروفون.*خاموش/i;
  const CAM_OFF_RE = /turn off camera|دوربین.*خاموش/i;

  const MAX_TICKS = 40; // ~28s
  const TICK_MS = 700;

  let ticks = 0;
  let joined = false;
  let nameFilled = false;

  function isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none";
  }

  function setNativeValue(input, value) {
    const proto = Object.getPrototypeOf(input);
    const desc =
      Object.getOwnPropertyDescriptor(proto, "value") ||
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    if (desc && desc.set) {
      desc.set.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function findNameInput() {
    const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'));
    const visible = inputs.filter(isVisible);
    // Prefer one whose placeholder/aria-label mentions "name"
    const byLabel = visible.find((i) => {
      const label = `${i.getAttribute("placeholder") || ""} ${i.getAttribute("aria-label") || ""}`;
      return NAME_RE.test(label);
    });
    if (byLabel) return byLabel;
    // Fallback: if there's exactly one visible text input on a pre-join screen, use it.
    if (visible.length === 1) return visible[0];
    return null;
  }

  function findButtonByText(re) {
    const candidates = Array.from(document.querySelectorAll('button, [role="button"]'));
    for (const el of candidates) {
      const text = (el.textContent || "").trim();
      if (re.test(text) && isVisible(el) && !el.disabled) {
        return el;
      }
    }
    return null;
  }

  function tryFillName(displayName) {
    if (nameFilled || !displayName) return;
    const input = findNameInput();
    if (input && !input.value) {
      setNativeValue(input, displayName);
      nameFilled = true;
    }
  }

  function tryMute(muteBeforeJoin) {
    if (!muteBeforeJoin) return;
    const mic = findButtonByText(MIC_OFF_RE);
    if (mic) mic.click();
    const cam = findButtonByText(CAM_OFF_RE);
    if (cam) cam.click();
  }

  function tryJoin() {
    if (joined) return;
    const btn = findButtonByText(JOIN_RE);
    if (btn) {
      btn.click();
      joined = true;
    }
  }

  function reportResult() {
    try {
      chrome.runtime.sendMessage({ type: "join-result", joined });
    } catch (e) {
      // Extension context may already be gone if the tab navigated away; ignore.
    }
  }

  function tick(displayName, muteBeforeJoin) {
    ticks += 1;
    if (!joined) {
      tryFillName(displayName);
      tryMute(muteBeforeJoin);
      tryJoin();
    }
    if (joined || ticks >= MAX_TICKS) {
      clearInterval(timer);
      reportResult();
    }
  }

  let timer;
  chrome.storage.sync.get(
    { displayName: "", muteBeforeJoin: false },
    ({ displayName, muteBeforeJoin }) => {
      timer = setInterval(() => tick(displayName, muteBeforeJoin), TICK_MS);
      tick(displayName, muteBeforeJoin);
    }
  );
})();
