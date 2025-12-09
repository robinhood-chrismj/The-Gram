let sendInterval = null;
let intervalSec = 10;
let autoEnabled = false;

const LOGO_URL = "https://telegram.org/img/t_logo.png";

async function sendLogo() {
  try {
    const resp = await fetch(LOGO_URL);
    if (!resp.ok) throw new Error("Failed to fetch logo");
    const blob = await resp.blob();
    const reader = new FileReader();
    reader.onload = async () => {
      const tabs = await chrome.tabs.query({ url: "https://web.telegram.org/a/*" });
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: "sendDisappearingPhoto",
            dataUrl: reader.result
          });
          console.log("[BG] Logo sent to tab:", tab.id);
          return;
        } catch (e) { /* tab not ready */ }
      }
    };
    reader.readAsDataURL(blob);
  } catch (err) {
    console.error("[BG] Failed:", err);
  }
}

function startAuto(sec) {
  stopAuto();
  intervalSec = Math.max(5, sec || 10);
  autoEnabled = true;
  sendInterval = setInterval(() => {
    if (Math.random() < 0.93) sendLogo();
  }, intervalSec * 1000);
  chrome.storage.local.set({ autoEnabled: true, intervalSec });
}

function stopAuto() {
  if (sendInterval) clearInterval(sendInterval);
  sendInterval = null;
  autoEnabled = false;
  chrome.storage.local.set({ autoEnabled: false });
}

function updateInterval(sec) {
  intervalSec = Math.max(5, sec || 10);
  chrome.storage.local.set({ intervalSec });
  if (autoEnabled) startAuto(intervalSec);
}

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  switch (msg.action) {
    case "startAuto": startAuto(msg.intervalSec); respond({ok: true}); break;
    case "stopAuto": stopAuto(); respond({ok: true}); break;
    case "updateInterval": updateInterval(msg.intervalSec); respond({ok: true}); break;
  }
  return true;
});

// Restore state
chrome.storage.local.get(["autoEnabled", "intervalSec"], (d) => {
  if (d.autoEnabled) startAuto(d.intervalSec || 10);
});