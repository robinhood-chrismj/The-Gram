document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("enabled");
  const input = document.getElementById("item");

  chrome.storage.local.get(["autoEnabled", "intervalSec"], (d) => {
    toggle.checked = !!d.autoEnabled;
    input.value = d.intervalSec || 10;
  });

  toggle.addEventListener("change", () => {
    const sec = Math.max(5, Number(input.value) || 10);
    input.value = sec;
    chrome.storage.local.set({ 
      autoEnabled: toggle.checked, 
      intervalSec: sec 
    });
    chrome.runtime.sendMessage({
      action: toggle.checked ? "startAuto" : "stopAuto",
      intervalSec: sec
    });
  });

  input.addEventListener("change", () => {
    let sec = Math.max(5, Number(input.value) || 10);
    input.value = sec;
    chrome.storage.local.set({ intervalSec: sec });
    if (toggle.checked) {
      chrome.runtime.sendMessage({ action: "updateInterval", intervalSec: sec });
    }
  });
});