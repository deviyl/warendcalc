let updateInterval;
let currentApiKey = "";

async function startTracking() {
    const keyInput = document.getElementById('api-key').value;
    if (keyInput.length < 16) {
        alert("Please enter a valid Torn API key.");
        return;
    }
    
    currentApiKey = keyInput;
    
    document.getElementById('setup-area').style.display = 'none';
    document.getElementById('active-controls').style.display = 'block';
    
    updateWarClock();
    if (updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(updateWarClock, 30000);
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

        // --- THE FIX: FLIP/SORT THE DATA ---
        // Get all War IDs, convert to numbers, and sort Largest to Smallest
        const sortedWarIds = Object.keys(data.rankedwars).sort((a, b) => b - a);
        const newestWarId = sortedWarIds[0]; 
        const warData = data.rankedwars[newestWarId];

        if (!warData) {
            document.getElementById('war-title').innerText = "No Ranked War found.";
            return;
        }

        const factions = Object.values(warData.factions);
        const f1 = factions[0];
        const f2 = factions[1];

        // Scoring Logic
        const now = Math.floor(Date.now() / 1000);
        const startTime = warData.war.start; 
        const currentLead = Math.abs(f1.score - f2.score);
        const leader = f1.score > f2.score ? f1 : f2;
        
        const originalTarget = warData.war.target;
        const decayPerSec = (originalTarget * 0.01) / 3600; 
        const decayStartSec = 86400; 

        let secondsRemaining = 0;

        if (currentLead >= originalTarget) {
            secondsRemaining = 0;
        } else {
            const secondsOfDecayNeeded = (originalTarget - currentLead) / decayPerSec;
            const totalSecondsFromStartToFinish = secondsOfDecayNeeded + decayStartSec;
            const timeElapsedSoFar = now - startTime;
            secondsRemaining = totalSecondsFromStartToFinish - timeElapsedSoFar;
        }

        updateUI(f1, f2, secondsRemaining, currentLead, leader.name, originalTarget, startTime, now);

    } catch (e) {
        console.error(e);
        document.getElementById('war-title').innerText = "Data Connection Error";
    }
}

function updateUI(f1, f2, sec, lead, leaderName, originalTarget, startTime, now) {
    document.getElementById('stats-area').style.display = 'grid';
    document.getElementById('war-title').innerText = `${f1.name} vs ${f2.name}`;
    document.getElementById('f1-name').innerText = f1.name;
    document.getElementById('f1-score').innerText = f1.score.toLocaleString();
    document.getElementById('f2-name').innerText = f2.name;
    document.getElementById('f2-score').innerText = f2.score.toLocaleString();

    const decayStart = startTime + 86400;
    let currentTarget = originalTarget;
    if (now > decayStart) {
        const decayPerSec = (originalTarget * 0.01) / 3600;
        currentTarget = originalTarget - (decayPerSec * (now - decayStart));
    }

    if (sec <= 0) {
        document.getElementById('countdown').innerText = "END IMMINENT";
        document.getElementById('details').innerHTML = `<strong>${leaderName}</strong> has achieved the required lead.`;
    } else {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = Math.floor(sec % 60);
        
        document.getElementById('countdown').innerText = 
            `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        
        document.getElementById('details').innerHTML = `
            Current Lead: <strong>${lead.toLocaleString()}</strong><br>
            Winning Target: <strong>${Math.max(0, Math.floor(currentTarget)).toLocaleString()}</strong><br>
            <small style="color:#777">Updated at: ${new Date().toLocaleTimeString()}</small>
        `;
    }
}
