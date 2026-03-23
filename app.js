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
    // 1. Skjul rapportvisning hvis den er åpen
    const hovedTabell = document.getElementById('hovedTabell');
    if (hovedTabell) hovedTabell.style.display = 'table';
    
    const rc = document.getElementById('rapportContainer');
    if (rc) rc.innerHTML = "";

    // 2. Hent verdiene fra menyen
    const a = document.getElementById('mAar').value; // År (f.eks "2024-2025")
    const f = document.getElementById('mFag').value; // Fag
    const p = document.getElementById('mPeriode').value; // Periode
    const t = document.getElementById('mTrinn').value; // Trinn
    const k = document.getElementById('mKlasse').value; // Klasse
    
    const nyElevSeksjon = document.getElementById('nyElevSeksjon');
    const actionBar = document.querySelector('.action-bar');

    // 3. Validering: Hvis ikke alle valg er tatt, skjul tabell og knapper
    if (!a || !f || !p || !t || !k) {
        if (nyElevSeksjon) nyElevSeksjon.style.display = 'none';
        if (actionBar) actionBar.style.display = 'none';
        // Tøm tabellen så man ikke ser gamle data fra forrige valg
        document.getElementById('tBody').innerHTML = "<tr><td colspan='100%'>Velg alle kriterier over...</td></tr>";
        return;
    }

    // 4. Hvis alle valg er tatt: Vis registreringsboks og knapper
    if (nyElevSeksjon) nyElevSeksjon.style.display = 'block';
    if (actionBar) actionBar.style.display = 'flex';

    // Oppdater overskriften på siden
    oppdaterOverskrifter(`Kartlegging i ${f} - ${t}${k} - ${p} ${a}`);

    // 5. Oppdater dropdown-listen med elever (viktig for at riktige elever skal vises der)
    oppdaterElevListe();

    // 6. Start lytting på Firebase (OFF skrur av gamle lyttere så vi ikke får "ekko")
    const sti = `kartlegging/${a}/${f}/${p}/${t}/${k}`;
    db.ref(sti).off(); // Stopper forrige lytter før vi starter ny
    
    db.ref(sti).on('value', snapshot => {
        lagredeResultater = snapshot.val() || {};
        tegnTabell(); // Denne kaller nå den nye tegnTabell vi fikset istreid
    });
}

// --- TEGN TABELL (Inkludert gjennomsnitt og håndtering av ikke gjennomført) ---
function tegnTabell() {
    // 1. HENT VERDIER FRA DINE SPESIFIKKE ID-er (mAar, mFag, osv)
    const vAar = document.getElementById('mAar').value;
    const vFag = document.getElementById('mFag').value;
    const vPeriode = document.getElementById('mPeriode').value;
    const vTrinn = document.getElementById('mTrinn').value;
    const vKlasse = document.getElementById('mKlasse').value;

    const tHead = document.getElementById('tHead');
    const tBody = document.getElementById('tBody');

    // Sjekk om alle valg er gjort
    if (!vAar || !vFag || !vPeriode || !vTrinn || !vKlasse) {
        tBody.innerHTML = "<tr><td colspan='100%'>Vennligst velg alle kriterier i menyen over...</td></tr>";
        return;
    }

    // 2. HENT RIKTIG OPPGAVESTRUKTUR
    const oppsett = (oppgaveStruktur[vAar] && 
                     oppgaveStruktur[vAar][vFag] && 
                     oppgaveStruktur[vAar][vFag][vPeriode]) 
                     ? oppgaveStruktur[vAar][vFag][vPeriode][vTrinn] 
                     : null;

    if (!oppsett) {
        tBody.innerHTML = `<tr><td colspan='100%'>Fant ikke oppsett for ${vFag} ${vPeriode} på ${vTrinn}. trinn i ${vAar}.</td></tr>`;
        return;
    }

    // 3. LAG TABELLHODE
    let hode = `<tr><th style="text-align:left">Elevnavn</th>`;
    oppsett.oppgaver.forEach(o => {
        hode += `<th>${o.navn}<br><small>max ${o.maks}</small></th>`;
    });
    hode += `<th>Sum</th><th class="no-print">Handling</th></tr>`;
    tHead.innerHTML = hode;

    // 4. FORBERED BEREGNINGER
    const vStartAarValgt = parseInt(vAar.split('-')[0]);
    let antallAktiveMedData = 0;
    let kolonneSummer = new Array(oppsett.oppgaver.length).fill(0);
    let totalSumKlasse = 0;

    let aktiveRader = "";
    let slettedeRader = "";

    // 5. GÅ GJENNOM ELEVREGISTERET
    const alleNavn = Object.keys(elevRegister).sort();
    
    alleNavn.forEach(navn => {
        const e = elevRegister[navn];
        
        // DYNAMISK TRINN-BEREGNING
        // Formel: Elevens starttrinn + (Valgt skoleår-start - Elevens startår)
        const cTrinn = parseInt(e.startTrinn) + (vStartAarValgt - parseInt(e.startAar));

        // Sjekk om eleven skal vises i denne klassen akkurat nå
        if (cTrinn == vTrinn && e.startKlasse === vKlasse) {
            const d = lagredeResultater[navn] || {};
            const erSlettet = d.slettet === true;
            const erIkkeGjennomfort = d.ikkeGjennomfort === true;

            let printKlasse = erSlettet ? 'class="no-print"' : '';
            let radStil = erSlettet ? 'style="color: #a0aec0; background: #f7fafc;"' : (erIkkeGjennomfort ? 'style="background: #fff5f5;"' : '');

            let rad = `<tr ${printKlasse} ${radStil}><td style="text-align:left"><b>${navn}</b> ${erSlettet ? '<small>(Slettet)</small>' : ''}</td>`;

            if (!erSlettet && erIkkeGjennomfort) {
                const antallKolonner = oppsett.oppgaver.length + 1;
                rad += `<td colspan="${antallKolonner}" style="color: #c53030; font-style: italic; font-weight: bold;">Ikke gjennomført</td>`;
            } 
            else if (!erSlettet && d.oppgaver) {
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

            // HANDLING-KNAPPER
            rad += `<td class="no-print">`;
            if (erSlettet) {
                rad += `<button class="btn btn-hent" onclick="gjenopprettElev('${navn}')">Hent tilbake</button>`;
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

    // 6. LEGG TIL GJENNOMSNITT
    let snittHtml = "";
    if (antallAktiveMedData > 0) {
        snittHtml = `<tr class="snitt-rad" style="background:#edf2f7; font-weight:bold;"><td style="text-align:left">Gjennomsnitt ${vTrinn}${vKlasse}</td>`;
        kolonneSummer.forEach(sum => {
            snittHtml += `<td> ${(sum / antallAktiveMedData).toFixed(1)} </td>`;
        });
        snittHtml += `<td> ${(totalSumKlasse / antallAktiveMedData).toFixed(1)} </td><td class="no-print"></td></tr>`;
    }

    tBody.innerHTML = aktiveRader + snittHtml + slettedeRader;
}


    // 6. LEGG TIL GJENNOMSNITTSRAD (hvis det er data)
    let snittRad = "";
    if (antallAktiveMedData > 0) {
        snittRad = `<tr class="snitt-rad" style="background:#edf2f7; font-weight:bold;"><td style="text-align:left">Gjennomsnitt ${vTrinn}${vKlasse}</td>`;
        kolonneSummer.forEach(sum => {
            snittRad += `<td> ${(sum / antallAktiveMedData).toFixed(1)} </td>`;
        });
        snittRad += `<td> ${(totalSumKlasse / antallAktiveMedData).toFixed(1)} </td><td class="no-print"></td></tr>`;
    }

    tBody.innerHTML = aktiveRader + snittRad + slettedeRader;
}

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
        if (typeof tegnTabell === "function") tegnTabell();
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
    // 1. Skjul selve admin-panelene og grafen
    document.getElementById('adminPanel').style.display = 'none';
    if (document.getElementById('chartContainer')) {
        document.getElementById('chartContainer').style.display = 'none';
    }
    
    // 2. Vis det vanlige innholdet (containeren), men tøm tabellen
    document.getElementById('skjemaInnhold').style.display = 'block';
    
    // 3. SKJUL elementer (Siden alt er nullstilt, skal disse være borte)
    if (document.getElementById('nyElevSeksjon')) {
        document.getElementById('nyElevSeksjon').style.display = 'none'; // Endret til none
    }
    const actionBar = document.querySelector('.action-bar');
    if (actionBar) {
        actionBar.style.display = 'none'; // Skjules til valg er tatt
    }

    // 4. NULLSTILLING: Tøm tabell og sett tekst
    document.getElementById('tHead').innerHTML = "";
    document.getElementById('tBody').innerHTML = "<tr><td>Velg alle kriterier...</td></tr>";

    // 5. NULLSTILLING: Sett alle menyer tilbake til start
    const filtere = ['mAar', 'mFag', 'mPeriode', 'mTrinn', 'mKlasse'];
    filtere.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.selectedIndex = 0; 
    });

    // Sett overskriften tilbake til standard instruksjon
    oppdaterOverskrifter("Velg kriterier for å vise kartlegging");
    
    // Koble fra Firebase-lytting
    db.ref().off(); 
    
    console.log("Admin lukket. Systemet er nullstilt og klart for nye valg.");
}


// --- ÅRSRAPPORT I ADMIN-FUNKSJONER (Oppdatert med snitt og Ikke gjennomført) ---
async function kjorAdminRapport(type) {
    const aar = document.getElementById('adminAar').value;
    const fag = document.getElementById('adminFag').value;
    const periode = document.getElementById('adminPeriode').value;
    
    const printDiv = document.createElement('div');
    printDiv.id = 'tempPrintArea';
    printDiv.style.position = 'absolute';
    printDiv.style.left = '-9999px'; 
    document.body.appendChild(printDiv);

    let samletInnhold = `<h1 style="text-align:center;">${type === 'kritisk' ? 'Kritisk-liste' : 'Årsrapport'} - ${fag} (${aar})</h1>`;
    
    const klasser = ["A", "B", "C", "D"];
    const alleTrinn = ["1", "2", "3", "4", "5", "6", "7"];

    for (let trinn of alleTrinn) {
        for (let klasse of klasser) {
// ENDRET: Bruker den nye dype strukturen med [aar] først
        const oppsett = (oppgaveStruktur[aar] && oppgaveStruktur[aar][fag] && oppgaveStruktur[aar][fag][periode]) 
                        ? oppgaveStruktur[aar][fag][periode][trinn] 
                        : null;
            if (!oppsett) continue;

            const snapshot = await db.ref(`kartlegging/${aar}/${fag}/${periode}/${trinn}/${klasse}`).once('value');
            const data = snapshot.val() || {};

            // --- VARIABLER FOR KLASSESNITT ---
            let antallMedData = 0;
            let kolonneSummer = new Array(oppsett.oppgaver.length).fill(0);
            let totalSumKlasse = 0;

            let tabellHtml = `<div class="page-break">
                <h2 style="text-align:center;">${fag} - ${trinn}${klasse} - ${periode} ${aar}</h2>
                <table border="1" style="width:100%; border-collapse:collapse; margin-bottom:20px;">
                    <thead>
                        <tr style="background:#f2f2f2;"><th align="left">Elevnavn</th>`;
            
            oppsett.oppgaver.forEach(o => tabellHtml += `<th>${o.navn}</th>`);
            tabellHtml += `<th>Sum</th></tr></thead><tbody>`;

            let antallEleverVist = 0;
            const vStartAar = parseInt(aar.split('-')[0]);

            Object.keys(elevRegister).sort().forEach(navn => {
                const e = elevRegister[navn];
                const cTrinn = e.startTrinn + (vStartAar - e.startAar);
                
                if (cTrinn == trinn && e.startKlasse === klasse) {
                    const d = data[navn] || {};
                    const erSlettet = d.slettet === true;
                    const erIkkeGjennomfort = d.ikkeGjennomfort === true;
                    
                    if (erSlettet) return;

                    const erKritisk = d && d.sum <= oppsett.grenseTotal;
                    if (type === 'kritisk' && (!d.sum || !erKritisk || erIkkeGjennomfort)) return;

                    antallEleverVist++;
                    tabellHtml += `<tr><td><b>${navn}</b></td>`;

                    if (erIkkeGjennomfort) {
                        const colSpan = oppsett.oppgaver.length + 1;
                        tabellHtml += `<td colspan="${colSpan}" align="center" style="color:red; font-style:italic;">Ikke gjennomført</td>`;
                    } 
                    else if (d.oppgaver) {
                        // Tell med i snittet
                        antallMedData++;
                        oppsett.oppgaver.forEach((o, i) => {
                            const poeng = d.oppgaver[i] || 0;
                            kolonneSummer[i] += poeng;
                            const bakgrunn = (o.grense !== -1 && poeng <= o.grense) ? 'background-color:#ffcccc' : '';
                            tabellHtml += `<td align="center" style="${bakgrunn}">${poeng}</td>`;
                        });
                        totalSumKlasse += d.sum;
                        tabellHtml += `<td align="center" style="${erKritisk ? 'background-color:#ffcccc; font-weight:bold;' : ''}">${d.sum}</td>`;
                    } else {
                        oppsett.oppgaver.forEach(() => tabellHtml += `<td align="center">-</td>`);
                        tabellHtml += `<td align="center">-</td>`;
                    }
                    tabellHtml += `</tr>`;
                }
            });

            // --- LEGG TIL SNITTRAD I BUNNEN AV TABELLEN ---
            if (antallMedData > 0 && type !== 'kritisk') {
                tabellHtml += `<tr style="background:#eeeeee; font-weight:bold;"><td>Gjennomsnitt (${antallMedData} elev.)</td>`;
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

    // --- UTSKRIFT ---
    const printVindu = window.open('', '_blank');
    printVindu.document.write(`
        <html>
            <head>
                <title>Årsrapport</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top:10px; }
                    th, td { border: 1px solid black; padding: 4px; }
                    .page-break { page-break-after: always; }
                    h1, h2 { margin-bottom: 5px; }
                    @media print { .page-break { page-break-after: always; } }
                </style>
            </head>
            <body>${samletInnhold}</body>
        </html>
    `);
    printVindu.document.close();
    
    setTimeout(() => {
        printVindu.print();
        printVindu.close();
        if (printDiv.parentNode) document.body.removeChild(printDiv);
    }, 750);
}

// --- SAMMENLIGNING I ADMIN-FUNKSJONER ---
async function kjorSammenligning() {
    const aar = document.getElementById('compAar').value;
    const fag = document.getElementById('compFag').value;
    const periode = document.getElementById('compPeriode').value;
    const trinn = document.getElementById('compTrinn').value;

// ENDRET: Henter oppsettet fra riktig år
    const oppsett = (oppgaveStruktur[aar] && oppgaveStruktur[aar][fag] && oppgaveStruktur[aar][fag][periode]) 
                    ? oppgaveStruktur[aar][fag][periode][trinn] 
                    : null;
    if(!oppsett) return;

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
        const snap = await db.ref(`kartlegging/${aar}/${fag}/${periode}/${trinn}/${klasser[i]}`).once('value');
        const data = snap.val() || {};
        let antall = 0, summer = new Array(oppsett.oppgaver.length + 1).fill(0);

        Object.keys(data).forEach(n => {
            if (data[n].oppgaver && data[n].slettet !== true) {
                antall++;
                data[n].oppgaver.forEach((p, idx) => summer[idx] += p);
                summer[oppsett.oppgaver.length] += data[n].sum;
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
                    font: { weight: 'bold', size: 12 },
                    padding: 4, // Gir litt luft rundt teksten
                    formatter: function(value, context) {
                        const idx = context.dataIndex;
                        const maks = maksVerdier[idx];
                        const prosent = ((value / maks) * 100).toFixed(1);
                        return value + " / " + maks + "\n" + prosent + "%";
                    }
                }
            });
        }
    } // HER skal for-loopen lukkes (Flyttet opp fra bunnen)

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
            layout: { padding: { top: 20 } },
            scales: {
                y: { 
                    beginAtZero: true,
                    max: Math.max(...maksVerdier) * 1.2 // Økt til 1.2 for å gi plass til tekst
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
    });

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

    // Sjekk om år er valgt (siden du nå har "-- Velg år --" som standard)
    if (!vAar || vAar === "") {
        alert("Vennligst velg et skoleår først.");
        return;
    }

    try {
        const snapshot = await db.ref(`kartlegging/${vAar}/${vFag}/${vPeriode}`).once('value');
        const alleData = snapshot.val() || {};
        
        const wb = XLSX.utils.book_new();
        const trinnListe = ["1", "2", "3", "4", "5", "6", "7"];
        const klasseListe = ["A", "B", "C", "D"];
        
        // Henter ut første årstall fra valget (f.eks. 2026 fra "2026-2027")
        const valgtStartAar = parseInt(vAar.split('-')[0]);
        let harDataOverhode = false;

        trinnListe.forEach(trinnNummer => {
            const trinnInt = parseInt(trinnNummer);
            
            // Henter oppsettet for dette trinnet fra din oppgaveStruktur
            const trinnOppsett = (oppgaveStruktur[vAar] && 
                                  oppgaveStruktur[vAar][vFag] && 
                                  oppgaveStruktur[vAar][vFag][vPeriode]) 
                                  ? oppgaveStruktur[vAar][vFag][vPeriode][trinnNummer] 
                                  : null;
            
            if (!trinnOppsett) return; 

            const trinnData = alleData[trinnNummer] || {};

            klasseListe.forEach(kl => {
                const klasseData = trinnData[kl] || {};
                let rader = [];
                
                // DYNAMISK TRINN-BEREGNING:
                const elever = Object.keys(elevRegister).filter(navn => {
                    const e = elevRegister[navn];
                    
                    // Her skjer magien:
                    // Differansen mellom år nå og startår + starttrinn
                    // Eks: 2027 (valgt) - 2025 (start) = 2 år senere. 
                    // 1. trinn + 2 år = 3. trinn.
                    const beregnetTrinn = e.startTrinn + (valgtStartAar - e.startAar);
                    
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
            alert("Fant ingen elever eller data for " + vFag + " trinn 1-7 i " + vAar);
            return;
        }

        XLSX.writeFile(wb, `FULL_BACKUP_${vFag}_${vPeriode}_${vAar}.xlsx`);
        document.getElementById('modalTotalEksport').style.display = 'none';

    } catch (err) {
        console.error("Eksport-feil:", err);
        alert("Noe gikk galt. Sjekk at oppgaveStruktur har data for valgt år.");
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

    if (!etternavn || !fornavn) {
        alert("Vennligst skriv inn både fornavn og etternavn.");
        return;
    }

    // Formaterer navnet slik: "NORDMANN Ola"
    const fulltNavn = `${etternavn.toUpperCase()} ${fornavn.charAt(0).toUpperCase() + fornavn.slice(1)}`;

    // Lager et tomt objekt for eleven i Firebase (slik at de dukker opp i listen)
    // Vi setter "oppgaver" til en tom liste for å starte
    const sti = hentSti(fulltNavn);
    
    if (confirm(`Vil du legge til ${fulltNavn} i denne klassen?`)) {
        db.ref(sti).set({
            oppgaver: [],
            sum: 0,
            dato: new Date().toISOString()
        }).then(() => {
            // Tømmer feltene etter lagring
            document.getElementById('nyttEtternavn').value = "";
            document.getElementById('nyttFornavn').value = "";
            alert(`${fulltNavn} er lagt til.`);
        }).catch(error => {
            console.error("Feil ved lagring:", error);
            alert("Kunne ikke legge til elev. Sjekk konsollen for feil.");
        });
    }
}

function slettElev(navn) {
    if (confirm(`Vil du slette ${navn} fra denne prøven?`)) {
        db.ref(hentSti(navn)).update({ slettet: true });
    }
}

function gjenopprettElev(navn) {
    db.ref(hentSti(navn)).update({ slettet: false });
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