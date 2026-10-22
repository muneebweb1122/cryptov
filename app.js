(function(){
  "use strict";

  const DEFAULT_RPC = "https://bsc-dataseed.binance.org/";
  const TESTNET_RPC = "https://data-seed-prebsc-1-s1.bnbchain.org:8545/";
  const DEFAULT_USDT = "0x55d398326f99059fF775485246999027B3197955";
  const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function transfer(address to, uint256 amount) returns (bool)"
  ];

  let state = { wallet: null, provider: null, tokenAddr: DEFAULT_USDT, rpcUrl: DEFAULT_RPC, decimals: 18, hidden:false, demo:false, demoUsdt:503, network:"mainnet", symbol:"USDT" };

  const $ = (id) => document.getElementById(id);

  function updateBanner(){
    const el = $("demo-banner");
    if(state.demo){
      el.textContent = "DEMO MODE \u2014 simulated balance, not real funds";
      el.style.background = "#F5A623"; el.style.display = "block";
    }else if(state.network === "testnet"){
      el.textContent = "TESTNET \u2014 test tokens only, no real value";
      el.style.background = "#8B5CF6"; el.style.color = "#fff"; el.style.display = "block";
    }else{
      el.style.display = "none";
    }
    if(state.demo) el.style.color = "#000";
  }
  function updateSymbols(){
    document.querySelectorAll(".sym").forEach(e => { e.textContent = state.symbol; });
  }
  function loadTokens(){
    try{ return JSON.parse(localStorage.getItem("cryptoc_tokens_" + state.network) || "[]"); }catch(e){ return []; }
  }
  function saveTokens(list){
    try{ localStorage.setItem("cryptoc_tokens_" + state.network, JSON.stringify(list)); }catch(e){}
  }
  function renderTokenSelect(){
    const sel = $("token-select");
    sel.innerHTML = "";
    loadTokens().forEach(t => {
      const o = document.createElement("option");
      o.value = t.addr;
      o.textContent = t.symbol;
      if(t.addr.toLowerCase() === state.tokenAddr.toLowerCase()) o.selected = true;
      sel.appendChild(o);
    });
  }
  function registerToken(){
    const list = loadTokens();
    if(!list.some(t => t.addr.toLowerCase() === state.tokenAddr.toLowerCase())){
      list.push({ symbol: state.symbol, addr: state.tokenAddr });
      saveTokens(list);
    }
    renderTokenSelect();
  }
  function explorerTx(hash){
    return (state.network === "testnet" ? "https://testnet.bscscan.com/tx/" : "https://bscscan.com/tx/") + hash;
  }

  window.addEventListener("load", () => {
    setTimeout(() => {
      const credits = $("credits-splash");
      credits.style.transition = "opacity .6s ease";
      credits.style.opacity = "0";
      setTimeout(() => { credits.style.display = "none"; }, 600);
    }, 10000);

    setTimeout(() => {
      $("splash").classList.add("hide");
      if(hasStoredWallet()) showPin("unlock"); else $("setup-screen").style.display = "block";
    }, 10700);
  });

  function switchTab(viewId){
    if(typeof stopScan === "function" && scanStream) stopScan();
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    $(viewId).classList.add("active");
    document.querySelector('.tab[data-view="'+viewId+'"]').classList.add("active");
    if(viewId === "view-withdraw"){
      $("tx-result").style.display = "none";
      $("withdraw-error").style.display = "none";
    }
  }

  document.querySelectorAll(".tab").forEach(t => { t.onclick = () => switchTab(t.dataset.view); });
  $("qb-deposit").onclick = () => switchTab("view-deposit");
  $("qb-withdraw").onclick = () => switchTab("view-withdraw");
  $("qb-refresh").onclick = refreshBalances;

  $("btn-eye").onclick = () => {
    state.hidden = !state.hidden;
    renderBalances();
  };

  let lastUsdt = "0.00", lastBnb = "0.0000";
  function renderBalances(){
    $("bal-usdt").textContent = state.hidden ? "••••" : lastUsdt;
    $("bal-usdt-2").textContent = state.hidden ? "••••" : lastUsdt;
    $("bal-bnb").textContent = state.hidden ? "••••" : lastBnb;
    $("bal-bnb-2").textContent = state.hidden ? "••••" : lastBnb;
  }

  function shortAddr(a){ return a.slice(0,6) + "…" + a.slice(-4); }
  function setupError(msg){
    const el = $("setup-error");
    el.textContent = msg;
    el.style.display = msg ? "block" : "none";
  }

  async function connect(){
    $("net-label").textContent = "Connecting…";
    $("net-dot").className = "dot";
    try{
      state.provider = new ethers.providers.JsonRpcProvider(state.rpcUrl);
      state.wallet = state.wallet.connect(state.provider);
      await state.provider.getBlockNumber();
      $("net-label").textContent = "Connected";
      $("net-dot").className = "dot ok";
      await refreshBalances();
    }catch(e){
      $("net-label").textContent = "Connection failed";
      $("net-dot").className = "dot err";
    }
  }

  async function refreshBalances(){
    if(state.demo && state.wallet){
      lastUsdt = state.demoUsdt.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
      lastBnb = "0.5000";
      $("withdraw-balance-hint").textContent = "Available (simulated): " + state.demoUsdt.toFixed(2) + " " + state.symbol;
      renderBalances();
      return;
    }
    if(!state.wallet || !state.provider) return;
    try{
      const bnb = await state.provider.getBalance(state.wallet.address);
      lastBnb = parseFloat(ethers.utils.formatEther(bnb)).toFixed(4);

      const token = new ethers.Contract(state.tokenAddr, ERC20_ABI, state.provider);
      let decimals = state.decimals;
      try{ decimals = await token.decimals(); state.decimals = decimals; }catch(e){}
      try{ state.symbol = await token.symbol(); }catch(e){}
      updateSymbols();
      registerToken();
      const bal = await token.balanceOf(state.wallet.address);
      const formatted = ethers.utils.formatUnits(bal, decimals);
      lastUsdt = parseFloat(formatted).toLocaleString(undefined,{maximumFractionDigits:2});
      $("withdraw-balance-hint").textContent = "Available: " + parseFloat(formatted).toFixed(2) + " " + state.symbol;
      renderBalances();
    }catch(e){
      $("net-label").textContent = "Balance fetch failed";
      $("net-dot").className = "dot err";
    }
  }

  function loadWalletIntoUI(){
    const addr = state.wallet.address;
    $("addr-short").textContent = shortAddr(addr);
    $("deposit-addr").textContent = addr;
    $("input-rpc").value = state.rpcUrl;
    $("input-token").value = state.tokenAddr;
    $("qr-code").innerHTML = "";
    new QRCode($("qr-code"), { text: addr, width: 168, height: 168, colorDark:"#0A0E17", colorLight:"#ffffff" });
    $("setup-screen").style.display = "none";
    $("app-shell").style.display = "flex";
    switchTab("view-home");
    connect();
  }


  // ---- PIN lock + encrypted wallet saved on this device ----
  const KEY_STORE = "cryptoc_keystore";
  const SCRYPT_OPTS = { scrypt: { N: 16384 } };
  let pinMode = "unlock", pendingWallet = null, pinBusy = false;

  function hasStoredWallet(){
    try{ return !!localStorage.getItem(KEY_STORE); }catch(e){ return false; }
  }
  function pinError(msg){
    const el = $("pin-error");
    el.textContent = msg || "";
    el.style.display = msg ? "block" : "none";
  }
  function showPin(mode){
    pinMode = mode;
    pinError("");
    $("pin-input").value = ""; $("pin-input2").value = "";
    $("pin-input2").style.display = mode === "set" ? "block" : "none";
    $("pin-title").textContent = mode === "set" ? "Create a PIN" : "Enter PIN";
    $("pin-hint").textContent = mode === "set"
      ? "Choose a 6-digit PIN. It encrypts your wallet on this device and unlocks it next time."
      : "Enter your 6-digit PIN to open your wallet.";
    $("btn-pin-ok").textContent = mode === "set" ? "Save PIN & open wallet" : "Unlock";
    $("btn-pin-forgot").style.display = mode === "unlock" ? "" : "none";
    // running trading chart in the background (clone with its own ids)
    const bg = $("pin-bg");
    const src = $("btc-chart");
    if(src){
      let svg = src.outerHTML.replace(/\bbt(A|F|Clip|M)\b/g, "bt$12").replace('id="btc-chart"', "");
      bg.innerHTML = svg;
      const lb = bg.querySelector(".bt-label"); if(lb) lb.remove();
    }
    $("pin-screen").style.display = "block";
    setTimeout(() => $("pin-input").focus(), 50);
  }
  function hidePin(){ $("pin-screen").style.display = "none"; $("pin-bg").innerHTML = ""; }

  $("btn-pin-ok").onclick = async () => {
    if(pinBusy) return;
    const pin = $("pin-input").value.trim();
    if(!/^\d{6}$/.test(pin)){ pinError("PIN must be exactly 6 digits."); return; }
    pinBusy = true;
    const btn = $("btn-pin-ok"), label = btn.textContent;
    btn.disabled = true;
    try{
      if(pinMode === "set"){
        if(pin !== $("pin-input2").value.trim()){ pinError("PINs do not match."); return; }
        btn.textContent = "Securing wallet…";
        const json = await pendingWallet.encrypt(pin, SCRYPT_OPTS);
        try{ localStorage.setItem(KEY_STORE, json); }
        catch(e){ pinError("Could not save the wallet on this device (storage blocked)."); return; }
        state.wallet = pendingWallet; pendingWallet = null;
        hidePin();
        loadWalletIntoUI();
      }else{
        btn.textContent = "Unlocking…";
        const json = localStorage.getItem(KEY_STORE);
        let w;
        try{ w = await ethers.Wallet.fromEncryptedJson(json, pin); }
        catch(e){ pinError("Wrong PIN. Try again."); $("pin-input").value = ""; return; }
        state.wallet = w;
        hidePin();
        loadWalletIntoUI();
      }
    }finally{
      pinBusy = false; btn.disabled = false; btn.textContent = label;
    }
  };
  $("pin-input").addEventListener("keydown", e => { if(e.key === "Enter") $("btn-pin-ok").click(); });
  $("pin-input2").addEventListener("keydown", e => { if(e.key === "Enter") $("btn-pin-ok").click(); });

  $("btn-pin-forgot").onclick = () => {
    if(!confirm("If you forgot the PIN, the only way in is to remove this wallet from the device and import it again with your private key or seed phrase. Remove it now?")) return;
    try{ localStorage.removeItem(KEY_STORE); }catch(e){}
    hidePin();
    $("setup-screen").style.display = "block";
  };

  function resetSession(){
    state.wallet = null; state.provider = null; state.demo = false; state.demoUsdt = 503;
    state.symbol = "USDT"; state.network = "mainnet"; state.rpcUrl = DEFAULT_RPC; state.tokenAddr = DEFAULT_USDT;
    updateSymbols(); updateBanner();
    $("btn-demo").textContent = "Enable demo mode (503 USDT simulated)";
    $("reveal-box").style.display = "none"; $("reveal-pk").textContent = ""; $("btn-reveal").textContent = "Show private key";
    $("input-pk").value = ""; $("input-mnemonic").value = "";
    $("app-shell").style.display = "none";
  }
  $("btn-lock-app").onclick = () => { resetSession(); showPin("unlock"); };

  function walletReady(w){
    pendingWallet = w;
    setupError("");
    $("setup-screen").style.display = "none";
    showPin("set");
  }

  $("btn-create").onclick = () => {
    walletReady(ethers.Wallet.createRandom());
  };

  $("btn-import-pk").onclick = () => {
    const raw = $("input-pk").value.trim();
    try{
      const key = raw.startsWith("0x") ? raw : "0x" + raw;
      walletReady(new ethers.Wallet(key));
    }catch(e){ setupError("That doesn't look like a valid private key."); }
  };

  $("btn-import-mnemonic").onclick = () => {
    const phrase = $("input-mnemonic").value.trim();
    try{
      walletReady(ethers.Wallet.fromMnemonic(phrase));
    }catch(e){ setupError("That doesn't look like a valid seed phrase."); }
  };

  $("btn-copy-addr").onclick = () => {
    navigator.clipboard.writeText(state.wallet.address);
    $("btn-copy-addr").textContent = "Copied";
    setTimeout(()=> $("btn-copy-addr").textContent = "Copy", 1200);
  };
  $("btn-copy-deposit").onclick = () => {
    navigator.clipboard.writeText(state.wallet.address);
    $("btn-copy-deposit").textContent = "Copied";
    setTimeout(()=> $("btn-copy-deposit").textContent = "Copy", 1200);
  };

  $("btn-save-settings").onclick = () => {
    const tok = $("input-token").value.trim();
    if(state.network === "testnet" && !ethers.utils.isAddress(tok)){
      alert("Testnet: paste the token contract address first (the faucet shows it for each test token).");
      return;
    }
    state.rpcUrl = $("input-rpc").value.trim() || DEFAULT_RPC;
    const newAddr = tok || DEFAULT_USDT;
    if(newAddr.toLowerCase() !== state.tokenAddr.toLowerCase()) state.symbol = "TOKEN";
    state.tokenAddr = newAddr;
    updateSymbols();
    updateBanner();
    connect();
  };

  $("btn-reveal").onclick = () => {
    const box = $("reveal-box");
    if(box.style.display === "none"){
      $("reveal-pk").textContent = state.wallet.privateKey;
      box.style.display = "block";
      $("btn-reveal").textContent = "Hide private key";
    }else{
      box.style.display = "none";
      $("reveal-pk").textContent = "";
      $("btn-reveal").textContent = "Show private key";
    }
  };

  $("btn-lock").onclick = () => {
    if(!confirm("This removes the wallet from this device. Make sure you have backed up your private key or seed phrase, or you will lose access. Continue?")) return;
    try{ localStorage.removeItem(KEY_STORE); }catch(e){}
    resetSession();
    $("setup-screen").style.display = "block";
  };

  $("btn-send").onclick = async () => {
    const to = $("input-to").value.trim();
    const amountStr = $("input-amount").value.trim();
    const errEl = $("withdraw-error");
    errEl.style.display = "none";

    if(!ethers.utils.isAddress(to)){
      errEl.textContent = "Enter a valid recipient address.";
      errEl.style.display = "block";
      return;
    }
    let amount;
    try{ amount = ethers.utils.parseUnits(amountStr, state.decimals); }
    catch(e){ errEl.textContent = "Enter a valid amount."; errEl.style.display = "block"; return; }

    if(state.demo){
      const amt = parseFloat(amountStr);
      if(!(amt > 0) || amt > state.demoUsdt){
        errEl.textContent = "Amount exceeds simulated balance.";
        errEl.style.display = "block";
        return;
      }
      state.demoUsdt = +(state.demoUsdt - amt).toFixed(2);
      $("tx-title").textContent = "Simulated transaction (demo mode)";
      $("tx-hash-text").textContent = "No real transaction was sent.";
      $("tx-link").style.display = "none";
      $("tx-result").style.display = "block";
      await refreshBalances();
      return;
    }

    const btn = $("btn-send");
    btn.disabled = true;
    btn.textContent = "Sending…";
    try{
      const token = new ethers.Contract(state.tokenAddr, ERC20_ABI, state.wallet);
      const tx = await token.transfer(to, amount);
      $("tx-title").textContent = "Transaction submitted";
      $("tx-hash-text").textContent = tx.hash;
      $("tx-link").href = explorerTx(tx.hash);
      $("tx-link").style.display = "";
      $("tx-result").style.display = "block";
      await tx.wait();
      $("tx-title").textContent = "Transaction confirmed";
      await refreshBalances();
    }catch(e){
      errEl.textContent = "Transaction failed: " + (e.reason || e.message || "unknown error");
      errEl.style.display = "block";
    }finally{
      btn.disabled = false;
      btn.textContent = "Send";
    }
  };

  $("btn-net-main").onclick = () => {
    state.network = "mainnet";
    state.tokenAddr = "";
    $("input-rpc").value = DEFAULT_RPC;
    $("input-token").value = DEFAULT_USDT;
    $("btn-save-settings").click();
  };
  $("btn-net-test").onclick = () => {
    state.network = "testnet";
    state.tokenAddr = "";
    renderTokenSelect();
    $("input-rpc").value = TESTNET_RPC;
    $("input-token").value = "";
    $("input-token").placeholder = "Paste test token contract (0x...)";
    updateBanner();
    alert("Testnet selected. Paste a test token contract address (USDT, USDC, ...), then tap Save & reconnect.");
  };

  $("token-select").onchange = () => {
    const addr = $("token-select").value;
    const t = loadTokens().find(x => x.addr === addr);
    if(!t) return;
    state.tokenAddr = t.addr;
    state.symbol = t.symbol;
    $("input-token").value = t.addr;
    updateSymbols();
    refreshBalances();
  };


  // ---- QR scanner (camera) for the recipient address ----
  let scanStream = null, scanTimer = null, qrDetector;

  function extractAddress(text){
    const m = String(text).match(/0x[0-9a-fA-F]{40}/);
    return (m && ethers.utils.isAddress(m[0])) ? m[0] : null;
  }

  async function decodeFrame(video, canvas, ctx){
    if(qrDetector === undefined){
      try{ qrDetector = ("BarcodeDetector" in window) ? new BarcodeDetector({ formats: ["qr_code"] }) : null; }
      catch(e){ qrDetector = null; }
    }
    if(qrDetector){
      try{
        const found = await qrDetector.detect(video);
        if(found.length) return found[0].rawValue;
      }catch(e){}
    }
    if(window.jsQR){
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
      if(code) return code.data;
    }
    return null;
  }

  function stopScan(){
    if(scanTimer){ clearTimeout(scanTimer); scanTimer = null; }
    if(scanStream){ scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
    $("scan-video").srcObject = null;
    $("scan-modal").style.display = "none";
  }

  async function startScan(){
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      alert("Camera is not available in this browser. Open the app in Chrome (https) and try again.");
      return;
    }
    try{
      scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    }catch(e){
      alert("Camera permission was denied or no camera was found. Allow camera access for this site and try again.");
      return;
    }
    const video = $("scan-video");
    video.srcObject = scanStream;
    try{ await video.play(); }catch(e){}
    $("scan-hint").textContent = "Point the camera at the QR code on the other wallet's Deposit screen.";
    $("scan-modal").style.display = "flex";

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const tick = async () => {
      if(!scanStream) return;
      if(video.readyState >= 2 && video.videoWidth > 0){
        let text = null;
        try{ text = await decodeFrame(video, canvas, ctx); }catch(e){}
        if(text){
          const addr = extractAddress(text);
          if(!addr){
            $("scan-hint").textContent = "That QR code does not contain a wallet address. Try again.";
          }else if(state.wallet && addr.toLowerCase() === state.wallet.address.toLowerCase()){
            $("scan-hint").textContent = "That is your own address. Scan the other wallet's QR code.";
          }else{
            $("input-to").value = addr;
            stopScan();
            $("input-amount").focus();
            return;
          }
        }
      }
      if(scanStream) scanTimer = setTimeout(tick, 200);
    };
    tick();
  }

  $("btn-scan").onclick = startScan;
  $("btn-scan-cancel").onclick = stopScan;

  $("btn-demo").onclick = () => {
    state.demo = !state.demo;
    state.demoUsdt = 503;
    updateBanner();
    $("btn-demo").textContent = state.demo ? "Disable demo mode" : "Enable demo mode (503 USDT simulated)";
    refreshBalances();
  };

  state.rpcUrl = DEFAULT_RPC;
  state.tokenAddr = DEFAULT_USDT;

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
})();
