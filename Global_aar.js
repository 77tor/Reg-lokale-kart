// --- 1. DYNAMISK BEREGNING AV SKOLEÅR ---
function finnNaavaerendeSkoleaar() {
    const idag = new Date();
    const aar = idag.getFullYear();
    const maaned = idag.getMonth(); // 0 = jan, 7 = aug

    // Skoleåret skifter 1. august (måned 7)
    if (maaned >= 7) {
        return `${aar}-${aar + 1}`;
    } else {
        return `${aar - 1}-${aar}`;
    }
}

// Sett den globale variabelen basert på dagens dato
var Global_aar = finnNaavaerendeSkoleaar();

// --- 2. GENERER LISTE OVER TILGJENGELIGE ÅR ---
function hentSkoleaarFraRegister() {
    let aarSett = new Set();
    
    // Legg til inneværende år og de faste årene
    aarSett.add("2024-2025");
    aarSett.add("2025-2026");
    aarSett.add(finnNaavaerendeSkoleaar());

    if (typeof elevRegister !== 'undefined') {
        Object.values(elevRegister).forEach(elev => {
            if (elev.startAar) {
                // Håndterer både "2024" og "2024-2025" format i registeret
                const sAar = parseInt(elev.startAar.toString().split('-')[0]);
                if (!isNaN(sAar)) {
                    aarSett.add(`${sAar}-${sAar + 1}`);
                }
            }
        });
    }
    return Array.from(aarSett).sort().reverse();
}

// --- 3. FYLL ALLE MENYER OG VELG RIKTIG ÅR ---
function oppdaterAlleAarsMenyer() {
    const alleAar = hentSkoleaarFraRegister();
    const menyer = ['mAar', 'teAar', 'adminAar', 'compAar'];
    
    // Finn ut hva som er det faktiske skoleåret akkurat nå (f.eks. "2025-2026")
    const aktueltNaa = finnNaavaerendeSkoleaar();

    menyer.forEach(id => {
        const meny = document.getElementById(id);
        if (!meny) return;

        // 1. TA VARE PÅ EKSISTERENDE VALG
        // Hvis brukeren har valgt noe i menyen allerede, vil vi beholde det
        const brukerensValg = meny.value;

        // 2. FYLL DROPDOWN
        fyllDropdown(id, alleAar);
        
        // 3. SETT VERDIEN (Prioritert rekkefølge)
        if (brukerensValg && alleAar.includes(brukerensValg)) {
            // Hvis menyen hadde et gyldig valg fra før, behold det
            meny.value = brukerensValg;
        } else if (alleAar.includes(aktueltNaa)) {
            // Hvis ikke, bruk det beregnede skoleåret (2025-2026)
            meny.value = aktueltNaa;
        } else {
            // Siste utvei: det øverste i lista
            meny.value = alleAar[0];
        }
    });

    // --- 4. OPPDATER GLOBAL_AAR VARIABELEN ---
    // Sørg for at den globale variabelen alltid matcher det som faktisk står i hovedmenyen
    const hovedMeny = document.getElementById('mAar');
    if (hovedMeny && hovedMeny.value) {
        Global_aar = hovedMeny.value;
    }

    // --- 5. EVENT LISTENER (KUN ÉN GANG) ---
    // Vi sjekker om vi allerede har satt opp lytteren for å unngå duplikater
    if (hovedMeny && !hovedMeny.dataset.hasListener) {
        hovedMeny.addEventListener('change', (e) => {
            Global_aar = e.target.value;
            console.log("Globalt år manuelt endret til:", Global_aar);
        });
        hovedMeny.dataset.hasListener = "true";
    }
}

// --- 4. HJELPEFUNKSJON FOR DROPDOWNS ---
function fyllDropdown(id, liste) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = "";
    liste.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item;
        opt.textContent = item;
        el.appendChild(opt);
    });
}

// Kjør oppdateringen når alt er lastet
window.addEventListener('load', () => {
    setTimeout(oppdaterAlleAarsMenyer, 100);
});