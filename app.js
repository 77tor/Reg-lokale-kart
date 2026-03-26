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

// --- GLOBALE VARIABLER ---
let lagredeResultater = {};
let valgtElevId = "";
let myChart = null; 

// SIKKERHET: Hvis elever.js ikke er lastet ennå, lager vi et tomt register så koden ikke stopper.
if (typeof elevRegister === 'undefined') {
    window.elevRegister = {}; 
}

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

        hentRegister(); // <--- LEGG TIL DENNE (Henter elevnavn)
        hentData();     // <--- Denne har du fra før (Henter poeng
    } else {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainContent').style.display = 'none';
    }
});

// --- 3. HJELPEFUNKSJONER ---
function hentOppsett() {
    const aarValgt = document.getElementById('mAar').value;
    const fag = document.getElementById('mFag').value;
    const periode = document.getElementById('mPeriode').value;
    const trinn = document.getElementById('mTrinn').value;

    // 1. Sjekk om året finnes. Hvis ikke, bruk 2025-2026 som "master-mal"
    const malAar = oppgaveStruktur[aarValgt] ? aarValgt : "2025-2026";

    // 2. Send det trygge årstallet videre til den spesifikke henteren
    return hentOppsettSpesifikk(malAar, fag, periode, trinn);
}

function hentOppsettSpesifikk(aar, fag, periode, trinn) {
    try { 
        // Her bruker vi 'aar' som nå er garantert å finnes (enten 2026-2027 eller 2025-2026)
        return oppgaveStruktur[aar][fag][periode][trinn]; 
    } 
    catch (e) { 
        console.warn("Fant ikke oppsett for:", aar, fag, periode, trinn);
        return null; 
    }
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


// --- OPPDATER ELEVLISTE (Dropdown i registrerings-modalen) ---
function oppdaterElevListe() {
    const vAar = document.getElementById('mAar').value;
    const vTrinnValgt = parseInt(document.getElementById('mTrinn').value); // Gjør om til tall med en gang
    const vKlasse = document.getElementById('mKlasse').value;
    const select = document.getElementById('regElev');
    
    if (!select) return;
    select.innerHTML = '<option value="">-- Velg elev --</option>';

    if (!vAar || isNaN(vTrinnValgt) || !vKlasse) return;
    
    const vStartAarValgt = parseInt(vAar.split('-')[0]);

    Object.keys(elevRegister).sort().forEach(navn => {
        const e = elevRegister[navn];
        
        // Beregn hvilket trinn eleven går på i det valgte skoleåret
        const cTrinn = parseInt(e.startTrinn) + (vStartAarValgt - parseInt(e.startAar));

        // Debug-hjelp: Se i F12-konsollen hvis navnene ikke dukker opp
        // console.log(`${navn}: Beregnet trinn ${cTrinn}, Valgt trinn ${vTrinnValgt}`);

        if (cTrinn === vTrinnValgt && e.startKlasse === vKlasse) {
            const opt = document.createElement('option');
            opt.value = navn;
            opt.textContent = navn;
            select.appendChild(opt);
        }
    });
}


// --- 4. DATAHÅNDTERING ---
function hentData() {
    const hovedTabell = document.getElementById('hovedTabell');
    if (hovedTabell) hovedTabell.style.display = 'table';
    
    const rc = document.getElementById('rapportContainer');
    if (rc) rc.innerHTML = "";

    const a = document.getElementById('mAar').value; 
    const f = document.getElementById('mFag').value; 
    const p = document.getElementById('mPeriode').value; 
    const t = document.getElementById('mTrinn').value; 
    const k = document.getElementById('mKlasse').value; 
    
    const nyElevSeksjon = document.getElementById('nyElevSeksjon');
    const actionBar = document.querySelector('.action-bar');

    if (!a || !f || !p || !t || !k) {
        if (nyElevSeksjon) nyElevSeksjon.style.display = 'none';
        if (actionBar) actionBar.style.display = 'none';
        document.getElementById('tBody').innerHTML = "<tr><td colspan='100%'>Vennligst velg alle kriterier over...</td></tr>";
        return;
    }

    // --- NY DEL: Sjekk låse-status for denne spesifikke prøven ---
    const statusSti = `status/${a}/${f}/${p}/${t}/${k}`;
    db.ref(statusSti).on('value', snapshot => {
        const statusData = snapshot.val();
        const erLaast = statusData && statusData.laast === true;
        oppdaterLaaseVisning(erLaast); // Denne funksjonen styrer det visuelle
    });
    // -----------------------------------------------------------

    if (nyElevSeksjon) nyElevSeksjon.style.display = 'block';
    if (actionBar) actionBar.style.display = 'flex';

    oppdaterOverskrifter(`Kartlegging i ${f} - ${t}${k} - ${p} ${a}`);
    oppdaterElevListe();

    const sti = `kartlegging/${a}/${f}/${p}/${t}/${k}`;
    db.ref(sti).off(); 
    db.ref(sti).on('value', snapshot => {
        lagredeResultater = snapshot.val() || {};
        tegnTabell();
    });
}

// --- NY FUNKSJON: Henter selve elevlista fra Firebase ---
function hentRegister() {
    db.ref('elevRegister').on('value', snapshot => {
        const firebaseData = snapshot.val() || {};
        
        // --- SMART MERGING ---
        // Vi beholder det som er i fila (elever.js), 
        // og legger til/overskriver med det som er i Firebase.
        elevRegister = Object.assign({}, elevRegister, firebaseData);
        
        console.log("Register oppdatert. Totalt antall elever:", Object.keys(elevRegister).length);
        
        tegnTabell();
        oppdaterElevListe();
    });
}


// --- TEGN TABELL (Inkludert gjennomsnitt og håndtering av ikke gjennomført) ---
function tegnTabell() {
// VAKT: Hvis admin-panelet er åpent, skal vi IKKE røre hovedsiden!
    const adminPanel = document.getElementById('adminPanel');
    if (adminPanel && adminPanel.style.display === 'block') {
        console.log("Blokkerte tegnTabell fordi Admin er åpent.");
        return; // Avbryter hele funksjonen her
    }
    const vAar = document.getElementById('mAar').value;
    const vFag = document.getElementById('mFag').value;
    const vPeriode = document.getElementById('mPeriode').value;
    const vTrinn = document.getElementById('mTrinn').value;
    const vKlasse = document.getElementById('mKlasse').value;

    const tHead = document.getElementById('tHead');
    const tBody = document.getElementById('tBody');

    if (!vAar || !vFag || !vPeriode || !vTrinn || !vKlasse) {
        tBody.innerHTML = "<tr><td colspan='100%'>Vennligst velg alle kriterier...</td></tr>";
        return;
    }

// --- LOGIKK FOR Å HENTE OPPSETT ---
    // Vi sjekker om det valgte året finnes i oppsett.js. 
    // Hvis ikke, bruker vi "2025-2026" som standard mal.
    const aarIMal = oppgaveStruktur[vAar] ? vAar : "2025-2026";
    
    const oppsett = (oppgaveStruktur[aarIMal] && 
                     oppgaveStruktur[aarIMal][vFag] && 
                     oppgaveStruktur[aarIMal][vFag][vPeriode]) 
                     ? oppgaveStruktur[aarIMal][vFag][vPeriode][vTrinn] 
                     : null;

    if (!oppsett) {
        tBody.innerHTML = `<tr><td colspan='100%'>Fant ikke mal for ${vFag} i ${aarIMal}.</td></tr>`;
        return;
    }

    // 1. Lag Tabellhode
    let hode = `<tr><th style="text-align:left">Elevnavn</th>`;
    oppsett.oppgaver.forEach(o => {
        hode += `<th>${o.navn}<br><small>max ${o.maks}</small></th>`;
    });
    hode += `<th>Sum</th><th class="no-print">Handling</th></tr>`;
    tHead.innerHTML = hode;

    const vStartAarValgt = parseInt(vAar.split('-')[0]);
    let antallAktiveMedData = 0;
    let kolonneSummer = new Array(oppsett.oppgaver.length).fill(0);
    let totalSumKlasse = 0;
    let aktiveRader = "";
    let slettedeRader = "";

    // 2. Gå gjennom alle elever i registeret
        Object.keys(elevRegister).sort().forEach(navn => {
        const e = elevRegister[navn];
        // Beregn trinn: Starttrinn + (Valgt år - Startår)
        const cTrinn = parseInt(e.startTrinn) + (vStartAarValgt - parseInt(e.startAar));

        // VIKTIG: Bruk parseInt(vTrinn) for å sammenligne tall mot tall
        if (cTrinn === parseInt(vTrinn) && e.startKlasse === vKlasse) {
            const d = lagredeResultater[navn] || {};
            // ... resten av koden din for å tegne raden er lik
            const erSlettet = d.slettet === true;
            const erIkkeGjennomfort = d.ikkeGjennomfort === true;

            let printKlasse = erSlettet ? 'class="no-print"' : '';
            let radStil = erSlettet ? 'style="color: #a0aec0; background: #f7fafc;"' : (erIkkeGjennomfort ? 'style="background: #fff5f5;"' : '');

            let rad = `<tr ${printKlasse} ${radStil}><td style="text-align:left"><b>${navn}</b></td>`;

            if (!erSlettet && erIkkeGjennomfort) {
                rad += `<td colspan="${oppsett.oppgaver.length + 1}" style="color: #c53030; font-style: italic; font-weight: bold;">Ikke gjennomført</td>`;
            } else if (!erSlettet && d.oppgaver) {
                antallAktiveMedData++;
                oppsett.oppgaver.forEach((o, i) => {
                    const poeng = d.oppgaver[i] || 0;
                    kolonneSummer[i] += poeng;
                    let cls = (o.grense !== -1 && poeng <= o.grense) ? 'class="alert-low"' : '';
                    rad += `<td ${cls}>${poeng}</td>`;
                });
                totalSumKlasse += d.sum;
                let sumCls = (d.sum <= oppsett.grenseTotal) ? 'class="alert-low"' : '';
                rad += `<td ${sumCls}>${d.sum}</td>`;
            } else {
                oppsett.oppgaver.forEach(() => rad += `<td class="not-registered">-</td>`);
                rad += `<td class="not-registered">-</td>`;
            }

// --- HANDLING-KNAPPER (no-print) ---
            rad += `<td class="no-print">`;
            
            if (erSlettet) {
                // Vi har nå bare "Hent"-knappen her. 
                // "Fjern helt" flyttes til admin-delen senere.
                rad += `<button class="btn btn-hent" onclick="gjenopprettElev('${navn}')">Hent</button>`;
            } else {
                if (d.oppgaver || erIkkeGjennomfort) {
                    rad += `<button class="btn btn-edit" onclick="visModal('${navn}')">Endre</button> `;
                    rad += `<button class="btn btn-nullstill" style="margin-left:5px;" onclick="nullstillElev('${navn}')">Nullstill</button>`;
                } else {
                    rad += `<button class="btn btn-reg" onclick="visModal('${navn}')">Registrer</button> `;
                    rad += `<button class="btn btn-slett" style="margin-left:5px;" onclick="slettElev('${navn}')">Slett</button>`;
                }
            }
            rad += `</td></tr>`;

            if (erSlettet) slettedeRader += rad;
            else aktiveRader += rad;
        }
    });

    // 3. Lag Gjennomsnittsrad (hvis det er data)
    let snittHtml = "";
    if (antallAktiveMedData > 0) {
        snittHtml = `<tr class="snitt-rad" style="background:#edf2f7; font-weight:bold;"><td style="text-align:left">Gjennomsnitt ${vTrinn}${vKlasse}</td>`;
        kolonneSummer.forEach(sum => {
            snittHtml += `<td> ${(sum / antallAktiveMedData).toFixed(1)} </td>`;
        });
        snittHtml += `<td> ${(totalSumKlasse / antallAktiveMedData).toFixed(1)} </td><td class="no-print"></td></tr>`;
    }

    // 4. Oppdater tabellen i HTML-en (Aktive elever + Snitt + Slettede elever)
    tBody.innerHTML = aktiveRader + snittHtml + slettedeRader;
} 
// <--- HER SLUTTER FUNKSJONEN. Ingen kode etter dette punktet før neste funksjon starter.


function nullstillElev(navn) {
    if (confirm(`Vil du tømme alle poeng for ${navn}? Eleven blir stående i listen, men poengene fjernes.`)) {
        // Vi fjerner hele objektet (inkludert "ikke gjennomført"-status)
        db.ref(hentSti(navn)).remove()
        .then(() => {
            console.log("Data nullstilt for " + navn);
            tegnTabell(); // Legg til denne for at skjermen oppdateres umiddelbart!
        })
        .catch(error => {
            console.error("Feil ved nullstilling:", error);
        });
    }
}

async function toggleFerdigstill() {
    const tabell = document.getElementById('hovedTabell');
    const aar = document.getElementById('mAar').value;
    const fag = document.getElementById('mFag').value;
    const periode = document.getElementById('mPeriode').value;
    const trinn = document.getElementById('mTrinn').value;
    const klasse = document.getElementById('mKlasse').value;

    // Lager en unik sti for denne spesifikke prøven i databasen
    const statusSti = `status/${aar}/${fag}/${periode}/${trinn}/${klasse}`;
    
    // Sjekk om vi skal låse opp eller låse
    const erLaastNaa = tabell.classList.contains('is-locked');
    const skalLaase = !erLaastNaa;

// --- NY BEKREFTELSE VED GJENÅPNING ---
    if (!skalLaase) {
        const bekreftGjenaapne = confirm("Du er i ferd med å åpne registrerings-modus. Da kan det gjøres endringer på data som er lagt inn. Ønsker du dette?");
        if (!bekreftGjenaapne) return; // Avbryter hvis brukeren trykker "Avbryt"
    }
    // -------------------------------------
   

 if (skalLaase) {
        // --- LOGIKK FOR Å LÅSE ---
        const manglerResultat = Array.from(document.querySelectorAll('#tBody tr')).filter(rad => 
            rad.querySelector('.not-registered')
        );

        if (manglerResultat.length > 0) {
            const valg = confirm(`Det er ${manglerResultat.length} elever uten registrerte resultater.\n\nØnsker du å sette disse som 'Ikke gjennomført' og ferdigstille prøven?`);
            if (!valg) return;

            for (let rad of manglerResultat) {
                const elevNavn = rad.cells[0].innerText.trim();
                await db.ref(`kartlegging/${aar}/${fag}/${periode}/${trinn}/${klasse}/${elevNavn}`).update({
                    ikkeGjennomfort: true,
                    sum: 0,
                    oppgaver: new Array(15).fill(0) // Juster tallet her hvis du har flere oppgaver
                });
            }
            await hentData(); // Oppdater tabellvisningen
        }
    }

    // LAGRE STATUS I FIREBASE
    await db.ref(statusSti).set({ laast: skalLaase });
    
    // Oppdater det visuelle (knapper og tekst)
    oppdaterLaaseVisning(skalLaase);
}

function oppdaterLaaseVisning(erLaast) {
    const tabell = document.getElementById('hovedTabell');
    const knapp = document.getElementById('btnFerdigstill');
    const importKnapp = document.getElementById('btnImport'); // Henter import-knappen
    const tekstElement = document.getElementById('lockText');
    const ikonElement = knapp.querySelector('.btn-icon');

    if (erLaast) {
        tabell.classList.add('is-locked');
        if (tekstElement) tekstElement.innerText = "Gjenåpne prøven";
        if (ikonElement) ikonElement.innerText = "🔓";
        knapp.style.backgroundColor = "#27ae60"; // Grønn for gjenåpne
        
// GJØR IMPORT-KNAPPEN INAKTIV
        if (importKnapp) {
            importKnapp.disabled = true;
            importKnapp.style.opacity = "0.5";
            importKnapp.style.cursor = "not-allowed";
        }


        // Legg til "Ferdigstilt"-tekst i radene hvis den mangler
        document.querySelectorAll('#tBody tr').forEach(rad => {
            const sisteCelle = rad.lastElementChild;
            if (sisteCelle && !sisteCelle.querySelector('.ferdigstilt-merkelapp')) {
                const span = document.createElement('span');
                span.className = 'ferdigstilt-merkelapp';
                span.innerText = 'Ferdigstilt';
                sisteCelle.appendChild(span);
            }
        });
    } else {
        tabell.classList.remove('is-locked');
        if (tekstElement) tekstElement.innerText = "Ferdigstille prøven";
        if (ikonElement) ikonElement.innerText = "🔒";
        knapp.style.backgroundColor = "#d35400"; // Oransje for ferdigstille

// GJØR IMPORT-KNAPPEN AKTIV IGJEN
        if (importKnapp) {
            importKnapp.disabled = false;
            importKnapp.style.opacity = "1";
            importKnapp.style.cursor = "pointer";
        }

        document.querySelectorAll('.ferdigstilt-merkelapp').forEach(el => el.remove());
    }
}




// --- 5. MODAL OG LAGRING ---
function visModal(navn) {
    const oppsett = hentOppsett();
    valgtElevId = navn;
    document.getElementById('modalNavn').innerText = navn;
    const container = document.getElementById('oppgaveFelter');
    container.innerHTML = "";
    
    // Hent lagret data for denne eleven
    const d = lagredeResultater[navn] || {};
    const eksisterende = d.oppgaver || [];
    const erIkkeGjennomfort = d.ikkeGjennomfort === true;

    // 1. Oppdater checkboxen basert på lagret data
    const checkBoks = document.getElementById('ikkeGjennomfort');
    if (checkBoks) {
        checkBoks.checked = erIkkeGjennomfort;
    }

    // 2. Lag oppgavefeltene
    oppsett.oppgaver.forEach((o, i) => {
        const stil = erIkkeGjennomfort ? 'opacity:0.3;' : '';
        const deaktivert = erIkkeGjennomfort ? 'disabled' : '';

        container.innerHTML += `<div class="oppgave-rad" style="margin-bottom:10px; ${stil}">
            <label>${o.navn}:</label>
            <input type="number" class="oppg-input" data-index="${i}" min="0" max="${o.maks}" 
            value="${eksisterende[i] !== undefined ? eksisterende[i] : ""}" 
            ${deaktivert} style="width:60px; float:right;">
        </div>`;
    });

    document.getElementById('modal').style.display = 'block';

    // 3. Sett fokus på første feltet hvis det ikke er låst
    setTimeout(() => {
        const førsteInput = container.querySelector('.oppg-input');
        if (førsteInput && !erIkkeGjennomfort) {
            førsteInput.focus();
            førsteInput.select();
        }
    }, 100);
}

function lukkModal() { 
    document.getElementById('modal').style.display = 'none'; 
}

function lagreData() {
    const oppsett = hentOppsett();
    const erIkkeGjennomfort = document.getElementById('ikkeGjennomfort').checked;
    
    let dataSomSkalLagres = {
        slettet: false,
        dato: new Date().toISOString(),
        ikkeGjennomfort: erIkkeGjennomfort
    };

    if (erIkkeGjennomfort) {
        // Hvis eleven IKKE har gjennomført
        dataSomSkalLagres.oppgaver = null; 
        dataSomSkalLagres.sum = 0;
    } else {
        // Hvis eleven HAR gjennomført
        const inputs = document.querySelectorAll('.oppg-input');
        let verdier = [], sum = 0;
        inputs.forEach(i => { 
            const v = parseInt(i.value) || 0; 
            verdier.push(v); 
            sum += v; 
        });
        dataSomSkalLagres.oppgaver = verdier;
        dataSomSkalLagres.sum = sum;
    }
    
    // Lagre til Firebase og oppdater tabellen
    db.ref(hentSti(valgtElevId)).set(dataSomSkalLagres).then(() => {
        lukkModal();
    }).catch(error => {
        console.error("Feil ved lagring:", error);
    });
}

// NYTT: Gjør modalen interaktiv (låser felter når man haker av)
document.addEventListener('change', function(e) {
    if (e.target && e.target.id === 'ikkeGjennomfort') {
        const inputs = document.querySelectorAll('.oppg-input');
        const erHuket = e.target.checked;
        
        inputs.forEach(inp => {
            inp.disabled = erHuket;
            // Endrer stilen på foreldre-diven (oppgave-rad)
            if (inp.parentElement) {
                inp.parentElement.style.opacity = erHuket ? "0.3" : "1";
            }
            if (erHuket) inp.value = ""; 
        });
    }
});

// --- ANALYSE_DEL (Fullstendig og feilfri versjon) ---
async function genererKlasseAnalyse() {
    try { // Åpner try-blokken her for å fange opp alle feil
        // 1. Hent kriterier fra menyene
        const aar = document.getElementById('mAar').value;
        const fag = document.getElementById('mFag').value;
        const periode = document.getElementById('mPeriode').value;
        const trinn = document.getElementById('mTrinn').value;
        const klasse = document.getElementById('mKlasse').value;

        // 2. Hent oppsettet
        const aarIMal = oppgaveStruktur[aar] ? aar : "2025-2026";
        const oppsett = oppgaveStruktur[aarIMal][fag][periode][trinn];
        if (!oppsett) return alert("Fant ikke oppsett for denne analysen.");

        // 3. Samle data fra Firebase
        const snapshot = await db.ref(`kartlegging/${aar}/${fag}/${periode}/${trinn}/${klasse}`).once('value');
        const data = snapshot.val() || {};
        
        let elever = Object.keys(data).filter(navn => data[navn].oppgaver && !data[navn].slettet && !data[navn].ikkeGjennomfort);
        if (elever.length === 0) return alert("Ingen data å analysere for denne klassen.");

        // 4. Beregn statistikk
        let antall = elever.length;
        let oppgaveSummer = new Array(oppsett.oppgaver.length).fill(0);
        let totalSumKlasse = 0;
        let kritiskeElever = [];

        const totalMaksMulig = oppsett.oppgaver.reduce((sum, o) => sum + (o.maks || 0), 0);

        elever.forEach(navn => {
            const d = data[navn];
            d.oppgaver.forEach((p, i) => {
                oppgaveSummer[i] += (p || 0);
            });
            totalSumKlasse += (d.sum || 0);

            if (d.sum <= oppsett.grenseTotal) {
                kritiskeElever.push({navn: navn, oppgaver: d.oppgaver, sum: d.sum});
            }
        });

        const totalKlasseSnittProsent = ((totalSumKlasse / antall) / totalMaksMulig) * 100;

        // 5. Bygg innholdet
        let html = `<h1>Analyse: ${fag} - ${trinn}${klasse} (${periode} ${aar})</h1>`;
        
        // --- SØYLEDIAGRAM ---
        html += `<h3>Gjennomsnittlig skår per oppgave (%)</h3><div class="chart-container">`;
        html += `<div style="width: 150px;"></div>`;

        oppsett.oppgaver.forEach((o, i) => {
            const snitt = oppgaveSummer[i] / antall;
            const prosent = (snitt / o.maks) * 100;
            const grenseProsent = (o.grense / o.maks) * 100;
            
            html += `
                <div class="bar-wrapper">
                    <div class="bar-value">${prosent.toFixed(0)}%</div>
                    <div class="bar-track">
                        <div class="bar-fill" style="height: ${prosent}%"></div>
                        ${o.grense !== -1 ? `<div class="target-line" style="bottom: ${grenseProsent}%"></div>` : ''}
                    </div>
                    <div class="bar-label">${o.navn}</div>
                </div>`;
        });

        const totalGrenseProsent = (oppsett.grenseTotal / totalMaksMulig) * 100;
        html += `
            <div class="bar-wrapper total">
                <div class="bar-value">${totalKlasseSnittProsent.toFixed(0)}%</div>
                <div class="bar-track">
                    <div class="bar-fill total-fill" style="height: ${totalKlasseSnittProsent}%"></div>
                    <div class="target-line" style="bottom: ${totalGrenseProsent}%"></div>
                </div>
                <div class="bar-label"><b>TOTAL</b></div>
            </div></div>`;

        // --- TABELL OVER SNITT ---
        html += `<h3>Klassens resultater vs Maks-skår</h3><table><thead><tr><th>Oppgave</th>`;
        oppsett.oppgaver.forEach(o => html += `<th>${o.navn}</th>`);
        html += `<th>TOTAL</th></tr></thead><tbody>
            <tr><td><b>Maks poeng</b></td>`;
            oppsett.oppgaver.forEach(o => html += `<td>${o.maks}</td>`);
            html += `<td><b>${totalMaksMulig}</b></td></tr>
            <tr><td><b>Snitt (poeng)</b></td>`;
            oppgaveSummer.forEach(s => html += `<td>${(s/antall).toFixed(1)}</td>`);
            html += `<td><b>${(totalSumKlasse/antall).toFixed(1)}</b></td></tr>
            <tr><td><b>I % av maks</b></td>`;
            oppgaveSummer.forEach((s, i) => html += `<td>${((s/antall)/oppsett.oppgaver[i].maks*100).toFixed(0)}%</td>`);
            html += `<td><b>${totalKlasseSnittProsent.toFixed(0)}%</b></td></tr>
        </tbody></table>`;

        // --- ELEVER UNDER KRITISK GRENSE ---
        html += `<div class="page-break-before">
                <h3 style="color:red; margin-top:30px; text-align:center;">Elever under kritisk grense (Sum ≤ ${oppsett.grenseTotal})</h3>`;
        
        if (kritiskeElever.length > 0) {
            html += `<table><thead><tr><th align="left">Navn</th>`;
            oppsett.oppgaver.forEach(o => html += `<th>${o.navn}</th>`);
            html += `<th>Sum</th></tr></thead><tbody>`;
            kritiskeElever.sort((a,b) => a.sum - b.sum).forEach(e => {
                html += `<tr><td align="left"><b>${e.navn}</b></td>`;
                e.oppgaver.forEach((p, i) => {
                    const o = oppsett.oppgaver[i];
                    const stil = (o.grense !== -1 && p <= o.grense) ? 'style="background:#ffcccc"' : '';
                    html += `<td align="center" ${stil}>${p}</td>`;
                });
                html += `<td align="center" style="background:#ffcccc; font-weight:bold;">${e.sum}</td></tr>`;
            });
            html += `</tbody></table>`;
        } else {
            html += `<p style="text-align:center;">Ingen elever ligger under den kritiske totalgrensen.</p>`;
        }
        html += `</div>`;

        // --- ÅPNE VINDU OG SKRIV UT ---
        const win = window.open('', '_blank');
        win.document.write(`
            <html>
            <head>
                <title>Analyse ${trinn}${klasse}</title>
                <style>
                    body { font-family: sans-serif; padding: 30px; color: #333; }
                    h1, h3 { text-align: center; margin-top: 0; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; table-layout: fixed; page-break-inside: avoid; }
                    th, td { border: 1px solid #333; padding: 8px; text-align: center; overflow: hidden; font-size: 11px; }
                    th { background-color: #f2f2f2; }
                    th:first-child, td:first-child { width: 150px; text-align: left; font-weight: bold; }
                    .chart-container { display: flex; height: 250px; align-items: flex-end; justify-content: flex-start; border-bottom: 2px solid #333; padding-top: 30px; margin-bottom: 60px; }
                    .bar-wrapper { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; position: relative; }
                    .bar-track { background: #eee; width: 35px; height: 100%; position: relative; display: flex; flex-direction: column-reverse; border: 1px solid #ccc; }
                    .bar-fill { background: #3498db; width: 100%; }
                    .total-fill { background: #2ecc71; }
                    .target-line { position: absolute; left: -10px; right: -10px; border-top: 2px dashed red; z-index: 10; }
                    .bar-label { font-size: 10px; transform: rotate(-45deg); margin-top: 15px; white-space: nowrap; height: 40px; }
                    .bar-value { font-size: 11px; font-weight: bold; margin-bottom: 5px; }
                    .page-break-before { page-break-before: always; margin-top: 50px; }
                    @media print { .no-print { display: none; } body { padding: 0; } .page-break-before { margin-top: 0; } }
                </style>
            </head>
            <body>
                <div class="no-print" style="margin-bottom: 20px; text-align:center; background:#eee; padding:15px; border-radius:8px;">
                    <button onclick="window.print()" style="padding: 12px 25px; background: #2980b9; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold; font-size:14px;">Skriv ut / Lagre PDF</button>
                    <button onclick="window.close()" style="padding: 12px 25px; background: #95a5a6; color:white; border:none; border-radius:4px; cursor:pointer; margin-left: 15px; font-weight:bold; font-size:14px;">Avbryt</button>
                </div>
                ${html}
            </body>
            </html>
        `);
        win.document.close();

    } catch (error) {
        console.error("Feil i analysegenerering:", error);
        alert("Det oppstod en teknisk feil: " + error.message);
    }
}

// --- 6. ADMIN-FUNKSJONER ---
function sjekkAdminKode() {
    if (prompt("Adminkode:") === "3850") { 
        // 1. Vis admin-panelet og skjul hovedskjemaet
        document.getElementById('adminPanel').style.display = 'block'; 
        document.getElementById('skjemaInnhold').style.display = 'none';
        
        // 2. Skjul "Legg til ny elev"-boksen
        if (document.getElementById('nyElevSeksjon')) {
            document.getElementById('nyElevSeksjon').style.display = 'none';
        }

        // 3. Skjul handlingsknapper (Print/Excel)
        const actionBar = document.querySelector('.action-bar');
        if (actionBar) actionBar.style.display = 'none';

        // 4. NULLSTILLING AV REGISTRERINGSSKJERMAET (Dette er det nye):
        // Tømmer tabellen slik at ingenting henger igjen fra forrige klasse
        document.getElementById('tHead').innerHTML = "";
        document.getElementById('tBody').innerHTML = "<tr><td>Velg alle kriterier...</td></tr>";
        
        // Nullstiller overskriften
        oppdaterOverskrifter("Administrasjon og rapporter");

        // Stopper aktiv lytting på Firebase-data for klassen som var åpen
        db.ref().off();
    }
}


function lukkAdmin() {
    // 1. Skjul admin-panelene og grafen
    document.getElementById('adminPanel').style.display = 'none';
    if (document.getElementById('chartContainer')) {
        document.getElementById('chartContainer').style.display = 'none';
    }
    
    // 2. Sørg for at registreringsskjemaet er synlig, men i "start-modus"
    document.getElementById('skjemaInnhold').style.display = 'block';
    
    // 3. Nullstill tabellen og menyer (slik du hadde det)
    document.getElementById('tHead').innerHTML = "";
    document.getElementById('tBody').innerHTML = "<tr><td colspan='100%'>Velg alle kriterier...</td></tr>";

    const filtere = ['mAar', 'mFag', 'mPeriode', 'mTrinn', 'mKlasse'];
    filtere.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.selectedIndex = 0; 
    });

    if (document.getElementById('nyElevSeksjon')) {
        document.getElementById('nyElevSeksjon').style.display = 'none';
    }
    
    const actionBar = document.querySelector('.action-bar');
    if (actionBar) {
        actionBar.style.display = 'none';
    }

    // 4. VIKTIG ENDRING: 
    // I stedet for å bare skru AV alt med .off(), 
    // bør vi heller starte lytteren på nytt så appen er klar for bruk!
    db.ref().off(); 
    startLyttere(); // Denne sørger for at elevRegisteret bygges opp på nytt med en gang
    
    console.log("Admin lukket og systemet er klart for nye valg.");
}


// --- ÅRSRAPPORT I ADMIN-FUNKSJONER (Fullstendig korrigert) ---
async function kjorAdminRapport(type) {
    const aar = document.getElementById('adminAar').value;
    const fag = document.getElementById('adminFag').value;
    const periode = document.getElementById('adminPeriode').value;
    
    if (!aar || !fag || !periode) {
        alert("Vennligst velg år, fag og periode i menyen.");
        return;
    }

    const aarIMal = oppgaveStruktur[aar] ? aar : "2025-2026";
    let samletInnhold = `<h1 style="text-align:center;">${type === 'kritisk' ? 'Kritisk-liste' : 'Årsrapport'} - ${fag} (${aar})</h1>`;
    
    const klasser = ["A", "B", "C", "D"];
    const alleTrinn = ["1", "2", "3", "4", "5", "6", "7"];

    for (let trinn of alleTrinn) {
        for (let klasse of klasser) {
            const oppsett = (oppgaveStruktur[aarIMal] && 
                             oppgaveStruktur[aarIMal][fag] && 
                             oppgaveStruktur[aarIMal][fag][periode]) 
                             ? oppgaveStruktur[aarIMal][fag][periode][trinn] 
                             : null;
            
            if (!oppsett || !oppsett.oppgaver) continue;

            const snapshot = await db.ref(`kartlegging/${aar}/${fag}/${periode}/${trinn}/${klasse}`).once('value');
            const data = snapshot.val() || {};

            let antallMedData = 0;
            let kolonneSummer = new Array(oppsett.oppgaver.length).fill(0);
            let totalSumKlasse = 0;

            let tabellHtml = `<div class="page-break">
                <h2 style="text-align:center;">${fag} - ${trinn}${klasse} - ${periode} ${aar}</h2>
                <table border="1">
                    <thead>
                        <tr style="background:#f2f2f2;"><th align="left">Elevnavn</th>`;
            
            oppsett.oppgaver.forEach(o => tabellHtml += `<th>${o.navn}</th>`);
            tabellHtml += `<th>Sum</th></tr></thead><tbody>`;

            let antallEleverVist = 0;
            const vStartAar = parseInt(aar.split('-')[0]);

            Object.keys(elevRegister).sort().forEach(navn => {
                const e = elevRegister[navn];
                const cTrinn = parseInt(e.startTrinn) + (vStartAar - parseInt(e.startAar));
                
                if (cTrinn === parseInt(trinn) && e.startKlasse === klasse) {
                    const d = data[navn] || {};
                    if (d.slettet === true) return;

                    const sumVerdi = d.sum || 0;
                    const erKritisk = sumVerdi <= oppsett.grenseTotal;
                    
                    if (type === 'kritisk' && (!d.sum || !erKritisk || d.ikkeGjennomfort)) return;

                    antallEleverVist++;
                    tabellHtml += `<tr><td><b>${navn}</b></td>`;

                    if (d.ikkeGjennomfort === true) {
                        const colSpanTotal = oppsett.oppgaver.length + 1;
                        tabellHtml += `<td colspan="${colSpanTotal}" align="center" style="color:red; font-style:italic;">Ikke gjennomført</td>`;
                    } else if (d.oppgaver) {
                        antallMedData++;
                        oppsett.oppgaver.forEach((o, i) => {
                            const poeng = d.oppgaver[i] || 0;
                            kolonneSummer[i] += poeng;
                            const bakgrunn = (o.grense !== -1 && poeng <= o.grense) ? 'background-color:#ffcccc' : '';
                            tabellHtml += `<td align="center" style="${bakgrunn}">${poeng}</td>`;
                        });
                        totalSumKlasse += sumVerdi;
                        tabellHtml += `<td align="center" style="${erKritisk ? 'background-color:#ffcccc; font-weight:bold;' : ''}">${sumVerdi}</td>`;
                    } else {
                        oppsett.oppgaver.forEach(() => tabellHtml += `<td align="center">-</td>`);
                        tabellHtml += `<td align="center">-</td>`;
                    }
                    tabellHtml += `</tr>`;
                }
            });

            if (antallMedData > 0 && type !== 'kritisk') {
                tabellHtml += `<tr style="background:#eeeeee; font-weight:bold;"><td>Snitt (${antallMedData} elev.)</td>`;
                kolonneSummer.forEach(sum => {
                    tabellHtml += `<td align="center">${(sum / antallMedData).toFixed(1)}</td>`;
                });
                tabellHtml += `<td align="center">${(totalSumKlasse / antallMedData).toFixed(1)}</td></tr>`;
            }

            if (antallEleverVist > 0) {
                tabellHtml += `</tbody></table></div>`;
                samletInnhold += tabellHtml;
            }
        }
    }

    const printVindu = window.open('', '_blank');
    if (!printVindu) {
        alert("Pop-up blokkert! Vennligst tillat pop-ups for å se rapporten.");
        return;
    }

    printVindu.document.write(`
        <html>
            <head>
                <title>Årsrapport</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top:10px; }
                    th, td { border: 1px solid black; padding: 4px; }
                    .page-break { page-break-after: always; }
                </style>
            </head>
            <body>${samletInnhold}</body>
        </html>
    `);
    printVindu.document.close();
    
    setTimeout(() => {
        printVindu.print();
    }, 1000);
}

// --- SAMMENLIGNING I ADMIN-FUNKSJONER (Oppdatert for 2026+) ---
async function kjorSammenligning() {
    const aar = document.getElementById('compAar').value;
    const fag = document.getElementById('compFag').value;
    const periode = document.getElementById('compPeriode').value;
    const trinn = document.getElementById('compTrinn').value;

// --- NYTT: Oppdater overskrift over diagrammet ---
    const overskriftTekst = `Sammenligning: ${aar} - ${fag} - ${trinn}. trinn (${periode})`;
    const overskriftElement = document.getElementById('chartOverskrift');
    if (overskriftElement) {
        overskriftElement.innerText = overskriftTekst;
    }

    // 1. FINN MAL-ÅRET (Fallback til 2025-2026 hvis valgt år mangler)
    const aarIMal = oppgaveStruktur[aar] ? aar : "2025-2026";

    const oppsett = (oppgaveStruktur[aarIMal] && 
                     oppgaveStruktur[aarIMal][fag] && 
                     oppgaveStruktur[aarIMal][fag][periode]) 
                     ? oppgaveStruktur[aarIMal][fag][periode][trinn] 
                     : null;

    if (!oppsett) {
        alert("Fant ikke oppsett for valgt kombinasjon i mal-året " + aarIMal);
        return;
    }

    // Registrer pluginen (viktig!)
    Chart.register(ChartDataLabels);

    document.getElementById('modalSammenlign').style.display = 'none';
    document.getElementById('chartContainer').style.display = 'block';

    const klasser = ["A", "B", "C", "D"];
    let datasets = [];
    const farger = ['rgba(41, 128, 185, 0.85)', 'rgba(39, 174, 96, 0.85)', 'rgba(230, 126, 34, 0.85)', 'rgba(155, 89, 182, 0.85)'];

    // Lag en liste over maks-poeng for hver kolonne (oppgaver + total)
    const maksVerdier = [...oppsett.oppgaver.map(o => o.maks), oppsett.oppgaver.reduce((a, b) => a + b.maks, 0)];

    // START FOR-LOOP
    for (let i = 0; i < klasser.length; i++) {
        // Henter data fra det FAKTISKE valgte året i Firebase
        const snap = await db.ref(`kartlegging/${aar}/${fag}/${periode}/${trinn}/${klasser[i]}`).once('value');
        const data = snap.val() || {};
        let antall = 0, summer = new Array(oppsett.oppgaver.length + 1).fill(0);

        Object.keys(data).forEach(n => {
            const d = data[n];
            if (d.oppgaver && d.slettet !== true && d.ikkeGjennomfort !== true) {
                antall++;
                d.oppgaver.forEach((p, idx) => {
                    if (idx < oppsett.oppgaver.length) summer[idx] += (p || 0);
                });
                summer[oppsett.oppgaver.length] += (d.sum || 0);
            }
        });

        if (antall > 0) {
            datasets.push({
                type: 'bar',
                label: `Klasse ${klasser[i]}`,
                data: summer.map(s => (s / antall).toFixed(1)),
                backgroundColor: farger[i],
                datalabels: {
                    align: 'end',
                    anchor: 'end',
                    offset: -50, 
                    color: 'white',
                    font: { weight: 'bold', size: 10 },
                    padding: 4,
                    formatter: function(value, context) {
                        const idx = context.dataIndex;
                        const maks = maksVerdier[idx];
                        const prosent = ((value / maks) * 100).toFixed(0);
                        return value + "/" + maks + "\n" + prosent + "%";
                    }
                }
            });
        }
    } 

    // --- Rød linje for kritisk grense ---
    const grenseData = [...oppsett.oppgaver.map(o => o.grense), oppsett.grenseTotal];
    datasets.push({
        type: 'line',
        label: 'Kritisk grense',
        data: grenseData,
        borderColor: '#e74c3c',
        borderWidth: 3,
        borderDash: [5, 5],
        pointRadius: 4,
        fill: false,
        tension: 0,
        datalabels: { display: false } 
    });

    const ctx = document.getElementById('sammenligningsChart').getContext('2d');
    if (myChart) myChart.destroy();
    
    myChart = new Chart(ctx, {
        data: { 
            labels: [...oppsett.oppgaver.map(o => o.navn), "Total"], 
            datasets: datasets 
        },
        options: {
            responsive: true,
            layout: { padding: { top: 30 } },
            scales: {
                y: { 
                    beginAtZero: true,
                    max: Math.max(...maksVerdier) * 1.3 // Litt mer plass til tekst på toppen
                }
            },
            plugins: {
                legend: { position: 'top' },
                datalabels: {
                    textAlign: 'center',
                    display: function(context) {
                        return context.dataset.type === 'bar'; 
                    }
                }
            }
        }
    });
}


// --- ELEVRAPPORT I ADMIN-FUNKSJONER ---
function filtrerElevListe() {
    const sok = document.getElementById('elevSokInput').value.toLowerCase();
    const rader = document.querySelectorAll('.elev-valg-rad');
    
    rader.forEach(rad => {
        const navn = rad.innerText.toLowerCase();
        rad.style.display = navn.includes(sok) ? "block" : "none";
    });
}


// Åpner modalen og fyller den med klikkbare navn fra registeret
function aapneElevrapportValg() {
    const container = document.getElementById('elevListeContainer');
    container.innerHTML = "";
    document.getElementById('elevSokInput').value = ""; // Tøm søkefelt
    
    // Henter alle unike navn fra elevRegisteret og lager rader
    Object.keys(elevRegister).sort().forEach(navn => {
        const div = document.createElement('div');
        div.className = "elev-valg-rad";
        div.style.padding = "10px";
        div.style.cursor = "pointer";
        div.style.borderBottom = "1px solid #eee";
        div.innerText = navn;
        div.onclick = () => genererFullElevrapport(navn);
        container.appendChild(div);
    });
    
    document.getElementById('modalElevrapport').style.display = 'block';
}

// EKSPORT - ALLE KLASSER
async function eksporterAlleKlasser() {
    const oppsett = hentOppsett();
    
    // Vi bruker verdiene fra hovedmenyene (mAar, mFag osv) 
    // siden adminpanelet uansett krever at disse er valgt for å vite hvilket oppsett som skal brukes.
    const vAar = document.getElementById('mAar').value;
    const vFag = document.getElementById('mFag').value;
    const vPeriode = document.getElementById('mPeriode').value;
    const vTrinn = document.getElementById('mTrinn').value;

    if (!vAar || !vFag || !vPeriode || !vTrinn) {
        return alert("Vennligst velg år, fag, periode og trinn i hovedmenyene først.");
    }

    try {
        const sti = `kartlegging/${vAar}/${vFag}/${vPeriode}/${vTrinn}`;
        const snapshot = await db.ref(sti).once('value');
        const alleKlasseData = snapshot.val() || {};
        
        const wb = XLSX.utils.book_new();
        let harData = false;

        // Vi sjekker alle mulige klasser (A-D)
        const klasser = ["A", "B", "C", "D"]; 
        const vStartAar = parseInt(vAar.split('-')[0]);

        klasser.forEach(klasseNavn => {
            const klasseResultater = alleKlasseData[klasseNavn] || {};
            let rader = [];
            
            // Finn elever i denne spesifikke klassen fra registeret
            const relevanteElever = Object.keys(elevRegister).filter(navn => {
                const e = elevRegister[navn];
                const cTrinn = e.startTrinn + (vStartAar - e.startAar);
                return cTrinn == vTrinn && e.startKlasse === klasseNavn;
            }).sort();

            if (relevanteElever.length > 0) {
                // Overskrifter for denne klassens fane
                let headers = ["Elevnavn"];
                oppsett.oppgaver.forEach(o => headers.push(o.navn));
                headers.push("Sum");

                relevanteElever.forEach(navn => {
                    const d = klasseResultater[navn] || {};
                    if (d.slettet) return;

                    let rad = [navn];
                    if (d.ikkeGjennomfort) {
                        oppsett.oppgaver.forEach(() => rad.push("Ikke gjennomført"));
                        rad.push(0);
                    } else if (d.oppgaver) {
                        oppsett.oppgaver.forEach((o, i) => rad.push(d.oppgaver[i] || 0));
                        rad.push(d.sum || 0);
                    } else {
                        oppsett.oppgaver.forEach(() => rad.push("-"));
                        rad.push("-");
                    }
                    rader.push(rad);
                });

                if (rader.length > 0) {
                    const ws = XLSX.utils.aoa_to_sheet([headers, ...rader]);
                    XLSX.utils.book_append_sheet(wb, ws, `Klasse ${vTrinn}${klasseNavn}`);
                    harData = true;
                }
            }
        });

        if (!harData) {
            alert("Fant ingen lagrede resultater for dette trinnet.");
            return;
        }

        XLSX.writeFile(wb, `Backup_${vFag}_${vTrinn}trinn_${vPeriode}_${vAar}.xlsx`);

    } catch (err) {
        console.error("Backup-feil:", err);
        alert("Kunne ikke generere backup. Se konsollen for detaljer.");
    }
}

// IMPORT FRA EXCEL
let midlertidigImportData = []; // Lagrer data fra Excel mens vi kobler navn

function handterExcelFil(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(firstSheet);

        analyserImportData(json);
    };
    reader.readAsArrayBuffer(file);
    input.value = ""; // Nullstill input så samme fil kan velges igjen
}

function analyserImportData(data) {
    const oppsett = hentOppsett();
    const vTrinn = parseInt(document.getElementById('mTrinn').value);
    const vKlasse = document.getElementById('mKlasse').value;
    const vAar = document.getElementById('mAar').value;
    const vStartAar = parseInt(vAar.split('-')[0]);

    // Finn alle aktive elever i valgt klasse
    const aktuelleElever = Object.keys(elevRegister).filter(navn => {
        const e = elevRegister[navn];
        const cTrinn = e.startTrinn + (vStartAar - e.startAar);
        return cTrinn === vTrinn && e.startKlasse === vKlasse;
    }).sort((a, b) => a.localeCompare(b, 'nb'));

    midlertidigImportData = [];
    let uidentifiserteNavn = [];

    data.forEach(rad => {
        // Finn kolonnen som ligner på "Navn" eller "Elev"
        const excelNavn = rad["Elevnavn"] || rad["Navn"] || rad["Elev"] || Object.values(rad)[0];
        if (!excelNavn) return;

        // Prøv eksakt match
        if (aktuelleElever.includes(excelNavn)) {
            midlertidigImportData.push({ id: excelNavn, data: rad });
        } else {
            uidentifiserteNavn.push(excelNavn);
            midlertidigImportData.push({ id: null, originalNavn: excelNavn, data: rad });
        }
    });

    if (uidentifiserteNavn.length > 0) {
        visMappingVindu(uidentifiserteNavn, aktuelleElever);
    } else {
        if(confirm(`Klar til å importere data for ${midlertidigImportData.length} elever?`)) {
            fullforImport();
        }
    }
}

function visMappingVindu(ukjente, systemElever) {
    const container = document.getElementById('mappingContainer');
    container.innerHTML = "";
    
    ukjente.forEach(ukjentNavn => {
        let html = `
            <div class="mapping-rad" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;">
                <span style="font-weight:bold; width: 40%;">${ukjentNavn}</span>
                <span style="width: 5%;">➡</span>
                <select class="mapping-select" data-original="${ukjentNavn}" 
                        style="width: 50%; padding: 5px;" 
                        onchange="oppdaterMappingValg()">
                    <option value="">-- Velg elev --</option>
                    <option value="SKIP">Hopp over denne</option>
                    ${systemElever.map(s => `<option value="${s}">${s}</option>`).join('')}
                </select>
            </div>`;
        container.innerHTML += html;
    });
    
    document.getElementById('modalMapping').style.display = 'block';
}

function oppdaterMappingValg() {
    const alleSelects = document.querySelectorAll('.mapping-select');
    
    // 1. Finn ut hvilke navn som er valgt akkurat nå
    const valgteNavn = Array.from(alleSelects)
        .map(sel => sel.value)
        .filter(val => val !== "" && val !== "SKIP");

    // 2. Gå gjennom hver meny og skjul/vis alternativer
    alleSelects.forEach(currentSelect => {
        const options = currentSelect.querySelectorAll('option');
        
        options.forEach(opt => {
            // Vi skal aldri skjule "Velg elev", "Hopp over" eller det navnet som er valgt i AKKURAT denne menyen
            if (opt.value === "" || opt.value === "SKIP" || opt.value === currentSelect.value) {
                opt.style.display = "block";
                return;
            }

            // Hvis navnet er valgt i en ANNEN meny, skjul det
            if (valgteNavn.includes(opt.value)) {
                opt.style.display = "none";
            } else {
                opt.style.display = "block";
            }
        });
    });
}


async function kjorFullSkoleEksport() {
    const vAar = document.getElementById('teAar').value;
    const vFag = document.getElementById('teFag').value;
    const vPeriode = document.getElementById('tePeriode').value;

    if (!vAar || vAar === "") {
        alert("Vennligst velg et skoleår først.");
        return;
    }

    // 1. MAL-TRIKKET: Finn ut hvilket år vi skal hente oppsettet fra
    const aarIMal = oppgaveStruktur[vAar] ? vAar : "2025-2026";

    try {
        const snapshot = await db.ref(`kartlegging/${vAar}/${vFag}/${vPeriode}`).once('value');
        const alleData = snapshot.val() || {};
        
        const wb = XLSX.utils.book_new();
        const trinnListe = ["1", "2", "3", "4", "5", "6", "7"];
        const klasseListe = ["A", "B", "C", "D"];
        
        const valgtStartAar = parseInt(vAar.split('-')[0]);
        let harDataOverhode = false;

        trinnListe.forEach(trinnNummer => {
            const trinnInt = parseInt(trinnNummer);
            
            // 2. BRUKER aarIMal her for å hente kolonneoverskrifter og oppgaver
            const trinnOppsett = (oppgaveStruktur[aarIMal] && 
                                  oppgaveStruktur[aarIMal][vFag] && 
                                  oppgaveStruktur[aarIMal][vFag][vPeriode]) 
                                  ? oppgaveStruktur[aarIMal][vFag][vPeriode][trinnNummer] 
                                  : null;
            
            if (!trinnOppsett) return; 

            const trinnData = alleData[trinnNummer] || {};

            klasseListe.forEach(kl => {
                const klasseData = trinnData[kl] || {};
                let rader = [];
                
                // 3. DYNAMISK TRINN-BEREGNING (Med parseInt for sikkerhet)
                const elever = Object.keys(elevRegister).filter(navn => {
                    const e = elevRegister[navn];
                    const beregnetTrinn = parseInt(e.startTrinn) + (valgtStartAar - parseInt(e.startAar));
                    return beregnetTrinn === trinnInt && e.startKlasse === kl;
                }).sort();

                if (elever.length > 0) {
                    let headers = ["Elevnavn", ...trinnOppsett.oppgaver.map(o => o.navn), "Sum"];
                    
                    elever.forEach(navn => {
                        const d = klasseData[navn] || {};
                        if (d.slettet) return;

                        let rad = [navn];
                        if (d.ikkeGjennomfort) {
                            trinnOppsett.oppgaver.forEach(() => rad.push("Ikke gjennomført"));
                            rad.push(0);
                        } else if (d.oppgaver) {
                            // Vi mapper poengene basert på oppsettet fra mal-året
                            trinnOppsett.oppgaver.forEach((_, i) => rad.push(d.oppgaver[i] || 0));
                            rad.push(d.sum || 0);
                        } else {
                            trinnOppsett.oppgaver.forEach(() => rad.push("-"));
                            rad.push("-");
                        }
                        rader.push(rad);
                    });

                    if (rader.length > 0) {
                        const ws = XLSX.utils.aoa_to_sheet([headers, ...rader]);
                        XLSX.utils.book_append_sheet(wb, ws, `${trinnNummer}${kl}`);
                        harDataOverhode = true;
                    }
                }
            });
        });

        if (!harDataOverhode) {
            alert("Fant ingen elever eller data for " + vFag + " i " + vAar);
            return;
        }

        XLSX.writeFile(wb, `FULL_BACKUP_${vFag}_${vPeriode}_${vAar}.xlsx`);
        document.getElementById('modalTotalEksport').style.display = 'none';

    } catch (err) {
        console.error("Eksport-feil:", err);
        alert("Noe gikk galt under eksporten.");
    }
}



function fullforImport() {
    const oppsett = hentOppsett();
    const selects = document.querySelectorAll('.mapping-select');
    
    // 1. Oppdater midlertidig data med valgene fra mapping-vinduet
    selects.forEach(sel => {
        const original = sel.dataset.original;
        const valgt = sel.value;
        const index = midlertidigImportData.findIndex(d => d.originalNavn === original);
        if (index > -1) {
            midlertidigImportData[index].id = (valgt === "SKIP" || valgt === "") ? null : valgt;
        }
    });

    let lagringsLøfter = [];

    midlertidigImportData.forEach(item => {
        if (!item.id) return;

        let poeng = [];
        let sum = 0;
        
        // 2. Gå gjennom oppgavene i systemet
        oppsett.oppgaver.forEach((o, index) => {
            // Vi prøver å finne verdien i Excel-raden på tre måter:
            // A: Direkte match på navn (f.eks. "Oppgave 1")
            // B: Ved å fjerne mellomrom og gjøre til små bokstaver (f.eks. "oppgave1")
            // C: Ved å bruke rekkefølgen (hvis Oppgave 1 er kolonne nr 2 i Excel)
            
            let verdi = 0;
            const systemNavnRenset = o.navn.toLowerCase().replace(/\s/g, '');
            
            // Finn den nøkkelen i Excel-raden som ligner mest
            const excelNøkler = Object.keys(item.data);
            const matchNøkkel = excelNøkler.find(n => n.toLowerCase().replace(/\s/g, '') === systemNavnRenset);
            
            if (matchNøkkel) {
                verdi = parseInt(item.data[matchNøkkel]);
            } else {
                // Hvis vi ikke finner navnet, prøv å ta kolonne nr (index + 1 siden Navn er kolonne 0)
                const verdier = Object.values(item.data);
                verdi = parseInt(verdier[index + 1]); 
            }

            const endeligPoeng = isNaN(verdi) ? 0 : verdi;
            poeng.push(endeligPoeng);
            sum += endeligPoeng;
        });

        // 3. Lagre objektet slik systemet forventer det
        const dataTilLagring = {
            oppgaver: poeng,
            sum: sum,
            slettet: false,
            dato: new Date().toISOString(),
            ikkeGjennomfort: false
        };

        // Lagre til Firebase under riktig elev-ID (navn)
        lagringsLøfter.push(db.ref(hentSti(item.id)).set(dataTilLagring));
    });

    Promise.all(lagringsLøfter).then(() => {
        alert("Import fullført for " + lagringsLøfter.length + " elever!");
        document.getElementById('modalMapping').style.display = 'none';
        tegnTabell(); // Oppdater skjermen
    }).catch(err => {
        console.error("Importfeil:", err);
        alert("Det oppstod en feil under lagring.");
    });
}






// Henter ALT fra Firebase og bygger utskriftssiden
async function genererFullElevrapport(navn) {
    const utskriftArea = document.getElementById('utskriftRapportArea');
    utskriftArea.innerHTML = "<h2 style='text-align:center; padding:50px;'>Genererer rapport for " + navn + "...</h2>";
    document.getElementById('modalElevrapport').style.display = 'none';

    try {
        const snap = await db.ref(`kartlegging`).once('value');
        const alleData = snap.val() || {};
        
        let funnetData = [];

        // Vi må bla gjennom hele treet for å finne denne eleven
        for (let aar in alleData) {
            for (let fag in alleData[aar]) {
                for (let periode in alleData[aar][fag]) {
                    for (let trinn in alleData[aar][fag][periode]) {
                        for (let klasse in alleData[aar][fag][periode][trinn]) {
                            const e = alleData[aar][fag][periode][trinn][klasse][navn];
                            
                            if (e && e.oppgaver && !e.slettet) {
                                funnetData.push({
                                    aar, fag, periode, trinn, klasse,
                                    resultat: e,
                                    oppsett: hentOppsettSpesifikk(aar, fag, periode, trinn)
                                });
                            }
                        }
                    }
                }
            }
        }

        if (funnetData.length === 0) {
            alert("Fant ingen lagrede resultater for " + navn);
            return;
        }

        // Sorterer etter år og periode (høst før vår)
        funnetData.sort((a, b) => a.aar.localeCompare(b.aar) || b.periode.localeCompare(a.periode));

        let html = `
            <div style="padding: 20px; font-family: Arial, sans-serif;">
                <h1 style="text-align:center; color:#2c3e50; margin-bottom:5px;">ELEVSRAPPORT</h1>
                <h2 style="text-align:center; margin-top:0;">${navn}</h2>
                <p style="text-align:center; color:#666;">Utskriftsdato: ${new Date().toLocaleDateString('nb-NO')}</p>
                <hr style="border:1px solid #2980b9; margin: 20px 0;">
        `;

        funnetData.forEach(d => {
            const o = d.oppsett;
            const res = d.resultat;
            const maksTotal = o.oppgaver.reduce((sum, op) => sum + op.maks, 0);

            html += `
                <div style="margin-bottom: 40px; page-break-inside: avoid;">
                    <h3 style="background:#2980b9; color:white; padding:10px; border-radius:4px; margin-bottom:10px;">
                        ${d.fag} - ${d.periode} ${d.aar} (${d.trinn}. trinn)
                    </h3>
                    <table style="width:100%; border-collapse: collapse; margin-bottom:10px;">
                        <thead>
                            <tr style="background:#ecf0f1; text-align:left;">
                                <th style="padding:10px; border:1px solid #bdc3c7;">Oppgave</th>
                                <th style="padding:10px; border:1px solid #bdc3c7;">Resultat</th>
                                <th style="padding:10px; border:1px solid #bdc3c7;">Maks</th>
                                <th style="padding:10px; border:1px solid #bdc3c7;">Status</th>
                            </tr>
                        </thead>
                        <tbody>`;

            o.oppgaver.forEach((oppg, i) => {
                const poeng = res.oppgaver[i] || 0;
                const kritisk = oppg.grense !== -1 && poeng <= oppg.grense;
                html += `
                    <tr>
                        <td style="padding:8px; border:1px solid #bdc3c7;">${oppg.navn}</td>
                        <td style="padding:8px; border:1px solid #bdc3c7; font-weight:bold;">${poeng}</td>
                        <td style="padding:8px; border:1px solid #bdc3c7;">${oppg.maks}</td>
                        <td style="padding:8px; border:1px solid #bdc3c7; color:${kritisk ? '#e74c3c' : '#27ae60'}; font-weight:bold;">
                            ${kritisk ? 'Under kritisk grense' : 'OK'}
                        </td>
                    </tr>`;
            });

            const totalKritisk = res.sum <= o.grenseTotal;
            html += `
                        <tr style="background:#f9f9f9; font-weight:bold;">
                            <td style="padding:10px; border:1px solid #bdc3c7;">TOTAL POENSUM</td>
                            <td style="padding:10px; border:1px solid #bdc3c7; font-size:1.1em;">${res.sum}</td>
                            <td style="padding:10px; border:1px solid #bdc3c7;">${maksTotal}</td>
                            <td style="padding:10px; border:1px solid #bdc3c7; color:${totalKritisk ? '#e74c3c' : '#27ae60'};">
                                ${totalKritisk ? 'UNDER TOTALGRENSE' : 'OK'}
                            </td>
                        </tr>
                    </tbody>
                </table>
                <p style="font-size:0.9em; color:#7f8c8d;">Registrert dato: ${new Date(res.dato).toLocaleDateString('nb-NO')}</p>
            </div>`;
        });

       html += `</div>`;
        utskriftArea.innerHTML = html;

        // Gi nettleseren tid til å tegne HTML før print-dialogen kommer
        setTimeout(() => { 
            window.print(); 
        }, 500);

        // NYTT: Tømmer rapportområdet etter at print-vinduet lukkes 
        // slik at vanlig klasseliste-utskrift fungerer etterpå.
        window.onafterprint = function() {
            utskriftArea.innerHTML = "";
            console.log("Rapportområde tømt etter utskrift.");
        };

    } catch (error) {
        console.error("Feil ved generering av rapport:", error);
        alert("Kunne ikke hente data fra databasen.");
    }
} 


function leggTilNyElev() {
    const etternavn = document.getElementById('nyttEtternavn').value.trim();
    const fornavn = document.getElementById('nyttFornavn').value.trim();

    // Henter de gjeldende valgene fra nedtrekksmenyene
    const vAar = document.getElementById('mAar').value; // f.eks "2026-2027"
    const vTrinn = document.getElementById('mTrinn').value; // f.eks "3"
    const vKlasse = document.getElementById('mKlasse').value; // f.eks "A"

    if (!etternavn || !fornavn || !vAar || !vTrinn || !vKlasse) {
        alert("Vennligst fyll ut navn og sørg for at År, Trinn og Klasse er valgt i menyen.");
        return;
    }

    const fulltNavn = `${etternavn.toUpperCase()} ${fornavn.charAt(0).toUpperCase() + fornavn.slice(1)}`;
    const valgtStartAar = parseInt(vAar.split('-')[0]);

    if (confirm(`Vil du legge til ${fulltNavn} i ${vTrinn}${vKlasse} for skoleåret ${vAar}?`)) {
        
        // 1. OPPDATER ELEVREGISTERET (Slik at de dukker opp i listen)
        // Vi beregner hva elevens "Start-trinn" må være for at de skal havne på valgt trinn i valgt år.
        // Hvis vi legger til en elev i 3. trinn i 2026, lagrer vi dem som om de startet i 1. trinn i 2024.
        const startTrinnForRegister = parseInt(vTrinn); 
        const startAarForRegister = valgtStartAar;

        const registerData = {
            startAar: startAarForRegister,
            startTrinn: startTrinnForRegister,
            startKlasse: vKlasse
        };

        // Lagre til både elevRegister (lokalt) og Firebase
        db.ref(`elevRegister/${fulltNavn}`).set(registerData).then(() => {

            // --- NY: Oppdater den lokale variabelen manuelt her ---
            // Dette sikrer at tegnTabell() "ser" eleven med en gang
            if (typeof elevRegister !== 'undefined') {
                elevRegister[fulltNavn] = registerData;
            }

            // 2. LAGRE TOMT RESULTAT-OBJEKT (Selve kartleggings-dataen)
            const sti = `kartlegging/${vAar}/${document.getElementById('mFag').value}/${document.getElementById('mPeriode').value}/${vTrinn}/${vKlasse}/${fulltNavn}`;
            
            return db.ref(sti).set({
                oppgaver: [],
                sum: 0,
                dato: new Date().toISOString()
            });

        }).then(() => {
            alert(`${fulltNavn} er lagt til i registeret og klasselisten.`);
            document.getElementById('nyttEtternavn').value = "";
            document.getElementById('nyttFornavn').value = "";
            
            // Tving en oppdatering av tabellen
            if (typeof hentElevRegister === "function") {
                hentElevRegister(); // Hent registeret på nytt fra Firebase
            } else {
                tegnTabell(); 
            }
        }).catch(error => {
            console.error("Feil ved lagring:", error);
            alert("Noe gikk galt. Se konsollen.");
        });
    }
}


// Denne funksjonen må kjøre når siden starter
function startLyttere() {
    // 1. Lagre en kopi av de faste elevene fra elever.js med en gang
    // Vi antar at variabelen fra elever.js heter 'fasteElever' eller lignende.
    // Hvis den heter 'elevRegister' i fila, gir vi den et midlertidig navn:
    const initialeElever = typeof elevRegister !== 'undefined' ? {...elevRegister} : {};

    db.ref('elevRegister').on('value', snapshot => {
        const data = snapshot.val() || {};
        
        // 2. SLÅ SAMMEN: Start med fila, legg til Firebase-data
        // Dette gjør at Firebase-elever vinner hvis navnene er like
        elevRegister = { ...initialeElever, ...data };
        
        console.log("Systemet er klart!");
        console.log("Elever fra fil + Firebase totalt:", Object.keys(elevRegister).length);
        
        // 3. Oppdater tabellen
        tegnTabell(); 
    });
}


function slettElev(navn) {
    if (confirm(`Vil du slette ${navn} fra denne prøven?`)) {
        db.ref(hentSti(navn)).update({ slettet: true }).then(() => {
            tegnTabell(); // Tvinger tabellen til å tegne på nytt
        });
    }
}

function gjenopprettElev(navn) {
    db.ref(hentSti(navn)).update({ slettet: false }).then(() => {
        tegnTabell(); // Tvinger tabellen til å tegne på nytt
    });
}

// NYTT: Global lytter for Enter-tasten inni modalen
document.addEventListener('keydown', function(e) {
    const modal = document.getElementById('modal');
    if (modal.style.display === 'block' && e.key === 'Enter') {
        e.preventDefault(); // Hindrer at siden refresher eller lignende
        
        const inputs = Array.from(document.querySelectorAll('.oppg-input'));
        const aktivtElement = document.activeElement;
        const index = inputs.indexOf(aktivtElement);

        if (index > -1 && index < inputs.length - 1) {
            // Hvis vi ikke er på siste felt, gå til neste
            inputs[index + 1].focus();
            inputs[index + 1].select();
        } else {
            // Hvis vi er på siste felt, lagre dataene
            lagreData();
        }
    }
    
    // Bonus: Lukk med Escape-tasten
    if (e.key === 'Escape') lukkModal();
});


// SLETTE ELEVER I ADMIN
function aapneSlettElevModal() {
    const container = document.getElementById('sletteListeContainer');
    container.innerHTML = '<p style="padding:10px; color:#666;">Henter elever fra database...</p>';
    document.getElementById('slettElevSok').value = "";
    
    // Vi henter data DIREKTE fra Firebase-referansen, 
    // ikke fra den sammenslåtte 'elevRegister'-variabelen.
    db.ref('elevRegister').once('value', snapshot => {
        const firebaseData = snapshot.val();
        container.innerHTML = ""; // Tømmer "Henter..." teksten
        
        if (!firebaseData) {
            container.innerHTML = '<p style="padding:10px;">Ingen manuelt lagt til elever i databasen.</p>';
            return;
        }

        Object.keys(firebaseData).sort().forEach(navn => {
            const div = document.createElement('div');
            div.className = "slette-valg-rad";
            div.style.display = "flex";
            div.style.justifyContent = "space-between";
            div.style.alignItems = "center";
            div.style.padding = "10px";
            div.style.borderBottom = "1px solid #eee";
            
            div.innerHTML = `
                <span>${navn} <small style="color:blue;">(Firebase)</small></span>
                <button onclick="bekreftTotalSletting('${navn}')" 
                        style="background:#e74c3c; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">
                    Slett permanent
                </button>
            `;
            container.appendChild(div);
        });
    });
    
    document.getElementById('modalSlettElev').style.display = 'block';
}

// Søkefunksjon i slettelista
function filtrerSletteliste() {
    const sok = document.getElementById('slettElevSok').value.toLowerCase();
    const rader = document.querySelectorAll('.slette-valg-rad');
    
    rader.forEach(rad => {
        const navn = rad.querySelector('span').innerText.toLowerCase();
        rad.style.display = navn.includes(sok) ? "flex" : "none";
    });
}

// Selve slettehandlingen
async function bekreftTotalSletting(navn) {
    const bekreft = confirm(`Vil du slette ${navn} permanent fra databasen?`);
    
    if (bekreft) {
        try {
            // 1. Fjern fra Firebase
            await db.ref(`elevRegister/${navn}`).remove();
            
            // 2. Fjern fra lokal kopi (så den ikke dukker opp igjen før Refresh)
            if (typeof elevRegister !== 'undefined' && elevRegister[navn]) {
                delete elevRegister[navn];
            }
            
            alert(`${navn} er slettet.`);
            
            // 3. Oppdater KUN slettelista (ikke hovedtabellen ennå)
            aapneSlettElevModal(); 
            
        } catch (error) {
            console.error("Sletting feilet:", error);
            alert("Kunne ikke slette.");
        }
    }
}

function eksporter() {
    const oppsett = hentOppsett();
    if (!oppsett) return alert("Velg alle kriterier først!");

    const vTrinn = document.getElementById('mTrinn').value;
    const vKlasse = document.getElementById('mKlasse').value;
    const vAar = document.getElementById('mAar').value;
    const vFag = document.getElementById('mFag').value;
    const vPeriode = document.getElementById('mPeriode').value;

    // Definer overskrifter (Viktig for import-logikken din)
    let headers = ["Elevnavn"];
    oppsett.oppgaver.forEach(o => headers.push(o.navn));
    headers.push("Sum");

    let rader = [];
    const vStartAar = parseInt(vAar.split('-')[0]);

    Object.keys(elevRegister).sort().forEach(navn => {
        const e = elevRegister[navn];
        const cTrinn = e.startTrinn + (vStartAar - e.startAar);

        if (cTrinn == vTrinn && e.startKlasse === vKlasse) {
            const d = lagredeResultater[navn] || {};
            if (d.slettet) return;

            let rad = [navn];
            if (d.ikkeGjennomfort) {
                oppsett.oppgaver.forEach(() => rad.push("Ikke gjennomført"));
                rad.push(0);
            } else if (d.oppgaver) {
                oppsett.oppgaver.forEach((o, i) => rad.push(d.oppgaver[i] || 0));
                rad.push(d.sum || 0);
            } else {
                oppsett.oppgaver.forEach(() => rad.push("-"));
                rad.push("-");
            }
            rader.push(rad);
        }
    });

    if (rader.length === 0) return alert("Ingen elever å eksportere.");

    // Lag filen ved hjelp av XLSX-biblioteket
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rader]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resultater");
    XLSX.writeFile(wb, `Resultat_${vFag}_${vTrinn}${vKlasse}_${vPeriode}.xlsx`);
}
function forberedPrint() { window.print(); }