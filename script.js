const SHEET_ID = '1c6oCi27Vneu7y7GsOxDszICAunDAqegFrMqA_cVnRsQ';
const URL_CSV = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=BASEDATOS`;

let html5QrCode;
let headersGlobales = [];
let valoresGlobales = [];
let clienteGlobal = "";
let equipoGlobal = "";

// Iniciar la cámara al cargar la página
window.onload = () => {
    html5QrCode = new Html5Qrcode("reader");
    arrancarCamara();
};

function arrancarCamara() {
    const config = { fps: 15, disableFlip: false }; 

    html5QrCode.start(
        { facingMode: "environment" }, 
        config, 
        alEscanearExito,
        () => {} // Ignorar errores silenciosos
    )
    .then(() => habilitarZoom())
    .catch(err => {
        console.error("Error de cámara:", err);
        mostrarError("Error al abrir la cámara. Revisa los permisos.");
    });
}

function habilitarZoom() {
    const videoTrack = html5QrCode.getRunningTrackCameraCapabilities();
    if (videoTrack && videoTrack.zoomFeature() && videoTrack.zoomFeature().isSupported()) {
        const sliderZoom = document.getElementById('slider-zoom');
        const contenedorZoom = document.getElementById('contenedor-zoom');
        
        contenedorZoom.style.display = 'flex';
        
        const minZoom = videoTrack.zoomFeature().min();
        sliderZoom.min = minZoom;
        sliderZoom.max = videoTrack.zoomFeature().max();
        sliderZoom.step = videoTrack.zoomFeature().step();
        sliderZoom.value = minZoom;

        sliderZoom.addEventListener('input', (event) => {
            html5QrCode.applyVideoConstraints({
                advanced: [{ zoom: parseFloat(event.target.value) }]
            });
        });
    }
}

function alEscanearExito(textoDecodificado) {
    html5QrCode.stop().then(() => {
        const partes = textoDecodificado.split('|');
        if (partes.length === 2) {
            buscarEnBaseDeDatos(partes[0].trim(), partes[1].trim());
        } else {
            mostrarError("QR inválido. Formato esperado: Cliente|Equipo.");
        }
    });
}

async function buscarEnBaseDeDatos(cliente, equipo) {
    const divResultado = document.getElementById('resultado');
    const divDatos = document.getElementById('datos-ficha');

    // Aseguramos de estar en la vista de ficha, no en el formulario
    document.getElementById('vista-formulario').style.display = 'none';
    document.getElementById('vista-ficha').style.display = 'block';
    
    divResultado.style.display = 'block';
    divDatos.innerHTML = `
        <div style="text-align:center; padding: 20px;">
            <div class="loader"></div>
            <p style="color: var(--text-muted); margin-top: 10px;">Consultando base de datos...</p>
        </div>
    `;

    try {
        const respuesta = await fetch(URL_CSV);
        const datosCSV = await respuesta.text();

        const filas = datosCSV.split("\n").map(f => f.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/"/g, "").trim()));
        const encabezados = filas[0];

        const registro = filas.find(f => f[encabezados.indexOf("Cliente")] === cliente && f[encabezados.indexOf("Equipos")] === equipo);

        if (registro) {
            headersGlobales = encabezados;
            valoresGlobales = registro;
            clienteGlobal = cliente;
            equipoGlobal = equipo;
            renderizarFicha();
        } else {
            mostrarError(`No se encontró el equipo <b>${equipo}</b> del cliente <b>${cliente}</b>.`);
        }
    } catch (error) {
        mostrarError("No se pudo conectar con el servidor de Google Sheets.");
    }
}

// Función auxiliar original para sacar datos exactos
function getVal(col) {
    const idx = headersGlobales.indexOf(col);
    return (idx !== -1 && valoresGlobales[idx] && valoresGlobales[idx] !== "") ? valoresGlobales[idx] : "N/A";
}

function renderizarFicha() {
    let html = `
        <div style="background: var(--bg-color); padding:15px; border-radius:12px; margin-bottom:20px; text-align:center; border: 1px solid var(--border-color);">
            <strong style="color: var(--text-muted); font-size: 0.9rem;">${clienteGlobal}</strong><br>
            <span style="color: var(--accent); font-size:1.3rem; font-weight: 600; display: inline-block; margin-top: 5px;">${equipoGlobal}</span>
        </div>
        <div style="margin-bottom: 20px;">
            <div class="parametro"><span class="label">🏷️ Activo:</span> <span class="valor">${getVal("# Activo")}</span></div>
            <div class="parametro"><span class="label">👨‍🔧 Técnico:</span> <span class="valor">${getVal("Tecnico Responsable")}</span></div>
        </div>
        <h4 style="color: var(--text-muted); margin-bottom: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">Parámetros de Operación</h4>
    `;

    for (let i = 1; i <= 47; i++) {
        const param = getVal(`Parametro${i}`);
        if (param !== "N/A" && param !== "") {
            html += `
                <div class="parametro" style="flex-direction: column; align-items: flex-start;">
                    <span class="label" style="color: var(--text-main);">${param}</span>
                    <span class="valor" style="color: var(--text-muted); font-size: 0.85rem; text-align: left; max-width: 100%; margin-top: 4px;">
                        Límites: ${getVal(`LimiteInferior${i}`)} a ${getVal(`LimiteSuperior${i}`)}
                    </span>
                </div>`;
        }
    }

    document.getElementById('datos-ficha').innerHTML = html;
}

// --- LÓGICA DEL FORMULARIO Y VALIDACIÓN ---

function abrirFormulario() {
    document.getElementById('vista-ficha').style.display = 'none';
    document.getElementById('vista-formulario').style.display = 'block';

    let htmlCampos = "";

    // Construimos los inputs usando tu ciclo hasta 47
    for (let i = 1; i <= 47; i++) {
        const param = getVal(`Parametro${i}`);
        if (param !== "N/A" && param !== "") {
            const unidad = getVal(`Unidad${i}`);
            const limInf = getVal(`LimiteInferior${i}`);
            const limSup = getVal(`LimiteSuperior${i}`);

            htmlCampos += `
                <div class="form-group" id="grupo_${i}">
                    <label class="form-label">${i}. ${param} <small>(${unidad !== "N/A" ? unidad : ""})</small></label>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px;">Rango esperado: ${limInf} a ${limSup}</div>
                    
                    <input type="number" step="any" class="form-input" id="resultado_${i}" 
                           placeholder="Capturar resultado" 
                           data-min="${limInf}" data-max="${limSup}" 
                           oninput="validarLimites(this, ${i})">
                    
                    <div class="form-warning-text" id="alerta_${i}">⚠️ Valor fuera de rango. Se requiere justificación:</div>
                    <textarea class="form-comentario" id="comentario_${i}" rows="2" placeholder="Escribe por qué el valor está fuera de norma..."></textarea>
                </div>
            `;
        }
    }
    
    document.getElementById('contenedor-inputs').innerHTML = htmlCampos;
}

function validarLimites(inputElem, index) {
    const valorTexto = inputElem.value.trim();
    const minTexto = inputElem.getAttribute('data-min');
    const maxTexto = inputElem.getAttribute('data-max');
    
    const divComentario = document.getElementById(`comentario_${index}`);
    const alerta = document.getElementById(`alerta_${index}`);

    if (valorTexto === "") {
        divComentario.style.display = 'none';
        alerta.style.display = 'none';
        inputElem.style.borderColor = "var(--border-color)";
        return;
    }

    const valor = parseFloat(valorTexto);
    const min = parseFloat(minTexto);
    const max = parseFloat(maxTexto);
    let fueraDeRango = false;

    if (!isNaN(valor)) {
        if (!isNaN(min) && valor < min) fueraDeRango = true;
        if (!isNaN(max) && valor > max) fueraDeRango = true;
    }

    if (fueraDeRango) {
        divComentario.style.display = 'block';
        alerta.style.display = 'block';
        inputElem.style.borderColor = "#f59e0b"; // Naranja alerta
    } else {
        divComentario.style.display = 'none';
        divComentario.value = ''; 
        alerta.style.display = 'none';
        inputElem.style.borderColor = "var(--success)"; // Verde éxito
    }
}

function cancelarFormulario() {
    document.getElementById('vista-formulario').style.display = 'none';
    document.getElementById('vista-ficha').style.display = 'block';
}

function simularEnvio() {
    let mediciones = [];
    let formularioValido = true;

    // Recorremos los posibles 47 inputs
    for (let i = 1; i <= 47; i++) {
        const inputElem = document.getElementById(`resultado_${i}`);
        
        // Si el elemento existe (porque se renderizó)
        if (inputElem) {
            const paramNombre = getVal(`Parametro${i}`);
            const valor = inputElem.value.trim();
            const alertaVisible = document.getElementById(`alerta_${i}`).style.display === 'block';
            const comentario = document.getElementById(`comentario_${i}`).value.trim();

            if (valor !== "") {
                // Si está fuera de rango pero no puso comentario, detenemos todo
                if (alertaVisible && comentario === "") {
                    alert(`Falta justificación obligatoria para: ${paramNombre}`);
                    inputElem.focus(); // Llevamos la pantalla al input que falta
                    formularioValido = false;
                    break; 
                }

                mediciones.push({
                    parametro: paramNombre,
                    valor: valor,
                    comentario: comentario,
                    alerta: alertaVisible
                });
            }
        }
    }

    if (!formularioValido) return;

    if (mediciones.length === 0) {
        alert("No has capturado ningún resultado para enviar.");
        return;
    }

    // --- CONSTRUIR EL ARCHIVO TXT ---
    let contenidoTxt = `REPORTE TÉCNICO HYDROVEC\n`;
    contenidoTxt += `===================================\n`;
    contenidoTxt += `Fecha: ${new Date().toLocaleString()}\n`;
    contenidoTxt += `Cliente: ${clienteGlobal}\n`;
    contenidoTxt += `Equipo: ${equipoGlobal}\n`;
    contenidoTxt += `Técnico: ${getVal("Tecnico Responsable")}\n\n`;
    
    contenidoTxt += `MEDICIONES CAPTURADAS:\n`;
    contenidoTxt += `-----------------------------------\n`;
    mediciones.forEach(m => {
        contenidoTxt += `- ${m.parametro}: ${m.valor}\n`;
        if (m.alerta) {
            contenidoTxt += `  [FUERA DE RANGO] Justificación: ${m.comentario}\n`;
        }
    });

    // --- DESCARGAR ---
    const blob = new Blob([contenidoTxt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const enlaceDescarga = document.createElement("a");
    enlaceDescarga.href = url;
    enlaceDescarga.download = `Reporte_${clienteGlobal.replace(/\s+/g, '')}_${equipoGlobal.replace(/\s+/g, '')}.txt`;
    
    document.body.appendChild(enlaceDescarga);
    enlaceDescarga.click();
    document.body.removeChild(enlaceDescarga);
    URL.revokeObjectURL(url);
    
    alert("Reporte TXT descargado con éxito.");
    cancelarFormulario();
}

function mostrarError(mensaje) {
    document.getElementById('resultado').style.display = 'block';
    document.getElementById('datos-ficha').innerHTML = `
        <div style="text-align:center; padding:20px;">
            <div style="width: 50px; height: 50px; background: rgba(239, 68, 68, 0.1); color: #ef4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            </div>
            <h3 style="color: #ef4444; margin-bottom: 10px;">Error</h3>
            <p style="color: var(--text-muted);">${mensaje}</p>
        </div>
    `;
}

function reiniciarEscaner() {
    document.getElementById('resultado').style.display = 'none';
    document.getElementById('datos-ficha').innerHTML = '';
    arrancarCamara();
}