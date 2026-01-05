let apiInterval;
let tickerInterval;
let currentApiKey = "";
let finishLineTimestamp = 0;

function toggleTerms() {
    const isChecked = document.getElementById('terms-checkbox').checked;
    const termsContainer = document.getElementById('terms-container');
    if (isChecked) termsContainer.classList.remove('hidden');
    else termsContainer.classList.add('hidden');
}

async function startTracking() {
    const keyInput = document.getElementById('api-key').value.trim();
    if (keyInput.length < 16) {
        alert("Please enter a valid Torn API key.");
        return;
    }
    currentApiKey = keyInput;
    document.getElementById('setup-area').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    await updateWarClock();
    apiInterval = setInterval(updateWarClock, 30000);
    tickerInterval = setInterval(runTicker, 1000);
}

async function updateWarClock() {
    if (!currentApiKey) return;
    try {
        const response = await fetch(`https://api.torn.com/faction/?selections=rankedwars&key=${currentApiKey}`);
        const data = await response.json();
        const sortedIds = Object.keys(data.rankedwars).sort((a, b) => b - a);
        const warData = data.rankedwars[sortedIds[0]];
        const factions = Object.values(warData.factions);
        const f1 = factions[0], f2 = factions[1];

        const now = Math.floor(Date.now() / 1000);
        const startTime = warData.war.start; 
        const currentLead = Math.abs(f1.score - f2.score);
        const currentTargetLead = warData.war.target;

        const secondsElapsed = now - startTime;
        const gracePeriod = 86400; 
        let originalTarget;
        
        if (secondsElapsed < gracePeriod) {
            originalTarget = currentTargetLead;
        } else {
            const hoursPastGrace = Math.floor((secondsElapsed - gracePeriod) / 3600);
            const currentIterations = hoursPastGrace + 1;
            originalTarget = Math.round(currentTargetLead / (1 - (0.01 * currentIterations)));
        }

        const totalIterationsNeeded = Math.ceil((originalTarget - currentLead) / (originalTarget * 0.01));
        finishLineTimestamp = startTime + gracePeriod + ((totalIterationsNeeded - 1) * 3600);

        window.currentWarStats = {
            lead: currentLead,
            leader: f1.score > f2.score ? f1.name : f2.name,
            target: currentTargetLead,
            original: originalTarget,
            f1Name: f1.name, f2Name: f2.name,
            f1Score: f1.score, f2Score: f2.score
        };
        renderUI();
    } catch (e) { console.error(e); }
}

function runTicker() { renderUI(); }

function renderUI() {
    const now = Math.floor(Date.now() / 1000);
    const sec = Math.max(0, finishLineTimestamp - now);
    const stats = window.currentWarStats;
    if (!stats) return;

    // --- MAIN ---
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
    document.getElementById('countdown').innerText = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    document.getElementById('orig-target-display').innerText = `Original Target: ${stats.original.toLocaleString()}`;
    document.getElementById('f1-name').innerText = stats.f1Name;
    document.getElementById('f1-score').innerText = stats.f1Score.toLocaleString();
    document.getElementById('f2-name').innerText = stats.f2Name;
    document.getElementById('f2-score').innerText = stats.f2Score.toLocaleString();

    const fillLeft = document.getElementById('fill-left'), fillRight = document.getElementById('fill-right');
    const valLeft = document.getElementById('val-left'), valRight = document.getElementById('val-right');
    fillLeft.style.width = "0%"; fillRight.style.width = "0%";
    valLeft.innerText = ""; valRight.innerText = "";
    document.getElementById('label-f1').innerText = stats.f1Name;
    document.getElementById('label-f2').innerText = stats.f2Name;
    document.getElementById('target-left').innerText = stats.target.toLocaleString();
    document.getElementById('target-right').innerText = stats.target.toLocaleString();

    const barWidthPercent = Math.min(100, (stats.lead / stats.target) * 100).toFixed(1);
    if (stats.f1Score > stats.f2Score) {
        fillLeft.style.width = barWidthPercent + "%";
        valLeft.innerText = stats.lead.toLocaleString();
    } else if (stats.f2Score > stats.f1Score) {
        fillRight.style.width = barWidthPercent + "%";
        valRight.innerText = stats.lead.toLocaleString();
    }
    const finishDate = new Date(finishLineTimestamp * 1000);
    document.getElementById('details').innerHTML = `<span style="color: #ff8c00; font-weight: bold;">Predicted Finish: ${finishDate.toUTCString().replace('GMT', 'TCT')}</span>`;

    // --- TERMS ---
    document.getElementById('radio-f1-name').innerText = stats.f1Name;
    document.getElementById('radio-f2-name').innerText = stats.f2Name;

    const winnerVal = document.querySelector('input[name="winner"]:checked').value;
    const bracketVal = parseFloat(document.querySelector('input[name="bracket"]:checked').value);
    
    const winningName = (winnerVal === 'f1') ? stats.f1Name : stats.f2Name;
    const concedeName = (winnerVal === 'f1') ? stats.f2Name : stats.f1Name;
    const winningScore = (winnerVal === 'f1') ? stats.f1Score : stats.f2Score;
    const concedeScore = (winnerVal === 'f1') ? stats.f2Score : stats.f1Score;
    
    document.getElementById('concede-label-text').innerText = `Conceding Team (${concedeName}) - Score for Max Rewards`;
    document.getElementById('win-label-text').innerText = `Winning Team (${winningName}) - Win Status`;

    const concedeTarget = Math.round(stats.original * bracketVal);
    const concedePercent = Math.min(100, (concedeScore / concedeTarget) * 100);
    const concedeBar = document.getElementById('concede-bar');
    concedeBar.style.width = concedePercent + "%";
    document.getElementById('concede-text').innerText = `${concedeScore.toLocaleString()} / ${concedeTarget.toLocaleString()} (${Math.round(concedePercent)}%)`;
    
    if (concedeScore >= concedeTarget) concedeBar.classList.add('complete-green');
    else concedeBar.classList.remove('complete-green');

    const winnerStatusBar = document.getElementById('winner-status-bar');
    const winnerStatusText = document.getElementById('winner-status-text');
    if (winningScore > concedeScore) {
        winnerStatusBar.classList.add('complete-green');
        winnerStatusBar.classList.remove('fail-red');
        winnerStatusText.innerText = "VALID WIN (SCORE HIGHER)";
    } else {
        winnerStatusBar.classList.remove('complete-green');
        winnerStatusBar.classList.add('fail-red');
        winnerStatusText.innerText = "INVALID WIN (SCORE TOO LOW)";
    }
}
