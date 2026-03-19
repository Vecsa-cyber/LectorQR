const SHEET_ID = '1_lR36o16Fua80bnr34A3Lah8IHLYuXNLri38feGmOe8';
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
        () => { } // Ignorar errores silenciosos
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
    // Te avisará si el QR se leyó correctamente (Puedes borrar este alert después de tus pruebas)
    //alert("QR Detectado: " + textoDecodificado); 

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

        if (datosCSV.includes("<!DOCTYPE html>") || datosCSV.includes("<html")) {
            alert("ERROR DE PERMISOS: Google Sheets bloqueó la descarga.");
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
        alert("CRASH EN EL CÓDIGO: " + error.message);
        mostrarError("Error interno: " + error.message);
    }
}

function getVal(col) {
    const idx = headersGlobales.indexOf(col);
    return (idx !== -1 && valoresGlobales[idx] && valoresGlobales[idx] !== "") ? valoresGlobales[idx] : "N/A";
}

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

    for (let i = 1; i <= 47; i++) {
        const param = getVal(`Parametro${i}`);

        if (param !== "N/A" && param !== "") {
            const subEquipo = getVal(`Equipo${i}`);
            const punto = getVal(`PuntoMuestro${i}`);
            const unidad = getVal(`Unidad${i}`);
            const limInf = getVal(`LimiteInferior${i}`);
            const limSup = getVal(`LimiteSuperior${i}`);

            const textoPrincipal = `${subEquipo !== "N/A" ? subEquipo : equipoActual}, ${param}`;
            const unidadStr = unidad !== "N/A" ? unidad : "";
            const textoSubtitulo = `(${punto !== "N/A" ? punto : "Sin punto especificado"}, ${limInf} a ${limSup} ${unidadStr})`;

            // Se agregó display:block y estilos neutrales al textarea para que nazca visible
            htmlCampos += `
                <div class="form-group" id="grupo_${i}">
                    <label class="form-label">${textoPrincipal}</label>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px;">${textoSubtitulo}</div>
                    
                    <input type="number" step="any" class="form-input" id="resultado_${i}" 
                           placeholder="Capturar nuevo resultado" 
                           data-min="${limInf}" data-max="${limSup}" 
                           oninput="validarLimites(this, ${i})">
                    
                    <div class="form-warning-text" id="alerta_${i}">⚠️ Valor fuera de rango. Se requiere justificación:</div>
                    
                    <textarea class="form-comentario" id="comentario_${i}" rows="2" 
                              placeholder="Observaciones / Justificación (Opcional si el valor es normal)" 
                              style="display: block; border-color: var(--border-color); background: rgba(15, 23, 42, 0.5);"></textarea>
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

    // Si el técnico borra el número, regresamos a estado neutral
    if (valorTexto === "") {
        alerta.style.display = 'none';
        inputElem.style.borderColor = "var(--border-color)";
        divComentario.style.borderColor = "var(--border-color)";
        divComentario.style.backgroundColor = "rgba(15, 23, 42, 0.5)";
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
        // Fuera de rango: Encendemos la alerta y pintamos el textarea de naranja
        alerta.style.display = 'block';
        inputElem.style.borderColor = "var(--warning)";
        divComentario.style.borderColor = "var(--warning)";
        divComentario.style.backgroundColor = "rgba(245, 158, 11, 0.1)";
        divComentario.placeholder = "⚠️ Obligatorio: Escribe la causa de este valor...";
    } else {
        // Dentro de rango: Quitamos alerta y pintamos de verde, pero NO borramos el comentario
        alerta.style.display = 'none';
        inputElem.style.borderColor = "var(--success)";
        divComentario.style.borderColor = "var(--border-color)";
        divComentario.style.backgroundColor = "rgba(15, 23, 42, 0.5)";
        divComentario.placeholder = "Observaciones / Justificación (Opcional si el valor es normal)";
    }
}

function cancelarFormulario() {
    document.getElementById('vista-formulario').style.display = 'none';
    document.getElementById('vista-ficha').style.display = 'block';
}

// Asegúrate de poner aquí la URL que te dé Google Apps Script (lo haremos en el Paso 2)
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyKbJNA3bNISvAFiKcjdqqNIRKD3Sx4U8oonrNlEL6mH7tBsH0Db4h1V7bYx6-lMJ4/exec";

function guardarReporte() {
    let formularioValido = true;
    let hayDatosCapturados = false;

    // 1. Validar que los campos fuera de rango tengan comentario (Igual que antes)
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

    // =========================================================
    // 2. CONSTRUIR EL ARREGLO EXACTO PARA LA HOJA "REGISTRO"
    // =========================================================

    // Generar Fecha Automática (Formato DD/MM/YYYY)
    const hoy = new Date();
    const dia = String(hoy.getDate()).padStart(2, '0');
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const anio = hoy.getFullYear();
    const fechaActual = `${dia}/${mes}/${anio}`;

    // Mapeo de las primeras 10 columnas fijas
    let filaRegistro = [
        fechaActual,
        clienteActual,
        equipoActual,
        getVal('# Activo'),
        "REP-" + new Date().getTime(), // Generamos un Folio Reporte automático único
        getVal('Folio Checklist'),
        getVal('Comercial') !== "N/A" ? getVal('Comercial') : getVal('Ejecutivo Comercial'),
        getVal('Tecnico Responsable'),
        getVal('Nombre Usuario'),
        getVal('Correo Elctronico Usuario') !== "N/A" ? getVal('Correo Elctronico Usuario') : getVal('Correo Electronico Usuario')
    ];

    // Mapeo de los 47 parámetros (9 columnas por cada uno)
    for (let i = 1; i <= 47; i++) {
        const inputElem = document.getElementById(`resultado_${i}`);

        // Si el input se generó en la pantalla (porque existe el parámetro)
        if (inputElem) {
            const resultadoCapturado = inputElem.value.trim();
            const comentarioCapturado = document.getElementById(`comentario_${i}`).value.trim();

            filaRegistro.push(
                getVal(`Parametro${i}`),
                getVal(`PuntoMuestro${i}`),
                getVal(`Equipo${i}`),
                getVal(`Unidad${i}`),
                resultadoCapturado, // Resultado1, Resultado2, etc.
                comentarioCapturado, // Comentarios1, Comentarios2, etc.
                getVal(`LimiteInferior${i}`),
                getVal(`LimiteSuperior${i}`),
                getVal(`TipoParametro${i}`)
            );
        } else {
            // Si el parámetro no existe (ej. el equipo solo tiene 10 parámetros),
            // llenamos las 9 celdas con espacios vacíos para no desfasar las columnas en Excel
            filaRegistro.push("", "", "", "", "", "", "", "", "");
        }
    }

    // Mapeo de las últimas 4 columnas ('O1', 'O2', 'O3', 'O4')
    filaRegistro.push("", "", "", "");

    // =========================================================
    // 3. ENVIAR LOS DATOS A GOOGLE APPS SCRIPT
    // =========================================================
    const btnGuardar = document.querySelector('.btn-success');
    const textoOriginal = btnGuardar.innerHTML;

    btnGuardar.innerHTML = `<div class="loader" style="width: 15px; height: 15px; border-width: 2px; margin: 0 10px 0 0; display: inline-block; vertical-align: middle;"></div> Guardando...`;
    btnGuardar.disabled = true;

    // Usamos mode: 'no-cors' para que el navegador no bloquee la redirección de Google
    fetch(WEB_APP_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({ action: "guardar", datos: filaRegistro })
    })
        .then(() => {
            // Con no-cors el navegador no nos deja leer la respuesta de Google, 
            // pero si llegamos aquí, significa que el envío de red fue exitoso.
            btnGuardar.innerHTML = `✅ Datos Cargados Correctamente`;
            btnGuardar.style.backgroundColor = "var(--success)";
            btnGuardar.style.borderColor = "var(--success)";

            setTimeout(() => {
                btnGuardar.innerHTML = textoOriginal;
                btnGuardar.disabled = false;
                reiniciarEscaner();
                alert("Los datos se han guardado con éxito en la hoja de Registro.");
            }, 2000);
        })
        .catch(error => {
            // Esto solo saltará si de verdad no hay internet o la URL está rota
            btnGuardar.innerHTML = `❌ Error de red`;
            console.error("Error enviando datos:", error);
            alert("Comprueba tu conexión a internet e intenta de nuevo.");

            setTimeout(() => {
                btnGuardar.innerHTML = textoOriginal;
                btnGuardar.disabled = false;
            }, 3000);
        });
}

// --- NUEVAS FUNCIONES PARA EL HISTORIAL ---//
async function consultarHistorial() {
    // 1. Expandir la vista a casi toda la pantalla y mostrar historial
    const divResultado = document.getElementById('resultado');
    divResultado.style.height = '95dvh'; // Hacemos que ocupe casi toda la pantalla
    divResultado.style.maxHeight = '95dvh';

    document.getElementById('vista-ficha').style.display = 'none';
    let vistaHistorial = document.getElementById('vista-historial');
    vistaHistorial.style.display = 'block';
    
    vistaHistorial.innerHTML = `
        <div style="text-align:center; padding: 20px;">
            <div class="loader"></div>
            <p style="color: var(--text-muted); margin-top: 10px;">Buscando registros anteriores...</p>
        </div>
    `;

    try {
        const URL_REGISTRO = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Registro&t=${new Date().getTime()}`;
        const respuesta = await fetch(URL_REGISTRO);
        const datosCSV = await respuesta.text();

        if (datosCSV.includes("<!DOCTYPE html>")) {
            throw new Error("No hay permisos públicos para leer la hoja Registro.");
        }

        const filas = datosCSV.split("\n").map(f => f.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/"/g, "").trim()));
        const encabezados = filas[0];

        // Búsqueda robusta por si los encabezados tienen espacios extra
        const idxCliente = encabezados.findIndex(h => h.toLowerCase().includes("cliente"));
        const idxEquipo = encabezados.findIndex(h => h.toLowerCase().includes("equipo"));
        const idxFecha = encabezados.findIndex(h => h.toLowerCase().includes("fecha"));

        const historial = filas.filter((f, i) => i > 0 && f[idxCliente] === clienteActual && f[idxEquipo] === equipoActual);

        if (historial.length === 0) {
            vistaHistorial.innerHTML = `
                <h3 style="text-align:center; color: var(--text-main); margin-bottom:15px;">Historial de ${equipoActual}</h3>
                <div style="text-align:center; padding: 20px; background: rgba(15, 23, 42, 0.5); border-radius: 12px; margin-bottom: 20px;">
                    <p style="color: var(--text-muted);">No hay reportes anteriores registrados para este equipo.</p>
                </div>
                <button class="btn btn-secondary" onclick="cerrarHistorial()">Volver a la Ficha</button>
            `;
            return;
        }

        let html = `<h3 style="text-align:center; color: var(--text-main); margin-bottom:15px;">Historial de ${equipoActual}</h3>`;

        // Generamos los bloques colapsables (Acordeón)
        historial.forEach((registro, index) => {
            let fechaTexto = (idxFecha !== -1 && registro[idxFecha]) ? registro[idxFecha] : "Fecha desconocida";
            let detallesHTML = "";

            for(let i = 1; i <= 47; i++) {
                let idxParam = encabezados.indexOf(`Parametro${i}`);
                let idxRes = encabezados.indexOf(`Resultado${i}`);
                let idxUni = encabezados.indexOf(`Unidad${i}`);
                let idxLimInf = encabezados.indexOf(`LimiteInferior${i}`);
                let idxLimSup = encabezados.indexOf(`LimiteSuperior${i}`);
                
                if(idxParam !== -1 && idxRes !== -1 && registro[idxParam] && registro[idxParam] !== "N/A" && registro[idxParam] !== "") {
                    let resultado = registro[idxRes];
                    let unidad = registro[idxUni] !== "N/A" ? registro[idxUni] : "";
                    let limInf = registro[idxLimInf] !== "N/A" ? registro[idxLimInf] : "";
                    let limSup = registro[idxLimSup] !== "N/A" ? registro[idxLimSup] : "";
                    
                    if (resultado && resultado !== "") {
                        detallesHTML += `
                        <div style="margin-bottom:8px; font-size: 0.9rem; padding-bottom: 8px; border-bottom: 1px dashed rgba(255,255,255,0.1);">
                            <div style="color: var(--text-muted);">${registro[idxParam]} <span style="font-size: 0.75rem; opacity: 0.7;">(Rango: ${limInf} - ${limSup})</span></div>
                            <div style="color: var(--text-main); font-weight: 600; text-align: right;">${resultado} ${unidad}</div>
                        </div>`;
                    }
                }
            }

            // Si este reporte tuvo parámetros capturados, creamos el "botón" de la fecha
            if (detallesHTML !== "") {
                html += `
                <div style="background: rgba(15, 23, 42, 0.5); border-radius: 12px; margin-bottom: 12px; border: 1px solid var(--border-color); overflow: hidden;">
                    <div onclick="toggleAcordeon('hist_${index}')" style="padding: 15px; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); cursor: pointer;">
                        <strong style="color: var(--accent); font-size: 1.1rem;">📅 ${fechaTexto}</strong>
                        <span id="icono_hist_${index}" style="color: var(--text-muted); font-size: 0.8rem;">▼ VER</span>
                    </div>
                    <div id="hist_${index}" style="display: none; padding: 15px; border-top: 1px solid var(--border-color); background: rgba(0,0,0,0.2);">
                        ${detallesHTML}
                    </div>
                </div>`;
            }
        });

        html += `<button class="btn btn-secondary" onclick="cerrarHistorial()" style="margin-top: 20px;">Volver a la Ficha</button>`;
        vistaHistorial.innerHTML = html;

    } catch (error) {
        vistaHistorial.innerHTML = `
            <div style="text-align:center; padding: 20px; color: #ef4444;">
                <p>Error al cargar historial: ${error.message}</p>
            </div>
            <button class="btn btn-secondary" onclick="cerrarHistorial()">Volver</button>
        `;
    }
}

// Función que abre y cierra las fechas del historial
function toggleAcordeon(id) {
    const contenido = document.getElementById(id);
    const icono = document.getElementById('icono_' + id);
    if (contenido.style.display === 'none') {
        contenido.style.display = 'block';
        icono.innerText = '▲ OCULTAR';
    } else {
        contenido.style.display = 'none';
        icono.innerText = '▼ VER';
    }
}

function cerrarHistorial() {
    // Regresamos el tamaño del panel a la normalidad
    const divResultado = document.getElementById('resultado');
    divResultado.style.height = 'auto'; 
    divResultado.style.maxHeight = '85dvh';

    document.getElementById('vista-historial').style.display = 'none';
    document.getElementById('vista-ficha').style.display = 'block';
}

function cerrarHistorial() {
    document.getElementById('vista-historial').style.display = 'none';
    document.getElementById('vista-ficha').style.display = 'block';
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
    document.getElementById('vista-historial').style.display = 'none'; // <-- Agrega esta línea
    arrancarCamara();
}