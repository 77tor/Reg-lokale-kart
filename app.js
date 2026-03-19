const firebaseConfig = {
    apiKey: "AIzaSyC7g1gllBUVACl3fkpYeEe7r1LfBs2ck3U",
    authDomain: "lokal-kartlegging.firebaseapp.com",
    databaseURL: "https://lokal-kartlegging-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "lokal-kartlegging",
    storageBucket: "lokal-kartlegging.firebasestorage.app",
    messagingSenderId: "913824113769",
    appId: "1:913824113769:web:95c6fdea2d3b49813d6ef8"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const auth = firebase.auth();
const db = firebase.database();

let lagredeResultater = {};
let valgtElevId = "";

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

    document.getElementById('hovedTabell').style.display = 'table';
    document.getElementById('rapportContainer').innerHTML = "";
    document.getElementById('dynamiskOverskrift').innerText = `Kartlegging i ${f} - ${t}${k} - ${p} ${a}`;

    db.ref(`kartlegging/${a}/${f}/${p}/${t}/${k}`).on('value', snap => {
        lagredeResultater = snap.val() || {};
        tegnTabell();
    });
}

function tegnTabell() {
    const a = document.getElementById('mAar').value;
    const f = document.getElementById('mFag').value;
    const p = document.getElementById('mPeriode').value;
    const t = document.getElementById('mTrinn').value;
    const k = document.getElementById('mKlasse').value;
    const oppsett = hentOppsettSpesifikk(a, f, p, t);
    
    const tHead = document.getElementById('tHead');
    const tBody = document.getElementById('tBody');
    if (!oppsett) { tBody.innerHTML = "<tr><td>Mangler oppsett for valget</td></tr>"; return; }

    let hode = `<tr><th style="text-align:left">Elevnavn</th>`;
    oppsett.oppgaver.forEach(o => hode += `<th>${o.navn}<br><small>max ${o.maks}</small></th>`);
    hode += `<th>Sum</th><th class="no-print">Handling</th></tr>`;
    tHead.innerHTML = hode;

    tBody.innerHTML = "";
    const vStartAar = parseInt(a.split('-')[0]);

    Object.keys(elevRegister).sort().forEach(navn => {
        const e = elevRegister[navn];
        const cTrinn = e.startTrinn + (vStartAar - e.startAar);
        if (cTrinn == t && e.startKlasse === k) {
            const d = lagredeResultater[navn];
            let rad = `<tr><td style="text-align:left"><b>${navn}</b></td>`;
            if (d && d.oppgaver) {
                oppsett.oppgaver.forEach((o, i) => {
                    const poeng = d.oppgaver[i] || 0;
                    let cls = (o.grense !== -1 && poeng <= o.grense) ? 'class="alert-low"' : '';
                    rad += `<td ${cls}>${poeng}</td>`;
                });
                let sumCls = (d.sum <= oppsett.grenseTotal) ? 'class="alert-low"' : '';
                rad += `<td ${sumCls}>${d.sum}</td><td class="no-print"><button class="btn btn-edit" onclick="visModal('${navn}')">Endre</button></td>`;
            } else {
                oppsett.oppgaver.forEach(() => rad += `<td>-</td>`);
                rad += `<td>-</td><td class="no-print"><button class="btn btn-reg" onclick="visModal('${navn}')">Reg</button></td>`;
            }
            tBody.innerHTML += rad + "</tr>";
        }
    });
}

async function kjorAdminRapport(type) {
    const aar = document.getElementById('adminAar').value;
    const fag = document.getElementById('adminFag').value;
    const periode = document.getElementById('adminPeriode').value;
    
    const container = document.getElementById('rapportContainer');
    document.getElementById('hovedTabell').style.display = 'none';
    container.innerHTML = "Henter data...";
    
    let samletHtml = "";
    const klasser = ["A", "B", "C", "D"];
    const trinnListe = ["1", "2", "3", "4", "5", "6", "7"];

    for (let trinn of trinnListe) {
        for (let klasse of klasser) {
            const oppsett = hentOppsettSpesifikk(aar, fag, periode, trinn);
            if (!oppsett) continue;

            const snap = await db.ref(`kartlegging/${aar}/${fag}/${periode}/${trinn}/${klasse}`).once('value');
            const data = snap.val() || {};
            
            const vStartAar = parseInt(aar.split('-')[0]);
            let eleverIKlasse = Object.keys(elevRegister).filter(n => {
                const e = elevRegister[n];
                return (e.startTrinn + (vStartAar - e.startAar)) == trinn && e.startKlasse === klasse;
            }).sort();

            if (eleverIKlasse.length === 0 && type === 'kritisk') continue;

            let tabellHtml = `<div class="rapport-side page-break">
                <h2 class="print-only-header">Kartlegging ${fag} - ${trinn}${klasse} - ${periode} ${aar}</h2>
                <table style="width:100%">
                    <thead><tr><th style="text-align:left">Elevnavn</th>`;
            oppsett.oppgaver.forEach(o => tabellHtml += `<th>${o.navn}</th>`);
            tabellHtml += `<th>Sum</th></tr></thead><tbody>`;

            let antallPrintet = 0;
            eleverIKlasse.forEach(navn => {
                const d = data[navn];
                const erKritisk = d && d.sum <= oppsett.grenseTotal;
                if (type === 'kritisk' && !erKritisk) return;

                antallPrintet++;
                tabellHtml += `<tr><td style="text-align:left">${navn}</td>`;
                oppsett.oppgaver.forEach((o, i) => {
                    const p = d?.oppgaver?.[i] || 0;
                    const cls = (d && o.grense !== -1 && p <= o.grense) ? 'style="background:#ffcccc"' : '';
                    tabellHtml += `<td ${cls}>${d ? p : '-'}</td>`;
                });
                const sumCls = erKritisk ? 'style="background:#ffcccc"' : '';
                tabellHtml += `<td ${sumCls}>${d ? d.sum : '-'}</td></tr>`;
            });

            // Fyll opp til 26 rader
            for (let i = antallPrintet; i < 26; i++) {
                tabellHtml += `<tr><td>&nbsp;</td>${oppsett.oppgaver.map(() => '<td></td>').join('')}<td></td></tr>`;
            }

            tabellHtml += `</tbody></table></div>`;
            samletHtml += tabellHtml;
        }
    }
    container.innerHTML = samletHtml;
    document.getElementById('modalRapport').style.display = 'none';
}

function sjekkAdminKode() { if (prompt("Kode:") === "3850") document.getElementById('adminPanel').style.display = 'block'; }
function lukkAdmin() { document.getElementById('adminPanel').style.display = 'none'; }
function visModal(navn) { valgtElevId = navn; document.getElementById('modalNavn').innerText = navn; document.getElementById('modal').style.display = 'block'; /* Oppgave-logikk her */ }
function lukkModal() { document.getElementById('modal').style.display = 'none'; }