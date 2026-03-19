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

// Initialisering
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let lagredeResultater = {};
let valgtElevId = "";
let myChart = null; 

// --- 2. AUTENTISERING ---
function login() { 
    auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())
        .catch(err => console.error("Innloggingsfeil:", err)); 
}

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
    try { return oppgaveStruktur[aar][fag][periode][trinn]; } 
    catch (e) { return null; }
}

function hentOppsett() {
    const aar = document.getElementById('mAar').value;
    const fag = document.getElementById('mFag').value;
    const periode = document.getElementById('mPeriode').value;
    const trinn = document.getElementById('mTrinn').value;
    return hentOppsettSpesifikk(aar, fag, periode, trinn);
}

function oppdaterOverskrifter(tekst) {
    if (document.getElementById('dynamiskOverskrift')) document.getElementById('dynamiskOverskrift').innerText = tekst;
    if (document.getElementById('printTittel')) document.getElementById('printTittel').innerText = tekst;
}

function hentSti(elev) {
    const a = document.getElementById('mAar').value;
    const f = document.getElementById('mFag').value;
    const p = document.getElementById('mPeriode').value;
    const t = document.getElementById('mTrinn').value;
    const k = document.getElementById('mKlasse').value;
    return `kartlegging/${a}/${f}/${p}/${t}/${k}/${elev}`;
}

// --- 4. DATAHÅNDTERING ---
function hentData() {
    // Tilbakestill visning til standard tabell hvis rapport er åpen
    document.getElementById('hovedTabell').style.display = 'table';
    const rc = document.getElementById('rapportContainer');
    if (rc) rc.innerHTML = "";

    const a = document.getElementById('mAar').value;
    const f = document.getElementById('mFag').value;
    const p = document.getElementById('mPeriode').value;
    const t = document.getElementById('mTrinn').value;
    const k = document.getElementById('mKlasse').value;

    if (!a || !f || !p || !t || !k) return;

    oppdaterOverskrifter(`Kartlegging i ${f} - ${t}${k} - ${p} ${a}`);

    db.ref(`kartlegging/${a}/${f}/${p}/${t}/${k}`).on('value', snapshot => {
        lagredeResultater = snapshot.val() || {};
        tegnTabell();
    });
}

function tegnTabell() {
    const oppsett = hentOppsett();
    const tHead = document.getElementById('tHead');
    const tBody = document.getElementById('tBody');
    if (!oppsett) { tBody.innerHTML = "<tr><td>Velg alle kriterier...</td></tr>"; return; }

    let hode = `<tr><th style="text-align:left">Elevnavn</th>`;
    oppsett.oppgaver.forEach(o => hode += `<th>${o.navn}<br><small>max ${o.maks}</small></th>`);
    hode += `<th>Sum</th><th class="no-print">Handling</th></tr>`;
    tHead.innerHTML = hode;

    const vTrinn = parseInt(document.getElementById('mTrinn').value);
    const vKlasse = document.getElementById('mKlasse').value;
    const vStartAar = parseInt(document.getElementById('mAar').value.split('-')[0]);

    tBody.innerHTML = "";
    Object.keys(elevRegister).sort().forEach(navn => {
        const e = elevRegister[navn];
        const cTrinn = e.startTrinn + (vStartAar - e.startAar);
        
        if (cTrinn === vTrinn && e.startKlasse === vKlasse) {
            const d = lagredeResultater[navn];
            let rad = `<tr><td style="text-align:left"><b>${navn}</b></td>`;
            if (d && d.oppgaver) {
                oppsett.oppgaver.forEach((o, i) => {
                    const poeng = d.oppgaver[i] || 0;
                    let cls = (o.grense !== -1 && poeng <= o.grense) ? 'class="alert-low"' : '';
                    rad += `<td ${cls}>${poeng}</td>`;
                });
                let sumCls = (d.sum <= oppsett.grenseTotal) ? 'class="alert-low"' : '';
                rad += `<td ${sumCls}>${d.sum}</td><td class="no-print"><button class="btn btn-edit" onclick="visModal('${navn}')">Endre</button></td>`;
            } else {
                oppsett.oppgaver.forEach(() => rad += `<td class="not-registered">-</td>`);
                rad += `<td class="not-registered">-</td><td class="no-print"><button class="btn btn-reg" onclick="visModal('${navn}')">Reg</button></td>`;
            }
            tBody.innerHTML += rad + `</tr>`;
        }
    });
}

// --- 5. MODAL OG LAGRING ---
function visModal(navn) {
    const oppsett = hentOppsett();
    valgtElevId = navn;
    document.getElementById('modalNavn').innerText = navn;
    const container = document.getElementById('oppgaveFelter');
    container.innerHTML = "";
    const eksisterende = lagredeResultater[navn]?.oppgaver || [];

    oppsett.oppgaver.forEach((o, i) => {
        container.innerHTML += `<div class="oppgave-rad"><label>${o.navn}:</label><input type="number" class="oppg-input" data-index="${i}" min="0" max="${o.maks}" value="${eksisterende[i] !== undefined ? eksisterende[i] : ""}" style="width:60px"></div>`;
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

// --- 6. ADMIN-FUNKSJONER ---
function sjekkAdminKode() {
    if (prompt("Adminkode:") === "3850") { 
        document.getElementById('adminPanel').style.display = 'block'; 
        document.getElementById('skjemaInnhold').style.display = 'none';
    }
}

function lukkAdmin() {
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('chartContainer').style.display = 'none';
    document.getElementById('skjemaInnhold').style.display = 'block';
    document.getElementById('hovedTabell').style.display = 'table';
}

async function kjorAdminRapport(type) {
    const aar = document.getElementById('adminAar').value;
    const fag = document.getElementById('adminFag').value;
    const periode = document.getElementById('adminPeriode').value;
    
    // Vis skjemaInnhold slik at rapporten blir synlig
    document.getElementById('skjemaInnhold').style.display = 'block';
    document.getElementById('hovedTabell').style.display = 'none';

    let samletInnhold = "";
    const klasser = ["A", "B", "C", "D"];
    const alleTrinn = ["1", "2", "3", "4", "5", "6", "7"];

    for (let trinn of alleTrinn) {
        for (let klasse of klasser) { // Rettet fra 'av' til 'of'
            const oppsett = hentOppsettSpesifikk(aar, fag, periode, trinn);
            if (!oppsett) continue;

            const snapshot = await db.ref(`kartlegging/${aar}/${fag}/${periode}/${trinn}/${klasse}`).once('value');
            const data = snapshot.val() || {};

            let seksjonOverskrift = `Kartlegging i ${fag} - ${trinn}${klasse} - ${periode} ${aar}`;
            
            let tabellHtml = `<div class="page-break">
                <h2 style="text-align:center; margin-top:20px;">${seksjonOverskrift}</h2>
                <table style="width:100%; border-collapse:collapse; margin-bottom:40px;">
                    <thead>
                        <tr>
                            <th style="text-align:left">Elevnavn</th>`;
            oppsett.oppgaver.forEach(o => tabellHtml += `<th>${o.navn}<br><small>max ${o.maks}</small></th>`);
            tabellHtml += `<th>Sum</th></tr></thead><tbody>`;

            const vStartAar = parseInt(aar.split('-')[0]);
            let antallElever = 0;

            Object.keys(elevRegister).sort().forEach(navn => {
                const e = elevRegister[navn];
                const cTrinn = e.startTrinn + (vStartAar - e.startAar);
                
                if (cTrinn == trinn && e.startKlasse === klasse) {
                    const d = data[navn];
                    const erKritisk = d && d.sum <= oppsett.grenseTotal;

                    if (type === 'kritisk' && (!d || !erKritisk)) return;

                    antallElever++;
                    let rad = `<tr><td style="text-align:left"><b>${navn}</b></td>`;
                    
                    if (d && d.oppgaver) {
                        oppsett.oppgaver.forEach((o, i) => {
                            const poeng = d.oppgaver[i] || 0;
                            let cls = (o.grense !== -1 && poeng <= o.grense) ? 'style="background-color:#ffcccc"' : '';
                            rad += `<td ${cls}>${poeng}</td>`;
                        });
                        let sumCls = erKritisk ? 'style="background-color:#ffcccc"' : '';
                        rad += `<td ${sumCls}>${d.sum}</td>`;
                    } else {
                        oppsett.oppgaver.forEach(() => rad += `<td class="not-registered">-</td>`);
                        rad += `<td class="not-registered">-</td>`;
                    }
                    tabellHtml += rad + `</tr>`;
                }
            });

            if (antallElever > 0 || type === 'alle') {
                // Fyll ut rader for penere utskrift hvis ønskelig
                for (let i = antallElever; i < 26; i++) {
                    tabellHtml += `<tr><td style="color:#eee">.</td>${oppsett.oppgaver.map(() => `<td></td>`).join('')}<td></td></tr>`;
                }
                tabellHtml += `</tbody></table></div>`;
                samletInnhold += tabellHtml;
            }
        }
    }

    document.getElementById('modalRapport').style.display = 'none';
    
    let rapportContainer = document.getElementById('rapportContainer');
    if (!rapportContainer) {
        rapportContainer = document.createElement('div');
        rapportContainer.id = 'rapportContainer';
        document.getElementById('skjemaInnhold').appendChild(rapportContainer);
    }
    rapportContainer.innerHTML = samletInnhold;
    
    oppdaterOverskrifter(type === 'kritisk' ? 'KRITISK-LISTE (Alle trinn)' : 'ÅRSRAPPORT (Alle trinn)');
}

async function kjorSammenligning() {
    const aar = document.getElementById('compAar').value;
    const fag = document.getElementById('compFag').value;
    const periode = document.getElementById('compPeriode').value;
    const trinn = document.getElementById('compTrinn').value;
    const oppsett = hentOppsettSpesifikk(aar, fag, periode, trinn);
    if(!oppsett) return;

    document.getElementById('modalSammenlign').style.display = 'none';
    document.getElementById('chartContainer').style.display = 'block';

    const klasser = ["A", "B", "C", "D"];
    let datasets = [];
    const farger = ['rgba(41, 128, 185, 0.7)', 'rgba(39, 174, 96, 0.7)', 'rgba(230, 126, 34, 0.7)', 'rgba(155, 89, 182, 0.7)'];

    for (let i = 0; i < klasser.length; i++) {
        const snap = await db.ref(`kartlegging/${aar}/${fag}/${periode}/${trinn}/${klasser[i]}`).once('value');
        const data = snap.val() || {};
        let antall = 0, summer = new Array(oppsett.oppgaver.length + 1).fill(0);

        Object.keys(data).forEach(n => {
            if (data[n].oppgaver) {
                antall++;
                data[n].oppgaver.forEach((p, idx) => summer[idx] += p);
                summer[oppsett.oppgaver.length] += data[n].sum;
            }
        });

        if (antall > 0) {
            datasets.push({
                label: `Klasse ${klasser[i]}`,
                data: summer.map(s => (s / antall).toFixed(1)),
                backgroundColor: farger[i]
            });
        }
    }

    const ctx = document.getElementById('sammenligningsChart').getContext('2d');
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: [...oppsett.oppgaver.map(o => o.navn), "Total"], datasets }
    });
}

function forberedPrint() { window.print(); }