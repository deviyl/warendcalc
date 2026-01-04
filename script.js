let apiInterval;
let tickerInterval;
let currentApiKey = "";
let globalSecondsRemaining = 0;

async function startTracking() {
    const keyInput = document.getElementById('api-key').value;
    if (keyInput.length < 16) {
        alert("Please enter a valid Torn API key.");
        return;
    }
    
    currentApiKey = keyInput;
    
    document.getElementById('setup-area').style.display = 'none';
    document.getElementById('active-controls').style.display = 'block';
    
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
        
        if (data.error) {
            document.getElementById('war-title').innerText = "API Error: " + data.error.error;
            return;
        }

        const sortedWarIds = Object.keys(data.rankedwars).sort((a, b) => b - a);
        const newestWarId = sortedWarIds[0]; 
        const warData = data.rankedwars[newestWarId];

        const factions = Object.values(warData.factions);
        const f1 = factions[0];
        const f2 = factions[1];

        const now = Math.floor(Date.now() / 1000);
        const startTime = warData.war.start; 
        const currentLead = Math.abs(f1.score - f2.score);
        const leaderName = f1.score > f2.score ? f1.name : f2.name;
        
        const originalTarget = warData.war.target;
        const decayPerSec = (originalTarget * 0.01) / 3600; 
        const decayStartSec = 86400; 

        if (currentLead >= originalTarget) {
            globalSecondsRemaining = 0;
        } else {
            const secondsOfDecayNeeded = (originalTarget - currentLead) / decayPerSec;
            const totalSecondsFromStartToFinish = secondsOfDecayNeeded + decayStartSec;
            const timeElapsedSoFar = now - startTime;
            globalSecondsRemaining = totalSecondsFromStartToFinish - timeElapsedSoFar;
        }

        document.getElementById('stats-area').style.display = 'grid';
        document.getElementById('war-title').innerText = `${f1.name} vs ${f2.name}`;
        document.getElementById('f1-name').innerText = f1.name;
        document.getElementById('f1-score').innerText = f1.score.toLocaleString();
        document.getElementById('f2-name').innerText = f2.name;
        document.getElementById('f2-score').innerText = f2.score.toLocaleString();
        
        window.currentWarStats = {
            lead: currentLead,
            leader: leaderName,
            target: originalTarget,
            start: startTime
        };

        renderUI();

    } catch (e) {
        console.error(e);
    }
}

function runTicker() {
    if (globalSecondsRemaining > 0) {
        globalSecondsRemaining--;
        renderUI();
    }
}

function renderUI() {
    const sec = Math.max(0, Math.floor(globalSecondsRemaining));
    const stats = window.currentWarStats;
    if (!stats) return;

    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    document.getElementById('countdown').innerText = 
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    const finishDate = new Date(Date.now() + (sec * 1000));
    const gmtString = finishDate.toUTCString().replace('GMT', 'TCT');

    const now = Math.floor(Date.now() / 1000);
    const decayStart = stats.start + 86400;
    let currentTarget = stats.target;
    if (now > decayStart) {
        const decayPerSec = (stats.target * 0.01) / 3600;
        currentTarget = stats.target - (decayPerSec * (now - decayStart));
    }

    document.getElementById('details').innerHTML = `
        Leader: <strong>${stats.leader}</strong> (+${stats.lead.toLocaleString()})<br>
        Required Lead Now: <strong>${Math.max(0, Math.floor(currentTarget)).toLocaleString()}</strong><br>
        <span style="color: #00ff00; font-size: 1.1em;">Predicted Finish: ${gmtString}</span>
    `;
}
