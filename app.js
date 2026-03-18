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

let redigererNøkkel = null; 
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
        console.error("Kunne ikke finne oppsett", e);
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

// --- 4. HOVEDLOGIKK ---
function hentData() {
    const a = document.getElementById('mAar').value;
    const f = document.getElementById('mFag').value;
    const p = document.getElementById('mPeriode').value;
    const t = document.getElementById('mTrinn').value;
    const k = document.getElementById('mKlasse').value;

    const tBody = document.getElementById('tBody');
    const tHead = document.getElementById('tHead');

    if (!a || !f || !p || !t || !k) {
        tHead.innerHTML = "";
        tBody.innerHTML = "<tr><td colspan='100%' style='padding:40px; color:#666;'>Vennligst velg år, fag, periode, trinn og klasse for å vise listen.</td></tr>";
        if (document.getElementById('dynamiskOverskrift')) document.getElementById('dynamiskOverskrift').innerText = "";
        return; 
    }

    db.ref(`kartlegging/${a}/${f}/${p}/${t}/${k}`).on('value', snapshot => {
        lagredeResultater = snapshot.val() || {};
        tegnTabell();
    });
}

function tegnTabell() {
    const oppsett = hentOppsett();
    const fag = document.getElementById('mFag').value;
    const tHead = document.getElementById('tHead');
    const tBody = document.getElementById('tBody');
    const trinn = document.getElementById('mTrinn').value;
    const klasse = document.getElementById('mKlasse').value;
    const periode = document.getElementById('mPeriode').value;
    const aar = document.getElementById('mAar').value;

    const overskriftTekst = `Kartlegging i ${fag.toLowerCase()} - ${trinn}${klasse} - ${periode.toLowerCase()}en ${aar}`;
    if (document.getElementById('dynamiskOverskrift')) document.getElementById('dynamiskOverskrift').innerText = overskriftTekst;
    if (document.getElementById('printTittel')) document.getElementById('printTittel').innerText = overskriftTekst;

    if (!oppsett) {
        tBody.innerHTML = "<tr><td colspan='100%'>Ingen oppgavemal funnet.</td></tr>";
        return;
    }

    let hode = `<tr><th style="text-align:left">Elevnavn</th>`;
    oppsett.oppgaver.forEach(o => hode += `<th>${o.navn}<br><small>max ${o.maks}</small></th>`);
    hode += `<th>Sum</th><th class="no-print">Handling</th></tr>`;
    tHead.innerHTML = hode;

    let aktive = [], skjulte = [];
    const valgtTrinn = parseInt(trinn);
    const valgtKlasse = klasse;
    const valgtSkoleAarStart = parseInt(aar.split('-')[0]);

    Object.keys(elevRegister).sort().forEach(navn => {
        const elev = elevRegister[navn];
        const currentTrinn = elev.startTrinn + (valgtSkoleAarStart - elev.startAar);
        if (currentTrinn === valgtTrinn && elev.startKlasse === valgtKlasse) {
            if (lagredeResultater[navn] && lagredeResultater[navn].skjult === true) skjulte.push(navn);
            else aktive.push(navn);
        }
    });

    tBody.innerHTML = "";
    aktive.forEach(navn => {
        const d = lagredeResultater[navn];
        let rad = `<tr><td style="text-align:left"><b>${navn}</b></td>`;
        if (d && d.oppgaver) {
            oppsett.oppgaver.forEach((o, i) => {
                const p = d.oppgaver[i] || 0;
                let cls = (fag === "Lesing" && o.grense !== -1 && p <= o.grense) ? 'class="alert-low"' : '';
                rad += `<td ${cls}>${p}</td>`;
            });
            const sumCls = (d.sum <= oppsett.grenseTotal) ? 'class="alert-low"' : '';
            rad += `<td ${sumCls}>${d.sum}</td><td class="no-print"><button class="btn btn-edit" onclick="visModal('${navn}')">Endre</button> <button class="btn btn-slett" onclick="slettPoeng('${navn}')">Nullstill</button> <button class="btn btn-fjern" onclick="skjulElev('${navn}', true)">Fjern</button></td>`;
        } else {
            oppsett.oppgaver.forEach(() => rad += `<td class="not-registered">-</td>`);
            rad += `<td class="not-registered">-</td><td class="no-print"><button class="btn btn-reg" onclick="visModal('${navn}')">Registrer</button> <button class="btn btn-fjern" onclick="skjulElev('${navn}', true)">Fjern</button></td>`;
        }
        tBody.innerHTML += rad + `</tr>`;
    });

    if (skjulte.length > 0) {
        tBody.innerHTML += `<tr class="no-print"><td colspan="100%" class="skjult-seksjon">Fjernede elever</td></tr>`;
        skjulte.forEach(navn => {
            tBody.innerHTML += `<tr class="no-print"><td><i>${navn}</i></td><td colspan="${oppsett.oppgaver.length + 1}"></td><td><button class="btn btn-hent" onclick="skjulElev('${navn}', false)">Hent tilbake</button></td></tr>`;
        });
    }
}

// --- 5. MODAL OG HANDLINGER ---
function visModal(navn) {
    const oppsett = hentOppsett();
    valgtElevId = navn;
    document.getElementById('modalNavn').innerText = navn;
    const container = document.getElementById('oppgaveFelter');
    container.innerHTML = "";
    const eksisterende = lagredeResultater[navn]?.oppgaver || [];

    oppsett.oppgaver.forEach((o, i) => {
        container.innerHTML += `<div class="oppgave-rad"><label>${o.navn} (0-${o.maks}):</label><input type="number" class="oppg-input" data-index="${i}" min="0" max="${o.maks}" value="${eksisterende[i] !== undefined ? eksisterende[i] : ""}" style="width:60px"></div>`;
    });
    document.getElementById('modal').style.display = 'block';
    setTimeout(() => { if(container.querySelector('input')) container.querySelector('input').focus(); }, 100);
}

function lukkModal() { document.getElementById('modal').style.display = 'none'; }

function lagreData() {
    const inputs = document.querySelectorAll('.oppg-input');
    let verdier = [], sum = 0;
    inputs.forEach(i => { const v = parseInt(i.value) || 0; verdier.push(v); sum += v; });
    db.ref(hentSti(valgtElevId)).update({ oppgaver: verdier, sum: sum, dato: new Date().toISOString(), skjult: null }).then(lukkModal);
}

function slettPoeng(navn) { if(confirm(`Nullstille poeng for ${navn}?`)) db.ref(hentSti(navn)).remove(); }

function skjulElev(navn, status) { 
    if(status) { if(confirm(`Fjerne ${navn} fra listen?`)) db.ref(hentSti(navn) + "/skjult").set(true); }
    else { db.ref(hentSti(navn) + "/skjult").remove(); }
}

function leggTilNyElev() {
    const e = document.getElementById('nyttEtternavn').value.trim();
    const f = document.getElementById('nyttFornavn').value.trim();
    if(!e || !f) return alert("Navn mangler");
    const navn = `${e}, ${f}`;
    elevRegister[navn] = { startTrinn: parseInt(document.getElementById('mTrinn').value), startKlasse: document.getElementById('mKlasse').value, startAar: parseInt(document.getElementById('mAar').value.split('-')[0]) };
    tegnTabell();
    document.getElementById('nyttEtternavn').value = ""; document.getElementById('nyttFornavn').value = "";
}

// --- 6. ADMIN-FUNKSJONER (NYE) ---

function sjekkAdminKode() {
    const kode = prompt("Vennligst oppgi adminkode:");
    if (kode === "3850") { document.getElementById('adminPanel').style.display = 'block'; }
    else if (kode !== null) { alert("Feil kode."); }
}

async function kjorAdminRapport(type) {
    const aar = document.getElementById('adminAar').value;
    const fag = document.getElementById('adminFag').value;
    const periode = document.getElementById('adminPeriode').value;
    const trinn = document.getElementById('adminTrinn').value;
    const oppsett = hentOppsettSpesifikk(aar, fag, periode, trinn);
    
    if(!oppsett) return alert("Fant ikke oppsett for dette valget.");
    document.getElementById('modalRapport').style.display = 'none';

    const tBody = document.getElementById('tBody');
    const tHead = document.getElementById('tHead');
    tBody.innerHTML = "<tr><td colspan='100%'>Henter data for hele trinnet...</td></tr>";
    
    let samletData = [];
    const klasser = ["A", "B", "C", "D"];

    for (let k of klasser) {
        const snap = await db.ref(`kartlegging/${aar}/${fag}/${periode}/${trinn}/${k}`).once('value');
        const data = snap.val() || {};
        Object.keys(data).forEach(navn => {
            if (!data[navn].skjult && data[navn].oppgaver) {
                if (type === 'kritisk' && data[navn].sum > oppsett.grenseTotal) return;
                samletData.push({ navn, klasse: k, ...data[navn] });
            }
        });
    }

    document.getElementById('printTittel').innerText = (type === 'kritisk' ? "Kritisk Grense Rapport: " : "Årsrapport: ") + `${fag} - ${trinn}. trinn - ${periode}en ${aar}`;
    tHead.innerHTML = `<tr><th>Klasse</th><th style="text-align:left">Navn</th>${oppsett.oppgaver.map(o=>`<th>${o.navn}</th>`).join("")}<th>Sum</th></tr>`;
    tBody.innerHTML = samletData.length ? "" : "<tr><td colspan='100%'>Ingen registrerte data funnet.</td></tr>";

    samletData.sort((a,b) => a.klasse.localeCompare(b.klasse) || a.navn.localeCompare(b.navn)).forEach(d => {
        let rad = `<tr><td>${d.klasse}</td><td style="text-align:left"><b>${d.navn}</b></td>`;
        oppsett.oppgaver.forEach((o, i) => {
            const p = d.oppgaver[i] || 0;
            let c = (fag === "Lesing" && o.grense !== -1 && p <= o.grense) ? 'class="alert-low"' : '';
            rad += `<td ${c}>${p}</td>`;
        });
        rad += `<td ${(d.sum <= oppsett.grenseTotal) ? 'class="alert-low"' : ''}>${d.sum}</td></tr>`;
        tBody.innerHTML += rad;
    });
}

async function kjorSammenligning() {
    const aar = document.getElementById('compAar').value;
    const fag = document.getElementById('compFag').value;
    const periode = document.getElementById('compPeriode').value;
    const trinn = document.getElementById('compTrinn').value;
    const oppsett = hentOppsettSpesifikk(aar, fag, periode, trinn);

    if(!oppsett) return alert("Fant ikke oppsett.");
    document.getElementById('modalSammenlign').style.display = 'none';
    document.getElementById('chartContainer').style.display = 'block';

    const klasser = ["A", "B", "C", "D"];
    const farger = ['rgba(41, 128, 185, 0.7)', 'rgba(39, 174, 96, 0.7)', 'rgba(230, 126, 34, 0.7)', 'rgba(155, 89, 182, 0.7)'];
    let datasets = [];

    for (let i = 0; i < klasser.length; i++) {
        const snap = await db.ref(`kartlegging/${aar}/${fag}/${periode}/${trinn}/${klasser[i]}`).once('value');
        const data = snap.val() || {};
        let antall = 0, summer = new Array(oppsett.oppgaver.length + 1).fill(0);

        Object.keys(data).forEach(n => {
            if (!data[n].skjult && data[n].oppgaver) {
                antall++;
                data[n].oppgaver.forEach((p, idx) => summer[idx] += p);
                summer[oppsett.oppgaver.length] += data[n].sum;
            }
        });

        if (antall > 0) {
            datasets.push({
                label: `Klasse ${trinn}${klasser[i]}`,
                data: summer.map(s => (s / antall).toFixed(1)),
                backgroundColor: farger[i],
                borderColor: farger[i].replace('0.7', '1'),
                borderWidth: 1
            });
        }
    }

    const ctx = document.getElementById('sammenligningsChart').getContext('2d');
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: [...oppsett.oppgaver.map(o => o.navn), "Total"], datasets },
        options: { responsive: true, scales: { y: { beginAtZero: true } }, plugins: { title: { display: true, text: `Snitt per oppgave: ${fag} ${trinn}.trinn (${periode} ${aar})` } } }
    });
}

// --- 7. EKSPORT OG PRINT ---
function forberedPrint() { window.print(); }

function eksporterTilExcel() {
    const oppsett = hentOppsett();
    const t = parseInt(document.getElementById('mTrinn').value);
    const k = document.getElementById('mKlasse').value;
    const a = parseInt(document.getElementById('mAar').value.split('-')[0]);
    const aktiveNavn = Object.keys(elevRegister).filter(n => {
        const e = elevRegister[n];
        const curT = e.startTrinn + (a - e.startAar);
        return curT === t && e.startKlasse === k && !(lagredeResultater[n] && lagredeResultater[n].skjult === true);
    }).sort();
    let csv = "\uFEFFElevnavn;" + oppsett.oppgaver.map(o => o.navn).join(";") + ";Sum\n";
    aktiveNavn.forEach(n => {
        const d = lagredeResultater[n];
        csv += `${n};${(d && d.oppgaver) ? d.oppgaver.join(";") : oppsett.oppgaver.map(()=>"").join(";")};${(d && d.sum) ? d.sum : ""}\n`;
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = `Eksport_${document.getElementById('mFag').value}.csv`;
    link.click();
}

// Enter-tast logikk
document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && document.getElementById('modal').style.display === 'block') {
        const inputs = Array.from(document.querySelectorAll('.oppg-input'));
        const idx = inputs.indexOf(document.activeElement);
        if (idx > -1 && idx < inputs.length - 1) { e.preventDefault(); inputs[idx+1].focus(); inputs[idx+1].select(); }
        else if (idx === inputs.length - 1) { lagreData(); }
    }
});