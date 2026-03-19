// --- 1. FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyC7g1gllBUVACl3fkpYeEe7r1LfBs2ck3U",
    authDomain: "lokal-kartlegging.firebaseapp.com",
    databaseURL: "https://lokal-kartlegging-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "lokal-kartlegging",
    storageBucket: "lokal-kartlegging.firebasestorage.app",
    messagingSenderId: "913824113769",
    appId: "1:913824113769:web:95c6fdea2d3b49813d6ef8"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let lagredeResultater = {};
let valgtElevId = "";
let myChart = null; 

// --- 2. AUTENTISERING ---
function login() { auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
function logout() { auth.signOut(); }

auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        document.getElementById('userInfo').innerText = user.displayName;
        hentData(); 
    } else {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainContent').style.display = 'none';
    }
});

// --- 3. HJELPEFUNKSJONER ---
function hentOppsettSpesifikk(aar, fag, periode, trinn) {
    try {
        return oppgaveStruktur[aar][fag][periode][trinn];
    } catch (e) {
        return null;
    }
}

function hentOppsett() {
    const aar = document.getElementById('mAar').value;
    const fag = document.getElementById('mFag').value;
    const periode = document.getElementById('mPeriode').value;
    const trinn = document.getElementById('mTrinn').value;
    return hentOppsettSpesifikk(aar, fag, periode, trinn);
}

function hentSti(elev) {
    const a = document.getElementById('mAar').value;
    const f = document.getElementById('mFag').value;
    const p = document.getElementById('mPeriode').value;
    const t = document.getElementById('mTrinn').value;
    const k = document.getElementById('mKlasse').value;
    return `kartlegging/${a}/${f}/${p}/${t}/${k}/${elev}`;
}

// --- 4. HOVEDLOGIKK (TABELL-VISNING) ---
function hentData() {
    const a = document.getElementById('mAar').value;
    const f = document.getElementById('mFag').value;
    const p = document.getElementById('mPeriode').value;
    const t = document.getElementById('mTrinn').value;
    const k = document.getElementById('mKlasse').value;

    if (!a || !f || !p || !t || !k) return;

    db.ref(`kartlegging/${a}/${f}/${p}/${t}/${k}`).on('value', snapshot => {
        lagredeResultater = snapshot.val() || {};
        tegnTabell();
    });
}

function tegnTabell() {
    // Viser tabellen igjen hvis vi har vært i rapport-modus
    document.getElementById('registreringsVisning').style.display = 'block';
    const oppsett = hentOppsett();
    const tHead = document.getElementById('tHead');
    const tBody = document.getElementById('tBody');
    if (!oppsett) {
        tBody.innerHTML = "<tr><td>Ingen mal funnet.</td></tr>";
        return;
    }

    const trinn = document.getElementById('mTrinn').value;
    const klasse = document.getElementById('mKlasse').value;
    const fag = document.getElementById('mFag').value;
    const aar = document.getElementById('mAar').value;

    let hode = `<tr><th>Elevnavn</th>`;
    oppsett.oppgaver.forEach(o => hode += `<th>${o.navn}</th>`);
    hode += `<th>Sum</th><th class="no-print">Handling</th></tr>`;
    tHead.innerHTML = hode;

    const aarStart = parseInt(aar.split('-')[0]);
    tBody.innerHTML = "";

    Object.keys(elevRegister).sort().forEach(navn => {
        const e = elevRegister[navn];
        const curT = e.startTrinn + (aarStart - e.startAar);
        
        if (curT == trinn && e.startKlasse === klasse) {
            const d = lagredeResultater[navn];
            if (d && d.skjult) return;

            let rad = `<tr><td style="text-align:left"><b>${navn}</b></td>`;
            if (d && d.oppgaver) {
                oppsett.oppgaver.forEach((o, i) => {
                    const p = d.oppgaver[i] || 0;
                    let cls = (fag === "Lesing" && o.grense !== -1 && p <= o.grense) ? 'class="alert-low"' : '';
                    rad += `<td ${cls}>${p}</td>`;
                });
                let sumCls = (d.sum <= oppsett.grenseTotal) ? 'class="alert-low"' : '';
                rad += `<td ${sumCls}>${d.sum}</td><td class="no-print"><button class="btn btn-edit" onclick="visModal('${navn}')">Endre</button></td>`;
            } else {
                oppsett.oppgaver.forEach(() => rad += `<td>-</td>`);
                rad += `<td>-</td><td class="no-print"><button class="btn btn-reg" onclick="visModal('${navn}')">Registrer</button></td>`;
            }
            tBody.innerHTML += rad + `</tr>`;
        }
    });
}

// --- 5. ADMIN ÅRSRAPPORT (ALLE TRINN, SIDE PER KLASSE) ---
async function kjorAdminRapport(type) {
    const aar = document.getElementById('adminAar').value;
    const fag = document.getElementById('adminFag').value;
    const periode = document.getElementById('adminPeriode').value;
    
    document.getElementById('modalRapport').style.display = 'none';
    
    // SKJULER registrerings-delen for å gi plass til rapporten
    const regVisning = document.getElementById('registreringsVisning');
    if(regVisning) regVisning.style.display = 'none';

    const hovedInnhold = document.getElementById('hovedInnhold');
    hovedInnhold.innerHTML = "<p style='padding:20px; font-weight:bold;'>Genererer fullstendig rapport for alle trinn og klasser. Vennligst vent...</p>";
    
    let samletHTML = "";
    const trinnListe = ["1", "2", "3", "4", "5", "6", "7"];
    const klasser = ["A", "B", "C", "D"];

    for (let t of trinnListe) {
        const oppsett = hentOppsettSpesifikk(aar, fag, periode, t);
        if (!oppsett) continue;

        for (let k of klasser) {
            const snap = await db.ref(`kartlegging/${aar}/${fag}/${periode}/${t}/${k}`).once('value');
            const data = snap.val() || {};
            
            let eleverData = Object.keys(data)
                .map(navn => ({ navn, ...data[navn] }))
                .filter(d => !d.skjult && d.oppgaver)
                .filter(d => type === 'alle' || d.sum <= oppsett.grenseTotal);

            if (eleverData.length > 0) {
                samletHTML += `
                <div style="page-break-before: always; padding: 20px; color: black; background: white;">
                    <style>
                        @media print { 
                            @page { size: landscape; margin: 1cm; }
                            body { background: white; }
                        }
                        .admin-report-table { width: 100%; border-collapse: collapse; font-size: 0.8em; margin-top: 10px; }
                        .admin-report-table th, .admin-report-table td { border: 1px solid black; padding: 4px; text-align: center; }
                        .admin-report-table th { background-color: #eee !important; -webkit-print-color-adjust: exact; }
                    </style>
                    <h2 style="text-align:center; margin-bottom: 5px;">${fag} - ${t}${k} (${periode} ${aar})</h2>
                    <table class="admin-report-table">
                        <thead>
                            <tr>
                                <th style="text-align:left; width: 220px;">Elevnavn</th>
                                ${oppsett.oppgaver.map(o => `<th>${o.navn}<br><small>max ${o.maks}</small></th>`).join("")}
                                <th>Sum</th>
                            </tr>
                        </thead>
                        <tbody>`;

                eleverData.sort((a,b) => a.navn.localeCompare(b.navn)).forEach(d => {
                    let rad = `<tr><td style="text-align:left;"><b>${d.navn}</b></td>`;
                    oppsett.oppgaver.forEach((o, i) => {
                        const p = d.oppgaver[i] || 0;
                        let c = (fag === "Lesing" && o.grense !== -1 && p <= o.grense) ? 'background-color:#ffcccc !important; -webkit-print-color-adjust: exact;' : '';
                        rad += `<td style="${c}">${p}</td>`;
                    });
                    let sC = (d.sum <= oppsett.grenseTotal) ? 'background-color:#ffcccc !important; -webkit-print-color-adjust: exact;' : '';
                    rad += `<td style="font-weight:bold; ${sC}">${d.sum}</td></tr>`;
                    samletHTML += rad;
                });

                // Fyller opp til 26 rader
                const tommeRader = 26 - eleverData.length;
                for(let i = 0; i < tommeRader; i++) {
                    samletHTML += `<tr><td style="color:transparent;">.</td>${oppsett.oppgaver.map(()=>`<td></td>`).join("")}<td></td></tr>`;
                }

                samletHTML += `</tbody></table></div>`;
            }
        }
    }

    if (document.getElementById('printTittel')) document.getElementById('printTittel').innerText = "";
    hovedInnhold.innerHTML = samletHTML || "<p style='padding:20px;'>Ingen data funnet for valgte kriterier.</p>";
}

// --- 6. ADMIN SAMMENLIGNING (SØYLEDIAGRAM) ---
async function kjorSammenligning() {
    const aar = document.getElementById('mAar').value; 
    const fag = document.getElementById('mFag').value;
    const periode = document.getElementById('mPeriode').value;
    const trinn = document.getElementById('compTrinn').value;
    const oppsett = hentOppsettSpesifikk(aar, fag, periode, trinn);

    if(!oppsett) return alert("Ingen mal funnet for dette trinnet.");
    
    document.getElementById('modalSammenlign').style.display = 'none';
    document.getElementById('chartContainer').style.display = 'block';

    const klasser = ["A", "B", "C", "D"];
    const farger = ['#2980b9', '#27ae60', '#e67e22', '#8e44ad'];
    let datasets = [];

    for (let i = 0; i < klasser.length; i++) {
        const snap = await db.ref(`kartlegging/${aar}/${fag}/${periode}/${trinn}/${klasser[i]}`).once('value');
        const data = snap.val() || {};
        let antall = 0;
        let summer = new Array(oppsett.oppgaver.length).fill(0);
        let totalSum = 0;

        Object.keys(data).forEach(n => {
            if (!data[n].skjult && data[n].oppgaver) {
                antall++;
                data[n].oppgaver.forEach((p, idx) => summer[idx] += p);
                totalSum += data[n].sum;
            }
        });

        if (antall > 0) {
            let snittData = summer.map(s => (s / antall).toFixed(1));
            snittData.push((totalSum / antall).toFixed(1));

            datasets.push({
                label: `Klasse ${trinn}${klasser[i]}`,
                data: snittData,
                backgroundColor: farger[i]
            });
        }
    }

    const labels = [...oppsett.oppgaver.map(o => o.navn), "TOTAL"];
    const ctx = document.getElementById('sammenligningsChart').getContext('2d');
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: labels, datasets: datasets },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
}

// --- 7. MODAL & LAGRING ---
function visModal(navn) {
    const oppsett = hentOppsett();
    valgtElevId = navn;
    document.getElementById('modalNavn').innerText = navn;
    const container = document.getElementById('oppgaveFelter');
    container.innerHTML = "";
    const eksisterende = lagredeResultater[navn]?.oppgaver || [];

    oppsett.oppgaver.forEach((o, i) => {
        container.innerHTML += `<div><label>${o.navn}:</label> 
            <input type="number" class="oppg-input" data-index="${i}" value="${eksisterende[i] || 0}" style="width:50px"></div>`;
    });
    document.getElementById('modal').style.display = 'block';
}

function lukkModal() { document.getElementById('modal').style.display = 'none'; }

function lagreData() {
    const inputs = document.querySelectorAll('.oppg-input');
    let verdier = [], sum = 0;
    inputs.forEach(i => { const v = parseInt(i.value) || 0; verdier.push(v); sum += v; });
    db.ref(hentSti(valgtElevId)).update({ oppgaver: verdier, sum: sum, dato: new Date().toISOString() }).then(lukkModal);
}

function sjekkAdminKode() {
    if (prompt("Kode:") === "3850") document.getElementById('adminPanel').style.display = 'block';
}

function forberedPrint() { window.print(); }