const SHEET_ID = '1c6oCi27Vneu7y7GsOxDszICAunDAqegFrMqA_cVnRsQ';
const URL_CSV = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=BASEDATOS`;

let html5QrCode;
let headersGlobales = [];
let valoresGlobales = [];
let clienteActual = "";
let equipoActual = "";

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
    // Te avisará si el QR se leyó correctamente
    alert("QR Detectado: " + textoDecodificado); 

    html5QrCode.stop().then(() => {
        const partes = textoDecodificado.split('|');
        if (partes.length === 2) {
            buscarEnBaseDeDatos(partes[0].trim(), partes[1].trim());
        } else {
            alert("Error: El QR no tiene el formato Cliente|Equipo. Tiene " + partes.length + " partes.");
            mostrarError("QR inválido. Formato esperado: Cliente|Equipo.");
        }
    }).catch(err => {
        alert("Error al detener cámara: " + err.message);
    });
}

async function buscarEnBaseDeDatos(cliente, equipo) {
    try {
        const divResultado = document.getElementById('resultado');
        const divDatos = document.getElementById('datos-ficha');

        // Si falta algo en el HTML, esto nos avisará
        if (!document.getElementById('vista-formulario')) {
            alert("FALTA EN EL HTML: No encuentro el id 'vista-formulario'");
            return;
        }

        document.getElementById('vista-formulario').style.display = 'none';
        document.getElementById('vista-ficha').style.display = 'block';
        
        divResultado.style.display = 'block';
        divDatos.innerHTML = `
            <div style="text-align:center; padding: 20px;">
                <div class="loader"></div>
                <p style="color: var(--text-muted); margin-top: 10px;">Consultando base de datos...</p>
            </div>
        `;

        const respuesta = await fetch(URL_CSV);
        const datosCSV = await respuesta.text();
        
        // Si Sheets nos mandó un HTML de error en vez de un CSV, lo atrapamos aquí
        if (datosCSV.includes("<!DOCTYPE html>") || datosCSV.includes("<html")) {
            alert("ERROR DE PERMISOS: Google Sheets bloqueó la descarga. Asegúrate de que el archivo sea 'Público para cualquier usuario con el enlace'.");
            mostrarError("Error de permisos en Base de Datos.");
            return;
        }

        const filas = datosCSV.split("\n").map(f => f.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/"/g, "").trim()));
        const encabezados = filas[0];

        const registro = filas.find(f => f[encabezados.indexOf("Cliente")] === cliente && f[encabezados.indexOf("Equipos")] === equipo);

        if (registro) {
            headersGlobales = encabezados;
            valoresGlobales = registro;
            clienteActual = cliente;
            equipoActual = equipo;
            renderizarFicha();
        } else {
            mostrarError(`No se encontró el equipo <b>${equipo}</b> del cliente <b>${cliente}</b>.`);
        }
    } catch (error) {
        // Esta es la red de seguridad principal
        alert("CRASH EN EL CÓDIGO: " + error.message);
        mostrarError("Error interno: " + error.message);
    }
}

// Función auxiliar para obtener datos exactos manejando errores
function getVal(col) {
    const idx = headersGlobales.indexOf(col);
    return (idx !== -1 && valoresGlobales[idx] && valoresGlobales[idx] !== "") ? valoresGlobales[idx] : "N/A";
}

// Renderiza la primera vista (Resumen del equipo)
function renderizarFicha() {
    let html = `
        <div style="background: var(--bg-color); padding:15px; border-radius:12px; margin-bottom:20px; text-align:center; border: 1px solid var(--border-color);">
            <strong style="color: var(--text-muted); font-size: 0.9rem;">${clienteActual}</strong><br>
            <span style="color: var(--accent); font-size:1.3rem; font-weight: 600; display: inline-block; margin-top: 5px;">${equipoActual}</span>
        </div>
        <div style="margin-bottom: 20px;">
            <div class="parametro"><span class="label">🏷️ Activo:</span> <span class="valor">${getVal("# Activo")}</span></div>
            <div class="parametro"><span class="label">👨‍🔧 Técnico:</span> <span class="valor">${getVal("Tecnico Responsable")}</span></div>
            <div class="parametro"><span class="label">📄 Folio:</span> <span class="valor">${getVal("Folio Checklist")}</span></div>
        </div>
        <p style="color: var(--text-muted); font-size: 0.9rem; text-align: center; margin-bottom: 10px;">
            Haz clic en "Cargar Datos" para llenar el reporte de parámetros.
        </p>
    `;
    document.getElementById('datos-ficha').innerHTML = html;
}

// --- LÓGICA DEL FORMULARIO Y VALIDACIÓN ---

function abrirFormulario() {
    document.getElementById('vista-ficha').style.display = 'none';
    document.getElementById('vista-formulario').style.display = 'block';

    let htmlCampos = "";

    // Ciclo para los 47 parámetros
    for (let i = 1; i <= 47; i++) {
        const param = getVal(`Parametro${i}`);
        
        // Si la columna Parametro existe y no está vacía
        if (param !== "N/A" && param !== "") {
            const subEquipo = getVal(`Equipo${i}`);
            const punto = getVal(`PuntoMuestro${i}`);
            const unidad = getVal(`Unidad${i}`);
            const limInf = getVal(`LimiteInferior${i}`);
            const limSup = getVal(`LimiteSuperior${i}`);

            // Construimos los textos según lo solicitado
            const textoPrincipal = `${subEquipo !== "N/A" ? subEquipo : equipoActual}, ${param}`;
            const unidadStr = unidad !== "N/A" ? unidad : "";
            const textoSubtitulo = `(${punto !== "N/A" ? punto : "Sin punto especificado"}, ${limInf} a ${limSup} ${unidadStr})`;

            htmlCampos += `
                <div class="form-group" id="grupo_${i}">
                    <label class="form-label">${textoPrincipal}</label>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px;">${textoSubtitulo}</div>
                    
                    <input type="number" step="any" class="form-input" id="resultado_${i}" 
                           placeholder="Capturar nuevo resultado" 
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

    // Si está vacío, resetear
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
        inputElem.style.borderColor = "var(--warning)"; // Naranja alerta
    } else {
        divComentario.style.display = 'none';
        divComentario.value = ''; // Limpiar comentario
        alerta.style.display = 'none';
        inputElem.style.borderColor = "var(--success)"; // Verde éxito
    }
}

function cancelarFormulario() {
    document.getElementById('vista-formulario').style.display = 'none';
    document.getElementById('vista-ficha').style.display = 'block';
}

function guardarReporte() {
    // 1. Validar que los campos fuera de rango tengan comentario
    let formularioValido = true;
    let hayDatosCapturados = false;

    for (let i = 1; i <= 47; i++) {
        const inputElem = document.getElementById(`resultado_${i}`);
        
        if (inputElem) {
            const valor = inputElem.value.trim();
            const alertaVisible = document.getElementById(`alerta_${i}`).style.display === 'block';
            const comentario = document.getElementById(`comentario_${i}`).value.trim();

            if (valor !== "") {
                hayDatosCapturados = true;
                if (alertaVisible && comentario === "") {
                    const paramNombre = getVal(`Parametro${i}`);
                    alert(`El parámetro "${paramNombre}" está fuera de límites. Es obligatorio escribir un comentario/justificación.`);
                    inputElem.focus(); 
                    formularioValido = false;
                    break; 
                }
            }
        }
    }

    if (!formularioValido) return;
    if (!hayDatosCapturados) {
        alert("No has capturado ningún resultado para guardar.");
        return;
    }

    // 2. Simular el guardado en base de datos
    const btnGuardar = document.querySelector('.btn-success');
    const textoOriginal = btnGuardar.innerHTML;
    
    btnGuardar.innerHTML = `<div class="loader" style="width: 15px; height: 15px; border-width: 2px; margin: 0 10px 0 0; display: inline-block; vertical-align: middle;"></div> Procesando...`;
    btnGuardar.disabled = true;

    // Simulamos un retraso de red de 1.5 segundos
    setTimeout(() => {
        // Confirmación visual
        btnGuardar.innerHTML = `✅ Datos Cargados Correctamente`;
        btnGuardar.style.backgroundColor = "var(--success)";
        btnGuardar.style.borderColor = "var(--success)";

        setTimeout(() => {
            btnGuardar.innerHTML = textoOriginal;
            btnGuardar.disabled = false;
            // Ocultamos el formulario y regresamos a la cámara
            reiniciarEscaner();
            alert("Los datos se han guardado con éxito. (Modo Simulación)");
        }, 2000);
        
    }, 1500); 
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
    document.getElementById('vista-formulario').style.display = 'none';
    document.getElementById('vista-ficha').style.display = 'block';
    document.getElementById('resultado').style.display = 'none';
    document.getElementById('datos-ficha').innerHTML = '';
    arrancarCamara();
}