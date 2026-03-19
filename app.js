// --- FIREBASE CONFIG (Sørg for at denne er øverst) ---
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig); 
}
const auth = firebase.auth();
const db = firebase.database();

// --- FUNKSJONER ---
function login() { auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
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

function hentOppsettSpesifikk(aar, fag, periode, trinn) {
    try { return oppgaveStruktur[aar][fag][periode][trinn]; } catch(e) { return null; }
}

function hentData() {
    const a = document.getElementById('mAar').value;
    const f = document.getElementById('mFag').value;
    const p = document.getElementById('mPeriode').value;
    const t = document.getElementById('mTrinn').value;
    const k = document.getElementById('mKlasse').value;

    // Skjul rapportvisning når vi er i vanlig modus
    document.getElementById('tabellVisning').style.display = 'block';
    document.getElementById('rapportContainer').innerHTML = "";
    document.getElementById('dynamiskOverskrift').innerText = `Kartlegging: ${f} - ${t}${k} - ${p} ${a}`;

    db.ref(`kartlegging/${a}/${f}/${p}/${t}/${k}`).on('value', snap => {
        lagredeResultater = snap.val() || {};
        tegnTabell();
    });
}

// ÅRSRAPPORT-LOGIKK
async function kjorAdminRapport(type) {
    const aar = document.getElementById('adminAar').value;
    const fag = document.getElementById('adminFag').value;
    const periode = document.getElementById('adminPeriode').value;
    
    const container = document.getElementById('rapportContainer');
    document.getElementById('tabellVisning').style.display = 'none'; // Skjul vanlig tabell
    container.innerHTML = "<p>Genererer rapport for alle klasser...</p>";
    
    let samletHtml = "";
    const klasser = ["A", "B", "C", "D"];
    const trinnListe = ["1", "2", "3", "4", "5", "6", "7"];
    const vStartAar = parseInt(aar.split('-')[0]);

    for (let trinn of trinnListe) {
        for (let klasse of klasser) {
            const oppsett = hentOppsettSpesifikk(aar, fag, periode, trinn);
            if (!oppsett) continue;

            // Hent data fra Firebase for denne klassen
            const snap = await db.ref(`kartlegging/${aar}/${fag}/${periode}/${trinn}/${klasse}`).once('value');
            const data = snap.val() || {};
            
            // Finn elever som tilhører denne klassen
            let eleverIKlasse = Object.keys(elevRegister).filter(n => {
                const e = elevRegister[n];
                const cTrinn = e.startTrinn + (vStartAar - e.startAar);
                return cTrinn == trinn && e.startKlasse === klasse;
            }).sort();

            // Hvis det er en rapport og klassen har elever (eller vi vil ha tomme skjemaer)
            if (eleverIKlasse.length === 0) continue;

            let tabellHtml = `
                <div class="rapport-klasse-blokk page-break">
                    <h2 class="rapport-tittel">Kartlegging ${fag} - ${trinn}${klasse} - ${periode} ${aar}</h2>
                    <table>
                        <thead>
                            <tr>
                                <th style="text-align:left; width:200px;">Elevnavn</th>
                                ${oppsett.oppgaver.map(o => `<th>${o.navn}</th>`).join('')}
                                <th>Sum</th>
                            </tr>
                        </thead>
                        <tbody>`;

            // Legg til elever med data
            eleverIKlasse.forEach(navn => {
                const d = data[navn];
                const erKritisk = d && d.sum <= oppsett.grenseTotal;
                
                tabellHtml += `<tr><td style="text-align:left"><b>${navn}</b></td>`;
                oppsett.oppgaver.forEach((o, i) => {
                    const p = d?.oppgaver?.[i] !== undefined ? d.oppgaver[i] : "";
                    const cls = (d && o.grense !== -1 && p !== "" && p <= o.grense) ? 'style="background:#ffcccc"' : '';
                    tabellHtml += `<td ${cls}>${p}</td>`;
                });
                const sumCls = erKritisk ? 'style="background:#ffcccc"' : '';
                tabellHtml += `<td ${sumCls}>${d ? d.sum : ""}</td></tr>`;
            });

            // FYLL OPP TIL 26 RADER
            for (let i = eleverIKlasse.length; i < 26; i++) {
                tabellHtml += `<tr><td style="color:transparent">.</td>${oppsett.oppgaver.map(() => '<td></td>').join('')}<td></td></tr>`;
            }

            tabellHtml += `</tbody></table></div>`;
            samletHtml += tabellHtml;
        }
    }
    
    container.innerHTML = samletHtml;
    document.getElementById('modalRapport').style.display = 'none';
    document.getElementById('dynamiskOverskrift').innerText = `ÅRSRAPPORT: ${fag} - ${periode} ${aar}`;
}

function sjekkAdminKode() { if (prompt("Kode:") === "3850") document.getElementById('adminPanel').style.display = 'block'; }
function lukkAdmin() { document.getElementById('adminPanel').style.display = 'none'; }