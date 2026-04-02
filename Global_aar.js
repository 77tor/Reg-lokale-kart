// 1. Lag en felles funksjon som genererer selve lista
function hentSkoleaarFraRegister() {
    let aarSett = new Set();
    
    // Legg alltid til basen din
    aarSett.add("2024-2025");

    // Gå gjennom registeret (antar at elevRegister er tilgjengelig globalt)
    if (typeof elevRegister !== 'undefined') {
        Object.values(elevRegister).forEach(elev => {
            if (elev.startAar) {
                const sAar = parseInt(elev.startAar);
                aarSett.add(`${sAar}-${sAar + 1}`);
            }
        });
    }

    // Returner ferdig sortert liste
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