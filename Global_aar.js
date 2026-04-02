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
    
    // Vi bruker Global_aar (som nå er satt til dagens skoleår)
    const standardValg = Global_aar;

    menyer.forEach(id => {
        const meny = document.getElementById(id);
        if (!meny) return;

        // Bruker din eksisterende fyllDropdown-funksjon
        fyllDropdown(id, alleAar);
        
        // Sett menyen til dagens skoleår hvis det finnes i lista
        if (alleAar.includes(standardValg)) {
            meny.value = standardValg;
        } else {
            meny.value = alleAar[0]; // Fallback til nyeste år
        }
    });

    // Lytt etter manuelle endringer i hovedmenyen
    const hovedMeny = document.getElementById('mAar');
    if (hovedMeny) {
        hovedMeny.addEventListener('change', (e) => {
            Global_aar = e.target.value;
            console.log("Globalt år endret til:", Global_aar);
        });
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