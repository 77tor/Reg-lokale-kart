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
        document.getElementById('loginScreen').style.display = 'block';
        document.getElementById('mainContent').style.display = 'none';
    }
});

// --- 3. DATAHÅNDTERING ---
function hentValg() {
    return {
        aar: document.getElementById('valgtAar').value,
        fag: document.getElementById('valgtFag').value,
        periode: document.getElementById('valgtPeriode').value,
        trinn: document.getElementById('valgtTrinn').value,
        klasse: document.getElementById('valgtKlasse').value
    };
}

function hentSti(elevnavn) {
    const v = hentValg();
    return `resultater/${v.aar}/${v.fag}/${v.periode}/${v.trinn}/${elevnavn}`;
}

function hentData() {
    const v = hentValg();
    document.getElementById('printTittel').innerText = `Kartlegging ${v.fag} - ${v.trinn}. trinn ${v.klasse} (${v.periode} ${v.aar})`;
    
    const sti = `resultater/${v.aar}/${v.fag}/${v.periode}/${v.trinn}`;
    db.ref(sti).on('value', snapshot => {
        lagredeResultater = snapshot.val() || {};
        tegnTabell();
    });
}

// --- 4. TABELLTEGNING ---
function tegnTabell() {
    const v = hentValg();
    const oppsett = oppgaveStruktur[v.aar][v.fag][v.periode][v.trinn];
    const hode = document.getElementById('tabellHode');
    const kropp = document.getElementById('tabellKropp');
    
    // Overskrifter
    let hodeHtml = `<th style="text-align:left">Elevnavn</th>`;
    oppsett.oppgaver.forEach(o => hodeHtml += `<th>${o.navn}<br><small>(max ${o.maks})</small></th>`);
    hodeHtml += `<th>TOTALT<br><small>(max ${oppsett.oppgaver.reduce((a,b)=>a+b.maks,0)})</small></th><th class="no-print">Handling</th>`;
    hode.innerHTML = hodeHtml;

    // Filtrer elever
    const aktuelleElever = Object.keys(elevRegister).filter(navn => {
        const e = elevRegister[navn];
        const navaar = parseInt(v.aar.split('-')[0]);
        const beregnetTrinn = e.startTrinn + (navaar - e.startAar);
        return beregnetTrinn == v.trinn && e.startKlasse === v.klasse;
    }).sort();

    let kroppHtml = "";
    let antKritiske = 0;
    let sumTotal = 0;
    let antMedPoeng = 0;

    aktuelleElever.forEach(navn => {
        const res = lagredeResultater[navn] || {};
        if (res.skjult) return;

        let radHtml = `<td style="text-align:left">${navn}</td>`;
        let elevSum = 0;
        let harData = false;

        oppsett.oppgaver.forEach(o => {
            const p = res[o.navn] !== undefined ? res[o.navn] : "-";
            const krt = (o.grense !== -1 && p !== "-" && p <= o.grense) ? 'class="krt-felt"' : '';
            radHtml += `<td ${krt}>${p}</td>`;
            if (p !== "-") { elevSum += parseInt(p); harData = true; }
        });

        const totalKrt = (elevSum <= oppsett.grenseTotal && harData) ? 'class="krt-felt"' : '';
        if (totalKrt) antKritiske++;
        if (harData) { sumTotal += elevSum; antMedPoeng++; }

        radHtml += `<td ${totalKrt}>${harData ? elevSum : "-"}</td>`;
        radHtml += `<td class="no-print">
            <button class="btn btn-edit" onclick="aapneRegistrering('${navn}')">Reg</button>
            <button class="btn btn-slett" onclick="slettPoeng('${navn}')">✕</button>
        </td>`;
        kroppHtml += `<tr>${radHtml}</tr>`;
    });

    kropp.innerHTML = kroppHtml;

    // Statistikk
    const snitt = antMedPoeng > 0 ? (sumTotal / antMedPoeng).toFixed(1) : 0;
    document.getElementById('statistikk').innerHTML = `
        <div class="stat-card"><strong>Antall elever:</strong> ${aktuelleElever.length}</div>
        <div class="stat-card"><strong>Under bekymringsgrense:</strong> ${antKritiske}</div>
        <div class="stat-card"><strong>Gjennomsnitt poeng:</strong> ${snitt}</div>
    `;
}

// --- 5. REGISTRERING ---
function aapneRegistrering(navn) {
    valgtElevId = navn;
    const v = hentValg();
    const oppsett = oppgaveStruktur[v.aar][v.fag][v.periode][v.trinn];
    const res = lagredeResultater[navn] || {};
    
    document.getElementById('modalNavn').innerText = navn;
    let gridHtml = "";
    oppsett.oppgaver.forEach(o => {
        const verdi = res[o.navn] !== undefined ? res[o.navn] : "";
        gridHtml += `<div>
            <label>${o.navn} (0-${o.maks})</label>
            <input type="number" id="inp_${o.navn}" value="${verdi}" min="0" max="${o.maks}" style="width:100%;padding:8px;">
        </div>`;
    });
    document.getElementById('poengInputGrid').innerHTML = gridHtml;
    document.getElementById('modalPoeng').style.display = 'block';
}

function lagrePoeng() {
    const v = hentValg();
    const oppsett = oppgaveStruktur[v.aar][v.fag][v.periode][v.trinn];
    const data = {};
    
    oppsett.oppgaver.forEach(o => {
        const val = document.getElementById(`inp_${o.navn}`).value;
        if (val !== "") data[o.navn] = parseInt(val);
    });

    if (Object.keys(data).length > 0) {
        db.ref(hentSti(valgtElevId)).update(data);
        document.getElementById('modalPoeng').style.display = 'none';
    }
}

// --- 6. ADMIN-FUNKSJONER ---
function sjekkAdminKode() {
    const kode = prompt("Oppgi adminkode:");
    if (kode === "1234") {
        document.getElementById('adminPanel').style.display = 'block';
        document.getElementById('skjemaInnhold').style.display = 'none';
    } else {
        alert("Feil kode");
    }
}

function lukkAdmin() {
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('chartContainer').style.display = 'none';
    document.getElementById('skjemaInnhold').style.display = 'block';
}

function kjorAdminRapport(type) {
    const v = hentValg();
    const oppsett = oppgaveStruktur[v.aar][v.fag][v.periode][v.trinn];
    const sti = `resultater/${v.aar}/${v.fag}/${v.periode}/${v.trinn}`;
    
    db.ref(sti).once('value', snapshot => {
        const data = snapshot.val() || {};
        let rapportHtml = `<h2>Årsrapport ${v.fag} - ${v.trinn}. trinn (${v.periode} ${v.aar})</h2>`;
        
        ['A', 'B', 'C'].forEach(kl => {
            rapportHtml += `<h3>Klasse ${kl}</h3><table border="1" style="width:100%;border-collapse:collapse;margin-bottom:20px;">`;
            rapportHtml += `<tr><th align="left">Navn</th><th>Poengsum</th><th>Status</th></tr>`;
            
            Object.keys(elevRegister).filter(n => {
                const e = elevRegister[n];
                const navaar = parseInt(v.aar.split('-')[0]);
                return (e.startTrinn + (navaar - e.startAar)) == v.trinn && e.startKlasse === kl;
            }).sort().forEach(n => {
                const res = data[n] || {};
                let sum = 0; let harData = false;
                oppsett.oppgaver.forEach(o => { if(res[o.navn]!==undefined){ sum += res[o.navn]; harData=true; }});
                
                const krt = sum <= oppsett.grenseTotal;
                if (type === 'kritisk' && (!krt || !harData)) return;

                rapportHtml += `<tr>
                    <td>${n}</td>
                    <td align="center">${harData ? sum : '-'}</td>
                    <td align="center">${harData ? (krt ? 'BEKYMRING' : 'OK') : '-'}</td>
                </tr>`;
            });
            rapportHtml += `</table>`;
        });

        const printWin = window.open('', '', 'width=800,height=600');
        printWin.document.write(rapportHtml);
        printWin.document.close();
        printWin.print();
    });
}

function genererSammenligning() {
    const aar = document.getElementById('compAar').value;
    const fag = document.getElementById('compFag').value;
    const periode = document.getElementById('compPeriode').value;
    const trinn = document.getElementById('compTrinn').value;
    const oppsett = oppgaveStruktur[aar][fag][periode][trinn];
    
    db.ref(`resultater/${aar}/${fag}/${periode}/${trinn}`).once('value', snapshot => {
        const data = snapshot.val() || {};
        const klasser = ['A', 'B', 'C'];
        const datasets = [];
        const farger = ['rgba(52, 152, 219, 0.7)', 'rgba(46, 204, 113, 0.7)', 'rgba(155, 89, 182, 0.7)'];

        klasser.forEach((kl, i) => {
            let summer = Array(oppsett.oppgaver.length + 1).fill(0);
            let antall = 0;

            Object.keys(elevRegister).forEach(n => {
                const e = elevRegister[n];
                const navaar = parseInt(aar.split('-')[0]);
                if ((e.startTrinn + (navaar - e.startAar)) == trinn && e.startKlasse === kl && data[n]) {
                    antall++;
                    let elevTotal = 0;
                    oppsett.oppgaver.forEach((o, idx) => {
                        const p = data[n][o.navn] || 0;
                        summer[idx] += p;
                        elevTotal += p;
                    });
                    summer[oppsett.oppgaver.length] += elevTotal;
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
        });

        document.getElementById('chartContainer').style.display = 'block';
        const ctx = document.getElementById('sammenligningsChart').getContext('2d');
        if (myChart) myChart.destroy();
        myChart = new Chart(ctx, {
            type: 'bar',
            data: { labels: [...oppsett.oppgaver.map(o => o.navn), "Total"], datasets },
            options: { responsive: true, scales: { y: { beginAtZero: true } } }
        });
        document.getElementById('modalSammenlign').style.display = 'none';
    });
}

// --- 7. EKSTRA ---
function forberedPrint() { window.print(); }

function skjulElev(navn, status) { 
    if(status) { if(confirm(`Fjerne ${navn} fra listen?`)) db.ref(hentSti(navn) + "/skjult").set(true); }
    else { db.ref(hentSti(navn) + "/skjult").remove(); }
}

function slettPoeng(navn) { if(confirm(`Nullstille poeng for ${navn}?`)) db.ref(hentSti(navn)).remove(); }

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        document.getElementById('modalPoeng').style.display = 'none';
        document.getElementById('modalRapport').style.display = 'none';
        document.getElementById('modalSammenlign').style.display = 'none';
    }
});