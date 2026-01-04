let updateInterval;

function saveKey() {
    const key = document.getElementById('api-key').value;
    if (key.length < 16) {
        alert("Please enter a valid Torn API key.");
        return;
    }
    localStorage.setItem('torn_api_key', key);
    startTracking();
}

async function startTracking() {
    const key = localStorage.getItem('torn_api_key');
    if (!key) return;

    // Run immediately then every 30s
    updateWarClock(key);
    if (updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(() => updateWarClock(key), 30000);
}

async function updateWarClock(key) {
    try {
        const response = await fetch(`https://api.torn.com/faction/?selections=rankedwars&key=${key}`);
        const data = await response.json();
        
        if (data.error) {
            document.getElementById('war-title').innerText = "API Error: " + data.error.error;
            return;
        }

        // Convert object to array and sort by ID descending (newest war first)
        const warList = Object.values(data.rankedwars);
        if (!warList || warList.length === 0) {
            document.getElementById('war-title').innerText = "No active Ranked War found.";
            return;
        }
        
        warList.sort((a, b) => b.id - a.id);
        const war = warList[0];

        const factions = Object.values(war.factions);
        const f1 = factions[0];
        const f2 = factions[1];

        // Scoring Logic
        const now = Math.floor(Date.now() / 1000);
        const startTime = war.war_start;
        const currentLead = Math.abs(f1.score - f2.score);
        const leader = f1.score > f2.score ? f1 : f2;
        
        const originalTarget = war.target;
        const decayPerSec = (originalTarget * 0.01) / 3600; // 1% of original target per hour
        const decayStartSec = 86400; // 24 hours

        let secondsRemaining = 0;

        if (currentLead >= originalTarget) {
            // Target met before decay
            secondsRemaining = 0;
        } else {
            /* The formula for the winning condition is: 
               Current Lead >= Original Target - [DecayPerSec * (TotalElapsedSeconds - 24 Hours)]
               
               We solve for TotalElapsedSeconds (T):
               T = ((Original Target - Current Lead) / DecayPerSec) + 24 Hours
            */
            const secondsOfDecayNeeded = (originalTarget - currentLead) / decayPerSec;
            const totalSecondsFromStartToFinish = secondsOfDecayNeeded + decayStartSec;
            const timeElapsedSoFar = now - startTime;
            
            secondsRemaining = totalSecondsFromStartToFinish - timeElapsedSoFar;
        }

        updateUI(f1, f2, secondsRemaining, currentLead, leader.name, originalTarget, startTime, now);

    } catch (e) {
        console.error(e);
        document.getElementById('war-title').innerText = "Connection Error";
    }
}

function updateUI(f1, f2, sec, lead, leaderName, originalTarget, startTime, now) {
    document.getElementById('stats-area').style.display = 'grid';
    document.getElementById('war-title').innerText = `${f1.name} vs ${f2.name}`;
    document.getElementById('f1-name').innerText = f1.name;
    document.getElementById('f1-score').innerText = f1.score.toLocaleString();
    document.getElementById('f2-name').innerText = f2.name;
    document.getElementById('f2-score').innerText = f2.score.toLocaleString();

    // Calculate current target to show the "Target Lead" decreasing
    const decayStart = startTime + 86400;
    let currentTarget = originalTarget;
    if (now > decayStart) {
        const decayPerSec = (originalTarget * 0.01) / 3600;
        currentTarget = originalTarget - (decayPerSec * (now - decayStart));
    }

    if (sec <= 0) {
        document.getElementById('countdown').innerText = "END IMMINENT";
        document.getElementById('details').innerText = `${leaderName} has achieved the required lead.`;
    } else {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = Math.floor(sec % 60);
        
        document.getElementById('countdown').innerText = 
            `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        
        document.getElementById('details').innerHTML = `
            Leader: <strong>${leaderName}</strong> (+${lead.toLocaleString()})<br>
            Current Target Lead: <strong>${Math.floor(currentTarget).toLocaleString()}</strong>
        `;
    }
}

// Auto-load if key exists
if (localStorage.getItem('torn_api_key')) {
    document.getElementById('api-key').value = localStorage.getItem('torn_api_key');
    startTracking();
}
