import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import axios from "axios";
import localforage from "localforage";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import IndicadoresHosp from "./IndicadoresHosp.jsx";
import {
  Target,
  Calendar,
  PieChart,
  Activity,
  LayoutDashboard,
  Users,
  FileText,
  Filter,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Menu,
  Download,
} from "lucide-react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

// ==========================================
// CONFIGURACIÓN GLOBAL DE GRÁFICAS (FUENTE)
// ==========================================
ChartJS.defaults.font.family =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
ChartJS.defaults.color = "#475569";

const MESES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

// ==========================================
// FUNCIONES UTILITARIAS INDEPENDIENTES
// ==========================================
const obtenerDiasOperativos = (mesSeleccionado, anioSeleccionado) => {
  const anioAnterior =
    mesSeleccionado === 0 ? anioSeleccionado - 1 : anioSeleccionado;
  const mesAnterior = mesSeleccionado === 0 ? 11 : mesSeleccionado - 1;
  const inicio = new Date(anioAnterior, mesAnterior, 26, 12, 0, 0);
  const fin = new Date(anioSeleccionado, mesSeleccionado, 25, 12, 0, 0);

  const dias = [];
  let actual = new Date(inicio);
  while (actual <= fin) {
    dias.push(new Date(actual));
    actual.setDate(actual.getDate() + 1);
  }
  return dias;
};

// ==========================================
// ALGORITMO DE CALENDARIO OPERATIVO
// Regla: S1 (26 al domingo), Intermedias (Lun-Dom), Final (hasta el 25)
// ==========================================
const generarCalendarioIMSS = (mesSeleccionado, anioSeleccionado) => {
  const anioAnterior =
    mesSeleccionado === 0 ? anioSeleccionado - 1 : anioSeleccionado;
  const mesAnterior = mesSeleccionado === 0 ? 11 : mesSeleccionado - 1;

  // Rango Operativo estricto
  const fechaInicio = new Date(anioAnterior, mesAnterior, 26, 12, 0, 0);
  const fechaFin = new Date(anioSeleccionado, mesSeleccionado, 25, 12, 0, 0);

  let semanas = [];
  let fechaActual = new Date(fechaInicio);
  let numeroSemana = 1;
  let diasDeEstaSemana = [];

  while (fechaActual <= fechaFin) {
    const yyyy = fechaActual.getFullYear();
    const mm = String(fechaActual.getMonth() + 1).padStart(2, "0");
    const dd = String(fechaActual.getDate()).padStart(2, "0");
    const iso = `${yyyy}-${mm}-${dd}`;

    diasDeEstaSemana.push(iso);

    // REGLA DE CORTE:
    // Se cierra la semana si es DOMINGO o si es el DÍA 25 (fin de mes operativo)
    const esDomingo = fechaActual.getDay() === 0;
    const esDia25 = fechaActual.getDate() === 25;

    if (esDomingo || esDia25) {
      semanas.push({
        semana: numeroSemana,
        diasISO: [...diasDeEstaSemana],
      });

      numeroSemana++;
      diasDeEstaSemana = [];
    }

    fechaActual.setDate(fechaActual.getDate() + 1);
  }

  const nombresMeses = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];

  // Generar etiquetas visuales descriptivas
  semanas.forEach((s) => {
    if (s.diasISO.length > 0) {
      const firstISO = s.diasISO[0].split("-");
      const lastISO = s.diasISO[s.diasISO.length - 1].split("-");

      const d1 = firstISO[2];
      const m1 = nombresMeses[parseInt(firstISO[1], 10) - 1];

      const d2 = lastISO[2];
      const m2 = nombresMeses[parseInt(lastISO[1], 10) - 1];

      s.label = `S${s.semana} (${d1}-${m1} al ${d2}-${m2})`;
    }
  });

  return semanas;
};

const nivelarTexto = (texto) =>
  String(texto || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const encontrarFecha = (obj) => {
  const keys = Object.keys(obj);
  for (let k of keys) {
    const lk = k.toLowerCase();
    if (lk === "fecha" || lk === "fecha_cita" || lk === "fecha_consulta")
      return obj[k];
  }
  for (let k of keys) {
    const lk = k.toLowerCase();
    if (
      lk.includes("fecha") &&
      !lk.includes("nacimiento") &&
      !lk.includes("alta")
    )
      return obj[k];
  }
  return null;
};

const extraerFechaLimpiaYMD = (f_val) => {
  if (!f_val) return null;
  if (f_val instanceof Date && !isNaN(f_val)) {
    return {
      anio: f_val.getFullYear(),
      mes: f_val.getMonth() + 1,
      dia: f_val.getDate(),
    };
  }
  let str = String(f_val).trim().split("T")[0].split(" ")[0];
  const p = str.includes("-") ? str.split("-") : str.split("/");
  if (p.length >= 3) {
    let a, m, d;
    if (p[0].length === 4) {
      a = p[0];
      m = p[1];
      d = p[2];
    } else {
      a = p[2];
      m = p[1];
      d = p[0];
    }
    if (!isNaN(a) && !isNaN(m) && !isNaN(d)) {
      return {
        anio: parseInt(a, 10),
        mes: parseInt(m, 10),
        dia: parseInt(d, 10),
      };
    }
  }
  const fallback = new Date(f_val);
  if (!isNaN(fallback)) {
    return {
      anio: fallback.getFullYear(),
      mes: fallback.getMonth() + 1,
      dia: fallback.getDate(),
    };
  }
  return null;
};

// ==========================================
// ELIMINADOR DE DUPLICADOS (VERSIÓN PURA)
// ==========================================
const unificarNombreConsultorio = (crudo) => {
  if (!crudo) return "SIN ESPECIFICAR";
  let str = String(crudo).toUpperCase().trim();
  if (
    str === "" ||
    str === "0" ||
    str === "NULL" ||
    str === "SIN ESPECIFICAR"
  ) {
    return "SIN ESPECIFICAR";
  }
  if (str.endsWith(".0")) str = str.replace(".0", "");
  str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let raiz = str.replace(/CONSULTORIO/g, "").trim();
  if (raiz === "") return "SIN ESPECIFICAR";
  if (!isNaN(raiz)) {
    return `CONSULTORIO ${parseInt(raiz, 10)}`;
  }
  return str;
};

const normalizarTurno = (crudo) => {
  const valor = nivelarTexto(crudo);

  if (!valor || valor === "0" || valor === "NULL") return "SIN TURNO";
  if (valor.includes("MATUT")) return "MATUTINO";
  if (valor.includes("VESPERT")) return "VESPERTINO";
  if (valor.includes("NOCT")) return "NOCTURNO";
  if (valor.includes("JORNADA") || valor.includes("ACUMUL")) return "JORNADA ACUMULADA";

  return valor;
};

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
const ModuloIndicadores = ({
  isAdmin = false,
  setVistaActiva,
  onVolverInicio,
}) => {
  const [tabActiva, setTabActiva] = useState("mensual");
  const [seccionSidebar, setSeccionSidebar] = useState("consulta_externa");
  const [cargandoDatos, setCargandoDatos] = useState(true);

  const [datos, setDatos] = useState([]);
  const [diccionarioEspecialidades, setDiccionarioEspecialidades] = useState(
    {},
  );
  const [diccionarioMedicos, setDiccionarioMedicos] = useState({});

  const fechaActual = new Date();
  const [mesGraficoMeta, setMesGraficoMeta] = useState(fechaActual.getMonth());
  const [anioGraficoMeta, setAnioGraficoMeta] = useState(
    fechaActual.getFullYear(),
  );

  const [sidebarColapsada, setSidebarColapsada] = useState(false);
  const [sidebarMovilAbierta, setSidebarMovilAbierta] = useState(false);
  const [descargandoReporte, setDescargandoReporte] = useState(false);
  const [descargandoDetalle, setDescargandoDetalle] = useState(false);
  const [consultorioSeleccionado, setConsultorioSeleccionado] =
    useState("todos");
  const graficaMetasRef = useRef(null);

  const regresarAlInicio = () => {
    if (typeof onVolverInicio === "function") {
      onVolverInicio();
      return;
    }

    if (typeof setVistaActiva === "function") {
      setVistaActiva("menu");
      return;
    }

    window.history.back();
  };

  const cargarDatos = async () => {
    try {
      const datosLocales = await localforage.getItem(
        "cache_productividad_vencer",
      );
      if (datosLocales && datosLocales.length > 0) setDatos(datosLocales);
      const resDatos = await axios.get("/api/api_productividad.php");
      if (Array.isArray(resDatos.data)) setDatos(resDatos.data);
    } catch (err) {
      console.error(err);
    } finally {
      setCargandoDatos(false);
    }
  };

  const cargarCatalogos = async () => {
    try {
      const marcaTiempo = new Date().getTime();
      const [resEsp, resMedicos] = await Promise.all([
        axios.get(`/api/api_crud_especialidades.php?t=${marcaTiempo}`),
        axios.get(`/api/api_medicos.php?t=${marcaTiempo}`),
      ]);

      if (Array.isArray(resEsp.data)) {
        const diccEsp = resEsp.data.reduce((acc, item) => {
          const clave = String(item.clave).trim().toUpperCase();
          if (clave)
            acc[clave] = { nombre: item.nombre, division: item.division };
          return acc;
        }, {});
        setDiccionarioEspecialidades(diccEsp);
      }

      if (Array.isArray(resMedicos.data)) {
        const diccMedicos = resMedicos.data.reduce((acc, item) => {
          const matricula = String(item.matricula || "")
            .trim()
            .replace(/\.0$/, "")
            .replace(/\s/g, "");
          const nombre = String(item.nombre || "").trim();
          if (matricula && nombre) acc[matricula] = nombre;
          return acc;
        }, {});
        setDiccionarioMedicos(diccMedicos);
      }
    } catch (err) {
      console.error("Error cargando catálogos", err);
    }
  };

  useEffect(() => {
    cargarDatos();
    cargarCatalogos();
  }, []);

  const traducirEspecialidad = useCallback((valorCrudo) => {
    if (!valorCrudo) return "Desconocida";
    let espRaw = String(valorCrudo)
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    espRaw = espRaw
      .replace("COD:", "")
      .replace("COD: ", "")
      .replace(".0", "")
      .trim();
    const respaldoInquebrantable = {
      6300: "TRABAJO SOCIAL",
      6600: "PSICOLOGIA",
      6900: "NUTRICION",
      5001: "CONSULTAS EN PRIMER CONTACTO",
      A600: "URGENCIAS TOCO CIRUGIA",
    };
    return (
      diccionarioEspecialidades[espRaw]?.nombre ||
      respaldoInquebrantable[espRaw] ||
      espRaw
    );
  }, [diccionarioEspecialidades]);

  const aniosDisponibles = useMemo(() => {
    const anios = new Set();
    datos.forEach((d) => {
      let a = d.anio || d.Anio || d.ANIO || d.año || d.Año || d.AÑO;
      if (a) anios.add(String(a));
    });
    return [...anios].sort().reverse();
  }, [datos]);

  const datosConsultaExterna = useMemo(() => {
    if (!datos || datos.length === 0) return [];
    return datos.filter((d) => {
      const espNivelada = nivelarTexto(d.especialidad || d.ESPECIALIDAD);
      const espTraducida = nivelarTexto(
        traducirEspecialidad(d.especialidad || d.ESPECIALIDAD),
      );
      const ignorar = [
        "TOCO",
        "PRIMER CONTACTO",
        "5001",
        "6300",
        "6600",
        "6900",
        "NUTRICION",
        "INHALOTERAPIA",
        "FONIATRIA",
        "TRABAJO SOCIAL",
        "PSICOLOGIA",
        "REHABILITACION",
        "URGENCIAS",
        "ADMISION CONTINUA",
        "OBSERVACION",
        "CHOQUE",
      ];
      return !ignorar.some(
        (ig) => espNivelada.includes(ig) || espTraducida.includes(ig),
      );
    });
  }, [datos, traducirEspecialidad]);

  // ==========================================
  // TABLA: FUSIÓN DE DATOS Y ORDEN ALFANUMÉRICO
  // ==========================================
  const tablaProductividadConsultorios = useMemo(() => {
    if (
      seccionSidebar !== "consulta_externa" ||
      datosConsultaExterna.length === 0
    )
      return null;

    const dias = obtenerDiasOperativos(mesGraficoMeta, anioGraficoMeta);

    // Formato estricto YYYY-MM-DD
    const diasISO = dias.map((d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    });

    const consultoriosMap = {};
    let totalGeneral = 0;

    // Asegurar que "SIN ESPECIFICAR" siempre exista
    if (!consultoriosMap["SIN ESPECIFICAR"]) {
      consultoriosMap["SIN ESPECIFICAR"] = {};
      diasISO.forEach((iso) => (consultoriosMap["SIN ESPECIFICAR"][iso] = 0));
    }

    // Iterar TODO el universo de Consulta Externa (Citados y No Citados)
    datosConsultaExterna.forEach((d) => {
      const f = encontrarFecha(d);
      const fechaObj = extraerFechaLimpiaYMD(f);

      if (fechaObj) {
        const fechaISO = `${fechaObj.anio}-${String(fechaObj.mes).padStart(2, "0")}-${String(fechaObj.dia).padStart(2, "0")}`;

        if (diasISO.includes(fechaISO)) {
          let idCrudo =
            d.nombre_consultorio ||
            d.NOMBRE_CONSULTORIO ||
            d.consultorio ||
            d.CONSULTORIO ||
            d.Consultorio ||
            d.desc_consultorio;

          if (!idCrudo || String(idCrudo).trim() === "") {
            idCrudo = "SIN ESPECIFICAR";
          }

          const nombreUnificado = unificarNombreConsultorio(idCrudo);

          if (!consultoriosMap[nombreUnificado]) {
            consultoriosMap[nombreUnificado] = {};
            diasISO.forEach(
              (iso) => (consultoriosMap[nombreUnificado][iso] = 0),
            );
          }

          consultoriosMap[nombreUnificado][fechaISO]++;
          totalGeneral++;
        }
      }
    });

    const filas = Object.entries(consultoriosMap)
      .map(([nombre, conteos]) => {
        return {
          nombre: nombre,
          conteos,
          totalFila: Object.values(conteos).reduce((a, b) => a + b, 0),
        };
      })
      .filter((f) => f.nombre !== "SIN ESPECIFICAR" || f.totalFila > 0)
      .sort((a, b) =>
        b.nombre.localeCompare(a.nombre, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );

    const totalesPorDia = {};
    diasISO.forEach((iso) => {
      totalesPorDia[iso] = filas.reduce(
        (sum, fila) => sum + (fila.conteos[iso] || 0),
        0,
      );
    });

    return { dias, diasISO, filas, totalGeneral, totalesPorDia };
  }, [datosConsultaExterna, mesGraficoMeta, anioGraficoMeta, seccionSidebar]);

  const detalleDiarioConsultorios = useMemo(() => {
    if (
      seccionSidebar !== "consulta_externa" ||
      datosConsultaExterna.length === 0
    ) {
      return null;
    }

    const diasISO = new Set(
      obtenerDiasOperativos(mesGraficoMeta, anioGraficoMeta).map((dia) => {
        const anio = dia.getFullYear();
        const mes = String(dia.getMonth() + 1).padStart(2, "0");
        const numeroDia = String(dia.getDate()).padStart(2, "0");
        return `${anio}-${mes}-${numeroDia}`;
      }),
    );
    const agrupados = new Map();
    const consultorios = new Set();

    datosConsultaExterna.forEach((registro) => {
      const fechaObj = extraerFechaLimpiaYMD(encontrarFecha(registro));
      if (!fechaObj) return;

      const fechaISO = `${fechaObj.anio}-${String(fechaObj.mes).padStart(2, "0")}-${String(fechaObj.dia).padStart(2, "0")}`;
      if (!diasISO.has(fechaISO)) return;

      const consultorio = unificarNombreConsultorio(
        registro.nombre_consultorio ||
          registro.NOMBRE_CONSULTORIO ||
          registro.consultorio ||
          registro.CONSULTORIO ||
          registro.Consultorio ||
          registro.desc_consultorio,
      );
      const matricula = String(
        registro.matricula_medico ||
          registro.MATRICULA_MEDICO ||
          registro.matricula ||
          "",
      )
        .trim()
        .replace(/\.0$/, "")
        .replace(/\s/g, "");
      const medico =
        registro.nombre_medico ||
        registro.NOMBRE_MEDICO ||
        diccionarioMedicos[matricula] ||
        (matricula ? `Matr. ${matricula}` : "SIN MÉDICO ESPECIFICADO");
      const especialidad = traducirEspecialidad(
        registro.especialidad || registro.ESPECIALIDAD,
      );
      const turno = normalizarTurno(
        registro.turno ||
          registro.TURNO ||
          registro.desc_turno ||
          registro.DESCRIPCION_TURNO,
      );
      const clave = [
        fechaISO,
        consultorio,
        turno,
        matricula || medico,
        especialidad,
      ].join("|");

      consultorios.add(consultorio);
      if (!agrupados.has(clave)) {
        const fecha = new Date(
          fechaObj.anio,
          fechaObj.mes - 1,
          fechaObj.dia,
          12,
        );
        agrupados.set(clave, {
          fechaISO,
          fechaTexto: fecha.toLocaleDateString("es-MX", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
          diaSemana: fecha.toLocaleDateString("es-MX", { weekday: "long" }),
          consultorio,
          turno,
          medico: String(medico).trim(),
          especialidad,
          consultas: 0,
        });
      }

      agrupados.get(clave).consultas++;
    });

    const opcionesConsultorio = [...consultorios].sort((a, b) =>
      a.localeCompare(b, "es", { numeric: true, sensitivity: "base" }),
    );
    const filtroActivo = opcionesConsultorio.includes(consultorioSeleccionado)
      ? consultorioSeleccionado
      : "todos";
    const filas = [...agrupados.values()]
      .filter(
        (fila) =>
          filtroActivo === "todos" || fila.consultorio === filtroActivo,
      )
      .sort(
        (a, b) =>
          a.fechaISO.localeCompare(b.fechaISO) ||
          a.consultorio.localeCompare(b.consultorio, "es", { numeric: true }) ||
          a.turno.localeCompare(b.turno, "es") ||
          a.medico.localeCompare(b.medico, "es"),
      );

    return {
      filas,
      opcionesConsultorio,
      filtroActivo,
      totalConsultas: filas.reduce((total, fila) => total + fila.consultas, 0),
    };
  }, [
    datosConsultaExterna,
    mesGraficoMeta,
    anioGraficoMeta,
    seccionSidebar,
    diccionarioMedicos,
    traducirEspecialidad,
    consultorioSeleccionado,
  ]);
  // ==========================================
  // GRÁFICA DE METAS SEMANALES
  // ==========================================
  const chartMetas = useMemo(() => {
    if (
      seccionSidebar !== "consulta_externa" ||
      datosConsultaExterna.length === 0
    )
      return null;

    const semanasOperativas = generarCalendarioIMSS(
      mesGraficoMeta,
      anioGraficoMeta,
    );
    const labelsSemanas = semanasOperativas.map((s) => s.label);

    const citasPorSemana = new Array(semanasOperativas.length).fill(0);
    let metasPorSemana = new Array(semanasOperativas.length).fill(2646);
    if (Number(mesGraficoMeta) === 0 && metasPorSemana.length > 0)
      metasPorSemana[0] = 1134;

    // Creamos un diccionario ultra rápido y blindado (ej: "2026-03-30" => Semana 1)
    const mapaDiasASemana = {};
    semanasOperativas.forEach((sem, index) => {
      sem.diasISO.forEach((iso) => {
        mapaDiasASemana[iso] = index;
      });
    });

    datosConsultaExterna.forEach((d) => {
      const f = encontrarFecha(d);
      const fechaObj = extraerFechaLimpiaYMD(f);

      if (fechaObj) {
        const fechaISO = `${fechaObj.anio}-${String(fechaObj.mes).padStart(2, "0")}-${String(fechaObj.dia).padStart(2, "0")}`;

        // Si esta fecha exacta le pertenece a una de nuestras semanas, la sumamos a la gráfica
        if (mapaDiasASemana[fechaISO] !== undefined) {
          const indiceSemana = mapaDiasASemana[fechaISO];
          citasPorSemana[indiceSemana]++;
        }
      }
    });

    return {
      labels: labelsSemanas,
      datasets: [
        {
          label: "Consultas Reales",
          data: citasPorSemana,
          borderColor: "#0d9488",
          backgroundColor: "rgba(13, 148, 136, 0.1)",
          borderWidth: 3,
          tension: 0.3,
          fill: true,
          pointBackgroundColor: "#0d9488",
          pointRadius: 5,
        },
        {
          label: "Meta Esperada",
          data: metasPorSemana,
          borderColor: "#64748b",
          backgroundColor: "transparent",
          borderDash: [5, 5],
          borderWidth: 2,
          tension: 0,
          pointRadius: 0,
          fill: false,
        },
      ],
    };
  }, [datosConsultaExterna, mesGraficoMeta, anioGraficoMeta, seccionSidebar]);

  const descargarReporteIndicadores = async () => {
    if (!chartMetas || !tablaProductividadConsultorios) return;

    setDescargandoReporte(true);

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "SIEC UMAE No. 48";
      workbook.created = new Date();

      const periodo = `${MESES[mesGraficoMeta]} ${anioGraficoMeta}`;
      const hoja = workbook.addWorksheet("Indicadores", {
        views: [{ state: "frozen", xSplit: 1, ySplit: 22 }],
        pageSetup: {
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
        },
      });

      hoja.mergeCells("A1:H1");
      const titulo = hoja.getCell("A1");
      titulo.value = "INDICADORES: CONSULTA EXTERNA";
      titulo.font = {
        bold: true,
        size: 18,
        color: { argb: "FFFFFFFF" },
      };
      titulo.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF047857" },
      };
      titulo.alignment = { horizontal: "center", vertical: "middle" };
      hoja.getRow(1).height = 30;

      hoja.mergeCells("A2:H2");
      const subtitulo = hoja.getCell("A2");
      subtitulo.value = `Periodo operativo: ${periodo}`;
      subtitulo.font = {
        bold: true,
        size: 12,
        color: { argb: "FF334155" },
      };
      subtitulo.alignment = { horizontal: "center" };

      hoja.mergeCells("A4:H4");
      const tituloGrafica = hoja.getCell("A4");
      tituloGrafica.value = "Cumplimiento de Metas Semanales";
      tituloGrafica.font = {
        bold: true,
        size: 14,
        color: { argb: "FF047857" },
      };

      const grafica = graficaMetasRef.current;
      if (grafica) {
        const imageId = workbook.addImage({
          base64: grafica.toBase64Image("image/png", 1),
          extension: "png",
        });
        hoja.addImage(imageId, {
          tl: { col: 0, row: 4 },
          ext: { width: 760, height: 300 },
        });
      }

      const filaInicioTabla = 22;
      const encabezados = [
        "Consultorio",
        ...tablaProductividadConsultorios.dias.map(
          (dia) => `${dia.getDate()} ${MESES[dia.getMonth()]}`,
        ),
        "Total",
      ];
      const filaEncabezado = hoja.getRow(filaInicioTabla);
      filaEncabezado.values = encabezados;
      filaEncabezado.height = 28;

      filaEncabezado.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF334155" },
        };
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFCBD5E1" } },
          left: { style: "thin", color: { argb: "FFCBD5E1" } },
          bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
          right: { style: "thin", color: { argb: "FFCBD5E1" } },
        };
      });

      tablaProductividadConsultorios.filas.forEach((fila, indice) => {
        const numeroFila = filaInicioTabla + 1 + indice;
        const valores = [
          fila.nombre,
          ...tablaProductividadConsultorios.diasISO.map(
            (iso) => fila.conteos[iso] || 0,
          ),
          fila.totalFila,
        ];
        const filaExcel = hoja.getRow(numeroFila);
        filaExcel.values = valores;

        filaExcel.eachCell((cell, numeroColumna) => {
          cell.alignment = {
            horizontal: numeroColumna === 1 ? "left" : "center",
            vertical: "middle",
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };

          if (numeroColumna === 1) {
            cell.font = { bold: true, color: { argb: "FF334155" } };
          } else if (numeroColumna === encabezados.length) {
            cell.font = { bold: true, color: { argb: "FF0F172A" } };
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF1F5F9" },
            };
          } else {
            const valor = Number(cell.value) || 0;
            let fondo = "FFFFFFFF";
            let texto = "FFCBD5E1";

            if (valor >= 24) {
              fondo = "FFD1FAE5";
              texto = "FF065F46";
            } else if (valor >= 16) {
              fondo = "FFFEF3C7";
              texto = "FF92400E";
            } else if (valor > 0) {
              fondo = "FFFFE4E6";
              texto = "FF9F1239";
            }

            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: fondo },
            };
            cell.font = { bold: valor > 0, color: { argb: texto } };
            if (valor === 0) cell.value = "-";
          }
        });
      });

      const filaTotalesNumero =
        filaInicioTabla + 1 + tablaProductividadConsultorios.filas.length;
      const filaTotales = hoja.getRow(filaTotalesNumero);
      filaTotales.values = [
        "TOTAL DIARIO",
        ...tablaProductividadConsultorios.diasISO.map(
          (iso) => tablaProductividadConsultorios.totalesPorDia[iso] || 0,
        ),
        tablaProductividadConsultorios.totalGeneral,
      ];
      filaTotales.eachCell((cell, numeroColumna) => {
        cell.font = {
          bold: true,
          color: {
            argb:
              numeroColumna === encabezados.length
                ? "FFFFFFFF"
                : "FF065F46",
          },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb:
              numeroColumna === encabezados.length
                ? "FF059669"
                : "FFECFDF5",
          },
        };
        cell.alignment = {
          horizontal: numeroColumna === 1 ? "left" : "center",
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FF94A3B8" } },
          left: { style: "thin", color: { argb: "FFCBD5E1" } },
          bottom: { style: "thin", color: { argb: "FF94A3B8" } },
          right: { style: "thin", color: { argb: "FFCBD5E1" } },
        };
      });

      hoja.getColumn(1).width = 25;
      for (let columna = 2; columna < encabezados.length; columna++) {
        hoja.getColumn(columna).width = 10;
      }
      hoja.getColumn(encabezados.length).width = 13;
      hoja.autoFilter = {
        from: { row: filaInicioTabla, column: 1 },
        to: {
          row: filaInicioTabla,
          column: encabezados.length,
        },
      };

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `Indicadores_Consulta_Externa_${MESES[mesGraficoMeta]}_${anioGraficoMeta}.xlsx`,
      );
    } catch (error) {
      console.error("Error al generar el reporte de indicadores:", error);
      alert("No se pudo generar el reporte. Intenta nuevamente.");
    } finally {
      setDescargandoReporte(false);
    }
  };

  const descargarDetalleConsultorio = async () => {
    if (!detalleDiarioConsultorios?.filas.length) return;

    setDescargandoDetalle(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "SIEC UMAE No. 48";
      workbook.created = new Date();
      const hoja = workbook.addWorksheet("Detalle consultorios", {
        views: [{ state: "frozen", ySplit: 5 }],
        pageSetup: {
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
        },
      });
      const periodo = `${MESES[mesGraficoMeta]} ${anioGraficoMeta}`;
      const filtro =
        detalleDiarioConsultorios.filtroActivo === "todos"
          ? "Todos los consultorios"
          : detalleDiarioConsultorios.filtroActivo;

      hoja.mergeCells("A1:G1");
      hoja.getCell("A1").value = "ATENCIÓN DIARIA POR CONSULTORIO";
      hoja.getCell("A1").font = {
        bold: true,
        size: 18,
        color: { argb: "FFFFFFFF" },
      };
      hoja.getCell("A1").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF047857" },
      };
      hoja.getCell("A1").alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      hoja.getRow(1).height = 30;

      hoja.mergeCells("A2:G2");
      hoja.getCell("A2").value = `Periodo operativo: ${periodo} · Filtro: ${filtro}`;
      hoja.getCell("A2").font = {
        bold: true,
        size: 11,
        color: { argb: "FF334155" },
      };
      hoja.getCell("A2").alignment = { horizontal: "center" };

      hoja.mergeCells("A3:G3");
      hoja.getCell("A3").value =
        `Consultas incluidas: ${detalleDiarioConsultorios.totalConsultas.toLocaleString("es-MX")}`;
      hoja.getCell("A3").font = {
        bold: true,
        color: { argb: "FF047857" },
      };
      hoja.getCell("A3").alignment = { horizontal: "center" };

      const encabezados = [
        "Fecha",
        "Día",
        "Consultorio",
        "Turno",
        "Médico",
        "Especialidad",
        "Consultas",
      ];
      const filaEncabezado = hoja.getRow(5);
      filaEncabezado.values = encabezados;
      filaEncabezado.height = 26;
      filaEncabezado.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF334155" },
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "FFCBD5E1" } },
          left: { style: "thin", color: { argb: "FFCBD5E1" } },
          bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
          right: { style: "thin", color: { argb: "FFCBD5E1" } },
        };
      });

      detalleDiarioConsultorios.filas.forEach((fila, indice) => {
        const filaExcel = hoja.getRow(6 + indice);
        filaExcel.values = [
          fila.fechaISO,
          fila.diaSemana,
          fila.consultorio,
          fila.turno,
          fila.medico,
          fila.especialidad,
          fila.consultas,
        ];
        filaExcel.eachCell((cell, numeroColumna) => {
          cell.alignment = {
            horizontal: numeroColumna === 7 ? "center" : "left",
            vertical: "middle",
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };
          if (indice % 2 === 1) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF8FAFC" },
            };
          }
          if (numeroColumna === 7) {
            cell.font = { bold: true, color: { argb: "FF047857" } };
          }
        });
      });

      const filaTotal = hoja.getRow(6 + detalleDiarioConsultorios.filas.length);
      hoja.mergeCells(`A${filaTotal.number}:F${filaTotal.number}`);
      filaTotal.getCell(1).value = "TOTAL DE CONSULTAS";
      filaTotal.getCell(7).value = detalleDiarioConsultorios.totalConsultas;
      filaTotal.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF059669" },
        };
        cell.alignment = { horizontal: "center" };
      });

      [14, 14, 24, 18, 34, 32, 12].forEach((ancho, indice) => {
        hoja.getColumn(indice + 1).width = ancho;
      });
      hoja.autoFilter = {
        from: { row: 5, column: 1 },
        to: { row: 5, column: encabezados.length },
      };

      const buffer = await workbook.xlsx.writeBuffer();
      const nombreFiltro = filtro
        .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+/g, "_")
        .replace(/^_|_$/g, "");
      saveAs(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `Detalle_Consultorios_${nombreFiltro}_${MESES[mesGraficoMeta]}_${anioGraficoMeta}.xlsx`,
      );
    } catch (error) {
      console.error("Error al generar el detalle por consultorio:", error);
      alert("No se pudo generar el reporte del consultorio.");
    } finally {
      setDescargandoDetalle(false);
    }
  };
  return (
    <div className="min-h-screen bg-slate-50 md:flex md:h-screen md:overflow-hidden">
      {/* SIDEBAR MENÚ LATERAL */}
      {/* SIDEBAR MENÚ LATERAL COLAPSABLE */}
      {sidebarMovilAbierta && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 h-full w-full bg-slate-950/40 backdrop-blur-[1px]"
            aria-label="Cerrar menu de categorias"
            onClick={() => setSidebarMovilAbierta(false)}
          />

          <aside className="relative h-full w-[280px] max-w-[86vw] bg-white border-r border-slate-200 shadow-2xl flex flex-col">
            <div className="p-4 flex items-center justify-between border-b border-slate-200 shrink-0 min-h-[64px]">
              <button
                type="button"
                onClick={regresarAlInicio}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-emerald-700 uppercase tracking-wider hover:bg-emerald-50 transition-colors"
              >
                <ChevronLeft size={16} />
                Inicio
              </button>
              <button
                type="button"
                onClick={() => setSidebarMovilAbierta(false)}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                aria-label="Cerrar menu de categorias"
                title="Cerrar menu"
              >
                <ChevronLeft size={22} />
              </button>
            </div>

            <nav className="flex-1 p-4 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setSeccionSidebar("hosp");
                  setSidebarMovilAbierta(false);
                }}
                title="Indicadores HOSP"
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${seccionSidebar === "hosp" ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:bg-blue-50 hover:text-blue-700"}`}
              >
                <LayoutDashboard size={20} className="shrink-0" />
                <span>Indicadores HOSP</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSeccionSidebar("consulta_externa");
                  setSidebarMovilAbierta(false);
                }}
                title="Indicadores Consulta Externa"
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${seccionSidebar === "consulta_externa" ? "bg-emerald-600 text-white shadow-lg" : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"}`}
              >
                <Users size={20} className="shrink-0" />
                <span>Ind. Consulta Externa</span>
              </button>
            </nav>
          </aside>
        </div>
      )}
      <aside
        className={`hidden md:flex ${sidebarColapsada ? "w-20" : "w-64"} bg-white border-r border-slate-200 flex-col z-20 shrink-0 transition-all duration-300 ease-in-out relative`}
      >
        {/* BOTÓN FLOTANTE PARA COLAPSAR/EXPANDIR */}
        <button
          onClick={() => setSidebarColapsada(!sidebarColapsada)}
          className="absolute -right-3 top-8 bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 rounded-full p-1 shadow-md transition-colors z-50 flex items-center justify-center"
        >
          {sidebarColapsada ? (
            <ChevronRight size={16} />
          ) : (
            <ChevronLeft size={16} />
          )}
        </button>

        {/* TÍTULO DE LA SECCIÓN */}
        <div
          className={`p-4 transition-all duration-300 ${sidebarColapsada ? "px-3" : ""}`}
        >
          <button
            type="button"
            onClick={regresarAlInicio}
            title="Regresar al inicio"
            className={`w-full flex items-center rounded-xl text-sm font-bold transition-all text-emerald-700 hover:bg-emerald-50 ${
              sidebarColapsada ? "justify-center p-3" : "gap-3 px-4 py-3"
            }`}
          >
            <ChevronLeft size={20} className="shrink-0" />
            {!sidebarColapsada && (
              <span className="whitespace-nowrap animate-in fade-in duration-300">
                Inicio
              </span>
            )}
          </button>
        </div>

        {/* BOTONES DE NAVEGACIÓN */}
        <nav className="flex-1 px-4 space-y-2">
          {/* Botón HOSP */}
          <button
            onClick={() => setSeccionSidebar("hosp")}
            title="Indicadores HOSP"
            className={`w-full flex items-center ${sidebarColapsada ? "justify-center p-3" : "gap-3 px-4 py-3"} rounded-xl text-sm font-medium transition-all ${seccionSidebar === "hosp" ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:bg-blue-50 hover:text-blue-700"}`}
          >
            <LayoutDashboard size={20} className="shrink-0" />
            {!sidebarColapsada && (
              <span className="whitespace-nowrap animate-in fade-in duration-300">
                Indicadores HOSP
              </span>
            )}
          </button>

          {/* Botón Consulta Externa */}
          <button
            onClick={() => setSeccionSidebar("consulta_externa")}
            title="Indicadores Consulta Externa"
            className={`w-full flex items-center ${sidebarColapsada ? "justify-center p-3" : "gap-3 px-4 py-3"} rounded-xl text-sm font-medium transition-all ${seccionSidebar === "consulta_externa" ? "bg-emerald-600 text-white shadow-lg" : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"}`}
          >
            <Users size={20} className="shrink-0" />
            {!sidebarColapsada && (
              <span className="whitespace-nowrap animate-in fade-in duration-300">
                Ind. Consulta Externa
              </span>
            )}
          </button>
        </nav>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 flex flex-col min-w-0 md:overflow-hidden relative">
        {/* CABECERA (HEADER) */}
        <header className="bg-white border-b border-slate-200 px-4 py-4 sm:px-6 lg:px-8 sm:py-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarMovilAbierta(true)}
              className="md:hidden flex items-center justify-center rounded-xl bg-emerald-600 p-2.5 text-white transition-colors hover:bg-emerald-700 shrink-0"
              aria-label="Abrir menu de categorias"
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-800 truncate">
                {seccionSidebar === "consulta_externa"
                  ? "Indicadores: Consulta Externa"
                  : "Indicadores: HOSP"}
              </h1>
            </div>
          </div>
          <div className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-xl shadow-inner border border-slate-200 lg:w-auto">
            <button
              onClick={() => setTabActiva("mensual")}
              className={`flex items-center justify-center gap-2 px-3 sm:px-6 py-2 rounded-lg text-sm font-bold transition-all ${tabActiva === "mensual" ? "bg-white text-emerald-700 shadow-md" : "text-slate-400"}`}
            >
              <Calendar size={16} /> Mensual
            </button>
            <button
              onClick={() => setTabActiva("acumulado")}
              className={`flex items-center justify-center gap-2 px-3 sm:px-6 py-2 rounded-lg text-sm font-bold transition-all ${tabActiva === "acumulado" ? "bg-white text-emerald-700 shadow-md" : "text-slate-400"}`}
            >
              <PieChart size={16} /> Acumulado
            </button>
          </div>
        </header>

        {/* ZONA DINÁMICA DE PANTALLAS */}
        <section className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
          {/* ESTADO 1: CARGANDO DATOS INICIALES */}
          {cargandoDatos && (
            <div className="flex flex-col justify-center items-center h-full text-emerald-600 font-bold">
              <Activity className="animate-spin mb-4" size={48} />
              <p>Cargando Indicadores...</p>
            </div>
          )}

          {/* ESTADO 2: DATOS LISTOS (Aquí se deciden las vistas) */}
          {!cargandoDatos && (
            <>
              {/* VISTA A: NUEVO MÓDULO HOSP */}
              {seccionSidebar === "hosp" && (
                <IndicadoresHosp
                  rolUsuario={isAdmin ? "admin" : "viewer"}
                  tabActiva={tabActiva}
                />
              )}

              {/* VISTA B: CONSULTA EXTERNA (Gráfica y Tabla) */}
              {seccionSidebar === "consulta_externa" &&
                chartMetas &&
                tablaProductividadConsultorios && (
                  <div className="space-y-4 sm:space-y-6 lg:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
                    {/* Gráfica de Metas */}
                    <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-sm">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-emerald-50 p-2 rounded-lg">
                            <Target size={24} className="text-emerald-600" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-800 text-base sm:text-lg">
                              Cumplimiento de Metas Semanales
                            </h3>
                            <p className="text-xs font-medium text-slate-500">
                              Calendario Operativo IMSS
                            </p>
                          </div>
                        </div>
                        <div className="flex w-full sm:w-auto flex-col sm:flex-row gap-2">
                          <div className="flex items-center justify-between sm:justify-start gap-2 bg-slate-50 rounded-lg p-2 border border-slate-200 shadow-inner">
                            <Filter size={16} className="text-slate-400 ml-1" />
                            <select
                              className="bg-transparent font-bold text-emerald-700 text-sm outline-none cursor-pointer"
                              value={mesGraficoMeta}
                              onChange={(e) =>
                                setMesGraficoMeta(Number(e.target.value))
                              }
                            >
                              {MESES.map((m, i) => (
                                <option key={i} value={i}>
                                  {m}
                                </option>
                              ))}
                            </select>
                            <div className="w-px h-5 bg-slate-300 mx-1"></div>
                            <select
                              className="bg-transparent font-bold text-emerald-700 text-sm outline-none cursor-pointer"
                              value={anioGraficoMeta}
                              onChange={(e) =>
                                setAnioGraficoMeta(Number(e.target.value))
                              }
                            >
                              {aniosDisponibles.map((a) => (
                                <option key={a} value={a}>
                                  {a}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={descargarReporteIndicadores}
                            disabled={descargandoReporte}
                            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
                            title="Descargar gráfica y tabla en Excel"
                          >
                            <Download
                              size={17}
                              className={
                                descargandoReporte ? "animate-bounce" : ""
                              }
                            />
                            {descargandoReporte
                              ? "Generando..."
                              : "Descargar reporte"}
                          </button>
                        </div>
                      </div>
                      <div className="h-64 sm:h-80 w-full">
                        <Line
                          ref={graficaMetasRef}
                          data={chartMetas}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: { position: "top", align: "end" },
                            },
                            scales: {
                              y: {
                                beginAtZero: true,
                                grid: { color: "#f8fafc" },
                              },
                              x: { grid: { display: false } },
                            },
                          }}
                        />
                      </div>
                    </div>

                    {/* Tabla de Productividad de Consultorios */}
                    <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3 mb-6">
                        <div className="bg-emerald-50 p-2 rounded-lg">
                          <ClipboardList
                            size={24}
                            className="text-emerald-600"
                          />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 text-base sm:text-lg">
                            Productividad Diaria por Consultorio
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>{" "}
                              Óptimo (≥24)
                            </span>
                            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                              <div className="w-2 h-2 rounded-full bg-amber-500"></div>{" "}
                              Regular (16-23)
                            </span>
                            <span className="flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                              <div className="w-2 h-2 rounded-full bg-rose-500"></div>{" "}
                              Bajo (1-15)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="w-full overflow-x-auto custom-scrollbar border rounded-2xl shadow-sm">
                        <table className="min-w-max text-left text-[11px] border-collapse">
                          <thead className="bg-slate-50 sticky top-0 z-20">
                            <tr>
                              <th className="p-3 border-b border-r font-black text-slate-600 bg-slate-100 sticky left-0 z-30 min-w-[140px] shadow-[4px_0_10px_rgba(0,0,0,0.03)]">
                                Consultorio
                              </th>
                              {tablaProductividadConsultorios.dias.map(
                                (d, i) => (
                                  <th
                                    key={i}
                                    className="p-2 border-b border-r border-slate-200/50 text-center min-w-[45px] font-bold text-slate-500"
                                  >
                                    {d.getDate()}
                                    <br />
                                    <span className="text-[9px] uppercase font-medium">
                                      {MESES[d.getMonth()]}
                                    </span>
                                  </th>
                                ),
                              )}
                              <th className="p-3 border-b border-l font-black text-slate-600 bg-slate-100 sticky right-0 z-30 shadow-[-4px_0_10px_rgba(0,0,0,0.03)]">
                                Total
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {tablaProductividadConsultorios.filas.map(
                              (fila, idx) => (
                                <tr
                                  key={idx}
                                  className="hover:bg-slate-50 transition-colors border-b border-slate-100 group"
                                >
                                  <td className="p-3 border-r font-bold text-slate-700 bg-white sticky left-0 z-10 group-hover:bg-slate-50 shadow-[4px_0_10px_rgba(0,0,0,0.03)] uppercase">
                                    {fila.nombre}
                                  </td>
                                  {tablaProductividadConsultorios.diasISO.map(
                                    (iso, i) => {
                                      const valor = fila.conteos[iso] || 0;
                                      let colorCelda = "text-slate-300";
                                      if (valor >= 24)
                                        colorCelda =
                                          "bg-emerald-100 text-emerald-800 font-black";
                                      else if (valor >= 16)
                                        colorCelda =
                                          "bg-amber-100 text-amber-800 font-black";
                                      else if (valor > 0)
                                        colorCelda =
                                          "bg-rose-100 text-rose-800 font-black";
                                      return (
                                        <td
                                          key={i}
                                          className={`p-2 text-center border-r border-slate-100/50 transition-colors ${colorCelda}`}
                                        >
                                          {valor > 0 ? valor : "-"}
                                        </td>
                                      );
                                    },
                                  )}
                                  <td className="p-3 border-l font-black text-slate-800 bg-slate-50 group-hover:bg-slate-100 sticky right-0 z-10 text-right shadow-[-4px_0_10px_rgba(0,0,0,0.03)]">
                                    {fila.totalFila}
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                          <tfoot className="bg-slate-100 font-black text-slate-800 sticky bottom-0 z-20 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
                            <tr>
                              <td className="p-3 border-t border-r sticky left-0 z-30 bg-slate-100 uppercase text-xs">
                                Total Diario
                              </td>
                              {tablaProductividadConsultorios.diasISO.map(
                                (iso, i) => (
                                  <td
                                    key={i}
                                    className="p-2 border-t border-r border-slate-200/50 text-center text-emerald-700"
                                  >
                                    {tablaProductividadConsultorios
                                      .totalesPorDia[iso] > 0
                                      ? tablaProductividadConsultorios
                                          .totalesPorDia[iso]
                                      : "-"}
                                  </td>
                                ),
                              )}
                              <td className="p-3 border-t border-l sticky right-0 z-30 bg-emerald-600 text-white text-right text-sm shadow-[-4px_0_10px_rgba(0,0,0,0.05)]">
                                {tablaProductividadConsultorios.totalGeneral.toLocaleString()}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                    {/* Detalle diario de médicos por consultorio */}
                    {detalleDiarioConsultorios && (
                      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                          <div className="flex items-start gap-3">
                            <div className="bg-emerald-50 p-2 rounded-lg">
                              <Users size={24} className="text-emerald-600" />
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-800 text-base sm:text-lg">
                                Atención Diaria por Consultorio
                              </h3>
                              <p className="text-xs font-medium text-slate-500 mt-1">
                                Médico y especialidad que atendieron durante el periodo operativo
                              </p>
                            </div>
                          </div>

                          <div className="flex w-full lg:w-auto flex-col sm:flex-row gap-2">
                            <label className="flex min-w-0 sm:min-w-[260px] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 shadow-inner">
                              <Filter size={16} className="shrink-0 text-slate-400" />
                              <span className="sr-only">Filtrar por consultorio</span>
                              <select
                                value={detalleDiarioConsultorios.filtroActivo}
                                onChange={(event) =>
                                  setConsultorioSeleccionado(event.target.value)
                                }
                                className="w-full cursor-pointer bg-transparent text-sm font-bold text-emerald-700 outline-none"
                              >
                                <option value="todos">Todos los consultorios</option>
                                {detalleDiarioConsultorios.opcionesConsultorio.map(
                                  (consultorio) => (
                                    <option key={consultorio} value={consultorio}>
                                      {consultorio}
                                    </option>
                                  ),
                                )}
                              </select>
                            </label>
                            <button
                              type="button"
                              onClick={descargarDetalleConsultorio}
                              disabled={
                                descargandoDetalle ||
                                detalleDiarioConsultorios.filas.length === 0
                              }
                              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Download
                                size={17}
                                className={
                                  descargandoDetalle ? "animate-bounce" : ""
                                }
                              />
                              {descargandoDetalle
                                ? "Generando..."
                                : "Descargar Excel"}
                            </button>
                          </div>
                        </div>

                        <div className="mb-4 flex flex-wrap gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                            {detalleDiarioConsultorios.filas.length.toLocaleString(
                              "es-MX",
                            )} grupos de atención
                          </span>
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                            {detalleDiarioConsultorios.totalConsultas.toLocaleString(
                              "es-MX",
                            )} consultas
                          </span>
                        </div>

                        <div className="max-h-[520px] w-full overflow-auto custom-scrollbar border rounded-2xl shadow-sm">
                          <table className="min-w-[1020px] w-full text-left text-xs border-collapse">
                            <thead className="sticky top-0 z-20 bg-slate-100 text-slate-600">
                              <tr>
                                <th className="p-3 border-b">Fecha</th>
                                <th className="p-3 border-b">Día</th>
                                <th className="p-3 border-b">Consultorio</th>
                                <th className="p-3 border-b">Turno</th>
                                <th className="p-3 border-b">Médico</th>
                                <th className="p-3 border-b">Especialidad</th>
                                <th className="p-3 border-b text-center">
                                  Consultas
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {detalleDiarioConsultorios.filas.map(
                                (fila, indice) => (
                                  <tr
                                    key={`${fila.fechaISO}-${fila.consultorio}-${fila.turno}-${fila.medico}-${fila.especialidad}`}
                                    className={`border-b border-slate-100 transition-colors hover:bg-emerald-50/50 ${indice % 2 === 1 ? "bg-slate-50/60" : "bg-white"}`}
                                  >
                                    <td className="p-3 whitespace-nowrap font-bold text-slate-700">
                                      {fila.fechaTexto}
                                    </td>
                                    <td className="p-3 capitalize text-slate-500">
                                      {fila.diaSemana}
                                    </td>
                                    <td className="p-3 font-bold text-emerald-700">
                                      {fila.consultorio}
                                    </td>
                                    <td className="p-3 font-bold text-slate-500">
                                      {fila.turno}
                                    </td>
                                    <td className="p-3 font-semibold text-slate-700">
                                      {fila.medico}
                                    </td>
                                    <td className="p-3 text-slate-600">
                                      {fila.especialidad}
                                    </td>
                                    <td className="p-3 text-center">
                                      <span className="inline-flex min-w-9 justify-center rounded-full bg-emerald-100 px-2 py-1 font-black text-emerald-800">
                                        {fila.consultas}
                                      </span>
                                    </td>
                                  </tr>
                                ),
                              )}
                            </tbody>
                          </table>

                          {detalleDiarioConsultorios.filas.length === 0 && (
                            <div className="p-10 text-center text-sm font-medium text-slate-400">
                              No hay atenciones para este consultorio en el periodo seleccionado.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

              {/* VISTA C: PANTALLA VACÍA (Si faltan datos) */}
              {seccionSidebar === "consulta_externa" &&
                (!chartMetas || !tablaProductividadConsultorios) && (
                  <div className="flex flex-col items-center justify-center min-h-[320px] md:h-full text-slate-300 text-center px-4">
                    <FileText size={64} className="mb-4 opacity-20" />
                    <p className="font-medium text-lg text-slate-400">
                      Selecciona una categoría para visualizar.
                    </p>
                  </div>
                )}
            </>
          )}
        </section>
      </main>
    </div>
  );
};

export default ModuloIndicadores;
