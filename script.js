// ========================== VARIABLES ==========================
let provider;
let signer;
let contract;
let token;
let user;
let chart;
let epochDurationFromContract = 0;
let epochStartFromContract = 0;

// ========================== CONTRACT ADDRESSES ==========================
const contractAddress = "0xD651d234B173b511eE2A0ADF319491e9562cE58f";
const tokenAddress = "0x56620a4c9667375577B9D543440c3EFE7Ca75673";

// ========================== ABI ==========================
const abi = [
  "function currentEpoch() view returns(uint256)",
  "function epochStart() view returns(uint256)",
  "function getEpochDuration() view returns(uint256)",
  "function epochDuration() view returns(uint256)",
  "function downlineCount(address) view returns(uint256)",
  "function epochTotalWeight() view returns(uint256)",
  "function pendingReward(address) view returns(uint256)",
  "function getTRCPriceUSD() view returns(uint256)",
  "function totalBaseWeight() view returns(uint256)",
  "function rewardPool() view returns(uint256)",
  "function taxPool() view returns(uint256)",
  "function getTotalUsers() view returns(uint256)",
  "function users(address) view returns(address,uint8,uint256,uint256,uint256,uint256,uint256,uint256)",
  "function register(address)",
  "function joinLevel1()",
  "function joinLevel2()",
  "function joinLevel3()",
  "function joinLevel4()",
  "function joinLevel5()",
  "function joinLevel6()",
  "function claimReward()",
  "function getLastEpochRewardSnapshot() view returns(uint256)",
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
        borderColor:"blue",
        backgroundColor:"rgba(0,0,255,0.1)"
      }]
    },
    options:{ responsive:true, maintainAspectRatio:false }
  });
}

// ========================== CONNECT ==========================
async function connectWallet(){
  try{
    if(!window.ethereum){
      alert("MetaMask not found");
      return;
    }

    await window.ethereum.request({ method:"eth_requestAccounts" });

    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer = provider.getSigner();
    user = await signer.getAddress();

    document.getElementById("wallet").innerText = user;

    document.getElementById("refLink").value =
      window.location.href.split("?")[0] + "?ref=" + user;

    contract = new ethers.Contract(contractAddress, abi, signer);
    token = new ethers.Contract(tokenAddress, tokenABI, signer);

    await loadData();
    await loadUserData();

    startTimers();
    listenEvents();

  }catch(e){
    console.log(e);
  }
}

// ========================== LOAD DATA ==========================
async function loadData(){
  try{
    if(!contract) return;

    const price = await contract.getTRCPriceUSD();
    document.getElementById("price").innerText = "$"+usd(price);

    if(chart){
      chart.data.labels.push(new Date().toLocaleTimeString());
      chart.data.datasets[0].data.push(Number(usd(price)));

      if(chart.data.labels.length > 20){
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
      }
      chart.update();
    }

    document.getElementById("epoch").innerText =
      await contract.currentEpoch();

    let pending = user ? await contract.pendingReward(user) : 0;

    if(pending == 0){
      document.getElementById("pending").innerText =
        "⏳ After epoch ends";
    }else{
      document.getElementById("pending").innerText =
        human(pending);
    }

    document.getElementById("rewardPool").innerText =
      human(await contract.rewardPool());

    const taxEl = document.getElementById("taxPool");
    if(taxEl){
      taxEl.innerText = human(await contract.taxPool());
    }

    const usersEl = document.getElementById("totalUsers");
    if(usersEl){
      usersEl.innerText = await contract.getTotalUsers();
    }

    epochStartFromContract = Number(await contract.epochStart());
    epochDurationFromContract = Number(await contract.getEpochDuration());

    document.getElementById("epochStart").innerText =
      formatTime(epochStartFromContract);

    if(epochStartFromContract > 0 && epochDurationFromContract > 0){
      let now = Math.floor(Date.now()/1000);

      let epochNumber = Math.floor(
        (now - epochStartFromContract) / epochDurationFromContract
      );

      if(epochNumber < 0) epochNumber = 0;

      let nextEpoch =
        epochStartFromContract +
        ((epochNumber + 1) * epochDurationFromContract);

      document.getElementById("nextEpoch").innerText =
        formatTime(nextEpoch);
    }

  }catch(e){
    console.log(e);
  }
}

// ========================== TIMER ==========================
function startTimers(){
  setInterval(()=>{

    let now = Math.floor(Date.now()/1000);

    let start = epochStartFromContract || now;
    let duration = epochDurationFromContract || 86400;

    let epochNumber = Math.floor(
      (now - start) / duration
    );

    if(epochNumber < 0) epochNumber = 0;

    let nextEpoch =
      start + ((epochNumber + 1) * duration);

    let remaining = nextEpoch - now;
    if(remaining < 0) remaining = 0;

    let d = Math.floor(remaining / 86400);
    remaining %= 86400;

    let h = Math.floor(remaining / 3600);
    remaining %= 3600;

    let m = Math.floor(remaining / 60);
    let s = remaining % 60;

    let timeText = `${d}d ${h}h ${m}m ${s}s`;

    document.getElementById("epochTimer").innerText = timeText;
    document.getElementById("claimTimer").innerText = timeText;

  },1000);
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

// ========================== HANDLE TX ==========================
async function handleTx(tx){
  try{
    document.getElementById("status").innerHTML =
      `<span class="tx-pending">⏳ Waiting...</span>`;

    const sent = await tx;

    document.getElementById("status").innerHTML =
      `<a href="https://polygonscan.com/tx/${sent.hash}" target="_blank">
        🔄 Pending
      </a>`;

    await sent.wait();

    document.getElementById("status").innerHTML =
      `<span class="tx-success">✅ Confirmed</span>`;

    await loadData();
    await loadUserData();

  }catch(e){
    document.getElementById("status").innerHTML =
      `<span class="tx-fail">❌ Failed</span>`;
  }
}

// ========================== EVENTS ==========================
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
        chart.data.datasets[0].data.push(Number(usd(price)));

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

// ========================== USER DATA ==========================
async function loadUserData(){
  try{
    if(!contract || !user) return;

    const u = await contract.users(user);

    document.getElementById("level").innerText = u[1];
    document.getElementById("baseWeight").innerText = u[2];
    document.getElementById("tempWeight").innerText = u[3];

    document.getElementById("totalWeight").innerText =
      await contract.totalBaseWeight();

    document.getElementById("downline").innerText =
      await contract.downlineCount(user);

    const last = await contract.getLastEpochRewardSnapshot();
    document.getElementById("lastEpochReward").innerText = human(last);

    document.getElementById("epochWeight").innerText =
      await contract.epochTotalWeight();

    let ref = u[0];

    document.getElementById("referrer").innerText =
      ref === "0x0000000000000000000000000000000000000000"
      ? "No Referrer"
      : ref.slice(0,6) + "..." + ref.slice(-6);

  }catch(e){
    console.log(e);
  }
}

// ========================== INIT ==========================
window.onload = function(){
  initChart();

  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");

  if(ref){
    const input = document.getElementById("ref");
    if(input){
      input.value = ref;
    }
  }
};

// ========================== COPY REF ==========================
function copyRef(){
  const link = document.getElementById("refLink").value;

  if(!link){
    alert("Connect wallet first");
    return;
  }

  navigator.clipboard.writeText(link);
  alert("✅ Link copied!");
}
