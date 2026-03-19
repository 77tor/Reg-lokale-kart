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
    const nyElevSeksjon = document.getElementById('nyElevSeksjon'); // NYTT: Henter boksen

    if (!a || !f || !p || !t || !k) {
        if (nyElevSeksjon) nyElevSeksjon.style.display = 'none'; // NYTT
        return;
    }
// Hvis alle valg er tatt, vis boksen!
    if (nyElevSeksjon) nyElevSeksjon.style.display = 'block'; // NYTT

    oppdaterOverskrifter(`Kartlegging i ${f} - ${t}${k} - ${p} ${a}`);

    db.ref(`kartlegging/${a}/${f}/${p}/${t}/${k}`).on('value', snapshot => {
        lagredeResultater = snapshot.val() || {};
        tegnTabell();
    });
}

// --- Tegn tabell ---
function tegnTabell() {
    const oppsett = hentOppsett();
    const tHead = document.getElementById('tHead');
    const tBody = document.getElementById('tBody');
    if (!oppsett) { 
        tBody.innerHTML = "<tr><td colspan='100%'>Velg alle kriterier...</td></tr>"; 
        return; 
    }

    // 1. Lag tabellhode
    let hode = `<tr><th style="text-align:left">Elevnavn</th>`;
    oppsett.oppgaver.forEach(o => hode += `<th>${o.navn}<br><small>max ${o.maks}</small></th>`);
    hode += `<th>Sum</th><th class="no-print">Handling</th></tr>`;
    tHead.innerHTML = hode;

    const vTrinn = parseInt(document.getElementById('mTrinn').value);
    const vKlasse = document.getElementById('mKlasse').value;
    const vAarInput = document.getElementById('mAar').value;
    if (!vAarInput) return;
    const vStartAar = parseInt(vAarInput.split('-')[0]);

    // Vi lager to strenger for å holde på HTML-radene (aktive øverst, slettede nederst)
    let aktiveRader = "";
    let slettedeRader = "";

    Object.keys(elevRegister).sort().forEach(navn => {
        const e = elevRegister[navn];
        const cTrinn = e.startTrinn + (vStartAar - e.startAar);
        
        if (cTrinn === vTrinn && e.startKlasse === vKlasse) {
            const d = lagredeResultater[navn] || {};
            const erSlettet = d.slettet === true;

            // Setter visuell stil for slettede rader
            let radStil = erSlettet ? 'style="color: #a0aec0; background: #f7fafc;"' : '';
            let rad = `<tr ${radStil}><td style="text-align:left"><b>${navn}</b> ${erSlettet ? '<small>(Slettet)</small>' : ''}</td>`;
            
            // --- POENG-CELLER ---
            if (!erSlettet && d.oppgaver) {
                // Vis tall hvis eleven er aktiv og har data
                oppsett.oppgaver.forEach((o, i) => {
                    const poeng = d.oppgaver[i] || 0;
                    let cls = (o.grense !== -1 && poeng <= o.grense) ? 'class="alert-low"' : '';
                    rad += `<td ${cls}>${poeng}</td>`;
                });
                let sumCls = (d.sum <= oppsett.grenseTotal) ? 'class="alert-low"' : '';
                rad += `<td ${sumCls}>${d.sum}</td>`;
            } else {
                // Vis streker hvis ikke registrert ELLER hvis slettet
                oppsett.oppgaver.forEach(() => rad += `<td class="not-registered">-</td>`);
                rad += `<td class="not-registered">-</td>`;
            }

            // --- KNAPPER (HANDLING) ---
            rad += `<td class="no-print">`;
            
if (erSlettet) {
    rad += `<button class="btn btn-hent" onclick="gjenopprettElev('${navn}')">Hent tilbake</button>`;
} else {
    if (d.oppgaver) {
        // Eleven har data -> Blå "Endre" og Oransje "Nullstill"
        rad += `<button class="btn btn-edit" onclick="visModal('${navn}')">Endre</button> `;
        rad += `<button class="btn btn-nullstill" style="margin-left:5px;" onclick="nullstillElev('${navn}')">Nullstill</button>`;
    } else {
        // Eleven mangler data -> Grønn "Registrer" og Rød "Slett"
        rad += `<button class="btn btn-reg" onclick="visModal('${navn}')">Registrer</button> `;
        rad += `<button class="btn btn-slett" style="margin-left:5px;" onclick="slettElev('${navn}')">Slett</button>`;
    }
}
rad += `</td></tr>`;

            // Fordel raden i riktig bunke
            if (erSlettet) {
                slettedeRader += rad;
            } else {
                aktiveRader += rad;
            }
        }
    });

    // Oppdater selve tabellen i HTML
    tBody.innerHTML = aktiveRader + slettedeRader;
}

function nullstillElev(navn) {
    if (confirm(`Vil du tømme alle poeng for ${navn}? Eleven blir stående i listen, men poengene fjernes.`)) {
        // Vi fjerner hele objektet for denne eleven under denne stien
        db.ref(hentSti(navn)).remove()
        .then(() => {
            console.log("Data nullstilt for " + navn);
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
    const eksisterende = lagredeResultater[navn]?.oppgaver || [];

    oppsett.oppgaver.forEach((o, i) => {
        container.innerHTML += `<div class="oppgave-rad">
            <label>${o.navn}:</label>
            <input type="number" class="oppg-input" data-index="${i}" min="0" max="${o.maks}" 
            value="${eksisterende[i] !== undefined ? eksisterende[i] : ""}" style="width:60px">
        </div>`;
    });

    document.getElementById('modal').style.display = 'block';

    // NYTT: Sett fokus på første feltet med en gang
    setTimeout(() => {
        const førsteInput = container.querySelector('.oppg-input');
        if (førsteInput) {
            førsteInput.focus();
            førsteInput.select(); // Markerer tallet så du kan skrive rett over
        }
    }, 100);
}

function lukkModal() { 
    document.getElementById('modal').style.display = 'none'; 
}

function lagreData() {
    const inputs = document.querySelectorAll('.oppg-input');
    let verdier = [], sum = 0;
    inputs.forEach(i => { 
        const v = parseInt(i.value) || 0; 
        verdier.push(v); 
        sum += v; 
    });
    
    // Vi setter slettet: false her for å være sikker på at eleven blir aktiv ved lagring
    db.ref(hentSti(valgtElevId)).update({ 
        oppgaver: verdier, 
        sum: sum, 
        slettet: false,
        dato: new Date().toISOString() 
    }).then(lukkModal);
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
    // 1. Skjul selve admin-panelene
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('chartContainer').style.display = 'none';
    
    // 2. Vis det vanlige innholdet igjen
    document.getElementById('skjemaInnhold').style.display = 'block';
    document.getElementById('hovedTabell').style.display = 'table';
    
    // 3. SKJUL elementer som krever aktive valg
    if (document.getElementById('nyElevSeksjon')) {
        document.getElementById('nyElevSeksjon').style.display = 'none';
    }
    const actionBar = document.querySelector('.action-bar');
    if (actionBar) actionBar.style.display = 'none';

    // 4. NULLSTILLING: Tøm rapport-container og tabell
    const rc = document.getElementById('rapportContainer');
    if (rc) rc.innerHTML = "";
    document.getElementById('tHead').innerHTML = "";
    document.getElementById('tBody').innerHTML = "<tr><td>Velg alle kriterier...</td></tr>";

    // 5. NULLSTILLING: Sett alle menyer tilbake til start
    const filtere = ['mAar', 'mFag', 'mPeriode', 'mTrinn', 'mKlasse'];
    filtere.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.selectedIndex = 0; 
    });

    oppdaterOverskrifter("Velg kriterier for å vise kartlegging");
    db.ref().off(); 
}

async function kjorAdminRapport(type) {
    const aar = document.getElementById('adminAar').value;
    const fag = document.getElementById('adminFag').value;
    const periode = document.getElementById('adminPeriode').value;
    
    // 1. Lag et midlertidig element for utskrift (skjult for skjerm)
    const printDiv = document.createElement('div');
    printDiv.id = 'tempPrintArea';
    printDiv.style.position = 'absolute';
    printDiv.style.left = '-9999px'; // Flytt det utenfor skjermen
    document.body.appendChild(printDiv);

    let samletInnhold = `<h1 style="text-align:center;">${type === 'kritisk' ? 'Kritisk-liste' : 'Årsrapport'} - ${fag} (${aar})</h1>`;
    
    const klasser = ["A", "B", "C", "D"];
    const alleTrinn = ["1", "2", "3", "4", "5", "6", "7"];

    for (let trinn of alleTrinn) {
        for (let klasse of klasser) {
            const oppsett = hentOppsettSpesifikk(aar, fag, periode, trinn);
            if (!oppsett) continue;

            const snapshot = await db.ref(`kartlegging/${aar}/${fag}/${periode}/${trinn}/${klasse}`).once('value');
            const data = snapshot.val() || {};

            let tabellHtml = `<div class="page-break" style="page-break-after: always;">
                <h2 style="text-align:center;">${fag} - ${trinn}${klasse} - ${periode} ${aar}</h2>
                <table border="1" style="width:100%; border-collapse:collapse; margin-bottom:20px;">
                    <thead>
                        <tr><th align="left">Elevnavn</th>`;
            
            oppsett.oppgaver.forEach(o => tabellHtml += `<th>${o.navn}</th>`);
            tabellHtml += `<th>Sum</th></tr></thead><tbody>`;

            let antall = 0;
            const vStartAar = parseInt(aar.split('-')[0]);

            Object.keys(elevRegister).sort().forEach(navn => {
                const e = elevRegister[navn];
                const cTrinn = e.startTrinn + (vStartAar - e.startAar);
                
                if (cTrinn == trinn && e.startKlasse === klasse) {
                    const d = data[navn];
                    const erKritisk = d && d.sum <= oppsett.grenseTotal;
                    if (type === 'kritisk' && (!d || !erKritisk)) return;

                    antall++;
                    tabellHtml += `<tr><td><b>${navn}</b></td>`;
                    if (d && d.oppgaver) {
                        oppsett.oppgaver.forEach((o, i) => {
                            const poeng = d.oppgaver[i] || 0;
                            const bakgrunn = (o.grense !== -1 && poeng <= o.grense) ? 'background-color:#ffcccc' : '';
                            tabellHtml += `<td align="center" style="${bakgrunn}">${poeng}</td>`;
                        });
                        tabellHtml += `<td align="center" style="${erKritisk ? 'background-color:#ffcccc' : ''}">${d.sum}</td>`;
                    } else {
                        oppsett.oppgaver.forEach(() => tabellHtml += `<td align="center">-</td>`);
                        tabellHtml += `<td align="center">-</td>`;
                    }
                    tabellHtml += `</tr>`;
                }
            });

            if (antall > 0) {
                tabellHtml += `</tbody></table></div>`;
                samletInnhold += tabellHtml;
            }
        }
    }

    // 2. Legg innholdet i det midlertidige elementet
    printDiv.innerHTML = samletInnhold;

    // 3. Lagre originalt innhold, bytt ut med rapporten, print, og bytt tilbake
    const originalInnhold = document.body.innerHTML;
    
    // Vi må midlertidig skjule alt annet enn printDiv
    document.getElementById('modalRapport').style.display = 'none';
    
    // Åpne et nytt vindu for print er ofte det tryggeste for styling
    const printVindu = window.open('', '_blank');
    printVindu.document.write(`
        <html>
            <head>
                <title>Utskrift</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    th, td { border: 1px solid black; padding: 5px; }
                    .page-break { page-break-after: always; }
                </style>
            </head>
            <body>${samletInnhold}</body>
        </html>
    `);
    printVindu.document.close();
    printVindu.focus();
    
    // Vent litt så bildene/stiler laster hvis nødvendig
    setTimeout(() => {
        printVindu.print();
        printVindu.close();
        document.body.removeChild(printDiv); // Rydd opp
    }, 500);
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
function forberedPrint() { window.print(); }