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

let redigererNøkkel = null; // Holder styr på om vi endrer eller legger til ny

// --- AUTENTISERING ---
function login() { auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
function logout() { auth.signOut(); }

auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        document.getElementById('userInfo').innerText = user.displayName;
        oppdater();
    } else {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainContent').style.display = 'none';
    }
});


// --- 4. APP LOGIKK ---
let lagredeResultater = {};
let valgtElevId = "";

function hentOppsett() {
    const aar = document.getElementById('mAar').value;
    const fag = document.getElementById('mFag').value;
    const periode = document.getElementById('mPeriode').value;
    const trinn = document.getElementById('mTrinn').value;

    // 1. Sjekk om det spesifikke året finnes i koden
    if (oppgaveStruktur[aar]) {
        return oppgaveStruktur[aar][fag][periode][trinn];
    } 
    
    // 2. Hvis året IKKE finnes (f.eks. 2026-2027), bruk 2025-2026 som mal
    else {
        console.log("Bruker 2025-2026 som mal for " + aar);
        return oppgaveStruktur["2025-2026"][fag][periode][trinn];
    }
}

function hentData() {
    const aar = document.getElementById('mAar').value;
    const fag = document.getElementById('mFag').value;
    const periode = document.getElementById('mPeriode').value;
    const trinn = document.getElementById('mTrinn').value;
    const klasse = document.getElementById('mKlasse').value;

    db.ref(`kartlegging/${aar}/${fag}/${periode}/${trinn}/${klasse}`).on('value', snapshot => {
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

// Lag den fulle teksten
    const overskriftTekst = `Kartlegging i ${fag.toLowerCase()} - ${trinn}${klasse} - ${periode.toLowerCase()}en ${aar}`;
    
// Oppdaterer tittelen som vises ved knappene på skjermen
    const dynOverskrift = document.getElementById('dynamiskOverskrift');
    if (dynOverskrift) dynOverskrift.innerText = overskriftTekst;
    
// Oppdaterer den store tittelen på selve utskriften (Rapporten)
    const printTittel = document.getElementById('printTittel');
    if (printTittel) printTittel.innerText = overskriftTekst;

    if (!oppsett) {
        tBody.innerHTML = "<tr><td colspan='100%'>Velg innstillinger over.</td></tr>";
        return;
    }

    let hode = `<tr><th style="text-align:left">Elevnavn</th>`;
    oppsett.oppgaver.forEach(o => hode += `<th>${o.navn}<br><small>max ${o.maks}</small></th>`);
    hode += `<th>Sum</th><th class="no-print">Handling</th></tr>`;
    tHead.innerHTML = hode;

    tBody.innerHTML = "";
    
    let aktive = [], skjulte = [];
    const valgtTrinn = parseInt(document.getElementById('mTrinn').value);
    const valgtKlasse = document.getElementById('mKlasse').value;
    const valgtSkoleAar = parseInt(document.getElementById('mAar').value.split('-')[0]);

    Object.keys(elevRegister).sort().forEach(navn => {
        const elev = elevRegister[navn];
        const currentTrinn = elev.startTrinn + (valgtSkoleAar - elev.startAar);
        if (currentTrinn === valgtTrinn && elev.startKlasse === valgtKlasse) {
            if (lagredeResultater[navn] && lagredeResultater[navn].skjult === true) skjulte.push(navn);
            else aktive.push(navn);
        }
    });

// Aktive elever
    aktive.forEach(navn => {
        const d = lagredeResultater[navn];
        let rad = `<tr><td style="text-align:left"><b>${navn}</b></td>`;
        
        if (d && d.oppgaver) {
            // Gå gjennom hver enkeltoppgave
            oppsett.oppgaver.forEach((o, i) => {
                const p = d.oppgaver[i] || 0;
                let cls = "";
                
                // Rød celle kun hvis det er Lesing og under grensen
                if (fag === "Lesing" && o.grense !== -1 && p <= o.grense) {
                    cls = 'class="alert-low"';
                }
                rad += `<td ${cls}>${p}</td>`;
            });

            // Totalsummen (farges rød uansett fag hvis under grenseTotal)
            const sumCls = (d.sum <= oppsett.grenseTotal) ? 'class="alert-low"' : '';
            rad += `<td ${sumCls}>${d.sum}</td>`;

            rad += `<td class="no-print">
                <button class="btn btn-edit" onclick="visModal('${navn}')">Endre</button>
                <button class="btn btn-slett" onclick="slettPoeng('${navn}')">Nullstill</button>
                <button class="btn btn-fjern" onclick="skjulElev('${navn}', true)">Fjern</button>
            </td>`;
        } else {
            // Vis tomme felt hvis ingen data er registrert ennå
            oppsett.oppgaver.forEach(() => rad += `<td class="not-registered">-</td>`);
            rad += `<td class="not-registered">-</td>`;
            rad += `<td class="no-print">
                <button class="btn btn-reg" onclick="visModal('${navn}')">Registrer</button>
                <button class="btn btn-fjern" onclick="skjulElev('${navn}', true)">Fjern</button>
            </td>`;
        }
        tBody.innerHTML += rad + `</tr>`;
    });


    // Skjulte elever
    if (skjulte.length > 0) {
        tBody.innerHTML += `<tr class="no-print"><td colspan="100%" class="skjult-seksjon" style="text-align:left; padding:10px;">Fjernede elever (Papirkurv)</td></tr>`;
        skjulte.forEach(navn => {
            tBody.innerHTML += `
                <tr class="no-print" style="color:#95a5a6; background:#fafafa">
                    <td style="text-align:left"><i>${navn}</i></td>
                    <td colspan="${oppsett.oppgaver.length + 1}"></td>
                    <td><button class="btn btn-hent" onclick="skjulElev('${navn}', false)">Hent tilbake</button></td>
                </tr>`;
        });
    }
}

// Modal Logikk
function visModal(navn) {
    const oppsett = hentOppsett();
    valgtElevId = navn;
    document.getElementById('modalNavn').innerText = navn;
    const container = document.getElementById('oppgaveFelter');
    container.innerHTML = "";
    const eksisterende = lagredeResultater[navn]?.oppgaver || [];

    oppsett.oppgaver.forEach((o, i) => {
        container.innerHTML += `<div class="oppgave-rad">
            <label>${o.navn} (0-${o.maks}):</label>
            <input type="number" class="oppg-input" data-index="${i}" min="0" max="${o.maks}" value="${eksisterende[i] !== undefined ? eksisterende[i] : ""}" style="width:60px">
        </div>`;
    });
    document.getElementById('modal').style.display = 'block';
    setTimeout(() => { if(container.querySelector('input')) container.querySelector('input').focus(); }, 100);
}

// Enter-navigasjon
document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && document.getElementById('modal').style.display === 'block') {
        const inputs = Array.from(document.querySelectorAll('.oppg-input'));
        const idx = inputs.indexOf(document.activeElement);
        if (idx > -1 && idx < inputs.length - 1) { e.preventDefault(); inputs[idx+1].focus(); inputs[idx+1].select(); }
        else if (idx === inputs.length - 1) { lagreData(); }
    }
});

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

function hentSti(elev) {
    const a = document.getElementById('mAar').value, f = document.getElementById('mFag').value;
    const p = document.getElementById('mPeriode').value, t = document.getElementById('mTrinn').value;
    const k = document.getElementById('mKlasse').value;
    return `kartlegging/${a}/${f}/${p}/${t}/${k}/${elev}`;
}

function leggTilNyElev() {
    const e = document.getElementById('nyttEtternavn').value.trim(), f = document.getElementById('nyttFornavn').value.trim();
    if(!e || !f) return alert("Navn mangler");
    const navn = `${e}, ${f}`;
    elevRegister[navn] = { startTrinn: parseInt(document.getElementById('mTrinn').value), startKlasse: document.getElementById('mKlasse').value, startAar: parseInt(document.getElementById('mAar').value) };
    tegnTabell();
    document.getElementById('nyttEtternavn').value = ""; document.getElementById('nyttFornavn').value = "";
}

function forberedPrint() {
        window.print();
}

function eksporterTilExcel() {
    const oppsett = hentOppsett(), aktiveElever = filtrerAktive();
    let csv = "\uFEFFElevnavn;" + oppsett.oppgaver.map(o => o.navn).join(";") + ";Sum\n";
    aktiveElever.forEach(n => {
        const d = lagredeResultater[n];
        csv += `${n};${(d && d.oppgaver) ? d.oppgaver.join(";") : oppsett.oppgaver.map(()=>"").join(";")};${(d && d.sum) ? d.sum : ""}\n`;
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = `Eksport_${document.getElementById('mFag').value}.csv`;
    link.click();
}

function filtrerAktive() {
    const t = parseInt(document.getElementById('mTrinn').value);
    const k = document.getElementById('mKlasse').value;
    const a = parseInt(document.getElementById('mAar').value.split('-')[0]); // Lagt til split for årstall
    
    return Object.keys(elevRegister).filter(n => {
        const e = elevRegister[n];
        const curT = e.startTrinn + (a - e.startAar);
        return curT === t && e.startKlasse === k && !(lagredeResultater[n] && lagredeResultater[n].skjult === true);
    }).sort();
}

function sjekkAdminKode() {
    const kode = prompt("Vennligst oppgi adminkode for å få tilgang:");
    if (kode === "3850") {
        document.getElementById('adminPanel').style.display = 'block';
        window.scrollTo(0, 0);
    } else if (kode !== null) {
        alert("Feil kode. Tilgang nektet.");
    }
}

async function genererAdminRapport(type) {
    const aar = document.getElementById('mAar').value;
    const fag = document.getElementById('mFag').value;
    const periode = document.getElementById('mPeriode').value;
    const trinn = document.getElementById('mTrinn').value;
    const klasser = ["A", "B", "C", "D"];
    
    // Tøm tabellen for å gjøre klar til stor rapport
    const tBody = document.getElementById('tBody');
    const tHead = document.getElementById('tHead');
    tBody.innerHTML = "<tr><td colspan='100%'>Henter data fra alle klasser...</td></tr>";

    let samletData = [];
    const oppsett = hentOppsett();

    // Hent data for alle klasser sekvensielt
    for (let k of klasser) {
        const snapshot = await db.ref(`kartlegging/${aar}/${fag}/${periode}/${trinn}/${k}`).once('value');
        const data = snapshot.val() || {};
        
        // Filtrer elever som tilhører denne klassen i registeret
        Object.keys(elevRegister).forEach(navn => {
            const elev = elevRegister[navn];
            // Sjekk om eleven går i denne klassen og på dette trinnet
            const valgtSkoleAar = parseInt(aar.split('-')[0]);
            const currentTrinn = elev.startTrinn + (valgtSkoleAar - elev.startAar);
            
            if (currentTrinn == trinn && elev.startKlasse === k) {
                const resultat = data[navn];
                if (resultat && !resultat.skjult) {
                    // Hvis vi bare skal vise kritiske, sjekk summen
                    if (type === 'kritisk' && resultat.sum > oppsett.grenseTotal) {
                        return; // Hopp over hvis ikke kritisk
                    }
                    samletData.push({ navn, klasse: k, ...resultat });
                }
            }
        });
    }

    // Bygg rapportvisningen
    document.getElementById('printTittel').innerText = 
        (type === 'kritisk' ? "Kritisk Grense Rapport: " : "Årsrapport: ") + 
        `${fag} - ${trinn}. trinn - ${periode}en ${aar}`;

    // Tegn tabell-hode
    let hode = `<tr><th>Klasse</th><th style="text-align:left">Navn</th>`;
    oppsett.oppgaver.forEach(o => hode += `<th>${o.navn}</th>`);
    hode += `<th>Sum</th></tr>`;
    tHead.innerHTML = hode;

    // Tegn tabell-rader
    tBody.innerHTML = "";
    if (samletData.length === 0) {
        tBody.innerHTML = "<tr><td colspan='100%'>Ingen data funnet for dette valget.</td></tr>";
    } else {
        samletData.sort((a,b) => a.klasse.localeCompare(b.klasse) || a.navn.localeCompare(b.navn)).forEach(d => {
            let rad = `<tr><td>${d.klasse}</td><td style="text-align:left"><b>${d.navn}</b></td>`;
            oppsett.oppgaver.forEach((o, i) => {
                const p = d.oppgaver[i] || 0;
                let cls = (fag === "Lesing" && o.grense !== -1 && p <= o.grense) ? 'class="alert-low"' : '';
                rad += `<td ${cls}>${p}</td>`;
            });
            const sumCls = (d.sum <= oppsett.grenseTotal) ? 'class="alert-low"' : '';
            rad += `<td ${sumCls}>${d.sum}</td></tr>`;
            tBody.innerHTML += rad;
        });
    }
    
    // Gjør klar for utskrift hvis ønskelig
    alert("Rapport generert! Du kan nå bruke 'Skriv ut' for å lagre som PDF.");
}

window.onload = hentData;