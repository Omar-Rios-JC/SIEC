let usuarioActual = null;
let relaciones = {};
let datosTransformados = [];
let ultimoResultado = [];
let syncTimer = null;
let opcionesBusqueda = [];
let sugerenciaActiva = -1;
let resumenUltimaLectura = null;

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const API = {
    login: 'login.php',
    logout: 'logout.php',
    buscar: 'buscar.php',
    subirInventario: 'subir_inventario.php',
    subirMetodologia: 'subir_metodologia.php'
};

document.addEventListener('DOMContentLoaded', async () => {

    usuarioActual = window.IFU_SESSION || {
        nombre: document.getElementById('sessionName').textContent.trim(),
        rol: document.getElementById('sessionRole').textContent.trim()
    };

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', iniciarSesion);
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', cerrarSesion);
    }

    document.getElementById('fileUpload').addEventListener('change', procesarArchivo);
    document.getElementById('fileMetodologia').addEventListener('change', cargarMetodologia);
    document.getElementById('searchBtn').addEventListener('click', realizarBusqueda);
    document.getElementById('searchInput').addEventListener('input', actualizarSugerencias);
    document.getElementById('searchInput').addEventListener('focus', actualizarSugerencias);
    document.getElementById('searchInput').addEventListener('keydown', navegarSugerencias);
    document.getElementById('clearSearchBtn').addEventListener('click', () => limpiarBuscador(true));
    document.addEventListener('click', cerrarSugerenciasAlSalir);
    document.getElementById('downloadBtn').addEventListener('click', descargarExcel);
    document.getElementById('filtroTabla').addEventListener('input', filtrarTabla);
    document.getElementById('filterZero').addEventListener('change', filtrarTabla);
    document.getElementById('clearStorageBtn').addEventListener('click', limpiarDatos);

    mostrarApp();
    await cargarDatos();
    iniciarActualizacionTiempoReal();
});

async function verificarSesion() {
    usuarioActual = window.IFU_SESSION;

    if (usuarioActual) {
        mostrarApp();
    } else {
        mostrarLogin();
    }
}

async function iniciarSesion(e) {
    e.preventDefault();

    const usuario = document.getElementById('usuario').value.trim();
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(API.login, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario, password })
        });
        const result = await response.json();

        if (!response.ok || !result.ok) {
            throw new Error(result.message || 'No se pudo iniciar sesión');
        }

        usuarioActual = result.usuario;
        window.IFU_SESSION = result.usuario;
        document.getElementById('loginForm').reset();
        mostrarApp();
        await cargarDatos();
        iniciarActualizacionTiempoReal();
    } catch (error) {
        mostrarMensajeGlobal(error.message, 'error');
    }
}

async function cerrarSesion() {
    try {
        await fetch(API.logout, { method: 'POST' });
    } finally {
        usuarioActual = null;
        datosTransformados = [];
        relaciones = {};
        ultimoResultado = [];
        detenerActualizacionTiempoReal();
        mostrarLogin();
    }
}

function mostrarLogin() {
    document.getElementById('loginView').classList.remove('hidden');
    document.getElementById('appView').classList.add('hidden');
}

function mostrarApp() {
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('appView').classList.remove('hidden');
    document.getElementById('sessionName').textContent = usuarioActual.nombre || usuarioActual.usuario;
    document.getElementById('sessionRole').textContent = usuarioActual.rol;

    const esAdmin = usuarioActual.rol === 'admin';

    document.querySelectorAll('.admin-only').forEach((elemento) => {
        elemento.classList.toggle('hidden', !esAdmin);
    });
}

async function cargarDatos() {
    mostrarMensaje('Cargando datos...', 'info');

    try {
        const result = await fetchJson(API.buscar);
        datosTransformados = result.inventario || [];
        relaciones = result.metodologia || {};

        guardarRespaldoLocal();
        refrescarInterfaz();

        if (datosTransformados.length || Object.keys(relaciones).length) {
            mostrarMensaje('Datos cargados correctamente.', 'success');
        } else {
            mostrarMensaje('No hay datos cargados todavía.', 'info');
        }
    } catch (error) {
        datosTransformados = leerLocalStorage('inventarioIFU', []);
        relaciones = leerLocalStorage('relacionesIFU', {});
        refrescarInterfaz();
        mostrarMensaje(`No se pudo leer MySQL. Se usó localStorage como respaldo. ${error.message}`, 'error');
    }
}

function iniciarActualizacionTiempoReal() {
    detenerActualizacionTiempoReal();

    syncTimer = setInterval(async () => {
        if (!usuarioActual) return;

        try {
            const result = await fetchJson(API.buscar);
            const inventarioNuevo = JSON.stringify(result.inventario || []);
            const metodologiaNueva = JSON.stringify(result.metodologia || {});

            if (
                inventarioNuevo !== JSON.stringify(datosTransformados) ||
                metodologiaNueva !== JSON.stringify(relaciones)
            ) {
                datosTransformados = result.inventario || [];
                relaciones = result.metodologia || {};
                guardarRespaldoLocal();
                refrescarInterfaz();
                mostrarMensaje('Datos actualizados.', 'success');
            }
        } catch (error) {
            console.warn('Actualización omitida:', error);
        }
    }, 15000);
}

function detenerActualizacionTiempoReal() {
    if (syncTimer) {
        clearInterval(syncTimer);
        syncTimer = null;
    }
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
        cache: 'no-store',
        ...options
    });
    const result = await response.json();

    if (!response.ok || !result.ok) {
        throw new Error(result.message || 'Error en la solicitud');
    }

    return result;
}

function leerArchivoExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (evento) => {
            try {
                const data = new Uint8Array(evento.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const cuadricula = [];

                workbook.SheetNames.forEach((nombreHoja) => {
                    const hoja = workbook.Sheets[nombreHoja];
                    const filasHoja = XLSX.utils.sheet_to_json(hoja, {
                        header: 1,
                        defval: ''
                    });

                    if (filasHoja.length > 0) {
                        cuadricula.push(['__IFU_HOJA__', nombreHoja], ...filasHoja, []);
                    }
                });

                resolve(cuadricula);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
        reader.readAsArrayBuffer(file);
    });
}

async function cargarMetodologia(e) {
    if (!esAdmin()) {
        mostrarMensaje('Solo el administrador puede subir metodología.', 'error');
        return;
    }

    const file = e.target.files[0];

    if (!file) return;

    mostrarLoading(true);
    mostrarMensaje('Procesando metodología...', 'info');

    try {
        validarArchivo(file);

        const cuadricula = await leerArchivoExcel(file);
        relaciones = transformarMetodologia(cuadricula);
        validarMetodologiaProcesada(relaciones);

        await fetchJson(API.subirMetodologia, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                file: archivoMeta(file),
                metodologia: relaciones
            })
        });

        guardarRespaldoLocal();
        refrescarInterfaz();
        mostrarMensaje('Metodología actualizada correctamente.', 'success');
    } catch (error) {
        mostrarMensaje(`Error al subir metodología: ${error.message}`, 'error');
    } finally {
        mostrarLoading(false);
        e.target.value = '';
    }
}

function transformarMetodologia(cuadricula) {
    const nuevasRelaciones = {};

    cuadricula.forEach((fila) => {
        const columnas = fila.map((celda) => celda ? celda.toString().trim() : '');
        const clavePadre = limpiarClave(columnas[2] || '');
        const descripcion = (columnas[3] || '').toString().trim();

        if (/^\d{4,6}$/.test(clavePadre)) {
            nuevasRelaciones[clavePadre] = {
                descripcion,
                hijos: []
            };

            columnas.forEach((valor) => {
                const claveHijo = limpiarClave(valor);

                if (
                    /^\d{4,6}$/.test(claveHijo) &&
                    claveHijo !== clavePadre &&
                    !nuevasRelaciones[clavePadre].hijos.includes(claveHijo)
                ) {
                    nuevasRelaciones[clavePadre].hijos.push(claveHijo);
                }
            });
        }
    });

    return nuevasRelaciones;
}

async function procesarArchivo(e) {
    if (!esAdmin()) {
        mostrarMensaje('Solo el administrador puede subir inventario.', 'error');
        return;
    }

    const file = e.target.files[0];

    if (!file) return;

    mostrarLoading(true);
    mostrarMensaje('Procesando inventario...', 'info');

    try {
        validarArchivo(file);

        const cuadricula = await leerArchivoExcel(file);
        datosTransformados = transformarInventario(cuadricula);
        validarInventarioProcesado(datosTransformados);

        await fetchJson(API.subirInventario, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                file: archivoMeta(file),
                inventario: datosTransformados
            })
        });

        guardarRespaldoLocal();
        refrescarInterfaz();
        const resumen = resumenUltimaLectura;
        const detalle = resumen
            ? ` ${resumen.totalClaves} claves leídas en ${resumen.bloquesLeidos} bloque(s) de ${resumen.hojasLeidas} hoja(s).`
            : '';
        mostrarMensaje(`Inventario actualizado correctamente.${detalle}`, 'success');
    } catch (error) {
        mostrarMensaje(`Error al subir inventario: ${error.message}`, 'error');
    } finally {
        mostrarLoading(false);
        e.target.value = '';
    }
}

function transformarInventario(cuadricula) {
    const inventarioPorClave = new Map();
    let bloquesLeidos = 0;
    const hojasLeidas = cuadricula.filter(
        (fila) => Array.isArray(fila) && fila[0] === '__IFU_HOJA__'
    ).length;

    for (let indice = 0; indice < cuadricula.length; indice++) {
        const encabezados = cuadricula[indice] || [];
        const columnasIFU = encabezados
            .map((celda, columna) => {
                const encabezado = extraerEncabezadoIFU(celda);
                return encabezado ? { ...encabezado, columna } : null;
            })
            .filter(Boolean);

        const contieneClavesBase = columnasIFU.some(
            (item) => item.clave === '50100' || item.clave === '60000'
        );

        if (columnasIFU.length < 2 && !contieneClavesBase) continue;

        let encontroUnidad = false;

        for (let f = indice + 1; f < cuadricula.length; f++) {
            const filaActual = cuadricula[f] || [];

            if (filaActual.length === 0) break;
            if (filaActual[0] === '__IFU_HOJA__') break;

            const posiblesEncabezados = filaActual
                .map((celda) => extraerEncabezadoIFU(celda))
                .filter(Boolean);
            if (posiblesEncabezados.length >= 2) break;

            if (!esFilaInventarioUnidad(filaActual)) continue;

            encontroUnidad = true;
            bloquesLeidos++;

            columnasIFU.forEach(({ clave, descripcion, columna }) => {
                const valorCrudo = filaActual[columna];
                const item = {
                    clave,
                    descripcion,
                    cantidad: normalizarCantidad(valorCrudo ?? '0')
                };
                const existente = inventarioPorClave.get(clave);

                if (
                    !existente ||
                    (existente.cantidad === 0 && item.cantidad !== 0) ||
                    item.descripcion.length > existente.descripcion.length
                ) {
                    inventarioPorClave.set(clave, item);
                }
            });
        }

        if (encontroUnidad) {
            indice++;
        }
    }

    const inventario = [...inventarioPorClave.values()].sort((a, b) =>
        a.clave.localeCompare(b.clave, 'es', { numeric: true })
    );

    if (inventario.length === 0) {
        throw new Error('No se encontró la fila de la unidad HGP 48 ni encabezados IFU válidos');
    }

    resumenUltimaLectura = {
        totalClaves: inventario.length,
        bloquesLeidos,
        hojasLeidas: Math.max(1, hojasLeidas)
    };

    return inventario;
}

function extraerEncabezadoIFU(valor) {
    const texto = String(valor ?? '')
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!texto) return null;

    const coincidencia = texto.match(/^(\d{4,8})(?:\.0+)?(?:\s*[-–—:]\s*|\s+)?(.*)$/);
    if (!coincidencia) return null;

    const clave = coincidencia[1];
    const descripcion = coincidencia[2].trim() || `Clave IFU ${clave}`;

    return { clave, descripcion };
}

function esFilaInventarioUnidad(fila) {
    const texto = normalizarTexto(fila.join(' '));

    return (
        /(^|\s)4W($|\s)/.test(texto) ||
        texto.includes('HGP 48') ||
        texto.includes('HGP48') ||
        texto.includes('UMAE 48') ||
        texto.includes('UMAE 23') ||
        texto.includes('CMN DEL BAJIO') ||
        texto.includes('BAJIO')
    );
}

function reconstruirDatalist() {
    const opciones = datosTransformados.map((item) => `${item.clave} - ${item.descripcion}`);

    Object.keys(relaciones).forEach((clave) => {
        const descripcion = relaciones[clave].descripcion || '';
        opciones.push(`${clave} - ${descripcion}`);
    });

    opcionesBusqueda = [...new Set(opciones)].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
    cerrarSugerencias();
}

function actualizarSugerencias() {
    const input = document.getElementById('searchInput');
    const lista = document.getElementById('searchSuggestions');
    const limpiar = document.getElementById('clearSearchBtn');
    const termino = normalizarTexto(input.value.trim());

    limpiar.classList.toggle('hidden', input.value.length === 0);
    sugerenciaActiva = -1;
    lista.innerHTML = '';

    const coincidencias = opcionesBusqueda
        .filter((opcion) => !termino || normalizarTexto(opcion).includes(termino))
        .slice(0, 12);

    if (coincidencias.length === 0) {
        const vacio = document.createElement('div');
        vacio.className = 'search-empty';
        vacio.textContent = 'No se encontraron coincidencias';
        lista.appendChild(vacio);
    } else {
        coincidencias.forEach((opcion) => {
            const [clave, ...descripcion] = opcion.split(' - ');
            const item = document.createElement('button');
            const claveElement = document.createElement('span');
            const descripcionElement = document.createElement('span');

            item.type = 'button';
            item.className = 'search-suggestion';
            item.setAttribute('role', 'option');
            item.dataset.value = opcion;
            claveElement.className = 'suggestion-key';
            claveElement.textContent = clave;
            descripcionElement.className = 'suggestion-label';
            descripcionElement.textContent = descripcion.join(' - ');
            item.append(claveElement, descripcionElement);
            item.addEventListener('click', () => seleccionarSugerencia(opcion, true));
            lista.appendChild(item);
        });
    }

    lista.classList.remove('hidden');
    input.setAttribute('aria-expanded', 'true');
}

function navegarSugerencias(e) {
    const items = [...document.querySelectorAll('.search-suggestion')];

    if (e.key === 'Escape') {
        cerrarSugerencias();
        return;
    }

    if (e.key === 'Enter') {
        e.preventDefault();
        if (sugerenciaActiva >= 0 && items[sugerenciaActiva]) {
            seleccionarSugerencia(items[sugerenciaActiva].dataset.value, true);
        } else {
            realizarBusqueda();
        }
        return;
    }

    if (!['ArrowDown', 'ArrowUp'].includes(e.key) || items.length === 0) return;

    e.preventDefault();
    sugerenciaActiva = e.key === 'ArrowDown'
        ? (sugerenciaActiva + 1) % items.length
        : (sugerenciaActiva - 1 + items.length) % items.length;

    items.forEach((item, index) => item.classList.toggle('active', index === sugerenciaActiva));
    items[sugerenciaActiva].scrollIntoView({ block: 'nearest' });
}

function seleccionarSugerencia(valor, buscar) {
    document.getElementById('searchInput').value = valor;
    cerrarSugerencias();
    if (buscar) realizarBusqueda();
}

function limpiarBuscador(enfocar = false) {
    const input = document.getElementById('searchInput');
    input.value = '';
    document.getElementById('clearSearchBtn').classList.add('hidden');
    if (enfocar) input.focus();
    cerrarSugerencias();
}

function cerrarSugerencias() {
    document.getElementById('searchSuggestions').classList.add('hidden');
    document.getElementById('searchInput').setAttribute('aria-expanded', 'false');
    sugerenciaActiva = -1;
}

function cerrarSugerenciasAlSalir(e) {
    if (!e.target.closest('.search-box')) cerrarSugerencias();
}

function calcularDashboard() {
    const censables = datosTransformados.find((x) => x.clave === '50100');
    const noCensables = datosTransformados.find((x) => x.clave === '60000');

    document.getElementById('totalCensables').innerText = censables ? censables.cantidad : 0;
    document.getElementById('totalNoCensables').innerText = noCensables ? noCensables.cantidad : 0;
}

function realizarBusqueda() {
    const inputVal = document.getElementById('searchInput').value.trim();
    const divResultados = document.getElementById('results');
    const detalleDiv = document.getElementById('detalleDesglose');

    divResultados.innerHTML = '';
    detalleDiv.innerHTML = '';
    ultimoResultado = [];

    if (!inputVal) {
        mostrarSinResultados('Escribe o selecciona una clave IFU.');
        return;
    }

    limpiarBuscador(true);

    const claveBuscada = inputVal.split(' - ')[0].trim();
    const relacion = relaciones[claveBuscada];

    if (!relacion) {
        const encontrados = datosTransformados.filter((item) => item.clave.toString().trim() === claveBuscada);

        if (encontrados.length === 0) {
            const texto = inputVal.toLowerCase();
            const porDescripcion = datosTransformados.filter((item) =>
                item.descripcion.toLowerCase().includes(texto) ||
                item.clave.toLowerCase().includes(texto)
            );

            if (porDescripcion.length === 0) {
                mostrarSinResultados('No existe información.');
                return;
            }

            divResultados.innerHTML = construirTabla(porDescripcion);
            filtrarTabla();
            return;
        }

        divResultados.innerHTML = construirTabla(encontrados);
        filtrarTabla();
        return;
    }

    const filas = [];

    relacion.hijos.forEach((hijo) => {
        const encontrados = datosTransformados.filter((item) =>
            item.clave.toString().trim() === hijo.toString().trim()
        );

        encontrados.forEach((encontrado) => filas.push(encontrado));
    });

    if (filas.length === 0) {
        mostrarSinResultados('No hay inventario asociado a esta metodología.');
        return;
    }

    divResultados.innerHTML = construirTabla(filas, true);
    filtrarTabla();
}

function construirTabla(filas, incluirDesglose = false, registrarResultado = true) {
    let tabla = `
        <div class="table-card">
            <table>
                <thead>
                    <tr>
                        <th>Clave</th>
                        <th>Descripción</th>
                        <th>Inventario</th>
                    </tr>
                </thead>
                <tbody>
    `;

    filas.forEach((item) => {
        if (registrarResultado) {
            ultimoResultado.push({
                clave: item.clave,
                descripcion: item.descripcion,
                inventario: item.cantidad
            });
        }

        const tieneHijos = incluirDesglose && relaciones[item.clave];

        tabla += `
            <tr>
                <td>${escaparHtml(item.clave)}</td>
                <td>
                    ${escaparHtml(item.descripcion)}
                    ${tieneHijos ? `<br><br><button type="button" onclick="mostrarDesglose('${escaparAtributo(item.clave)}')">Ver desglose</button>` : ''}
                </td>
                <td>${escaparHtml(item.cantidad)}</td>
            </tr>
        `;
    });

    tabla += `
                </tbody>
            </table>
        </div>
    `;

    return tabla;
}

function mostrarDesglose(clavePadre) {
    const detalleDiv = document.getElementById('detalleDesglose');
    const relacion = relaciones[clavePadre];

    detalleDiv.innerHTML = '';

    if (!relacion) return;

    const filas = [];

    relacion.hijos.forEach((hijo) => {
        const encontrados = datosTransformados.filter((item) =>
            item.clave.toString().trim() === hijo.toString().trim()
        );

        encontrados.forEach((encontrado) => filas.push(encontrado));
    });

    detalleDiv.innerHTML = `
        <div class="table-card">
            <div class="table-title detalle-title">
                <span>Desglose de: ${escaparHtml(clavePadre)}</span>
                <div class="detalle-actions">
                    <button type="button" class="detail-download-btn" onclick="descargarDesglose()">Descargar desglose</button>
                    <button type="button" class="hide-detail-btn" onclick="ocultarDesglose()">Ocultar desglose</button>
                </div>
            </div>
            ${construirTabla(filas, true, false)}
        </div>
    `;

    filtrarTabla();
}

function ocultarDesglose() {
    document.getElementById('detalleDesglose').innerHTML = '';
}

function filtrarTabla() {
    const textoFiltro = document.getElementById('filtroTabla').value.toLowerCase();
    const ocultarCeros = document.getElementById('filterZero').checked;
    const filas = document.querySelectorAll('tbody tr');

    filas.forEach((fila) => {
        const texto = fila.innerText.toLowerCase();
        const inventario = parseInt(fila.cells[2].innerText, 10);
        let mostrar = true;

        if (textoFiltro !== '' && !texto.includes(textoFiltro)) {
            mostrar = false;
        }

        if (ocultarCeros && inventario === 0) {
            mostrar = false;
        }

        fila.style.display = mostrar ? '' : 'none';
    });
}

function descargarExcel() {
    const exportarSoloVisibles = document.getElementById('filterZero').checked;
    const consulta = obtenerDatosTablaParaExcel('#results', exportarSoloVisibles);
    const desglose = obtenerDatosTablaParaExcel('#detalleDesglose', exportarSoloVisibles);

    if (consulta.length === 0) {
        mostrarMensaje('No hay resultados para exportar.', 'error');
        return;
    }

    const workbook = XLSX.utils.book_new();
    const consultaSheet = crearHojaExcel(consulta);

    XLSX.utils.book_append_sheet(workbook, consultaSheet, 'Consulta IFU');

    if (desglose.length > 0) {
        const desgloseSheet = crearHojaExcel(desglose);
        XLSX.utils.book_append_sheet(workbook, desgloseSheet, 'Desglose');
    }

    XLSX.writeFile(workbook, 'consulta_IFU.xlsx');
    mostrarMensaje('Excel generado correctamente.', 'success');
}

function descargarDesglose() {
    const exportarSoloVisibles = document.getElementById('filterZero').checked;
    const desglose = obtenerDatosTablaParaExcel('#detalleDesglose', exportarSoloVisibles);

    if (desglose.length === 0) {
        mostrarMensaje('No hay desglose visible para exportar.', 'error');
        return;
    }

    const workbook = XLSX.utils.book_new();
    const desgloseSheet = crearHojaExcel(desglose);

    XLSX.utils.book_append_sheet(workbook, desgloseSheet, 'Desglose');
    XLSX.writeFile(workbook, 'desglose_IFU.xlsx');
    mostrarMensaje('Desglose exportado correctamente.', 'success');
}

function obtenerDatosTablaParaExcel(selector, soloVisibles) {
    const contenedor = document.querySelector(selector);

    if (!contenedor) return [];

    const filas = contenedor.querySelectorAll('tbody tr');
    const datos = [];

    filas.forEach((fila) => {
        if (soloVisibles && fila.style.display === 'none') {
            return;
        }

        const celdas = fila.querySelectorAll('td');

        if (celdas.length < 3) return;

        const descripcionCelda = celdas[1].cloneNode(true);
        descripcionCelda.querySelectorAll('button').forEach((button) => button.remove());

        datos.push({
            clave: celdas[0].innerText.trim(),
            descripcion: descripcionCelda.innerText.trim(),
            inventario: normalizarCantidad(celdas[2].innerText.trim())
        });
    });

    return datos;
}

function crearHojaExcel(datos) {
    const encabezados = ['Clave', 'Descripción', 'Inventario'];
    const filas = datos.map((item) => [
        item.clave,
        item.descripcion,
        item.inventario
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([encabezados, ...filas]);

    worksheet['!cols'] = calcularAnchoColumnas([encabezados, ...filas]);
    worksheet['!autofilter'] = {
        ref: XLSX.utils.encode_range({
            s: { r: 0, c: 0 },
            e: { r: filas.length, c: encabezados.length - 1 }
        })
    };

    encabezados.forEach((_, index) => {
        const celda = XLSX.utils.encode_cell({ r: 0, c: index });

        if (worksheet[celda]) {
            worksheet[celda].s = {
                font: { bold: true },
                alignment: { horizontal: 'center' }
            };
        }
    });

    return worksheet;
}

function calcularAnchoColumnas(filas) {
    const totalColumnas = filas[0] ? filas[0].length : 0;

    return Array.from({ length: totalColumnas }, (_, columna) => {
        const maximo = filas.reduce((ancho, fila) => {
            const valor = fila[columna] === null || fila[columna] === undefined
                ? ''
                : String(fila[columna]);

            return Math.max(ancho, valor.length);
        }, 10);

        return { wch: Math.min(Math.max(maximo + 2, 12), 55) };
    });
}

async function limpiarDatos() {
    if (!esAdmin()) {
        mostrarMensaje('Solo el administrador puede borrar datos.', 'error');
        return;
    }

    const confirmar = confirm('¿Deseas borrar los datos guardados?');

    if (!confirmar) return;

    try {
        await Promise.all([
            fetchJson(API.subirInventario, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clear: true })
            }),
            fetchJson(API.subirMetodologia, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clear: true })
            })
        ]);

        datosTransformados = [];
        relaciones = {};
        ultimoResultado = [];
        localStorage.removeItem('inventarioIFU');
        localStorage.removeItem('relacionesIFU');
        refrescarInterfaz();

        document.getElementById('results').innerHTML = `
            <div class="welcome-card">
                <h2>Bienvenido</h2>
                <p>Busca una clave IFU para consultar el inventario.</p>
            </div>
        `;
        document.getElementById('detalleDesglose').innerHTML = '';
        mostrarMensaje('Datos borrados correctamente.', 'success');
    } catch (error) {
        mostrarMensaje(`No se pudieron borrar los datos: ${error.message}`, 'error');
    }
}

function refrescarInterfaz() {
    reconstruirDatalist();
    calcularDashboard();
    document.getElementById('searchInput').disabled = datosTransformados.length === 0;
}

function validarArchivo(file) {
    const extension = file.name.split('.').pop().toLowerCase();

    if (!['xlsx', 'csv'].includes(extension)) {
        throw new Error('Solo se permiten archivos .xlsx o .csv');
    }

    if (file.size > MAX_FILE_SIZE) {
        throw new Error('El archivo debe pesar máximo 5 MB');
    }
}

function validarInventarioProcesado(inventario) {
    if (!Array.isArray(inventario) || inventario.length === 0) {
        throw new Error('No se detectaron columnas obligatorias de inventario');
    }

    inventario.forEach((item) => {
        if (!item.clave || !item.descripcion || !Object.prototype.hasOwnProperty.call(item, 'cantidad')) {
            throw new Error('El inventario requiere clave, descripción y cantidad');
        }
    });
}

function validarMetodologiaProcesada(metodologia) {
    if (!metodologia || Object.keys(metodologia).length === 0) {
        throw new Error('No se detectaron columnas obligatorias de metodología');
    }

    Object.entries(metodologia).forEach(([clavePadre, relacion]) => {
        if (!clavePadre || !relacion.descripcion || !Array.isArray(relacion.hijos)) {
            throw new Error('La metodología requiere clave padre, descripción e hijos');
        }
    });
}

function archivoMeta(file) {
    return {
        name: file.name,
        size: file.size,
        type: file.type
    };
}

function esAdmin() {
    return usuarioActual && usuarioActual.rol === 'admin';
}

function guardarRespaldoLocal() {
    localStorage.setItem('inventarioIFU', JSON.stringify(datosTransformados));
    localStorage.setItem('relacionesIFU', JSON.stringify(relaciones));
}

function leerLocalStorage(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
        return fallback;
    }
}

function limpiarClave(valor) {
    return valor.toString().replace('.00', '').replace('.0', '').trim();
}

function normalizarTexto(valor) {
    return String(valor)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();
}

function normalizarCantidad(valorCrudo) {
    let cantidad = valorCrudo.toString().trim().replace('.00', '').replace(',00', '');

    if (cantidad === '' || cantidad.toLowerCase() === 'false') {
        cantidad = '0';
    }

    const numero = parseInt(cantidad, 10);
    return Number.isNaN(numero) ? 0 : numero;
}

function mostrarSinResultados(mensaje) {
    document.getElementById('results').innerHTML = `
        <div class="welcome-card">
            <h2>Sin resultados</h2>
            <p>${escaparHtml(mensaje)}</p>
        </div>
    `;
}

function mostrarLoading(mostrar) {
    document.getElementById('loading').classList.toggle('hidden', !mostrar);
}

function mostrarMensaje(texto, tipo = 'info') {
    const box = document.getElementById('messageBox');
    box.textContent = texto;
    box.className = `message ${tipo}`;
}

function mostrarMensajeGlobal(texto, tipo = 'info') {
    const loginView = document.getElementById('loginView');
    let box = document.getElementById('loginMessage');

    if (!box) {
        box = document.createElement('div');
        box.id = 'loginMessage';
        loginView.insertBefore(box, loginView.querySelector('form'));
    }

    box.textContent = texto;
    box.className = `message ${tipo}`;
}

function escaparHtml(valor) {
    return String(valor)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escaparAtributo(valor) {
    return String(valor).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
