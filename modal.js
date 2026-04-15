console.log("🚀 modal.js lastes...");

window.visBokModal = function(tema, aktueltTrinn, sesong) {
    console.log("KLIKK BEKREFTET: Åpner modal for", tema);
    
    let alleTrinnReferanser = "";
    for (let t = 1; t <= 7; t++) {
        const m = window["mappingTrinn" + t];
        if (m && m[sesong]) {
            let treff = [];
            Object.keys(m[sesong]).forEach(nr => {
                const data = m[sesong][nr];
                if (data && data.tema === tema && data.bøker) {
                    data.bøker.forEach(b => {
                        let navn = (b.bok === "ovebok") ? "Øvebok" : "Grunnbok " + t + (b.bok.toUpperCase().includes("A") ? "A" : "B");
                        treff.push(navn + " s. " + b.side);
                    });
                }
            });
            if (treff.length > 0) {
                const unike = [...new Set(treff)];
                alleTrinnReferanser += `<div style="margin-bottom:8px;"><strong>${t}. trinn:</strong><br>${unike.join(", ")}</div>`;
            }
        }
    }

    let modal = document.getElementById('analyse-bok-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'analyse-bok-modal';
        modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:9999999; font-family:sans-serif; backdrop-filter: blur(3px);";
        document.body.appendChild(modal);
    }

    const temaID = tema.replace(/[^a-zA-Z0-9]/g, '');
    const refElement = document.getElementById('temp-ref-' + temaID);
    const gjeldendeTrinnReferanse = refElement ? refElement.innerText : 'Referanse ikke funnet.';

    modal.innerHTML = `
        <div style="background:white; padding:25px; border-radius:15px; max-width:450px; width:90%; box-shadow:0 15px 40px rgba(0,0,0,0.4); position:relative; color: #333; text-align: left;">
            <h2 style="margin:0 0 15px 0; color:#2c3e50; border-bottom: 2px solid #eee; padding-bottom: 10px;">${tema}</h2>
            <p style="margin-bottom:5px; font-weight:bold;">For ditt trinn (${aktueltTrinn}.):</p>
            <div style="background:#e8f4fd; padding:15px; border-radius:10px; border-left:5px solid #3498db; margin-bottom:15px;">
                ${gjeldendeTrinnReferanse}
            </div>
            <button onclick="document.getElementById('ekstra-trinn').style.display='block'; this.style.display='none'" 
                    style="width:100%; padding:10px; background:#f8f9fa; border:1px solid #ddd; border-radius:8px; cursor:pointer;">
                🔍 Vis andre trinn (differensiering)
            </button>
            <div id="ekstra-trinn" style="display:none; margin-top:15px; padding:15px; background:#fdfdfd; border:1px solid #eee; border-radius:10px; font-size:0.9em; max-height:180px; overflow-y:auto;">
                ${alleTrinnReferanser || "Ingen andre trinn funnet."}
            </div>
            <button onclick="document.getElementById('analyse-bok-modal').remove()" 
                    style="margin-top:20px; width:100%; padding:12px; background:#2c3e50; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">
                Lukk
            </button>
        </div>
    `;
};

console.log("✅ visBokModal er installert.");