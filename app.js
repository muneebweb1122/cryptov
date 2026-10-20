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

  let state = { wallet: null, provider: null, tokenAddr: DEFAULT_USDT, rpcUrl: DEFAULT_RPC, decimals: 18, hidden:false, demo:false, demoUsdt:503, network:"mainnet" };

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
      $("setup-screen").style.display = "block";
    }, 10700);
  });

  function switchTab(viewId){
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
      $("withdraw-balance-hint").textContent = "Available (simulated): " + state.demoUsdt.toFixed(2) + " USDT";
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
      const bal = await token.balanceOf(state.wallet.address);
      const formatted = ethers.utils.formatUnits(bal, decimals);
      lastUsdt = parseFloat(formatted).toLocaleString(undefined,{maximumFractionDigits:2});
      $("withdraw-balance-hint").textContent = "Available: " + parseFloat(formatted).toFixed(2) + " USDT";
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

  $("btn-create").onclick = () => {
    state.wallet = ethers.Wallet.createRandom();
    setupError("");
    loadWalletIntoUI();
  };

  $("btn-import-pk").onclick = () => {
    const raw = $("input-pk").value.trim();
    try{
      const key = raw.startsWith("0x") ? raw : "0x" + raw;
      state.wallet = new ethers.Wallet(key);
      setupError("");
      loadWalletIntoUI();
    }catch(e){ setupError("That doesn't look like a valid private key."); }
  };

  $("btn-import-mnemonic").onclick = () => {
    const phrase = $("input-mnemonic").value.trim();
    try{
      state.wallet = ethers.Wallet.fromMnemonic(phrase);
      setupError("");
      loadWalletIntoUI();
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
      alert("Testnet: paste the test USDT contract address first (shown on the BNB Chain testnet faucet).");
      return;
    }
    state.rpcUrl = $("input-rpc").value.trim() || DEFAULT_RPC;
    state.tokenAddr = tok || DEFAULT_USDT;
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
    if(!confirm("This clears your wallet from this device. Make sure you've backed up your key or seed phrase. Continue?")) return;
    state.wallet = null;
    state.provider = null;
    state.demo = false;
    state.demoUsdt = 503;
    state.network = "mainnet";
    state.rpcUrl = DEFAULT_RPC;
    state.tokenAddr = DEFAULT_USDT;
    updateBanner();
    $("btn-demo").textContent = "Enable demo mode (503 USDT simulated)";
    $("input-pk").value = "";
    $("input-mnemonic").value = "";
    $("app-shell").style.display = "none";
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
    $("input-rpc").value = DEFAULT_RPC;
    $("input-token").value = DEFAULT_USDT;
    $("btn-save-settings").click();
  };
  $("btn-net-test").onclick = () => {
    state.network = "testnet";
    $("input-rpc").value = TESTNET_RPC;
    $("input-token").value = "";
    $("input-token").placeholder = "Paste test USDT contract (0x...)";
    updateBanner();
    alert("Testnet selected. Paste the test USDT contract address, then tap Save & reconnect.");
  };

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
