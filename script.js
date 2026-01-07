let currentApiKey = "";
let finishLineTimestamp = 0;
let previousWarData = null;
let currentWarStats = null;

function toggleTerms() {
    const el = document.getElementById('terms-container');
    el.classList.toggle('hidden', !document.getElementById('terms-checkbox').checked);
}

function toggleLastWar() {
    const el = document.getElementById('last-war-container');
    el.classList.toggle('hidden', !document.getElementById('last-war-checkbox').checked);
}

async function startTracking() {
    const key = document.getElementById('api-key').value.trim();
    if (key.length < 16) return alert("Enter valid API key");
    currentApiKey = key;
    document.getElementById('setup-area').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    
    await updateWarClock();
    setInterval(updateWarClock, 30000);
    setInterval(renderUI, 1000);
}

async function updateWarClock() {
    if (!currentApiKey) return;
    try {
        const res = await fetch(`https://api.torn.com/faction/?selections=rankedwars&key=${currentApiKey}`);
        const data = await res.json();
        if (data.error) return console.error(data.error);

        const ids = Object.keys(data.rankedwars).sort((a, b) => b - a);
        const latestWar = data.rankedwars[ids[0]];
        const isLiveOrScheduled = latestWar.war.end === 0;

        if (isLiveOrScheduled) {
            const factions = Object.values(latestWar.factions);
            const f1 = factions[0], f2 = factions[1];
            const now = Math.floor(Date.now() / 1000);
            const start = latestWar.war.start;
            const target = latestWar.war.target;
            const lead = Math.abs(f1.score - f2.score);
            
            let original;
            const elapsed = Math.max(0, now - start);
            if (elapsed < 86400) {
                original = target;
            } else {
                const hours = Math.floor((elapsed - 86400) / 3600) + 1;
                original = Math.round(target / (1 - (0.01 * hours)));
            }

            const itersNeeded = Math.ceil((original - lead) / (original * 0.01));
            finishLineTimestamp = start + 86400 + ((itersNeeded - 1) * 3600);

            currentWarStats = {
                active: true, f1Name: f1.name, f2Name: f2.name, f1Score: f1.score, f2Score: f2.score,
                lead: lead, target: target, original: original, startTime: start
            };
        } else {
            currentWarStats = { active: false };
        }

        const prevIdx = isLiveOrScheduled ? 1 : 0;
        if (ids.length > prevIdx) {
            const prev = data.rankedwars[ids[prevIdx]];
            const pF = Object.values(prev.factions);
            previousWarData = { f1N: pF[0].name, f1S: pF[0].score, f2N: pF[1].name, f2S: pF[1].score, end: prev.war.end };
        }
    } catch (e) { console.error("Update Error:", e); }
}

function getNextTuesday() {
    const d = new Date();
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
    while (next.getUTCDay() !== 2 || next <= d) next.setUTCDate(next.getUTCDate() + 1);
    return next;
}

function renderUI() {
    if (!currentWarStats) return;

    // History UI
    if (previousWarData) {
        document.getElementById('prev-f1-name').innerText = previousWarData.f1N;
        document.getElementById('prev-f1-score').innerText = previousWarData.f1S.toLocaleString();
        document.getElementById('prev-f2-name').innerText = previousWarData.f2N;
        document.getElementById('prev-f2-score').innerText = previousWarData.f2S.toLocaleString();
        document.getElementById('prev-war-details').innerText = `Ended: ${new Date(previousWarData.end * 1000).toUTCString().replace('GMT','TCT')}`;
    }

    const warEls = document.getElementById('active-war-elements');
    const noMsg = document.getElementById('no-war-message');
    const termsTog = document.getElementById('terms-toggle-wrapper');

    if (!currentWarStats.active) {
        warEls.classList.add('hidden'); noMsg.classList.remove('hidden'); termsTog.classList.add('hidden'); return;
    }

    warEls.classList.remove('hidden'); noMsg.classList.add('hidden'); termsTog.classList.remove('hidden');

    // Timer
    const now = Math.floor(Date.now() / 1000);
    const diff = Math.max(0, finishLineTimestamp - now);
    const h = Math.floor(diff/3600), m = Math.floor((diff%3600)/60), s = diff%60;
    document.getElementById('countdown').innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    document.getElementById('orig-target-display').innerText = `Original Target: ${currentWarStats.original.toLocaleString()}`;
    
    // Scores & Tug of War
    document.getElementById('f1-name').innerText = currentWarStats.f1Name;
    document.getElementById('f1-score').innerText = currentWarStats.f1Score.toLocaleString();
    document.getElementById('f2-name').innerText = currentWarStats.f2Name;
    document.getElementById('f2-score').innerText = currentWarStats.f2Score.toLocaleString();
    document.getElementById('label-f1').innerText = currentWarStats.f1Name;
    document.getElementById('label-f2').innerText = currentWarStats.f2Name;
    document.getElementById('target-left').innerText = currentWarStats.target.toLocaleString();
    document.getElementById('target-right').innerText = currentWarStats.target.toLocaleString();

    const fL = document.getElementById('fill-left'), fR = document.getElementById('fill-right'), vL = document.getElementById('val-left'), vR = document.getElementById('val-right');
    fL.style.width = "0%"; fR.style.width = "0%"; vL.innerText = ""; vR.innerText = "";
    const pct = Math.min(100, (currentWarStats.lead / currentWarStats.target) * 100);
    if (currentWarStats.f1Score > currentWarStats.f2Score) { fL.style.width = pct+"%"; vL.innerText = currentWarStats.lead.toLocaleString(); }
    else if (currentWarStats.f2Score > currentWarStats.f1Score) { fR.style.width = pct+"%"; vR.innerText = currentWarStats.lead.toLocaleString(); }

    document.getElementById('details').innerHTML = `<div style="color:#ff8c00; font-weight:bold; margin-top:10px;">Finish: ${new Date(finishLineTimestamp * 1000).toUTCString().replace('GMT','TCT')}</div>`;

    // Terms
    document.getElementById('radio-f1-name').innerText = currentWarStats.f1Name;
    document.getElementById('radio-f2-name').innerText = currentWarStats.f2Name;
    const isF1Win = document.querySelector('input[name="winner"]:checked').value === 'f1';
    const wS = isF1Win ? currentWarStats.f1Score : currentWarStats.f2Score;
    const cS = isF1Win ? currentWarStats.f2Score : currentWarStats.f1Score;
    const wN = isF1Win ? currentWarStats.f1Name : currentWarStats.f2Name;
    const cN = isF1Win ? currentWarStats.f2Name : currentWarStats.f1Name;

    const wGoalPct = parseInt(document.getElementById('win-bracket-slider').value);
    const cGoalPct = parseInt(document.getElementById('bracket-slider').value);
    document.getElementById('win-slider-val-display').innerText = wGoalPct+"%";
    document.getElementById('slider-val-display').innerText = cGoalPct+"%";

    // Render Bars
    const updateBar = (barId, txtId, score, goalPct, labelId, labelTxt) => {
        const target = Math.round(currentWarStats.original * (goalPct/100));
        const p = target === 0 ? 100 : Math.min(100, (score/target)*100);
        const bar = document.getElementById(barId);
        bar.style.width = p+"%";
        document.getElementById(txtId).innerText = `${score.toLocaleString()} / ${target.toLocaleString()} (${Math.round(p)}%)`;
        bar.classList.toggle('complete-green', score >= target && target > 0);
        document.getElementById(labelId).innerHTML = `${labelTxt}<br>(${labelId.includes('win') ? wN : cN})`;
    };

    updateBar('win-target-bar', 'win-target-text', wS, wGoalPct, 'win-target-label-text', 'Winning Faction Target');
    updateBar('concede-bar', 'concede-text', cS, cGoalPct, 'concede-label-text', 'Conceding Faction Target');

    const sBar = document.getElementById('winner-status-bar'), sTxt = document.getElementById('winner-status-text');
    if (wS > cS) { sBar.classList.add('complete-green'); sBar.classList.remove('fail-red'); sTxt.innerText = "LEADING"; }
    else { sBar.classList.remove('complete-green'); sBar.classList.add('fail-red'); sTxt.innerText = "TRAILING"; }

    // Matchmaking
    const mm = getNextTuesday();
    const mmTS = Math.floor(mm.getTime()/1000);
    const bHrs = ((mmTS - finishLineTimestamp)/3600).toFixed(1);
    const bDiv = document.getElementById('matchmaking-buffer');
    bDiv.innerHTML = `Matchmaking: ${mm.toLocaleDateString('en-GB',{month:'short',day:'numeric'})} 12:00<br>Buffer: <span class="${bHrs >= 5 ? 'buffer-safe' : 'buffer-danger'}">${bHrs} hours</span>`;
}
