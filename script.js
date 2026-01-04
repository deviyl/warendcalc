let apiInterval;
let tickerInterval;
let currentApiKey = "";
let finishLineTimestamp = 0; // Fixed "Point of Victory" in time

async function startTracking() {
    const keyInput = document.getElementById('api-key').value.trim();
    if (keyInput.length < 16) {
        alert("Please enter a valid Torn API key.");
        return;
    }
    
    currentApiKey = keyInput;
    document.getElementById('setup-area').classList.add('hidden');
    document.getElementById('active-controls').classList.remove('hidden');
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
        const leaderName = f1.score > f2.score ? f1.name : f2.name;
        const currentTargetLead = warData.war.target;

        // 1. REVERSE ENGINEER THE STARTING TARGET
        const secondsElapsed = now - startTime;
        const gracePeriod = 86400; // 24 Hours
        let originalTarget;
        
        if (secondsElapsed < gracePeriod) {
            originalTarget = currentTargetLead;
        } else {
            // How many times has it decayed already? (N+1 logic)
            const hoursPastGrace = Math.floor((secondsElapsed - gracePeriod) / 3600);
            const currentIterations = hoursPastGrace + 1;
            originalTarget = Math.round(currentTargetLead / (1 - (0.01 * currentIterations)));
        }

        // 2. FIND THE SPECIFIC ITERATION THAT ENDS THE WAR
        // Since points are frozen, we just need to know which iteration makes 
        // Original * (1 - (0.01 * Iterations)) <= currentLead
        const pointsToDecay = originalTarget - currentLead;
        const totalIterationsNeeded = Math.ceil(pointsToCloseMath(originalTarget, currentLead));

        function pointsToCloseMath(orig, lead) {
            return (orig - lead) / (orig * 0.01);
        }

        // 3. SET FIXED FINISH TIMESTAMP
        // Finish Line = Start + 24h Grace + (Iteration Count - 1) hours
        // (Minus 1 because the first iteration triggers exactly at the 24h mark)
        finishLineTimestamp = startTime + gracePeriod + (Math.ceil(totalIterationsNeeded - 1) * 3600);

        // Update Scoreboard UI
        document.getElementById('war-title').innerText = `${f1.name} vs ${f2.name}`;
        document.getElementById('f1-name').innerText = f1.name;
        document.getElementById('f1-score').innerText = f1.score.toLocaleString();
        document.getElementById('f2-name').innerText = f2.name;
        document.getElementById('f2-score').innerText = f2.score.toLocaleString();
        
        window.currentWarStats = {
            lead: currentLead,
            leader: leaderName,
            target: currentTargetLead,
            original: originalTarget
        };

        renderUI();
    } catch (e) {
        console.error("API Failure", e);
    }
}

function runTicker() {
    renderUI();
}

function renderUI() {
    const now = Math.floor(Date.now() / 1000);
    const sec = Math.max(0, finishLineTimestamp - now);
    const stats = window.currentWarStats;
    if (!stats) return;

    // Display Timer (HH:MM:SS)
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    document.getElementById('countdown').innerText = 
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    // Victory Bar (Percentage of lead vs current requirement)
    const progressPercent = Math.min(100, (stats.lead / stats.target) * 100).toFixed(1);
    const vBar = document.getElementById('victory-bar');
    vBar.style.width = progressPercent + "%";
    vBar.innerText = progressPercent + "% TO VICTORY";

    // Predicted Finish (TCT)
    const finishDate = new Date(finishLineTimestamp * 1000);
    const gmtString = finishDate.toUTCString().replace('GMT', 'TCT');

    document.getElementById('details').innerHTML = `
        Current Lead: <strong>${stats.lead.toLocaleString()}</strong> (Leader: ${stats.leader})<br>
        Required Lead Now: <strong>${stats.target.toLocaleString()}</strong><br>
        Original War Target: <strong>${stats.original.toLocaleString()}</strong><br>
        <span style="color: #ff8c00; font-size: 1.1em; font-weight: bold; display: block; margin-top: 10px;">
            Predicted Finish: ${gmtString}
        </span>
    `;
}
