const SHEET_ID = '1c6oCi27Vneu7y7GsOxDszICAunDAqegFrMqA_cVnRsQ';
const URL_CSV = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=BASEDATOS`;

let html5QrCode;

// Iniciar la cámara al cargar la página
window.onload = () => {
    html5QrCode = new Html5Qrcode("reader");
    arrancarCamara();
};

function arrancarCamara() {
    // Configuramos a 15 fps sin qrbox (lo hacemos con CSS)
    const config = { fps: 15, disableFlip: false };

    html5QrCode.start(
        { facingMode: "environment" },
        config,
        alEscanearExito,
        () => { } // Ignorar errores silenciosos (cuando no lee nada)
    )
        .then(() => {
            // --- LÓGICA DE ZOOM ---
            habilitarZoom();
        })
        .catch(err => {
            console.error("Error de cámara:", err);
            mostrarError("Error al abrir la cámara. Revisa los permisos.");
        });
}

function habilitarZoom() {
    const videoTrack = html5QrCode.getRunningTrackCameraCapabilities();

    // Verificamos si la cámara soporta zoom por hardware
    if (videoTrack && videoTrack.zoomFeature() && videoTrack.zoomFeature().isSupported()) {
        const sliderZoom = document.getElementById('slider-zoom');
        const contenedorZoom = document.getElementById('contenedor-zoom');

        // Mostrar el slider
        contenedorZoom.style.display = 'flex';

        // Ajustar valores del slider a los límites de la cámara
        const minZoom = videoTrack.zoomFeature().min();
        const maxZoom = videoTrack.zoomFeature().max();
        const step = videoTrack.zoomFeature().step();

        sliderZoom.min = minZoom;
        sliderZoom.max = maxZoom;
        sliderZoom.step = step;
        sliderZoom.value = minZoom;

        // Escuchar cambios en el slider y aplicar zoom nativo
        sliderZoom.addEventListener('input', (event) => {
            const zoomVal = parseFloat(event.target.value);
            html5QrCode.applyVideoConstraints({
                advanced: [{ zoom: zoomVal }]
            });
        });
    } else {
        console.log("El dispositivo o navegador no soporta control de zoom web.");
    }
}

// Función que se dispara cuando lee el QR
function alEscanearExito(textoDecodificado) {
    // Detener la cámara para ahorrar recursos
    html5QrCode.stop().then(() => {
        // El texto viene como "Cliente|Equipo", lo separamos
        const partes = textoDecodificado.split('|');

        if (partes.length === 2) {
            const clienteEscaneado = partes[0].trim();
            const equipoEscaneado = partes[1].trim();
            buscarEnBaseDeDatos(clienteEscaneado, equipoEscaneado);
        } else {
            mostrarError("QR inválido. No tiene el formato Cliente|Equipo.");
        }
    });
}

async function buscarEnBaseDeDatos(cliente, equipo) {
    // Ocultar cámara y mostrar bottom sheet con loader
    //document.getElementById('seccion-escaner').style.display = 'none';
    const divResultado = document.getElementById('resultado');
    const divDatos = document.getElementById('datos-ficha');

    divResultado.style.display = 'block';

    // Diseño del loader adaptado al Dark Mode
    divDatos.innerHTML = `
        <div style="text-align:center; padding: 20px;">
            <div class="loader"></div>
            <p style="color: var(--text-muted); margin-top: 10px;">Consultando base de datos...</p>
        </div>
    `;

    try {
        const respuesta = await fetch(URL_CSV);
        const datosCSV = await respuesta.text();

        // Procesar CSV
        const filas = datosCSV.split("\n").map(f => f.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/"/g, "").trim()));
        const encabezados = filas[0];

        const idxCliente = encabezados.indexOf("Cliente");
        const idxEquipo = encabezados.indexOf("Equipos");

        // Buscar la coincidencia exacta
        const registro = filas.find(f => f[idxCliente] === cliente && f[idxEquipo] === equipo);

        if (registro) {
            renderizarFicha(encabezados, registro, cliente, equipo);
        } else {
            mostrarError(`No se encontró el equipo <b>${equipo}</b> del cliente <b>${cliente}</b> en la base de datos.`);
        }

    } catch (error) {
        mostrarError("No se pudo conectar con el servidor de Google Sheets.");
    }
}

function renderizarFicha(encabezados, valores, cliente, equipo) {
    // Cabecera de la ficha adaptada al Dark Mode
    let html = `
        <div style="background: var(--bg-color); padding:15px; border-radius:12px; margin-bottom:20px; text-align:center; border: 1px solid var(--border-color);">
            <strong style="color: var(--text-muted); font-size: 0.9rem;">${cliente}</strong><br>
            <span style="color: var(--accent); font-size:1.3rem; font-weight: 600; display: inline-block; margin-top: 5px;">${equipo}</span>
        </div>
    `;

    // AQUI ESTÁ LA MAGIA: 
    // .slice(0, -3) toma desde la primera columna (0) y recorta las últimas 3 (-3)
    const encabezadosAMostrar = encabezados.slice(0, -3);

    encabezadosAMostrar.forEach((nombre, i) => {
        const valor = valores[i];

        // Filtramos las columnas que ya usamos y las vacías
        if (valor && valor !== "" && nombre !== "Cliente" && nombre !== "Equipos" && nombre !== "") {
            html += `
                <div class="parametro">
                    <span class="label">${nombre}</span>
                    <span class="valor">${valor}</span>
                </div>`;
        }
    });

    document.getElementById('datos-ficha').innerHTML = html;
}

function mostrarError(mensaje) {
    //document.getElementById('seccion-escaner').style.display = 'none';
    document.getElementById('resultado').style.display = 'block';

    // Error adaptado al Dark Mode
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
    // Ocultar el panel de resultados
    document.getElementById('resultado').style.display = 'none';

    // Mostrar el contenedor de la cámara
    document.getElementById('seccion-escaner').style.display = 'block';

    // Limpiar el contenido anterior de la ficha
    document.getElementById('datos-ficha').innerHTML = '';

    // Como detuvimos la cámara en alEscanearExito, la volvemos a arrancar
    arrancarCamara();
}