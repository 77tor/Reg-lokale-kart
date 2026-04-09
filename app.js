// --- ALLER ØVERST I app.js ---
(function() {
    const kopieringsMotor = function(base64) {
        console.log("KI-funksjon aktivert via sikkerhetslag");
        try {
            const tekst = decodeURIComponent(escape(window.atob(base64)));
            const el = document.createElement('textarea');
            el.value = tekst;
            el.style.position = 'fixed'; // Skjul feltet
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            alert("✨ KI-instruksjon er kopiert!\n\nLim inn i ChatGPT eller Gemini (Ctrl+V).");
        } catch (e) {
            console.error("Feil i kopiering:", e);
        }
    };

    // Vi låser funksjonen til window-objektet så den ikke kan overskrives
    Object.defineProperty(window, 'KI_KOPIER_FIX', {
        value: kopieringsMotor,
        writable: false,
        configurable: false
    });
})();


function fiksGithubLenke(url) {
    if (!url || typeof url !== 'string') return url;

    // 1. Hvis det er en forkortet sti (starter med Oppgavebilder/), legg på hele GitHub-adressen
    if (url.startsWith("Oppgavebilder/")) {
        const brukernavn = "77tor"; // Sjekk at dette er ditt brukernavn
        const repo = "Reg-lokale-kart";
        return `https://raw.githubusercontent.com/${brukernavn}/${repo}/main/${url}`;
    }

    // 2. Hvis det er en vanlig GitHub-lenke med /blob/, gjør den om til raw
    if (url.includes("github.com") && url.includes("/blob/")) {
        return url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/");
    }

    return url;
}


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

async function logout() { 
    // Før vi logger ut, prøver vi å oppdatere loggen med varighet
    const logId = sessionStorage.getItem('currentLogId');
    if (logId) {
        try {
            const utTid = new Date().getTime();
            const snapshot = await db.ref('systemLogg/' + logId).once('value');
            const data = snapshot.val();
            if (data && data.innLogget) {
                const minutter = Math.round((utTid - data.innLogget) / 60000);
                await db.ref('systemLogg/' + logId).update({
                    utLogget: utTid,
                    varighet: minutter + " min"
                });
            }
        } catch (e) { console.log("Kunne ikke oppdatere utlogget-tid"); }
    }
    auth.signOut(); 
}

auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        document.getElementById('userInfo').innerText = user.displayName;

        // 1. Denne ene linjen fikser NÅ alle menyer (mAar, teAar, adminAar, compAar)
        // Den henter år, fyller boksene, og velger riktig skoleår automatisk.
        oppdaterAlleAarsMenyer(); 

        // 2. Loggføring og henting av data
        registrerInnlogging(user); 
        hentRegister(); 
        hentData();     
    } else {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainContent').style.display = 'none';
        sessionStorage.removeItem('currentLogId');
    }
});

// Hjelpefunksjon for å skrive til loggen (hvis du ikke har lagt den til et annet sted ennå)
function registrerInnlogging(user) {
    const loggRef = db.ref('systemLogg').push();
    const innTid = new Date().getTime();
    
    loggRef.set({
        navn: user.displayName || user.email,
        epost: user.email,
        innLogget: innTid,
        utLogget: null,
        varighet: "Aktiv nå"
    });

    // Lagre ID-en lokalt i fanen slik at logout() vet hvilken linje som skal oppdateres
    sessionStorage.setItem('currentLogId', loggRef.key);
}






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
    const vTrinnValgt = parseInt(document.getElementById('mTrinn').value);
    const vKlasse = document.getElementById('mKlasse').value;
    const select = document.getElementById('regElev');
    
    if (!select) return;
    select.innerHTML = '<option value="">-- Velg elev --</option>';

    if (!vAar || isNaN(vTrinnValgt) || !vKlasse) return;
    
    const vStartAarValgt = parseInt(vAar.split('-')[0]);

    Object.keys(elevRegister).sort().forEach(navn => {
        const e = elevRegister[navn];
        
        // Beregn trinn
        const cTrinn = parseInt(e.startTrinn) + (vStartAarValgt - parseInt(e.startAar));

        // --- ENDRET LOGIKK HER ---
        const erRiktigTrinn = (cTrinn === vTrinnValgt);
        const erRiktigKlasse = (e.startKlasse === vKlasse);
        const harBegynt = vStartAarValgt >= parseInt(e.startAar);
        const harIkkeSluttet = !e.sluttAar || vStartAarValgt <= parseInt(e.sluttAar);

        if (erRiktigTrinn && erRiktigKlasse && harBegynt && harIkkeSluttet) {
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
        // Beholder lokale data (fra elever.js) og legger til data fra Firebase
        elevRegister = Object.assign({}, elevRegister, firebaseData);
        
        console.log("Register oppdatert. Totalt antall elever:", Object.keys(elevRegister).length);
        
        // --- NYTT & FORENKLET: ---
        // Denne ene linjen erstatter nå alle manuelle fyllDropdown-kall.
        // Den oppdaterer både hovedmeny, admin-menyer og eksport-menyer.
        oppdaterAlleAarsMenyer();
        
        // Oppdaterer visningen på siden
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
    // Sjekk om oppgaven har bilde for å legge til hover-effekt
    const overskriftInnhold = o.bilde 
        ? `<span class="hjelpe-ikon-tekst">${o.navn}
             <img src="${o.bilde}" class="oppgave-preview-bilde">
           </span>` 
        : o.navn;

    hode += `<th style="text-align:center;">${overskriftInnhold}<br><small>max ${o.maks}</small></th>`;

});

// Vi tvinger cellen til å oppføre seg som en standard tabellcelle og gir den 
hode += `<th>Sum<br><span style="font-weight:normal; font-size:10px; color:black !important; display:block !important;">(Kritisk: ≤${oppsett.grenseTotal})</span></th><th class="no-print">Handling</th></tr>`;

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
        
        // Beregn hvilket trinn eleven går på i det valgte skoleåret
        const cTrinn = parseInt(e.startTrinn) + (vStartAarValgt - parseInt(e.startAar));

        // --- NY LOGIKK FOR FILTRERING ---
        const harBegynt = vStartAarValgt >= parseInt(e.startAar);
        const harIkkeSluttet = !e.sluttAar || vStartAarValgt <= parseInt(e.sluttAar);
        const erRiktigTrinnOgKlasse = (cTrinn === parseInt(vTrinn) && e.startKlasse === vKlasse);

        // Vi tegner bare raden hvis alle kriterier er oppfylt
        if (erRiktigTrinnOgKlasse && harBegynt && harIkkeSluttet) {
            const d = lagredeResultater[navn] || {};
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
        const manglerResultat = Array.from(document.querySelectorAll('#tBody tr')).filter(rad => 
            rad.querySelector('.not-registered')
        );

        if (manglerResultat.length > 0) {
            const valg = confirm(`Det er ${manglerResultat.length} elever uten registrerte resultater...`);
            if (!valg) return;

            // NYTT: Hent riktig oppsett for å vite antall oppgaver
            const oppsett = hentOppsett(); 
            const antallOppgaver = oppsett.oppgaver.length;

            for (let rad of manglerResultat) {
                const elevNavn = rad.cells[0].innerText.trim();
                await db.ref(`kartlegging/${aar}/${fag}/${periode}/${trinn}/${klasse}/${elevNavn}`).update({
                    ikkeGjennomfort: true,
                    sum: 0,
                    oppgaver: new Array(antallOppgaver).fill(0) // Nå dynamisk!
                });
            }
            await hentData(); 
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



// Denne kalles inne i onAuthStateChanged når brukeren er logget inn
function registrerInnlogging(user) {
    const loggRef = db.ref('systemLogg').push();
    const innTid = new Date().getTime();
    
    // Lagre start-tidspunkt
    loggRef.set({
        navn: user.displayName || user.email,
        epost: user.email,
        innLogget: innTid,
        utLogget: null,
        varighet: "Aktiv nå"
    });

    // Lagre ID-en i session slik at vi kan oppdatere når de logger ut
    sessionStorage.setItem('currentLogId', loggRef.key);
}

// Funksjon for å vise loggen i admin-panelet
async function aapneLoggModal() {
    document.getElementById('modalLogg').style.display = 'block';
    const snapshot = await db.ref('systemLogg').once('value');
    const loggData = snapshot.val() || {};
    
    // Sorterer slik at nyeste er først for tabellen
    const loggArray = Object.values(loggData).sort((a, b) => b.innLogget - a.innLogget);
    
    // Lagre dataen globalt så diagram-knappene får tak i den uten å spørre databasen på nytt
    window.gjeldendeLoggData = loggArray;

    const totalt = loggArray.length;
    const sjuDagerSiden = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const sisteUke = loggArray.filter(l => l.innLogget > sjuDagerSiden).length;
    const unikeBrukere = [...new Set(loggArray.map(l => l.epost))].length;

    let html = `
        <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span style="font-weight: bold; font-size: 0.9em; color: #4a5568;">Bruksstatistikk</span>
                <div class="chart-controls" style="display: flex; gap: 5px;">
                    <button onclick="oppdaterLoggDiagram('uke')" id="btnUke" class="btn" style="padding: 4px 10px; font-size: 11px;">Uke</button>
                    <button onclick="oppdaterLoggDiagram('mnd')" id="btnMnd" class="btn" style="padding: 4px 10px; font-size: 11px;">Mnd</button>
                    <button onclick="oppdaterLoggDiagram('aar')" id="btnAar" class="btn" style="padding: 4px 10px; font-size: 11px;">År</button>
                </div>
            </div>
            <div style="height: 200px; position: relative;">
                <canvas id="systemLoggCanvas"></canvas>
            </div>
        </div>

        <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin-bottom: 15px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; text-align: center;">
            <div><small>Totalt antall besøk</small><br><strong>${totalt}</strong></div>
            <div><small>Siste 7 dager</small><br><strong>${sisteUke}</strong></div>
            <div><small>Unike brukere</small><br><strong>${unikeBrukere}</strong></div>
        </div>
        
        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
            <input type="text" id="loggSok" placeholder="Søk på navn eller e-post..." 
                style="flex-grow: 1; margin-bottom: 0;" onkeyup="filtrerLogg()">
            <button class="btn btn-danger" onclick="slettHeleLoggen()" style="font-size: 0.85em;">Tøm logg</button>
        </div>

        <div id="loggTabellContainer" style="max-height: 350px; overflow-y: auto; border: 1px solid #eee; border-radius: 4px;">
            <table id="systemLoggTabell">
                <thead style="position: sticky; top: 0; background: white; z-index: 5;">
                    <tr><th>Bruker</th><th>Innlogget</th><th>Varighet</th></tr>
                </thead>
                <tbody>`;

    if (totalt > 0) {
        loggArray.forEach(log => {
            const dato = new Date(log.innLogget).toLocaleString('no-NO');
            html += `<tr>
                <td style="text-align:left;">${log.navn}<br><small style="color: #666;">${log.epost}</small></td>
                <td>${dato}</td>
                <td><span class="badge">${log.varighet || 'Aktiv'}</span></td>
            </tr>`;
        });
    } else {
        html += `<tr><td colspan="3">Ingen loggføringer funnet.</td></tr>`;
    }

    html += `</tbody></table></div>`;
    document.getElementById('loggListe').innerHTML = html;

    // Tegn diagrammet (venter litt så canvas rekker å bli synlig)
    setTimeout(() => oppdaterLoggDiagram('uke'), 50);
}



let loggChartInstance = null; // Holder styr på diagrammet så vi kan slette det gamle

function oppdaterLoggDiagram(type) {
    const data = window.gjeldendeLoggData || [];
    const ctx = document.getElementById('systemLoggCanvas').getContext('2d');
    const na = new Date();
    
    let labels = [];
    let counts = {};

    if (type === 'uke') {
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(na.getDate() - i);
            const key = d.toLocaleDateString('no-NO', { weekday: 'short', day: 'numeric' });
            labels.push(key);
            counts[key] = 0;
        }
        data.forEach(l => {
            const d = new Date(l.innLogget);
            const key = d.toLocaleDateString('no-NO', { weekday: 'short', day: 'numeric' });
            if (counts[key] !== undefined) counts[key]++;
        });
    } 
    else if (type === 'mnd') {
        // Viser de siste 4 ukene
        for (let i = 3; i >= 0; i--) {
            const key = i === 0 ? "Denne uka" : `Uke -${i}`;
            labels.push(key);
            counts[key] = 0;
        }
        data.forEach(l => {
            const dagerSiden = (na - l.innLogget) / (1000 * 60 * 60 * 24);
            if (dagerSiden < 28) {
                const ukeIndex = 3 - Math.floor(dagerSiden / 7);
                if (labels[ukeIndex]) counts[labels[ukeIndex]]++;
            }
        });
    } 
    else if (type === 'aar') {
        const mndNavn = ["Jan", "Feb", "Mar", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Des"];
        labels = mndNavn;
        mndNavn.forEach(m => counts[m] = 0);
        data.forEach(l => {
            const d = new Date(l.innLogget);
            if (d.getFullYear() === na.getFullYear()) {
                counts[mndNavn[d.getMonth()]]++;
            }
        });
    }

    // Ødelegg gammelt diagram hvis det finnes
    if (loggChartInstance) loggChartInstance.destroy();

    // Lag nytt diagram
    loggChartInstance = new Chart(ctx, {
        type: 'bar', // 'bar' fungerer ofte best for pålogginger, men 'line' er også fint
        data: {
            labels: labels,
            datasets: [{
                label: 'Besøk',
                data: labels.map(l => counts[l]),
                backgroundColor: '#3498db',
                borderRadius: 4,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: { display: false } // Skjuler tall over stolpene for renere design
            },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } },
                x: { grid: { display: false } }
            }
        }
    });

    // Oppdater knappestiler (hvilken som er aktiv)
    ['btnUke', 'btnMnd', 'btnAar'].forEach(id => {
        const btn = document.getElementById(id);
        const isActive = id === 'btn' + type.charAt(0).toUpperCase() + type.slice(1);
        btn.style.background = isActive ? '#2980b9' : '#bdc3c7';
        btn.style.color = 'white';
    });
}


// --- 3. FUNKSJON FOR SØKING I TABELLEN ---
function filtrerLogg() {
    const input = document.getElementById("loggSok");
    const filter = input.value.toUpperCase();
    const table = document.getElementById("systemLoggTabell");
    const tr = table.getElementsByTagName("tr");

    for (let i = 1; i < tr.length; i++) {
        let td = tr[i].getElementsByTagName("td")[0];
        if (td) {
            let txtValue = td.textContent || td.innerText;
            tr[i].style.display = txtValue.toUpperCase().indexOf(filter) > -1 ? "" : "none";
        }
    }
}

// --- 4. FUNKSJON FOR Å SLETTE LOGGEN ---
async function slettHeleLoggen() {
    if (confirm("Er du helt sikker på at du vil slette ALL innloggingshistorikk? Dette kan ikke angres.")) {
        await db.ref('systemLogg').remove();
        alert("Loggen er slettet.");
        aapneLoggModal(); // Oppdaterer visningen
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

    // Her gjør vi selve navnet til en "hjelpe-ikon"-trigger hvis bilde finnes
    const navnMedHjelp = o.bilde 
        ? `<span class="hjelpe-ikon-tekst">${o.navn} ℹ️
             <img src="${o.bilde}" class="oppgave-preview-bilde">
           </span>` 
        : o.navn;

    container.innerHTML += `
        <div class="oppgave-rad" style="margin-bottom:12px; ${stil} display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dotted #eee; padding-bottom: 5px;">
            <label style="cursor: help;">
                ${navnMedHjelp}:
            </label>
            <input type="number" class="oppg-input" data-index="${i}" min="0" max="${o.maks}" 
            value="${eksisterende[i] !== undefined ? eksisterende[i] : ""}" 
            ${deaktivert} style="width:65px; padding: 5px; text-align: center;">
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

function finnRelevanteSider(rentTrinnNummer, oppgaveNavn) {
    const trinnNokkel = "trinn" + rentTrinnNummer;
    const data = matteData[trinnNokkel];
    if (!data) return "Ingen data for dette trinnet.";

    let funn = [];
    const sokeOrd = oppgaveNavn.toLowerCase().split(" ");

    // Gå gjennom alle bøkene for trinnet (grunnbokA, grunnbokB, ovebok)
    ["grunnbokA", "grunnbokB", "ovebok"].forEach(bokType => {
        if (data[bokType]) {
            data[bokType].innhold.forEach(kap => {
                kap.emner.forEach(emne => {
                    // Sjekk om noen av ordene i oppgaven finnes i emnenavnet
                    const match = sokeOrd.some(ord => ord.length > 3 && emne.navn.toLowerCase().includes(ord));
                    if (match) {
                        funn.push(`${data[bokType].tittel}: Kap ${kap.kapittel} - "${emne.navn}" (Side ${emne.side})`);
                    }
                });
            });
        }
    });

    return funn.length > 0 ? funn.join("\n") : "Fant ingen direkte treff i innholdsfortegnelsen.";
}

// --- KOMBINERT ANALYSE-KODE (Rettet versjon med alle sjekker) ---
async function genererKlasseAnalyse() {
    try { 
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
const firebaseData = snapshot.val() || {};

const vStartAarValgt = parseInt(aar.split('-')[0]);

// Filtrer elever slik at vi kun analyserer de som faktisk "eksisterer" dette året i registeret
let elever = Object.keys(firebaseData).filter(navn => {
    const e = elevRegister[navn];
    if (!e) return false; // Eleven finnes ikke i registeret

    const cTrinn = parseInt(e.startTrinn) + (vStartAarValgt - parseInt(e.startAar));
    const harBegynt = vStartAarValgt >= parseInt(e.startAar);
    const harIkkeSluttet = !e.sluttAar || vStartAarValgt <= parseInt(e.sluttAar);
    const erRiktigTrinn = cTrinn === parseInt(trinn);

    return erRiktigTrinn && harBegynt && harIkkeSluttet && 
           firebaseData[navn].oppgaver && 
           !firebaseData[navn].slettet && 
           !firebaseData[navn].ikkeGjennomfort;
});
        // 4. Beregn statistikk
        let antall = elever.length;
        let oppgaveSummer = new Array(oppsett.oppgaver.length).fill(0);
        let totalSumKlasse = 0;
        let kritiskeElever = [];

        const totalMaksMulig = oppsett.oppgaver.reduce((sum, o) => sum + (o.maks || 0), 0);

// 1. Sørg for at du bruker riktig kilde (sannsynligvis lagredeResultater)
elever.forEach(navn => {
    // ENDRET: Bruk lagredeResultater (eller det navnet du har definert lenger opp)
    const d = lagredeResultater[navn] || {}; 

    // 2. SIKKERHETSSJEKK: Hopp over hvis eleven mangler data eller er slettet
    if (!d.oppgaver || d.slettet) return;

    // 3. Kjør loopen bare hvis d.oppgaver faktisk eksisterer
    d.oppgaver.forEach((p, i) => {
        // Sjekk at indexen i finnes i oppgaveSummer før addisjon
        if (oppgaveSummer[i] !== undefined) {
            oppgaveSummer[i] += (parseFloat(p) || 0);
        }
    });

    totalSumKlasse += (parseFloat(d.sum) || 0);

    // 4. Sjekk mot kritisk grense
    if (parseFloat(d.sum) <= oppsett.grenseTotal) {
        kritiskeElever.push({
            navn: navn, 
            oppgaver: d.oppgaver, 
            sum: d.sum
        });
    }
});

        const totalKlasseSnittProsent = ((totalSumKlasse / antall) / totalMaksMulig) * 100;

        // --- DEFINER FELLES TOPPTEKST OG MALER ---
        const malForFag = analyseMaler[fag];
        const malForTrinn = malForFag ? malForFag[trinn] : null;
        const gjeldendeMalTabell = malForTrinn ? malForTrinn[periode] : null;
        
        const sideTittel = `Analyse: ${fag} - ${trinn}${klasse} (${periode} ${aar})`;
        const fellesHeader = `<div class="side-header">${sideTittel}</div>`;

// --- SIDE 1: HOVEDANALYSE OG TABELL ---
let htmlSide1 = fellesHeader;
// Overskrift 1 - Nå som h2 og sentrert
htmlSide1 += `<h2 style="text-align:center; color:#2c3e50; margin-top:0;">Gjennomsnittlig skår per oppgave (%)</h2>`;
htmlSide1 += `<div class="chart-container">`;

// Viktig: Denne tomme div-en lager avstand på venstre side slik at første søyle ikke klistrer seg til kanten
htmlSide1 += `<div style="width: 50px;"></div>`; 

oppsett.oppgaver.forEach((o, i) => {
    const snitt = oppgaveSummer[i] / antall;
    const prosent = (snitt / o.maks) * 100;
    const grenseProsent = (o.grense / o.maks) * 100;
    
    htmlSide1 += `
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
htmlSide1 += `
    <div class="bar-wrapper total">
        <div class="bar-value">${totalKlasseSnittProsent.toFixed(0)}%</div>
        <div class="bar-track">
            <div class="bar-fill total-fill" style="height: ${totalKlasseSnittProsent}%"></div>
            <div class="target-line" style="bottom: ${totalGrenseProsent}%"></div>
        </div>
        <div class="bar-label"><b>TOTAL</b></div>
    </div></div>`;

// Overskrift 2 - Nå også som h2, sentrert og med litt luft over
htmlSide1 += `<h2 style="text-align:center; color:#2c3e50; margin-top:30px;">Klassens resultater vs Maks-skår</h2>`;

htmlSide1 += `<table><thead><tr><th class="col-navn">Oppgave</th>`;
oppsett.oppgaver.forEach((o, i) => {
    let visningsNavn = (gjeldendeMalTabell && gjeldendeMalTabell.oppgaver && gjeldendeMalTabell.oppgaver[i + 1]) 
        ? gjeldendeMalTabell.oppgaver[i + 1].navn : o.navn;
    htmlSide1 += `<th>${visningsNavn}</th>`;
});
htmlSide1 += `<th class="col-sum">TOTAL</th></tr></thead><tbody>
    <tr><td class="col-navn"><b>Maks poeng</b></td>`;
    oppsett.oppgaver.forEach(o => htmlSide1 += `<td>${o.maks}</td>`);
    htmlSide1 += `<td class="col-sum"><b>${totalMaksMulig}</b></td></tr>
    <tr><td class="col-navn"><b>Snitt (poeng)</b></td>`;
    oppgaveSummer.forEach(s => htmlSide1 += `<td>${(s/antall).toFixed(1)}</td>`);
    htmlSide1 += `<td class="col-sum"><b>${(totalSumKlasse/antall).toFixed(1)}</b></td></tr>
    <tr><td class="col-navn"><b>I % av maks</b></td>`;
    oppgaveSummer.forEach((s, i) => htmlSide1 += `<td>${((s/antall)/oppsett.oppgaver[i].maks*100).toFixed(0)}%</td>`);
    htmlSide1 += `<td class="col-sum"><b>${totalKlasseSnittProsent.toFixed(0)}%</b></td></tr>
</tbody></table>`;


// --- SIDE 2: ELEVOVERSIKT (Optimalisert for mange oppgaver) ---
let htmlSide2 = fellesHeader;
htmlSide2 += `<h2 style="text-align:center; color:#2c3e50; margin-top:0;">Elevoversikt - Oppfølging og Mestring</h2>`;

// 1. Under kritisk grense
htmlSide2 += `<h3 style="color:red; margin: 10px 0 5px 0; font-size: 1.1em; text-align:center;">Under kritisk grense (Sum ≤ ${oppsett.grenseTotal})</h3>`;
if (kritiskeElever.length > 0) {
    htmlSide2 += `<table class="kompakt-tabell"><thead><tr><th class="col-navn">Navn</th>`;
    oppsett.oppgaver.forEach((o, i) => {
        let visningsNavn = (gjeldendeMalTabell && gjeldendeMalTabell.oppgaver && gjeldendeMalTabell.oppgaver[i + 1]) ? gjeldendeMalTabell.oppgaver[i + 1].navn : o.navn;
        htmlSide2 += `<th>${visningsNavn}</th>`; 
    });
    htmlSide2 += `<th class="col-sum">Sum</th></tr></thead><tbody>`;
    
    kritiskeElever.sort((a,b) => a.sum - b.sum).forEach(e => {
        htmlSide2 += `<tr><td class="col-navn"><b>${e.navn}</b></td>`;
        e.oppgaver.forEach((p, i) => {
            const o = oppsett.oppgaver[i];
            const stil = (o.grense !== -1 && p <= o.grense) ? 'style="background:#ffcccc"' : '';
            htmlSide2 += `<td ${stil}>${p}</td>`;
        });
        htmlSide2 += `<td class="col-sum" style="background:#ffcccc; font-weight:bold;">${e.sum}</td></tr>`;
    });
    htmlSide2 += `</tbody></table>`;
} else {
    htmlSide2 += `<p style="text-align:center;">Ingen under kritisk grense.</p>`;
}

// 2. Lav mestring - ENDRET FRA 65 TIL 70
let eleverUnder70 = elever.map(n => ({navn: n, sum: firebaseData[n].sum, prosent: (firebaseData[n].sum / totalMaksMulig) * 100}))
                          .filter(e => e.prosent < 70 && e.sum > oppsett.grenseTotal); // Endret her

htmlSide2 += `<h3 style="color:#e67e22; margin: 15px 0 5px 0; font-size: 1.1em; text-align:center;">Lav mestring (Total skår < 70%)</h3>`; // Endret her
if (eleverUnder70.length > 0) {
    htmlSide2 += `<table class="kompakt-tabell"><thead><tr><th class="col-navn">Navn</th><th class="col-tall">Poeng</th><th class="col-tall">Prosent</th></tr></thead><tbody>`;
    eleverUnder70.sort((a, b) => a.sum - b.sum).forEach(e => {
        htmlSide2 += `<tr><td class="col-navn"><b>${e.navn}</b></td><td class="col-tall">${e.sum}</td><td class="col-tall" style="background:#fff3e0; font-weight:bold;">${e.prosent.toFixed(1)}%</td></tr>`;
    });
    htmlSide2 += `</tbody></table>`;
} else {
    htmlSide2 += `<p style="text-align:center;">Ingen ytterligere elever under 70%.</p>`; // Endret her
}

// 3. Høy mestring
let topper = elever.map(n => ({navn: n, sum: firebaseData[n].sum, prosent: (firebaseData[n].sum / totalMaksMulig) * 100}))
                   .filter(e => e.prosent >= 95);

htmlSide2 += `<h3 style="color:#27ae60; margin: 15px 0 5px 0; font-size: 1.1em; text-align:center;">Høy mestring (Total skår ≥ 95%)</h3>`;
if (topper.length > 0) {
    htmlSide2 += `<table class="kompakt-tabell"><thead><tr><th class="col-navn">Navn</th><th class="col-tall">Poeng</th><th class="col-tall">Prosent</th></tr></thead><tbody>`;
    topper.sort((a, b) => b.sum - a.sum).forEach(e => {
        htmlSide2 += `<tr><td class="col-navn"><b>${e.navn}</b></td><td class="col-tall">${e.sum}</td><td class="col-tall" style="background:#e8f5e9; font-weight:bold;">${e.prosent.toFixed(0)}%</td></tr>`;
    });
    htmlSide2 += `</tbody></table>`;
} else {
    htmlSide2 += `<p style="text-align:center;">Ingen elever over 95%.</p>`;
}


// --- SIDE 3: ULTRA-KOMPAKT DETALJANALYSE (Med bilde-støtte i KI-prompt) ---
let htmlSide3 = fellesHeader; 
htmlSide3 += `<div class="analyse-side-3">`; 

htmlSide3 += `<h2 style="text-align:center; color:#2c3e50; margin-top:0;">Områder klassen skårer under kritisk grense eller under 65%</h2>`;

htmlSide3 += `
    <div style="display: grid; grid-template-columns: 1fr auto; gap: 20px; padding: 10px 15px; background: #eee; font-weight: bold; border-radius: 4px; margin-bottom: 5px; font-size: 0.85em;">
        <div>OMRÅDE / PEDAGOGISK FOKUS</div>
        <div style="text-align: right;">TILTAK</div>
    </div>`;

let harSvakheter = false;

if (gjeldendeMalTabell && gjeldendeMalTabell.oppgaver) {
    const headerTekst = fellesHeader.toLowerCase();
    const erLesing = headerTekst.includes("lesing");
    
    oppsett.oppgaver.forEach((o, i) => {
        const snitt = oppgaveSummer[i] / antall;
        const prosent = (snitt / o.maks) * 100;
        const malInfo = gjeldendeMalTabell.oppgaver[i + 1]; 

        if ((prosent < 65 || (o.grense !== -1 && snitt <= o.grense)) && malInfo) {
            harSvakheter = true; 
            let farge = (o.grense !== -1 && snitt <= o.grense) ? "#c0392b" : "#d35400";
            const rentTrinnNummer = parseInt(trinn.replace(/\D/g, '')); 
            
            // --- SØKELOGIKK ---
            let oppgaveNavn = malInfo.navn.toLowerCase();
            let søkeBegreper = [oppgaveNavn];

            if (oppgaveNavn.includes("klokk") || oppgaveNavn.includes("tid")) {
                søkeBegreper.push("Tid", "tid", "Halve timer", "Dager og måneder", "Klokkeslett");
            }
            if (oppgaveNavn.includes("meter") || oppgaveNavn.includes("cm") || oppgaveNavn.includes("lengde")) {
                søkeBegreper.push("Måling", "Lengde", "Måle lengde");
            }
            if (oppgaveNavn.includes("pluss") || oppgaveNavn.includes("addisjon")) {
                søkeBegreper.push("Addisjon", "Addisjon og subtraksjon");
            }
            if (oppgaveNavn.includes("minus") || oppgaveNavn.includes("subtraksjon")) {
                søkeBegreper.push("Subtraksjon", "Addisjon og subtraksjon");
            }

            const hentRef = (t) => {
                let funnet = [];
                søkeBegreper.forEach(ord => {
                    let r = finnRelevanteSider(t, ord);
                    if (r && r.trim() !== "" && !r.toLowerCase().includes("ingen direkte treff")) {
                        funnet.push(r);
                    }
                });
                return funnet.length > 0 ? [...new Set(funnet)].join(", ") : null;
            };

            let bokReferanser = hentRef(rentTrinnNummer);
            let bokInfoTekst = `Relevante sider i Multi for ${rentTrinnNummer}. trinn:`;

            if (!bokReferanser) {
                let alleFunneReferanser = [];
                for (let t = 1; t <= 7; t++) {
                    if (t === rentTrinnNummer) continue;
                    let ref = hentRef(t);
                    if (ref) alleFunneReferanser.push(`${t}. trinn: ${ref}`);
                }
                if (alleFunneReferanser.length > 0) {
                    bokReferanser = alleFunneReferanser.join('\\n');
                    bokInfoTekst = `Ingen treff på ${rentTrinnNummer}. trinn. Du finner temaet her:`;
                } else {
                    bokReferanser = "Fant ingen spesifikke sidetall i Multi 1-7.";
                    bokInfoTekst = "Boksøk:";
                }
            }

            // --- KI PROMPT MED BILDE-STØTTE ---
            const bildeUrl = o.bilde ? fiksGithubLenke(o.bilde) : "";
            
            // Her bygger vi prompten dynamisk basert på om bilde eksisterer
            let kiPrompt = `Jeg er lærer og klassen min trenger ekstra trening på dette området: "${malInfo.navn}".\nPedagogisk forklaring: ${malInfo.forklaring}.\n\n`;
            if (bildeUrl) {
                kiPrompt += `1. Kan du se på dette bildet av den opprinnelige oppgaven: ${bildeUrl}\n2. Lag 5 lignende oppgaver basert på stilen og innholdet i bildet.\n\n`;
            } else {
                kiPrompt += `Lag 5 varierte oppgaver som trener dette målet.\n\n`;
            }
            kiPrompt += `Tilpass alt til ${rentTrinnNummer}. trinn.`;

            const safePrompt = btoa(unescape(encodeURIComponent(kiPrompt)));
            const safeBokReferanser = btoa(unescape(encodeURIComponent(bokReferanser)));
            const safeBokTittel = btoa(unescape(encodeURIComponent(bokInfoTekst)));

            htmlSide3 += `
            <div style="display: grid; grid-template-columns: 1fr auto; align-items: center; padding: 8px 15px; border-bottom: 1px solid #eee; font-size: 0.85em; background: white;">
                <div style="padding-right: 15px;">
                    <strong style="color: ${farge};">${malInfo.navn}</strong> 
                    <span style="color: #666;">(${prosent.toFixed(1)}%)</span> — 
                    <span style="color: #888; font-style: italic;">${malInfo.forklaring}</span>
                </div>
                
                <div style="display: flex; gap: 5px; flex-shrink: 0;">
                        ${bildeUrl ? `
                            <span class="bilde-container">
                                <a href="${bildeUrl}" target="_blank" title="Se oppgave" style="text-decoration:none; padding: 2px 5px; border: 1px solid #ccc; border-radius:3px; background:#f9f9f9;">👁️</a>
                                <img src="${bildeUrl}" class="hover-bilde" alt="Oppgavebilde">
                            </span>` : ''}

// --- KI-knappen med hover-effekt ---
<button title="Ved klikk på 'KI', genereres en prompt som kan limes inn i Copilot." 
    onclick="(function(btn){ 
        const promptTekst = decodeURIComponent(escape(window.atob('${safePrompt}')));
        navigator.clipboard.writeText(promptTekst).then(() => {
            btn.innerText = '✅';
            const encodedPrompt = encodeURIComponent(promptTekst);
            const copilotUrl = 'https://copilot.microsoft.com/?q=' + encodedPrompt;
            window.open(copilotUrl, '_blank');
            setTimeout(() => { btn.innerText = 'KI'; }, 2000);
        });
    })(this)" 
    class="no-print" 
    style="cursor:pointer; border:1px solid #8e44ad; background:white; color:#8e44ad; border-radius:3px; padding: 2px 5px; font-weight:bold; min-width:35px;">
    KI
</button>

// --- BOK-knappen med hover-effekt ---
${!erLesing ? `
    <button title="Ved klikk på 'BOK', får du opp forslag til hvor en kan finne temaet i Multi" 
        onclick="(function(){
            alert(decodeURIComponent(escape(window.atob('${safeBokTittel}'))) + '\\n\\n' + decodeURIComponent(escape(window.atob('${safeBokReferanser}'))));
        })()" 
        class="no-print" 
        style="cursor:pointer; border:1px solid #2980b9; background:white; color:#2980b9; border-radius:3px; padding: 2px 5px; font-weight:bold; min-width:45px;">
        BOK
    </button>
                    ` : ''}
                </div>
            </div>`;
        }
    });
}

if (!harSvakheter) {
    htmlSide3 += `<p style="text-align:center; color:green; padding:20px;">Stabilt høyt nivå på alle områder.</p>`;
}

htmlSide3 += `</div>`;

// --- SIDE 4: UTVIKLING OVER TID (Oppdatert med Prøve-snitt logikk) ---
let htmlSide4 = fellesHeader + `<h2 style="text-align:center; color:#2c3e50; margin-top:0;">Utvikling over tid</h2>`;
try {
    const histSnap = await db.ref(`kartlegging`).once('value');
    const alleData = histSnap.val() || {};
    let historikkRader = [];

    for (const aKey of Object.keys(alleData)) {
        if (aKey > aar) continue;
        const fData = alleData[aKey][fag];
        if (!fData) continue;

        for (const pKey of Object.keys(fData)) {
            if (aKey === aar && pKey === "Vår" && periode === "Høst") continue;
            const trinnData = fData[pKey][trinn];
            if (!trinnData) continue;

            const aOppsett = oppgaveStruktur[aKey] ? oppgaveStruktur[aKey][fag][pKey][trinn] : null;
            if (!aOppsett) continue;
            const aMaks = aOppsett.oppgaver.reduce((s, o) => s + (o.maks || 0), 0);

            let klasseSum = 0; let klasseAntall = 0; 
            let klasseKritiske = 0; let klasseLavMestring = 0; 
            let totalProveSum = 0; let totalProveAntall = 0; // Samler data for alle klasser

            const historiskStartAar = parseInt(aKey.split('-')[0]);

            Object.keys(trinnData).forEach(kNavn => {
                const kData = trinnData[kNavn];
                
                const kElever = Object.keys(kData).filter(n => {
                    const e = elevRegister[n];
                    if (!e) return false; 

                    const harBegynt = historiskStartAar >= parseInt(e.startAar);
                    const harIkkeSluttet = !e.sluttAar || historiskStartAar <= parseInt(e.sluttAar);
                    
                    return kData[n].oppgaver && !kData[n].slettet && harBegynt && harIkkeSluttet;
                });
                
                kElever.forEach(n => {
                    const eSum = kData[n].sum || 0;
                    const eProsent = (eSum / aMaks) * 100;
                    
                    // Legger til i totalsnittet for denne prøven (alle klasser)
                    totalProveSum += eSum;
                    totalProveAntall++;

                    if (kNavn === klasse) {
                        klasseSum += eSum;
                        klasseAntall++;
                        
                        if (eSum <= aOppsett.grenseTotal) {
                            klasseKritiske++;
                        } else if (eProsent < 65) {
                            klasseLavMestring++;
                        }
                    }
                });
            });

            if (klasseAntall > 0) {
                historikkRader.push({ 
                    visning: `${pKey} ${aKey}`, 
                    klasseProsent: ((klasseSum / klasseAntall) / aMaks) * 100,
                    proveProsent: ((totalProveSum / totalProveAntall) / aMaks) * 100, // Snitt av alle i alle klasser
                    kritiske: klasseKritiske, 
                    lavMestring: klasseLavMestring,
                    sort: aKey + (pKey === "Høst" ? "1" : "2")
                });
            }
        }
    }
    
    historikkRader.sort((a,b) => a.sort.localeCompare(b.sort));

    if (historikkRader.length > 0) {
        htmlSide4 += `
            <table>
                <thead>
                    <tr>
                        <th>Periode</th>
                        <th>Klasse (%)</th>
                        <th>Prøve (%)</th>
                        <th>Diff.</th>
                        <th>Lav mestring</th>
                        <th>Under kritisk grense</th>
                    </tr>
                </thead>
                <tbody>`;

        historikkRader.forEach(r => {
            const aktiv = r.visning === `${periode} ${aar}` ? 'style="background:#e8f4fd; font-weight:bold;"' : '';
            const diff = r.klasseProsent - r.proveProsent;
            
            htmlSide4 += `
                <tr ${aktiv}>
                    <td>${r.visning}</td>
                    <td>${r.klasseProsent.toFixed(1)}%</td>
                    <td style="color:#666;">${r.proveProsent.toFixed(1)}%</td>
                    <td style="color:${diff >= 0 ? 'green':'red'}; font-weight:bold;">${diff >= 0 ? '+':''}${diff.toFixed(1)}%</td>
                    <td>${r.lavMestring}</td>
                    <td style="${r.kritiske > 0 ? 'color:red; font-weight:bold;' : ''}">${r.kritiske}</td>
                </tr>`;
        });
        htmlSide4 += `</tbody></table>`;

        const siste = historikkRader[historikkRader.length - 1];
        let utviklingTekst = "Første måling.";
        let utviklingFarge = "#2980b9";

        if (historikkRader.length > 1) {
            const forrige = historikkRader[historikkRader.length - 2];
            const endring = siste.klasseProsent - forrige.klasseProsent;
            if (endring > 3) { utviklingTekst = `<b>Fremgang:</b> +${endring.toFixed(1)}% siden ${forrige.visning}.`; utviklingFarge = "#27ae60"; }
            else if (endring < -3) { utviklingTekst = `<b>Nedgang:</b> ${endring.toFixed(1)}% siden ${forrige.visning}.`; utviklingFarge = "#e67e22"; }
            else { utviklingTekst = `Stabil utvikling siden ${forrige.visning}.`; }
        }

        const diffMotProve = siste.klasseProsent - siste.proveProsent;
        let sammenligningTekst = diffMotProve > 2 ? `Klassen presterer over gjennomsnittet for denne prøven.` : (diffMotProve < -2 ? `Klassen presterer under gjennomsnittet for denne prøven.` : `Klassen følger snittet for prøven.`);

        htmlSide4 += `
            <div style="margin-top:20px; display: flex; gap: 15px;">
                <div style="flex: 1; padding:12px; border-left:5px solid ${utviklingFarge}; background:#f9f9f9;">
                    <h4 style="margin:0 0 5px 0;">Intern utvikling</h4><p style="margin:0; font-size:13px;">${utviklingTekst}</p>
                </div>
                <div style="flex: 1; padding:12px; border-left:5px solid #2c3e50; background:#f9f9f9;">
                    <h4 style="margin:0 0 5px 0;">Mot prøvesnitt</h4><p style="margin:0; font-size:13px;">${sammenligningTekst}</p>
                </div>
            </div>`;

        if (siste.kritiske > 0 && siste.visning === `${periode} ${aar}`) {
            htmlSide4 += `<div style="margin-top:15px; padding:10px; background:#fff5f5; border:1px solid #feb2b2; border-radius:5px; text-align:center; color:#c53030; font-size:13px;">⚠️ <b>OBS:</b> Det er ${siste.kritiske} elever under kritisk grense i denne perioden.</div>`;
        }
    } else {
        htmlSide4 += `<p style="text-align:center;">Ingen historikk funnet.</p>`;
    }
} catch(err) {
    console.error("Side 4 feil:", err);
    htmlSide4 += `<p>Kunne ikke laste historikk.</p>`;
}
// --- SIDE 4 FERDIG ---

// --- GENERER ENDELIG HTML ---
        const win = window.open('', '_blank');
        const f_clean = fag.toLowerCase(); 
        const t_clean = trinn.replace(/\D/g, ''); 
        const p_clean = periode.charAt(0).toUpperCase(); // H eller V
        const oppgaveSti = `Oppgaver/Kartlegging_${f_clean}_${t_clean}_${p_clean}.pdf`;
        const fasitSti = `Fasit/Kartlegging_${f_clean}_${t_clean}_${p_clean}_Fasit.pdf`;
        const harFasit = !(f_clean === "lesing" && t_clean === "1" && p_clean === "H");

        // VIKTIG: Her tildeler vi strengen til variabelen fullHtml
        const fullHtml = `
            <html>
            <head>
                <title>Analyse ${trinn}${klasse}</title>
<style>
    @page { size: A4 landscape; margin: 0; }
    body { font-family: sans-serif; background:#f0f2f5; margin:0; padding:20px; display:flex; flex-direction:column; align-items:center; }
    .analyse-section { 
        background:white; width:297mm; height:210mm; padding:10mm 12mm; 
        margin-bottom:30px; box-shadow:0 4px 15px rgba(0,0,0,0.15); 
        box-sizing:border-box; page-break-after:always; position: relative; overflow: hidden;
    }
    .side-header { border-bottom:2px solid #2c3e50; margin-bottom:15px; font-size:16px; font-weight:bold; color:#2c3e50; }

    /* --- VIKTIG ENDRING FOR Å HOLDE TABELLEN INNENFOR ARKET --- */
    table { 
        width: 100%; 
        border-collapse: collapse; 
        margin-bottom: 15px; 
        table-layout: fixed; /* Tvinger tabellen til å holde seg innenfor arkets bredde */
    }
    th, td { 
        border: 1px solid #333; 
        padding: 4px 2px; 
        text-align: center; 
        font-size: 9px; /* Litt mindre skrift gir plass til flere kolonner */
        overflow: hidden; /* Skjuler tekst som går utenfor cellen */
    }
    th { background: #f8f9fa; }

    /* Justert navnekolonne (litt smalere for å gi plass til oppgaver) */
    .col-navn { 
        width: 180px !important; 
        text-align: left !important; 
        white-space: nowrap; 
        text-overflow: ellipsis; 
        padding-left: 8px !important;
    }

    /* Statisk bredde for tall/prosent-kolonner (f.eks. Side 2) */
    .col-tall { 
        width: 60px !important; 
    }


/* Legg gjerne til dette i <style> blokken din */
.analyse-side-3 div[style*="display: grid"]:hover {
    background-color: #fcfcfc !important;
}

/* Sørg for at overskriften på side 3 ikke blir med på neste side ved et uhell */
.analyse-side-3 {
    page-break-inside: avoid;
}

.hover-bilde {
    display: none; /* Skjult som standard */
    position: absolute;
    z-index: 100;
    border: 3px solid #2c3e50;
    border-radius: 8px;
    background: white;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    width: 400px; /* Juster størrelsen på forhåndsvisningen her */
    left: 20px;
    top: 25px;
}
/* Vis bildet ved hover på skjerm */
.bilde-container:hover .hover-bilde {
    display: block;
}
    /* Brukes for alle oppgave-kolonner slik at de deler resten av plassen */
    .col-oppgave {
        width: auto;
    }
    /* -------------------------------------------------------- */

    .chart-container { display:flex; height:200px; align-items:flex-end; border-bottom:2px solid #333; margin-bottom:50px; padding-bottom: 30px; }
    .bar-wrapper { flex:1; display:flex; flex-direction:column; align-items:center; position:relative; }
    .bar-track { 
    background: #eee; 
    width: 35px; /* Endret fra 20px til 35px for tykkere søyler */
    height: 150px; 
    position: relative; 
    border: 1px solid #ccc; 
    display: flex; 
    flex-direction: column-reverse; 
    margin: 0 auto; /* Sikrer at søylen sentreres i sitt område */
}
    .bar-fill { background:#3498db; width:100%; }
    .total-fill { background:#2ecc71; }
    .target-line { position:absolute; width:100%; border-top:2px dashed red; z-index:5; }
    .bar-label { font-size:8px; margin-top:10px; font-weight:bold; }
    .toolbar { margin-bottom:20px; background:white; padding:10px; border-radius:50px; display:flex; gap:10px; box-shadow:0 2px 5px rgba(0,0,0,0.1); position: sticky; top: 0; z-index: 1000; }
    .btn-tool { padding:8px 15px; border-radius:5px; text-decoration:none; font-weight:bold; color:white !important; border:none; cursor:pointer; font-size:12px; }
    .btn-grey { background: #95a5a6; }
    
    @media print { 
        .toolbar { display:none; } 
        body { background: white; padding:0; } 
/* Skjul KI-knappene ved utskrift, da de ikke gir mening på papir */
    .btn { display: none !important; }
    /* Sørg for at de røde boksene på side 3 ikke blir grå (tving farger) */
    .analyse-section { -webkit-print-color-adjust: exact; }
.hover-bilde {
        display: none !important;}
        .analyse-section { box-shadow:none; margin:0; width: 297mm; height: 210mm; } 
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } 
    }
</style>
            </head>
            <body>
                <div class="toolbar">
                    <button onclick="window.print()" style="background:#2980b9;" class="btn-tool">🖨️ Skriv ut / Lagre PDF</button>
                    <a href="${oppgaveSti}" target="_blank" style="background:#8e44ad;" class="btn-tool">📄 Se prøve</a>
                    ${harFasit ? `<a href="${fasitSti}" target="_blank" style="background:#2c3e50;" class="btn-tool">✅ Se fasit</a>` : ''}
                    <button onclick="window.close()" class="btn-tool btn-grey">Lukk</button>
                </div>
                <div class="analyse-section">${htmlSide1}</div>
                <div class="analyse-section">${htmlSide2}</div>
                <div class="analyse-section">${htmlSide3}</div>
                <div class="analyse-section">${htmlSide4}</div>
            </body>
            </html>`;

        win.document.write(fullHtml);
        win.document.close();

    } catch (error) {
        console.error("Feil i analyse-generering:", error);
        alert("Feil: " + error.message);
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
        document.getElementById('tBody').innerHTML = "";
        
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
    
    // 2. Sørg for at registreringsskjemaet er synlig
    document.getElementById('skjemaInnhold').style.display = 'block';
    
    // 3. Nullstill tabellen
    document.getElementById('tHead').innerHTML = "";
    document.getElementById('tBody').innerHTML = "<tr><td colspan='100%'>Velg alle kriterier...</td></tr>";

    // --- ENDRING HER: Nullstill filtere, men sett ÅR korrekt ---
    const filtere = ['mFag', 'mPeriode', 'mTrinn', 'mKlasse'];
    filtere.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.selectedIndex = 0; // Setter Fag, Periode osv. til "Velg..."
    });

    // Spesialhåndtering for ÅR:
    // I stedet for index 0, tvinger vi den til å bruke Global_aar (som er 2025-2026)
    const aarMeny = document.getElementById('mAar');
    if (aarMeny) {
        // Vi kjører oppdateringen av menyer først for å være sikre på at alt er fylt
        oppdaterAlleAarsMenyer(); 
        // Deretter setter vi verdien til det globale året
        aarMeny.value = Global_aar; 
    }

    // 4. Skjul seksjoner
    if (document.getElementById('nyElevSeksjon')) {
        document.getElementById('nyElevSeksjon').style.display = 'none';
    }
    
    const actionBar = document.querySelector('.action-bar');
    if (actionBar) {
        actionBar.style.display = 'none';
    }

    // 5. Start lyttere på nytt
    db.ref().off(); 
    if (typeof startLyttere === "function") {
        startLyttere();
    }
    
    console.log("Admin lukket. År satt til:", Global_aar);
}


// --- ÅRSRAPPORT I ADMIN-FUNKSJONER (Nå dynamisk koblet til Global_aar) ---
async function kjorAdminRapport(type) {
    const aar = document.getElementById('adminAar').value;
    const fag = document.getElementById('adminFag').value;
    const periode = document.getElementById('adminPeriode').value;
    
    if (!aar || !fag || !periode) {
        alert("Vennligst velg år, fag og periode i menyen.");
        return;
    }

    // ENDRING: Bruker Global_aar som fallback istedenfor hardkodet "2025-2026"
    const fallbackAar = typeof Global_aar !== 'undefined' ? Global_aar : Object.keys(oppgaveStruktur)[0];
    const aarIMal = oppgaveStruktur[aar] ? aar : fallbackAar;

    let samletInnhold = `<h1 style="text-align:center;">${type === 'kritisk' ? 'Kritisk-liste' : 'Årsrapport'} - ${fag} (${aar})</h1>`;
    
    const klasser = ["A", "B", "C", "D"];
    const alleTrinn = ["1", "2", "3", "4", "5", "6", "7"];

    for (let trinn of alleTrinn) {
        for (let klasse of klasser) {
            // Henter oppsettet basert på valgt år eller fallback-året
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
    
    // 1. Definer hvilket skoleår vi ser på (vStartAar er f.eks. 2025)
    // vStartAar er allerede definert rett over denne koden i din funksjon
    
    // 2. NYTT: Sjekk om eleven er aktiv i dette skoleåret
    const harBegynt = vStartAar >= parseInt(e.startAar);
    const harIkkeSluttet = !e.sluttAar || vStartAar <= parseInt(e.sluttAar);
    
    // Hvis eleven ikke hører til i denne tidsperioden, hopper vi over helt
    if (!harBegynt || !harIkkeSluttet) return;

    // 3. Beregn hvilket trinn eleven var på i det aktuelle året
    const cTrinn = parseInt(e.startTrinn) + (vStartAar - parseInt(e.startAar));
    
    // Sjekk om eleven matcher trinnet og klassen som rapporten kjøres for
    if (cTrinn === parseInt(trinn) && e.startKlasse === klasse) {
        const d = data[navn] || {};
        if (d.slettet === true) return;

        const sumVerdi = d.sum || 0;
        // Sikrer at grenseTotal finnes, ellers sett til -1 (ingen blir kritiske)
        const gTotal = oppsett.grenseTotal !== undefined ? oppsett.grenseTotal : -1;
        const erKritisk = sumVerdi <= gTotal;
        
        // Hvis vi kun skal vise kritiske, hopp over de som er OK
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

            // Legg til snitt-rad hvis det er data (og ikke kritisk-liste)
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

    // Åpne i nytt vindu for utskrift
    const printVindu = window.open('', '_blank');
    if (!printVindu) {
        alert("Pop-up blokkert! Vennligst tillat pop-ups for å se rapporten.");
        return;
    }

    printVindu.document.write(`
        <html>
            <head>
                <title>Skolerapport - ${aar}</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top:10px; }
                    th, td { border: 1px solid black; padding: 4px; }
                    .page-break { page-break-after: always; }
                    h1, h2 { color: #2c3e50; }
                    @media print { .page-break { page-break-after: always; } }
                </style>
            </head>
            <body>${samletInnhold}</body>
        </html>
    `);
    printVindu.document.close();
    
    // Gi nettleseren litt tid til å tegne før print
    setTimeout(() => {
        printVindu.print();
    }, 1000);
}

// --- ALLE ÅR _ MENY FRA GLOBAL_AAR ---
function oppdaterAlleAarsMenyer() {
    // 1. Hent den dynamiske listen fra din eksisterende funksjon i Global_aar.js
    const alleAar = hentSkoleaarFraRegister(); 
    
    // 2. Liste over alle ID-er som skal fylles med årstall
    // 'adminAar' er menyen for Årsrapport
    // 'teAar' er menyen for Total Eksport
    // 'compAar' er menyen for Sammenligning
    // 'mAar' er hovedmenyen din
    const menyer = ['mAar', 'teAar', 'adminAar', 'compAar'];

    menyer.forEach(id => {
        // Bruk din egen fyllDropdown-funksjon!
        fyllDropdown(id, alleAar);
        
        // Sett Global_aar som forhåndsvalgt hvis den finnes
        const meny = document.getElementById(id);
        if (meny && typeof Global_aar !== 'undefined') {
            meny.value = Global_aar;
        }
    });
}

window.addEventListener('load', () => {
    // En bitteliten delay (100ms) kan av og til hjelpe på trege sider
    setTimeout(oppdaterAlleAarsMenyer, 100);
});

// --- SAMMENLIGNING I ADMIN-FUNKSJONER (Oppdatert for 2026+) ---
async function kjorSammenligning() {
    const aar = document.getElementById('compAar').value;
    const fag = document.getElementById('compFag').value;
    const periode = document.getElementById('compPeriode').value;
    const trinn = document.getElementById('compTrinn').value;

    // DEFINER MAL-ÅR (viktig for at 'oppsett' skal virke)
    const aarIMal = oppgaveStruktur[aar] ? aar : "2025-2026";

    const overskriftTekst = `Sammenligning: ${aar} - ${fag} - ${trinn}. trinn (${periode})`;
    const overskriftElement = document.getElementById('modalChartOverskrift');
    if (overskriftElement) {
        overskriftElement.innerText = overskriftTekst;
    }

    const oppsett = (oppgaveStruktur[aarIMal] && 
                     oppgaveStruktur[aarIMal][fag] && 
                     oppgaveStruktur[aarIMal][fag][periode]) 
                     ? oppgaveStruktur[aarIMal][fag][periode][trinn] 
                     : null;

    if (!oppsett) {
        alert("Fant ikke oppsett for valgt kombinasjon.");
        return;
    }

    Chart.register(ChartDataLabels);
    const modalChartArea = document.getElementById('modalChartArea');
    if (modalChartArea) modalChartArea.style.display = 'block';

    const klasser = ["A", "B", "C", "D"];
    let datasets = [];
    const farger = ['rgba(41, 128, 185, 0.85)', 'rgba(39, 174, 96, 0.85)', 'rgba(230, 126, 34, 0.85)', 'rgba(155, 89, 182, 0.85)'];
    const maksVerdier = [...oppsett.oppgaver.map(o => o.maks), oppsett.oppgaver.reduce((a, b) => a + b.maks, 0)];

    for (let i = 0; i < klasser.length; i++) {
        const snap = await db.ref(`kartlegging/${aar}/${fag}/${periode}/${trinn}/${klasser[i]}`).once('value');
        const data = snap.val() || {};
        let antall = 0, summer = new Array(oppsett.oppgaver.length + 1).fill(0);

        Object.keys(data).forEach(n => {
            const d = data[n];
            const e = elevRegister[n]; // Henter info om eleven fra registeret

            // --- NY SJEKK FOR START/SLUTT ---
            if (e) {
                // Vi henter startåret for skoleåret (f.eks. 2025 fra "2025-2026")
                const vStartAarRapport = parseInt(aar.split('-')[0]);
                
                const harBegynt = vStartAarRapport >= parseInt(e.startAar);
                const harIkkeSluttet = !e.sluttAar || vStartAarRapport <= parseInt(e.sluttAar);
                
                // Hvis eleven ikke var aktiv i det valgte skoleåret, hopper vi over dem
                if (!harBegynt || !harIkkeSluttet) return;
            }
            // --------------------------------

            if (d.oppgaver && d.slettet !== true && d.ikkeGjennomfort !== true) {
                antall++; // Nå teller vi kun aktive elever i snitt-beregningen
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
                    formatter: (value) => {
                        const idx = datasets[i]?.data?.indexOf(value); // Forenklet for eksempel
                        return value; // Du kan beholde din avanserte formatter her
                    }
                }
            });
        }
    }

    // Sjekk om vi faktisk fant noe data før vi prøver å tegne
    if (datasets.length === 0) {
        alert("Fant ingen lagrede resultater for dette valget.");
        if (modalChartArea) modalChartArea.style.display = 'none';
        return;
    }

    // Rød linje og tegning (lik din kode...)
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

    const ctx = document.getElementById('modalSammenligningsChart').getContext('2d');
    if (myChart) myChart.destroy();
    
    myChart = new Chart(ctx, {
        data: { 
            labels: [...oppsett.oppgaver.map(o => o.navn), "Total"], 
            datasets: datasets 
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: { y: { beginAtZero: true } }
        }
    });
}

// Denne åpner selve vinduet fra adminpanelet
function aapneSammenligningsModal() {
    const modal = document.getElementById('modalSammenlign');
    if (modal) modal.style.display = 'block';
    
    const chartArea = document.getElementById('modalChartArea');
    if (chartArea) chartArea.style.display = 'none';

    // VIKTIG: Vi trenger IKKE fylle 'compAar' her lenger, 
    // fordi Global_aar.js har allerede gjort det ved oppstart.

    // Du kan imidlertid fylle de faste listene her hvis de ikke 
    // er definert i HTML-en fra før:
    fyllDropdown('compFag', ["Lesing", "Regning"]); 
    fyllDropdown('compPeriode', ["Høst", "Vår"]);
    fyllDropdown('compTrinn', ["1", "2", "3", "4", "5", "6", "7"]);

    // Valgfritt: Sørg for at modalen viser det året man jobber i akkurat nå
    if (typeof Global_aar !== 'undefined') {
        const compAar = document.getElementById('compAar');
        if (compAar) compAar.value = Global_aar;
    }
}

// Hjelpefunksjon for å fylle dropdown-menyer
function fyllDropdown(id, liste) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = "";
    liste.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item;
        opt.text = item;
        el.appendChild(opt);
    });
}


function printSammenligningsDiagram() {
    const canvas = document.getElementById('modalSammenligningsChart');
    if (!canvas) return;

    // Hent info
    const aar = document.getElementById('compAar').value || "Ikke valgt";
    const fag = document.getElementById('compFag').value || "";
    const periode = document.getElementById('compPeriode').value || "";
    const trinn = document.getElementById('compTrinn').value || "";

    const bildeData = canvas.toDataURL('image/png');
    const printVindu = window.open('', '_blank');

    printVindu.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Utskrift Liggende - ${trinn}. trinn</title>
            <style>
                /* VIKTIG: Dette tvinger skriveren til liggende format */
                @page {
                    size: A4 landscape;
                    margin: 10mm;
                }
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    margin: 0; 
                    padding: 0;
                    color: #2c3e50;
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                    overflow: hidden; /* Forhindrer at noe flyter over til side 2 */
                }
                .header { 
                    border-bottom: 2px solid #2980b9; 
                    padding-bottom: 8px; 
                    margin-bottom: 15px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                h1 { margin: 0; font-size: 18px; color: #2980b9; }
                .info { font-size: 14px; font-weight: bold; }
                
                .chart-wrapper {
                    flex: 1; /* Lar diagrammet ta all restplass på siden */
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    width: 100%;
                }
                img { 
                    max-width: 100%; 
                    max-height: 100%; 
                    object-fit: contain; 
                    border: 1px solid #eee;
                }
                .footer { 
                    margin-top: 10px;
                    font-size: 9px; 
                    color: #95a5a6; 
                    text-align: right;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📊 Sammenligning: ${trinn}. trinn</h1>
                <div class="info">${fag} | ${periode} | Skoleår: ${aar}</div>
            </div>
            
            <div class="chart-wrapper">
                <img src="${bildeData}" />
            </div>

            <div class="footer">
                Kartleggingsverktøy Pro | Dato: ${new Date().toLocaleDateString('no-NO')}
            </div>

            <script>
                window.onload = function() {
                    setTimeout(() => {
                        window.print();
                        window.onafterprint = function() { window.close(); };
                        setTimeout(() => { window.close(); }, 2000);
                    }, 400);
                };
            <\/script>
        </body>
        </html>
    `);
    printVindu.document.close();
}


// --- KLASSERAPPORT --
let klasseChart = null;
let lagretKullData = []; // Brukes for utskrift av alle sider

async function aapneKlasserapportModal() {
    const kullSelect = document.getElementById('selectKullAar');
    kullSelect.innerHTML = '';
    
    // Generer fødselsår (f.eks. siste 10 år)
    const currentYear = new Date().getFullYear();
    for(let i = currentYear - 13; i <= currentYear - 5; i++) {
        let opt = document.createElement('option');
        opt.value = i; opt.text = `Født i ${i}`;
        kullSelect.appendChild(opt);
    }
    document.getElementById('modalKlasserapport').style.display = 'block';
}


async function genererKlasserapport() {
    const fodaar = parseInt(document.getElementById('selectKullAar').value);
    const fag = document.getElementById('selectKullFag').value;
    const klasseBokstav = document.getElementById('selectKullKlasse').value;

    const snapshot = await db.ref('kartlegging').once('value');
    const allData = snapshot.val();
    if (!allData) return;
    
    let tidslinjeData = [];
    lagretKullData = []; 

    const sorterteAar = Object.keys(allData).sort();
for (let skoleaar of sorterteAar) {
        const startAarSkole = parseInt(skoleaar.split('-')[0]);
        const trinn = startAarSkole - fodaar - 5;

        if (trinn >= 1 && trinn <= 7) {
            const fagData = allData[skoleaar]?.[fag];
            if (!fagData) continue;

            for (let periode in fagData) {
                const trinnData = fagData[periode][trinn];
                if (trinnData && trinnData[klasseBokstav]) {
                    
                    // --- ENDRING HER: Sikre at vi finner et oppsett (fallback til 2025) ---
                    const aarIMal = oppgaveStruktur[skoleaar] ? skoleaar : "2025-2026";
                    
                    // Sjekk steg for steg så vi ikke krasjer hvis noe mangler i malen
                    const oppsett = (oppgaveStruktur[aarIMal] && 
                                     oppgaveStruktur[aarIMal][fag] && 
                                     oppgaveStruktur[aarIMal][fag][periode]) 
                                     ? oppgaveStruktur[aarIMal][fag][periode][trinn] 
                                     : null;

                    if (!oppsett) {
                        console.warn(`Mangler oppsett for ${fag} ${periode} ${trinn}.trinn i ${aarIMal}`);
                        continue;
                    }              
                    const maksPoeng = oppsett.oppgaver.reduce((s, o) => s + o.maks, 0);
                    const eleverIKlasse = trinnData[klasseBokstav];
                    
                    let summerTilSnitt = [];
                    let elevListeTilPrint = []; 

                    for (let id in eleverIKlasse) {
    const e = eleverIKlasse[id];

    // --- NY SJEKK: Er eleven aktiv i DETTE skoleåret (skoleaar)? ---
    const e_reg = elevRegister[id]; 
    if (e_reg) {
        // Vi bruker startåret fra den nåværende runden i loopen (skoleaar)
        const vStartAarSkole = parseInt(skoleaar.split('-')[0]);
        const harBegynt = vStartAarSkole >= parseInt(e_reg.startAar);
        const harIkkeSluttet = !e_reg.sluttAar || vStartAarSkole <= parseInt(e_reg.sluttAar);
        
        // Hvis eleven ikke har begynt ennå, eller har sluttet i dette året:
        // Vi hopper helt over dem for denne spesifikke perioden.
        if (!harBegynt || !harIkkeSluttet) continue; 
    }
    // -------------------------------------------------------------

    // Vi hopper over slettede elever, men inkluderer alle andre
    if (e.slettet) continue;

    let visningsNavn = e.navn || e.elevNavn || id;
    
    // Sjekk om eleven faktisk har gjennomført og har poeng
    if (!e.ikkeGjennomfort && e.sum !== undefined) {
        const prosent = Math.round((e.sum / maksPoeng) * 100);
        summerTilSnitt.push(prosent); 

        elevListeTilPrint.push({
            navn: visningsNavn,
            sum: e.sum,
            maks: maksPoeng,
            prosent: prosent,
            oppgaver: e.oppgaver || [],
            status: "ok"
        });
    } else {
        // Eleven er merket "Ikke gjennomført" eller mangler data
        elevListeTilPrint.push({
            navn: visningsNavn,
            sum: "-",
            maks: maksPoeng,
            prosent: "-",
            oppgaver: [],
            status: "ikke_gjennomfort" 
        });
    }
}

                    if (elevListeTilPrint.length > 0) {
                        // Beregn snitt kun for de som har prosent-tall
                        let snitt = 0;
                        if (summerTilSnitt.length > 0) {
                            snitt = Math.round(summerTilSnitt.reduce((a, b) => a + b, 0) / summerTilSnitt.length);
                        }

                        const label = `${periode} ${skoleaar.slice(-2)} (${trinn}.tr)`;
                        
                        tidslinjeData.push({ label, snitt });
                        
                        lagretKullData.push({
                            tittel: `Klasserapport: ${fag} - ${label} - Klasse ${trinn}${klasseBokstav}`,
                            elever: elevListeTilPrint.sort((a, b) => a.navn.localeCompare(b.navn)),
                            oppgaveOppsett: oppsett.oppgaver
                        });
                    }
                }
            }
        }
    }

    if (tidslinjeData.length === 0) {
        alert("Fant ingen data for dette kullet i valgt klasse/fag.");
        return;
    }

    tegnKlasseChart(tidslinjeData);
    document.getElementById('klasseTabellPrint').innerHTML = 
        `<p style="color:green; font-weight:bold;">✅ Fant data for ${lagretKullData.length} prøveperioder. Klar for utskrift!</p>`;
}



function tegnKlasseChart(dataPoints) {
    const ctx = document.getElementById('chartKlasseUtvikling').getContext('2d');
    if (klasseChart) klasseChart.destroy();

    klasseChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dataPoints.map(d => d.label),
            datasets: [{
                label: 'Gjennomsnitt (%)',
                data: dataPoints.map(d => d.snitt),
                backgroundColor: '#2980b9',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { min: 0, max: 100 } },
            plugins: { datalabels: { anchor: 'end', align: 'top', formatter: v => v + "%" } }
        },
        plugins: [ChartDataLabels]
    });
}


function printKlasseDiagram() {
    const canvas = document.getElementById('chartKlasseUtvikling');
    if (!canvas) return;

    // Hent info for overskrift
    const kull = document.getElementById('selectKullAar').value;
    const fag = document.getElementById('selectKullFag').value;
    const klasse = document.getElementById('selectKullKlasse').value;

    const bildeData = canvas.toDataURL('image/png');
    const printVindu = window.open('', '_blank');

    printVindu.document.write(`
        <html>
        <head>
            <title>Klasserapport - Diagram</title>
            <style>
                body { font-family: sans-serif; text-align: center; padding: 20px; }
                img { max-width: 100%; height: auto; border: 1px solid #ddd; margin-top: 20px; }
                h1 { color: #2c3e50; border-bottom: 2px solid #2980b9; padding-bottom: 10px; }
                .info { margin-bottom: 20px; font-size: 1.1em; }
            </style>
        </head>
        <body>
            <h1>📊 Klasserapport: Utvikling over tid</h1>
            <div class="info">
                <strong>Kull:</strong> ${kull} | 
                <strong>Fag:</strong> ${fag} | 
                <strong>Klasse:</strong> ${klasse}
            </div>
            <img src="${bildeData}" />
            <p style="margin-top: 50px; font-size: 0.8em; color: #888;">Utskrift fra Kartleggingsverktøy Pro - ${new Date().toLocaleDateString()}</p>
            <script>
                window.onload = function() { 
                    window.print(); 
                    setTimeout(function() { window.close(); }, 500); 
                };
            <\/script>
        </body>
        </html>
    `);
    printVindu.document.close();
}



function printAlleKlasseResultater() {
    if (!lagretKullData || lagretKullData.length === 0) {
        return alert("Ingen data å skrive ut. Vennligst generer rapport først.");
    }

    // --- 1. SORTERING AV PRØVENE KRONOLOGISK ---
    const sorterteProever = [...lagretKullData].sort((a, b) => {
        const regex = /(Høst|Vår)\s(\d{2})/;
        const matchA = a.tittel.match(regex);
        const matchB = b.tittel.match(regex);

        if (matchA && matchB) {
            const aarA = parseInt(matchA[2]);
            const aarB = parseInt(matchB[2]);
            if (aarA !== aarB) return aarA - aarB;
            return matchA[1] === "Høst" ? -1 : 1;
        }
        return 0;
    });

    const printVindu = window.open('', '_blank');
    
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Detaljert Klasserapport</title>
        <style>
            @media print { 
                .page-break { page-break-after: always; }
                body { -webkit-print-color-adjust: exact; margin: 0; padding: 10mm; }
            }
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; font-size: 11px; line-height: 1.2; }
            .header-info { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2980b9; margin-bottom: 10px; padding-bottom: 5px; }
            h1 { margin: 0; color: #2980b9; font-size: 16px; }
            .snitt-boks { background: #2980b9; color: white; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; }
            th, td { border: 1px solid #777; padding: 3px 2px; text-align: center; }
            th { background: #f2f2f2; font-weight: bold; font-size: 10px; }
            .navn-kol { text-align: left; padding-left: 5px; width: 160px; white-space: nowrap; overflow: hidden; }
            tr { height: 18px; } 
            .kritisk { background-color: #ffcccc !important; color: #a94442; font-weight: bold; }
            .ikke-gjennomfort-rad { background-color: #f9f9f9 !important; color: #999; font-style: italic; }
            .footer { margin-top: 10px; font-size: 9px; color: #7f8c8d; text-align: right; }
        </style>
    </head>
    <body>`;

    sorterteProever.forEach((proeve, index) => {
        const eleverMedResultat = proeve.elever.filter(e => e.status === "ok");
        const totalSnitt = eleverMedResultat.length > 0 
            ? Math.round(eleverMedResultat.reduce((a, b) => a + b.prosent, 0) / eleverMedResultat.length)
            : 0;

        html += `
        <div class="page-break">
            <div class="header-info">
                <h1>${proeve.tittel}</h1>
                <div class="snitt-boks">Snitt: ${totalSnitt}%</div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th class="navn-kol">Elevnavn</th>
                        ${proeve.oppgaveOppsett.map((o, i) => `<th>O${i+1}<br>(${o.maks})</th>`).join('')}
                        <th style="background:#eee">Sum</th>
                        <th style="background:#eee">%</th>
                    </tr>
                </thead>
                <tbody>`;

        proeve.elever.forEach(e => {
            if (e.status === "ikke_gjennomfort") {
                html += `<tr class="ikke-gjennomfort-rad">
                    <td class="navn-kol">${e.navn}</td>
                    <td colspan="${proeve.oppgaveOppsett.length + 2}">Ikke gjennomført</td>
                </tr>`;
            } else {
                const totalKritisk = e.prosent < 50 ? 'kritisk' : '';
                html += `<tr>
                    <td class="navn-kol">${e.navn}</td>`;
                
                proeve.oppgaveOppsett.forEach((info, i) => {
                    const poeng = (e.oppgaver && e.oppgaver[i] !== undefined) ? e.oppgaver[i] : 0;
                    const oppgaveKritisk = (poeng / info.maks) < 0.5 ? 'kritisk' : '';
                    html += `<td class="${oppgaveKritisk}">${poeng}</td>`;
                });

                html += `
                    <td class="${totalKritisk}">${e.sum}</td>
                    <td class="${totalKritisk}">${e.prosent}%</td>
                </tr>`;
            }
        });

        html += `
                </tbody>
            </table>
            <div class="footer">Side ${index + 1} av ${sorterteProever.length} | Utarbeidet: ${new Date().toLocaleDateString('no-NO')}</div>
        </div>`;
    });

    // Legger til lukk-scriptet helt til slutt i HTML-strengen
    html += `
        <script>
            window.onload = function() {
                setTimeout(() => { 
                    window.print(); 
                    window.onafterprint = function() { window.close(); };
                    // Backup hvis onafterprint ikke støttes:
                    setTimeout(() => { window.close(); }, 2000);
                }, 500);
            };
        </script>
    </body>
    </html>`;

    printVindu.document.write(html);
    printVindu.document.close();
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
    document.getElementById('elevSokInput').value = ""; 
    
    // Vi definerer hva som er "i år" for å sjekke mot sluttAar
    const innevaerendeAar = 2026; // Eller bruk new Date().getFullYear()

    Object.keys(elevRegister).sort().forEach(navn => {
        const e = elevRegister[navn];
        const div = document.createElement('div');
        div.className = "elev-valg-rad";
        div.style.padding = "10px";
        div.style.cursor = "pointer";
        div.style.borderBottom = "1px solid #eee";

        // --- SJEKK FOR SLUTTDATO ---
        const harSluttet = e.sluttAar && parseInt(e.sluttAar) < innevaerendeAar;

        if (harSluttet) {
            // Marker elever som har sluttet med grå tekst og info
            div.style.color = "#95a5a6"; 
            div.innerText = `${navn} (Sluttet ${e.sluttAar})`;
        } else {
            // Vanlige aktive elever
            div.innerText = navn;
        }
        // ---------------------------

        div.onclick = () => {
            document.getElementById('modalElevrapport').style.display = 'none';
            setTimeout(() => {
                genererFullElevrapport(navn);
            }, 200);
        };
        
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
                
                // Beregn hvilket trinn eleven er på i det valgte skoleåret
                const cTrinn = e.startTrinn + (vStartAar - e.startAar);
                
                // --- NY SJEKK FOR START- OG SLUTTDATO ---
                const harBegynt = vStartAar >= parseInt(e.startAar);
                const harIkkeSluttet = !e.sluttAar || vStartAar <= parseInt(e.sluttAar);
                
                // Eleven må gå på riktig trinn, i riktig klasse, og være aktiv i det valgte året
                return cTrinn == vTrinn && 
                       e.startKlasse === klasseNavn && 
                       harBegynt && 
                       harIkkeSluttet;
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
        
        // --- NY SJEKK FOR SLUTTDATO ---
        const harIkkeSluttet = !e.sluttAar || vStartAar <= parseInt(e.sluttAar);
        const harBegynt = vStartAar >= parseInt(e.startAar);
        
        return cTrinn === vTrinn && e.startKlasse === vKlasse && harIkkeSluttet && harBegynt;
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
                
// 3. DYNAMISK TRINN-BEREGNING (Med sjekk for start- og sluttdato)
const elever = Object.keys(elevRegister).filter(navn => {
    const e = elevRegister[navn];
    
    // Finn ut hvilket trinn denne eleven ville vært på i det valgte skoleåret
    const beregnetTrinn = parseInt(e.startTrinn) + (valgtStartAar - parseInt(e.startAar));
    
    // --- NYE SJEKKER ---
    const harBegynt = valgtStartAar >= parseInt(e.startAar);
    const harIkkeSluttet = !e.sluttAar || valgtStartAar <= parseInt(e.sluttAar);
    
    // Legg til harBegynt og harIkkeSluttet i returen
    return beregnetTrinn === trinnInt && 
           e.startKlasse === kl && 
           harBegynt && 
           harIkkeSluttet;
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
    // Legg til class='no-print' på denne vente-teksten
utskriftArea.innerHTML = "<h2 class='no-print' style='text-align:center; padding:50px;'>Genererer rapport for " + navn + "...</h2>";
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
                <h1 style="text-align:center; color:#2c3e50; margin-bottom:5px;">ELEVRAPPORT</h1>
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
            startKlasse: vKlasse,
            sluttAar: null // VIKTIG: Nullstill sluttdato hvis eleven legges til på nytt
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

// --- NY SJEKK FOR START- OG SLUTTDATO ---
        const harBegynt = vStartAar >= parseInt(e.startAar);
        const harIkkeSluttet = !e.sluttAar || vStartAar <= parseInt(e.sluttAar);

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

// function forberedPrint() { window.print(); }
async function forberedPrint() {
    const utskriftArea = document.getElementById('utskriftRapportArea');
    const vTrinn = document.getElementById('mTrinn').value;
    const vKlasse = document.getElementById('mKlasse').value;
    const vFag = document.getElementById('mFag').value;
    const vPeriode = document.getElementById('mPeriode').value;
    const vAar = document.getElementById('mAar').value;

    const oppsett = hentOppsett();
    if (!oppsett) return alert("Vennligst velg alle kriterier først!");

    utskriftArea.innerHTML = `<h2 class="no-print" style="text-align:center; padding:50px;">Klargjør utskrift...</h2>`;

    try {
        const vStartAar = parseInt(vAar.split('-')[0]);
        let raderHtml = "";
        let antallGjennomfort = 0;
        let kolonneSummer = new Array(oppsett.oppgaver.length).fill(0);
        let totalSumKlasse = 0;

        const sorterteNavn = Object.keys(elevRegister).sort();
        
        const aktuelleElever = sorterteNavn.filter(navn => {
            const e = elevRegister[navn];
            const cTrinn = e.startTrinn + (vStartAar - e.startAar);
            const harBegynt = vStartAar >= parseInt(e.startAar);
            const harIkkeSluttet = !e.sluttAar || vStartAar <= parseInt(e.sluttAar);
            return (cTrinn == vTrinn && e.startKlasse === vKlasse && harBegynt && harIkkeSluttet);
        });
        
        const totalAntall = aktuelleElever.length;
        const cellePadding = "padding: 3.5px 2px;"; 

        aktuelleElever.forEach((navn, index) => {
            const d = lagredeResultater[navn] || {};
            if (d.slettet) return;

            const zebraStyle = index % 2 === 0 ? "background-color: #ffffff;" : "background-color: #fcfcfc;";

            if (d.ikkeGjennomfort) {
                raderHtml += `
                    <tr style="background-color: #f2f2f2 !important; color: #7f8c8d;">
                        <td style="border:1px solid #000; text-align:left; padding:3.5px 5px; font-weight:bold;">${navn}</td>
                        <td colspan="${oppsett.oppgaver.length + 1}" style="border:1px solid #000; padding:3.5px; font-style:italic; text-align:center; font-size: 0.9em;">
                            IKKE GJENNOMFØRT
                        </td>
                    </tr>`;
            } else {
                antallGjennomfort++;
                let elevSum = 0;
                const oppgaveData = d.oppgaver || [];

                raderHtml += `<tr style="${zebraStyle}"><td style="border:1px solid #000; text-align:left; padding:3.5px 5px; font-weight:bold;">${navn}</td>`;

                oppsett.oppgaver.forEach((o, i) => {
                    const verdi = parseFloat(oppgaveData[i]) || 0;
                    elevSum += verdi;
                    kolonneSummer[i] += verdi;
                    const grense = o.grense !== undefined ? o.grense : o.kritisk;
                    const erKritisk = (grense !== undefined && verdi <= grense);
                    const kritiskStil = erKritisk ? 'background-color: #ffcccc !important; color: #b71c1c; font-weight:bold;' : '';
                    raderHtml += `<td style="border:1px solid #000; ${cellePadding} ${kritiskStil}">${verdi}</td>`;
                });

                const totalGrense = oppsett.grenseTotal || oppsett.totalKritisk;
                const totalErKritisk = (totalGrense !== undefined && elevSum <= totalGrense);
                const totalBakgrunn = totalErKritisk ? 'background-color: #ffcccc !important; color: #b71c1c;' : 'background-color: #f4f4f4;';
                
                raderHtml += `<td style="border:1px solid #000; ${cellePadding} font-weight:bold; ${totalBakgrunn}">${elevSum}</td>`;
                totalSumKlasse += elevSum;
                raderHtml += `</tr>`;
            }
        });

        let snittHtml = `<tr style="background-color: #2c3e50 !important; color: white !important; font-weight: bold;">
                            <td style="border:1px solid #000; padding:6px 5px; text-align:left;">Gjennomsnitt (N=${antallGjennomfort})</td>`;
        
        if (antallGjennomfort > 0) {
            kolonneSummer.forEach(s => {
                snittHtml += `<td style="border:1px solid #000; padding:3px;">${(s / antallGjennomfort).toFixed(1)}</td>`;
            });
            snittHtml += `<td style="border:1px solid #000; padding:3px;">${(totalSumKlasse / antallGjennomfort).toFixed(1)}</td>`;
        }
        snittHtml += `</tr>`;

let html = `
            <style>
                /* Denne blokken tvinger rammene til å vises i overskriften */
                #utskriftRapportArea table { border-collapse: collapse !important; }
                #utskriftRapportArea th, #utskriftRapportArea td { 
                    border: 1px solid #000 !important; 
                }
                @media print {
                    th { background-color: #f1f1f1 !important; -webkit-print-color-adjust: exact; }
                }
            </style>
            <div style="padding: 5px; font-family: Arial, sans-serif;">
                <h2 style="text-align:center; margin: 0 0 5px 0; font-size: 16px; letter-spacing:1px;">KLASSERESULTATER</h2>
                <h3 style="text-align:center; margin: 0 0 12px 0; font-size: 13px; color: #444;">${vFag.toUpperCase()} &nbsp;|&nbsp; ${vTrinn}${vKlasse} &nbsp;|&nbsp; ${vPeriode} ${vAar}</h3>
                
                <table style="width:100%; text-align:center; font-size: 10.5px; line-height: 1.2;">
                    <thead>
                        <tr style="background-color: #f1f1f1;">
                            <th style="padding: 6px; width: 190px;">Elevnavn</th>
                            ${oppsett.oppgaver.map(o => `
                                <th style="padding: 4px;">
                                    ${o.navn}<br>
                                    <small style="font-size: 8px; font-weight: normal;">(maks ${o.maks})</small>
                                </th>
                            `).join('')}
                            <th style="padding: 4px; width: 50px;">SUM</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${raderHtml}
                        ${snittHtml}
                    </tbody>
                </table>
                <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 9px; color: #888; border-top: 1px solid #eee; padding-top: 4px;">
                    <span>Antall elever i utvalget: ${totalAntall}</span>
                    <span>Utskriftsdato: ${new Date().toLocaleString('nb-NO')}</span>
                </div>
            </div>
        `;

        utskriftArea.innerHTML = html;
        setTimeout(() => { window.print(); }, 500);
        window.onafterprint = function() { utskriftArea.innerHTML = ""; };

    } catch (error) {
        console.error("Utskriftsfeil:", error);
        utskriftArea.innerHTML = "";
    }
}

// -- SAMMENLIGNE PRØVER/ÅR ---
let devChartLesing = null;
let devChartRegning = null;
let globalUtviklingData = null;
let globalUtviklingPerioder = [];

async function aapneUtviklingsModal() {
    document.getElementById('modalUtvikling').style.display = 'block';
    
    const snapshot = await db.ref('kartlegging').once('value');
    const allData = snapshot.val();
    if (!allData) return;

    const fagene = ["Lesing", "Regning"];
    const resultater = { "Lesing": {}, "Regning": {} };
    const allePerioderSet = new Set();

    // Loop gjennom År -> Fag -> Periode -> Trinn -> Klasse -> Elev
    for (let aar in allData) {
        // NYTT: Hent startåret for dette spesifikke året i loopen (f.eks. 2026)
        const loopAarStart = parseInt(aar.split('-')[0]);

        for (let fag in allData[aar]) {
            if (!fagene.includes(fag)) continue;

            for (let periode in allData[aar][fag]) {
                const pKey = `${periode} ${aar.split('-')[0].slice(-2)}`;
                allePerioderSet.add(pKey);

                if (!resultater[fag][pKey]) resultater[fag][pKey] = {};

                for (let trinn in allData[aar][fag][periode]) {
                    if (!resultater[fag][pKey][trinn]) resultater[fag][pKey][trinn] = [];

                    const oppsett = oppgaveStruktur[aar]?.[fag]?.[periode]?.[trinn];
                    if (!oppsett) continue;
                    const maksPoeng = oppsett.oppgaver.reduce((s, o) => s + o.maks, 0);

                    const klasser = allData[aar][fag][periode][trinn];
                    for (let klasse in klasser) {
                        for (let elevNavn in klasser[klasse]) {
                            const d = klasser[klasse][elevNavn];

                            // --- NYTT FILTER FOR SLUTTDATO ---
                            const e = elevRegister[elevNavn];
                            if (e) {
                                const harBegynt = loopAarStart >= parseInt(e.startAar);
                                const harIkkeSluttet = !e.sluttAar || loopAarStart <= parseInt(e.sluttAar);
                                
                                // Hvis eleven ikke var aktiv dette skoleåret, hopp over
                                if (!harBegynt || !harIkkeSluttet) continue;
                            }
                            // --------------------------------

                            if (d.slettet || d.ikkeGjennomfort || d.sum === undefined) continue;
                            
                            const prosent = (d.sum / maksPoeng) * 100;
                            resultater[fag][pKey][trinn].push(prosent);
                        }
                    }
                }
            }
        }
    }

    // Lagre data globalt (resten er som før)
    globalUtviklingPerioder = Array.from(allePerioderSet).sort((a, b) => {
        const aarA = a.split(' ')[1];
        const aarB = b.split(' ')[1];
        if (aarA !== aarB) return aarA - aarB;
        return a.includes("Høst") ? -1 : 1;
    });
    globalUtviklingData = resultater;

    oppdaterUtviklingFilter('alle');
}

// NY FUNKSJON: Håndterer knappetrykkene fra filteret
function oppdaterUtviklingFilter(valg) {
    tegnUtviklingsGraf("chartUtviklingLesing", "Lesing", globalUtviklingPerioder, globalUtviklingData["Lesing"], valg);
    tegnUtviklingsGraf("chartUtviklingRegning", "Regning", globalUtviklingPerioder, globalUtviklingData["Regning"], valg);
}

function tegnUtviklingsGraf(canvasId, fag, perioder, data, filterValg = 'alle') {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    if (fag === "Lesing" && devChartLesing) devChartLesing.destroy();
    if (fag === "Regning" && devChartRegning) devChartRegning.destroy();

    const trinnFarger = { "1":"#3498db", "2":"#e74c3c", "3":"#2ecc71", "4":"#f1c40f", "5":"#9b59b6", "6":"#e67e22", "7":"#1abc9c" };
    const datasets = [];

    // 1. Legg til trinnene som søyler (Filtrert)
    for (let t = 1; t <= 7; t++) {
        // Sjekk om dette trinnet skal vises basert på knappen som ble trykket
        if (filterValg !== 'alle' && filterValg !== 'total' && filterValg !== t.toString()) continue;
        if (filterValg === 'total') continue; // Vis ingen søyler hvis "Kun total" er valgt

        const trinnData = perioder.map(p => {
            const verdier = data[p]?.[t] || [];
            if (verdier.length === 0) return null;
            return Math.round(verdier.reduce((a, b) => a + b, 0) / verdier.length);
        });

        if (trinnData.some(v => v !== null)) {
            datasets.push({
                type: 'bar',
                label: `${t}. trinn`,
                data: trinnData,
                backgroundColor: trinnFarger[t],
                borderColor: trinnFarger[t],
                borderWidth: 1,
                order: 2
            });
        }
    }

    // 2. Beregn og legg alltid til "Skolen totalt" som en linje
    const totalData = perioder.map(p => {
        let alleProsenter = [];
        for (let t = 1; t <= 7; t++) {
            const verdier = data[p]?.[t] || [];
            alleProsenter = alleProsenter.concat(verdier);
        }
        if (alleProsenter.length === 0) return null;
        return Math.round(alleProsenter.reduce((a, b) => a + b, 0) / alleProsenter.length);
    });

    datasets.push({
        type: 'line',
        label: 'Skolen totalt',
        data: totalData,
        borderColor: '#2c3e50',
        borderWidth: 4,
        pointRadius: 6,
        pointBackgroundColor: '#2c3e50',
        fill: false,
        tension: 0.1,
        order: 1,
        datalabels: {
            align: 'top',
            backgroundColor: '#2c3e50',
            color: '#fff',
            borderRadius: 3,
            padding: 4,
            font: { weight: 'bold' }
        }
    });

    const chart = new Chart(ctx, {
        type: 'bar',
        data: { labels: perioder, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { 
                    display: true, 
                    text: `Utvikling: ${fag} (%) ${filterValg !== 'alle' ? '- Filter: ' + filterValg : ''}`, 
                    font: { size: 16 } 
                },
                legend: { position: 'bottom' },
                datalabels: { 
                    anchor: 'end', 
                    align: 'top', 
                    formatter: (v) => v !== null ? v + "%" : "" 
                }
            },
            scales: { 
                y: { 
                    min: 0, 
                    max: 115, 
                    title: { display: true, text: 'Prosent riktig' } 
                } 
            }
        },
        plugins: [ChartDataLabels]
    });

    if (fag === "Lesing") devChartLesing = chart; else devChartRegning = chart;
}

function printUtvikling() {
    const canvasLesing = document.getElementById('chartUtviklingLesing');
    const canvasRegning = document.getElementById('chartUtviklingRegning');

    // Gjør om canvas til bilder (viktig fordi canvas ofte forsvinner i print-vinduer)
    const bildeLesing = canvasLesing.toDataURL("image/png");
    const bildeRegning = canvasRegning.toDataURL("image/png");

    const printVindu = window.open('', '_blank');
    printVindu.document.write(`
        <html>
            <head>
                <title>Skolens utvikling over tid</title>
                <style>
                    body { font-family: sans-serif; text-align: center; padding: 20px; }
                    img { max-width: 100%; height: auto; margin-bottom: 40px; border: 1px solid #eee; }
                    h1 { color: #8e44ad; }
                    .dato { font-size: 0.9em; color: #666; margin-bottom: 30px; }
                </style>
            </head>
            <body>
                <h1>Skolens utvikling over tid</h1>
                <div class="dato">Utskrift generert: ${new Date().toLocaleDateString('no-NO')}</div>
                
                <h3>Lesing</h3>
                <img src="${bildeLesing}">
                
                <h3>Regning</h3>
                <img src="${bildeRegning}">
                
                <script>
                    // Vent til bildene er lastet, så åpne print-dialogen
                    window.onload = function() {
                        window.print();
                        window.onafterprint = function() { window.close(); };
                    };
                </script>
            </body>
        </html>
    `);
    printVindu.document.close();
}