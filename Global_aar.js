// 1. Lag en felles funksjon som genererer selve lista
function hentSkoleaarFraRegister() {
    let aarSett = new Set();
    
    // Vi inkluderer begge disse så de alltid er valgbare
    aarSett.add("2024-2025");
    aarSett.add("2025-2026");

    if (typeof elevRegister !== 'undefined') {
        Object.values(elevRegister).forEach(elev => {
            if (elev.startAar) {
                const sAar = parseInt(elev.startAar);
                aarSett.add(`${sAar}-${sAar + 1}`);
            }
        });
    }
    return Array.from(aarSett).sort().reverse();
}

// 2. Bruk den i admin-modalen (slik vi gjorde i stad)
function aapneSammenligningsModal() {
    // ... (din eksisterende åpne-logikk) ...
    
    const alleAar = hentSkoleaarFraRegister();
    fyllDropdown('compAar', alleAar);
    
    // ... resten av dropdownene ...
}

// 3. Bruk den på en helt annen side (f.eks. en elevliste-side)
function oppdaterAarIAnnenMeny() {
    const alleAar = hentSkoleaarFraRegister();
    fyllDropdown('velgSkoleaarFilter', alleAar);
}