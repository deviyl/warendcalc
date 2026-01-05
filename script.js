let apiInterval;
let tickerInterval;
let currentApiKey = "";
let finishLineTimestamp = 0;

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
    
    if (apiInterval) clearInterval(apiInterval);
    apiInterval = setInterval(updateWarClock, 30000);
    if (tickerInterval) clearInterval(tickerInterval);
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
        const f1 = factions[0];
        const f2 = factions[1];

        const now = Math.floor(Date.now() / 1000);
        const startTime = warData.war.start; 
        const currentLead = Math.abs(f1.score - f2.score);
        const currentTargetLead = warData.war.target;

        // 1. REVERSE ENGINEER ORIGINAL TARGET (N+1 logic)
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

        // 2. FIND WINNING ITERATION (Locked points logic)
        const totalIterationsNeeded = Math.ceil((originalTarget - currentLead) / (originalTarget * 0.01));

        // 3. SET FIXED FINISH TIMESTAMP
        finishLineTimestamp = startTime + gracePeriod + ((totalIterationsNeeded - 1) * 3600);

        // UI Store
        window.currentWarStats = {
            lead: currentLead,
            leader: f1.score > f2.score ? f1.name : f2.name,
            target: currentTargetLead,
            original: originalTarget,
            f1Name: f1.name,
            f2Name: f2.name,
            f1Score: f1.score,
            f2Score: f2.score
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

    // Clock
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    document.getElementById('countdown').innerText = 
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    // Original Target & Faction Cards
    document.getElementById('orig-target-display').innerText = `Original Target: ${stats.original.toLocaleString()}`;
    document.getElementById('f1-name').innerText = stats.f1Name;
    document.getElementById('f1-score').innerText = stats.f1Score.toLocaleString();
    document.getElementById('f2-name').innerText = stats.f2Name;
    document.getElementById('f2-score').innerText = stats.f2Score.toLocaleString();

    // Tug of War Bar Updates
    const fillLeft = document.getElementById('fill-left');
    const fillRight = document.getElementById('fill-right');
    const valLeft = document.getElementById('val-left');
    const valRight = document.getElementById('val-right');
    
    // Reset fills
    fillLeft.style.width = "0%"; fillRight.style.width = "0%";
    valLeft.innerText = ""; valRight.innerText = "";
    
    // Set labels and targets
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

    // Predicted Finish
    const finishDate = new Date(finishLineTimestamp * 1000);
    const tctString = finishDate.toUTCString().replace('GMT', 'TCT');
    document.getElementById('details').innerHTML = `
        <span style="color: #ff8c00; font-weight: bold;">
            Predicted Finish: ${tctString}
        </span>
    `;
}
