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
            
            // --- LOGIKK FOR LESEKURS-URL ---
            let kursUrl = "";
            if (erLesing) {
                if (rentTrinnNummer === 1) kursUrl = "https://sites.google.com/ikrs.no/lesekurs/lesekurs/lesekurs-for-1-klasse";
                else if (rentTrinnNummer === 2) kursUrl = "https://sites.google.com/ikrs.no/lesekurs/lesekurs/lesekurs-for-2-klasse";
                else if (rentTrinnNummer === 3) kursUrl = "https://sites.google.com/ikrs.no/lesekurs/lesekurs/lesekurs-for-3-klasse";
                else kursUrl = "https://sites.google.com/ikrs.no/lesekurs/lesekurs/malimo/intensivt-lesekurs";
            }

            // --- SØKELOGIKK (BOK) ---
            let oppgaveNavn = malInfo.navn.toLowerCase();
            let søkeBegreper = [oppgaveNavn];
            // ... (din eksisterende søkelogikk for klokke, meter, pluss, minus beholdes her) ...

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

            // --- KI PROMPT ---
            const bildeUrl = o.bilde ? fiksGithubLenke(o.bilde) : "";
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

                   ${erLesing ? `
<button title="Gå til lesekurs for ${rentTrinnNummer}. trinn" 
    onclick="const a = document.createElement('a'); a.href='${kursUrl}'; a.target='_blank'; a.rel='noopener noreferrer'; a.click();"
    onmouseover="this.style.backgroundColor='#808080'; this.style.color='white';" 
    onmouseout="this.style.backgroundColor='white'; this.style.color='#27ae60';"
    class="no-print" 
    style="cursor:pointer; border:1px solid #27ae60; background:white; color:#27ae60; border-radius:3px; padding: 2px 5px; font-weight:bold; min-width:45px; transition: all 0.2s;">
    KURS
</button>
                    ` : ''}

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
                        onmouseover="this.style.backgroundColor='#808080'; this.style.color='white';" 
                        onmouseout="this.style.backgroundColor='white'; this.style.color='#8e44ad';"
                        class="no-print" 
                        style="cursor:pointer; border:1px solid #8e44ad; background:white; color:#8e44ad; border-radius:3px; padding: 2px 5px; font-weight:bold; min-width:35px; transition: all 0.2s;">
                        KI
                    </button>

                    ${!erLesing ? `
                    <button title="Ved klikk på 'BOK', får du opp forslag til hvor en kan finne temaet i Multi" 
                        onclick="(function(){
                            alert(decodeURIComponent(escape(window.atob('${safeBokTittel}'))) + '\\n\\n' + decodeURIComponent(escape(window.atob('${safeBokReferanser}'))));
                        })()" 
                        onmouseover="this.style.backgroundColor='#808080'; this.style.color='white';" 
                        onmouseout="this.style.backgroundColor='white'; this.style.color='#2980b9';"
                        class="no-print" 
                        style="cursor:pointer; border:1px solid #2980b9; background:white; color:#2980b9; border-radius:3px; padding: 2px 5px; font-weight:bold; min-width:45px; transition: all 0.2s;">
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
                                          <link rel="icon" type="image/png" href="data:image/png;base64,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">
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