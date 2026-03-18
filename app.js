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

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let lagredeResultater = {};
let valgtElevId = "";

// --- 2. AUTENTISERING ---
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

// --- 3. HJELPEFUNKSJONER ---
function hentOppsettSpesifikk(aar, fag, periode, trinn) {
    try { return oppgaveStruktur[aar][fag][periode][trinn]; } 
    catch (e) { return null; }
}

function hentOppsett() {
    return hentOppsettSpesifikk(
        document.getElementById('mAar').value,
        document.getElementById('mFag').value,
        document.getElementById('mPeriode').value,
        document.getElementById('mTrinn').value
    );
}

function hentSti(elev) {
    const a = document.getElementById('mAar').value;
    const f = document.getElementById('mFag').value;
    const p = document.getElementById('mPeriode').value;
    const t = document.getElementById('mTrinn').value;
    const k = document.getElementById('mKlasse').value;
    return `kartlegging/${a}/${f}/${p}/${t}/${k}/${elev}`;
}

// --- 4. HOVEDLOGIKK (DAGLIG VISNING) ---
function hentData() {
    const a = document.getElementById('mAar').value;
    const f = document.getElementById('mFag').value;
    const p = document.getElementById('mPeriode').value;
    const t = document.getElementById('mTrinn').value;
    const k = document.getElementById('mKlasse').value;

    const hovedInnhold = document.getElementById('hovedInnhold');
    // Gjenopprett standard tabell-struktur hvis vi kommer fra rapport-modus
    hovedInnhold.innerHTML = '<table id="hovedTabell"><thead id="tHead"></thead><tbody id="tBody"></tbody></table>';

    if (!a || !f || !p || !t || !k) return;

    db.ref(`kartlegging/${a}/${f}/${p}/${t}/${k}`).on('value', snapshot => {
        lagredeResultater = snapshot.val() || {};
        tegnTabell();
    });
}

function tegnTabell() {
    const oppsett = hentOppsett();
    const tHead = document.getElementById('tHead');
    const tBody = document.getElementById('tBody');
    const a = document.getElementById('mAar').value;
    const f = document.getElementById('mFag').value;
    const p = document.getElementById('mPeriode').value;
    const t = document.getElementById('mTrinn').value;
    const k = document.getElementById('mKlasse').value;

    document.getElementById('printTittel').innerText = `Kartlegging: ${f} - ${t}${k} (${p} ${a})`;

    if (!oppsett) {
        tBody.innerHTML = "<tr><td colspan='100%'>Ingen mal funnet.</td></tr>";
        return;
    }

    let hode = `<tr><th style="text-align:left">Navn</th>`;
    oppsett.oppgaver.forEach(o => hode += `<th>${o.navn}<br><small>max ${o.maks}</small></th>`);
    hode += `<th>Sum</th><th class="no-print">Handling</th></tr>`;
    tHead.innerHTML = hode;

    const aarStart = parseInt(a.split('-')[0]);
    tBody.innerHTML = "";

    Object.keys(elevRegister).sort().forEach(navn => {
        const e = elevRegister[navn];
        const curT = e.startTrinn + (aarStart - e.startAar);
        
        if (curT == t && e.startKlasse === k) {
            const d = lagredeResultater[navn];
            if (d && d.skjult) return;

            let rad = `<tr><td style="text-align:left"><b>${navn}</b></td>`;
            if (d && d.oppgaver) {
                oppsett.oppgaver.forEach((o, i) => {
                    const poeng = d.oppgaver[i] || 0;
                    let c = (f === "Lesing" && o.grense !== -1 && poeng <= o.grense) ? 'class="alert-low"' : '';
                    rad += `<td ${c}>${poeng}</td>`;
                });
                let sumC = (d.sum <= oppsett.grenseTotal) ? 'class="alert-low"' : '';
                rad += `<td ${sumC}>${d.sum}</td><td class="no-print"><button class="btn btn-edit" onclick="visModal('${navn}')">Endre</button></td>`;
            } else {
                oppsett.oppgaver.forEach(() => rad += `<td>-</td>`);
                rad += `<td>-</td><td class="no-print"><button class="btn btn-reg" onclick="visModal('${navn}')">Registrer</button></td>`;
            }
            tBody.innerHTML += rad + `</tr>`;
        }
    });
}

// --- 5. ÅRSRAPPORT (AUTO PRINT VISNING) ---
async function kjorAdminRapport(type) {
    const aar = document.getElementById('adminAar').value;
    const fag = document.getElementById('adminFag').value;
    const periode = document.getElementById('adminPeriode').value;
    
    document.getElementById('modalRapport').style.display = 'none';
    const hovedInnhold = document.getElementById('hovedInnhold');
    document.getElementById('printTittel').innerText = ""; // Tittel styres inne i loopen
    
    hovedInnhold.innerHTML = "<p class='no-print'>Genererer rapport...</p>";
    
    let samletHTML = "";
    const trinnListe = ["1", "2", "3", "4", "5", "6", "7"];
    const klasser = ["A", "B", "C", "D"];

    for (let t of trinnListe) {
        const oppsett = hentOppsettSpesifikk(aar, fag, periode, t);
        if (!oppsett) continue;

        for (let k of klasser) {
            const snap = await db.ref(`kartlegging/${aar}/${fag}/${periode}/${t}/${k}`).once('value');
            const data = snap.val() || {};
            
            let elever = Object.keys(data)
                .map(navn => ({ navn, ...data[navn] }))
                .filter(d => !d.skjult && d.oppgaver)
                .filter(d => type === 'alle' || d.sum <= oppsett.grenseTotal);

            if (elever.length > 0) {
                samletHTML += `<div class="page-break">
                    <h2 style="text-align:center; padding-top:20px;">${t}. trinn Klasse ${k} - ${fag} (${periode})</h2>
                    <table>
                        <thead>
                            <tr><th style="text-align:left">Navn</th>${oppsett.oppgaver.map(o => `<th>${o.navn}</th>`).join("")}<th>Sum</th></tr>
                        </thead>
                        <tbody>`;

                elever.sort((a,b) => a.navn.localeCompare(b.navn)).forEach(d => {
                    let rad = `<tr><td style="text-align:left"><b>${d.navn}</b></td>`;
                    oppsett.oppgaver.forEach((o, i) => {
                        const p = d.oppgaver[i] || 0;
                        let c = (fag === "Lesing" && o.grense !== -1 && p <= o.grense) ? 'style="background:#ffcccc !important;"' : '';
                        rad += `<td ${c}>${p}</td>`;
                    });
                    let sC = (d.sum <= oppsett.grenseTotal) ? 'style="background:#ffcccc !important;"' : '';
                    rad += `<td ${sC}>${d.sum}</td></tr>`;
                    samletHTML += rad;
                });
                samletHTML += `</tbody></table></div>`;
            }
        }
    }

    if (samletHTML === "") {
        hovedInnhold.innerHTML = "<p>Ingen data funnet.</p>";
    } else {
        hovedInnhold.innerHTML = samletHTML;
        // Trigger utskrift automatisk
        setTimeout(() => { window.print(); }, 500);
    }
}

// --- 6. MODAL & LAGRING ---
function visModal(navn) {
    const oppsett = hentOppsett();
    valgtElevId = navn;
    document.getElementById('modalNavn').innerText = navn;
    const container = document.getElementById('oppgaveFelter');
    container.innerHTML = "";
    const eksisterende = lagredeResultater[navn]?.oppgaver || [];

    oppsett.oppgaver.forEach((o, i) => {
        container.innerHTML += `<div><label style="display:inline-block; width:130px;">${o.navn}:</label>
        <input type="number" class="oppg-input" data-index="${i}" max="${o.maks}" value="${eksisterende[i] !== undefined ? eksisterende[i] : ""}" style="width:50px"></div>`;
    });
    document.getElementById('modal').style.display = 'block';
}

function lukkModal() { document.getElementById('modal').style.display = 'none'; }

function lagreData() {
    const inputs = document.querySelectorAll('.oppg-input');
    let verdier = [], sum = 0;
    inputs.forEach(i => { const v = parseInt(i.value) || 0; verdier.push(v); sum += v; });
    db.ref(hentSti(valgtElevId)).update({ oppgaver: verdier, sum: sum, dato: new Date().toISOString() }).then(lukkModal);
}

function sjekkAdminKode() {
    if (prompt("Kode:") === "3850") document.getElementById('adminPanel').style.display = 'block';
}

// Enter-tast logikk i modal
document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && document.getElementById('modal').style.display === 'block') {
        const inputs = Array.from(document.querySelectorAll('.oppg-input'));
        const idx = inputs.indexOf(document.activeElement);
        if (idx > -1 && idx < inputs.length - 1) { e.preventDefault(); inputs[idx+1].focus(); inputs[idx+1].select(); }
        else if (idx === inputs.length - 1) { lagreData(); }
    }
});