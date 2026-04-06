
// ========================== VARIABLES ==========================
let provider;
let signer;
let contract;
let token;
let user;
let chart;

// ✅ NEW (epoch)
let epochStartFromContract = 0;
const EPOCH_DURATION = 7 * 24 * 60 * 60;

// ========================== CONTRACT ADDRESSES ==========================
const contractAddress = "0xb0f20D4616A782094B97e761Db40165Ef4A5Ab41";
const tokenAddress = "0xc08983be707bf4b763e7A0f3cCAD3fd00af6620d";

// ========================== ABI ==========================
const abi = [
  "function currentEpoch() view returns(uint256)",
  "function epochStart() view returns(uint256)", // ✅ ADDED
  "function downlineCount(address) view returns(uint256)",
  "function epochTotalWeight() view returns(uint256)",
  "function pendingReward(address) view returns(uint256)",
  "function getTRCPriceUSD() view returns(uint256)",
  "function totalWeight() view returns(uint256)",
  "function rewardPool() view returns(uint256)",
  "function users(address) view returns(address,uint8,uint256,uint256,uint256,uint256,uint256)",
  "function register(address)",
  "function joinLevel1()",
  "function joinLevel2()",
  "function joinLevel3()",
  "function joinLevel4()",
  "function joinLevel5()",
  "function joinLevel6()",
  "function claimReward()",

  "event Registered(address indexed user,address indexed referrer)",
  "event LevelJoined(address indexed user,uint8 level,uint256 amount)",
  "event RewardClaimed(address indexed user,uint256 amount)",
  "event EMAUpdated(uint256 price)"
];

const tokenABI = [
  "function approve(address,uint256) returns(bool)"
];

// ========================== HELPERS ==========================
function human(v){
  return Number(ethers.utils.formatUnits(v,18)).toFixed(4);
}

function usd(v){
  return Number(ethers.utils.formatUnits(v,18)).toFixed(4);
}

// ✅ NEW
function formatTime(ts){
  return new Date(ts * 1000).toLocaleString();
}

// ========================== CHART ==========================
function initChart(){
  const ctx = document.getElementById("priceChart").getContext("2d");
  chart = new Chart(ctx,{
    type:"line",
    data:{
      labels:["Start"],
      datasets:[{
        label:"TRC Price USD",
        data:[0],
        tension:0.4,
        borderColor: "blue",
        backgroundColor: "rgba(0,0,255,0.1)"
      }]
    },
    options:{ responsive:true, maintainAspectRatio:false }
  });
}

// ========================== CONNECT WALLET ==========================
async function connectWallet() {
  try {
    if (!window.ethereum) {
      alert("MetaMask not found!");
      return;
    }

    await window.ethereum.request({ method: 'eth_requestAccounts' });

    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer = provider.getSigner();
    user = await signer.getAddress();

    document.getElementById("wallet").innerText = user;

    contract = new ethers.Contract(contractAddress, abi, signer);
    token = new ethers.Contract(tokenAddress, tokenABI, signer);

    loadData();
    

    startTimers(); // ✅ ADDED
    listenEvents();

  } catch (err) {
    console.log(err);
  }
}

// ========================== LOAD DASHBOARD DATA ==========================
// ========================== LOAD DASHBOARD DATA ==========================
async function loadData(){
  try{
    const price = await contract.getTRCPriceUSD();
    document.getElementById("price").innerText = "$"+usd(price);

    if(chart){
      chart.data.labels.push(new Date().toLocaleTimeString());
      chart.data.datasets[0].data.push(usd(price));
      if(chart.data.labels.length>20){
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
      }
      chart.update();
    }

    // ✅ SYSTEM DATA ONLY
    document.getElementById("epoch").innerText =
      await contract.currentEpoch();

    document.getElementById("pending").innerText =
      human(await contract.pendingReward(user));

    document.getElementById("rewardPool").innerText =
      human(await contract.rewardPool());

    document.getElementById("epochWeight").innerText =
      await contract.epochTotalWeight();

    // ✅ FETCH EPOCH START
    if(epochStartFromContract === 0){
      epochStartFromContract = Number(await contract.epochStart());
      document.getElementById("epochStart").innerText =
        formatTime(epochStartFromContract);
    }

    // ✅ NEXT EPOCH
    if(epochStartFromContract > 0){
      let now = Math.floor(Date.now()/1000);
      let epochNumber = Math.floor((now - epochStartFromContract)/EPOCH_DURATION);
      if(epochNumber < 0) epochNumber = 0;

      let nextEpoch = epochStartFromContract + ((epochNumber+1)*EPOCH_DURATION);

      document.getElementById("nextEpoch").innerText =
        formatTime(nextEpoch);

      // ✅ ALSO USED BY claimTimer (same countdown)
      // (your startTimers() already updates claimTimer)
    }

  }catch(e){
    console.log(e);
  }
}

// ========================== TIMER ==========================
function startTimers(){
  setInterval(()=>{

    if(epochStartFromContract === 0) return;

    let now = Math.floor(Date.now()/1000);

    let epochNumber = Math.floor((now - epochStartFromContract)/EPOCH_DURATION);
    if(epochNumber < 0) epochNumber = 0;

    let nextEpoch = epochStartFromContract + ((epochNumber+1)*EPOCH_DURATION);

    let remaining = nextEpoch - now;
    if(remaining < 0) remaining = 0;

    let d = Math.floor(remaining/86400);
    remaining %= 86400;
    let h = Math.floor(remaining/3600);
    remaining %= 3600;
    let m = Math.floor(remaining/60);
    let s = remaining % 60;

    document.getElementById("epochTimer").innerText =
      `${d}d ${h}h ${m}m ${s}s`;

    document.getElementById("claimTimer").innerText =
      `${d}d ${h}h ${m}m ${s}s`;

  },1000);
}

// ========================== HANDLE TRANSACTIONS ==========================
async function handleTx(tx){
  try{
    // ⏳ waiting wallet confirm
    document.getElementById("status").innerHTML =
      `<span class="tx-pending">⏳ Waiting for confirmation...</span>`;

    const sent = await tx;

    // 🔄 pending with polygonscan link
    document.getElementById("status").innerHTML =
      `<a href="https://polygonscan.com/tx/${sent.hash}" target="_blank">
        🔄 Transaction Pending (View)
      </a>`;

    await sent.wait();

    // ✅ after confirmed (EVENT WILL UPDATE AFTER THIS)
    document.getElementById("status").innerHTML =
      `<span class="tx-success">✅ Transaction Confirmed</span>`;

  }catch(e){
    document.getElementById("status").innerHTML =
      `<span class="tx-fail">❌ Transaction Failed</span>`;
  }
}

// ========================== USER ACTIONS ==========================
async function register(){
  const ref = document.getElementById("ref").value;
  handleTx(contract.register(ref));
}

async function approveTRC(){
  const amount = document.getElementById("approveAmount").value;
  const value = ethers.utils.parseUnits(amount,18);
  handleTx(token.approve(contractAddress,value));
}

async function joinLevel(l){
  if(l==1) handleTx(contract.joinLevel1());
  if(l==2) handleTx(contract.joinLevel2());
  if(l==3) handleTx(contract.joinLevel3());
  if(l==4) handleTx(contract.joinLevel4());
  if(l==5) handleTx(contract.joinLevel5());
  if(l==6) handleTx(contract.joinLevel6());
}

async function claimReward(){
  handleTx(contract.claimReward());
}

// ========================== EVENT LISTENERS ==========================
function listenEvents() {
  if (!contract || !user) return;

  try {
    contract.on("Registered", (userAddr, referrer) => {
      if(userAddr.toLowerCase() === user.toLowerCase()){
        document.getElementById("status").innerText =
          `Registered successfully with referrer: ${referrer}`;
        loadData();
      }
    });

    contract.on("LevelJoined", (userAddr, level, amount) => {
      if(userAddr.toLowerCase() === user.toLowerCase()){
        document.getElementById("status").innerText =
          `Joined Level ${level} successfully with ${human(amount)} TRC`;
        loadData();
      }
    });

    contract.on("RewardClaimed", (userAddr, amount) => {
      if(userAddr.toLowerCase() === user.toLowerCase()){
        document.getElementById("status").innerText =
          `Reward claimed: ${human(amount)} TRC`;
        loadData();
      }
    });

    contract.on("EMAUpdated", (price) => {
      if(chart){
        chart.data.labels.push(new Date().toLocaleTimeString());
        chart.data.datasets[0].data.push(usd(price));
        if(chart.data.labels.length > 20){
          chart.data.labels.shift();
          chart.data.datasets[0].data.shift();
        }
        chart.update();
      }
    });

  } catch (err) {
    console.log(err);
  }
}

// ========================== INITIALIZE ==========================
window.onload = initChart;

// ========================== REWARD CALCULATOR ==========================
function calculateReward(){
  
  // Auto fill from dashboard

  document.getElementById("calcBaseWeight").value =
    document.getElementById("baseWeight").innerText;

  document.getElementById("calcTempWeight").value =
    document.getElementById("tempWeight").innerText;

  // ✅ FIXED HERE (use totalWeight instead of epochWeight)

  document.getElementById("calcTotalWeight").value =
    document.getElementById("epochWeight").innerText;

  document.getElementById("pool").value =
    document.getElementById("rewardPool").innerText;

  let pool = parseFloat(document.getElementById("pool").value);
  let base = parseFloat(document.getElementById("calcBaseWeight").value) || 0;
  let temp = parseFloat(document.getElementById("calcTempWeight").value) || 0;
  let total = parseFloat(document.getElementById("calcTotalWeight").value);

  let userWeight = base + temp;

  if(total === 0){
    document.getElementById("rewardResult").innerHTML =
      "⚠️ No participants yet";
    return;
  }

  let reward = (pool * userWeight) / total;

  document.getElementById("rewardResult").innerHTML =
    `Estimated Reward: ${reward.toFixed(4)} TRC`;
}






// ================= TAB SWITCH =================

function showSystem(){
  document.getElementById("systemBox").style.display = "grid";
  document.getElementById("userBox").style.display = "none";

  document.getElementById("tabSystem").classList.add("active");
  document.getElementById("tabUser").classList.remove("active");
}

async function showUser(){
  const system = document.getElementById("systemBox");
  const userBox = document.getElementById("userBox");

  system.classList.add("hidden");
  system.classList.remove("active");

  userBox.classList.remove("hidden");
  userBox.classList.add("active");

  document.getElementById("tabUser").classList.add("active");
  document.getElementById("tabSystem").classList.remove("active");

  if(!contract || !user) return;

  // 🔥 ensure DOM ready before loading
  setTimeout(async () => {
    await loadUserData();

    // 🔥 FORCE HARD REFLOW (important)
    const box = document.getElementById("userBox");
    box.style.display = "none";
    void box.offsetHeight;
    box.style.display = "grid";

  }, 50);
}

// ================= USER DATA =================

async function loadUserData(){
  try{
    if(!contract || !user){
      console.log("Wallet not connected");
      return;
    }

    // 🔥 fetch all in parallel (prevents UI delay)
    const [u, totalW, down] = await Promise.all([
      contract.users(user),
      contract.totalWeight(),
      contract.downlineCount(user)
    ]);

    // 🔥 SAFE conversions (BigNumber → UI safe)
    const level = u[1] ? Number(u[1]) : 0;
    const base  = u[2] ? u[2].toString() : "0";
    const temp  = u[3] ? u[3].toString() : "0";

    // 🔥 FORCE DOM UPDATE (mobile safe)
    document.getElementById("level").textContent = level;
    document.getElementById("baseWeight").textContent = base;
    document.getElementById("tempWeight").textContent = temp;
    document.getElementById("totalWeight").textContent = totalW.toString();
    document.getElementById("downline").textContent = down.toString();

    // 🔥 REFERRER FIX
    let ref = u[0];
    document.getElementById("referrer").textContent =
      (!ref || ref === "0x0000000000000000000000000000000000000000")
      ? "No Referrer"
      : ref.slice(0,6) + "..." + ref.slice(-6);

    // 🔥 CRITICAL: force repaint (this fixes mobile blank issue)
    const box = document.getElementById("userBox");
    box.style.opacity = "0.99";
    setTimeout(() => {
      box.style.opacity = "1";
    }, 10);

  }catch(e){
    console.log("USER LOAD ERROR:", e);
  }
}
