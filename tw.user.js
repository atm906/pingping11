// ==UserScript==
// @name          tixcraft
// @match         https://tixcraft.com/activity/game/*
// @match         https://tixcraft.com/ticket/verify/*
// @match         https://tixcraft.com/ticket/area/*
// @match         https://tixcraft.com/ticket/ticket/*
// @grant         none
// @run-at        document-start
// ==/UserScript==

/* ==== 可調整設定區 ==== */
const TARGET_DATE_INDEX = 0; // 選擇第幾個場次 (0 為第一個)
const TARGET_AREAS = ["2800", "1800", "3800"]; // 偏好區域，會依照順序找，找到第一個有票的就選。
const ONLY_SELECT_TARGET_AREAS = false; // 僅選擇 TARGET_AREAS 中的區域
const RANDOM_SELECT_IF_NO_TARGET_AREA = true; // 若偏好區域無票，是否隨機選擇其他有票區域
const AREA_SORT_ORDER = 'asc'; // 區域排序: 'desc' (價格高到低) 或 'asc' (價格低到高)
const TARGET_TICKET_COUNT = 2; // 搶票張數 (會從這個數字開始往下找)
const CARD_FIRST6 = "51571328"; // 信用卡卡號前六碼，用於身份驗證
const SIMULATE_MOUSE_MOVE = true; // 是否啟用全局滑鼠移動模擬 (已保留)
const REFRESH_INTERVAL = 6666; // 偵測到無票時的刷新間隔 (毫秒)
const FOCUS_VERIFY_DELAY = 50; // 焦點延遲 (已整合到人工延遲中，可忽略)
const USE_HUMAN_CLICK = true; // 必須為 true，才能啟用模擬點擊 (已保留)
const ENABLE_AUTO_CAPTCHA = false; // 保持為 false


function simulateHumanMouseMove(targetX = 200, targetY = 200, steps = 20, delay = 15) {
  const startX = Math.floor(Math.random() * window.innerWidth);
  const startY = Math.floor(Math.random() * window.innerHeight);
  let currentStep = 0;

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function moveStep() {
    const t = currentStep / steps;
    // 模擬不規則路徑
    const x = Math.floor(lerp(startX, targetX, t) + Math.sin(t * Math.PI) * 20);
    const y = Math.floor(lerp(startY, targetY, t) + Math.cos(t * Math.PI) * 20);

    const event = new MouseEvent("mousemove", {
      clientX: x,
      clientY: y,
      bubbles: true,
      cancelable: true,
      view: window
    });
    document.dispatchEvent(event);

    currentStep++;
    if (currentStep <= steps) {
      setTimeout(moveStep, delay + Math.random() * 10);
    }
  }

  moveStep();
}

// 自動捲動模擬 (保留)
function simulateHumanScroll(min = 30, max = 60) {
  const scrollUp = -(min + Math.floor(Math.random() * (max - min)));
  window.scrollBy({
    top: scrollUp,
    behavior: 'smooth'
  });
}

// 執行模擬：延遲觸發一次 (保留)
window.addEventListener('load', () => {
  setTimeout(() => {
    simulateHumanScroll();

    simulateHumanMouseMove(
      Math.floor(window.innerWidth * 0.3 + Math.random() * 0.4 * window.innerWidth),
      Math.floor(window.innerHeight * 0.3 + Math.random() * 0.4 * window.innerHeight)
    );
  }, 600 + Math.random() * 800);
});
// --- 防偵測模組 End ---


// MutationObserver 加速流程 (保留)
const observer = new MutationObserver(() => {
  const url = location.href;

  if (/\/activity\/game\//.test(url)) {
    const checkExist = setInterval(() => {
      if (document.querySelector("table")) {
        clearInterval(checkExist);
        observer.disconnect();
        main();
      }
    }, 50);
  }
  if (url.includes("/ticket/verify/")) {
    if (document.querySelector("input[name='checkCode']")) {
      observer.disconnect();
      main();
    }
  }
  if (url.includes("/ticket/area/")) {
    if (document.querySelector("ul.area-list > li, ul.area_list > li")) {
      observer.disconnect();
      main();
    }
  }
  if (url.includes("/ticket/ticket/")) {
    if (document.querySelector("select.mobile-select")) {
      observer.disconnect();
      main();
    }
  }
});
observer.observe(document, { childList: true, subtree: true });

function main() {
  if (window.__mainStarted) return;
  window.__mainStarted = true;
  runMainLogic();
}

function runMainLogic() {
  let hasFocusedVerify = false;
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const log = (...args) => console.log("[LOG]", ...args);

// 核心：模擬人類點擊動作 (mousemove, mousedown, mouseup) (保留)
async function clickElementHumanLike(el) {
  if (!el) return;

  const rect = el.getBoundingClientRect();
  const jitterX = (Math.random() - 0.5) * 10; // ±5px 隨機晃動
  const jitterY = (Math.random() - 0.5) * 10;

  const clickX = rect.left + rect.width / 2 + jitterX;
  const clickY = rect.top + rect.height / 2 + jitterY;

  // 模擬滑鼠移動到目標元素
  el.dispatchEvent(new MouseEvent("mousemove", { clientX: clickX, clientY: clickY, bubbles: true }));
  // 加速: 10~30ms 延遲
  await sleep(10 + Math.random() * 20);

  // 模擬點擊過程 (mousedown, mouseup)
  el.dispatchEvent(new MouseEvent("mousedown", { clientX: clickX, clientY: clickY, bubbles: true }));
  // 加速: 10~30ms 延遲
  await sleep(10 + Math.random() * 20);
  el.dispatchEvent(new MouseEvent("mouseup", { clientX: clickX, clientY: clickY, bubbles: true }));

  // 使用原始的 .click() 完成導航或觸發事件
  el.click();

  // 額外延遲，避免腳本執行過快
  await sleep(50 + Math.random() * 100);
}

// 主流程函數：每載入一個頁面執行一次
async function processPage() {
    const url = location.href;

    // 步驟 1: 選擇場次頁面 (tixcraft.com/activity/game/*)
    if (/\/activity\/game\//.test(url)) {
      const rows = Array.from(document.querySelectorAll("table tr"))
        .filter(row => row.querySelector("button.btn-primary"));
      if (rows.length === 0 || TARGET_DATE_INDEX >= rows.length) {
        setTimeout(() => location.href = location.href, REFRESH_INTERVAL);
        return;
      }
      const btn = rows[TARGET_DATE_INDEX].querySelector("button.btn-primary");

      if (btn) {
        await clickElementHumanLike(btn); // 執行點擊並等待導航
      } else {
        setTimeout(() => location.reload(), REFRESH_INTERVAL);
      }
      return;
    }

// 步驟 2: 身份驗證頁面 (tixcraft.com/ticket/verify/*)
if (url.includes("/ticket/verify/")) {
    window.confirm = () => true;
    const input = document.querySelector("input[name='checkCode']");
    const submitBtn = document.querySelector("button[type='submit'].btn.btn-primary");

    if (input && submitBtn) {
        log("步驟 2/4: 處理身份驗證...");

        // 智能取得驗證碼邏輯 (保持不變)
        let redElements = Array.from(document.querySelectorAll("span[style*='color'], font[color='red'], span.text-danger, .text-danger"))
            .filter(el => el.innerText.trim() !== "紅色文字");
        let code = "";
        if (redElements.length > 0) {
            code = redElements.map(el => el.innerText.trim()).join("");
        } else {
            const text = document.body.innerText;
            const match = text.match(/請於下方空格填入[：:]\s*([^\s，,]+)/);
            code = match ? match[1] : CARD_FIRST6;
        }

        // *** 加速：移除不必要的 sleep，直接填入值 ***
        input.value = code;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        // *** 填入完成後，立即點擊 ***

        // 點擊函式 clickElementHumanLike() 本身包含 100-200ms 的隨機延遲，已保留人為操作的模擬。
        await clickElementHumanLike(submitBtn);
    } else {
        // 如果元素還沒出現，等 REFRESH_INTERVAL 後刷新頁面
        setTimeout(() => location.reload(), REFRESH_INTERVAL);
    }
    return;
}

    // 步驟 3: 選擇區域頁面 (tixcraft.com/ticket/area/*)
    if (url.includes("/ticket/area/")) {
      const listItems = Array.from(document.querySelectorAll("ul.area-list > li, ul.area_list > li"));
      const available = listItems.filter(li => !/售完|無票|無剩/.test(li.textContent));

      if (available.length === 0) {
        await sleep(REFRESH_INTERVAL);
        location.href = location.href;
        return;
      }

      let matched = available.filter(li => TARGET_AREAS.some(k => li.textContent.includes(k)));
      if (matched.length === 0 && RANDOM_SELECT_IF_NO_TARGET_AREA) matched = available;

      if (matched.length === 0) {
        await sleep(REFRESH_INTERVAL);
        location.href = location.href;
        return;
      }

// 區域排序 - 優化價格提取
      matched.sort((a, b) => {
        // 新的價格提取邏輯：尋找所有數字，並假設票價是倒數第二個或最接近末尾的大數字 (通常在區域名稱之後)
        const numsA = a.textContent.match(/\d+/g) || [];
        const numsB = b.textContent.match(/\d+/g) || [];

        // 嘗試選取倒數第二個數字 (通常是票價，避免抓到剩餘張數)
        // 如果沒有倒數第二個，則選取最後一個
        const priceA = parseInt(numsA[numsA.length - 2] || numsA[numsA.length - 1] || "0");
        const priceB = parseInt(numsB[numsB.length - 2] || numsB[numsB.length - 1] || "0");

        // 確保價格不是小於 1000 的數字 (過濾區號)
        const finalPriceA = priceA < 1000 ? parseInt(numsA[numsA.length - 1] || "0") : priceA;
        const finalPriceB = priceB < 1000 ? parseInt(numsB[numsB.length - 1] || "0") : priceB;

        // 執行排序
        return AREA_SORT_ORDER === 'asc' ? finalPriceA - finalPriceB : finalPriceB - finalPriceA;
      });

      const anchor = matched[0].querySelector("a") || matched[0];
      await sleep(30 + Math.random() * 50); // 區域選擇延遲加速
      await clickElementHumanLike(anchor);
      return;
    }

    // 步驟 4: 購票明細及驗證碼頁面 (tixcraft.com/ticket/ticket/*)
    if (url.includes("/ticket/ticket/")) {
      const ticketSelect = document.querySelector("select.mobile-select");
      const agree = document.querySelector("#agree") || document.querySelector("input[type='checkbox']");
      const verifyInput = Array.from(document.querySelectorAll("input")).find(el =>
        /verify/i.test(el.id || el.name || "") || /驗證碼/.test(el.placeholder || "")
      );

      if (!ticketSelect) {
        await sleep(REFRESH_INTERVAL);
        return;
      }


      // 1. 選擇張數
      for (let i = TARGET_TICKET_COUNT; i > 0; i--) {
        const option = Array.from(ticketSelect.options).find(o => parseInt(o.value) === i && !o.disabled);
        if (option) {
          ticketSelect.value = option.value;
          ticketSelect.dispatchEvent(new Event('change', { bubbles: true }));
          await sleep(50 + Math.random() * 50); // 選擇張數延遲
          break;
        }
      }

      // 2. 勾選同意條款
      if (agree && !agree.checked) {
        await clickElementHumanLike(agree);
        await sleep(50 + Math.random() * 50); // 勾選延遲
      }

      // 3. 驗證碼處理
      if (verifyInput && !hasFocusedVerify) {
        hasFocusedVerify = true;


        // 模擬人類點擊輸入框
        await clickElementHumanLike(verifyInput);
        verifyInput.focus(); // 確保焦點

        const captchaImage = document.querySelector("#TicketForm_verifyCode-image");
        if (captchaImage) {
          // 放大圖片方便手動辨識
          captchaImage.style.transform = "scale(3)";
          captchaImage.style.transformOrigin = "center center";
          captchaImage.style.display = "block";
          captchaImage.style.margin = "20px auto";
        }
        // 腳本在此處停止，等您手動操作。
      }
      return;
    }

    // 若頁面內容不符合預期 (如伺服器錯誤)，則刷新
    setTimeout(() => location.reload(), REFRESH_INTERVAL);
  }

  // 啟動主流程
  processPage();
}