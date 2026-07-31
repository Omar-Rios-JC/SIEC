import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import localforage from 'localforage';
import { obtenerFechaActualizacion } from '../utils/fechaActualizacion';
import {
    UploadCloud, Activity, Users, CalendarCheck, Clock,
    BarChart2, Database, TableProperties, Stethoscope,
    Ambulance, Bed, Syringe, Siren, Download, Filter,
    Award, Target, BookOpen, MapPin, ClipboardList, FileSpreadsheet, Home,
    Menu, PanelLeftOpen, PanelLeftClose, X
} from 'lucide-react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import AdministradorCatalogos from './AdministradorCatalogos';
import MenuPrincipal from './MenuPrincipal';
import MenuCarga from './MenuCarga';
import ModuloCargaCE from './ModuloCargaCE';
import ModuloCargaHosp from './ModuloCargaHosp';
import ModuloCargaCirugias from './ModuloCargaCirugias';
import TableroParamedicos from './TableroParamedicos';
import TableroUrgencias from './TableroUrgencias';
import { exportarReporteCompleto } from './exportarReporteCompleto';
import TableroCirugias from './TableroCirugias';
import TableroHospitalizacion from './TableroHospitalizacion';

// Registrar componentes de Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, ArcElement);

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// ==========================================
// ALGORITMO DE CALENDARIO OPERATIVO (Regla 26 al 25)
// ==========================================
const generarCalendarioIMSS = (mesSeleccionado, anioSeleccionado) => {
    const anioAnterior = mesSeleccionado === 0 ? anioSeleccionado - 1 : anioSeleccionado;
    const mesAnterior = mesSeleccionado === 0 ? 11 : mesSeleccionado - 1;

    const fechaInicio = new Date(anioAnterior, mesAnterior, 26);
    const fechaFin = new Date(anioSeleccionado, mesSeleccionado, 25, 23, 59, 59);

    let semanas = [];
    let fechaActual = new Date(fechaInicio);
    let numeroSemana = 1;
    let inicioSemana = new Date(fechaActual);

    while (fechaActual <= fechaFin) {
        if (fechaActual.getDay() === 0 || fechaActual.getDate() === 25) {
            const finDeSemana = new Date(fechaActual);
            finDeSemana.setHours(23, 59, 59);

            semanas.push({
                semana: numeroSemana,
                inicio: new Date(inicioSemana),
                fin: finDeSemana
            });

            numeroSemana++;
            inicioSemana = new Date(fechaActual);
            inicioSemana.setDate(inicioSemana.getDate() + 1);
        }
        fechaActual.setDate(fechaActual.getDate() + 1);
    }

    if (semanas.length > 5) {
        semanas[4].fin = semanas[semanas.length - 1].fin;
        semanas = semanas.slice(0, 5);
    }

    while (semanas.length < 5) {
        semanas.push({ semana: semanas.length + 1, vacia: true });
    }

    const nombresMeses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    semanas.forEach(s => {
        if (!s.vacia) {
            const d1 = String(s.inicio.getDate()).padStart(2, '0');
            const m1 = nombresMeses[s.inicio.getMonth()];
            const d2 = String(s.fin.getDate()).padStart(2, '0');
            const m2 = nombresMeses[s.fin.getMonth()];
            s.label = `S${s.semana} (${d1}-${m1} al ${d2}-${m2})`;
        } else {
            s.label = `S${s.semana} (N/A)`;
        }
    });

    return semanas;
};

// ==========================================
// CACHÉ GLOBAL EN MEMORIA
// ==========================================
let cacheDatosProductividad = [];
let cacheDiccionarioMedicos = {};
let cacheEstaCargada = false;
let cacheDiccionarioCIE = {};

// ==========================================
// SUB-COMPONENTE: Tabla de Datos 
// ==========================================
const TablaDatos = ({ titulo1, titulo2, labels, data, dataPV, dataSub, tituloExtra, dataExtra, total = true }) => {
    if (!labels || !data) return null;

    const labelsSeguros = Array.isArray(labels) ? labels : [];
    const dataSegura = Array.isArray(data) ? data : [];
    const dataPVSegura = Array.isArray(dataPV) ? dataPV : [];
    const dataSubSegura = Array.isArray(dataSub) ? dataSub : [];
    const mostrarDesglose = Array.isArray(dataPV) && Array.isArray(dataSub);
    const numeroSeguro = (valor) => {
        const numero = Number(valor);
        return Number.isFinite(numero) ? numero : 0;
    };
    const formatearNumero = (valor) => numeroSeguro(valor).toLocaleString();
    const totalPV = mostrarDesglose ? dataPVSegura.reduce((a, b) => a + numeroSeguro(b), 0) : 0;
    const totalSub = mostrarDesglose ? dataSubSegura.reduce((a, b) => a + numeroSeguro(b), 0) : 0;
    const totalGeneral = dataSegura.reduce((a, b) => a + numeroSeguro(b), 0);

    return (
        <div className="mt-4 border-t border-slate-100 pt-4 animate-in fade-in slide-in-from-top-2 duration-300 h-full">
            <div className="max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="py-2 px-3 font-bold rounded-l-lg">{titulo1}</th>
                            {dataExtra && <th className="py-2 px-3 font-bold">{tituloExtra}</th>}
                            {mostrarDesglose && <th className="py-2 px-3 font-bold text-center text-[#c2410c]/70">1ra Vez</th>}
                            {mostrarDesglose && <th className="py-2 px-3 font-bold text-center text-[#822626]/70">Subsec.</th>}
                            {mostrarDesglose && <th className="py-2 px-3 font-bold text-center text-slate-500" title="Índice de Subsecuencia (Subsecuentes / Primera Vez)">Índice</th>}
                            <th className="py-2 px-3 font-bold text-right rounded-r-lg">{titulo2}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {labelsSeguros.map((label, index) => {
                            const valor = numeroSeguro(dataSegura[index]);
                            const pv = numeroSeguro(dataPVSegura[index]);
                            const sub = numeroSeguro(dataSubSegura[index]);
                            let indice = '0.00';
                            if (pv > 0) {
                                indice = (sub / pv).toFixed(2);
                            } else if (sub > 0) {
                                indice = '∞';
                            }

                            return (
                                <tr key={index} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                    <td className="py-2 px-3">{String(label).replace('Dr. ', 'Lic. ')}</td>
                                    {dataExtra && <td className="py-2 px-3 text-xs font-bold text-slate-400">{dataExtra[index]}</td>}
                                    {mostrarDesglose && <td className="py-2 px-3 text-center text-[#c2410c] font-medium">{formatearNumero(pv)}</td>}
                                    {mostrarDesglose && <td className="py-2 px-3 text-center text-[#822626] font-medium">{formatearNumero(sub)}</td>}
                                    {mostrarDesglose && <td className="py-2 px-3 text-center text-slate-500 font-bold bg-slate-50/50">{indice}</td>}
                                    <td className="py-2 px-3 text-right font-black text-slate-700">{formatearNumero(valor)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    {total && (
                        <tfoot className="bg-slate-50 font-bold sticky bottom-0 z-10 shadow-sm">
                            <tr>
                                <td className="py-2 px-3 rounded-l-lg text-slate-500 uppercase tracking-widest text-xs">Total General</td>
                                {dataExtra && <td className="py-2 px-3"></td>}
                                {mostrarDesglose && <td className="py-2 px-3 text-center text-[#c2410c] font-black">{totalPV.toLocaleString()}</td>}
                                {mostrarDesglose && <td className="py-2 px-3 text-center text-[#822626] font-black">{totalSub.toLocaleString()}</td>}
                                {mostrarDesglose && (
                                    <td className="py-2 px-3 text-center text-slate-600 font-black bg-slate-100/50">
                                        {totalPV > 0 ? (totalSub / totalPV).toFixed(2) : '0.00'}
                                    </td>
                                )}
                                <td className="py-2 px-3 text-right rounded-r-lg text-slate-800 font-black">{totalGeneral.toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
};

const DIVISIONES_CIRUGIAS_PERMITIDAS = [
    'CONSULTA EXTERNA',
    'HOSPITAL',
    'URGENCIAS'
];

const valorReporteCirugias = (valor, fallback = 'SIN DATO') => {
    if (valor === null || valor === undefined || valor === '') return fallback;
    return String(valor);
};

const formatearFechaReporteCirugias = (valor) => {
    if (!valor) return 'SIN FECHA';

    const fecha = valor instanceof Date ? valor : new Date(valor);

    if (Number.isNaN(fecha.getTime())) {
        return String(valor);
    }

    return fecha.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

const fechaArchivoReporteCirugias = () =>
    new Date().toLocaleDateString('es-MX').replaceAll('/', '-');

const contarRegistrosCirugiasPor = (registros, obtenerClave) => {
    const conteo = registros.reduce((acc, registro) => {
        const clave = valorReporteCirugias(obtenerClave(registro), 'SIN DATO');
        acc[clave] = (acc[clave] || 0) + 1;
        return acc;
    }, {});

    return Object.entries(conteo).sort((a, b) => b[1] - a[1]);
};

export default function DashboardProductividad({ isAdmin }) {
// Fecha REAL de actualización de la base de datos
const [ultimaFechaBD, setUltimaFechaBD] = useState('Cargando...');
    // ESTADOS DE NAVEGACIÓN
    const [vistaActiva, setVistaActiva] = useState('dashboard');
    const [ordenInverso, setOrdenInverso] = useState(false);
    const [configuracionCarga, setConfiguracionCarga] = useState(null);
    const [areaSidebar, setAreaSidebar] = useState('consulta_externa');
    const [mostrarTablas, setMostrarTablas] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);

    // ESTADOS DE FILTROS GLOBALES
    const [anioSeleccionado, setAnioSeleccionado] = useState('todos');
    const [mesSeleccionado, setMesSeleccionado] = useState('todos');
    const [mesInicio, setMesInicio] = useState(0);
    const [mesFin, setMesFin] = useState(11);
    const [divisionSeleccionada, setDivisionSeleccionada] = useState('todas');
    const [especialidadSeleccionada, setEspecialidadSeleccionada] = useState('todas');

    // ESTADOS EXCLUSIVOS PARA LA GRÁFICA DE METAS
    const [mesGraficoMeta, setMesGraficoMeta] = useState(11);
    const [anioGraficoMeta, setAnioGraficoMeta] = useState(2025);

    // ESTADOS DE DATOS
    const [archivo, setArchivo] = useState(null);
    const [mensaje, setMensaje] = useState('');
    const [cargandoSubida, setCargandoSubida] = useState(false);
    const [datos, setDatos] = useState([]);
    const [cargandoDatos, setCargandoDatos] = useState(false);
    const [error, setError] = useState(null);

    // Estados para la inyección e IndexedDB de Hospitalización
    const [datosHospitalizacionBase, setDatosHospitalizacionBase] = useState([]);
    const [cargandoHospitalizacion, setCargandoHospitalizacion] = useState(false);

    // DICCIONARIOS
    const [diccionarioMedicos, setDiccionarioMedicos] = useState({});
    const [diccionarioCIE, setDiccionarioCIE] = useState({});
    const [diccionarioEspecialidades, setDiccionarioEspecialidades] = useState({});

    // Datos para descargar Excel
    const [datosExterna, setDatosExterna] = useState([]);
    const [datosParamedicos, setDatosParamedicos] = useState([]);
    const [datosUrgencias, setDatosUrgencias] = useState([]);
    const [datosCirugias, setDatosCirugias] = useState([]);
    const [datosHospitalizacion, setDatosHospitalizacion] = useState([]);
    const [divisionTablaEspecialidad, setDivisionTablaEspecialidad] = useState('todas');
    const [divisionTopMedicos, setDivisionTopMedicos] = useState('todas');
    const [divisionTopDiagnosticos, setDivisionTopDiagnosticos] = useState('todas');

    // Opciones dinámicas que envía TableroCirugias para mostrar filtros en la barra superior
    const [opcionesFiltrosCirugias, setOpcionesFiltrosCirugias] = useState({
        anios: ['2026', '2025'],
        divisiones: DIVISIONES_CIRUGIAS_PERMITIDAS,
        especialidades: [],
        cargado: false
    });

    // ==========================================
    // CARGA DE DATOS 
    // ==========================================
    const cargarDatos = async () => {
        try {
            await localforage.removeItem('cache_productividad_vencer');
            await localforage.removeItem('version_productividad_vencer');

            const datosLocales = await localforage.getItem('cache_productividad_vencer');
            const versionLocal = await localforage.getItem('version_productividad_vencer') || "0";

            if (datosLocales && datosLocales.length > 0) {
                setDatos(datosLocales);
            } else {
                setCargandoDatos(true);
            }

            const resVersion = await axios.get('/api/api_check_update.php');
            const versionServidor = String(resVersion.data.ultima_actualizacion);

            if (versionServidor !== versionLocal || !datosLocales) {
                const resDatos = await axios.get('/api/api_productividad.php');
                if (Array.isArray(resDatos.data)) {
                    setDatos(resDatos.data);
                    await localforage.setItem('cache_productividad_vencer', resDatos.data);
                    await localforage.setItem('version_productividad_vencer', versionServidor);
                }
            }
        } catch (err) {
            setError("Modo sin conexión. Mostrando últimos datos guardados.");
        } finally {
            setCargandoDatos(false);
        }
    };

    // Descarga y Sincronización Local de Hospitalización
    const cargarDatosHospitalizacion = async () => {
        try {
            const cacheHosp = await localforage.getItem('cache_hospitalizacion_vencer');
            const versionLocal = await localforage.getItem('version_hospitalizacion_vencer') || "0";

            if (cacheHosp && cacheHosp.length > 0) {
                setDatosHospitalizacionBase(cacheHosp);
            } else {
                setCargandoHospitalizacion(true);
            }

            const resVersion = await axios.get('/api/api_check_update.php');
            const versionServidor = String(resVersion.data.ultima_actualizacion);

            if (versionServidor !== versionLocal || !cacheHosp) {
                const resDatos = await axios.get('/api/api_hospitalizacion.php');
                if (Array.isArray(resDatos.data)) {
                    setDatosHospitalizacionBase(resDatos.data);
                    await localforage.setItem('cache_hospitalizacion_vencer', resDatos.data);
                    await localforage.setItem('version_hospitalizacion_vencer', versionServidor);
                }
            }
        } catch (err) {
            console.error("Error al cargar hospitalización:", err);
        } finally {
            setCargandoHospitalizacion(false);
        }
    };

    useEffect(() => {
        if (vistaActiva === 'dashboard' && datos.length === 0) {
            cargarDatos();
        }
    }, [vistaActiva]);

    const cargarDiccionario = async () => {
        try {
            const res = await axios.get('/api/api_medicos.php');
            if (Array.isArray(res.data) && res.data.length > 0) {
                const dicc = res.data.reduce((acc, medico) => {
                    let mat = String(medico.matricula || '').trim().replace('.0', '').replace(/\s/g, '');
                    const nom = String(medico.nombre || '').trim();
                    if (mat && nom) acc[mat] = nom;
                    return acc;
                }, {});
                cacheDiccionarioMedicos = dicc;
                setDiccionarioMedicos(dicc);
                await localforage.setItem('cache_medicos_vencer', dicc);
            }
        } catch (err) {
            console.error("Error al cargar médicos", err);
        }
    };

    const cargarDiccionarioCIE = async () => {
        try {
            await localforage.removeItem('cache_cie_vencer');
            cacheDiccionarioCIE = {};
            const res = await axios.get(`/api/api_cie.php?t=${new Date().getTime()}`);
            if (Array.isArray(res.data)) {
                const dicc = res.data.reduce((acc, item) => {
                    const cod = String(item.codigo || '').trim().toUpperCase();
                    const desc = String(item.descripcion || '').trim();
                    if (cod && desc) acc[cod] = desc;
                    return acc;
                }, {});
                cacheDiccionarioCIE = dicc;
                setDiccionarioCIE(dicc);
                await localforage.setItem('cache_cie_vencer', dicc);
            }
        } catch (err) {
            console.error("Error catálogo CIE", err);
        }
    };

    const cargarDiccionarioEspecialidades = async () => {
        try {
            await localforage.removeItem('cache_especialidades_vencer');
            const res = await axios.get(`/api/api_crud_especialidades.php?t=${new Date().getTime()}`);
            if (Array.isArray(res.data)) {
                const dicc = res.data.reduce((acc, item) => {
                    const clave = String(item.clave).trim().toUpperCase();
                    if (clave) {
                        acc[clave] = { nombre: item.nombre, division: item.division };
                    }
                    return acc;
                }, {});
                setDiccionarioEspecialidades(dicc);
                await localforage.setItem('cache_especialidades_vencer', dicc);
            }
        } catch (error) {
            console.error("Error especialidades", error);
        }
    };

    useEffect(() => {
        cargarDatos();
        cargarDatosHospitalizacion(); // Disparar la carga paralela
        cargarDiccionario();
        cargarDiccionarioCIE();
        cargarDiccionarioEspecialidades();
    }, []);

    // RESETEAR FILTROS AL CAMBIAR DE ÁREA PARA EVITAR VALORES QUE NO EXISTEN EN OTRO MÓDULO
    useEffect(() => {
        setAnioSeleccionado('todos');
        setMesSeleccionado('todos');
        setDivisionSeleccionada('todas');
        setEspecialidadSeleccionada('todas');
        setDivisionTopMedicos('todas');
        setDivisionTopDiagnosticos('todas');
        setOrdenInverso(false);
    }, [areaSidebar]);

    // RESETEAR ESPECIALIDAD CUANDO CAMBIA LA DIVISIÓN
    useEffect(() => {
        setEspecialidadSeleccionada('todas');
    }, [divisionSeleccionada]);

    useEffect(() => {
        if (
            areaSidebar === 'cirugias' &&
            divisionSeleccionada !== 'todas' &&
            !DIVISIONES_CIRUGIAS_PERMITIDAS.includes(divisionSeleccionada)
        ) {
            setDivisionSeleccionada('todas');
        }
    }, [areaSidebar, divisionSeleccionada]);

    // ==========================================
    // TRADUCTOR GLOBAL (Vacunado contra el "COD:")
    // ==========================================
    const traducirEspecialidad = (valorCrudo) => {
        if (!valorCrudo) return 'Desconocida';

        // 1. Lo pasamos a mayúsculas y le quitamos acentos
        let espRaw = String(valorCrudo).trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        // 2. ¡LA VACUNA! Le arrancamos la palabra "COD:" y los ".0"
        espRaw = espRaw.replace('COD:', '').replace('COD: ', '').replace('.0', '').trim();

        // Seguro de vida
        const respaldoInquebrantable = {
            '6300': 'TRABAJO SOCIAL',
            '6600': 'PSICOLOGIA',
            '6900': 'NUTRICION',
            '5001': 'CONSULTAS EN PRIMER CONTACTO',
            'A600': 'URGENCIAS TOCO CIRUGIA'
        };

        return diccionarioEspecialidades[espRaw]?.nombre || respaldoInquebrantable[espRaw] || espRaw;
    };

    // ==========================================
    // FUNCIÓN DE NIVELACIÓN (Para comparar sin fallos)
    // ==========================================
    const nivelarTexto = (texto) => {
        return String(texto || '').trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    };

    // ==========================================
    // LÓGICA DE FILTRADO BASE
    // ==========================================
    const encontrarFecha = (obj) => {
        const keys = Object.keys(obj);
        for (let k of keys) {
            if (k.toLowerCase().includes('fecha')) return obj[k];
        }
        return null;
    };
    useEffect(() => {
    const cargarFecha = async () => {
        try {
            let clave = 'productividad';

            if (areaSidebar === 'cirugias') {
                clave = 'cirugias';
            } else if (areaSidebar === 'hospitalizacion') {
                clave = 'hospitalizacion';
            }

            const fecha = await obtenerFechaActualizacion(clave);
            setUltimaFechaBD(fecha || 'Sin fecha');
        } catch (error) {
            console.error("Error obteniendo fecha BD:", error);
            setUltimaFechaBD('Sin fecha');
        }
    };

    cargarFecha();
}, [areaSidebar, vistaActiva]);

    // ==========================================
    // CUBETAS DE DATOS BASE (Separación Robusta)
    // ==========================================
    const datosConsultaExterna = useMemo(() => {
        if (!datos || datos.length === 0) return [];
        return datos.filter(d => {
            const espCruda = String(d.especialidad || d.ESPECIALIDAD || '');
            const espNivelada = nivelarTexto(espCruda);
            const espTraducida = nivelarTexto(traducirEspecialidad(espCruda));

            // Si el nombre o el código pertenece a otra área, lo ignoramos de Consulta Externa
            const ignorar = ['TOCO', 'PRIMER CONTACTO', '5001', '6300', '6600', '6900', 'NUTRICION', 'INHALOTERAPIA', 'FONIATRIA', 'TRABAJO SOCIAL', 'PSICOLOGIA', 'URGENCIAS', 'ADMISION CONTINUA', 'OBSERVACION', 'CHOQUE'];

            return !ignorar.some(ignorada => espNivelada.includes(ignorada) || espTraducida.includes(ignorada));
        });
    }, [datos, diccionarioEspecialidades]);

    const aniosDisponibles = useMemo(() => {
        const anios = new Set();
        datos.forEach(d => {
            let a = d.anio || d.Anio || d.ANIO || d.año || d.Año || d.AÑO;
            if (a) {
                anios.add(String(a));
            } else {
                const f = encontrarFecha(d);
                if (f) {
                    const p = f.includes('-') ? f.split('-') : f.split('/');
                    anios.add(p[0].length === 4 ? p[0] : p[2]);
                }
            }
        });
        return [...anios].sort().reverse();
    }, [datos]);

    // FILTRO DE FECHAS COMPARTIDO
    const aplicarFiltroFecha = (listaDatos) => {
        return listaDatos.filter(item => {
            let a = item.anio || item.Anio || item.ANIO || item.año || item.Año || item.AÑO;
            let m = item.mes || item.Mes || item.MES;

            if (!a || !m) {
                const f = encontrarFecha(item);
                if (f) {
                    const parts = f.includes('-') ? f.split('-') : f.split('/');
                    if (parts[0].length === 4) { a = a || parts[0]; m = m || parts[1]; }
                    else { a = a || parts[2]; m = m || parts[1]; }
                }
            }

            if (!a) return anioSeleccionado === 'todos';
            if (!m) m = '1';

            const mesIdx = parseInt(m, 10) - 1;
            const pasaAnio = anioSeleccionado === 'todos' || String(a) === String(anioSeleccionado);

            let pasaMes = true;
            if (mesSeleccionado === 'rango') {
                pasaMes = mesIdx >= mesInicio && mesIdx <= mesFin;
            } else if (mesSeleccionado !== 'todos') {
                pasaMes = mesIdx === Number(mesSeleccionado);
            }

            return pasaAnio && pasaMes;
        });
    };

    const datosFiltradosFecha = useMemo(() => aplicarFiltroFecha(datosConsultaExterna), [datosConsultaExterna, anioSeleccionado, mesSeleccionado, mesInicio, mesFin]);

    const datosParamedicosFiltrados = useMemo(() => {
        const soloParamedicos = datos.filter(d => {
            const espCruda = String(d.especialidad || d.ESPECIALIDAD || '');
            const espNivelada = nivelarTexto(espCruda);
            const espTraducida = nivelarTexto(traducirEspecialidad(espCruda));
            const criterios = [
                '6300',
                '6600',
                '6900',
                'TRABAJO SOCIAL',
                'PSICOLOGIA',
                'NUTRICION',
                'INHALOTERAPIA',
                'FONIATRIA'
            ];
            return criterios.some(c => espNivelada.includes(c) || espTraducida.includes(c));
        });
        return aplicarFiltroFecha(soloParamedicos);
    }, [datos, diccionarioEspecialidades, anioSeleccionado, mesSeleccionado, mesInicio, mesFin]);

    const datosUrgenciasFiltrados = useMemo(() => {
        if (!datos || datos.length === 0) return [];

        const soloUrgencias = datos.filter(d => {
            const espCruda = String(d.especialidad || d.ESPECIALIDAD || d.servicio || '');
            const espNivelada = nivelarTexto(espCruda);
            const espTraducida = nivelarTexto(traducirEspecialidad(espCruda));

            const criterios = [
                '5001',
                'A600',
                'URGENCIAS',
                'TOCO',
                'PRIMER CONTACTO',
                'ADMISION CONTINUA',
                'OBSERVACION',
                'CHOQUE'
            ];
            return criterios.some(c => espTraducida.includes(c) || espNivelada.includes(c));
        });

        return aplicarFiltroFecha(soloUrgencias);
    }, [datos, diccionarioEspecialidades, anioSeleccionado, mesSeleccionado, mesInicio, mesFin]);

    // Segmentación analítica limpia para periodos IMSS, Divisiones y Especialidades de Hospitalización
    const datosHospitalizacionFiltrados = useMemo(() => {
        return datosHospitalizacionBase.filter(item => {
            const pasaAnio = anioSeleccionado === 'todos' || String(item.anio) === String(anioSeleccionado);

            let pasaMes = true;
            if (mesSeleccionado === 'rango') {
                const m = Number(item.mes) - 1;
                pasaMes = m >= mesInicio && m <= mesFin;
            } else if (mesSeleccionado !== 'todos') {
                pasaMes = (Number(item.mes) - 1) === Number(mesSeleccionado);
            }

            const divPac = item.division ? item.division.toUpperCase().trim() : "";
            const pasaDivision = divisionSeleccionada === 'todas' || divPac === divisionSeleccionada.toUpperCase().trim();

            const espPac = item.especialidad ? item.especialidad.toUpperCase().trim() : "";
            const pasaEspecialidad = especialidadSeleccionada === 'todas' || espPac === especialidadSeleccionada.toUpperCase().trim();

            return pasaAnio && pasaMes && pasaDivision && pasaEspecialidad;
        });
    }, [datosHospitalizacionBase, anioSeleccionado, mesSeleccionado, mesInicio, mesFin, divisionSeleccionada, especialidadSeleccionada]);

    // ==========================================
    // DIVISIONES Y ESPECIALIDADES (CONSULTA EXTERNA)
    // ==========================================
    const rankingDivisiones = useMemo(() => {
        const conteo = {};
        datosFiltradosFecha.forEach(d => {
            const div = (d.division || 'Sin Asignar').trim();
            conteo[div] = (conteo[div] || 0) + 1;
        });
        return Object.entries(conteo).sort((a, b) => b[1] - a[1]);
    }, [datosFiltradosFecha]);

    const divisionesDisponibles = useMemo(() => rankingDivisiones.map(item => item[0]).sort(), [rankingDivisiones]);

    const infoEspecialidades = useMemo(() => {
        const conteo = {};
        const divMap = {};
        datosFiltradosFecha.forEach(d => {
            const esp = (d.especialidad || 'Desconocida').trim();
            const div = (d.division || 'Sin Asignar').trim();
            conteo[esp] = (conteo[esp] || 0) + 1;
            if (!divMap[esp]) divMap[esp] = div;
        });
        const ranking = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
        return { ranking, divMap };
    }, [datosFiltradosFecha]);

    const datosFiltradosDivision = useMemo(() => {
        return datosFiltradosFecha.filter(item => {
            if (divisionSeleccionada === 'todas') return true;

            return nivelarTexto(item.division || 'Sin Asignar') === nivelarTexto(divisionSeleccionada);
        });
    }, [datosFiltradosFecha, divisionSeleccionada]);

    // ==========================================
    // MOTOR DE FILTRO PRINCIPAL (CONSULTA EXTERNA)
    // ==========================================
    const datosFiltrados = useMemo(() => {
        return datosFiltradosDivision.filter(item => {
            if (especialidadSeleccionada === 'todas') return true;
            const espTraducida = traducirEspecialidad(item.especialidad || item.ESPECIALIDAD);
            return nivelarTexto(espTraducida) === nivelarTexto(especialidadSeleccionada);
        });
    }, [datosFiltradosDivision, especialidadSeleccionada]);

    const especialidadesParaMostrar = useMemo(() => {
        const setEsp = new Set();

        Object.values(diccionarioEspecialidades).forEach(item => {
            if (item && item.nombre) {
                if (divisionSeleccionada !== 'todas') {
                    const divItem = nivelarTexto(item.division);
                    const divSeleccionadaUpper = nivelarTexto(divisionSeleccionada);

                    if (divItem !== divSeleccionadaUpper) return;
                }
                const nombreLimpio = String(item.nombre).trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                setEsp.add(nombreLimpio);
            }
        });

        if (Object.keys(diccionarioEspecialidades).length === 0) {
            if (areaSidebar === 'paramedicos') {
                ['TRABAJO SOCIAL', 'PSICOLOGIA', 'NUTRICION'].forEach(e => setEsp.add(e));
            } else if (areaSidebar === 'urgencias') {
                ['CONSULTAS EN PRIMER CONTACTO', 'URGENCIAS TOCOCIRUGIA'].forEach(e => setEsp.add(e));
            }
        }

        let listaCompleta = [...setEsp].sort();

        if (areaSidebar === 'paramedicos') {
            const criterios = ['TRABAJO SOCIAL', 'NUTRICION', 'PSICOLOGIA'];
            return listaCompleta.filter(esp => criterios.some(c => esp.includes(c)));
        }

        if (areaSidebar === 'urgencias') {
            const criterios = ['URGENCIAS', 'TOCO', 'PRIMER CONTACTO', 'ADMISION CONTINUA', 'OBSERVACION', 'CHOQUE'];
            return listaCompleta.filter(esp => criterios.some(c => esp.includes(c)));
        }

        const ignorar = ['TRABAJO SOCIAL', 'NUTRICION', 'PSICOLOGIA', 'URGENCIAS', 'TOCO', 'PRIMER CONTACTO', 'ADMISION CONTINUA', 'OBSERVACION', 'CHOQUE'];
        return listaCompleta.filter(esp => !ignorar.some(ignorada => esp.includes(ignorada)));

    }, [diccionarioEspecialidades, areaSidebar, divisionSeleccionada]);

    // ==========================================
    // MOTORES DE FILTRO SECUNDARIOS
    // ==========================================
    const paramedicosParaTablero = useMemo(() => {
        return datosParamedicosFiltrados.filter(item => {
            if (especialidadSeleccionada === 'todas') return true;
            const espTraducida = traducirEspecialidad(item.especialidad || item.ESPECIALIDAD);
            return nivelarTexto(espTraducida) === nivelarTexto(especialidadSeleccionada);
        });
    }, [datosParamedicosFiltrados, especialidadSeleccionada]);

    const urgenciasParaTablero = useMemo(() => {
        return datosUrgenciasFiltrados.filter(item => {
            if (especialidadSeleccionada === 'todas') return true;
            const espTraducida = traducirEspecialidad(item.especialidad || item.ESPECIALIDAD || item.servicio);
            return nivelarTexto(espTraducida) === nivelarTexto(especialidadSeleccionada);
        });
    }, [datosUrgenciasFiltrados, especialidadSeleccionada]);

    // ==========================================
    // CONFIGURACIÓN DINÁMICA DE LA BARRA SUPERIOR SEGÚN PESTAÑA ACTIVA
    // ==========================================
    const aniosFiltroActual = useMemo(() => {
        if (areaSidebar === 'cirugias') return ['2026', '2025'];

        if (areaSidebar === 'hospitalizacion') {
            const aniosHosp = new Set(datosHospitalizacionBase.map(item => String(item.anio)));
            return [...aniosHosp].sort((a, b) => Number(b) - Number(a));
        }

        return [...new Set([...aniosDisponibles.map(String), '2026', '2025'])]
            .filter(a => a === '2025' || a === '2026')
            .sort((a, b) => Number(b) - Number(a));
    }, [areaSidebar, aniosDisponibles, datosHospitalizacionBase]);

    const divisionesFiltroActual = useMemo(() => {
        if (areaSidebar === 'cirugias') return DIVISIONES_CIRUGIAS_PERMITIDAS;

        if (areaSidebar === 'hospitalizacion') {
            const divsHosp = new Set();
            datosHospitalizacionBase.forEach(item => {
                if (item.division) divsHosp.add(item.division.toUpperCase().trim());
            });
            return Array.from(divsHosp).sort();
        }

        return divisionesDisponibles;
    }, [areaSidebar, divisionesDisponibles, datosHospitalizacionBase]);

    const { ranking, divMap } = infoEspecialidades; // Destructuración preventiva para dependencias limpias
    const especialidadesFiltroActual = useMemo(() => {
        if (areaSidebar === 'cirugias') return opcionesFiltrosCirugias.especialidades;

        if (areaSidebar === 'hospitalizacion') {
            const especsHosp = new Set();
            datosHospitalizacionBase.forEach(item => {
                const div = item.division ? item.division.toUpperCase().trim() : "";
                if (item.especialidad && (divisionSeleccionada === 'todas' || div === divisionSeleccionada.toUpperCase().trim())) {
                    especsHosp.add(item.especialidad.toUpperCase().trim());
                }
            });
            return Array.from(especsHosp).sort();
        }

        return especialidadesParaMostrar;
    }, [areaSidebar, opcionesFiltrosCirugias.especialidades, datosHospitalizacionBase, divisionSeleccionada, especialidadesParaMostrar]);

    const hayDatosParaFiltrosActuales = areaSidebar === 'cirugias'
        ? true
        : areaSidebar === 'hospitalizacion'
            ? datosHospitalizacionBase.length > 0 && !cargandoHospitalizacion
            : datos.length > 0 && !cargandoDatos && !error;

    // ==========================================
    // GRÁFICA DE METAS CON CALENDARIO DINÁMICO HISTÓRICO
    // ==========================================
    const chartMetas = useMemo(() => {
        const semanasOperativas = generarCalendarioIMSS(mesGraficoMeta, anioGraficoMeta);
        const labelsSemanas = semanasOperativas.map(s => s.label);
        const citasPorSemana = [0, 0, 0, 0, 0];
        let metasPorSemana = [2646, 2646, 2646, 2646, 2646];

        if (Number(mesGraficoMeta) === 0) metasPorSemana[0] = 1134;

        datosConsultaExterna.forEach(d => {
            const div = (d.division || 'Sin Asignar').trim();
            if (divisionSeleccionada !== 'todas' && div !== divisionSeleccionada) return;

            const espTraducida = traducirEspecialidad(d.especialidad || d.ESPECIALIDAD);
            if (especialidadSeleccionada !== 'todas' && nivelarTexto(espTraducida) !== nivelarTexto(especialidadSeleccionada)) return;

            let a = d.anio || d.Anio || d.ANIO || d.año || d.Año || d.AÑO;
            let m = d.mes || d.Mes || d.MES;
            let dia = 1;

            const f = encontrarFecha(d);
            if (f) {
                const p = f.includes('-') ? f.split('-') : f.split('/');
                if (p[0].length === 4) { a = a || p[0]; m = m || p[1]; dia = p[2]; }
                else { a = a || p[2]; m = m || p[1]; dia = p[0]; }
            }

            if (a && m && dia) {
                const fechaRegistro = new Date(parseInt(a), parseInt(m) - 1, parseInt(dia), 12, 0, 0);
                if (d.citado === 'Citado' || d.CITADO === 'Citado' || (d.citado && String(d.citado).toLowerCase() === 'citado')) {
                    for (let i = 0; i < semanasOperativas.length; i++) {
                        const sem = semanasOperativas[i];
                        if (!sem.vacia && fechaRegistro >= sem.inicio && fechaRegistro <= sem.fin) {
                            citasPorSemana[i]++;
                            break;
                        }
                    }
                }
            }
        });

        return {
            labels: labelsSemanas,
            datasets: [
                {
                    label: 'Citas Reales',
                    data: citasPorSemana,
                    borderColor: '#0284c7',
                    backgroundColor: 'rgba(2, 132, 199, 0.1)',
                    borderWidth: 3,
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: '#0284c7',
                    pointRadius: 5
                },
                {
                    label: 'Meta Esperada',
                    data: metasPorSemana,
                    borderColor: '#822626',
                    backgroundColor: 'transparent',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    tension: 0,
                    pointRadius: 0,
                    fill: false
                }
            ]
        };
    }, [datosConsultaExterna, divisionSeleccionada, especialidadSeleccionada, mesGraficoMeta, anioGraficoMeta]);

    // ==========================================
    // SINCRONIZACIÓN: FILTRO GLOBAL -> GRÁFICA LOCAL
    // ==========================================
    useEffect(() => {
        // Si el año global cambia a uno específico, lo pasamos al local
        if (anioSeleccionado !== 'todos') {
            setAnioGraficoMeta(Number(anioSeleccionado));
        }

        // Si el mes global es específico, lo pasamos. Si es rango, tomamos el mes de fin.
        if (mesSeleccionado !== 'todos' && mesSeleccionado !== 'rango') {
            setMesGraficoMeta(Number(mesSeleccionado));
        } else if (mesSeleccionado === 'rango') {
            setMesGraficoMeta(Number(mesFin));
        }
    }, [anioSeleccionado, mesSeleccionado, mesFin]);

    useEffect(() => {
    const cargarFecha = async () => {
        let clave = 'productividad';

        if (areaSidebar === 'cirugias') {
            clave = 'cirugias';
        } else if (areaSidebar === 'hospitalizacion') {
            clave = 'hospitalizacion';
        }

        const fecha = await obtenerFechaActualizacion(clave);
        setUltimaFechaBD(fecha);
    };

    cargarFecha();
}, [areaSidebar, vistaActiva]);

    const chartOptionsLine = {
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { usePointStyle: true } }, tooltip: { mode: 'index', intersect: false } },
        scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } }
    };

    // ==========================================
    // KPIs y GRÁFICAS CON DESGLOSE
    // ==========================================
    const kpis = useMemo(() => {
        let citados = 0, primeraVez = 0;
        datosFiltrados.forEach(d => {
            if (d.citado === 'Citado') citados++;
            if (d.primera_vez === 'Primera Vez') primeraVez++;
        });
        return {
            total: datosFiltrados.length,
            citados, espontaneos: datosFiltrados.length - citados,
            primeraVez, subsecuentes: datosFiltrados.length - primeraVez
        };
    }, [datosFiltrados]);

    const criteriosParamedicosTabla = ['6300', '6600', '6900', 'TRABAJO SOCIAL', 'PSICOLOGIA', 'NUTRICION', 'INHALOTERAPIA', 'FONIATRIA'];
    const criteriosUrgenciasTabla = ['5001', 'A600', 'URGENCIAS', 'TOCO', 'PRIMER CONTACTO', 'ADMISION CONTINUA', 'OBSERVACION', 'CHOQUE'];

    const normalizarDivisionTablaEspecialidad = (item) => {
        const division = item?.division || item?.Division || item?.DIVISION || item?.area || item?.Area || item?.AREA || 'Sin Asignar';
        return String(division || 'Sin Asignar').trim() || 'Sin Asignar';
    };

    const obtenerTextoEspecialidadTabla = (item) => {
        const espCruda = String(item?.especialidad || item?.ESPECIALIDAD || item?.servicio || '');
        const espNivelada = nivelarTexto(espCruda);
        const espTraducida = nivelarTexto(traducirEspecialidad(espCruda));
        return { espCruda, espNivelada, espTraducida };
    };

    const obtenerOrigenTablaEspecialidad = (item) => {
        const { espNivelada, espTraducida } = obtenerTextoEspecialidadTabla(item);

        if (criteriosParamedicosTabla.some(criterio => espNivelada.includes(criterio) || espTraducida.includes(criterio))) {
            return 'paramedicos';
        }

        if (criteriosUrgenciasTabla.some(criterio => espNivelada.includes(criterio) || espTraducida.includes(criterio))) {
            return 'urgencias';
        }

        return 'consulta_externa';
    };

    const obtenerPeriodoTablaEspecialidad = (item) => {
        const claveAnio = Object.keys(item || {}).find(key => nivelarTexto(key) === 'ANIO');
        let anio = item.anio || item.Anio || item.ANIO || item.ano || item.Ano || item.ANO || (claveAnio ? item[claveAnio] : undefined);
        let mes = item.mes || item.Mes || item.MES;

        const fecha = encontrarFecha(item);
        if ((!anio || !mes) && fecha) {
            const partes = String(fecha).includes('-') ? String(fecha).split('-') : String(fecha).split('/');
            if (partes.length >= 2) {
                if (partes[0].length === 4) {
                    anio = anio || partes[0];
                    mes = mes || partes[1];
                } else {
                    anio = anio || partes[2];
                    mes = mes || partes[1];
                }
            }
        }

        if (!anio || !mes) return null;

        const mesIndex = Number(mes) - 1;
        if (!Number.isFinite(mesIndex) || mesIndex < 0 || mesIndex > 11) return null;

        const anioTexto = String(anio);
        return {
            key: `${anioTexto}-${String(mesIndex + 1).padStart(2, '0')}`,
            anio: anioTexto,
            mesIndex,
            etiqueta: `${MESES[mesIndex]}-${anioTexto.slice(-2)}`
        };
    };

    const divisionesTablaEspecialidadPeriodo = useMemo(() => {
        const divisionesMap = new Map();

        datos.forEach(item => {
            const division = normalizarDivisionTablaEspecialidad(item);
            const clave = nivelarTexto(division);
            if (clave && !divisionesMap.has(clave)) {
                divisionesMap.set(clave, division);
            }
        });

        return [...divisionesMap.values()].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    }, [datos]);

    useEffect(() => {
        if (
            divisionTablaEspecialidad !== 'todas' &&
            !divisionesTablaEspecialidadPeriodo.some(division => nivelarTexto(division) === nivelarTexto(divisionTablaEspecialidad))
        ) {
            setDivisionTablaEspecialidad('todas');
        }
    }, [divisionTablaEspecialidad, divisionesTablaEspecialidadPeriodo]);

    const tablaConsultasEspecialidadPeriodo = useMemo(() => {
        const filasMap = {};
        const periodosMap = new Map();
        const especialidadesReferencia = {
            '1000': 'Alergia e Inmunologia',
            '1400': 'Cardiologia',
            '1500': 'Cirugia Cardiotoracica',
            '2100': 'Ginecologia',
            '2101': 'Biologia de la Reproduccion Humana',
            '2103': 'Urologia Ginecologica',
            '2104': 'Ginecologia endocrina',
            '2105': 'Clinica de Displasia',
            '2106': 'Clinica de Mama',
            '2400': 'Obstetricia',
            '2401': 'Medicina Materno Fetal',
            '2500': 'Medicina Interna',
            '3000': 'Oftalmologia',
            '3200': 'Pediatria',
            '3201': 'Cardiologia Pediatrica',
            '3202': 'Endocrinologia Pediatrica',
            '3203': 'Gastroenterologia Pediatrica',
            '3204': 'Hematologia Pediatrica',
            '3205': 'Infectologia Pediatrica',
            '3206': 'Neumologia Pediatrica',
            '3207': 'Neurologia Pediatrica',
            '3208': 'Oncologia Pediatrica',
            '3209': 'Reumatologia Pediatrica',
            '3500': 'Psiquiatria',
            '3800': 'Traumatologia y ortopedia',
            '3801': 'Traumatologia',
            '4100': 'Urologia',
            '4400': 'Cirugia Pediatrica',
            '4401': 'Nefrologia Pediatrica',
            '4402': 'Neurocirugia Pediatrica',
            '4600': 'Cirugia Plastica y Reconstructiva',
            '5001': 'Consultas en Primer Contacto',
            '6300': 'Trabajo Social',
            '6600': 'Psicologia',
            '6900': 'Nutricion y Dietetica',
            '5100': 'Cirugia oncologica',
            '5103': 'Ginecologia Oncologica',
            '6500': 'Genetica Medica',
            '6800': 'Medicina Fisica y Rehabilitacion',
            '8800': 'Anestesiologia',
            '8802': 'Clinica del Dolor',
            'A600': 'Urgencias Tococirugia',
            'MT01': 'SPPSTIMSS - Medico Especialista (Medico General)'
        };
        const clavesPorDescripcion = Object.entries(diccionarioEspecialidades).reduce((acc, [clave, info]) => {
            const descripcion = nivelarTexto(info?.nombre || '');
            if (descripcion && !acc[descripcion]) acc[descripcion] = clave;
            return acc;
        }, {});

        Object.entries(especialidadesReferencia).forEach(([clave, descripcion]) => {
            const descripcionNivelada = nivelarTexto(descripcion);
            if (descripcionNivelada && !clavesPorDescripcion[descripcionNivelada]) clavesPorDescripcion[descripcionNivelada] = clave;
        });

        const aliasEspecialidadesReferencia = {
            [nivelarTexto('Trabajo Social')]: '6300',
            [nivelarTexto('Psicologia')]: '6600',
            [nivelarTexto('Nutricion')]: '6900',
            [nivelarTexto('Nutricion y Dietetica')]: '6900',
            [nivelarTexto('Consultas en Primer Contacto')]: '5001',
            [nivelarTexto('Primer Contacto')]: '5001',
            [nivelarTexto('Urgencias')]: 'A600',
            [nivelarTexto('Urgencias Tococirugia')]: 'A600',
            [nivelarTexto('Urgencias Toco Cirugia')]: 'A600',
            [nivelarTexto('Admision Continua')]: 'A600',
            [nivelarTexto('Observacion')]: 'A600',
            [nivelarTexto('Choque')]: 'A600'
        };

        Object.entries(aliasEspecialidadesReferencia).forEach(([descripcion, clave]) => {
            if (descripcion && !clavesPorDescripcion[descripcion]) clavesPorDescripcion[descripcion] = clave;
        });

        const obtenerDescripcionCatalogo = (clave) => diccionarioEspecialidades[clave]?.nombre || especialidadesReferencia[clave] || '';
        const limpiarClaveEspecialidad = (valorCrudo) => {
            const texto = String(valorCrudo || '')
                .trim()
                .toUpperCase()
                .replace('COD:', '')
                .replace('COD: ', '')
                .replace('.0', '')
                .trim();
            const compacta = texto.replace(/[^0-9A-Z]/g, '');
            return /^(\d{3,5}|[A-Z]{1,3}\d{2,4})$/.test(compacta) ? compacta : '';
        };

        const obtenerEspecialidad = (valorCrudo) => {
            const valorTexto = String(valorCrudo || '').trim();
            const claveDirecta = limpiarClaveEspecialidad(valorTexto);

            if (claveDirecta) {
                const descripcionCatalogo = obtenerDescripcionCatalogo(claveDirecta);
                if (!descripcionCatalogo) return null;
                return { cve: claveDirecta, descripcion: descripcionCatalogo };
            }

            const descripcionNivelada = nivelarTexto(valorTexto);
            const claveCatalogo = clavesPorDescripcion[descripcionNivelada] || '';
            if (!claveCatalogo) return null;

            return {
                cve: claveCatalogo,
                descripcion: obtenerDescripcionCatalogo(claveCatalogo) || valorTexto
            };
        };

        datos.forEach(item => {
            const divisionRegistro = normalizarDivisionTablaEspecialidad(item);
            if (
                divisionTablaEspecialidad !== 'todas' &&
                nivelarTexto(divisionRegistro) !== nivelarTexto(divisionTablaEspecialidad)
            ) {
                return;
            }

            const periodo = obtenerPeriodoTablaEspecialidad(item);
            if (!periodo) return;

            if (!periodosMap.has(periodo.key)) {
                periodosMap.set(periodo.key, periodo);
            }

            const especialidad = obtenerEspecialidad(item.especialidad || item.ESPECIALIDAD || item.servicio || 'Sin Descripcion');
            if (!especialidad) return;
            const cve = especialidad.cve || '';
            const descripcion = especialidad.descripcion || 'Sin Descripcion';
            const filaKey = `${cve || 'SIN-CVE'}-${nivelarTexto(descripcion)}`;
            const origen = obtenerOrigenTablaEspecialidad(item);

            if (!filasMap[filaKey]) {
                filasMap[filaKey] = {
                    cve,
                    descripcion,
                    conteos: {},
                    total: 0,
                    origenes: { consulta_externa: 0, paramedicos: 0, urgencias: 0 }
                };
            }

            filasMap[filaKey].conteos[periodo.key] = (filasMap[filaKey].conteos[periodo.key] || 0) + 1;
            filasMap[filaKey].total++;
            filasMap[filaKey].origenes[origen] = (filasMap[filaKey].origenes[origen] || 0) + 1;
        });

        const periodos = [...periodosMap.values()].sort((a, b) => Number(a.anio) - Number(b.anio) || a.mesIndex - b.mesIndex);
        const filas = Object.values(filasMap).sort((a, b) => {
            const claveA = a.cve || a.descripcion;
            const claveB = b.cve || b.descripcion;
            return claveA.localeCompare(claveB, undefined, { numeric: true, sensitivity: 'base' });
        });
        const totalesPorPeriodo = {};
        const resumenOrigenes = { consulta_externa: 0, paramedicos: 0, urgencias: 0 };
        let totalGeneral = 0;

        periodos.forEach(periodo => {
            const totalPeriodo = filas.reduce((total, fila) => total + (fila.conteos[periodo.key] || 0), 0);
            totalesPorPeriodo[periodo.key] = totalPeriodo;
            totalGeneral += totalPeriodo;
        });

        filas.forEach(fila => {
            resumenOrigenes.consulta_externa += fila.origenes.consulta_externa || 0;
            resumenOrigenes.paramedicos += fila.origenes.paramedicos || 0;
            resumenOrigenes.urgencias += fila.origenes.urgencias || 0;
        });

        return { periodos, filas, totalesPorPeriodo, totalGeneral, resumenOrigenes };
    }, [datos, diccionarioEspecialidades, divisionTablaEspecialidad]);

    const divisionesTopConsulta = useMemo(() => {
        const divisionesMap = new Map();

        datosConsultaExterna.forEach(item => {
            const division = normalizarDivisionTablaEspecialidad(item);
            const clave = nivelarTexto(division);
            if (clave && !divisionesMap.has(clave)) {
                divisionesMap.set(clave, division);
            }
        });

        return [...divisionesMap.values()].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    }, [datosConsultaExterna]);

    useEffect(() => {
        if (areaSidebar !== 'consulta_externa') return;
        setDivisionTopMedicos(divisionSeleccionada);
        setDivisionTopDiagnosticos(divisionSeleccionada);
    }, [areaSidebar, divisionSeleccionada]);

    useEffect(() => {
        const existeDivision = (division) =>
            division === 'todas' ||
            divisionesTopConsulta.some(item => nivelarTexto(item) === nivelarTexto(division));

        if (!existeDivision(divisionTopMedicos)) setDivisionTopMedicos('todas');
        if (!existeDivision(divisionTopDiagnosticos)) setDivisionTopDiagnosticos('todas');
    }, [divisionTopMedicos, divisionTopDiagnosticos, divisionesTopConsulta]);

    const datosTopBase = useMemo(() => {
        return datosFiltradosFecha.filter(item => {
            if (especialidadSeleccionada === 'todas') return true;
            const espTraducida = traducirEspecialidad(item.especialidad || item.ESPECIALIDAD);
            return nivelarTexto(espTraducida) === nivelarTexto(especialidadSeleccionada);
        });
    }, [datosFiltradosFecha, especialidadSeleccionada]);

    const filtrarDatosTopPorDivision = (listaDatos, divisionFiltro) => {
        if (divisionFiltro === 'todas') return listaDatos;
        return listaDatos.filter(item =>
            nivelarTexto(normalizarDivisionTablaEspecialidad(item)) === nivelarTexto(divisionFiltro)
        );
    };

    const esPrimeraVezRegistro = (item) =>
        nivelarTexto(item?.primera_vez || item?.PRIMERA_VEZ) === 'PRIMERA VEZ';

    const unirValoresAgrupados = (valores) =>
        [...valores]
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
            .join(', ') || 'Sin dato';

    const datosTopMedicosFiltrados = useMemo(
        () => filtrarDatosTopPorDivision(datosTopBase, divisionTopMedicos),
        [datosTopBase, divisionTopMedicos]
    );

    const datosTopDiagnosticosFiltrados = useMemo(
        () => filtrarDatosTopPorDivision(datosTopBase, divisionTopDiagnosticos),
        [datosTopBase, divisionTopDiagnosticos]
    );

    const chartDivisiones = useMemo(() => {
        // Bandera para saber en qué nivel estamos
        const mostrandoEspecialidades = divisionSeleccionada !== 'todas';

        const conteo = datosFiltrados.reduce((acc, curr) => {
            // Condicionamos la agrupación
            const clave = mostrandoEspecialidades
                ? traducirEspecialidad(curr.especialidad || curr.ESPECIALIDAD)
                : (curr.division || 'Sin Asignar');

            if (!acc[clave]) acc[clave] = { total: 0, pv: 0, sub: 0 };
            acc[clave].total++;
            if (curr.primera_vez === 'Primera Vez') acc[clave].pv++; else acc[clave].sub++;
            return acc;
        }, {});

        const ordenados = Object.entries(conteo).sort((a, b) =>
            ordenInverso ? a[1].total - b[1].total : b[1].total - a[1].total
        );

        return {
            labels: ordenados.map(item => item[0]),
            datasets: [{
                label: 'Consultas',
                data: ordenados.map(item => item[1].total),
                // Usamos un color fijo para especialidades y la paleta para divisiones
                backgroundColor: mostrandoEspecialidades ? '#334155' : ['#822626', '#D4C19C', '#475569', '#1e293b', '#b45309'],
                borderRadius: 4
            }],
            dataPV: ordenados.map(item => item[1].pv),
            dataSub: ordenados.map(item => item[1].sub),
            // Exportamos la bandera para que la interfaz sepa qué título poner
            mostrandoEspecialidades
        };
    }, [datosFiltrados, ordenInverso, divisionSeleccionada]);

    const chartTurnos = useMemo(() => {
        const conteo = datosFiltrados.reduce((acc, curr) => {
            const turno = curr.turno || 'Sin Asignar';
            if (!acc[turno]) acc[turno] = { total: 0, pv: 0, sub: 0 };
            acc[turno].total++;
            if (curr.primera_vez === 'Primera Vez') acc[turno].pv++; else acc[turno].sub++;
            return acc;
        }, {});

        const ordenados = Object.entries(conteo).sort((a, b) => b[1].total - a[1].total);
        return {
            labels: ordenados.map(item => item[0]),
            datasets: [{ data: ordenados.map(item => item[1].total), backgroundColor: ['#475569', '#822626', '#D4C19C', '#1e293b', '#b45309'], borderWidth: 0 }],
            dataPV: ordenados.map(item => item[1].pv),
            dataSub: ordenados.map(item => item[1].sub)
        };
    }, [datosFiltrados]);

    const chartEspecialidades = useMemo(() => {
        if (!datosFiltrados || datosFiltrados.length === 0) return { labels: [], datasets: [], dataPV: [], dataSub: [] };

        const conteo = datosFiltrados.reduce((acc, curr) => {
            const esp = traducirEspecialidad(curr.especialidad || curr.ESPECIALIDAD);

            if (!acc[esp]) acc[esp] = { total: 0, pv: 0, sub: 0 };
            acc[esp].total++;
            if (curr.primera_vez === 'Primera Vez') acc[esp].pv++; else acc[esp].sub++;
            return acc;
        }, {});

        const ordenados = Object.entries(conteo).sort((a, b) =>
            ordenInverso ? a[1].total - b[1].total : b[1].total - a[1].total
        );
        return {
            labels: ordenados.map(item => item[0]),
            datasets: [{ label: 'Consultas', data: ordenados.map(item => item[1].total), backgroundColor: '#334155', borderRadius: 4 }],
            dataPV: ordenados.map(item => item[1].pv),
            dataSub: ordenados.map(item => item[1].sub)
        };
    }, [datosFiltrados, ordenInverso]);

    const rankingMedicosCompleto = useMemo(() => {
        const conteo = new Map();

        datosTopMedicosFiltrados.forEach(curr => {
            const matriculaBase = String(curr.matricula_medico || curr.MATRICULA_MEDICO || curr.matricula || curr.MATRICULA || '').trim();
            const matriculaLimpia = matriculaBase.replace('.0', '').replace(/\s/g, '');
            const nombreMedico = diccionarioMedicos[matriculaLimpia] || (matriculaLimpia ? `Matr. ${matriculaLimpia}` : 'Sin Matricula');
            const nombreEspecialidad = traducirEspecialidad(curr.especialidad || curr.ESPECIALIDAD) || 'Sin Especialidad';
            const division = normalizarDivisionTablaEspecialidad(curr);
            const clave = matriculaLimpia || 'SIN_MATRICULA';

            if (!conteo.has(clave)) {
                conteo.set(clave, {
                    nombre: nombreMedico,
                    matricula: matriculaLimpia,
                    total: 0,
                    pv: 0,
                    sub: 0,
                    divisiones: new Set(),
                    especialidades: new Set()
                });
            }

            const registro = conteo.get(clave);
            registro.total++;
            if (esPrimeraVezRegistro(curr)) registro.pv++; else registro.sub++;
            registro.divisiones.add(division);
            registro.especialidades.add(nombreEspecialidad);
        });

        return [...conteo.values()]
            .map(item => ({
                ...item,
                divisionesTexto: unirValoresAgrupados(item.divisiones),
                especialidadesTexto: unirValoresAgrupados(item.especialidades)
            }))
            .sort((a, b) => ordenInverso ? a.total - b.total : b.total - a.total);
    }, [datosTopMedicosFiltrados, diccionarioMedicos, ordenInverso]);

    const chartMedicos = useMemo(() => {
        const top = rankingMedicosCompleto.slice(0, 20);

        return {
            labels: top.map(item => item.nombre),
            datasets: [{ label: 'Consultas', data: top.map(item => item.total), backgroundColor: '#822626', borderRadius: 4 }],
            dataPV: top.map(item => item.pv),
            dataSub: top.map(item => item.sub),
            dataExtra: top.map(item => item.especialidadesTexto)
        };
    }, [rankingMedicosCompleto]);

    const rankingDiagnosticosCompleto = useMemo(() => {
        const conteo = new Map();

        datosTopDiagnosticosFiltrados.forEach(curr => {
            const codigoRaw = String(curr.diagnostico_principal || curr.DIAGNOSTICO_PRINCIPAL || curr.diagnostico || curr.DIAGNOSTICO || '').trim().toUpperCase();
            const codigo = codigoRaw || 'NO ESPECIFICADO';
            const nombreEnfermedad = diccionarioCIE[codigo] || codigo;
            const nombreEspecialidad = traducirEspecialidad(curr.especialidad || curr.ESPECIALIDAD) || 'Sin Especialidad';
            const division = normalizarDivisionTablaEspecialidad(curr);

            if (!conteo.has(codigo)) {
                conteo.set(codigo, {
                    codigo,
                    diagnostico: nombreEnfermedad,
                    total: 0,
                    pv: 0,
                    sub: 0,
                    divisiones: new Set(),
                    especialidades: new Set()
                });
            }

            const registro = conteo.get(codigo);
            registro.total++;
            if (esPrimeraVezRegistro(curr)) registro.pv++; else registro.sub++;
            registro.divisiones.add(division);
            registro.especialidades.add(nombreEspecialidad);
        });

        return [...conteo.values()]
            .map(item => ({
                ...item,
                divisionesTexto: unirValoresAgrupados(item.divisiones),
                especialidadesTexto: unirValoresAgrupados(item.especialidades)
            }))
            .sort((a, b) => ordenInverso ? a.total - b.total : b.total - a.total);
    }, [datosTopDiagnosticosFiltrados, diccionarioCIE, ordenInverso]);

    const chartDiagnosticos = useMemo(() => {
        const top = rankingDiagnosticosCompleto.slice(0, 20);

        return {
            labels: top.map(item => item.diagnostico),
            datasets: [{ label: 'Frecuencia', data: top.map(item => item.total), backgroundColor: '#1e293b', borderRadius: 4 }],
            dataPV: top.map(item => item.pv),
            dataSub: top.map(item => item.sub),
            dataExtra: top.map(item => item.codigo)
        };
    }, [rankingDiagnosticosCompleto]);

    const chartConsultorios = useMemo(() => {
        if (!datosFiltrados || datosFiltrados.length === 0) {
            return { labels: [], datasets: [], dataPV: [], dataSub: [] };
        }

        const conteo = datosFiltrados.reduce((acc, curr) => {
            const cons = (curr.consultorio || curr.CONSULTORIO || "SIN ESPECIFICAR").toString().trim().toUpperCase();

            if (!acc[cons]) acc[cons] = { total: 0, pv: 0, sub: 0 };

            acc[cons].total++;
            if (curr.primera_vez === 'Primera Vez' || curr.PRIMERA_VEZ === 'Primera Vez') {
                acc[cons].pv++;
            } else {
                acc[cons].sub++;
            }
            return acc;
        }, {});

        const ordenados = Object.entries(conteo).sort((a, b) => b[1].total - a[1].total);
        return {
            labels: ordenados.map(item => item[0]),
            datasets: [{
                label: 'Consultas por Consultorio',
                data: ordenados.map(item => item[1].total),
                backgroundColor: '#10b981',
                borderRadius: 4
            }],
            dataPV: ordenados.map(item => item[1].pv),
            dataSub: ordenados.map(item => item[1].sub)
        };
    }, [datosFiltrados]);

    const anchoDinamico = (cantidadItems) => `max(100%, ${cantidadItems * 40}px)`;

    const chartOptionsVertical = {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 45, autoSkip: false } },
            y: { grid: { display: true, color: '#f1f5f9' }, beginAtZero: true }
        }
    };

    const calcularIndiceConsulta = (pv, sub) => {
        if (pv > 0) return Number((sub / pv).toFixed(2));
        return sub > 0 ? 'N/A' : 0;
    };

    const exportarRankingConsulta = async ({ titulo, nombreHoja, nombreArchivo, division, filas, columnas }) => {
        if (!filas.length) {
            alert(`No hay datos para descargar en ${titulo}.`);
            return;
        }

        const excelModule = await import('exceljs');
        const saverModule = await import('file-saver');
        const ExcelJS = excelModule.default || excelModule;
        const saveAs = saverModule.saveAs || saverModule.default;

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'SIEC';
        workbook.created = new Date();

        const colores = {
            rojoOscuro: '6B1F1F',
            rojoClaro: 'FEE2E2',
            slate: '334155',
            slateClaro: 'F1F5F9',
            borde: 'CBD5E1',
            texto: '0F172A',
            blanco: 'FFFFFF'
        };

        const totalPV = filas.reduce((total, fila) => total + fila.pv, 0);
        const totalSub = filas.reduce((total, fila) => total + fila.sub, 0);
        const totalGeneral = filas.reduce((total, fila) => total + fila.total, 0);
        const ultimaColumna = columnas.length;
        const sheet = workbook.addWorksheet(nombreHoja);

        sheet.columns = columnas.map(columna => ({ width: columna.width || 16 }));
        sheet.views = [{ state: 'frozen', ySplit: 6, showGridLines: false }];

        sheet.mergeCells(1, 1, 1, ultimaColumna);
        const tituloCell = sheet.getCell(1, 1);
        tituloCell.value = titulo;
        tituloCell.font = { bold: true, size: 18, color: { argb: colores.blanco } };
        tituloCell.alignment = { horizontal: 'center', vertical: 'middle' };
        tituloCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.rojoOscuro } };
        sheet.getRow(1).height = 28;

        sheet.mergeCells(2, 1, 2, ultimaColumna);
        const subtitulo = sheet.getCell(2, 1);
        subtitulo.value = `Division: ${division === 'todas' ? 'Todas' : division} | Registros agrupados: ${filas.length.toLocaleString('es-MX')} | Total consultas: ${totalGeneral.toLocaleString('es-MX')} | Generado el ${new Date().toLocaleString('es-MX')}`;
        subtitulo.font = { size: 10, color: { argb: colores.slate } };
        subtitulo.alignment = { horizontal: 'center', vertical: 'middle' };
        subtitulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.slateClaro } };

        sheet.mergeCells(4, 1, 4, ultimaColumna);
        const resumen = sheet.getCell(4, 1);
        resumen.value = `1ra vez: ${totalPV.toLocaleString('es-MX')} | Subsecuentes: ${totalSub.toLocaleString('es-MX')} | Indice: ${calcularIndiceConsulta(totalPV, totalSub)} | El grafico muestra Top 20, este archivo incluye todos los grupos.`;
        resumen.font = { bold: true, color: { argb: colores.texto } };
        resumen.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        resumen.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.rojoClaro } };

        const headerRow = sheet.getRow(6);
        headerRow.values = columnas.map(columna => columna.header);
        headerRow.height = 24;
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: colores.blanco } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.slate } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = {
                top: { style: 'thin', color: { argb: colores.borde } },
                bottom: { style: 'thin', color: { argb: colores.borde } },
                left: { style: 'thin', color: { argb: colores.borde } },
                right: { style: 'thin', color: { argb: colores.borde } }
            };
        });
        headerRow.getCell(ultimaColumna).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.rojoOscuro } };

        filas.forEach((fila, index) => {
            const row = sheet.getRow(7 + index);
            row.values = columnas.map(columna => columna.value(fila, index));

            row.eachCell((cell, colNumber) => {
                cell.alignment = { vertical: 'top', wrapText: true };
                cell.border = { bottom: { style: 'thin', color: { argb: 'E2E8F0' } } };
                if (columnas[colNumber - 1]?.numeric) cell.numFmt = '#,##0';
            });

            row.getCell(1).font = { bold: true, color: { argb: colores.slate } };
            row.getCell(ultimaColumna).font = { bold: true, color: { argb: colores.texto } };
            row.getCell(ultimaColumna).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.slateClaro } };
        });

        const totalRowIndex = 7 + filas.length;
        const totalRow = sheet.getRow(totalRowIndex);
        totalRow.values = columnas.map((columna, index) => {
            if (index === 0) return 'Total';
            if (index === 1) return 'Total general';
            if (columna.total === 'pv') return totalPV;
            if (columna.total === 'sub') return totalSub;
            if (columna.total === 'indice') return calcularIndiceConsulta(totalPV, totalSub);
            if (columna.total === 'total') return totalGeneral;
            return '';
        });

        totalRow.eachCell((cell, colNumber) => {
            cell.font = { bold: true, color: { argb: colores.texto } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.rojoClaro } };
            cell.border = {
                top: { style: 'thin', color: { argb: colores.borde } },
                bottom: { style: 'thin', color: { argb: colores.borde } }
            };
            cell.alignment = { vertical: 'middle', wrapText: true };
            if (columnas[colNumber - 1]?.numeric) cell.numFmt = '#,##0';
        });

        sheet.autoFilter = {
            from: { row: 6, column: 1 },
            to: { row: totalRowIndex, column: ultimaColumna }
        };

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const fechaArchivo = new Date().toLocaleDateString('es-MX').replaceAll('/', '-');
        saveAs(blob, `${nombreArchivo}_${fechaArchivo}.xlsx`);
    };

    const exportarTopMedicos = async () => {
        await exportarRankingConsulta({
            titulo: 'Productividad por Medico',
            nombreHoja: 'Medicos',
            nombreArchivo: 'top_medicos_productividad',
            division: divisionTopMedicos,
            filas: rankingMedicosCompleto,
            columnas: [
                { header: '#', width: 8, value: (_fila, index) => index + 1 },
                { header: 'Medico', width: 36, value: fila => fila.nombre },
                { header: 'Matricula', width: 16, value: fila => fila.matricula || 'Sin matricula' },
                { header: 'Division', width: 28, value: fila => fila.divisionesTexto },
                { header: 'Especialidad', width: 38, value: fila => fila.especialidadesTexto },
                { header: '1ra Vez', width: 12, value: fila => fila.pv, total: 'pv', numeric: true },
                { header: 'Subsec.', width: 12, value: fila => fila.sub, total: 'sub', numeric: true },
                { header: 'Indice', width: 12, value: fila => calcularIndiceConsulta(fila.pv, fila.sub), total: 'indice' },
                { header: 'Total', width: 12, value: fila => fila.total, total: 'total', numeric: true }
            ]
        });
    };

    const exportarTopDiagnosticos = async () => {
        await exportarRankingConsulta({
            titulo: 'Diagnosticos Principales',
            nombreHoja: 'Diagnosticos',
            nombreArchivo: 'top_diagnosticos_principales',
            division: divisionTopDiagnosticos,
            filas: rankingDiagnosticosCompleto,
            columnas: [
                { header: '#', width: 8, value: (_fila, index) => index + 1 },
                { header: 'Codigo CIE-10', width: 16, value: fila => fila.codigo },
                { header: 'Diagnostico', width: 48, value: fila => fila.diagnostico },
                { header: 'Division', width: 28, value: fila => fila.divisionesTexto },
                { header: 'Especialidad', width: 38, value: fila => fila.especialidadesTexto },
                { header: '1ra Vez', width: 12, value: fila => fila.pv, total: 'pv', numeric: true },
                { header: 'Subsec.', width: 12, value: fila => fila.sub, total: 'sub', numeric: true },
                { header: 'Indice', width: 12, value: fila => calcularIndiceConsulta(fila.pv, fila.sub), total: 'indice' },
                { header: 'Total', width: 12, value: fila => fila.total, total: 'total', numeric: true }
            ]
        });
    };
    const exportarTablaConsultasEspecialidadPeriodo = async () => {
        if (!tablaConsultasEspecialidadPeriodo.filas.length) {
            alert("No hay datos en la tabla de consultas por especialidad para descargar.");
            return;
        }

        const excelModule = await import('exceljs');
        const saverModule = await import('file-saver');
        const ExcelJS = excelModule.default || excelModule;
        const saveAs = saverModule.saveAs || saverModule.default;

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'SIEC';
        workbook.created = new Date();

        const colores = {
            rojoOscuro: '6B1F1F',
            rojo: '991B1B',
            rojoClaro: 'FEE2E2',
            verde: '047857',
            verdeClaro: 'D1FAE5',
            naranja: 'EA580C',
            naranjaClaro: 'FFEDD5',
            azulClaro: 'E0F2FE',
            slate: '334155',
            slateClaro: 'F1F5F9',
            borde: 'CBD5E1',
            texto: '0F172A',
            blanco: 'FFFFFF'
        };

        const origenesTexto = (fila) => {
            const origenes = [];
            if ((fila.origenes?.consulta_externa || 0) > 0) origenes.push('Consulta externa');
            if ((fila.origenes?.paramedicos || 0) > 0) origenes.push('Paramedicos');
            if ((fila.origenes?.urgencias || 0) > 0) origenes.push('Urgencias');
            return origenes.join(', ') || 'Sin origen';
        };

        const sheet = workbook.addWorksheet('Consultas especialidad');
        const periodos = tablaConsultasEspecialidadPeriodo.periodos;
        const ultimaColumna = periodos.length + 4;

        sheet.columns = [
            { width: 18 },
            { width: 44 },
            { width: 28 },
            ...periodos.map(() => ({ width: 14 })),
            { width: 14 }
        ];

        sheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 8, showGridLines: false }];
        sheet.mergeCells(1, 1, 1, ultimaColumna);
        const titulo = sheet.getCell(1, 1);
        titulo.value = 'Consultas por Especialidad';
        titulo.font = { bold: true, size: 18, color: { argb: colores.blanco } };
        titulo.alignment = { horizontal: 'center', vertical: 'middle' };
        titulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.rojoOscuro } };
        sheet.getRow(1).height = 28;

        sheet.mergeCells(2, 1, 2, ultimaColumna);
        const subtitulo = sheet.getCell(2, 1);
        subtitulo.value = `Incluye Consulta Externa, Paramedicos y Urgencias | Division: ${divisionTablaEspecialidad === 'todas' ? 'Todas' : divisionTablaEspecialidad} | Generado el ${new Date().toLocaleString('es-MX')}`;
        subtitulo.font = { size: 10, color: { argb: colores.slate } };
        subtitulo.alignment = { horizontal: 'center', vertical: 'middle' };
        subtitulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.slateClaro } };

        sheet.getCell(4, 1).value = 'Leyenda';
        sheet.getCell(4, 1).font = { bold: true, color: { argb: colores.texto } };
        sheet.getCell(4, 2).value = 'Sin punto en pantalla: Consulta externa';
        sheet.getCell(4, 3).value = 'Paramedicos';
        sheet.getCell(4, 3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.verdeClaro } };
        sheet.getCell(4, 4).value = 'Urgencias';
        sheet.getCell(4, 4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.naranjaClaro } };
        [1, 2, 3, 4].forEach(col => {
            const cell = sheet.getCell(4, col);
            cell.alignment = { vertical: 'middle', wrapText: true };
            cell.border = { bottom: { style: 'thin', color: { argb: colores.borde } } };
        });

        const pintarHeader = (cell, fill = colores.rojoOscuro) => {
            cell.font = { bold: true, color: { argb: colores.blanco } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = {
                top: { style: 'thin', color: { argb: colores.borde } },
                bottom: { style: 'thin', color: { argb: colores.borde } },
                left: { style: 'thin', color: { argb: colores.borde } },
                right: { style: 'thin', color: { argb: colores.borde } }
            };
        };

        sheet.mergeCells(6, 1, 8, 1);
        sheet.mergeCells(6, 2, 8, 2);
        sheet.mergeCells(6, 3, 8, 3);
        sheet.mergeCells(6, ultimaColumna, 8, ultimaColumna);
        sheet.getCell(6, 1).value = 'Cve Especialidad';
        sheet.getCell(6, 2).value = 'Descripcion';
        sheet.getCell(6, 3).value = 'Origen';
        sheet.getCell(6, ultimaColumna).value = 'Total';
        [1, 2, 3].forEach(col => pintarHeader(sheet.getCell(6, col), colores.slate));
        pintarHeader(sheet.getCell(6, ultimaColumna), colores.rojoOscuro);

        periodos.forEach((periodo, index) => {
            const col = 4 + index;
            sheet.getCell(6, col).value = 'Anio / Periodo';
            sheet.getCell(7, col).value = periodo.anio;
            sheet.getCell(8, col).value = periodo.etiqueta;
            pintarHeader(sheet.getCell(6, col), colores.slate);
            pintarHeader(sheet.getCell(7, col), colores.slate);
            pintarHeader(sheet.getCell(8, col), colores.rojo);
        });

        tablaConsultasEspecialidadPeriodo.filas.forEach((fila, index) => {
            const row = sheet.getRow(9 + index);
            row.getCell(1).value = fila.cve || '';
            row.getCell(2).value = fila.descripcion;
            row.getCell(3).value = origenesTexto(fila);

            periodos.forEach((periodo, periodoIndex) => {
                const valor = fila.conteos[periodo.key] || 0;
                row.getCell(4 + periodoIndex).value = valor || '';
                row.getCell(4 + periodoIndex).numFmt = '#,##0';
            });

            row.getCell(ultimaColumna).value = fila.total;
            row.getCell(ultimaColumna).numFmt = '#,##0';

            const tieneParamedicos = (fila.origenes?.paramedicos || 0) > 0;
            const tieneUrgencias = (fila.origenes?.urgencias || 0) > 0;
            if (tieneParamedicos && tieneUrgencias) {
                row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.azulClaro } };
            } else if (tieneParamedicos) {
                row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.verdeClaro } };
            } else if (tieneUrgencias) {
                row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.naranjaClaro } };
            }

            row.eachCell((cell) => {
                cell.alignment = { vertical: 'top', wrapText: true };
                cell.border = { bottom: { style: 'thin', color: { argb: 'E2E8F0' } } };
            });
            row.getCell(1).font = { bold: true, color: { argb: colores.texto } };
            row.getCell(ultimaColumna).font = { bold: true, color: { argb: colores.texto } };
            row.getCell(ultimaColumna).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.slateClaro } };
        });

        const totalRowIndex = 9 + tablaConsultasEspecialidadPeriodo.filas.length;
        const totalRow = sheet.getRow(totalRowIndex);
        totalRow.getCell(1).value = 'Total';
        totalRow.getCell(2).value = 'Total';
        totalRow.getCell(3).value = `CE: ${tablaConsultasEspecialidadPeriodo.resumenOrigenes.consulta_externa.toLocaleString('es-MX')} | Paramedicos: ${tablaConsultasEspecialidadPeriodo.resumenOrigenes.paramedicos.toLocaleString('es-MX')} | Urgencias: ${tablaConsultasEspecialidadPeriodo.resumenOrigenes.urgencias.toLocaleString('es-MX')}`;
        periodos.forEach((periodo, index) => {
            totalRow.getCell(4 + index).value = tablaConsultasEspecialidadPeriodo.totalesPorPeriodo[periodo.key] || 0;
            totalRow.getCell(4 + index).numFmt = '#,##0';
        });
        totalRow.getCell(ultimaColumna).value = tablaConsultasEspecialidadPeriodo.totalGeneral;
        totalRow.getCell(ultimaColumna).numFmt = '#,##0';
        totalRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: colores.texto } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.rojoClaro } };
            cell.border = {
                top: { style: 'thin', color: { argb: colores.borde } },
                bottom: { style: 'thin', color: { argb: colores.borde } }
            };
            cell.alignment = { vertical: 'middle', wrapText: true };
        });

        sheet.autoFilter = {
            from: { row: 8, column: 1 },
            to: { row: totalRowIndex, column: ultimaColumna }
        };

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const fechaArchivo = new Date().toLocaleDateString('es-MX').replaceAll('/', '-');
        saveAs(blob, `tabla_consultas_especialidad_${fechaArchivo}.xlsx`);
    };
    const exportarReporteCirugias = async () => {
        if (datosCirugias.length === 0) {
            alert("El modulo de Cirugias todavia no tiene datos cargados para exportar con los filtros actuales.");
            return;
        }

        const excelModule = await import('exceljs');
        const saverModule = await import('file-saver');
        const ExcelJS = excelModule.default || excelModule;
        const saveAs = saverModule.saveAs || saverModule.default;

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'SIEC';
        workbook.created = new Date();

        const colores = {
            rojoOscuro: '6B1F1F',
            rojo: '991B1B',
            rojoClaro: 'FEE2E2',
            vinoClaro: 'FCE7E7',
            dorado: 'B45309',
            doradoClaro: 'FEF3C7',
            azul: '0369A1',
            azulClaro: 'E0F2FE',
            verde: '047857',
            verdeClaro: 'D1FAE5',
            slate: '334155',
            slateClaro: 'F1F5F9',
            borde: 'CBD5E1',
            texto: '0F172A',
            blanco: 'FFFFFF',
            alerta: 'FEF3C7',
            riesgo: 'FEE2E2'
        };

        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const normalizar = (valor, fallback = 'SIN DATO') => {
            if (valor === null || valor === undefined || String(valor).trim() === '') return fallback;
            return String(valor).trim();
        };
        const normalizarMayus = (valor, fallback = 'SIN DATO') => normalizar(valor, fallback).toUpperCase();
        const numero = (valor) => {
            const n = Number(valor);
            return Number.isFinite(n) ? n : 0;
        };
        const obtenerEstatus = (registro) => normalizarMayus(registro.estatus || registro.estatusOriginal, 'SIN ESTATUS');
        const fechaArchivo = () => fechaArchivoReporteCirugias();
        const etiquetaMes = () => {
            if (mesSeleccionado === 'todos') return 'Todos';
            if (mesSeleccionado === 'rango') {
                return `${meses[Number(mesInicio)] || ''} a ${meses[Number(mesFin)] || ''}`.trim();
            }
            return meses[Number(mesSeleccionado)] || String(mesSeleccionado);
        };
        const etiquetaFiltro = (valor) => valor === 'todas' || valor === 'todos' ? 'Todos' : normalizar(valor);

        const totalCirugias = datosCirugias.length;
        const resumenEstatus = datosCirugias.reduce(
            (acc, registro) => {
                const estatus = obtenerEstatus(registro);

                if (estatus.includes('REALIZ')) {
                    acc.realizadas += 1;
                } else if (estatus.includes('CANCEL')) {
                    acc.canceladas += 1;
                } else {
                    acc.otras += 1;
                }

                return acc;
            },
            { realizadas: 0, canceladas: 0, otras: 0 }
        );

        const diferimientosValidos = datosCirugias
            .map((registro) => Number(registro.diferimiento))
            .filter((dias) => Number.isFinite(dias) && dias >= 0);
        const totalDiferimiento = diferimientosValidos.reduce((sum, dias) => sum + dias, 0);
        const promedioDiferimiento = diferimientosValidos.length > 0 ? totalDiferimiento / diferimientosValidos.length : 0;
        const mayorDiferimiento = diferimientosValidos.length > 0 ? Math.max(...diferimientosValidos) : 0;

        const resumenPor = (obtenerClave, registros = datosCirugias, fallback = 'SIN ESPECIFICAR') => {
            const resumen = registros.reduce((acc, registro) => {
                const clave = normalizarMayus(obtenerClave(registro), fallback);

                if (!acc[clave]) {
                    acc[clave] = {
                        categoria: clave,
                        total: 0,
                        realizadas: 0,
                        canceladas: 0,
                        otras: 0,
                        diferimiento: 0,
                        diferimientoRegistros: 0
                    };
                }

                const item = acc[clave];
                const estatus = obtenerEstatus(registro);
                const dias = Number(registro.diferimiento);

                item.total += 1;

                if (estatus.includes('REALIZ')) {
                    item.realizadas += 1;
                } else if (estatus.includes('CANCEL')) {
                    item.canceladas += 1;
                } else {
                    item.otras += 1;
                }

                if (Number.isFinite(dias) && dias >= 0) {
                    item.diferimiento += dias;
                    item.diferimientoRegistros += 1;
                }

                return acc;
            }, {});

            return Object.values(resumen)
                .map((item) => ({
                    ...item,
                    promedioDiferimiento: item.diferimientoRegistros > 0 ? item.diferimiento / item.diferimientoRegistros : 0,
                    porcentajeRealizadas: item.total > 0 ? item.realizadas / item.total : 0
                }))
                .sort((a, b) => b.total - a.total);
        };

        const datosCancelados = datosCirugias.filter((registro) => obtenerEstatus(registro).includes('CANCEL'));
        const datosConSuspension = datosCirugias.filter((registro) => {
            const motivo = normalizarMayus(registro.ultimoMotivoSuspension, '');
            return motivo && !motivo.includes('SIN SUSPENSION') && motivo !== 'NO REGISTRADO';
        });

        const resumenDivisiones = resumenPor((registro) => registro.division, datosCirugias, 'SIN DIVISION');
        const resumenEspecialidades = resumenPor((registro) => registro.especialidad, datosCirugias, 'SIN ESPECIALIDAD');
        const resumenCirujanos = resumenPor((registro) => registro.nombreCirujano, datosCirugias, 'SIN CIRUJANO');
        const resumenSalas = resumenPor((registro) => registro.sala, datosCirugias, 'SIN SALA');
        const resumenCie10 = resumenPor((registro) => registro.cie10, datosCirugias, 'SIN CIE10');
        const resumenEstatusDetalle = resumenPor((registro) => registro.estatusOriginal || registro.estatus, datosCirugias, 'SIN ESTATUS');
        const resumenMotivosCancelacion = resumenPor((registro) => registro.motivoCancelacion, datosCancelados, 'SIN MOTIVO');
        const resumenMotivosSuspension = resumenPor((registro) => registro.ultimoMotivoSuspension, datosConSuspension, 'SIN MOTIVO');

        const aplicarTitulo = (sheet, titulo, subtitulo, ultimaColumna) => {
            sheet.views = [{ showGridLines: false }];
            sheet.mergeCells(1, 1, 1, ultimaColumna);

            const tituloCell = sheet.getCell(1, 1);
            tituloCell.value = titulo;
            tituloCell.font = { bold: true, size: 18, color: { argb: colores.blanco } };
            tituloCell.alignment = { horizontal: 'center', vertical: 'middle' };
            tituloCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.rojoOscuro } };
            sheet.getRow(1).height = 28;

            sheet.mergeCells(2, 1, 2, ultimaColumna);

            const subtituloCell = sheet.getCell(2, 1);
            subtituloCell.value = subtitulo;
            subtituloCell.font = { size: 10, color: { argb: colores.slate } };
            subtituloCell.alignment = { horizontal: 'center', vertical: 'middle' };
            subtituloCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.slateClaro } };
        };

        const pintarEncabezado = (row, color = colores.rojoOscuro) => {
            row.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: colores.blanco } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                cell.border = {
                    top: { style: 'thin', color: { argb: colores.borde } },
                    bottom: { style: 'thin', color: { argb: colores.borde } },
                    left: { style: 'thin', color: { argb: colores.borde } },
                    right: { style: 'thin', color: { argb: colores.borde } }
                };
            });
        };

        const pintarFilaDatos = (row) => {
            row.eachCell((cell) => {
                cell.alignment = { vertical: 'top', wrapText: true };
                cell.border = {
                    bottom: { style: 'thin', color: { argb: 'E2E8F0' } }
                };
            });
        };

        const agregarTablaResumen = (sheet, titulo, startRow, headers, rows, color = colores.rojoOscuro) => {
            sheet.mergeCells(startRow, 1, startRow, headers.length);
            const tituloCell = sheet.getCell(startRow, 1);
            tituloCell.value = titulo;
            tituloCell.font = { bold: true, size: 12, color: { argb: colores.texto } };
            tituloCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.slateClaro } };

            const headerRow = sheet.getRow(startRow + 1);
            headerRow.values = headers;
            pintarEncabezado(headerRow, color);

            rows.forEach((item, index) => {
                const row = sheet.getRow(startRow + 2 + index);
                row.values = item;
                pintarFilaDatos(row);
            });

            return startRow + rows.length + 3;
        };

        const crearHojaAgrupada = (nombreHoja, titulo, datos, primeraColumna, top = null) => {
            const sheet = workbook.addWorksheet(nombreHoja);
            aplicarTitulo(
                sheet,
                titulo,
                `Generado el ${new Date().toLocaleString('es-MX')} | Registros filtrados: ${totalCirugias.toLocaleString('es-MX')}`,
                6
            );

            sheet.columns = [
                { width: 46 },
                { width: 14 },
                { width: 14 },
                { width: 14 },
                { width: 14 },
                { width: 18 }
            ];

            const filas = (top ? datos.slice(0, top) : datos).map((item) => [
                item.categoria,
                item.total,
                item.realizadas,
                item.canceladas,
                item.otras,
                Number(item.promedioDiferimiento.toFixed(1))
            ]);

            const nextRow = agregarTablaResumen(
                sheet,
                titulo,
                4,
                [primeraColumna, 'Total', 'Realizadas', 'Canceladas', 'Otras', 'Prom. diferimiento'],
                filas,
                colores.rojo
            );

            const totalRow = sheet.getRow(nextRow);
            totalRow.values = ['TOTAL GENERAL', totalCirugias, resumenEstatus.realizadas, resumenEstatus.canceladas, resumenEstatus.otras, Number(promedioDiferimiento.toFixed(1))];
            totalRow.font = { bold: true, color: { argb: colores.texto } };
            totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.vinoClaro } };
            totalRow.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: colores.borde } },
                    bottom: { style: 'thin', color: { argb: colores.borde } }
                };
            });

            sheet.autoFilter = {
                from: { row: 5, column: 1 },
                to: { row: Math.max(5, nextRow - 1), column: 6 }
            };
            sheet.views = [{ state: 'frozen', ySplit: 5, showGridLines: false }];
            sheet.getColumn(2).numFmt = '#,##0';
            sheet.getColumn(3).numFmt = '#,##0';
            sheet.getColumn(4).numFmt = '#,##0';
            sheet.getColumn(5).numFmt = '#,##0';
            sheet.getColumn(6).numFmt = '0.0';

            return sheet;
        };

        const resumen = workbook.addWorksheet('Resumen');
        aplicarTitulo(
            resumen,
            'Reporte de Cirugias',
            `Generado el ${new Date().toLocaleString('es-MX')}`,
            8
        );

        resumen.columns = [
            { width: 22 },
            { width: 18 },
            { width: 22 },
            { width: 18 },
            { width: 24 },
            { width: 18 },
            { width: 26 },
            { width: 22 }
        ];

        const pintarCard = (colInicio, colFin, titulo, valor, fillColor) => {
            resumen.mergeCells(4, colInicio, 4, colFin);
            resumen.mergeCells(5, colInicio, 5, colFin);

            const labelCell = resumen.getCell(4, colInicio);
            labelCell.value = titulo;
            labelCell.font = { bold: true, size: 10, color: { argb: colores.blanco } };
            labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
            labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };

            const valueCell = resumen.getCell(5, colInicio);
            valueCell.value = valor;
            valueCell.font = { bold: true, size: 16, color: { argb: colores.texto } };
            valueCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.slateClaro } };
        };

        pintarCard(1, 2, 'Total cirugias', totalCirugias, colores.rojo);
        pintarCard(3, 4, 'Realizadas', resumenEstatus.realizadas, colores.verde);
        pintarCard(5, 6, 'Canceladas', resumenEstatus.canceladas, colores.dorado);
        pintarCard(7, 8, 'Prom. diferimiento', Number(promedioDiferimiento.toFixed(1)), colores.slate);

        resumen.getRow(8).values = ['Filtro', 'Valor', '', '', 'Filtro', 'Valor'];
        pintarEncabezado(resumen.getRow(8), colores.slate);
        const filtros = [
            ['Anio', anioSeleccionado === 'todos' ? 'Todos' : String(anioSeleccionado)],
            ['Mes', etiquetaMes()],
            ['Division', etiquetaFiltro(divisionSeleccionada)],
            ['Especialidad', etiquetaFiltro(especialidadSeleccionada)]
        ];

        filtros.forEach((item, index) => {
            const row = resumen.getRow(9 + Math.floor(index / 2));
            const offset = index % 2 === 0 ? 0 : 4;
            row.getCell(1 + offset).value = item[0];
            row.getCell(2 + offset).value = item[1];
            row.getCell(1 + offset).font = { bold: true, color: { argb: colores.slate } };
            row.getCell(2 + offset).alignment = { wrapText: true };
        });

        agregarTablaResumen(
            resumen,
            'Top especialidades',
            13,
            ['Especialidad', 'Total', 'Realizadas', 'Canceladas', 'Otras', 'Prom. diferimiento'],
            resumenEspecialidades.slice(0, 8).map((item) => [
                item.categoria,
                item.total,
                item.realizadas,
                item.canceladas,
                item.otras,
                Number(item.promedioDiferimiento.toFixed(1))
            ]),
            colores.rojo
        );

        resumen.mergeCells(13, 7, 13, 8);
        const tituloEstatus = resumen.getCell(13, 7);
        tituloEstatus.value = 'Estatus quirurgico';
        tituloEstatus.font = { bold: true, size: 12, color: { argb: colores.texto } };
        tituloEstatus.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.slateClaro } };

        const headerEstatus = resumen.getRow(14);
        headerEstatus.getCell(7).value = 'Estatus';
        headerEstatus.getCell(8).value = 'Total';
        [7, 8].forEach((col) => {
            const cell = headerEstatus.getCell(col);
            cell.font = { bold: true, color: { argb: colores.blanco } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.dorado } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        resumenEstatusDetalle.slice(0, 8).forEach((item, index) => {
            const row = resumen.getRow(15 + index);
            row.getCell(7).value = item.categoria;
            row.getCell(8).value = item.total;
            [7, 8].forEach((col) => {
                row.getCell(col).border = { bottom: { style: 'thin', color: { argb: 'E2E8F0' } } };
                row.getCell(col).alignment = { vertical: 'top', wrapText: true };
            });
        });

        const filaIndicadores = 25;
        resumen.mergeCells(filaIndicadores, 1, filaIndicadores, 8);
        const indicadorCell = resumen.getCell(filaIndicadores, 1);
        indicadorCell.value = 'Indicadores de diferimiento';
        indicadorCell.font = { bold: true, size: 12, color: { argb: colores.texto } };
        indicadorCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.slateClaro } };

        const headerDiferimiento = resumen.getRow(filaIndicadores + 1);
        headerDiferimiento.values = ['Registros con diferimiento', 'Promedio', 'Mayor diferimiento', 'Menor a 20 dias', '20 dias o mas'];
        pintarEncabezado(headerDiferimiento, colores.slate);

        const diferimientoRow = resumen.getRow(filaIndicadores + 2);
        const menores20 = diferimientosValidos.filter((dias) => dias < 20).length;
        const mayores20 = diferimientosValidos.filter((dias) => dias >= 20).length;
        diferimientoRow.values = [
            diferimientosValidos.length,
            Number(promedioDiferimiento.toFixed(1)),
            mayorDiferimiento,
            menores20,
            mayores20
        ];
        pintarFilaDatos(diferimientoRow);

        resumen.views = [{ showGridLines: false }];

        const detalle = workbook.addWorksheet('Detalle');
        aplicarTitulo(
            detalle,
            'Detalle de cirugias',
            `Registros filtrados: ${totalCirugias.toLocaleString('es-MX')}`,
            27
        );

        detalle.columns = [
            { width: 8 },
            { width: 36 },
            { width: 20 },
            { width: 8 },
            { width: 12 },
            { width: 24 },
            { width: 30 },
            { width: 24 },
            { width: 24 },
            { width: 18 },
            { width: 34 },
            { width: 18 },
            { width: 30 },
            { width: 30 },
            { width: 18 },
            { width: 18 },
            { width: 20 },
            { width: 24 },
            { width: 42 },
            { width: 42 },
            { width: 18 },
            { width: 16 },
            { width: 18 },
            { width: 16 },
            { width: 16 },
            { width: 18 },
            { width: 16 }
        ];

        const headerDetalle = detalle.getRow(4);
        headerDetalle.values = [
            '#',
            'Nombre completo',
            'Identificador',
            'Edad',
            'Sexo',
            'Division',
            'Especialidad',
            'Estatus',
            'Tipo de solicitud',
            'Cirugia concertada',
            'Cirujano',
            'Sala',
            'CIE10',
            'CIE9',
            'Fecha solicitud',
            'Fecha cancelacion',
            'Fecha programacion',
            'Reprogramacion',
            'Motivo de cancelacion',
            'Ultimo motivo de suspension',
            'Dias de diferimiento',
            'Entrada a sala',
            'Inicio anestesia',
            'Inicio Qx',
            'Fin Qx',
            'Fin anestesia',
            'Salida sala'
        ];
        pintarEncabezado(headerDetalle, colores.rojoOscuro);

        datosCirugias.forEach((registro, index) => {
            const row = detalle.getRow(5 + index);
            const diasDiferimiento = Number(registro.diferimiento);
            const estatus = obtenerEstatus(registro);

            row.values = [
                index + 1,
                normalizar(registro.nombrePaciente || registro.paciente, 'SIN NOMBRE'),
                normalizar(registro.identificadorPaciente || registro.identificador, 'SIN IDENTIFICADOR'),
                registro.edad ?? '',
                normalizar(registro.sexo, ''),
                normalizarMayus(registro.division, 'SIN DIVISION'),
                normalizarMayus(registro.especialidad, 'SIN ESPECIALIDAD'),
                normalizar(registro.estatusOriginal || registro.estatus, 'SIN ESTATUS'),
                normalizar(registro.tipoSolicitud, 'NO REGISTRADO'),
                normalizar(registro.concertada, 'SIN DATO'),
                normalizar(registro.nombreCirujano, 'SIN NOMBRE'),
                normalizar(registro.sala, 'SIN SALA'),
                normalizar(registro.cie10, 'SIN CIE10'),
                normalizar(registro.cie9, 'SIN CIE9'),
                formatearFechaReporteCirugias(registro.fechaSolicitud || registro.fechaSolicitudRaw),
                formatearFechaReporteCirugias(registro.fechaCancelacion || registro.fechaCancelacionRaw),
                formatearFechaReporteCirugias(registro.fechaProgramacion || registro.fechaProgramacionRaw),
                normalizar(registro.reprogramacionRaw, 'SIN DATO'),
                normalizar(registro.motivoCancelacion, 'NO REGISTRADO'),
                normalizar(registro.ultimoMotivoSuspension, 'SIN SUSPENSION'),
                Number.isFinite(diasDiferimiento) ? diasDiferimiento : '',
                normalizar(registro.entradaSala, ''),
                normalizar(registro.inicioAnestesia, ''),
                normalizar(registro.inicioQx, ''),
                normalizar(registro.finQx, ''),
                normalizar(registro.finAnestesia, ''),
                normalizar(registro.salidaSala, '')
            ];
            pintarFilaDatos(row);

            const estatusCell = row.getCell(8);
            if (estatus.includes('REALIZ')) {
                estatusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.verdeClaro } };
            } else if (estatus.includes('CANCEL')) {
                estatusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.riesgo } };
            } else {
                estatusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.doradoClaro } };
            }

            const diferimientoCell = row.getCell(21);
            diferimientoCell.numFmt = '#,##0';
            if (Number.isFinite(diasDiferimiento) && diasDiferimiento >= 20) {
                diferimientoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.alerta } };
            }
        });

        const lastDetalleRow = 4 + datosCirugias.length;
        detalle.autoFilter = {
            from: { row: 4, column: 1 },
            to: { row: Math.max(4, lastDetalleRow), column: 27 }
        };
        detalle.views = [{ state: 'frozen', ySplit: 4, showGridLines: false }];
        detalle.getColumn(4).numFmt = '#,##0';
        detalle.getColumn(21).numFmt = '#,##0';

        crearHojaAgrupada('Estatus', 'Cirugias por estatus', resumenEstatusDetalle, 'Estatus');
        crearHojaAgrupada('Divisiones', 'Cirugias por division', resumenDivisiones, 'Division');
        crearHojaAgrupada('Especialidades', 'Cirugias por especialidad', resumenEspecialidades, 'Especialidad');
        crearHojaAgrupada('Cirujanos', 'Top cirujanos', resumenCirujanos, 'Cirujano', 50);
        crearHojaAgrupada('Salas', 'Utilizacion de salas', resumenSalas, 'Sala');
        crearHojaAgrupada('CIE10', 'Top diagnosticos CIE10', resumenCie10, 'CIE10', 50);

        if (resumenMotivosCancelacion.length) {
            crearHojaAgrupada('Motivos cancelacion', 'Motivos de cancelacion', resumenMotivosCancelacion, 'Motivo');
        }

        if (resumenMotivosSuspension.length) {
            crearHojaAgrupada('Motivos suspension', 'Ultimos motivos de suspension', resumenMotivosSuspension, 'Motivo');
        }

        workbook.eachSheet((sheet) => {
            sheet.eachRow((row) => {
                row.eachCell((cell) => {
                    cell.font = cell.font || {};
                    cell.alignment = cell.alignment || { vertical: 'middle' };
                });
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        saveAs(blob, `reporte_cirugias_${fechaArchivo()}.xlsx`);
    };

    const exportarReporteHospitalizacion = async () => {
        if (datosHospitalizacion.length === 0) {
            alert("El modulo de Hospitalizacion no tiene datos para exportar con los filtros actuales.");
            return;
        }

        const excelModule = await import('exceljs');
        const saverModule = await import('file-saver');
        const ExcelJS = excelModule.default || excelModule;
        const saveAs = saverModule.saveAs || saverModule.default;

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'SIEC';
        workbook.created = new Date();

        const colores = {
            verdeOscuro: '064E3B',
            verde: '047857',
            verdeClaro: 'D1FAE5',
            azul: '0369A1',
            azulClaro: 'E0F2FE',
            slate: '334155',
            slateClaro: 'F1F5F9',
            borde: 'CBD5E1',
            texto: '0F172A',
            blanco: 'FFFFFF',
            alerta: 'FEF3C7',
            riesgo: 'FEE2E2'
        };

        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const normalizar = (valor, fallback = 'SIN DATO') => {
            if (valor === null || valor === undefined || String(valor).trim() === '') return fallback;
            return String(valor).trim();
        };
        const numero = (valor) => {
            const n = Number(valor);
            return Number.isFinite(n) ? n : 0;
        };
        const fechaArchivo = () => new Date().toLocaleDateString('es-MX').replaceAll('/', '-');
        const etiquetaMes = () => {
            if (mesSeleccionado === 'todos') return 'Todos';
            if (mesSeleccionado === 'rango') {
                return `${meses[Number(mesInicio)] || ''} a ${meses[Number(mesFin)] || ''}`.trim();
            }
            return meses[Number(mesSeleccionado)] || String(mesSeleccionado);
        };
        const etiquetaFiltro = (valor) => valor === 'todas' || valor === 'todos' ? 'Todos' : normalizar(valor);

        const totalEgresos = datosHospitalizacion.length;
        const totalDias = datosHospitalizacion.reduce((sum, item) => sum + numero(item.dias_estancia), 0);
        const promedioEstancia = totalEgresos > 0 ? totalDias / totalEgresos : 0;

        const resumenPor = (obtenerClave) => {
            const resumen = datosHospitalizacion.reduce((acc, item) => {
                const clave = normalizar(obtenerClave(item), 'SIN ESPECIFICAR').toUpperCase();

                if (!acc[clave]) {
                    acc[clave] = { categoria: clave, egresos: 0, dias: 0 };
                }

                acc[clave].egresos += 1;
                acc[clave].dias += numero(item.dias_estancia);
                return acc;
            }, {});

            return Object.values(resumen)
                .map((item) => ({
                    ...item,
                    promedio: item.egresos > 0 ? item.dias / item.egresos : 0
                }))
                .sort((a, b) => b.egresos - a.egresos);
        };

        const resumenMotivos = resumenPor((item) => item.motivo_egreso);
        const resumenDivisiones = resumenPor((item) => item.division);
        const resumenEspecialidades = resumenPor((item) => item.especialidad);
        const resumenDiagnosticos = resumenPor((item) => item.diagnostico_egreso);

        const aplicarTitulo = (sheet, titulo, subtitulo, ultimaColumna) => {
            sheet.views = [{ showGridLines: false }];
            sheet.mergeCells(1, 1, 1, ultimaColumna);

            const tituloCell = sheet.getCell(1, 1);
            tituloCell.value = titulo;
            tituloCell.font = { bold: true, size: 18, color: { argb: colores.blanco } };
            tituloCell.alignment = { horizontal: 'center', vertical: 'middle' };
            tituloCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.verdeOscuro } };
            sheet.getRow(1).height = 28;

            sheet.mergeCells(2, 1, 2, ultimaColumna);

            const subtituloCell = sheet.getCell(2, 1);
            subtituloCell.value = subtitulo;
            subtituloCell.font = { size: 10, color: { argb: colores.slate } };
            subtituloCell.alignment = { horizontal: 'center', vertical: 'middle' };
            subtituloCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.slateClaro } };
        };

        const pintarEncabezado = (row, color = colores.verdeOscuro) => {
            row.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: colores.blanco } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                cell.border = {
                    top: { style: 'thin', color: { argb: colores.borde } },
                    bottom: { style: 'thin', color: { argb: colores.borde } },
                    left: { style: 'thin', color: { argb: colores.borde } },
                    right: { style: 'thin', color: { argb: colores.borde } }
                };
            });
        };

        const pintarFilaDatos = (row) => {
            row.eachCell((cell) => {
                cell.alignment = { vertical: 'top', wrapText: true };
                cell.border = {
                    bottom: { style: 'thin', color: { argb: 'E2E8F0' } }
                };
            });
        };

        const agregarTablaResumen = (sheet, titulo, startRow, headers, rows, color = colores.verdeOscuro) => {
            sheet.mergeCells(startRow, 1, startRow, headers.length);
            const tituloCell = sheet.getCell(startRow, 1);
            tituloCell.value = titulo;
            tituloCell.font = { bold: true, size: 12, color: { argb: colores.texto } };
            tituloCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.slateClaro } };

            const headerRow = sheet.getRow(startRow + 1);
            headerRow.values = headers;
            pintarEncabezado(headerRow, color);

            rows.forEach((item, index) => {
                const row = sheet.getRow(startRow + 2 + index);
                row.values = item;
                pintarFilaDatos(row);
            });

            return startRow + rows.length + 3;
        };

        const crearHojaAgrupada = (nombreHoja, titulo, datos, primeraColumna, top = null) => {
            const sheet = workbook.addWorksheet(nombreHoja);
            aplicarTitulo(
                sheet,
                titulo,
                `Generado el ${new Date().toLocaleString('es-MX')} | Registros filtrados: ${totalEgresos.toLocaleString('es-MX')}`,
                4
            );

            sheet.columns = [
                { width: 46 },
                { width: 14 },
                { width: 18 },
                { width: 18 }
            ];

            const filas = (top ? datos.slice(0, top) : datos).map((item) => [
                item.categoria,
                item.egresos,
                item.dias,
                Number(item.promedio.toFixed(1))
            ]);

            const nextRow = agregarTablaResumen(
                sheet,
                titulo,
                4,
                [primeraColumna, 'Egresos', 'Dias estancia', 'Prom. estancia'],
                filas,
                colores.verde
            );

            const totalRow = sheet.getRow(nextRow);
            totalRow.values = ['TOTAL GENERAL', totalEgresos, totalDias, Number(promedioEstancia.toFixed(1))];
            totalRow.font = { bold: true, color: { argb: colores.texto } };
            totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.verdeClaro } };
            totalRow.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: colores.borde } },
                    bottom: { style: 'thin', color: { argb: colores.borde } }
                };
            });

            sheet.autoFilter = {
                from: { row: 5, column: 1 },
                to: { row: Math.max(5, nextRow - 1), column: 4 }
            };
            sheet.views = [{ state: 'frozen', ySplit: 5, showGridLines: false }];

            sheet.getColumn(2).numFmt = '#,##0';
            sheet.getColumn(3).numFmt = '#,##0';
            sheet.getColumn(4).numFmt = '0.0';

            return sheet;
        };

        const resumen = workbook.addWorksheet('Resumen');
        aplicarTitulo(
            resumen,
            'Reporte de Hospitalizacion',
            `Generado el ${new Date().toLocaleString('es-MX')}`,
            8
        );

        resumen.columns = [
            { width: 22 },
            { width: 18 },
            { width: 22 },
            { width: 18 },
            { width: 24 },
            { width: 18 },
            { width: 26 },
            { width: 22 }
        ];

        const pintarCard = (colInicio, colFin, titulo, valor, fillColor) => {
            resumen.mergeCells(4, colInicio, 4, colFin);
            resumen.mergeCells(5, colInicio, 5, colFin);

            const labelCell = resumen.getCell(4, colInicio);
            labelCell.value = titulo;
            labelCell.font = { bold: true, size: 10, color: { argb: colores.blanco } };
            labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
            labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };

            const valueCell = resumen.getCell(5, colInicio);
            valueCell.value = valor;
            valueCell.font = { bold: true, size: 16, color: { argb: colores.texto } };
            valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
            valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.slateClaro } };
        };

        pintarCard(1, 2, 'Total egresos', totalEgresos, colores.verde);
        pintarCard(3, 4, 'Dias estancia', totalDias, colores.azul);
        pintarCard(5, 6, 'Promedio estancia', Number(promedioEstancia.toFixed(1)), colores.slate);
        pintarCard(7, 8, 'Motivo principal', resumenMotivos[0]?.categoria || 'SIN DATO', colores.verdeOscuro);

        resumen.getRow(8).values = ['Filtro', 'Valor', '', '', 'Filtro', 'Valor'];
        pintarEncabezado(resumen.getRow(8), colores.slate);
        const filtros = [
            ['Anio', anioSeleccionado === 'todos' ? 'Todos' : String(anioSeleccionado)],
            ['Mes', etiquetaMes()],
            ['Division', etiquetaFiltro(divisionSeleccionada)],
            ['Especialidad', etiquetaFiltro(especialidadSeleccionada)]
        ];

        filtros.forEach((item, index) => {
            const row = resumen.getRow(9 + Math.floor(index / 2));
            const offset = index % 2 === 0 ? 0 : 4;
            row.getCell(1 + offset).value = item[0];
            row.getCell(2 + offset).value = item[1];
            row.getCell(1 + offset).font = { bold: true, color: { argb: colores.slate } };
            row.getCell(2 + offset).alignment = { wrapText: true };
        });

        agregarTablaResumen(
            resumen,
            'Top divisiones por egresos',
            13,
            ['Division', 'Egresos', 'Dias estancia', 'Prom. estancia'],
            resumenDivisiones.slice(0, 8).map((item) => [
                item.categoria,
                item.egresos,
                item.dias,
                Number(item.promedio.toFixed(1))
            ]),
            colores.verde
        );

        resumen.mergeCells(13, 6, 13, 8);
        const tituloMotivos = resumen.getCell(13, 6);
        tituloMotivos.value = 'Motivos de egreso';
        tituloMotivos.font = { bold: true, size: 12, color: { argb: colores.texto } };
        tituloMotivos.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.slateClaro } };

        const headerMotivos = resumen.getRow(14);
        headerMotivos.getCell(6).value = 'Motivo';
        headerMotivos.getCell(7).value = 'Egresos';
        headerMotivos.getCell(8).value = '%';
        [6, 7, 8].forEach((col) => {
            const cell = headerMotivos.getCell(col);
            cell.font = { bold: true, color: { argb: colores.blanco } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.azul } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        resumenMotivos.slice(0, 8).forEach((item, index) => {
            const row = resumen.getRow(15 + index);
            row.getCell(6).value = item.categoria;
            row.getCell(7).value = item.egresos;
            row.getCell(8).value = totalEgresos > 0 ? item.egresos / totalEgresos : 0;
            row.getCell(8).numFmt = '0.0%';
            [6, 7, 8].forEach((col) => {
                row.getCell(col).border = { bottom: { style: 'thin', color: { argb: 'E2E8F0' } } };
                row.getCell(col).alignment = { vertical: 'top', wrapText: true };
            });
        });

        resumen.views = [{ showGridLines: false }];

        const detalle = workbook.addWorksheet('Detalle');
        aplicarTitulo(
            detalle,
            'Detalle de egresos hospitalarios',
            `Registros filtrados: ${totalEgresos.toLocaleString('es-MX')}`,
            8
        );
        detalle.columns = [
            { width: 8 },
            { width: 12 },
            { width: 14 },
            { width: 32 },
            { width: 34 },
            { width: 16 },
            { width: 48 },
            { width: 34 }
        ];

        const headerDetalle = detalle.getRow(4);
        headerDetalle.values = ['#', 'Anio', 'Mes', 'Division', 'Especialidad', 'Dias estancia', 'Diagnostico de egreso', 'Motivo de egreso'];
        pintarEncabezado(headerDetalle, colores.verdeOscuro);

        datosHospitalizacion.forEach((item, index) => {
            const row = detalle.getRow(5 + index);
            row.values = [
                index + 1,
                normalizar(item.anio, ''),
                meses[Number(item.mes) - 1] || normalizar(item.mes, ''),
                normalizar(item.division, 'SIN DIVISION').toUpperCase(),
                normalizar(item.especialidad, 'SIN ESPECIALIDAD').toUpperCase(),
                numero(item.dias_estancia),
                normalizar(item.diagnostico_egreso, 'SIN DIAGNOSTICO').toUpperCase(),
                normalizar(item.motivo_egreso, 'SIN MOTIVO').toUpperCase()
            ];
            pintarFilaDatos(row);

            const diasCell = row.getCell(6);
            diasCell.numFmt = '#,##0';

            if (numero(item.dias_estancia) >= 15) {
                diasCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.riesgo } };
            } else if (numero(item.dias_estancia) >= 8) {
                diasCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colores.alerta } };
            }
        });

        const lastDetalleRow = 4 + datosHospitalizacion.length;
        detalle.autoFilter = {
            from: { row: 4, column: 1 },
            to: { row: Math.max(4, lastDetalleRow), column: 8 }
        };
        detalle.views = [{ state: 'frozen', ySplit: 4, showGridLines: false }];

        crearHojaAgrupada('Divisiones', 'Egresos por division medica', resumenDivisiones, 'Division');
        crearHojaAgrupada('Especialidades', 'Egresos por especialidad', resumenEspecialidades, 'Especialidad');
        crearHojaAgrupada('Diagnosticos', 'Top diagnosticos de egreso', resumenDiagnosticos, 'Diagnostico', 50);
        crearHojaAgrupada('Motivos', 'Motivos de egreso', resumenMotivos, 'Motivo');

        workbook.eachSheet((sheet) => {
            sheet.eachRow((row) => {
                row.eachCell((cell) => {
                    cell.font = cell.font || {};
                    cell.alignment = cell.alignment || { vertical: 'middle' };
                });
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        saveAs(blob, `reporte_hospitalizacion_${fechaArchivo()}.xlsx`);
    };
    const handleDescargarExcel = async () => {
        try {
            if (areaSidebar === 'cirugias') {
                await exportarReporteCirugias();
                return;
            }

            if (areaSidebar === 'hospitalizacion') {
                await exportarReporteHospitalizacion();
                return;
            }

            const totalRegistros =
                datosFiltrados.length +
                datosParamedicos.length +
                datosUrgencias.length +
                datosCirugias.length +
                datosHospitalizacion.length;

            if (totalRegistros === 0) {
                alert("No hay datos cargados para generar el reporte.");
                return;
            }

            await exportarReporteCompleto(
                datosFiltrados,
                datosParamedicos,
                datosUrgencias,
                datosCirugias,
                datosHospitalizacion
            );
        } catch (error) {
            console.error("Error en la exportacion:", error);
            alert("Hubo un error al generar el Excel.");
        }
    };

    const modulosConFiltrosCompletos = ['consulta_externa', 'paramedicos', 'urgencias', 'cirugias', 'hospitalizacion'];
    const mostrarFiltrosGlobales = modulosConFiltrosCompletos.includes(areaSidebar);

    const rolURL = new URLSearchParams(window.location.search).get('rol');

    const usuarioEsAdmin =
        isAdmin === true ||
        isAdmin === 1 ||
        isAdmin === '1' ||
        isAdmin === 'true' ||
        isAdmin === 'admin' ||
        isAdmin === 'administrador' ||
        rolURL === 'admin' ||
        rolURL === '1';

    const sidebarSoloIconos = sidebarCollapsed && !sidebarMobileOpen;
    const mostrarTextoSidebar = !sidebarSoloIconos;

    const irAlPortalPrincipal = () => {
        const esLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (esLocal) {
            window.location.href = 'http://siec.infinityfreeapp.com/vistas/roles/index.php';
            return;
        }
        window.location.href = '/vistas/roles/index.php';
    };

    const irAlPanelAdmin = () => {
        const esLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (esLocal) {
            window.location.href = 'http://siec.infinityfreeapp.com/vistas/admin/admin.php';
            return;
        }
        window.location.href = '/vistas/admin/admin.php';
    };

    const manejarSidebar = () => {
        if (window.innerWidth < 768) {
            setSidebarMobileOpen(prev => !prev);
            return;
        }
        setSidebarCollapsed(prev => !prev);
    };

    const cerrarSidebarMobile = () => {
        setSidebarMobileOpen(false);
    };

    const cambiarAreaSidebar = (area) => {
        setAreaSidebar(area);
        setSidebarMobileOpen(false);
    };

    const abrirMenuPrincipal = () => {
        setSidebarMobileOpen(false);
        setVistaActiva('menu');
    };

    if (vistaActiva === 'menu') {
        return (
            <MenuPrincipal
                setVistaActiva={setVistaActiva}
                isAdmin={usuarioEsAdmin}
                setMensaje={setMensaje}
            />
        );
    }

    if (vistaActiva === 'subir') {
        return <MenuCarga setVistaActiva={setVistaActiva} setMensaje={setMensaje} />;
    }

    if (vistaActiva === 'subir_ce') {
        return (
            <ModuloCargaCE
                setVistaActiva={setVistaActiva}
                setMensaje={setMensaje}
                mensaje={mensaje}
                cargarDatos={cargarDatos}
            />
        );
    }

    if (vistaActiva === 'subir_cirugias') {
        return (
            <ModuloCargaCirugias
                setVistaActiva={setVistaActiva}
                setMensaje={setMensaje}
                mensaje={mensaje}
            />
        );
    }
    if (vistaActiva === 'subir_hosp') {
        return (
            <ModuloCargaHosp
                setVistaActiva={setVistaActiva}
                setMensaje={setMensaje}
                mensaje={mensaje}
                cargarDatos={cargarDatos}
            />
        );
    }

    if (vistaActiva === 'catalogos') {
        return <AdministradorCatalogos setVistaActiva={setVistaActiva} />;
    }

    return (
        <div className="flex min-h-screen md:h-screen bg-slate-50 overflow-x-hidden md:overflow-hidden font-sans relative">

            {/* FONDO OSCURO EN MÓVIL */}
            {sidebarMobileOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 md:hidden"
                    onClick={cerrarSidebarMobile}
                />
            )}

            {/* PANEL LATERAL */}
            <aside
                className={`
                bg-[#822626] text-slate-100 flex flex-col shrink-0 shadow-xl
                fixed md:relative inset-y-0 left-0 z-40 md:z-20
                transition-all duration-300 ease-in-out
                w-72 ${sidebarSoloIconos ? 'md:w-20' : 'md:w-64'}
                ${sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}
            >
                <div className="h-16 flex items-center justify-between border-b border-[#6b1f1f] shrink-0 px-3">
                    <button
                        onClick={irAlPortalPrincipal}
                        className={`
                        h-11 rounded-xl flex items-center transition-all text-white
                        hover:bg-[#6b1f1f] font-bold text-sm
                        ${sidebarSoloIconos ? 'w-full justify-center px-0' : 'flex-1 justify-start px-3 gap-3'}
                    `}
                        title="Volver al inicio"
                    >
                        <Home size={20} className="shrink-0" />
                        {mostrarTextoSidebar && (
                            <span className="whitespace-nowrap">Volver al Inicio</span>
                        )}
                    </button>

                    <button
                        onClick={cerrarSidebarMobile}
                        className="md:hidden ml-2 h-11 w-11 flex items-center justify-center rounded-xl hover:bg-[#6b1f1f] transition-colors text-white"
                        title="Cerrar menú"
                    >
                        <X size={20} />
                    </button>
                </div>
                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-2 overflow-x-hidden custom-scrollbar">

                    {/* Consulta Externa */}
                    <button
                        onClick={() => cambiarAreaSidebar('consulta_externa')}
                        className={`w-full flex items-center rounded-xl transition-all ${sidebarSoloIconos ? 'justify-center p-3' : 'px-4 py-3 gap-3'} ${areaSidebar === 'consulta_externa' ? 'bg-[#6b1f1f] text-white font-bold shadow-md border-l-4 border-white' : 'hover:bg-[#962e2e] text-red-100 border-l-4 border-transparent'}`}
                    >
                        <Stethoscope size={20} className="shrink-0" />
                        {mostrarTextoSidebar && (
                            <span className="whitespace-nowrap">Consulta Externa Esp</span>
                        )}
                    </button>

                    {/* Paramédicos */}
                    <button
                        onClick={() => cambiarAreaSidebar('paramedicos')}
                        className={`w-full flex items-center rounded-xl transition-all ${sidebarSoloIconos ? 'justify-center p-3' : 'px-4 py-3 gap-3'} ${areaSidebar === 'paramedicos' ? 'bg-[#6b1f1f] text-white font-bold shadow-md border-l-4 border-white' : 'hover:bg-[#962e2e] text-red-100 border-l-4 border-transparent'}`}
                    >
                        <Ambulance size={20} className="shrink-0" />
                        {mostrarTextoSidebar && (
                            <span className="whitespace-nowrap">Paramédicos</span>
                        )}
                    </button>

                    {/* Cirugías */}
                    <button
                        onClick={() => cambiarAreaSidebar('cirugias')}
                        className={`w-full flex items-center rounded-xl transition-all ${sidebarSoloIconos ? 'justify-center p-3' : 'px-4 py-3 gap-3'} ${areaSidebar === 'cirugias' ? 'bg-[#6b1f1f] text-white font-bold shadow-md border-l-4 border-white' : 'hover:bg-[#962e2e] text-red-100 border-l-4 border-transparent'}`}
                    >
                        <Syringe size={20} className="shrink-0" />
                        {mostrarTextoSidebar && (
                            <span className="whitespace-nowrap">Cirugías</span>
                        )}
                    </button>

                    {/* Hospitalización */}
                    <button
                        onClick={() => cambiarAreaSidebar('hospitalizacion')}
                        className={`w-full flex items-center rounded-xl transition-all ${sidebarSoloIconos ? 'justify-center p-3' : 'px-4 py-3 gap-3'} ${areaSidebar === 'hospitalizacion' ? 'bg-[#6b1f1f] text-white font-bold shadow-md border-l-4 border-white' : 'hover:bg-[#962e2e] text-red-100 border-l-4 border-transparent'}`}
                    >
                        <Bed size={20} className="shrink-0" />
                        {mostrarTextoSidebar && (
                            <span className="whitespace-nowrap">Hospitalización</span>
                        )}
                    </button>

                    {/* Urgencias */}
                    <button
                        onClick={() => cambiarAreaSidebar('urgencias')}
                        className={`w-full flex items-center rounded-xl transition-all ${sidebarSoloIconos ? 'justify-center p-3' : 'px-4 py-3 gap-3'} ${areaSidebar === 'urgencias' ? 'bg-[#6b1f1f] text-white font-bold shadow-md border-l-4 border-white' : 'hover:bg-[#962e2e] text-red-100 border-l-4 border-transparent'}`}
                    >
                        <Siren size={20} className="shrink-0" />
                        {mostrarTextoSidebar && (
                            <span className="whitespace-nowrap">Urgencias</span>
                        )}
                    </button>

                </nav>
                <div className="p-3 border-t border-[#6b1f1f] flex flex-col gap-2 shrink-0">
                    <button
                        onClick={() => setMostrarTablas(!mostrarTablas)}
                        className={`w-full flex items-center rounded-xl transition-all ${sidebarSoloIconos ? 'justify-center p-3' : 'px-4 py-3 gap-3'} ${mostrarTablas ? 'bg-[#5e1919] text-white shadow-inner' : 'hover:bg-[#962e2e] text-red-100'}`}
                        title={mostrarTablas ? 'Ocultar tablas' : 'Mostrar tablas'}
                    >
                        <TableProperties size={20} className="shrink-0" />
                        {mostrarTextoSidebar && (
                            <span className="whitespace-nowrap font-bold text-sm">
                                {mostrarTablas ? 'Ocultar Tablas' : 'Mostrar Tablas'}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={handleDescargarExcel}
                        className={`flex items-center transition-all duration-300 ease-in-out bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md ${sidebarSoloIconos
                            ? 'justify-center p-3'
                            : 'justify-start gap-3 px-4 py-3'
                            }`}
                        title="Descargar reporte"
                    >
                        <Download size={20} className="shrink-0" />
                        {mostrarTextoSidebar && (
                            <span className="font-bold text-sm whitespace-nowrap">
                                Descargar Reporte
                            </span>
                        )}
                    </button>

                    {usuarioEsAdmin && (
                        <>
                            <button
                                onClick={abrirMenuPrincipal}
                                className={`w-full flex items-center bg-slate-800 hover:bg-slate-900 text-white rounded-xl transition-colors font-bold text-sm ${sidebarSoloIconos
                                    ? 'justify-center p-3'
                                    : 'justify-start gap-3 px-4 py-3'
                                    }`}
                                title="Actualizar bases de datos"
                            >
                                <Database size={20} className="shrink-0" />
                                {mostrarTextoSidebar && (
                                    <span className="whitespace-nowrap">
                                        Actualizar Bases de Datos
                                    </span>
                                )}
                            </button>

                            <button
                                onClick={irAlPanelAdmin}
                                className={`w-full flex items-center bg-[#6b1f1f] hover:bg-[#5e1919] text-white rounded-xl transition-colors font-bold text-sm ${sidebarSoloIconos
                                    ? 'justify-center p-3'
                                    : 'justify-start gap-3 px-4 py-3'
                                    }`}
                                title="Volver al panel de admin"
                            >
                                <Home size={20} className="shrink-0" />
                                {mostrarTextoSidebar && (
                                    <span className="whitespace-nowrap">
                                        Volver al Panel Admin
                                    </span>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </aside>

            {/* ÁREA PRINCIPAL */}
            <div className="flex-1 flex flex-col min-h-screen md:h-screen overflow-hidden relative">
                <header className="bg-white border-b border-slate-200 shrink-0 px-4 md:px-8 py-3 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 z-10 transition-all duration-300 min-h-[70px]">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={manejarSidebar}
                            className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                            title={sidebarMobileOpen ? 'Cerrar menú lateral' : sidebarSoloIconos ? 'Expandir menú lateral' : 'Abrir o contraer menú lateral'}
                        >
                            <span className="md:hidden flex items-center">
                                {sidebarMobileOpen ? <X size={22} /> : <Menu size={22} />}
                            </span>

                            <span className="hidden md:flex items-center">
                                {sidebarSoloIconos ? <PanelLeftOpen size={22} /> : <PanelLeftClose size={22} />}
                            </span>
                        </button>
                        <div>
    <h1 className="text-xl md:text-2xl font-black text-slate-800 capitalize">
        {areaSidebar.replace('_', ' ')}
    </h1>
</div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                        {mostrarFiltrosGlobales && hayDatosParaFiltrosActuales && (
                            <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1.5 border border-slate-200 shadow-inner flex-wrap w-full xl:w-auto">
                                <Filter size={14} className="text-[#822626] ml-2 hidden sm:block" />

                                <span className="font-bold text-slate-500 text-[10px] uppercase ml-1">
                                    {areaSidebar === 'hospitalizacion' ? 'Año:' : 'Año:'}
                                </span>
                                <select className="bg-transparent font-bold text-[#822626] text-sm outline-none cursor-pointer pr-1" value={anioSeleccionado} onChange={e => setAnioSeleccionado(e.target.value)}>
                                    <option value="todos">Todos</option>
                                    {aniosFiltroActual.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>

                                <div className="w-px h-4 bg-slate-300 mx-1"></div>

                                <span className="font-bold text-slate-500 text-[10px] uppercase">
                                    {areaSidebar === 'hospitalizacion' ? 'Mes:' : 'Mes:'}
                                </span>
                                <select className="bg-transparent font-bold text-[#822626] text-sm outline-none cursor-pointer pr-1" value={mesSeleccionado} onChange={e => setMesSeleccionado(e.target.value)}>
                                    <option value="todos">Todos</option>
                                    {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                    <option disabled>──────────</option>
                                    <option value="rango">Rango...</option>
                                </select>

                                {mesSeleccionado === 'rango' && (
                                    <>
                                        <div className="w-px h-4 bg-slate-300 mx-1"></div>
                                        <span className="font-bold text-slate-500 text-[10px] uppercase">De:</span>
                                        <select className="bg-transparent font-bold text-[#822626] text-sm outline-none cursor-pointer" value={mesInicio} onChange={e => setMesInicio(Number(e.target.value))}>
                                            {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                        </select>
                                        <span className="text-slate-400 font-bold">-</span>
                                        <span className="font-bold text-slate-500 text-[10px] uppercase">A:</span>
                                        <select className="bg-transparent font-bold text-[#822626] text-sm outline-none cursor-pointer" value={mesFin} onChange={e => setMesFin(Number(e.target.value))}>
                                            {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                        </select>
                                    </>
                                )}

                                <div className="w-px h-4 bg-slate-300 mx-1"></div>
                                <span className="font-bold text-slate-500 text-[10px] uppercase">División:</span>
                                <select className="bg-transparent font-bold text-[#822626] text-sm outline-none cursor-pointer pr-1 max-w-[100px] sm:max-w-[150px] truncate" value={divisionSeleccionada} onChange={e => setDivisionSeleccionada(e.target.value)}>
                                    <option value="todas">Todas</option>
                                    {divisionesFiltroActual.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>

                                {!(areaSidebar === 'cirugias' && !opcionesFiltrosCirugias.cargado) && (
                                    <>
                                        <div className="w-px h-4 bg-slate-300 mx-1"></div>
                                        <span className="font-bold text-slate-500 text-[10px] uppercase">Especialidad:</span>
                                        <select
                                            className="bg-transparent font-bold text-[#822626] text-sm outline-none cursor-pointer pr-1 max-w-[100px] sm:max-w-[150px] truncate"
                                            value={especialidadSeleccionada}
                                            onChange={e => setEspecialidadSeleccionada(e.target.value)}
                                        >
                                            <option value="todas">Todas</option>
                                            {especialidadesFiltroActual.map(e => (
                                                <option key={e} value={e}>{e}</option>
                                            ))}
                                        </select>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-slate-50">

                    {/* SECCIÓN 1: CONSULTA EXTERNA */}
                    <div style={{
                        display: areaSidebar === 'consulta_externa' ? 'block' : 'none',
                        visibility: areaSidebar === 'consulta_externa' ? 'visible' : 'hidden',
                        position: areaSidebar === 'consulta_externa' ? 'relative' : 'absolute',
                        left: areaSidebar === 'consulta_externa' ? '0' : '-9999px',
                        width: '100%'
                    }}>
                        {cargandoDatos ? (
                            <div className="flex justify-center items-center py-20 text-[#822626] font-bold"><Activity className="animate-spin mr-3" /> Calculando estadísticas...</div>
                        ) : error ? (
                            <div className="text-red-600 font-bold text-center py-20">{error}</div>
                        ) : datosFiltrados.length === 0 && tablaConsultasEspecialidadPeriodo.filas.length === 0 ? (
                            <div className="text-center p-16 border-2 border-dashed border-slate-300 rounded-2xl text-slate-400 mt-10">
                                <Activity size={48} className="mx-auto mb-4 opacity-50" />
                                <p className="font-bold text-lg">No hay datos para esta selección</p>
                                <p className="text-sm">Intenta cambiando el filtro de fecha o eligiendo otra área.</p>
                            </div>
                        ) : (
                            <div className="max-w-[1600px] mx-auto w-full pb-8">
                                <div className="flex justify-between items-center mb-4 gap-4 w-full">
                                    <button
                                        onClick={() => setOrdenInverso(!ordenInverso)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-bold text-sm transition-all shadow-sm ${ordenInverso
                                            ? 'bg-slate-700 text-white border-slate-700 hover:bg-slate-800'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                            }`}
                                        title="Alternar entre mayor y menor productividad"
                                    >
                                        <BarChart2
                                            size={16}
                                            className={`transition-transform duration-300 ${ordenInverso ? 'rotate-180' : ''}`}
                                        />
                                        {ordenInverso ? 'Mostrando: Menor Productividad' : 'Mostrando: Mayor Productividad'}
                                    </button>

                                    <p className="text-sm font-bold text-slate-500 bg-white shadow-sm px-4 py-2 rounded-lg border border-slate-200 inline-flex items-center gap-2">
                                        <Activity size={16} className="text-[#822626]" />
                                        Actualizado hasta: <span className="text-[#822626] font-black">{ultimaFechaBD}</span>
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-[#822626]">
                                        <div className="flex items-center gap-3 text-slate-500 mb-2"><Users size={18} /><h3 className="text-xs font-bold uppercase tracking-widest">Total Consultas</h3></div>
                                        <p className="text-4xl font-black text-[#822626]">{kpis.total.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                                        <div className="flex items-center gap-3 text-slate-500 mb-2"><CalendarCheck size={18} /><h3 className="text-xs font-bold uppercase tracking-widest">Citados</h3></div>
                                        <p className="text-4xl font-black text-slate-700">{kpis.citados.toLocaleString()}</p>
                                        <div className="flex flex-col mt-5 pt-4 border-t border-slate-100">
                                            <span className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Espontáneos</span>
                                            <p className="text-4xl font-black text-[#822626]">{kpis.espontaneos.toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                                        <div className="flex items-center gap-3 text-slate-500 mb-2"><Clock size={18} /><h3 className="text-xs font-bold uppercase tracking-widest">Primera Vez</h3></div>
                                        <p className="text-4xl font-black text-[#c2410c]">{kpis.primeraVez.toLocaleString()}</p>
                                        <div className="flex flex-col mt-5 pt-4 border-t border-slate-100">
                                            <span className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Subsecuentes</span>
                                            <p className="text-4xl font-black text-[#822626]">{kpis.subsecuentes.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>

                                {tablaConsultasEspecialidadPeriodo.filas.length > 0 && (
                                    <div id="tablaE_especialidades_periodo" className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mb-6">
                                        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3 mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-slate-100 p-2 rounded-lg"><TableProperties size={22} className="text-[#822626]" /></div>
                                                <div>
                                                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Consultas por Especialidad (incluye Paramedicos y Urgencias)</h3>
                                                    <p className="text-xs text-slate-500">Resumen general por anio / periodo</p>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center justify-start xl:justify-end gap-2">
                                                <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
                                                    <Filter size={15} className="text-[#822626]" />
                                                    <select
                                                        className="bg-transparent font-bold text-slate-700 text-xs outline-none cursor-pointer max-w-[220px]"
                                                        value={divisionTablaEspecialidad}
                                                        onChange={e => setDivisionTablaEspecialidad(e.target.value)}
                                                    >
                                                        <option value="todas">Todas las divisiones</option>
                                                        {divisionesTablaEspecialidadPeriodo.map(division => (
                                                            <option key={division} value={division}>{division}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={exportarTablaConsultasEspecialidadPeriodo}
                                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#822626] text-white text-xs font-black shadow-sm hover:bg-[#6b1f1f] transition-colors"
                                                >
                                                    <Download size={15} />
                                                    Descargar tabla
                                                </button>

                                                <span className="text-xs font-black text-[#822626] bg-slate-100 px-3 py-2 rounded-full">
                                                    {tablaConsultasEspecialidadPeriodo.totalGeneral.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3 mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                                            <span>Origen:</span>
                                            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-300"></span>Consulta externa</span>
                                            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>Paramedicos</span>
                                            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-500"></span>Urgencias</span>
                                        </div>

                                        <div className="w-full overflow-x-auto custom-scrollbar border border-slate-200 rounded-xl shadow-sm">
                                            <table className="min-w-max w-full text-[11px] text-left border-collapse">
                                                <thead className="text-slate-700">
                                                    <tr className="bg-slate-100">
                                                        <th rowSpan={3} className="p-3 border border-slate-300 bg-slate-200 sticky left-0 z-40 uppercase text-xs font-black" style={{ minWidth: '120px', verticalAlign: 'middle' }}>Cve Especialidad</th>
                                                        <th rowSpan={3} className="p-3 border border-slate-300 bg-slate-200 sticky z-30 uppercase text-xs font-black" style={{ left: '120px', minWidth: '320px', verticalAlign: 'middle' }}>Descripcion</th>
                                                        {tablaConsultasEspecialidadPeriodo.periodos.map(periodo => (
                                                            <th key={periodo.key} className="px-3 py-2 border border-slate-300 text-center text-[10px] uppercase tracking-wide font-black text-slate-500">Anio / Periodo</th>
                                                        ))}
                                                        <th rowSpan={3} className="p-3 border border-slate-300 bg-[#822626] text-white sticky right-0 z-30 text-right uppercase text-xs font-black" style={{ minWidth: '90px', verticalAlign: 'middle' }}>Total</th>
                                                    </tr>
                                                    <tr className="bg-slate-50">
                                                        {tablaConsultasEspecialidadPeriodo.periodos.map(periodo => (
                                                            <th key={`${periodo.key}-anio`} className="px-3 py-2 border border-slate-300 text-center font-black text-slate-700">{periodo.anio}</th>
                                                        ))}
                                                    </tr>
                                                    <tr className="bg-white">
                                                        {tablaConsultasEspecialidadPeriodo.periodos.map(periodo => (
                                                            <th key={`${periodo.key}-mes`} className="px-3 py-2 border border-slate-300 text-center font-black text-[#822626]" style={{ minWidth: '76px' }}>{periodo.etiqueta}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {tablaConsultasEspecialidadPeriodo.filas.map(fila => (
                                                        <tr key={`${fila.cve}-${fila.descripcion}`} className="hover:bg-slate-50 transition-colors">
                                                            <td className="p-3 border border-slate-200 bg-white sticky left-0 z-20 font-bold text-slate-700 shadow-[4px_0_10px_rgba(0,0,0,0.03)]">{fila.cve || ''}</td>
                                                            <td className="p-3 border border-slate-200 bg-white sticky z-10 font-semibold text-slate-700 shadow-[4px_0_10px_rgba(0,0,0,0.03)]" style={{ left: '120px' }}>
                                                                <div className="flex items-center gap-2">
                                                                    <span>{fila.descripcion}</span>
                                                                    <div className="flex items-center gap-1 shrink-0">
                                                                        {(fila.origenes?.paramedicos || 0) > 0 && (
                                                                            <span
                                                                                className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100"
                                                                                title={`Paramedicos: ${(fila.origenes?.paramedicos || 0).toLocaleString()}`}
                                                                            ></span>
                                                                        )}
                                                                        {(fila.origenes?.urgencias || 0) > 0 && (
                                                                            <span
                                                                                className="h-2.5 w-2.5 rounded-full bg-orange-500 ring-2 ring-orange-100"
                                                                                title={`Urgencias: ${(fila.origenes?.urgencias || 0).toLocaleString()}`}
                                                                            ></span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            {tablaConsultasEspecialidadPeriodo.periodos.map(periodo => {
                                                                const valor = fila.conteos[periodo.key] || 0;
                                                                return (
                                                                    <td key={`${fila.cve}-${fila.descripcion}-${periodo.key}`} className={`px-3 py-2 border border-slate-200 text-center ${valor > 0 ? 'font-bold text-slate-700' : 'text-slate-300'}`}>
                                                                        {valor > 0 ? valor.toLocaleString() : ''}
                                                                    </td>
                                                                );
                                                            })}
                                                            <td className="p-3 border border-slate-200 bg-slate-100 sticky right-0 z-10 font-black text-right text-slate-900 shadow-[-4px_0_10px_rgba(0,0,0,0.03)]">{fila.total.toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot className="sticky bottom-0 z-20">
                                                    <tr>
                                                        <td className="p-3 border border-slate-300 bg-slate-200 sticky left-0 z-40 uppercase text-xs font-black text-slate-800">Total</td>
                                                        <td className="p-3 border border-slate-300 bg-slate-200 sticky z-30 uppercase text-xs font-black text-slate-800" style={{ left: '120px' }}>Total</td>
                                                        {tablaConsultasEspecialidadPeriodo.periodos.map(periodo => (
                                                            <td key={`${periodo.key}-total`} className="px-3 py-2 border border-slate-300 bg-slate-100 text-center font-black text-[#822626]">
                                                                {(tablaConsultasEspecialidadPeriodo.totalesPorPeriodo[periodo.key] || 0).toLocaleString()}
                                                            </td>
                                                        ))}
                                                        <td className="p-3 border border-slate-300 bg-[#822626] text-white sticky right-0 z-30 font-black text-right text-sm">{tablaConsultasEspecialidadPeriodo.totalGeneral.toLocaleString()}</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                )}
                                <div id="graficoE_1" className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-100 pb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-blue-50 p-2 rounded-lg"><Target size={24} className="text-blue-700" /></div>
                                            <div>
                                                <h3 className="font-bold text-slate-800 uppercase tracking-wide">Cumplimiento de Meta (Semanal)</h3>
                                                <p className="text-xs text-slate-500">Objetivo directivo vs consultas otorgadas.</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-2 border border-slate-200">
                                            <select
                                                className="bg-transparent font-bold text-slate-700 text-sm outline-none cursor-pointer"
                                                value={mesGraficoMeta}
                                                onChange={e => {
                                                    const nuevoMes = Number(e.target.value);
                                                    setMesGraficoMeta(nuevoMes);
                                                    setMesSeleccionado(String(nuevoMes)); // Actualiza el filtro global
                                                }}
                                            >
                                                {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                            </select>

                                            <div className="w-px h-4 bg-slate-300"></div>

                                            <select
                                                className="bg-transparent font-bold text-slate-700 text-sm outline-none cursor-pointer"
                                                value={anioGraficoMeta}
                                                onChange={e => {
                                                    const nuevoAnio = Number(e.target.value);
                                                    setAnioGraficoMeta(nuevoAnio);
                                                    setAnioSeleccionado(String(nuevoAnio)); // Actualiza el filtro global
                                                }}
                                            >
                                                {aniosFiltroActual.map(a => <option key={a} value={a}>{a}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="relative min-h-[300px] w-full"><Line data={chartMetas} options={chartOptionsLine} /></div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <div id="graficoE_2" className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col h-full min-h-[300px]">
                                        <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide mb-4">
                                            {chartDivisiones.mostrandoEspecialidades ? 'Distribución por Especialidad Específica' : 'Distribución por División Específica'}
                                        </h3>

                                        <div className="relative flex-1 min-h-[220px]">
                                            <Bar data={chartDivisiones} options={{ maintainAspectRatio: false }} />
                                        </div>

                                        {mostrarTablas && (
                                            <TablaDatos
                                                titulo1={chartDivisiones.mostrandoEspecialidades ? 'Especialidad' : 'División'}
                                                titulo2="Consultas"
                                                labels={chartDivisiones.labels}
                                                data={chartDivisiones.datasets[0]?.data || []}
                                                dataPV={chartDivisiones.dataPV}
                                                dataSub={chartDivisiones.dataSub}
                                            />
                                        )}
                                    </div>
                                    <div id="graficoE_3" className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col h-full min-h-[300px]">
                                        <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide mb-4">Consultas por Turno</h3>
                                        <div className="relative flex-1 min-h-[220px]"><Doughnut data={chartTurnos} options={{ maintainAspectRatio: false }} /></div>
                                        {mostrarTablas && <TablaDatos titulo1="Turno" titulo2="Consultas" labels={chartTurnos.labels} data={chartTurnos.datasets[0]?.data || []} dataPV={chartTurnos.dataPV} dataSub={chartTurnos.dataSub} />}
                                    </div>
                                </div>

                                <div id="graficoE_4" className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col mb-6">
                                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-4">
                                        <div>
                                            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Top 20 Productividad por Médico</h3>
                                            <p className="text-xs text-slate-500 mt-1">El Excel incluye todos los médicos agrupados del filtro.</p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
                                                <Filter size={15} className="text-[#822626]" />
                                                <select
                                                    className="bg-transparent font-bold text-slate-700 text-xs outline-none cursor-pointer max-w-[220px]"
                                                    value={divisionTopMedicos}
                                                    onChange={e => setDivisionTopMedicos(e.target.value)}
                                                >
                                                    <option value="todas">Todas las divisiones</option>
                                                    {divisionesTopConsulta.map(division => (
                                                        <option key={division} value={division}>{division}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={exportarTopMedicos}
                                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#822626] text-white text-xs font-black shadow-sm hover:bg-[#6b1f1f] transition-colors"
                                            >
                                                <Download size={15} />
                                                Descargar tabla
                                            </button>
                                            <span className="text-xs font-black text-[#822626] bg-slate-100 px-3 py-2 rounded-full">
                                                {rankingMedicosCompleto.length.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="h-[400px] overflow-x-auto"><div style={{ minWidth: anchoDinamico(chartMedicos.labels.length), height: '100%' }}><Bar data={chartMedicos} options={chartOptionsVertical} /></div></div>
                                    {mostrarTablas && <TablaDatos titulo1="Médico" tituloExtra="Especialidad" titulo2="Consultas" labels={chartMedicos.labels} dataExtra={chartMedicos.dataExtra} data={chartMedicos.datasets[0]?.data || []} dataPV={chartMedicos.dataPV} dataSub={chartMedicos.dataSub} />}
                                </div>

                                <div id="graficoE_5" className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col mb-6">
                                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-4">
                                        <div>
                                            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Top 20 Diagnósticos Principales</h3>
                                            <p className="text-xs text-slate-500 mt-1">El Excel incluye todos los diagnósticos agrupados del filtro.</p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
                                                <Filter size={15} className="text-[#822626]" />
                                                <select
                                                    className="bg-transparent font-bold text-slate-700 text-xs outline-none cursor-pointer max-w-[220px]"
                                                    value={divisionTopDiagnosticos}
                                                    onChange={e => setDivisionTopDiagnosticos(e.target.value)}
                                                >
                                                    <option value="todas">Todas las divisiones</option>
                                                    {divisionesTopConsulta.map(division => (
                                                        <option key={division} value={division}>{division}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={exportarTopDiagnosticos}
                                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#822626] text-white text-xs font-black shadow-sm hover:bg-[#6b1f1f] transition-colors"
                                            >
                                                <Download size={15} />
                                                Descargar tabla
                                            </button>
                                            <span className="text-xs font-black text-[#822626] bg-slate-100 px-3 py-2 rounded-full">
                                                {rankingDiagnosticosCompleto.length.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="h-[400px] overflow-x-auto"><div style={{ minWidth: anchoDinamico(chartDiagnosticos.labels.length), height: '100%' }}><Bar data={chartDiagnosticos} options={chartOptionsVertical} /></div></div>
                                    {mostrarTablas && <TablaDatos titulo1="Diagnóstico" tituloExtra="CIE-10" titulo2="Frecuencia" labels={chartDiagnosticos.labels} dataExtra={chartDiagnosticos.dataExtra} data={chartDiagnosticos.datasets[0]?.data || []} dataPV={chartDiagnosticos.dataPV} dataSub={chartDiagnosticos.dataSub} />}
                                </div>
                                <div id="graficoE_6" className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col">
                                    <h3 className="font-bold text-slate-700 text-sm uppercase mb-4">Distribución por Consultorio</h3>
                                    <div className="h-[400px] overflow-x-auto"><div style={{ minWidth: anchoDinamico(chartConsultorios.labels.length), height: '100%' }}><Bar data={chartConsultorios} options={chartOptionsVertical} /></div></div>
                                    {mostrarTablas && <TablaDatos titulo1="Consultorio" titulo2="Consultas" labels={chartConsultorios.labels} data={chartConsultorios.datasets[0]?.data || []} dataPV={chartConsultorios.dataPV} dataSub={chartConsultorios.dataSub} />}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* SECCIÓN 2: PARAMÉDICOS */}
                    <div style={{
                        display: areaSidebar === 'paramedicos' ? 'block' : 'none',
                        visibility: areaSidebar === 'paramedicos' ? 'visible' : 'hidden',
                        position: areaSidebar === 'paramedicos' ? 'relative' : 'absolute',
                        left: areaSidebar === 'paramedicos' ? '0' : '-9999px',
                        width: '100%'
                    }}>
                        <TableroParamedicos
                            datos={paramedicosParaTablero}
                            diccionarioMedicos={diccionarioMedicos}
                            diccionarioCIE={diccionarioCIE}
                            diccionarioEspecialidades={diccionarioEspecialidades}
                            mostrarTablas={mostrarTablas}
                            setExportData={setDatosParamedicos}
                        />
                    </div>

                    {/* SECCIÓN 3: URGENCIAS */}
                    <div style={{
                        display: areaSidebar === 'urgencias' ? 'block' : 'none',
                        visibility: areaSidebar === 'urgencias' ? 'visible' : 'hidden',
                        position: areaSidebar === 'urgencias' ? 'relative' : 'absolute',
                        left: areaSidebar === 'urgencias' ? '0' : '-9999px',
                        width: '100%'
                    }}>
                        <TableroUrgencias
                            datos={urgenciasParaTablero}
                            diccionarioMedicos={diccionarioMedicos}
                            diccionarioCIE={diccionarioCIE}
                            diccionarioEspecialidades={diccionarioEspecialidades}
                            mostrarTablas={mostrarTablas}
                            setExportData={setDatosUrgencias}
                        />
                    </div>

                    {/* SECCIÓN 4: CIRUGIAS */}
                    <div style={{
                        display: areaSidebar === 'cirugias' ? 'block' : 'none',
                        visibility: areaSidebar === 'cirugias' ? 'visible' : 'hidden',
                        position: areaSidebar === 'cirugias' ? 'relative' : 'absolute',
                        left: areaSidebar === 'cirugias' ? '0' : '-9999px',
                        width: '100%'
                    }}>
                        <TableroCirugias
                            mostrarTablas={mostrarTablas}
                            setExportData={setDatosCirugias}
                            setOpcionesFiltros={setOpcionesFiltrosCirugias}
                            anioSeleccionado={anioSeleccionado}
                            mesSeleccionado={mesSeleccionado}
                            mesInicio={mesInicio}
                            mesFin={mesFin}
                            divisionSeleccionada={divisionSeleccionada}
                            especialidadSeleccionada={especialidadSeleccionada}
                        />
                    </div>

                    {/* SECCIÓN 5: HOSPITALIZACION CONFIGURADA EN SEGUNDO PLANO Y SIN PARÁMETROS BASURA */}
                    <div style={{
                        display: areaSidebar === 'hospitalizacion' ? 'block' : 'none',
                        visibility: areaSidebar === 'hospitalizacion' ? 'visible' : 'hidden',
                        position: areaSidebar === 'hospitalizacion' ? 'relative' : 'absolute',
                        left: areaSidebar === 'hospitalizacion' ? '0' : '-9999px',
                        width: '100%'
                    }}>
                        {cargandoHospitalizacion ? (
                            <div className="flex justify-center items-center py-20 text-emerald-600 font-bold">
                                <Activity className="animate-spin mr-3" /> Cargando registros de Hospitalización...
                            </div>
                        ) : (
                            <TableroHospitalizacion
                                datos={datosHospitalizacionFiltrados}
                                mostrarTablas={mostrarTablas}
                                setExportData={setDatosHospitalizacion}
                            />
                        )}
                    </div>

                    {/* MENSAJE DE EN CONSTRUCCIÓN */}
                    {!['consulta_externa', 'paramedicos', 'urgencias', 'cirugias', 'hospitalizacion'].includes(areaSidebar) && (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 p-16 border-2 border-dashed border-slate-300 rounded-3xl bg-slate-100/50">
                            <Activity size={64} className="mb-6 opacity-40 text-[#822626]" />
                            <h2 className="text-2xl font-black text-slate-500 mb-2">Módulo en Construcción</h2>
                            <p className="text-center max-w-md">El área de <strong>{areaSidebar.replace('_', ' ')}</strong> está siendo preparada.</p>
                        </div>
                    )}

                </main>
            </div>
        </div>
    );
}
