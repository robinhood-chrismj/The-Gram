let isSending = false;

async function waitForComposer() {
  console.log("[VanishLogo DEBUG] Scanning for composer...");
  for (let i = 0; i < 60; i++) {
    const el = document.querySelector('[contenteditable="true"], div[role="textbox"], .input-message-input');
    if (el && el.isContentEditable && el.offsetParent !== null) {
      console.log("[VanishLogo DEBUG] Composer found:", el);
      return el;
    }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error("Composer not found after 18s");
}

async function dropFileOnComposer(composer, file) {
  console.log("[VanishLogo DEBUG] Creating enhanced DataTransfer...");
  const dt = new DataTransfer();
  dt.items.add(file);
  dt.effectAllowed = 'copy';  // Key: Makes it "trusted" like real drag
  dt.dropEffect = 'copy';

  console.log("[VanishLogo DEBUG] Dispatching dragover + drop...");
  
  // Enhanced events with coordinates + types
  const dragOver = new DragEvent('dragover', { 
    bubbles: true, 
    cancelable: true, 
    dataTransfer: dt,
    clientX: composer.getBoundingClientRect().left + 10,
    clientY: composer.getBoundingClientRect().top + 10
  });
  const drop = new DragEvent('drop', { 
    bubbles: true, 
    cancelable: true, 
    dataTransfer: dt,
    clientX: composer.getBoundingClientRect().left + 10,
    clientY: composer.getBoundingClientRect().top + 10
  });

  composer.dispatchEvent(dragOver);
  await new Promise(r => setTimeout(r, 100));  // Let dragover process
  composer.dispatchEvent(drop);

  // Also trigger paste as fallback (Telegram handles both)
  const pasteEvent = new ClipboardEvent('paste', { 
    bubbles: true, 
    clipboardData: dt 
  });
  composer.dispatchEvent(pasteEvent);
  console.log("[VanishLogo DEBUG] Events dispatched (drag + paste fallback)");
}

async function waitForMediaPreview() {
  console.log("[VanishLogo DEBUG] Polling for preview (broad selectors)...");
  for (let i = 0; i < 80; i++) {  // 12s total
    // Broad detection: Any new img, media div, or input changes
    const previewSelectors = [
      '[data-testid="media-preview"]',
      '.media-preview',
      '.input-message-image',
      '.message-input-media',
      'img[src^="data:image"]',  // DataURL images
      '.input-message-container img',  // Inline previews
      '.composer-preview'  // Generic
    ];
    
    for (const sel of previewSelectors) {
      const preview = document.querySelector(sel);
      if (preview) {
        console.log("[VanishLogo DEBUG] Preview found with selector:", sel);
        return true;
      }
    }
    
    // Also check if composer has child img now
    const composer = document.querySelector('[contenteditable="true"], div[role="textbox"]');
    if (composer && composer.querySelector('img')) {
      console.log("[VanishLogo DEBUG] Preview found inside composer (img child)");
      return true;
    }

    await new Promise(r => setTimeout(r, 150));
  }
  
  // Debug: Log current DOM state
  console.log("[VanishLogo DEBUG] No preview after 12s. Composer HTML:", 
    document.querySelector('[contenteditable="true"], div[role="textbox"]')?.innerHTML || 'EMPTY');
  console.log("[VanishLogo DEBUG] All imgs on page:", document.querySelectorAll('img').length);
  
  throw new Error("Media preview never appeared after 12s");
}

async function set10SecondTimer() {
  console.log("[VanishLogo DEBUG] Looking for timer button...");
  const btnSelectors = [
    'button[aria-label*="timer" i]',
    '[data-testid="timer-button"]',
    '.btn-icon.tgico-timer',
    'button:has(i.tgico-timer)'  // CSS :has if supported
  ];
  
  let btn = null;
  for (const sel of btnSelectors) {
    btn = document.querySelector(sel);
    if (btn) {
      console.log("[VanishLogo DEBUG] Timer button found:", sel);
      break;
    }
  }
  
  if (!btn) {
    console.log("[VanishLogo DEBUG] No timer button — sending as normal photo");
    return false;
  }

  btn.click();
  await new Promise(r => setTimeout(r, 500));

  console.log("[VanishLogo DEBUG] Looking for 10s option...");
  const option = Array.from(document.querySelectorAll('.MenuItem, [role="menuitem"], .popup .list-item, .option-item'))
    .find(el => {
      const text = (el.textContent || el.innerText || '').toLowerCase();
      return text.includes('10 sec') || text.includes('10 seconds');
    });

  if (option) {
    option.click();
    await new Promise(r => setTimeout(r, 300));
    console.log("[VanishLogo DEBUG] 10s timer selected");
    return true;
  }
  
  console.log("[VanishLogo DEBUG] No 10s option found");
  return false;
}

async function pressEnter() {
  const composer = document.querySelector('[contenteditable="true"], div[role="textbox"]');
  if (!composer) {
    console.log("[VanishLogo DEBUG] No composer for Enter");
    return;
  }

  console.log("[VanishLogo DEBUG] Pressing Enter...");
  const ev = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    bubbles: true,
    cancelable: true,
    composed: true
  });
  composer.focus();
  composer.dispatchEvent(ev);
}

async function sendDisappearingPhoto(dataUrl) {
  if (isSending) {
    console.log("[VanishLogo DEBUG] Already sending — skipping");
    return;
  }
  isSending = true;

  try {
    console.log("[VanishLogo] Starting send...");
    const composer = await waitForComposer();

    // Convert to File
    console.log("[VanishLogo] Fetching logo blob...");
    const resp = await fetch(dataUrl);
    const blob = await resp.blob();
    const file = new File([blob], "logo.png", { type: blob.type || "image/png" });
    console.log("[VanishLogo] Blob ready, size:", blob.size);

    // Drop it
    await dropFileOnComposer(composer, file);

    // Wait & detect
    await waitForMediaPreview();

    // Timer
    const timerSet = await set10SecondTimer();

    await new Promise(r => setTimeout(r, 500));
    await pressEnter();

    console.log(`[VanishLogo] SUCCESS: Photo sent${timerSet ? ' with 10s timer' : ' (normal photo)'}!`);

  } catch (err) {
    console.error("[VanishLogo] FAILED:", err.message);
    // Fallback: Clear composer if stuck
    const composer = document.querySelector('[contenteditable="true"], div[role="textbox"]');
    if (composer) composer.innerHTML = '';
  } finally {
    isSending = false;
  }
}

// Listen
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg.action === "sendDisappearingPhoto") {
    sendDisappearingPhoto(msg.dataUrl);
    respond({ ok: true });
  }
  return true;
});

console.log("[VanishLogo] Loaded with DEBUG mode — check console for details");