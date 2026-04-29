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
    // 1. Skjul dropdown-menyen umiddelbart for en raskere brukeropplevelse
    const dropdown = document.getElementById("userDropdown");
    if (dropdown) dropdown.classList.remove("show");

    const logId = sessionStorage.getItem('currentLogId');
    if (logId) {
        try {
            const utTid = new Date().getTime();
            const snapshot = await db.ref('systemLogg/' + logId).once('value');
            const data = snapshot.val();
            if (data && data.innLogget) {
                const minutter = Math.round((utTid - data.innLogget) / 60000);
                // Vi bruker await her så vi er sikre på at loggen lagres før vi kastes ut
                await db.ref('systemLogg/' + logId).update({
                    utLogget: utTid,
                    varighet: minutter + " min"
                });
            }
        } catch (e) { 
            console.log("Kunne ikke oppdatere utlogget-tid"); 
        }
    }

    // 2. Logg ut fra Firebase
    await auth.signOut(); 
    
    // 3. Valgfritt: Tving en oppfriskning av siden for å tømme alle variabler helt
    // window.location.reload(); 
}

auth.onAuthStateChanged(user => {
    if (user) {
        // 1. UI Oppsett
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        localStorage.setItem('brukerEpost', user.email);

        // 2. Finn skoleår (Sjekker URL først, deretter dagens dato)
        const params = new URLSearchParams(window.location.search);
        let valgtSkoleaar;

        if (params.has('aar')) {
            valgtSkoleaar = params.get('aar'); // Bruk året fra lenken
            console.log("Bruker skoleår fra URL:", valgtSkoleaar);
        } else {
            const idag = new Date();
            const aar = idag.getFullYear();
            valgtSkoleaar = (idag.getMonth() >= 7) ? `${aar}-${aar + 1}` : `${aar - 1}-${aar}`;
            console.log("Bruker beregnet skoleår:", valgtSkoleaar);
        }

        const ansatteListe = window.ansatteData && window.ansatteData[valgtSkoleaar];
        
        // 3. Finn profilen basert på e-post
        const brukerProfil = ansatteListe?.find(a => {
            const loginMail = user.email.toLowerCase();
            const hovedMail = a.epost ? a.epost.toLowerCase() : "";
            if (hovedMail === loginMail) return true;
            
            if (Array.isArray(a.paloggingsmail)) {
                return a.paloggingsmail.some(m => m && m.toLowerCase() === loginMail);
            } else if (a.paloggingsmail) {
                return a.paloggingsmail.toLowerCase() === loginMail;
            }
            return false;
        });

        // 4. Sett visningsnavn og sjekk admin-rolle
        const visningsNavn = brukerProfil ? brukerProfil.navn : user.displayName;
        document.getElementById('userInfo').innerText = visningsNavn;
        
        oppdaterMenyBasertPaaRolle(brukerProfil);

        // 5. Start resten av systemet
        sjekkVelkomstPopup(user);
        oppdaterAlleAarsMenyer(); 
        registrerInnlogging(user); 
        hentRegister(); 
        
        // --- VIKTIG ENDRING HER ---
        // Hvis vi har URL-parametre, la sjekkUrlParametere styre hentData
        // Hvis ikke, kjør hentData som vanlig for standard-valg
        if (params.has('aar')) {
            sjekkUrlParametere(); 
        } else {
            hentData();      
        }

    } else {
        // ... din eksisterende else-blokk ...
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainContent').style.display = 'none';
        document.getElementById('userInfo').innerText = "";
        localStorage.removeItem('brukerEpost');
        sessionStorage.removeItem('currentLogId');
        
        const adminLink = document.getElementById('adminLink');
        if (adminLink) adminLink.style.display = 'none';

        lukkKonto();
        lukkVeiledning();
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


// Funksjon for å lukke konto-modalen
function lukkKonto() {
    const modal = document.getElementById('modalKonto');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Funksjon for å lukke veiledning-modalen (siden du også kaller denne)
function lukkVeiledning() {
    const modal = document.getElementById('modalVeiledning');
    if (modal) {
        modal.style.display = 'none';
        
        // Finn videoen inni modalen og sett den på pause
        const video = modal.querySelector('video');
        if (video) {
            video.pause();
            // Valgfritt: video.currentTime = 0; // Bruk denne hvis du vil at videoen skal starte forfra neste gang
        }
    }
}

// --- INNLOGGINGSMENY & MODAL-HÅNDTERING ---
window.addEventListener('click', function(event) {
    const modalKonto = document.getElementById('modalKonto');
    const modalVeiledning = document.getElementById('modalVeiledning');
    const modalVelkomst = document.getElementById('modalVelkomst'); // Den nye popup-en
    const modalOppgaver = document.getElementById('modalOppgaver'); // Den nye modalen
    const dropdown = document.getElementById("userDropdown");

    // 1. Lukk dropdown hvis man klikker utenfor navne-boksen (user-pill)
    if (!event.target.closest('.user-pill')) {
        if (dropdown && dropdown.classList.contains('show')) {
            dropdown.classList.remove('show');
        }
    }

    // 2. Lukk konto-modal hvis man klikker på det mørke feltet
    if (event.target === modalKonto) {
        lukkKonto();
    }
    
    // 3. Lukk veiledning-modal hvis man klikker på det mørke feltet
    if (event.target === modalVeiledning) {
        lukkVeiledning();
    }

    // 4. Lukk velkomst-modal hvis man klikker på det mørke feltet
    if (event.target === modalVelkomst) {
        lukkVelkomst();
    }

    // 5. Lukk oppgave-modal (Prøvene) hvis man klikker på det mørke feltet
    if (event.target === modalOppgaver) {
        lukkOppgaveOversikt();
    }
});


function lukkVelkomst() {
    const skalSkjules = document.getElementById('skjulVelkomstCheckbox').checked;
    const user = auth.currentUser;

    if (skalSkjules && user) {
        // Lagre i Firebase at denne brukeren ikke vil se popup igjen
        db.ref('brukerInnstillinger/' + user.uid).update({
            visVelkomst: false
        });
    }
    document.getElementById('modalVelkomst').style.display = 'none';
}

async function sjekkVelkomstPopup(user) {
    const snapshot = await db.ref('brukerInnstillinger/' + user.uid + '/visVelkomst').once('value');
    const visIgjen = snapshot.val();

    // Hvis verdien ikke er 'false', vis popup-en
    if (visIgjen !== false) {
        document.getElementById('modalVelkomst').style.display = 'block';
    }
}

// Din eksisterende toggle-funksjon (sørg for at den ser slik ut)
function toggleDropdown() {
    document.getElementById("userDropdown").classList.toggle("show");
}

// KJØRES VED INNLOGGING: Sjekk om bruker er Admin
function oppdaterMenyBasertPaaRolle(brukerData) {
    const adminLink = document.getElementById('adminLink');
    if (!adminLink) return; // Sikkerhet hvis ID-en mangler i HTML

    // Sjekker om brukeren finnes og om "Adm" er i trinn-listen
    if (brukerData && brukerData.trinn && brukerData.trinn.includes("Adm")) {
        adminLink.style.display = 'block';
        console.log("Admin-tilgang innvilget for:", brukerData.navn);
    } else {
        adminLink.style.display = 'none';
        console.log("Vanlig brukertilgang.");
    }
}


function aapneOppgaveOversikt() {
    const modal = document.getElementById('modalOppgaver');
    const tbody = document.getElementById('oppgaveListeBody');
    const dropdown = document.getElementById("userDropdown");
    
    if (dropdown) dropdown.classList.remove("show");
    tbody.innerHTML = ""; // Tøm tabellen før vi bygger den

    const fagene = ["lesing", "regning"];
    const trinnene = [1, 2, 3, 4, 5, 6, 7];

    fagene.forEach(fag => {
        trinnene.forEach(trinn => {
            const row = document.createElement('tr');
            
            // Kolonne 1: Fag og trinn (f.eks Lesing 1. trinn)
            const fagNavn = fag.charAt(0).toUpperCase() + fag.slice(1);
            row.innerHTML = `<td><strong>${fagNavn} ${trinn}. trinn</strong></td>`;

            // Kolonne 2: Høst (Prøve + Fasit)
            row.appendChild(lagOppgaveCelle(fag, trinn, 'H'));

            // Kolonne 3: Vår (Prøve + Fasit)
            row.appendChild(lagOppgaveCelle(fag, trinn, 'V'));

            tbody.appendChild(row);
        });
    });

    modal.style.display = 'block';
}

function lagOppgaveCelle(fag, trinn, periode) {
    const td = document.createElement('td');
    
    // Sti til prøve
    const proveFil = `Oppgaver/Kartlegging_${fag}_${trinn}_${periode}.pdf`;
    // Sti til fasit
    const fasitFil = `Fasit/Kartlegging_${fag}_${trinn}_${periode}_Fasit.pdf`;

    let html = `<a href="${proveFil}" target="_blank" class="btn-link">📝 Prøve</a>`;
    
    // Spesialhåndtering: Ingen fasit for lesing 1. trinn Høst
    const harFasit = !(fag === "lesing" && trinn === 1 && periode === "H");

    if (harFasit) {
        html += `<br><a href="${fasitFil}" target="_blank" class="btn-link fasit-link">🔑 Fasit</a>`;
    } else {
        html += `<br><span style="color: #ccc; font-size: 0.8em;">Ingen fasit</span>`;
    }

    td.innerHTML = html;
    return td;
}

function lukkOppgaveOversikt() {
    document.getElementById('modalOppgaver').style.display = 'none';
}

// ÅPNE ADMIN
function aapneAdminPanel() {
    // 1. Vis admin-panelet og skjul hovedskjemaet
    document.getElementById('adminPanel').style.display = 'block'; 
    document.getElementById('skjemaInnhold').style.display = 'none';
    
    // 2. Skjul dropdown-menyen (så den ikke ligger over panelet)
    const dropdown = document.getElementById("userDropdown");
    if (dropdown) dropdown.classList.remove("show");

    // 3. Skjul "Legg til ny elev"-boksen hvis den finnes
    if (document.getElementById('nyElevSeksjon')) {
        document.getElementById('nyElevSeksjon').style.display = 'none';
    }

    // 4. Skjul handlingsknapper (Print/Excel/Analyse)
    const actionBar = document.querySelector('.action-bar');
    if (actionBar) actionBar.style.display = 'none';

    // 5. Rydd opp i registreringsskjemaet
    document.getElementById('tHead').innerHTML = "";
    document.getElementById('tBody').innerHTML = "";
    
    // 6. Oppdater overskriften
    oppdaterOverskrifter("Administrasjon og rapporter");

    // 7. Stopp aktiv lytting på Firebase (viktig for ytelse)
    db.ref().off();
    
    console.log("Admin-panel åpnet via autorisert bruker.");
}

function aapneKonto() {
    // 1. Lukk dropdown
    const dropdown = document.getElementById("userDropdown");
    if (dropdown) dropdown.classList.remove("show");

    // 2. Finn skoleår
    let skoleaar = document.getElementById('velgSkoleaar')?.value;
    if (!skoleaar) {
        const idag = new Date();
        const aar = idag.getFullYear();
        skoleaar = (idag.getMonth() >= 7) ? `${aar}-${aar + 1}` : `${aar - 1}-${aar}`;
    }

    const ansatteListe = window.ansatteData && window.ansatteData[skoleaar];
    
    // 3. Hent e-posten som faktisk er logget inn i Google
    const innloggetEpost = localStorage.getItem('brukerEpost')?.toLowerCase();

    // 4. Finn profilen som har denne e-posten (enten som hovedepost eller i paloggingsliste)
    const bruker = ansatteListe?.find(a => {
        const loginMail = innloggetEpost;
        const hovedMail = a.epost.toLowerCase();
        
        if (hovedMail === loginMail) return true;
        
        if (Array.isArray(a.paloggingsmail)) {
            return a.paloggingsmail.some(m => m.toLowerCase() === loginMail);
        } else if (a.paloggingsmail) {
            return a.paloggingsmail.toLowerCase() === loginMail;
        }
        return false;
    });

    if (!bruker) {
        alert("Fant ingen profil-data i ansatte.js for e-post: " + innloggetEpost);
        return;
    }

    // 5. Fyll ut feltene i modalen med data fra riktig profil
    document.getElementById('kontoNavn').innerText = bruker.navn; 
    document.getElementById('kontoEpost').innerText = innloggetEpost;
    document.getElementById('kontoTrinn').innerText = bruker.trinn.join(", ");
    document.getElementById('kontoKontakt').innerText = bruker.kontaktlaerer || "Ingen";

    // 6. Vis modalen
    document.getElementById('modalKonto').style.display = 'block';

// 7. NYTT: Oppdater historikken for kontaktlærer
    oppdaterHistorikk(innloggetEpost);
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
        oppdaterAnalyseStatus(erLaast); // NY: Styrer analyse-knappen (aktiv/deaktivert)
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

async function oppdaterHistorikk(epost) {
    const historikkSeksjon = document.getElementById('historikkSeksjon');
    const historikkListe = document.getElementById('historikkListe');
    if (!historikkSeksjon || !historikkListe) return;

    historikkListe.innerHTML = '<p style="text-align:center; padding:10px; font-size: 0.8em; color: #666;">Henter oversikt...</p>';
    let historikkHtml = "";
    const mineKlasser = [];

    for (const aar in window.ansatteData) {
        const liste = window.ansatteData[aar];
        if (Array.isArray(liste)) {
            liste.forEach(a => {
                const match = a.epost.toLowerCase() === epost.toLowerCase() || 
                             (Array.isArray(a.paloggingsmail) && a.paloggingsmail.some(m => m.toLowerCase() === epost.toLowerCase()));
                
                if (match && a.kontaktlaerer && a.kontaktlaerer !== "Ingen") {
                    mineKlasser.push({ skoleaar: aar, klasse: a.kontaktlaerer });
                }
            });
        }
    }

    if (mineKlasser.length === 0) {
        historikkSeksjon.style.display = "none";
        return;
    }
    historikkSeksjon.style.display = "block";

    try {
        const snapshot = await firebase.database().ref('status').once('value');
        const statusData = snapshot.val();
        if (!statusData) throw new Error("Ingen data");

        const funneProever = [];

        for (const aar in statusData) {
            for (const fag in statusData[aar]) {
                for (const periode in statusData[aar][fag]) {
                    for (const trinn in statusData[aar][fag][periode]) {
                        const klasserITrinn = statusData[aar][fag][periode][trinn];
                        for (const klasseBokstav in klasserITrinn) {
                            const data = klasserITrinn[klasseBokstav];
                            const fulltKlasseNavn = trinn + klasseBokstav; 

                            const erMinKlasse = mineKlasser.some(k => 
                                k.skoleaar === aar && 
                                k.klasse.toUpperCase() === fulltKlasseNavn.toUpperCase()
                            );

                            if (erMinKlasse && data.laast === true) {
                                funneProever.push({
                                    navn: `${fag}-${fulltKlasseNavn}-${periode}`,
                                    skoleaar: aar,
                                    // Lagrer detaljer for URL-generering
                                    fag: fag,
                                    periode: periode,
                                    trinn: trinn,
                                    klasseBokstav: klasseBokstav
                                });
                            }
                        }
                    }
                }
            }
        }

        if (funneProever.length > 0) {
            funneProever.sort((a, b) => b.skoleaar.localeCompare(a.skoleaar));

            funneProever.forEach(p => {
                // Lager URL-en med parametere
                const url = `index.html?aar=${encodeURIComponent(p.skoleaar)}&periode=${encodeURIComponent(p.periode)}&fag=${encodeURIComponent(p.fag)}&trinn=${encodeURIComponent(p.trinn)}&klasse=${encodeURIComponent(p.klasseBokstav)}`;

                historikkHtml += `
                    <div style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; font-size: 13px; display: flex; align-items: center; justify-content: space-between;">
                        <a href="${url}" style="text-decoration: none; color: #1a73e8; font-weight: 500; display: flex; align-items: center; gap: 8px;">
                            <span>📄</span>
                            <span style="border-bottom: 1px solid transparent;" onmouseover="this.style.borderBottom='1px solid #1a73e8'" onmouseout="this.style.borderBottom='1px solid transparent'">
                                ${p.navn}
                            </span>
                        </a>
                        <span style="font-size: 10px; color: #27ae60; background: #e8f5e9; padding: 2px 8px; border-radius: 12px; border: 1px solid #c8e6c9; font-weight: bold;">
                            ${p.skoleaar}
                        </span>
                    </div>`;
            });
        } else {
            historikkHtml = '<p style="color: #999; font-size: 0.85em; padding: 15px; text-align: center;">Du er ikke registret som kontaktlærer, og/eller du har ingen fullførte prøver.</p>';
        }

    } catch (error) {
        console.error("Feil:", error);
        historikkHtml = '<p style="color: #e74c3c; font-size: 0.85em; padding: 15px; text-align: center;">Kunne ikke koble til databasen.</p>';
    }
    historikkListe.innerHTML = historikkHtml;
}

// --- TEGN TABELL (Inkludert gjennomsnitt og håndtering av ikke gjennomført) ---
async function tegnTabell() {
    // VAKT: Hvis admin-panelet er åpent, skal vi IKKE røre hovedsiden!
    const adminPanel = document.getElementById('adminPanel');
    if (adminPanel && adminPanel.style.display === 'block') {
        return; 
    }

    const vAar = document.getElementById('mAar').value;
    const vFag = document.getElementById('mFag').value;
    const vPeriode = document.getElementById('mPeriode').value;
    const vTrinn = document.getElementById('mTrinn').value;
    const vKlasse = document.getElementById('mKlasse').value;
    const tHead = document.getElementById('tHead');
    const tBody = document.getElementById('tBody');
    const actionButtons = document.getElementById('actionButtons'); // Referanse til knapperaden

    // SJEKK: Hvis ikke alle valg er tatt
    if (!vAar || !vFag || !vPeriode || !vTrinn || !vKlasse) {
        tBody.innerHTML = "<tr><td colspan='100%'>Vennligst velg alle kriterier...</td></tr>";
        if (actionButtons) actionButtons.style.display = 'none';
        const nyElevBoks = document.getElementById('nyElevSeksjon');
        if (nyElevBoks) nyElevBoks.style.display = 'none';
        return;
    }

    // 1. HENT STATUS FØRST (For å vite om navn skal være linker)
    const statusSti = `status/${vAar}/${vFag}/${vPeriode}/${vTrinn}/${vKlasse}`;
    const statusSnap = await db.ref(statusSti).once('value');
    const status = statusSnap.val();
    const erLaast = status && status.laast === true;

    // Oppdater UI-klasser og vis knapperaden
    if (erLaast) document.body.classList.add('is-locked'); 
    else document.body.classList.remove('is-locked');
    
    if (actionButtons) actionButtons.style.display = 'flex';
    oppdaterLaaseVisning(erLaast);

    // --- LOGIKK FOR Å HENTE OPPSETT ---
    // ENDRET: Vi bruker vAar direkte. Hvis den ikke finnes i oppgaveStruktur, gir vi feilmelding
    // i stedet for å tvinge den til 2025-2026.
    const oppsett = (oppgaveStruktur[vAar] && oppgaveStruktur[vAar][vFag] && oppgaveStruktur[vAar][vFag][vPeriode]) 
                    ? oppgaveStruktur[vAar][vFag][vPeriode][vTrinn] : null;

if (!oppsett) {
    tBody.innerHTML = `<tr><td colspan='100%'>Fant ikke mal for ${vFag} i skoleåret ${vAar}.</td></tr>`;
    if (actionButtons) actionButtons.style.display = 'none'; // Skjul knapper hvis mal mangler
    return;
}

    // 2. LAG TABELLHODE
    let hode = `<tr><th style="text-align:left">Elevnavn</th>`;
    oppsett.oppgaver.forEach(o => {
        const overskriftInnhold = o.bilde ? `<span class="hjelpe-ikon-tekst">${o.navn}<img src="${o.bilde}" class="oppgave-preview-bilde"></span>` : o.navn;
        hode += `<th style="text-align:center;">${overskriftInnhold}<br><small>max ${o.maks}</small></th>`;
    });
    hode += `<th>Sum<br><span style="font-size:10px; color:black;">(Kritisk: ≤${oppsett.grenseTotal})</span></th><th class="no-print">Handling</th></tr>`;
    tHead.innerHTML = hode;

    const vStartAarValgt = parseInt(vAar.split('-')[0]);
    let antallAktiveMedData = 0;
    let kolonneSummer = new Array(oppsett.oppgaver.length).fill(0);
    let totalSumKlasse = 0;
    let aktiveRader = "";
    let slettedeRader = "";

    // 3. GÅ GJENNOM ALLE ELEVER
    Object.keys(elevRegister).sort().forEach(navn => {
        const e = elevRegister[navn];
        const cTrinn = parseInt(e.startTrinn) + (vStartAarValgt - parseInt(e.startAar));
        const harBegynt = vStartAarValgt >= parseInt(e.startAar);
        const harIkkeSluttet = !e.sluttAar || vStartAarValgt <= parseInt(e.sluttAar);
        const erRiktigTrinnOgKlasse = (cTrinn === parseInt(vTrinn) && e.startKlasse === vKlasse);

        if (erRiktigTrinnOgKlasse && harBegynt && harIkkeSluttet) {
            const d = lagredeResultater[navn] || {};
            const erSlettet = d.slettet === true;
            const erIkkeGjennomfort = d.ikkeGjennomfort === true;
            

// LOGIKK FOR KLIKKBARE NAVN VED LÅST PRØVE
let visningsNavn = navn; // Standard: Bare navnet som tekst når prøven er ulåst

if (erSlettet) {
    // Hvis slettet, vis navnet i grått (eventuelt behold <b> hvis du ønsker)
    visningsNavn = `<span style="color: #a0aec0;">${navn}</span>`;
} 
else if (erLaast) {
    // KUN når prøven er låst blir det en blå link til historikken
    visningsNavn = `<a href="#" class="elev-link" onclick="visElevHistorikk('${navn}'); return false;">
                        ${navn}
                    </a>`;
} else {
    // Når prøven er ÅPEN: Vanlig tekst. 
    // Du kan bruke <b>${navn}</b> her hvis du vil ha navnene fete uansett,
    // men uten <a> blir de ikke klikkbare og får ikke blå farge fra CSS-en.
    visningsNavn = `<b>${navn}</b>`; 
}
            let printKlasse = erSlettet ? 'class="no-print"' : '';
            let radStil = erSlettet ? 'style="color: #a0aec0; background: #f7fafc;"' : (erIkkeGjennomfort ? 'style="background: #fff5f5;"' : '');

            let rad = `<tr ${printKlasse} ${radStil}><td style="text-align:left">${visningsNavn}</td>`;
            
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

            rad += `<td class="no-print">`;
            if (erSlettet) {
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
            if (erSlettet) slettedeRader += rad; else aktiveRader += rad;
        }
    });

    // 4. LAG GJENNOMSNITTSRAD
    let snittHtml = "";
    if (antallAktiveMedData > 0) {
        snittHtml = `<tr class="snitt-rad" style="background:#edf2f7; font-weight:bold;"><td style="text-align:left">Snitt ${vTrinn}${vKlasse}</td>`;
        kolonneSummer.forEach(sum => { snittHtml += `<td> ${(sum / antallAktiveMedData).toFixed(1)} </td>`; });
        snittHtml += `<td> ${(totalSumKlasse / antallAktiveMedData).toFixed(1)} </td><td class="no-print"></td></tr>`;
    }

    tBody.innerHTML = aktiveRader + snittHtml + slettedeRader;

    // 5. NY ELEV SEKSJON VISNING
    const nyElevBoks = document.getElementById('nyElevSeksjon');
    if (nyElevBoks) nyElevBoks.style.display = erLaast ? 'none' : 'block';
}

// <--- HER SLUTTER FUNKSJONEN. Ingen kode etter dette punktet før neste funksjon starter.

// <--- HER BEGYNNER ELEVHISTORIKK
function beregnVekt(aarStreng, periode) {
    // aarStreng er f.eks. "2024-2025", vi henter ut "2024"
    const aar = parseInt(aarStreng.split('-')[0]);
    // Høst får 1 poeng, Vår får 2 poeng
    const periodeVekt = (periode === 'Høst') ? 1 : 2;
    // Returnerer et tall, f.eks. 20241 eller 20242
    return (aar * 10) + periodeVekt;
}


let historikkChart = null; // Lagrer chart-objektet globalt
// <--- Egen kode for nullstill over
async function visElevHistorikk(navn) {
    const tbody = document.getElementById('historikkTabellBody');
    tbody.innerHTML = "<tr><td colspan='5'>Søker etter data...</td></tr>";
    
    // --- NY NAVNE-VASKER (Snu navn og fjerne komma) ---
    let visningsNavn = navn;
    if (navn.includes(',')) {
        const deler = navn.split(',');
        visningsNavn = `${deler[1].trim()} ${deler[0].trim()}`;
    }

    const valgtAar = document.getElementById('mAar').value;
    const valgtPeriode = document.getElementById('mPeriode').value;

    const hentVekt = (aarStreng, pStreng) => {
        const aar = parseInt(aarStreng.split('-')[0]);
        const pVekt = (pStreng === "Høst") ? 1 : 2;
        return (aar * 10) + pVekt;
    };

    const terskelVekt = hentVekt(valgtAar, valgtPeriode);

    // Oppdatert visning: Navnet er i fokus, (frem til...) er nøytral
    document.getElementById('historikkNavn').innerHTML = 
    `Historikk for ${visningsNavn} <span style="font-weight: normal; font-size: 0.85em; opacity: 0.8;">(frem til ${valgtPeriode} ${valgtAar})</span>`;
    
    document.getElementById('historikkModal').style.display = 'flex';
    document.body.classList.add('historikk-modus');

 const vFag = document.getElementById('mFag').value;
    
// --- DYNAMISK GENERERING AV ÅRSTALL ---
    let minAar = 2024; 
    let maksAar = new Date().getFullYear() + 1; 

    Object.values(elevRegister).forEach(e => {
        if (e.startAar && e.startAar < minAar) minAar = e.startAar;
        let innevaerendeAar = new Date().getFullYear();
        if (e.sluttAar && e.sluttAar > innevaerendeAar) {
            maksAar = innevaerendeAar + 1; 
        }
    });

    const tilgjengeligeAar = [];
    for (let aar = minAar; aar <= maksAar; aar++) {
        tilgjengeligeAar.push(`${aar}-${aar + 1}`);
    }
    // --------------------------------------

    const perioder = ["Høst", "Vår"];
    let alleHistorikkData = [];

    // --- DATASAMLING (Samme som før) ---
    for (const aar of tilgjengeligeAar) {
        for (const p of perioder) {
            try {
                const sti = `kartlegging/${aar}/${vFag}/${p}`;
                const snap = await db.ref(sti).once('value');
                const data = snap.val();

                if (data) {
                    Object.keys(data).forEach(trinn => {
                        Object.keys(data[trinn]).forEach(klasse => {
                            const alleIDenneKlassen = data[trinn][klasse];
                            const e = alleIDenneKlassen[navn];
                            
                            if (e && !e.slettet) {
                                const o = typeof hentOppsettSpesifikk === 'function' 
                                          ? hentOppsettSpesifikk(aar, vFag, p, trinn) 
                                          : null;

                                if (o) {
                                    const maksTotal = o.oppgaver.reduce((s, op) => s + op.maks, 0);
                                    const erUtfort = e.ikkeGjennomfort !== true; 

                                    let sumKlasse = 0, antallKlasse = 0;
                                    Object.values(alleIDenneKlassen).forEach(elev => {
                                        if (elev.sum !== undefined && !elev.slettet && elev.ikkeGjennomfort !== true) {
                                            sumKlasse += elev.sum;
                                            antallKlasse++;
                                        }
                                    });
                                    const snitt = antallKlasse > 0 ? (sumKlasse / antallKlasse / maksTotal) * 100 : 0;

                                    alleHistorikkData.push({
                                        aar, p, trinn, klasse,
                                        poeng: erUtfort ? e.sum : "Ikke utført",
                                        maks: maksTotal,
                                        grense: o.grenseTotal,
                                        prosent: erUtfort ? Math.round((e.sum / maksTotal) * 100) : null,
                                        grenseProsent: Math.round((o.grenseTotal / maksTotal) * 100),
                                        snittProsent: Math.round(snitt),
                                        statusTekst: erUtfort ? "" : "Ikke gjennomført"
                                    });
                                }
                            }
                        });
                    });
                }
            } catch (singleErr) {
                console.warn(`Kunne ikke lese periode ${p} for ${aar}:`, singleErr);
            }
        }
    }

    // --- NYTT: FILTRERING ---
    // Her fjerner vi alt som ligger "frem i tid" i forhold til valgt prøve i menyen
    let historikkData = alleHistorikkData.filter(d => {
        return hentVekt(d.aar, d.p) <= terskelVekt;
    });

    if (historikkData.length === 0) {
        tbody.innerHTML = `<tr><td colspan='5'>Ingen historikk funnet for ${navn} frem til ${valgtPeriode} ${valgtAar}.</td></tr>`;
        if (window.oppdaterHistorikkChart) oppdaterHistorikkChart([]); // Tøm grafen
        return;
    }

    // Sortering (Trinn -> Periode)
    historikkData.sort((a, b) => a.trinn - b.trinn || (a.p === "Høst" ? -1 : 1));

    // Oppdater tabell (samme logikk som du hadde)
    tbody.innerHTML = historikkData.map(d => {
        const erUtfort = d.prosent !== null;
        let skårFarge = '#7f8c8d'; 
        let poengStil = 'padding: 4px 8px;';
        
        if (erUtfort) {
            skårFarge = d.poeng <= d.grense ? '#e53e3e' : '#38a169';
            if (d.poeng <= d.grense) {
                poengStil += 'background-color: #fff5f5; color: #e53e3e; font-weight: bold;';
            }
        }

        const infoTekst = `${vFag}-${d.trinn}${d.klasse}-${d.p} ${d.aar}`;

        return `
        <tr style="line-height: 1.2;">
        <td style="text-align:left; padding: 4px 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${infoTekst}
        </td>
        <td style="text-align:center; ${poengStil}">${d.poeng}</td>
        <td style="text-align:center; padding: 4px 8px;">${d.grense}</td>
        <td style="text-align:center; padding: 4px 8px;">${d.maks}</td>
        <td style="text-align:center; font-weight:bold; color: ${skårFarge}; padding: 4px 8px;">
            ${erUtfort ? d.prosent + '%' : 'Ikke gjennomført'}
        </td>
    </tr>
        `;
    }).join('');

    // Tegn grafen med de filtrerte dataene
    if (window.oppdaterHistorikkChart) oppdaterHistorikkChart(historikkData);
}

// <--- HER BEGYNNER CHARTELEVHISTORIKK
function oppdaterHistorikkChart(historikkData) {
    const ctx = document.getElementById('historikkChart').getContext('2d');
    
    // Hvis det finnes en graf fra før, slett den for å unngå flimring
    if (historikkChart) {
        historikkChart.destroy();
    }

    const labels = historikkData.map(d => `${d.p} ${d.aar.split('-')[0]}`); // F.eks "Høst 2024"
    const elevSkår = historikkData.map(d => d.prosent);
    
    // Vi setter en fast verdi på 100 på Y-aksen så det er lett å lese
    historikkChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
label: 'Elevens skår (%)',
        data: historikkData.map(d => d.prosent),
        borderColor: '#3182ce',
        backgroundColor: 'rgba(49, 130, 206, 0.1)',
        borderWidth: 3,
        pointRadius: 5,
        fill: true,
        tension: 0.3,
        spanGaps: false // Sikrer brudd ved "Ikke gjennomført"
    },
{
label: 'Klassens snitt (%)',
        data: historikkData.map(d => d.snittProsent),
        borderColor: '#ed8936',
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0
    },
{
        label: 'Kritisk grense (%)',
        data: historikkData.map(d => d.grenseProsent),
        borderColor: '#e53e3e', // Rød farge
        borderWidth: 2,
        borderDash: [2, 2], // Kortstiplet linje
        fill: false,
        pointRadius: 0,
        order: 1 // Legger denne litt i bakgrunnen
    }
]
        },

 options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
        y: {
            beginAtZero: true,
            // 1. Vi setter max til 110 for å gi god plass til punkter på 100%
            max: 110, 
            title: { 
                display: true, 
                text: 'Prosent (%)' 
            },
            ticks: {
                // 2. Vi tvinger aksen til å bare vise tall opp til 100
                // Dette fjerner "110"-merket så diagrammet ser ryddig ut
                callback: function(value) {
                    if (value <= 100) return value + '%';
                },
                // Valgfritt: Tvinger faste hopp (0, 20, 40, 60, 80, 100)
                stepSize: 20 
            }
        }
    },
    plugins: {
        legend: { 
            position: 'top',
            // 3. Legger til litt ekstra avstand mellom merkelappene og selve grafen
            labels: {
                padding: 20
            }
        }
    },
    // 4. Legger til padding i selve tegneområdet for å unngå at linjen berører kanten
    layout: {
        padding: {
            top: 10 
        }
    }
}
});
}

function skrivUtHistorikk() {
    const modalInnhold = document.querySelector('#historikkModal .modal-body-scroll');
    if (!modalInnhold) {
        alert("Fant ikke historikk-data");
        return;
    }

    // Henter navnet som vi allerede har snudd i visElevHistorikk
    const navneFelt = document.querySelector('#historikkNavn');
    let formatertNavn = "Elevhistorikk";
    
    if (navneFelt) {
        // Vi henter teksten og stopper før "(frem til...)"
        // Vi fjerner også "Historikk for " fra starten
        let råTekst = navneFelt.innerText;
        formatertNavn = råTekst.split('(')[0].replace("Historikk for ", "").trim();
    }

    // 1. KLON
    const printKopi = modalInnhold.cloneNode(true);
    printKopi.id = "temp-print-historikk";
    printKopi.style.maxHeight = "none";
    printKopi.style.overflow = "visible";

    // 2. Grafer
    const originaleCanvaser = modalInnhold.querySelectorAll('canvas');
    const kopierteCanvaser = printKopi.querySelectorAll('canvas');
    
    originaleCanvaser.forEach((origCanvas, index) => {
        const destCanvas = kopierteCanvaser[index];
        if (destCanvas) {
            destCanvas.width = origCanvas.width;
            destCanvas.height = origCanvas.height;
            destCanvas.style.width = "100%";
            destCanvas.style.height = "auto"; 
            destCanvas.style.maxHeight = "280px"; // Litt lavere for å sikre 1 side

            const destCtx = destCanvas.getContext('2d');
            destCtx.drawImage(origCanvas, 0, 0);
        }
    });

    // 3. Ren overskrift til print
    const overskrift = document.createElement('h3');
    overskrift.style.color = "#2c3e50";
    overskrift.style.textAlign = "center";
    overskrift.style.margin = "0 0 10px 0";
    overskrift.style.fontSize = "18px";
    overskrift.innerText = `Historikk for ${formatertNavn}`;
    printKopi.prepend(overskrift);

    // 4. Print-gjennomføring
    document.body.classList.add('historikk-modus');
    document.body.appendChild(printKopi);

    setTimeout(() => {
        window.print();
        setTimeout(() => {
            const kopi = document.getElementById('temp-print-historikk');
            if (kopi) document.body.removeChild(kopi);
            document.body.classList.remove('historikk-modus');
        }, 500);
    }, 500);
}

function lukkHistorikk() {
    const modal = document.getElementById('historikkModal');
    if (modal) modal.style.display = 'none';
    document.body.classList.remove('historikk-modus');

    // VIKTIG: Slett grafen slik at den kan tegnes på nytt for neste elev
    if (window.historikkChart instanceof Chart) {
        window.historikkChart.destroy();
        window.historikkChart = null;
    }
}
// <--- HER SLUTTER ELEVHISTORIKK MED CHART

function nullstillElev(navn) {
    if (confirm(`Vil du tømme alle poeng for ${navn}? Eleven blir stående i listen, men poengene fjernes.`)) {
        db.ref(hentSti(navn)).remove()
        .then(() => {
            console.log("Data nullstilt for " + navn);
            // Vi henter data på nytt fra Firebase for å tømme lagredeResultater[navn]
            if (typeof hentData === "function") {
                hentData(); // Denne pleier å kalle tegnTabell() til slutt
            } else {
                tegnTabell();
            }
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
await db.ref(statusSti).set({ 
    laast: skalLaase, 
    endretAv: firebase.auth().currentUser.email,
    dato: new Date().toLocaleString()
});

// Dette kallet alene vil nå oppdatere BÅDE navnene (linkene) 
// OG knappene/fargene (siden tegnTabell kaller oppdaterLaaseVisning)
await tegnTabell();
}

function oppdaterLaaseVisning(erLaast) {
    const tabell = document.getElementById('hovedTabell');
    const knapp = document.getElementById('btnFerdigstill');
    const importKnapp = document.getElementById('btnImport'); // Henter import-knappen
    const tekstElement = document.getElementById('lockText');
    const ikonElement = knapp.querySelector('.btn-icon');
    const leggTilElevSeksjon = document.getElementById('nyElevSeksjon');

    if (erLaast) {
        tabell.classList.add('is-locked');
        if (tekstElement) tekstElement.innerText = "Ferdigstilt!";
        if (ikonElement) ikonElement.innerText = "🔒";
        knapp.style.backgroundColor = "#27ae60"; // Grønn for gjenåpne

// Skjul seksjonen helt når prøven er ferdigstilt
        if (leggTilElevSeksjon) {
            leggTilElevSeksjon.style.display = 'none';
        }        
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
        if (ikonElement) ikonElement.innerText = "🔓";
        knapp.style.backgroundColor = "#d35400"; // Oransje for ferdigstille

// Vis seksjonen igjen når prøven åpnes for redigering
        if (leggTilElevSeksjon) {
            leggTilElevSeksjon.style.display = 'block';
        }
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
    
    const loggArray = Object.values(loggData).sort((a, b) => b.innLogget - a.innLogget);
    window.gjeldendeLoggData = loggArray;

    const totalt = loggArray.length;
    const sjuDagerSiden = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const sisteUke = loggArray.filter(l => l.innLogget > sjuDagerSiden).length;

    // --- LOGIKK FOR UNIKE BRUKERE ---
    // Vi lager et objekt hvor hver e-post er en nøkkel for å finne siste aktivitet
    const unikeMap = {};
    loggArray.forEach(l => {
        if (!unikeMap[l.epost]) {
            unikeMap[l.epost] = {
                navn: l.navn,
                sistInne: l.innLogget,
                antall: 0
            };
        }
        unikeMap[l.epost].antall++;
    });
    const unikeBrukereListe = Object.values(unikeMap).sort((a, b) => b.sistInne - a.sistInne);
    const antallUnike = unikeBrukereListe.length;

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
            <div><small>Unike brukere</small><br><strong>${antallUnike}</strong></div>
        </div>

        <div style="margin-bottom: 15px;">
            <label style="font-size: 0.85em; font-weight: bold; color: #4a5568; display: block; margin-bottom: 5px;">Brukere som har vært pålogget:</label>
            <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px; scrollbar-width: thin;">
                ${unikeBrukereListe.map(u => `
                    <div style="flex: 0 0 auto; background: white; border: 1px solid #cbd5e0; padding: 6px 10px; border-radius: 20px; font-size: 0.8em; display: flex; align-items: center; gap: 5px;">
                        <div style="width: 8px; height: 8px; border-radius: 50%; background: ${ (Date.now() - u.sistInne < 600000) ? '#48bb78' : '#cbd5e0' };"></div>
                        <strong>${u.navn}</strong> 
                        <span style="color: #718096;">(${u.antall})</span>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
            <input type="text" id="loggSok" placeholder="Søk i full historikk..." 
                style="flex-grow: 1; margin-bottom: 0;" onkeyup="filtrerLogg()">
            <button class="btn btn-danger" onclick="slettHeleLoggen()" style="font-size: 0.85em;">Tøm logg</button>
        </div>

        <div id="loggTabellContainer" style="max-height: 350px; overflow-y: auto; border: 1px solid #eee; border-radius: 4px;">
            <table id="systemLoggTabell">
                <thead style="position: sticky; top: 0; background: white; z-index: 5;">
                    <tr><th>Bruker</th><th>Innlogget</th><th>Varighet</th></tr>
                </thead>
                <tbody>`;

    // Tabell-generering (samme som før)
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
    
    const d = lagredeResultater[navn] || {};
    const eksisterende = d.oppgaver || [];
    const erIkkeGjennomfort = d.ikkeGjennomfort === true;

    oppsett.oppgaver.forEach((o, i) => {
        const poeng = eksisterende[i] !== undefined ? eksisterende[i] : "";
        const deaktivert = erIkkeGjennomfort ? 'disabled' : '';
        
        // Sjekk initial farge hvis data finnes
        const erUnderGrense = (o.grense !== -1 && poeng !== "" && poeng <= o.grense);
        const fargeStil = erUnderGrense ? 'background-color: #ffdce0; border: 1px solid red;' : '';

        container.innerHTML += `
            <div class="oppgave-rad" style="margin-bottom:8px; display: flex; flex-direction: column; border-bottom: 1px dotted #eee; padding-bottom: 5px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <label style="font-size: 13px;">${o.navn} <small>(maks ${o.maks})</small>:</label>
                    <input type="number" 
                        class="oppg-input" 
                        data-index="${i}" 
                        min="0" 
                        max="${o.maks}" 
                        value="${poeng}" 
                        ${deaktivert} 
                        style="width:65px; padding: 5px; text-align: center; ${fargeStil}"
                        oninput="validerInputPoeng(this, ${o.grense}, ${o.maks})">
                </div>
                <div id="error-${i}" class="input-error-msg"></div>
            </div>`;
    });

    document.getElementById('modal').style.display = 'block';
// NYTT: Sett fokus i det første input-feltet automatisk
    setTimeout(() => {
        const førsteFelt = container.querySelector('.oppg-input');
        if (førsteFelt) {
            førsteFelt.focus();
            førsteFelt.select(); // Dette gjør at hvis det står et tall der fra før, blir det markert slik at du bare kan skrive over
        }
    }, 100); // En liten forsinkelse på 100ms sikrer at nettleseren har tegnet ferdig feltet før vi prøver å gi det fokus
}

function validerInputPoeng(input, grense, maks) {
    const verdi = input.value;
    const poeng = parseInt(verdi);
    const errorDiv = document.getElementById(`error-${input.dataset.index}`);
    const lagreKnapp = document.getElementById('lagreKnapp'); // Antar knappen din heter dette

    // Nullstill feilmelding og stil
    errorDiv.innerText = "";
    input.classList.remove('input-invalid');
    input.style.backgroundColor = "";
    input.style.border = "1px solid #ccc";

    if (verdi === "") return;

    // 1. Sjekk om poeng er høyere enn maks
    if (poeng > maks) {
        input.classList.add('input-invalid');
        errorDiv.innerText = `⚠️ Kan ikke være mer enn ${maks}`;
        // Deaktiver lagre-knappen så man ikke kan lagre feil
        if(lagreKnapp) lagreKnapp.disabled = true;
        return;
    }

    // 2. Hvis poeng er OK, sjekk om alle andre felter også er OK før vi re-aktiverer lagring
    const alleInputs = document.querySelectorAll('.oppg-input');
    let harFeil = false;
    alleInputs.forEach(inp => {
        if(parseInt(inp.value) > parseInt(inp.max)) harFeil = true;
    });
    if(lagreKnapp) lagreKnapp.disabled = harFeil;

    // 3. Farge-logikk for kritisk grense (hvis poeng er gyldig)
    if (grense !== -1 && poeng <= grense) {
        input.style.backgroundColor = "#ffdce0";
        input.style.border = "1px solid red";
    }
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


//--- INFO - LÆRERVEILEDNING
function aapneVeiledning() {
    const modal = document.getElementById('modalVeiledning');
    if (modal) {
        modal.style.display = 'block';
    }
}

// --- ÉN felles lytter for alle klikk i hele systemet ---
window.addEventListener('click', function(event) {
    const modalKonto = document.getElementById('modalKonto');
    const modalVeiledning = document.getElementById('modalVeiledning');
    const modalVelkomst = document.getElementById('modalVelkomst');
    const modalOppgaver = document.getElementById('modalOppgaver'); // Lagt til
    const modalKontaktAdmin = document.getElementById('modalKontaktAdmin'); // Lagt til for meldinger
    const modalHistorikk = document.getElementById('historikkModal');
    const dropdown = document.getElementById("userDropdown");

    // 1. Lukk dropdown hvis man klikker utenfor .user-pill
    if (!event.target.closest('.user-pill')) {
        if (dropdown && dropdown.classList.contains('show')) {
            dropdown.classList.remove('show');
        }
    }

    // 2. Lukk modaler hvis man klikker på den mørke bakgrunnen
    if (event.target === modalKonto) lukkKonto();
    if (event.target === modalVeiledning) lukkVeiledning();
    if (event.target === modalVelkomst) lukkVelkomst();
    
    // 3. Nye sjekker for de siste modalene vi laget
    if (event.target === modalOppgaver) lukkOppgaveOversikt();
    if (event.target === modalKontaktAdmin) lukkKontaktAdmin();
    if (event.target === modalHistorikk) lukkHistorikk();
});

// --- LÆRERSIDE ---
function oppdaterLaererListe() {
    const sok = document.getElementById('sokLaerer').value.toLowerCase();
    const valgtAar = document.getElementById('valgtAarLaerer').value; 
    const container = document.getElementById('laererListeContainer');
    const gjeldendeAnsatte = window.ansatteData && window.ansatteData[valgtAar] ? window.ansatteData[valgtAar] : [];

    let filtrerte = gjeldendeAnsatte.filter(a => 
        a.navn.toLowerCase().includes(sok) || 
        (Array.isArray(a.paloggingsmail) ? a.paloggingsmail.join(" ").toLowerCase().includes(sok) : (a.paloggingsmail || "").toLowerCase().includes(sok))
    );

    filtrerte.sort((a, b) => {
        const verdiA = a.trinn && a.trinn.length > 0 ? a.trinn[0] : "";
        const verdiB = b.trinn && b.trinn.length > 0 ? b.trinn[0] : "";

        const erTallA = !isNaN(parseInt(verdiA));
        const erTallB = !isNaN(parseInt(verdiB));

        if (erTallA && !erTallB) return -1;
        if (!erTallA && erTallB) return 1;

        if (erTallA && erTallB) {
            const numA = parseInt(verdiA);
            const numB = parseInt(verdiB);
            if (numA !== numB) return numA - numB;
            
            const klasseA = a.kontaktlaerer ? String(a.kontaktlaerer).toLowerCase() : "zzz";
            const klasseB = b.kontaktlaerer ? String(b.kontaktlaerer).toLowerCase() : "zzz";
            if (klasseA !== klasseB) return klasseA.localeCompare(klasseB);
        }

        if (!erTallA && !erTallB) {
            if (verdiA !== verdiB) return verdiA.localeCompare(verdiB);
        }

        return a.navn.localeCompare(b.navn);
    });

    let html = `
        <div style="max-height: 500px; overflow-y: auto; border: 1px solid #ddd;">
            <table style="width:100%; border-collapse: collapse;">
                <thead>
                    <tr style="position: sticky; top: 0; background: #f2f2f2; color: black; z-index: 10;">
                        <th style="padding:12px; text-align:left; border-bottom:2px solid #2c3e50;">Navn / Påloggingsmail</th>
                        <th style="padding:12px; text-align:left; border-bottom:2px solid #2c3e50;">Trinn</th>
                        <th style="padding:12px; text-align:left; border-bottom:2px solid #2c3e50;">Rolle/Klasse</th>
                    </tr>
                </thead>
                <tbody>`;

    filtrerte.forEach(a => {
        const trinnVisning = a.trinn && a.trinn.length > 0 ? a.trinn.join(", ") + ". trinn" : "Ikke satt";
        const rolleVisning = a.kontaktlaerer === "adm" ? "Administrasjon" : (a.kontaktlaerer || "Lærer");

        // NY LOGIKK: Formaterer påloggingsmail (håndterer både tekst og liste/array)
        let visningsMail = "";
        if (Array.isArray(a.paloggingsmail)) {
            visningsMail = a.paloggingsmail.join(", ");
        } else {
            visningsMail = a.paloggingsmail || "Mangler";
        }

        html += `
            <tr style="border-bottom:1px solid #eee; cursor:pointer;" onclick="visLaererDetaljer('${a.epost}')" class="laerer-rad">
                <td style="padding:10px;">
                    <strong>${a.navn}</strong><br>
                    <small style="color:#007bff; font-family: monospace;">${visningsMail}</small>
                </td>
                <td style="padding:10px;">${trinnVisning}</td>
                <td style="padding:10px;">${rolleVisning}</td>
            </tr>`;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = filtrerte.length > 0 ? html : `<p style="padding:20px; text-align:center;">Ingen ansatte funnet for skoleåret ${valgtAar}.</p>`;
}


// --- LÆRERDETALJER (Endelig korrigert versjon)
async function visLaererDetaljer(valgtEpost) {
    // 1. Hent alle tilgjengelige år fra ansatteData
    const alleAar = Object.keys(window.ansatteData);
    
    // 2. Finn læreren og samle alle e-poster de har brukt
    let mineIder = new Set([valgtEpost.toLowerCase().trim()]);
    let laererNavn = "";

    alleAar.forEach(aar => {
        const ansattIAar = window.ansatteData[aar].find(a => a.epost === valgtEpost);
        if (ansattIAar) {
            if (!laererNavn) laererNavn = ansattIAar.navn;
            
            if (ansattIAar.paloggingsmail) {
                if (Array.isArray(ansattIAar.paloggingsmail)) {
                    ansattIAar.paloggingsmail.forEach(m => mineIder.add(m.toLowerCase().trim()));
                } else {
                    mineIder.add(ansattIAar.paloggingsmail.toLowerCase().trim());
                }
            }
        }
    });

if (!laererNavn) return;

    // Oppdater UI
    document.getElementById('detaljerNavn').innerText = `Statistikk for ${laererNavn}`;
    document.getElementById('modalLaererDetaljer').style.display = 'block';

    // ============================================================
    // HER LIMER DU INN DENNE DELEN:
    // ============================================================
    const loggSnapshot = await db.ref('systemLogg').once('value');
    const loggData = loggSnapshot.val() || {};
    const mineIderArray = Array.from(mineIder); // Gjør Set om til liste for filter

    const antallInnlogginger = Object.values(loggData).filter(l => {
        if (!l.epost) return false;
        // Sjekker om eposten i loggen (i små bokstaver) finnes i din samling av ID-er
        return mineIderArray.includes(l.epost.toLowerCase().trim());
    }).length;

    document.getElementById('detaljerInnlogginger').innerText = antallInnlogginger;
    // ============================================================

    let totaltAntallProever = 0;
    let tabellHtml = `
        <div style="max-height: 450px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px;">
            <table style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr style="position: sticky; top: 0; background:#f2f2f2; color:black; z-index: 10;">
                        <th style="padding:10px; text-align:left;">Prøve / Skoleår</th>
                        <th style="padding:10px; text-align:center;">Elever</th>
                        <th style="padding:10px; text-align:center;">Snitt %</th>
                        <th style="padding:10px; text-align:center;">Under kritisk</th>
                        <th style="padding:10px; text-align:left;">Dato</th>
                    </tr>
                </thead>
                <tbody>`;

    // 3. Gå gjennom hvert år (Her var feilen: 'av' er nå endret til 'of')
    for (const aar of alleAar) {
        const statusSnapshot = await db.ref(`status/${aar}`).once('value');
        const statusData = statusSnapshot.val() || {};

        for (let fag in statusData) {
            for (let periode in statusData[fag]) {
                for (let trinn in statusData[fag][periode]) {
                    for (let klasse in statusData[fag][periode][trinn]) {
                        const info = statusData[fag][periode][trinn][klasse];
                        const registrertAv = (info.endretAv || "").toLowerCase().trim();

                        if (mineIder.has(registrertAv)) {
                            const oppsett = oppgaveStruktur[aar]?.[fag]?.[periode]?.[trinn];
                            if (!oppsett) continue;

                            const maksPrElev = oppsett.oppgaver.reduce((s, o) => s + o.maks, 0);
                            const kritiskGrense = oppsett.grenseTotal;

                            const kartSnapshot = await db.ref(`kartlegging/${aar}/${fag}/${periode}/${trinn}/${klasse}`).once('value');
                            const elever = kartSnapshot.val() || {};

                            let totaltIKlassen = Object.keys(elever).length;
                            let deltakere = 0;
                            let sumPoeng = 0;
                            let underKritisk = 0;

                            Object.values(elever).forEach(elev => {
                                if (elev && elev.sum !== undefined && elev.sum !== "" && elev.sum !== "Ikke deltatt" && !elev.ikkeGjennomfort) {
                                    const p = parseFloat(elev.sum);
                                    if (!isNaN(p)) {
                                        deltakere++;
                                        sumPoeng += p;
                                        if (p < kritiskGrense) underKritisk++;
                                    }
                                }
                            });

                            if (deltakere > 0) {
                                totaltAntallProever++;
                                const snitt = Math.round((sumPoeng / (deltakere * maksPrElev)) * 100);
                                
                                tabellHtml += `
                                    <tr style="border-bottom:1px solid #ddd;">
                                        <td style="padding:10px;">
                                            <strong>${fag}-${trinn}${klasse}-${periode}</strong><br>
                                            <small style="color: #666;">Skoleår: ${aar}</small>
                                        </td>
                                        <td style="padding:10px; text-align:center;">${deltakere} / ${totaltIKlassen}</td>
                                        <td style="padding:10px; text-align:center; font-weight:bold;">${snitt}%</td>
                                        <td style="padding:10px; text-align:center; color:${underKritisk > 0 ? '#e74c3c' : '#27ae60'};">
                                            <strong>${underKritisk}</strong>
                                        </td>
                                        <td style="padding:10px;"><small>${info.dato ? info.dato.split(',')[0] : "-"}</small></td>
                                    </tr>`;
                            }
                        }
                    }
                }
            }
        }
    }

    tabellHtml += `</tbody></table></div>`;
    document.getElementById('detaljerAntallProever').innerText = totaltAntallProever;
    document.getElementById('laererProeveListe').innerHTML = totaltAntallProever > 0 ? tabellHtml : "<p style='padding:20px;'>Ingen prøver funnet.</p>";
}
// ---SLUTT PÅ LÆRERDETALJER


function aapneLaererModal() {
    const modal = document.getElementById('modalLaerere');
    const select = document.getElementById('valgtAarLaerer');
    
    if (modal && select) {
        // 1. Tøm eksisterende valg i menyen
        select.innerHTML = '';

        // 2. Hent alle årstall fra ansatte.js (nøklene i objektet)
        const tilgjengeligeAar = Object.keys(window.ansatteData).sort().reverse();

        // 3. Fyll menyen dynamisk
        tilgjengeligeAar.forEach(aar => {
            const option = document.createElement('option');
            option.value = aar;
            // Gjør visningen penere (bytter - med /)
            option.textContent = aar.replace('-', '/');
            select.appendChild(option);
        });

        // 4. Vis modalen og oppdater listen
        modal.style.display = 'block';
        oppdaterLaererListe();
    } else {
        console.error("Fant ikke modal eller meny i HTML-en!");
    }
}
// --- SLUTT LÆRERSIDE ---

// --- ÅPNE GJENNOMFØRINGSMODAL ---
function aapneGjennomfoeringModal() {
    console.log("Åpner gjennomføringsmodal...");
    const modal = document.getElementById('modalGjennomfoering');
    if (modal) {
        modal.style.display = 'flex';
        genererGjennomfoeringsData();
    } else {
        console.error("Fant ikke modalGjennomfoering i HTML");
    }
}

// --- HJELPEFUNKSJON FOR Å FINNE LÆRER ---
function finnKontaktlaererForKlasse(klasseNavn, aar) {
    // Sjekk om variabelen eksisterer
    if (typeof ansatteData === 'undefined') {
        console.warn("ansatteData er ikke definert. Sjekk ansatte.js");
        return { navn: "Data mangler", epost: "" };
    }

    // Tar "2024" ut fra f.eks "2024-2025"
    const rentAar = aar.toString().substring(0, 4);
    
    // Finn riktig skoleår i ansatteData (f.eks "2024-2025")
    const skoleaarKey = Object.keys(ansatteData).find(key => key.startsWith(rentAar));
    
    if (!skoleaarKey) return { navn: "Ingen liste for " + rentAar, epost: "" };

    const liste = ansatteData[skoleaarKey];
    const funnet = liste.find(a => a.kontaktlaerer === klasseNavn);

    return funnet ? { navn: funnet.navn, epost: funnet.epost } : { navn: "Ikke tildelt", epost: "" };
}

// --- HENTE ANTALL ELEVER ---
function hentAntallEleverIRegister(klasseNavn, aar) {
    const register = window.elevRegister;
    if (!register) return 0;

    let teller = 0;
    const sokeAar = parseInt(aar.toString().substring(0, 4));
    
    // Gjør søket ufølsomt for små/store bokstaver og mellomrom
    const sokKlasse = klasseNavn.toString().toUpperCase().trim();

    for (let elevNavn in register) {
        const info = register[elevNavn];
        
        const innevaerendeTrinn = (sokeAar - info.startAar) + info.startTrinn;
        
        // Tvinger register-data til store bokstaver for matching
        const klasseBokstav = info.startKlasse.toString().toUpperCase().trim();
        const fulltNavnFraRegister = innevaerendeTrinn + klasseBokstav; 

        if (fulltNavnFraRegister === sokKlasse) {
            if (sokeAar >= info.startAar && sokeAar <= info.sluttAar) {
                teller++;
            }
        }
    }
    return teller;
}

// --- EMAILJS - UT  ---
function sendEpostViaEmailJS(laererNavn, laererEpost, proeveNavn, sideUrl, stisti) {
    const params = {
        laererNavn: laererNavn,
        laererEpost: laererEpost,
        proeveNavn: proeveNavn,
        sideUrl: sideUrl
    };
    emailjs.send("service_paj6cqb", "template_2foprtm", params)
        .then(() => {
            // Lagre logg i Firebase
            const nå = new Date();
            const tidsstempel = nå.toLocaleString('no-NO', { 
                day: '2-digit', month: '2-digit', year: '2-digit', 
                hour: '2-digit', minute: '2-digit' 
            });

            // Vi pusher en ny logg-oppføring til denne spesifikke prøven
            db.ref('purrelogg/' + stisti).push(tidsstempel);

            alert("✅ E-post sendt!\nLogg er oppdatert.");
            genererGjennomfoeringsData(); // Oppdaterer tabellen så loggen vises med en gang
        })
        .catch((err) => {
            console.error("EmailJS Feil:", err);
            alert("❌ Feil ved sending.");
        });
}

// --- EMAILJS - INN ---
// Åpne og lukke modal
function aapneKontaktAdmin() {
    document.getElementById('modalKontaktAdmin').style.display = 'block';
    const dropdown = document.getElementById("userDropdown");
    if (dropdown) dropdown.classList.remove("show");
}

function lukkKontaktAdmin() {
    document.getElementById('modalKontaktAdmin').style.display = 'none';
    document.getElementById('adminKontaktTekst').value = ""; // Tøm feltet
}

// Sende-funksjonen
function sendMeldingTilAdmin() {
    const meldingTekst = document.getElementById('adminKontaktTekst').value;
    const sendKnapp = document.getElementById('btnSendAdminMelding');
    
    if (!meldingTekst.trim()) {
        return alert("Vennligst skriv en melding før du sender.");
    }

    // Hent navn på innlogget lærer (fra userInfo som vi satte opp i authState)
    const fraNavn = document.getElementById('userInfo').innerText;
    const fraEpost = localStorage.getItem('brukerEpost') || "Ukjent e-post";

    sendKnapp.disabled = true;
    sendKnapp.innerText = "Sender...";

    const params = {
        fraNavn: fraNavn,
        fraEpost: fraEpost,
        melding: meldingTekst
    };

    // Bruk samme service_id som i din forrige funksjon, 
    // men bytt til din nye template_id (f.eks. template_admin_melding)
    emailjs.send("service_paj6cqb", "template_gtjtsmj", params)
        .then(() => {
            alert("✅ Meldingen er sendt til administrator.");
            lukkKontaktAdmin();
            sendKnapp.disabled = false;
            sendKnapp.innerText = "Send melding";
        })
        .catch((err) => {
            console.error("EmailJS Feil:", err);
            alert("❌ Feil ved sending av melding.");
            sendKnapp.disabled = false;
            sendKnapp.innerText = "Send melding";
        });
}

// --- HJELPEFUNKSJON FOR Å BEHANDLE DATA PER KLASSE ---
// --- HJELPEFUNKSJON FOR Å BEHANDLE DATA PER KLASSE ---
function behandleKlasseData(aar, fag, periode, trinn, klasse, eleverObjekt, statuser, alleLogger) {
    let resultat = { htmlTotal: "", htmlIkkeFerdig: "", harApne: false };
    
    let fulltKlasseNavn = klasse;
    if (trinn && !klasse.includes(trinn)) {
        fulltKlasseNavn = trinn + klasse;
    }

    const totaltAntallElever = hentAntallEleverIRegister(fulltKlasseNavn.trim().toUpperCase(), aar);
    if (!eleverObjekt) return resultat; 

    let antallGjennomfoert = 0;
    let sumOppnaaddPoeng = 0;
    let maksMuligPoengForKlassen = 0;

    let infoFraOppsett = oppgaveStruktur[aar]?.[fag]?.[periode]?.[trinn];
    let korrektMaksPoengPerElev = 30; 

    if (infoFraOppsett && infoFraOppsett.oppgaver) {
        korrektMaksPoengPerElev = infoFraOppsett.oppgaver.reduce((acc, oppg) => acc + (oppg.maks || 0), 0);
    }

    Object.entries(eleverObjekt).forEach(([id, node]) => {
        if (id === "laast" || id === "ferdigstilt" || typeof node !== 'object') return;
        let råPoeng = node.sum;
        const markertSomIkkeGjennomfoert = node.ikkeGjennomfort === true;
        const harGyldigResultat = (råPoeng !== undefined && råPoeng !== null && råPoeng !== "" && !markertSomIkkeGjennomfoert);

        if (harGyldigResultat) {
            const p = parseFloat(råPoeng);
            if (!isNaN(p)) {
                antallGjennomfoert++;
                sumOppnaaddPoeng += p;
                maksMuligPoengForKlassen += korrektMaksPoengPerElev;
            }
        }
    });

    let snittVisning = "0%"; 
    if (maksMuligPoengForKlassen > 0) {
        snittVisning = Math.round((sumOppnaaddPoeng / maksMuligPoengForKlassen) * 100) + "%";
    }

    // --- ENDRET: Henter alle lærere for denne klassen ---
    const alleLaerere = (window.ansatteData && window.ansatteData[aar]) 
        ? window.ansatteData[aar].filter(a => a.kontaktlaerer === fulltKlasseNavn.trim().toUpperCase() || a.kontaktlaerer === klasse)
        : [];

    const laererNavnVisning = alleLaerere.length > 0 
        ? alleLaerere.map(l => l.navn).join(" / ") 
        : "Ikke tildelt";

    // MERK: Linjen "const laererEpost = ..." er fjernet fordi vi nå looper gjennom alleLaerere lenger nede

    const statusObj = statuser[aar]?.[fag]?.[periode]?.[trinn]?.[klasse] || {};
    const erLaast = statusObj.laast || false;
    const statusTekst = erLaast ? "<span style='color:green; font-weight:bold;'>✅ Ferdig</span>" : "<span style='color:red; font-weight:bold;'>⚠️ Pågår</span>";

    // Bygg rad for hovedtabellen - Bruker nå laererNavnVisning
    resultat.htmlTotal = `<tr>
        <td style="text-align:left;">${fag} - ${periode} ${aar}</td>
        <td><b>${fulltKlasseNavn}</b></td>
        <td>${laererNavnVisning}</td>
        <td>${antallGjennomfoert} / ${totaltAntallElever}</td>
        <td style="font-weight:bold;">${snittVisning}</td>
        <td>${statusTekst}</td>
    </tr>`;

    // Bygg rad for purrelisten hvis ikke ferdig
    if (!erLaast) {
        resultat.harApne = true;
        const stisti = `${aar}/${fag}/${periode}/${trinn}/${klasse}`;
        const proeveNavnFullt = `${fag} (${fulltKlasseNavn}) - ${periode} ${aar}`;
        const sideUrl = window.location.origin + window.location.pathname;
        const loggForDenne = alleLogger[aar]?.[fag]?.[periode]?.[trinn]?.[klasse] || {};
        const loggHtml = Object.values(loggForDenne).length > 0 ? 
            `<ul style="font-size:0.7em; color:gray; list-style:none; padding:0; margin:5px 0;">
                ${Object.values(loggForDenne).map(tid => `<li>Sist sendt: ${tid}</li>`).join('')}
            </ul>` : "";

        let knapperHtml = "";
        if (alleLaerere.length > 0) {
            alleLaerere.forEach(l => {
                if (l.epost) {
                    knapperHtml += `
                    <button onclick="sendEpostViaEmailJS('${l.navn}', '${l.epost}', '${proeveNavnFullt}', '${sideUrl}', '${stisti}')" 
                            class="btn" style="background-color:#27ae60; color:white; border:none; padding:5px 8px; cursor:pointer; border-radius:4px; margin: 2px; font-size: 10px;">
                        📧 Purr ${l.navn.split(' ')[0]}
                    </button>`;
                }
            });
        } else {
            knapperHtml = "Mangler e-post";
        }

        resultat.htmlIkkeFerdig = `<tr>
            <td style="text-align:left;"><b>${fag} (${fulltKlasseNavn})</b><br><small>${periode} ${aar}</small></td>
            <td>${laererNavnVisning}</td>
            <td style="text-align:center;">
                ${knapperHtml}${loggHtml}
            </td>
        </tr>`;
    }

    return resultat;
}

// --- HOVEDFUNKSJON FOR MODAL ---
async function genererGjennomfoeringsData() {
    const ikkeFerdigDiv = document.getElementById('ikkeFerdigstilteListe');
    const totalTabellDiv = document.getElementById('gjennomfoeringTabellContainer');
    
    // --- DATO-LOGIKK FOR FILTRERING ---
    const nå = new Date();
    const nåværendeÅr = nå.getFullYear();
    const nåværendeMåned = nå.getMonth() + 1; // 1-12
    
    // Finn ut hvilken termin vi er i nå
    // 8-12 = Høst, 1-7 = Vår
    const nåværendeTermin = (nåværendeMåned >= 8) ? "Høst" : "Vår";
    
    // Konstruer skoleåret-strengen (f.eks "2025-2026")
    let aktivtSkoleårStreng = "";
    if (nåværendeMåned >= 8) {
        aktivtSkoleårStreng = `${nåværendeÅr}-${nåværendeÅr + 1}`;
    } else {
        aktivtSkoleårStreng = `${nåværendeÅr - 1}-${nåværendeÅr}`;
    }

    let htmlIkkeFerdigBody = ""; 
    let htmlTotalBody = "";
    let fantData = false;
    let harApneTotalt = false;

    ikkeFerdigDiv.innerHTML = "<p style='padding:20px;'>Henter data...</p>";
    
    try {
        const [statusSnapshot, kartleggingSnapshot, loggSnapshot] = await Promise.all([
            db.ref('status').once('value'),
            db.ref('kartlegging').once('value'),
            db.ref('purrelogg').once('value')
        ]);
        
        const alleLogger = loggSnapshot.val() || {};
        const statuser = statusSnapshot.val() || {};
        const kartlegging = kartleggingSnapshot.val() || {};

        for (let aar in statuser) {
            // 1. SJEKK: Er prøve-året etter nåværende skoleår? Skip.
            if (aar > aktivtSkoleårStreng) continue;

            for (let fag in statuser[aar]) {
                for (let periode in statuser[aar][fag]) {
                    
                    // 2. SJEKK: Hvis vi er i samme skoleår, men det er høst og prøven er "Vår"? Skip.
                    if (aar === aktivtSkoleårStreng && nåværendeTermin === "Høst" && periode === "Vår") {
                        continue;
                    }

                    for (let trinn in statuser[aar][fag][periode]) {
                        for (let klasseNavn in statuser[aar][fag][periode][trinn]) {
                            
                            const klasseData = (kartlegging[aar]?.[fag]?.[periode]?.[trinn]) 
                                               ? kartlegging[aar][fag][periode][trinn][klasseNavn] || {} 
                                               : {};

                            const res = behandleKlasseData(aar, fag, periode, trinn, klasseNavn, klasseData, statuser, alleLogger);
                            
                            if (res) {
                                htmlTotalBody += res.htmlTotal;
                                htmlIkkeFerdigBody += res.htmlIkkeFerdig;
                                if (res.harApne) harApneTotalt = true;
                                fantData = true;
                            }
                        }
                    }
                }
            }
        }

        // --- TEGN RESULTATET (samme som før) ---
        if (!fantData) {
            ikkeFerdigDiv.innerHTML = "<p style='padding:20px;'>Ingen aktive prøver for gjeldende termin.</p>";
            totalTabellDiv.innerHTML = "";
        } else {
            const headerIkkeFerdig = `<table class="admin-table"><thead><tr><th style="text-align:left;">Prøve</th><th>Kontaktlærer</th><th>Status/Logg</th></tr></thead><tbody>`;
            const headerTotal = `<table class="admin-table"><thead><tr><th style="text-align:left;">Prøve</th><th>Klasse</th><th>Kontaktlærer</th><th>Gjennomført</th><th>Snitt (%)</th><th>Status</th></tr></thead><tbody>`;

            ikkeFerdigDiv.innerHTML = harApneTotalt ? 
                headerIkkeFerdig + htmlIkkeFerdigBody + "</tbody></table>" : 
                `<p style='text-align:center; padding:20px; color:green; font-weight:bold;'>Alle prøver for ${nåværendeTermin} ${aktivtSkoleårStreng} er ferdigstilt! 🎉</p>`;
            
            totalTabellDiv.innerHTML = headerTotal + htmlTotalBody + "</tbody></table>";
        }

    } catch (error) {
        console.error("Feil:", error);
        ikkeFerdigDiv.innerHTML = `<p style='color:red;'>Feil: ${error.message}</p>`;
    }
}

function oppdaterAnalyseStatus(erFerdig) {
    const analyseBtn = document.getElementById('btnAnalyse');
    if (!analyseBtn) return;

    if (erFerdig) {
        analyseBtn.disabled = false;
        analyseBtn.style.cursor = "pointer"; // Vanlig hånd
        analyseBtn.style.opacity = "1";
        analyseBtn.title = "Se klasseanalyse"; 
        analyseBtn.innerHTML = "📊 Analyse"; // Normal tekst
    } else {
        analyseBtn.disabled = true;
        // HER ER ENDRINGENE:
        analyseBtn.style.cursor = "not-allowed"; // Forbudt-ikon
        analyseBtn.style.opacity = "0.6"; // Gjør knappen litt "gråere"
        analyseBtn.title = "Prøven må settes som 'Ferdigstilt' før Analyse aktiveres";
        analyseBtn.innerHTML = "🚫 Analyse"; // Legger til forbudt-emoji i knappen
    }
}
      
// --- KOMBINERT ANALYSE-KODE (Rettet versjon med alle sjekker) ---
async function genererKlasseAnalyse() {
// Sjekk om knappen faktisk er aktiv før vi kjører tung datahenting
    const analyseBtn = document.getElementById('btnAnalyse');
    if (analyseBtn && analyseBtn.disabled) return;
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

// --- ETAPPE 1: HENT SNITT FOR PRØVEN PÅ TVERS AV ALLE ÅR ---
        let totalSumAlleAar = 0;
        let oppgaveSummerAlleAar = new Array(oppsett.oppgaver.length).fill(0);
        let antallEleverAlleAar = 0;

        // Hent hele 'kartlegging'-noden for å skanne alle årstall
        const alleDataSnap = await db.ref(`kartlegging`).once('value');
        const alleData = alleDataSnap.val() || {};

        // Loop gjennom alle år (f.eks "2024-2025", "2025-2026")
        Object.keys(alleData).forEach(aarNøkkel => {
            // Gå direkte til fag -> periode -> trinn for dette året
            const trinnData = alleData[aarNøkkel][fag]?.[periode]?.[trinn];
            
            if (trinnData) {
                // trinnData inneholder nå alle klasser (A, B, C...)
                Object.keys(trinnData).forEach(klasseNavn => {
                    const elever = trinnData[klasseNavn];
                    
                    Object.keys(elever).forEach(elevNavn => {
                        const d = elever[elevNavn];
                        // Sjekk at eleven har gyldige oppgaver og ikke er slettet
                        if (d.oppgaver && !d.slettet && !d.ikkeGjennomfort) {
                            antallEleverAlleAar++;
                            totalSumAlleAar += (parseFloat(d.sum) || 0);
                            
                            d.oppgaver.forEach((p, i) => {
                                if (oppgaveSummerAlleAar[i] !== undefined) {
                                    oppgaveSummerAlleAar[i] += (parseFloat(p) || 0);
                                }
                            });
                        }
                    });
                });
            }
        });
        // --- SLUTT PÅ ETAPPE 1 ---

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

htmlSide1 += `<h2 style="text-align:center; color:#2c3e50; margin-top:0;">Klassens resultater</h2>`;

htmlSide1 += `
<div style="margin-top: 60px; overflow: visible;"> <table style="table-layout: fixed; width: 100%; border-collapse: collapse; overflow: visible;">
        <thead>
            <tr style="background: none; overflow: visible;">
                <td style="border: none; width: 100px;"></td>`;

// Lag søylene for hver oppgave
oppsett.oppgaver.forEach((o, i) => {
    const snitt = oppgaveSummer[i] / antall;
    const prosent = (snitt / o.maks) * 100;
    
    // Beregn grense i prosent
    const grensePoeng = (o.grense !== undefined && o.grense !== -1) ? o.grense : 0;
    const grenseProsent = (grensePoeng / o.maks) * 100;

    htmlSide1 += `
        <td style="border: none; vertical-align: bottom; height: 100px; padding: 0; position: relative; overflow: visible;">
            <div style="position: absolute; top: -30px; left: 0; right: 0; text-align: center; font-size: 11px; font-weight: bold; color: #2c3e50; z-index: 100; line-height: 1;">
                ${prosent.toFixed(0)}%
            </div>

            <div style="position: relative; width: 100%; height: 100px; display: flex; align-items: flex-end; justify-content: center;">
                <div style="position: absolute; bottom: 0; width: 35px; height: 100%; background: #f9f9f9; border-radius: 2px 2px 0 0; z-index: 0;"></div>
                
                <div style="position: relative; width: 35px; height: ${prosent}%; background: #3498db; border-radius: 2px 2px 0 0; z-index: 1;"></div>
                
                ${fag !== "Regning" && grensePoeng > 0 ? `
                    <div style="position: absolute; bottom: ${grenseProsent}%; left: 50%; transform: translateX(-50%); width: 45px; border-bottom: 2px dashed #e74c3c !important; z-index: 20 !important;"></div>
                ` : ''}
            </div>
        </td>`;
});

// Søyle for TOTAL
const totalGrenseProsent = (oppsett.grenseTotal / totalMaksMulig) * 100;
htmlSide1 += `
                <td style="border: none; vertical-align: bottom; height: 100px; padding: 0; position: relative; overflow: visible;">
                    <div style="position: absolute; top: -30px; left: 0; right: 0; text-align: center; font-size: 11px; font-weight: bold; color: #2c3e50; z-index: 100; line-height: 1;">
                        ${totalKlasseSnittProsent.toFixed(0)}%
                    </div>

                    <div style="position: relative; width: 100%; height: 100px; display: flex; align-items: flex-end; justify-content: center;">
                        <div style="position: absolute; bottom: 0; width: 40px; height: 100%; background: #eee; border-radius: 2px 2px 0 0; z-index: 0; border: 1px solid #ddd;"></div>
                        
                        <div style="position: relative; width: 40px; height: ${totalKlasseSnittProsent}%; background: #2c3e50; border-radius: 2px 2px 0 0; z-index: 1;"></div>
                        
                        <div style="position: absolute; bottom: ${totalGrenseProsent}%; left: 50%; transform: translateX(-50%); width: 50px; border-bottom: 2px solid #e74c3c !important; z-index: 20 !important;"></div>
                    </div>
                </td>
            </tr>
            
            <tr>
                <th class="col-navn" style="width: 100px; padding-top: 15px;">Oppgave</th>`;
                oppsett.oppgaver.forEach((o, i) => {
                    let visningsNavn = (gjeldendeMalTabell && gjeldendeMalTabell.oppgaver && gjeldendeMalTabell.oppgaver[i + 1]) 
                        ? gjeldendeMalTabell.oppgaver[i + 1].navn : o.navn;
                    htmlSide1 += `<th style="padding-top: 15px;">${visningsNavn}</th>`;
                });
                htmlSide1 += `<th class="col-sum" style="padding-top: 15px;">TOTAL</th>
            </tr>
        </thead>
        <tbody>
            <tr style="background-color: #ebf9f1;">
                <td class="col-navn"><b>Maks poengsum</b></td>`;
                oppsett.oppgaver.forEach(o => {
                    htmlSide1 += `<td>${o.maks}</td>`;
                });
                htmlSide1 += `<td class="col-sum"><b>${totalMaksMulig}</b></td>
            </tr>
            <tr style="background-color: #fff5f5;">
                <td class="col-navn"><b>Kritisk grense</b></td>`;
                oppsett.oppgaver.forEach(o => {
                    htmlSide1 += `<td>${o.grense !== -1 ? o.grense : '-'}</td>`;
                });
                htmlSide1 += `<td class="col-sum"><b>${oppsett.grenseTotal}</b></td>
            </tr>

            <tr style="background-color: #f2f2f2; font-weight: bold;">
                <td class="col-navn">Snitt for prøven</td>`;
                oppgaveSummerAlleAar.forEach(s => {
                    const snitt = antallEleverAlleAar > 0 ? (s / antallEleverAlleAar).toFixed(1) : "0.0";
                    htmlSide1 += `<td>${snitt}</td>`;
                });
                const totaltSnitt = antallEleverAlleAar > 0 ? (totalSumAlleAar / antallEleverAlleAar).toFixed(1) : "0.0";
                htmlSide1 += `<td class="col-sum">${totaltSnitt}</td>
            </tr>

<tr style="font-weight: bold;">
                <td class="col-navn" style="font-size: 11px !important;">Snitt for klassen</td>`;
                oppgaveSummer.forEach(s => {
                    htmlSide1 += `<td style="font-size: 11px !important;">${(s/antall).toFixed(1)}</td>`;
                });
                htmlSide1 += `<td class="col-sum" style="font-size: 11px !important;">${(totalSumKlasse/antall).toFixed(1)}</td>
            </tr>
            <tr style="font-weight: bold;">
                <td class="col-navn" style="font-size: 11px !important;">I % av maks</td>`;
                oppgaveSummer.forEach((s, i) => {
                    htmlSide1 += `<td style="font-size: 11px !important;">${((s/antall)/oppsett.oppgaver[i].maks*100).toFixed(0)}%</td>`;
                });
                htmlSide1 += `<td class="col-sum" style="font-size: 11px !important;">${totalKlasseSnittProsent.toFixed(0)}%</td>
            </tr>

        </tbody>
    </table>
</div>

<h2 style="text-align:center; color:#2c3e50; margin-top:35px;">Refleksjonsspørsmål</h2>

<div style="margin-top: 15px; display: flex; gap: 20px; border-top: 1px solid #eee; padding-top: 15px;">
    <div style="flex: 1; background: #f0f9f0; padding: 12px; border-radius: 4px; border: 2px solid #d0e8d0;">
        <h3 style="color: #2c3e50; font-size: 14px; margin: 0 0 10px 0;">Sjekkliste etter prøven</h3>
        <ul style="list-style: none; padding: 0; font-size: 12px; line-height: 1.5; color: #444;">
            <li style="margin-bottom: 6px;"><b>✓</b> se nærmere på resultatene til elever under eller like over kritisk grense</li>
            <li style="margin-bottom: 6px;"><b>✓</b> vurdere hva de klarer / ikke klarer på de enkelte oppgavene</li>
            <li style="margin-bottom: 6px;"><b>✓</b> se resultatene i sammenheng med andre resultater/observasjoner</li>
            <li style="margin-bottom: 6px;"><b>✓</b> lag grupper på tvers av klassene og gjennomfør lesekurs/regnekurs</li>
            <li style="margin-bottom: 6px;"><b>✓</b> gi tilbakemelding til elever og foreldre om resultat og videre oppfølging</li>
        </ul>
    </div>
    <div style="flex: 1; background: #f0f9f0; padding: 12px; border-radius: 4px; border: 2px solid #d0e8d0;">
        <h3 style="color: #2c3e50; font-size: 14px; margin: 0 0 10px 0;">Spørsmål til refleksjon</h3>
        <ul style="list-style: none; padding: 0; font-size: 12px; line-height: 1.5; color: #444;">
            <li style="margin-bottom: 5px;"><b>✓</b> Er resultatet som forventet?</li>
            <li style="margin-bottom: 5px;"><b>✓</b> Ser vi mønstre eller tendenser i resultatene?</li>
            <li style="margin-bottom: 5px;"><b>✓</b> Hvilke konsekvenser får dette for videre arbeid?</li>
            <li style="margin-bottom: 5px;"><b>✓</b> Hvilke tiltak iverksettes for de under eller rett over kritisk grense?</li>
            <li style="margin-bottom: 5px;"><b>✓</b> Hvilke tiltak iverksettes for de elevene som klarer alt?</li>
        </ul>
    </div>
</div>
`;
// --- SLUTT PÅ SIDE 1
 
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


// --- SIDE 3: ULTRA-KOMPAKT DETALJANALYSE (Fullstendig og feilfri) ---
let htmlSide3 = fellesHeader; 
htmlSide3 += `<div class="analyse-side-3">`; 

htmlSide3 += `<h2 style="text-align:center; color:#2c3e50; margin-top:0;">Områder klassen skårer under kritisk grense eller under 70%</h2>`;

htmlSide3 += `
    <div style="display: grid; grid-template-columns: 1fr auto; gap: 20px; padding: 10px 15px; background: #eee; font-weight: bold; border-radius: 4px; margin-bottom: 5px; font-size: 0.85em;">
        <div>OMRÅDE / PEDAGOGISK FOKUS</div>
        <div style="text-align: right;">TILTAK</div>
    </div>`;

let harSvakheter = false;

// --- SIDE 3: ANALYSELOGIKK ---
if (gjeldendeMalTabell && gjeldendeMalTabell.oppgaver) {
    const headerTekst = fellesHeader.toLowerCase();
    const erLesing = headerTekst.includes("lesing");
    const erVar = headerTekst.includes("vår");
    const sesong = erVar ? "Vår" : "Høst";
    const rentTrinnNummer = parseInt(trinn.replace(/\D/g, '')); 
    
    const gjeldendeMapping = window[`mappingTrinn${rentTrinnNummer}`];

    oppsett.oppgaver.forEach((o, i) => {
        const snitt = oppgaveSummer[i] / antall;
        const prosent = (snitt / o.maks) * 100;
        const oppgaveNr = (i + 1).toString(); 
        const malInfo = gjeldendeMalTabell.oppgaver[oppgaveNr]; 

        if ((prosent < 70 || (o.grense !== -1 && snitt <= o.grense)) && malInfo) {
            harSvakheter = true; 
            let farge = (o.grense !== -1 && snitt <= o.grense) ? "#c0392b" : "#d35400";
            
            // --- 1. BOK-REFERANSE (KUN AKTUELT TRINN) ---
            let bokReferanser = "Fant ingen spesifikke sidetall i mapping-filen.";
            let bokInfoTekst = `Anbefalt trening for ${rentTrinnNummer}. trinn:`;
            const navnMultiTrinn = `Multi ${rentTrinnNummer}`;

            if (gjeldendeMapping && gjeldendeMapping[sesong] && gjeldendeMapping[sesong][oppgaveNr]) {
                const mapData = gjeldendeMapping[sesong][oppgaveNr];
                const refArray = mapData.bøker.map(b => {
                    let navn = b.bok === "ovebok" ? "Øvebok" : b.bok.includes("grunnbok") ? `Grunnbok ${rentTrinnNummer}${b.bok.toUpperCase().includes("A") ? "A" : "B"}` : b.bok;
                    return `${navn} s. ${b.side}`;
                });
                bokReferanser = `${mapData.tema}:\n${refArray.join(", ")}`;
            }

// --- 2. GLOBAL SØK LOGIKK (SUPER-ROBUST) ---
let globalBokReferanser = "";
let harGlobalTreff = false;
const navnMultiGlobal = `Multi 1-${rentTrinnNummer}`;
let temaSok = "";

if (gjeldendeMapping && gjeldendeMapping[sesong] && gjeldendeMapping[sesong][oppgaveNr]) {
    temaSok = gjeldendeMapping[sesong][oppgaveNr].tema;
}

if (temaSok) {
    const vasketSok = temaSok.toLowerCase().trim();
    console.log("Søker etter tema:", vasketSok, "i trinn 1 til", rentTrinnNummer);

    for (let t = 1; t <= rentTrinnNummer; t++) {
        const trinnMapping = window[`mappingTrinn${t}`];
        
        if (trinnMapping && trinnMapping[sesong]) {
            let treffForDetteTrinnet = [];

            Object.keys(trinnMapping[sesong]).forEach(nr => {
                const data = trinnMapping[sesong][nr];
                if (data.tema) {
                    const vasketDataTema = data.tema.toLowerCase().trim();
                    
                    // Sjekker om temaet er dønn likt, ELLER om et av temaene inneholder det andre
                    if (vasketDataTema === vasketSok || vasketDataTema.includes(vasketSok) || vasketSok.includes(vasketDataTema)) {
                        
                        const refArray = data.bøker.map(b => {
                            let navn = b.bok === "ovebok" ? "Øvebok" : b.bok.includes("grunnbok") ? `Grunnbok ${t}${b.bok.toUpperCase().includes("A") ? "A" : "B"}` : b.bok;
                            return `${navn} s. ${b.side}`;
                        });
                        
                        treffForDetteTrinnet.push(refArray.join(", "));
                    }
                }
            });

            if (treffForDetteTrinnet.length > 0) {
                // Fjerner duplikater i sidetallene
                const unikeRef = [...new Set(treffForDetteTrinnet)].join("\n   ");
                globalBokReferanser += `TRINN ${t} (${temaSok}):\n   ${unikeRef}\n\n`;
                harGlobalTreff = true;
            }
        } else {
            console.log(`Ingen mapping eller sesong funnet for trinn ${t}`);
        }
    }
}

if (!harGlobalTreff) {
    globalBokReferanser = `Ingen treff på "${temaSok}" i trinn 1-${rentTrinnNummer}.\n\nTips: Sjekk at tema-navnet er skrevet likt i mapping-filene (f.eks. om ett trinn bruker "Klokka" og et annet bruker "Tid").`;
}

      // --- 3. ENKODING FOR KNAPPER ---
const bildeUrl = o.bilde ? fiksGithubLenke(o.bilde) : "";
let kiPrompt = `Jeg er lærer og klassen min trenger ekstra trening på dette området: "${malInfo.navn}".\nPedagogisk forklaring: ${malInfo.forklaring}.\n\n`;
if (bildeUrl) {
    kiPrompt += `1. Se på bildet av oppgaven: ${bildeUrl}\n2. Lag 5 lignende oppgaver.\n\n`;
} else {
    kiPrompt += `Lag 5 varierte oppgaver som trener dette målet.\n\n`;
}
kiPrompt += `Tilpass alt til ${rentTrinnNummer}. trinn.`;

const safePrompt = btoa(unescape(encodeURIComponent(kiPrompt)));
const safeGlobalBok = btoa(unescape(encodeURIComponent(globalBokReferanser)));
const safeGlobalTittel = btoa(unescape(encodeURIComponent(navnMultiGlobal)));

// --- 4. BYGG HTML RAD (Nå med kun én Multi-knapp) ---
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

        <button title="Generer KI-oppgaver" 
            onclick="(function(btn){ 
                const promptTekst = decodeURIComponent(escape(window.atob('${safePrompt}')));
                navigator.clipboard.writeText(promptTekst).then(() => {
                    btn.innerText = '✅';
                    window.open('https://copilot.microsoft.com/?q=' + encodeURIComponent(promptTekst), '_blank');
                    setTimeout(() => { btn.innerText = 'KI'; }, 2000);
                });
            })(this)"
            class="btn-ki">KI</button>

        ${!erLesing ? `
        <button title="Søk i alle Multi-bøker fra 1. trinn opp til nåværende" 
            onclick="alert(decodeURIComponent(escape(window.atob('${safeGlobalTittel}'))) + ':\\n\\n' + decodeURIComponent(escape(window.atob('${safeGlobalBok}'))))" 
            class="btn-multi-alle" 
            style="background-color: #f39c12; color: white; border: none; padding: 2px 10px; border-radius: 3px; cursor: pointer; font-size: 0.85em; font-weight: bold;">
            ${navnMultiGlobal}
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
// --- SLUTT PÅ SIDE 3 ---

// --- SIDE 4: UTVIKLING OVER TID (Nå med historisk akkumulert prøvesnitt) ---
let htmlSide4 = fellesHeader + `<h2 style="text-align:center; color:#2c3e50; margin-top:0;">Utvikling over tid</h2>`;
try {
    const histSnap = await db.ref(`kartlegging`).once('value');
    const alleData = histSnap.val() || {};
    let historikkRader = [];

    const naaTrinnTall = parseInt(trinn);
    const naaAarStart = parseInt(aar.split('-')[0]);

    for (const aKey of Object.keys(alleData)) {
        if (aKey > aar) continue; 
        
        const fData = alleData[aKey][fag];
        if (!fData) continue;

        const histAarStart = parseInt(aKey.split('-')[0]);
        const histAarSlutt = parseInt(aKey.split('-')[1]);
        const aarDiff = naaAarStart - histAarStart;
        const historiskTrinn = (naaTrinnTall - aarDiff).toString();

        if (parseInt(historiskTrinn) < 1) continue;

        const perioder = Object.keys(fData).sort((a, b) => a.localeCompare(b));

        for (const pKey of perioder) {
            if (aKey === aar && pKey === "Vår" && periode === "Høst") continue;
            
            const trinnDataAkkuratNaa = fData[pKey][historiskTrinn];
            if (!trinnDataAkkuratNaa) continue;

            // --- NY BEREGNING: GLOBALT PRØVESNITT (Akkumulert frem til DETTE året) ---
            let globalSum = 0;
            let globalAntall = 0;
            
            Object.keys(alleData).forEach(yearKey => {
                // VIKTIG ENDRING: Vi tar bare med år som er lik eller tidligere enn aKey (året for denne raden)
                if (yearKey <= aKey) { 
                    const yearData = alleData[yearKey][fag];
                    if (yearData && yearData[pKey] && yearData[pKey][historiskTrinn]) {
                        const spesifikkProveData = yearData[pKey][historiskTrinn];
                        const aOppsettGlobal = oppgaveStruktur[yearKey] ? oppgaveStruktur[yearKey][fag][pKey][historiskTrinn] : null;
                        
                        if (aOppsettGlobal) {
                            const aMaksGlobal = aOppsettGlobal.oppgaver.reduce((s, o) => s + (o.maks || 0), 0);
                            Object.values(spesifikkProveData).forEach(klasseMappe => {
                                Object.values(klasseMappe).forEach(e => {
                                    if (!e.slettet && !e.ikkeGjennomfort && e.sum !== undefined) {
                                        globalSum += (e.sum / aMaksGlobal);
                                        globalAntall++;
                                    }
                                });
                            });
                        }
                    }
                }
            });
            const akkumulertProveSnitt = globalAntall > 0 ? (globalSum / globalAntall) * 100 : 0;

            // --- RESTEN AV BEREGNINGENE (Klasse og Trinn for gjeldende år) ---
            const aOppsett = oppgaveStruktur[aKey] ? oppgaveStruktur[aKey][fag][pKey][historiskTrinn] : null;
            if (!aOppsett) continue;
            const aMaks = aOppsett.oppgaver.reduce((s, o) => s + (o.maks || 0), 0);

            let klasseSum = 0, klasseAntall = 0, klasseKritiske = 0, klasseLavMestring = 0;
            let trinnSum = 0, trinnAntall = 0;

            Object.keys(trinnDataAkkuratNaa).forEach(kNavn => {
                Object.values(trinnDataAkkuratNaa[kNavn]).forEach(e => {
                    if (e.slettet || e.ikkeGjennomfort || e.sum === undefined) return;
                    trinnSum += e.sum;
                    trinnAntall++;

                    if (kNavn === klasse) {
                        klasseSum += e.sum;
                        klasseAntall++;
                        if (e.sum <= aOppsett.grenseTotal) klasseKritiske++;
                        else if ((e.sum / aMaks * 100) < 70) klasseLavMestring++;
                    }
                });
            });

            if (klasseAntall > 0) {
                const korrektAar = pKey === "Høst" ? histAarStart : histAarSlutt;
                historikkRader.push({ 
                    visning: `${pKey} ${korrektAar.toString().slice(-2)}`, 
                    tittel: `${historiskTrinn}${klasse}`,
                    klasseProsent: ((klasseSum / klasseAntall) / aMaks) * 100,
                    trinnProsent: ((trinnSum / trinnAntall) / aMaks) * 100,
                    globalProsent: akkumulertProveSnitt, // Nå er denne historisk korrekt for hvert år!
                    kritiske: klasseKritiske, 
                    lavMestring: klasseLavMestring,
                    sort: aKey + (pKey === "Høst" ? "1" : "2")
                });
            }
        }
    }

    
    historikkRader.sort((a,b) => a.sort.localeCompare(b.sort));

    if (historikkRader.length > 0) {
    // --- NY FIKS: Definer proveSnitt basert på den siste raden i historikken ---
    const sisteRad = historikkRader[historikkRader.length - 1];
    const proveSnitt = sisteRad.globalProsent;


// --- SVG GRAF (Med dynamisk Prøvesnitt-linje som følger hver prøve) ---
const w = 750; 
const h = 100; 
const toppMarg = 25; 
const pad = 45;
const minVal = 50; 
const maxVal = 100; 
const range = maxVal - minVal;
const step = (w - (pad * 2)) / (Math.max(historikkRader.length - 1, 1));

let pKlasse = "";     // Linjen for klassen
let pProveSnitt = ""; // Linjen for det historiske prøvesnittet
let dots = "";

historikkRader.forEach((r, i) => {
    const x = pad + (i * step);
    
    // Y-posisjon for klassen
    const yK = (h - ((Math.max(r.klasseProsent, minVal) - minVal) * (h / range))) + toppMarg;
    // Y-posisjon for prøvesnittet (varierer per punkt)
    const yP = (h - ((Math.max(r.globalProsent, minVal) - minVal) * (h / range))) + toppMarg;
    
    pKlasse += `${x},${yK} `; 
    pProveSnitt += `${x},${yP} `;

    // Punkter og tekst på x-aksen
    dots += `
        <circle cx="${x}" cy="${yK}" r="4" fill="#3498db" />
        <circle cx="${x}" cy="${yP}" r="3" fill="#999" opacity="0.6" />
        <text x="${x}" y="${h + toppMarg + 22}" font-size="9" font-weight="bold" text-anchor="middle" fill="#2c3e50" transform="rotate(-18 ${x} ${h + toppMarg + 22})">${r.visning}</text>
    `;
});

const tegnforklaring = `
    <g transform="translate(${w/2 - 110}, 10)">
        <line x1="0" y1="0" x2="20" y2="0" stroke="#3498db" stroke-width="3" />
        <text x="25" y="4" font-size="10" fill="#2c3e50" font-weight="bold">Klassen</text>
        
        <line x1="100" y1="0" x2="120" y2="0" stroke="#999" stroke-width="2" stroke-dasharray="4,2" />
        <text x="125" y="4" font-size="10" fill="#666">Prøvesnitt (Ref.)</text>
    </g>
`;

// Generer Y-akse (som før)
let yAkseTall = "";
[50, 100].forEach(val => {
    const yPos = (h - ((val - minVal) * (h / range))) + toppMarg;
    yAkseTall += `
        <text x="${pad - 10}" y="${yPos + 3}" font-size="10" font-weight="bold" fill="#2c3e50" opacity="0.7" text-anchor="end">${val}%</text>
        <line x1="${pad}" y1="${yPos}" x2="${w - pad}" y2="${yPos}" stroke="#eee" stroke-width="0.8" />
    `;
});

htmlSide4 += `<div style="text-align:center; margin: 20px 0 40px 0;">
    <svg width="${w}" height="${h + toppMarg + 45}" viewBox="0 0 ${w} ${h + toppMarg + 45}" style="shape-rendering: geometricPrecision;">
        ${tegnforklaring}
        ${yAkseTall}
        
        <polyline points="${pProveSnitt}" fill="none" stroke="#999" stroke-width="2" stroke-dasharray="6,4" opacity="0.5" />

        <polyline points="${pKlasse}" fill="none" stroke="#3498db" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
        
        <line x1="${pad}" y1="${h + toppMarg}" x2="${w - pad}" y2="${h + toppMarg}" stroke="#ccc" stroke-width="1" />
        ${dots}
    </svg>
</div>`;


        // --- TABELL ---
        htmlSide4 += `<table><thead><tr>
            <th>Periode</th><th>Trinn</th><th>Klasse (%)</th><th>Trinn (%)</th><th style="background:#f0f4f8;">Prøve (%)</th><th>Diff. trinn</th><th>Lav mestring</th><th>Under kritisk grense</th>
        </tr></thead><tbody>`;

        historikkRader.forEach(r => {
            const aktiv = r.visning === `${periode} ${aar.split('-')[periode === "Høst" ? 0 : 1].slice(-2)}` ? 'style="background:#e8f4fd; font-weight:bold;"' : '';
            const diff = r.klasseProsent - r.trinnProsent;
            htmlSide4 += `<tr ${aktiv}>
                <td>${r.visning}</td><td>${r.tittel}</td><td>${r.klasseProsent.toFixed(1)}%</td><td style="color:#666;">${r.trinnProsent.toFixed(1)}%</td>
                <td style="background:#f0f4f8; font-weight:bold;">${r.globalProsent.toFixed(1)}%</td>
                <td style="color:${diff >= 0 ? 'green':'red'}; font-weight:bold;">${diff >= 0 ? '+':''}${diff.toFixed(1)}%</td>
                <td>${r.lavMestring}</td><td>${r.kritiske}</td>
            </tr>`;
        });
        htmlSide4 += `</tbody></table>`;

        // --- OPPSUMMERINGSTEKST ---
        const siste = historikkRader[historikkRader.length - 1];
        let utviklingTekst = "Første måling.";
        if (historikkRader.length > 1) {
            const forrige = historikkRader[historikkRader.length - 2];
            const endring = siste.klasseProsent - forrige.klasseProsent;
            utviklingTekst = endring > 3 ? `<b>Fremgang:</b> +${endring.toFixed(1)}% siden ${forrige.visning}.` : (endring < -3 ? `<b>Nedgang:</b> ${endring.toFixed(1)}% siden ${forrige.visning}.` : `Stabil utvikling.`);
        }
        
        const diffMotGlobal = siste.klasseProsent - siste.globalProsent;
        let sammenligningTekst = diffMotGlobal > 2 ? `Klassen presterer over det historiske snittet for denne prøven.` : (diffMotGlobal < -2 ? `Klassen presterer under det historiske snittet for denne prøven.` : `Klassen følger det historiske snittet.`);

        htmlSide4 += `<div style="margin-top:20px; display: flex; gap: 15px;">
            <div style="flex: 1; padding:12px; border-left:5px solid #3498db; background:#f9f9f9;"><h4 style="margin:0 0 5px 0;">Intern utvikling</h4><p style="margin:0; font-size:13px;">${utviklingTekst}</p></div>
            <div style="flex: 1; padding:12px; border-left:5px solid #2c3e50; background:#f9f9f9;"><h4 style="margin:0 0 5px 0;">Mot historisk snitt</h4><p style="margin:0; font-size:13px;">${sammenligningTekst}</p></div>
        </div>`;
    }
} catch(err) { console.error(err); }

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
                                          <link rel="icon" type="image/png" href="${window.location.origin}${window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'))}/analyse.png">
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

/* Ny regel som overstyrer standard 9px og gjør teksten fet */
.stor-rad td {
    font-size: 14px !important;
    font-weight: bold !important;
    padding: 6px 2px !important;
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
                    <button onclick="const win = window.open('', '_blank'); window.opener.genererElevkortKlasse('${aar}', '${trinn}', '${klasse}', '${periode}', win)" style="background:#27ae60;" class="btn-tool">👤 Elevkort (Hele klassen)</button>
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


// --- START ELEVKORT---
// --- Hjelpefunksjon 1---
function hentGlobaltSnitt(heleDatabasen, fag, periode, trinn, gjeldendeAar) {
    let alleResultater = [];
    const innevaerendeAarStart = parseInt(gjeldendeAar.split('-')[0]);

    Object.keys(heleDatabasen).forEach(aarStreng => {
        const sjekkAarStart = parseInt(aarStreng.split('-')[0]);

        // SJEKK: Kun historikk + nåværende år
        if (sjekkAarStart <= innevaerendeAarStart) {
            const trinnData = heleDatabasen[aarStreng]?.[fag]?.[periode]?.[trinn];
            if (trinnData) {
                Object.keys(trinnData).forEach(klasseNavn => {
                    const elever = trinnData[klasseNavn];
                    Object.values(elever).forEach(elev => {
                        if (elev && elev.oppgaver) {
                            alleResultater.push(elev);
                        }
                    });
                });
            }
        }
    });
    return alleResultater;
}

// --- Hjelpefunksjon 2---
function genererElevTabell(elevData, fag, aar, periode, trinn, alleEleverData = []) {
    const oppsett = oppgaveStruktur[aar]?.[fag]?.[periode]?.[trinn];
    const mal = analyseMaler[fag]?.[trinn]?.[periode];
    if (!oppsett || !elevData.oppgaver) return "<p>Ingen data registrert.</p>";

    const faktisktMaksTotal = oppsett.oppgaver.reduce((sum, o) => sum + (o.maks || 0), 0);
    const elevensTotalSum = elevData.sum || 0;
    const kritiskGrenseTotal = oppsett.grenseTotal || 0;
    
    const totalBakgrunn = elevensTotalSum < kritiskGrenseTotal ? "#ff7675" : "#55efc4";

    // --- BEREGNING AV SNITT (Ryddet opp) ---
    const antallElever = alleEleverData.length;
    let oppgaveSnitt = [];
    let totalSnittSum = 0;

    if (antallElever > 0) {
        // Regn ut snitt per oppgave
        oppsett.oppgaver.forEach((_, i) => {
            const sumOppgave = alleEleverData.reduce((s, elev) => {
                const poeng = (elev.oppgaver && elev.oppgaver[i] !== undefined) ? elev.oppgaver[i] : 0;
                return s + (Number(poeng) || 0);
            }, 0);
            oppgaveSnitt.push((sumOppgave / antallElever).toFixed(1));
        });

        // Regn ut snitt for totalsum
        const sumAlleTotaler = alleEleverData.reduce((s, elev) => s + (Number(elev.sum) || 0), 0);
        totalSnittSum = (sumAlleTotaler / antallElever).toFixed(1);
    } else {
        oppgaveSnitt = oppsett.oppgaver.map(() => "-");
        totalSnittSum = "-";
    }

    const totalProsent = faktisktMaksTotal > 0 ? Math.round((elevensTotalSum / faktisktMaksTotal) * 100) : 0;

    return `
    <table style="border: 1px solid #2c3e50; table-layout: fixed; width: 100%; border-collapse: collapse; margin-bottom: 5px;">
        <thead>
            <tr style="background-color: #f8f9fa;">
                <th style="text-align: left; width: 100px; padding: 2px; font-size: 10px; border: 1px solid #ddd;">Oppgave</th>
                ${oppsett.oppgaver.map((o, i) => {
                    const navn = mal?.oppgaver?.[(i + 1).toString()]?.navn || o.navn || 'O'+(i+1);
                    const visningsNavn = (fag === "Regning") ? navn.split(' ').slice(0, 3).join('<br>') : navn;
                    return `<th style="font-size: 8px; padding: 2px; height: 35px; vertical-align: middle; text-align: center; border: 1px solid #ddd; line-height: 1.1;">
                                <div style="max-height: 32px; overflow: hidden;">${visningsNavn}</div>
                            </th>`;
                }).join('')}
                <th style="background-color: #2c3e50; color: white; width: 50px; padding: 2px; font-size: 10px; border: 1px solid #2c3e50;">TOTAL</th>
            </tr>
        </thead>
        <tbody style="font-size: 10px; text-align: center;">
<tr style="background-color: #d4edda; color: #000000;">
    <td style="text-align: left; padding: 2px; border: 1px solid #ddd;">Maks poengsum</td>
    ${oppsett.oppgaver.map(o => `<td style="border: 1px solid #ddd;">${o.maks}</td>`).join('')}
    <td style="border: 1px solid #ddd;">${faktisktMaksTotal}</td>
</tr>

<tr style="background-color: #f8d7da; color: #000000;">
    <td style="text-align: left; padding: 2px; border: 1px solid #ddd;">Kritisk grense</td>
    ${oppsett.oppgaver.map(o => `<td style="border: 1px solid #ddd;">${(o.grense !== undefined && o.grense !== -1) ? o.grense : '-'}</td>`).join('')}
    <td style="border: 1px solid #ddd;">${kritiskGrenseTotal}</td>
</tr>

<tr style="background-color: #e2e3e5; color: #000000;">
    <td style="text-align: left; padding: 2px; border: 1px solid #ddd;">Snitt for prøven</td>
    ${oppgaveSnitt.map(s => `<td style="border: 1px solid #ddd;">${s}</td>`).join('')}
    <td style="border: 1px solid #ddd;">${totalSnittSum}</td>
</tr>
            <tr style="background-color: #fff; border-top: 2px solid #2c3e50;">
                <td style="text-align: left; font-weight: bold; padding: 4px 2px; border: 1px solid #ddd;">Elevens resultat</td>
                ${oppsett.oppgaver.map((o, i) => {
                    const poeng = elevData.oppgaver[i] || 0;
                    const erUnder = poeng < (o.grense || 0);
                    return `<td style="background-color: ${erUnder ? "#fdf2f2" : "#f2f9f2"}; color: ${erUnder ? "#c0392b" : "#27ae60"}; font-weight: bold; font-size: 11px; border: 1px solid #ddd;">${poeng}</td>`;
                }).join('')}
                <td style="background-color: ${totalBakgrunn}; color: #2d3436; font-weight: bold; font-size: 12px; border: 1px solid #2c3e50;">${elevensTotalSum}</td>
            </tr>

            <tr style="font-size: 8px; background-color: #f8f9fa; color: #666;">
                <td style="text-align: left; font-weight: bold; padding: 1px; border: 1px solid #ddd;">I % av maks</td>
                ${oppsett.oppgaver.map((o, i) => `<td style="border: 1px solid #ddd;">${o.maks > 0 ? Math.round(((elevData.oppgaver[i] || 0) / o.maks) * 100) : 0}%</td>`).join('')}
                <td style="font-weight: bold; border: 1px solid #ddd;">${totalProsent}%</td>
            </tr>
        </tbody>
    </table>`;
}
// --- Slutt hjelpefunksjon---


// --- Start tiltaksliste (Kompakt versjon) ---
function genererTiltaksListe(elevData, fag, aar, periode, trinn) {
    const oppsett = oppgaveStruktur[aar]?.[fag]?.[periode]?.[trinn];
    if (!oppsett || !elevData.oppgaver) return "";

    let tiltakArray = [];
    let harUnder70 = false;

    const mal = analyseMaler[fag]?.[trinn]?.[periode];

    oppsett.oppgaver.forEach((o, i) => {
        const poeng = elevData.oppgaver[i] || 0;
        const prosent = (poeng / o.maks) * 100;

        if (prosent < 70) {
            harUnder70 = true;
            const oppgaveInfo = mal?.oppgaver?.[(i + 1).toString()];
            const visningsNavn = oppgaveInfo?.navn || o.navn || `Oppgave ${i + 1}`;
            
            // Lager en kompakt tekststreng for denne oppgaven
            tiltakArray.push(`
                <span style="white-space: nowrap; margin-right: 15px;">
                    <span style="font-weight: bold;">${visningsNavn}</span> 
                    <span style="color: #c0392b;">(${Math.round(prosent)}%)</span>
                </span>`);
        }
    });

    if (!harUnder70) {
        return `
            <div style="background: #f2f9f2; border: 1px solid #27ae60; color: #27ae60; padding: 5px 10px; border-radius: 5px; margin-top: 5px; font-size: 11px;">
                ✅ Eleven mestrer alle deloppgaver (over 70% riktig).
            </div>`;
    }

    // Her returnerer vi alt på én linje ved å bruke .join('')
    return `
        <div style="margin-top: 5px; background: #fffaf0; border: 1px solid #f39c12; padding: 5px 10px; border-radius: 5px; font-size: 11px;">
            <span style="font-weight: bold; color: #d35400; text-transform: uppercase; margin-right: 10px; border-right: 1px solid #f39c12; padding-right: 10px;">
                Fokusområder:
            </span>
            ${tiltakArray.join(' <span style="color: #ccc;">|</span> ')}
        </div>`;
}


// --- HOVEDFUNKSJON ---
async function genererElevkortKlasse(aar, trinn, klasse, periode, win) {
    if (!win || win === null) win = window.open('', '_blank');
    if (!win) {
        alert("Popup ble blokkert!");
        return;
    }

    win.document.write('<html><head><title>Genererer elevkort...</title></head><body><p style="font-family:sans-serif; text-align:center; margin-top:50px;">Henter data og forbereder utskrift...</p></body></html>');

    try {
        // 1. HENT DATA
        const [lesingSnap, regningSnap, totalSnap] = await Promise.all([
            db.ref(`kartlegging/${aar}/Lesing/${periode}/${trinn}/${klasse}`).once('value'),
            db.ref(`kartlegging/${aar}/Regning/${periode}/${trinn}/${klasse}`).once('value'),
            db.ref(`kartlegging`).once('value')
        ]);

        const lesingData = lesingSnap.val() || {};
        const regningData = regningSnap.val() || {};
        const heleDatabasen = totalSnap.val() || {};
        
        // 2. FORBERED GLOBALE SNITT
        const globalLesingListe = hentGlobaltSnitt(heleDatabasen, 'Lesing', periode, trinn, aar);
        const globalRegningListe = hentGlobaltSnitt(heleDatabasen, 'Regning', periode, trinn, aar);

        const elevIder = new Set([...Object.keys(lesingData), ...Object.keys(regningData)]);
        
        // Sortering
        const sorterteIder = Array.from(elevIder).sort((a, b) => {
            const navnA = (lesingData[a]?.navn || regningData[a]?.navn || "").toLowerCase();
            const navnB = (lesingData[b]?.navn || regningData[b]?.navn || "").toLowerCase();
            return navnA.localeCompare(navnA);
        });

        win.document.open();
        win.document.write(`<html><head><title>Elevkort - ${trinn}${klasse}</title>
            <style>
                @page { size: A4 landscape; margin: 10mm; }
                body { font-family: sans-serif; padding: 0; margin: 0; background: #f0f0f0; color: #333; }
                .sticky-menu { position: fixed; top: 0; left: 0; right: 0; height: 60px; background: #2c3e50; display: flex; align-items: center; justify-content: center; gap: 15px; z-index: 1000; box-shadow: 0 2px 10px rgba(0,0,0,0.3); }
                .content-container { margin-top: 80px; }
                .elev-side { background: white; width: 277mm; min-height: 190mm; padding: 10mm; margin: 10px auto; box-sizing: border-box; page-break-after: always; box-shadow: 0 0 5px rgba(0,0,0,0.1); }
                .header { border-bottom: 2px solid #2c3e50; padding-bottom: 8px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-end; }
                .fag-del { width: 100%; border: 1px solid #eee; padding: 10px; border-radius: 8px; background: #fff; margin-bottom: 15px; }
                h1 { font-size: 20px; margin: 0; color: #2c3e50; }
                h2 { color: #2c3e50; border-bottom: 1px solid #3498db; padding-bottom: 3px; font-size: 16px; margin-top: 0; margin-bottom: 10px; }
                .btn-tool { padding: 10px 20px; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 14px; }
                .btn-print { background: #27ae60; }
                .btn-close { background: #e74c3c; }
                @media print { body { background: white; } .sticky-menu { display: none !important; } .content-container { margin-top: 0; } .elev-side { margin: 0; border: none; width: 100%; box-shadow: none; } }
            </style>
        </head><body>
            <div class="sticky-menu">
                <button onclick="window.print()" class="btn-tool btn-print">🖨️ Skriv ut alle elevkort</button>
                <button onclick="window.close()" class="btn-tool btn-close">❌ Lukk</button>
            </div>
            <div class="content-container">`);

        for (let elevId of sorterteIder) {
            // Sjekk for å unngå metadata eller ugyldige noder
            if (elevId === 'laast' || elevId === 'ferdigstilt') continue;
            
            // HER ER VARIABLENE SOM MANGLA:
            const elevLes = lesingData[elevId] || {};
            const elevReg = regningData[elevId] || {};
            
            // Skip hvis det ikke finnes faktiske data for eleven
            if (!elevLes.oppgaver && !elevReg.oppgaver) continue;

            const navn = elevLes.navn || elevReg.navn || "Elev " + elevId;

            win.document.write(`
                <div class="elev-side">
                    <div class="header">
                        <h1>Elevkort: ${navn}</h1>
                        <span style="font-size: 12px; color: #7f8c8d;">${trinn}${klasse} | ${periode} | Skoleår: ${aar}</span>
                    </div>
                    <div class="fag-del">
                        <h2>📚 Lesing</h2>
                        ${genererElevTabell(elevLes, 'Lesing', aar, periode, trinn, globalLesingListe)}
                        ${genererTiltaksListe(elevLes, 'Lesing', aar, periode, trinn)}
                    </div>
                    <div class="fag-del">
                        <h2>🧮 Regning</h2>
                        ${genererElevTabell(elevReg, 'Regning', aar, periode, trinn, globalRegningListe)}
                        ${genererTiltaksListe(elevReg, 'Regning', aar, periode, trinn)}
                    </div>
                </div>
            `);
        }

        win.document.write('</div></body></html>');
        win.document.close();

    } catch (err) {
        console.error("Feil:", err);
        // Fjern win.close() her under utvikling, så du ser feilmeldingen i konsollen!
        alert("En feil oppstod: " + err.message);
    }
}
// --- SLUTT ELEVKORT---


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
    const alleAar = hentSkoleaarFraRegister(); 
    const menyer = ['mAar', 'teAar', 'adminAar', 'compAar'];
    
    // Sjekk om det ligger et år i URL-en
    const params = new URLSearchParams(window.location.search);
    const aarFraUrl = params.get('aar');

    menyer.forEach(id => {
        fyllDropdown(id, alleAar);
        
        const meny = document.getElementById(id);
        if (meny) {
            if (aarFraUrl && id === 'mAar') {
                // Hvis vi har en link, bruk året fra linken på hovedmenyen
                meny.value = aarFraUrl;
            } else if (typeof Global_aar !== 'undefined') {
                // Ellers bruk standard globalt år
                meny.value = Global_aar;
            }
        }
    });

    // KJØR DENNE HER: Nå er alle menyer garantert ferdig fylt og satt
    sjekkUrlParametere();
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
let klasseChart = null; // <--- DENNE MÅ STÅ HER (UTENFOR FUNKSJONENE)
let lagretKullData = [];

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
        const startAarSkole = parseInt(skoleaar.split('-')[0]); // Eks 2024
        const sluttAarSkole = parseInt(skoleaar.split('-')[1]); // Eks 2025
        const trinn = startAarSkole - fodaar - 5;

        if (trinn >= 1 && trinn <= 7) {
            const fagData = allData[skoleaar]?.[fag];
            if (!fagData) continue;

// 2. KORRIGERT SORTERING: Høst før Vår
            const perioder = Object.keys(fagData).sort((a, b) => {
                if (a === "Høst" && b === "Vår") return -1;
                if (a === "Vår" && b === "Høst") return 1;
                return 0;
            });

            for (let periode of perioder) {
                const trinnData = fagData[periode][trinn];
                if (trinnData && trinnData[klasseBokstav]) {
                    
                    const aarIMal = oppgaveStruktur[skoleaar] ? skoleaar : "2025-2026";
                    const oppsett = (oppgaveStruktur[aarIMal] && 
                                     oppgaveStruktur[aarIMal][fag] && 
                                     oppgaveStruktur[aarIMal][fag][periode]) 
                                     ? oppgaveStruktur[aarIMal][fag][periode][trinn] 
                                     : null;

                    if (!oppsett) continue;              
                    
                    const maksPoeng = oppsett.oppgaver.reduce((s, o) => s + o.maks, 0);
                    const eleverIKlasse = trinnData[klasseBokstav];
                    
                    let summerTilSnitt = [];
                    let elevListeTilPrint = []; 

                    for (let id in eleverIKlasse) {
                        const e = eleverIKlasse[id];
                        const e_reg = elevRegister[id]; 
                        
                        if (e_reg) {
                            const vStartAarSkole = parseInt(skoleaar.split('-')[0]);
                            const harBegynt = vStartAarSkole >= parseInt(e_reg.startAar);
                            const harIkkeSluttet = !e_reg.sluttAar || vStartAarSkole <= parseInt(e_reg.sluttAar);
                            if (!harBegynt || !harIkkeSluttet) continue; 
                        }

                        if (e.slettet) continue;

                        let visningsNavn = e.navn || e.elevNavn || id;
                        
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
                        let snitt = 0;
                        if (summerTilSnitt.length > 0) {
                            snitt = Math.round(summerTilSnitt.reduce((a, b) => a + b, 0) / summerTilSnitt.length);
                        }

                        // --- KORRIGERT LOGIKK FOR LABEL ---
                        // Hvis det er Høst, bruk startAar (f.eks 24). Hvis Vår, bruk sluttAar (f.eks 25).
                        const visningsAar = periode === "Høst" 
                            ? startAarSkole.toString().slice(-2) 
                            : sluttAarSkole.toString().slice(-2);

                        const label = `${periode} ${visningsAar} (${trinn}.tr)`;
                        
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

async function aapneKlasserapportModal() {
    const kullSelect = document.getElementById('selectKullAar');
    if (!kullSelect) return;
    kullSelect.innerHTML = '';
    
    let unikeKull = new Set();
    for (let id in window.elevRegister) {
        const e = window.elevRegister[id];
        const faktiskSkolestart = parseInt(e.startAar) - (parseInt(e.startTrinn) - 1);
        if (faktiskSkolestart) unikeKull.add(faktiskSkolestart);
    }

    let sorterteStartAar = Array.from(unikeKull).sort((a, b) => a - b);
    sorterteStartAar.forEach(skoleStartAar => {
        const fødtAar = skoleStartAar - 6;
        let opt = document.createElement('option');
        opt.value = fødtAar; 
        opt.text = `Født i ${fødtAar} / Skolestart ${skoleStartAar}`;
        kullSelect.appendChild(opt);
    });

    if (kullSelect.options.length > 0) {
        kullSelect.selectedIndex = kullSelect.options.length - 1;
    }
    document.getElementById('modalKlasserapport').style.display = 'block';
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
    const select = document.getElementById('selectKullAar');
    const kull = select.options[select.selectedIndex].text; // Henter teksten i stedet for verdien
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
        div.style.padding = "5px 10px";
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


// ELEVRAPPORT
// Hjelpefunksjon for å hente riktig mal basert på år
function hentOppsettSpesifikk(aar, fag, periode, trinn) {
    const malAar = oppgaveStruktur[aar] ? aar : "2025-2026";
    try {
        return oppgaveStruktur[malAar][fag][periode][trinn];
    } catch (e) {
        return null;
    }
}

async function genererFullElevrapport(navn) {
    const utskriftArea = document.getElementById('utskriftRapportArea');
    utskriftArea.innerHTML = "<h2 class='no-print' style='text-align:center; padding:50px;'>Genererer rapport for " + navn + "...</h2>";
    document.getElementById('modalElevrapport').style.display = 'none';

    try {
        const snap = await db.ref(`kartlegging`).once('value');
        const alleData = snap.val() || {};
        let funnetData = [];

        for (let aar in alleData) {
            for (let fag in alleData[aar]) {
                for (let periode in alleData[aar][fag]) {
                    for (let trinn in alleData[aar][fag][periode]) {
                        for (let klasse in alleData[aar][fag][periode][trinn]) {
                            const e = alleData[aar][fag][periode][trinn][klasse][navn];
                            if (e && !e.slettet) {
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
            alert("Fant ingen data for " + navn);
            utskriftArea.innerHTML = "";
            return;
        }

        // Sortering: Trinn -> Periode -> Fag
        funnetData.sort((a, b) => {
            if (a.trinn !== b.trinn) return a.trinn - b.trinn;
            const periodeVekt = { "Høst": 0, "Vår": 1 };
            if (periodeVekt[a.periode] !== periodeVekt[b.periode]) return periodeVekt[a.periode] - periodeVekt[b.periode];
            return a.fag.localeCompare(b.fag);
        });

        let html = `
            <div style="padding: 5px 15px; font-family: Arial, sans-serif; line-height: 1.1;">
                <h1 style="text-align:center; margin-bottom:2px; font-size: 20px; text-transform: uppercase;">ELEVRAPPORT</h1>
                <h2 style="text-align:center; margin-top:0; color:#34495e; font-size: 16px;">${navn}</h2>
                <hr style="border:0; border-top:1px solid #333; margin: 10px 0;">

                <h3 style="text-transform: uppercase; font-size: 12px; border-bottom: 1px solid #333; padding-bottom: 2px; margin-bottom: 5px;">Del 1: Historisk oversikt</h3>
                <table style="width:100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px;">
                    <thead>
                        <tr style="background: #f2f2f2;">
                            <th style="border: 1px solid #000; padding: 3px 5px; text-align: left;">Prøveperiode</th>
                            <th style="border: 1px solid #000; padding: 3px 5px; text-align: center; width: 50px;">Poeng</th>
                            <th style="border: 1px solid #000; padding: 3px 5px; text-align: center; width: 50px;">Grense</th>
                            <th style="border: 1px solid #000; padding: 3px 5px; text-align: center; width: 50px;">Maks</th>
                            <th style="border: 1px solid #000; padding: 3px 5px; text-align: center; width: 45px;">%</th>
                            <th style="border: 1px solid #000; padding: 3px 5px; text-align: center; width: 70px;">Status</th>
                        </tr>
                    </thead>
                    <tbody>`;

        funnetData.forEach(d => {
            const res = d.resultat;
            const o = d.oppsett;
            if(!o) return;

            const erGjennomfort = res.oppgaver && res.oppgaver.length > 0 && res.ikkeGjennomfort !== true;
            let poengSum = "-", prosent = "-", status = "Ikke utført", statusFarge = "#7f8c8d";
            const maksTotal = o.oppgaver.reduce((sum, op) => sum + op.maks, 0);

            if (erGjennomfort) {
                poengSum = res.sum;
                prosent = Math.round((res.sum / maksTotal) * 100) + "%";
                const underGrense = res.sum <= o.grenseTotal;
                status = underGrense ? "Under" : "Over";
                statusFarge = underGrense ? "red" : "green";
            }

            html += `<tr>
                        <td style="border: 1px solid #000; padding: 2px 5px; font-weight: bold;">${d.fag}-${d.trinn}${d.klasse}-${d.periode} ${d.aar}</td>
                        <td style="border: 1px solid #000; padding: 2px 5px; text-align: center;">${poengSum}</td>
                        <td style="border: 1px solid #000; padding: 2px 5px; text-align: center;">${o.grenseTotal}</td>
                        <td style="border: 1px solid #000; padding: 2px 5px; text-align: center;">${maksTotal}</td>
                        <td style="border: 1px solid #000; padding: 2px 5px; text-align: center;">${prosent}</td>
                        <td style="border: 1px solid #000; padding: 2px 5px; text-align: center; font-weight: bold; color: ${statusFarge}; font-size: 10px;">${status}</td>
                    </tr>`;
        });

        html += `</tbody></table>
                 <div style="page-break-after: always;"></div>`;

        // --- DEL 2: DETALJER MED SIDESKIFT PER TRINN ---
        let forrigeTrinn = null;

        funnetData.forEach(d => {
            const res = d.resultat;
            const o = d.oppsett;
            if (!o) return;

            let stilSideskift = "";
            if (forrigeTrinn !== null && forrigeTrinn !== d.trinn) {
                stilSideskift = "page-break-before: always; padding-top: 20px;";
            }
            forrigeTrinn = d.trinn;

            const erGjennomfort = res.oppgaver && res.oppgaver.length > 0 && res.ikkeGjennomfort !== true;
            const malForDenne = analyseMaler[d.fag]?.[d.trinn]?.[d.periode]?.oppgaver || {};
            const erRegning = d.fag === "Regning";
            const maksTotal = o.oppgaver.reduce((sum, op) => sum + op.maks, 0);

            html += `
                <div style="margin-bottom: 40px; ${stilSideskift}">
                    <h3 style="text-transform: uppercase; font-size: 13px; border-bottom: 2px solid #333; padding-bottom: 3px; margin-bottom: 10px;">
                        DETALJER: ${d.trinn}. TRINN - ${d.fag} (${d.periode} ${d.aar})
                    </h3>
                    <div style="background: #eee; padding: 4px; font-weight: bold; font-size: 11px; border: 1px solid #000; border-bottom: none; text-align: center;">
                        ${d.fag} | ${d.trinn}${d.klasse} | ${d.periode} ${d.aar}
                    </div>
                    <table style="width:100%; border-collapse: collapse; table-layout: fixed;">
                        <thead>
                            <tr style="background: #fff;">
                                <th style="border: 1px solid #000; padding: 3px; width: 80px; text-align: left; font-size: 10px;">Oppgave:</th>`;
            
            o.oppgaver.forEach((oppg, i) => {
                const nr = (i + 1).toString();
                const overskrift = erRegning ? "O" + nr : (malForDenne[nr]?.navn || oppg.navn);
                html += `<th style="border: 1px solid #000; padding: 3px; font-size: 8px; text-align: center;">${overskrift}</th>`;
            });

            // NYE KOLONNER I THEAD
            html += `
                                <th style="border: 1px solid #000; padding: 3px; width: 35px; text-align: center; font-size: 10px;">SUM</th>
                                <th style="border: 1px solid #000; padding: 3px; width: 45px; text-align: center; font-size: 10px;">Grense</th>
                                <th style="border: 1px solid #000; padding: 3px; width: 35px; text-align: center; font-size: 10px;">Maks</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="border: 1px solid #000; padding: 4px; font-size: 10px;">Poeng:</td>`;

            if (erGjennomfort) {
                o.oppgaver.forEach((oppg, i) => {
                    const poeng = res.oppgaver[i] || 0;
                    const kritisk = oppg.grense !== -1 && poeng <= oppg.grense;
                    html += `<td style="border: 1px solid #000; padding: 4px; text-align: center; font-weight: bold; font-size: 11px; background: ${kritisk ? '#ffdce0' : 'transparent'};">${poeng}</td>`;
                });
                
                // DATA FOR SUM, GRENSE OG MAKS
                const sumKritisk = res.sum <= o.grenseTotal;
                html += `
                    <td style="border: 1px solid #000; padding: 4px; text-align: center; font-weight: bold; font-size: 11px; background: ${sumKritisk ? '#ffdce0' : '#f9f9f9'};">${res.sum}</td>
                    <td style="border: 1px solid #000; padding: 4px; text-align: center; font-size: 10px;">${o.grenseTotal}</td>
                    <td style="border: 1px solid #000; padding: 4px; text-align: center; font-size: 10px;">${maksTotal}</td>`;
            } else {
                // Økt colspan med 3 for å dekke de nye kolonnene
                html += `<td colspan="${o.oppgaver.length + 3}" style="border: 1px solid #000; padding: 4px; text-align: center; font-weight: bold; font-size: 10px; color: #7f8c8d; background: #fafafa; letter-spacing: 2px;">IKKE GJENNOMFØRT</td>`;
            }

            html += `</tr></tbody></table>`;

            if (erRegning) {
                html += `<div style="display: flex; flex-wrap: wrap; margin-top: 3px; gap: 6px;">`;
                o.oppgaver.forEach((oppg, i) => {
                    const nr = (i + 1).toString();
                    const navn = malForDenne[nr]?.navn || oppg.navn;
                    html += `<span style="font-size: 7px; color: #555;"><strong>O${nr}:</strong> ${navn}</span> `;
                });
                html += `</div>`;
            }
            html += `</div>`;
        });

        html += `</div>`;
        utskriftArea.innerHTML = html;
        setTimeout(() => { window.print(); }, 800);
        window.onafterprint = function() { utskriftArea.innerHTML = ""; };

    } catch (error) {
        console.error("Feil:", error);
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
    Swal.fire({
        title: `Vil du slette ${navn}?`,
        html: `Er du sikker på at du vil slette denne eleven fra prøven?<br><br>` +
              `<div style="background-color: #fff3cd; color: #856404; padding: 10px; border-radius: 5px; border: 1px solid #ffeeba;">` +
              `⚠️ <strong>Husk:</strong> Elever som ikke har gjennomført, men som fortsatt går i klassen,  <strong>ikke</strong> slettes, ` +
              `men settes som "Ikke gjennomført" i registreringsskjemaet.` +
              `</div>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33', // Rød farge for sletting
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Ja, slett eleven',
        cancelButtonText: 'Avbryt'
    }).then((result) => {
        // result.isConfirmed er sann hvis brukeren trykket på "Ja"
        if (result.isConfirmed) {
            db.ref(hentSti(navn)).update({ slettet: true }).then(() => {
                tegnTabell();
                
                // Valgfritt: Vis en liten bekreftelse på at det er gjort
                Swal.fire(
                    'Slettet!',
                    `${navn} er fjernet fra listen.`,
                    'success'
                );
            });
        }
    });
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
    // 1. SIKKERHET: Fjern historikk-modus så den ikke blokkerer vanlig utskrift
    document.body.classList.remove('historikk-modus');
    
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
                #utskriftRapportArea table { border-collapse: collapse !important; width: 100% !important; }
                #utskriftRapportArea th, #utskriftRapportArea td { border: 1px solid #000 !important; }
                @media print {
                    th { background-color: #f1f1f1 !important; -webkit-print-color-adjust: exact !important; }
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
        
        // Timeout for å sikre at DOM er tegnet
        setTimeout(() => { 
            window.print(); 
        }, 500);

        // Rydd opp etterpå
        window.onafterprint = function() { 
            utskriftArea.innerHTML = ""; 
        };

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
    genererUtviklingsTabell(resultater);
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

 // --- NYTT: Plugin for hvit bakgrunn (viktig for ren eksport) ---
    const whiteBackgroundPlugin = {
        id: 'custom_canvas_background_color',
        beforeDraw: (chart) => {
            const {ctx} = chart;
            ctx.save();
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, chart.width, chart.height);
            ctx.restore();
        }
    };   

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
            devicePixelRatio: 3,
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
        plugins: [ChartDataLabels, whiteBackgroundPlugin]
    });

    if (fag === "Lesing") devChartLesing = chart; else devChartRegning = chart;
}


function genererUtviklingsTabell(data) {
    const container = document.getElementById('utviklingTabellContainer');
    if (!data) return;

    // 1. Finn alle skoleår som finnes i dataene
    const alleSkoleAar = [];
    // Vi henter årstallene fra periodenavnet (f.eks. "Høst 24" -> vi vil ha tak i de unike årstallene)
    const aarSet = new Set();
    globalUtviklingPerioder.forEach(p => {
        const aarDel = p.split(' ')[1];
        aarSet.add(aarDel);
    });
    const sorterteAar = Array.from(aarSet).sort();

let html = `<table style="width:100%; border-collapse: collapse; font-size: 13px; background: white; border: 1px solid #ddd; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
        <thead>
            <tr style="background-color: #8e44ad !important;">
                <th style="padding: 12px; border: 1px solid #ddd; text-align: left; color: white; background-color: #8e44ad;">Prøve / Trinn</th>`;
    
    // Legg til skoleår som kolonner
    sorterteAar.forEach(aar => {
        html += `<th style="padding: 12px; border: 1px solid #ddd; text-align: center; color: white; background-color: #8e44ad;">20${aar}</th>`;
    });
    html += `</tr></thead><tbody>`;

    // 2. Definer rekkefølgen på radene (Fag -> Trinn -> Periode)
    const fagene = ["Lesing", "Regning"];
    const perioderTyper = ["Høst", "Vår"];

    fagene.forEach(fag => {
        // Overskrift for faget
        html += `<tr style="background: #f1f1f1; font-weight: bold;"><td colspan="${sorterteAar.length + 1}" style="padding: 8px; border: 1px solid #ddd;">${fag}</td></tr>`;

        for (let t = 1; t <= 7; t++) {
            perioderTyper.forEach(pType => {
                let radHarData = false;
                let radHtml = `<tr><td style="padding: 8px; border: 1px solid #ddd; padding-left: 20px;">${t}. trinn - ${pType}</td>`;

                sorterteAar.forEach(aar => {
                    const pKey = `${pType} ${aar}`;
                    const verdier = data[fag][pKey]?.[t] || [];
                    
                    if (verdier.length > 0) {
                        const snitt = (verdier.reduce((a, b) => a + b, 0) / verdier.length).toFixed(1);
                        radHtml += `<td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: bold;">${snitt}%</td>`;
                        radHarData = true;
                    } else {
                        radHtml += `<td style="padding: 8px; border: 1px solid #ddd; text-align: center; color: #ccc;">-</td>`;
                    }
                });

                radHtml += `</tr>`;
                if (radHarData) html += radHtml; // Legg bare til raden hvis det finnes resultater for det trinnet
            });
        }
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

function printUtvikling() {
    const canvasLesing = document.getElementById('chartUtviklingLesing');
    const canvasRegning = document.getElementById('chartUtviklingRegning');
    const tabellHtml = document.getElementById('utviklingTabellContainer').innerHTML;

    // Vi eksporterer med høyeste kvalitet. PNG er tapsfritt.
    const bildeLesing = canvasLesing.toDataURL("image/png", 1.0);
    const bildeRegning = canvasRegning.toDataURL("image/png", 1.0);

    const printVindu = window.open('', '_blank');
    printVindu.document.write(`
        <html>
            <head>
                <title>Skolens utvikling over tid</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; padding: 40px; color: #333; }
                    
                    /* TVINGER bildene til å se skarpe ut og bevare proporsjoner */
                    img { 
                        max-width: 100%; 
                        height: auto; 
                        margin-bottom: 30px; 
                        border: 1px solid #eee; 
                        /* Viktig for skarphet: */
                        image-rendering: -webkit-optimize-contrast; 
                        image-rendering: crisp-edges;
                    }

                    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
                    th, td { border: 1px solid #ddd; padding: 6px; text-align: center; }
                    th { background-color: #8e44ad !important; color: white !important; -webkit-print-color-adjust: exact; }
                    h1 { color: #8e44ad; margin-bottom: 5px; }
                    .dato { font-size: 12px; color: #666; margin-bottom: 30px; }
                    h3 { border-bottom: 2px solid #8e44ad; display: inline-block; padding-bottom: 5px; margin-top: 40px; }
                    
                    @media print {
                        body { padding: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <h1>Skolens utvikling over tid</h1>
                <div class="dato">Utskrift generert: ${new Date().toLocaleDateString('no-NO')}</div>
                
                <h3>Grafisk oversikt</h3>
                <div>
                    <img src="${bildeLesing}">
                </div>
                <div>
                    <img src="${bildeRegning}">
                </div>
                
                <div style="page-break-before: always;"></div>
                <h3>Detaljerte tallverdier</h3>
                <div style="margin-top: 20px;">
                    ${tabellHtml}
                </div>

                <script>
                    window.onload = function() {
                        // Litt forsinkelse for å sikre at store bilder er rendret i minnet
                        setTimeout(function() {
                            window.print();
                            window.onafterprint = function() { window.close(); };
                        }, 500);
                    };
                </script>
            </body>
        </html>
    `);
    printVindu.document.close();
}

async function sjekkUrlParametere() {
    const params = new URLSearchParams(window.location.search);
    
    if (params.has('aar') && params.has('fag')) {
        console.log("Link-modus aktivert for:", params.get('aar'));
        
        const feltMappings = [
            { id: 'mAar', verdi: params.get('aar') },
            { id: 'mFag', verdi: params.get('fag') },
            { id: 'mPeriode', verdi: params.get('periode') },
            { id: 'mTrinn', verdi: params.get('trinn') },
            { id: 'mKlasse', verdi: params.get('klasse') }
        ];

        for (const felt of feltMappings) {
            const el = document.getElementById(felt.id);
            if (el && felt.verdi) {
                // Sjekk om alternativet faktisk finnes i menyen før vi setter det
                // Hvis menyen fylles dynamisk, kan det hende vi må vente litt her
                el.value = felt.verdi;
                el.dispatchEvent(new Event('change'));
                
                // Gir nettleseren tid til å tegne menyer og kjøre onchange-logikk
                await new Promise(r => setTimeout(r, 100)); 
            }
        }

        // Kjør hentData til slutt (bruker en liten timeout for å være 100% sikker)
        setTimeout(() => {
            if (typeof hentData === "function") {
                console.log("Henter data basert på URL-parametre...");
                hentData();
            }
        }, 150);

        // Rens URL slik at man ikke lander på samme historikk ved "Refresh"
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({path: cleanUrl}, '', cleanUrl);
    }
}

// Kjør sjekken når siden har lastet ferdig
window.addEventListener('load', sjekkUrlParametere);

window.aapneLaererModal = aapneLaererModal;
window.oppdaterLaererListe = oppdaterLaererListe;