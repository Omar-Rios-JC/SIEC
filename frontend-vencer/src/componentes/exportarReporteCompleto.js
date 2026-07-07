import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const normalizarTexto = (valor) => String(valor ?? '').trim();

const obtenerCampoFlexible = (obj, campo) => {
    if (!obj || !campo) return undefined;

    const alias = {
        diagnostico: ['diagnostico', 'diagnostico_principal', 'desc_diag', 'DESC_DIAG', 'cie10'],
        medico: ['medico', 'nombre_medico', 'NOMBRE_MEDICO', 'nombreCirujano', 'cirujano'],
        especialidad: ['especialidad', 'ESPECIALIDAD', 'area', 'AREA'],
        division: ['division', 'Division', 'DIVISION', 'área', 'area', 'Área', 'AREA'],
        estatus: ['estatus', 'estatusOriginal', 'Estatus Qx'],
        sexo: ['sexo', 'Sexo'],
        concertada: ['concertada', 'Cirugía concertada', 'Cirugia concertada'],
        tipoSolicitud: ['tipoSolicitud', 'Tipo de solicitud'],
        sala: ['sala', 'Sala'],
        cie10: ['cie10', 'CIE10'],
        cie9: ['cie9', 'CIE9'],
        motivoCancelacion: ['motivoCancelacion', 'Motivo de cancelación', 'motivo de cancelacion'],
        ultimoMotivoSuspension: ['ultimoMotivoSuspension', 'Último motivo de suspensión', 'ultimo motivo de suspension'],
    };

    const candidatos = [campo, campo.toUpperCase(), ...(alias[campo] || [])];

    for (const c of candidatos) {
        if (obj[c] !== undefined && obj[c] !== null && String(obj[c]).trim() !== '') {
            return obj[c];
        }
    }

    return undefined;
};

// ==========================================
// RESUMEN PARA CONSULTA / PARAMÉDICOS / URGENCIAS
// ==========================================
const obtenerResumenAgregado = (datos, campoRequerido) => {
    if (!datos || datos.length === 0) return [];

    const resumen = {};
    let tPV = 0;
    let tSub = 0;

    datos.forEach(d => {
        let valor = obtenerCampoFlexible(d, campoRequerido);
        if (!valor || String(valor).trim() === '') valor = 'SIN ESPECIFICAR';

        if (!resumen[valor]) resumen[valor] = { pv: 0, sub: 0 };

        const esPV = String(d.primera_vez || d.PRIMERA_VEZ || '').toLowerCase().includes('primera') ||
            String(d.primera_vez || d.PRIMERA_VEZ) === '1';

        if (esPV) {
            resumen[valor].pv++;
            tPV++;
        } else {
            resumen[valor].sub++;
            tSub++;
        }
    });

    const filas = Object.entries(resumen).map(([nombre, conteo]) => ({
        categoria: nombre,
        pv: conteo.pv,
        sub: conteo.sub,
        indice: conteo.pv > 0 ? Number((conteo.sub / conteo.pv).toFixed(2)) : (conteo.sub > 0 ? '∞' : 0),
        total: conteo.pv + conteo.sub,
    }));

    filas.sort((a, b) => b.total - a.total);

    filas.push({
        categoria: 'TOTAL GENERAL',
        pv: tPV,
        sub: tSub,
        indice: tPV > 0 ? Number((tSub / tPV).toFixed(2)) : 0,
        total: tPV + tSub,
    });

    return filas;
};

// ==========================================
// RESUMEN SIMPLE PARA CIRUGÍAS / HOSPITALIZACIÓN
// ==========================================
const obtenerResumenSimple = (datos, campoRequerido) => {
    if (!datos || datos.length === 0) return [];

    const resumen = {};

    datos.forEach(d => {
        let valor = obtenerCampoFlexible(d, campoRequerido);
        valor = normalizarTexto(valor) || 'SIN ESPECIFICAR';
        resumen[valor] = (resumen[valor] || 0) + 1;
    });

    const filas = Object.entries(resumen)
        .map(([categoria, total]) => ({ categoria, total }))
        .sort((a, b) => b.total - a.total);

    const totalGeneral = filas.reduce((acc, fila) => acc + fila.total, 0);

    filas.push({
        categoria: 'TOTAL GENERAL',
        total: totalGeneral,
    });

    return filas;
};

const agregarGraficoExcel = async (workbook, sheet, elementId, excelCell) => {
    const elemento = document.getElementById(elementId);
    if (!elemento) return;

    try {
        const canvas = await html2canvas(elemento, {
            scale: 2,
            logging: false,
            useCORS: true,
            backgroundColor: '#ffffff',
        });

        const imageId = workbook.addImage({
            base64: canvas.toDataURL('image/png'),
            extension: 'png',
        });

        sheet.addImage(imageId, {
            tl: { col: excelCell.col, row: excelCell.row },
            ext: { width: 500, height: 300 },
        });
    } catch (err) {
        console.error(`Error al capturar ${elementId}:`, err);
    }
};

export const exportarReporteCompleto = async (
    externa = [],
    paramedicos = [],
    urgencias = [],
    cirugias = [],
    hospitalizacion = [],
) => {
    await sleep(500);

    const workbook = new ExcelJS.Workbook();

    const setearColumnas = (sheet) => {
        sheet.getColumn(1).width = 44;
        sheet.getColumn(2).width = 12;
        sheet.getColumn(3).width = 12;
        sheet.getColumn(4).width = 10;
        sheet.getColumn(5).width = 15;
        sheet.getColumn(7).width = 18;
        sheet.getColumn(8).width = 18;
        sheet.getColumn(9).width = 18;
    };

    const pintarHeader = (row) => {
        row.font = {
            bold: true,
            color: { argb: 'FFFFFF' },
        };

        row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '1E293B' },
        };
    };

    const agregarSeccion = async (
        sheet,
        tituloTabla,
        campoBD,
        elementId,
        datos,
        tipo = 'general'
    ) => {
        const startRow = sheet.rowCount > 0 ? sheet.rowCount + 2 : 1;
        let endRowTabla = startRow;

        if (campoBD && datos) {
            const filas = tipo === 'simple'
                ? obtenerResumenSimple(datos, campoBD)
                : obtenerResumenAgregado(datos, campoBD);

            const header = sheet.getRow(startRow);

            if (tipo === 'simple') {
                header.values = [tituloTabla, 'TOTAL'];
                pintarHeader(header);

                filas.forEach((f, idx) => {
                    const row = sheet.getRow(startRow + 1 + idx);
                    row.values = [f.categoria, f.total];

                    if (f.categoria === 'TOTAL GENERAL') {
                        row.font = { bold: true };
                        row.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'F1F5F9' },
                        };
                    }
                });
            } else {
                header.values = [tituloTabla, '1RA VEZ', 'SUBSEC.', 'ÍNDICE', 'TOTAL'];
                pintarHeader(header);

                filas.forEach((f, idx) => {
                    const row = sheet.getRow(startRow + 1 + idx);
                    row.values = [f.categoria, f.pv, f.sub, f.indice, f.total];

                    if (f.categoria === 'TOTAL GENERAL') {
                        row.font = { bold: true };
                        row.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'F1F5F9' },
                        };
                    }
                });
            }

            endRowTabla = sheet.rowCount;
        }

        if (elementId) {
            await agregarGraficoExcel(workbook, sheet, elementId, {
                col: 6,
                row: startRow - 1,
            });
        }

        // Esto evita que las tablas se encimen con las gráficas.
        const graficoOcupaHasta = startRow + 16;
        const filaFinalSeccion = Math.max(endRowTabla, graficoOcupaHasta);

        while (sheet.rowCount < filaFinalSeccion) {
            sheet.addRow([]);
        }

        sheet.addRow([]);
    };

    // ==========================================
    // HOJA 1: CONSULTA EXTERNA
    // ==========================================
    const sheetEx = workbook.addWorksheet('Consulta Externa');
    setearColumnas(sheetEx);

    await agregarSeccion(sheetEx, 'METAS', null, 'graficoE_1', externa);
    await agregarSeccion(sheetEx, 'DIVISIÓN', 'division', 'graficoE_2', externa);
    await agregarSeccion(sheetEx, 'TURNO', 'turno', 'graficoE_3', externa);
    await agregarSeccion(sheetEx, 'MÉDICO', 'medico', 'graficoE_4', externa);
    await agregarSeccion(sheetEx, 'DIAGNÓSTICO', 'diagnostico', 'graficoE_5', externa);
    await agregarSeccion(sheetEx, 'CONSULTORIO', 'consultorio', 'graficoE_6', externa);

    // ==========================================
    // HOJA 2: PARAMÉDICOS
    // ==========================================
    const sheetPa = workbook.addWorksheet('Paramédicos');
    setearColumnas(sheetPa);

    await agregarSeccion(sheetPa, 'TURNO', 'turno', 'graficoP_1', paramedicos);
    await agregarSeccion(sheetPa, 'ÁREA PARAMÉDICA', 'especialidad', 'graficoP_2', paramedicos);
    await agregarSeccion(sheetPa, 'ÁREA DETALLE', null, 'graficoP_3', paramedicos);
    await agregarSeccion(sheetPa, 'PERSONAL / MÉDICO', 'medico', 'graficoP_4', paramedicos);
    await agregarSeccion(sheetPa, 'DIAGNÓSTICO', 'diagnostico', 'graficoP_5', paramedicos);
    await agregarSeccion(sheetPa, 'CONSULTORIO', 'consultorio', 'graficoP_6', paramedicos);

    // ==========================================
    // HOJA 3: URGENCIAS
    // ==========================================
    const sheetUr = workbook.addWorksheet('Urgencias');
    setearColumnas(sheetUr);

    await agregarSeccion(sheetUr, 'TURNO', 'turno', 'graficoU_1', urgencias);
    await agregarSeccion(sheetUr, 'ÁREA URGENCIAS', 'especialidad', 'graficoU_2', urgencias);
    await agregarSeccion(sheetUr, 'MÉDICO', 'medico', 'graficoU_3', urgencias);
    await agregarSeccion(sheetUr, 'DIAGNÓSTICO', 'diagnostico', 'graficoU_4', urgencias);
    await agregarSeccion(sheetUr, 'CONSULTORIO', 'consultorio', 'graficoU_5', urgencias);

    // ==========================================
    // HOJA 4: CIRUGÍAS
    // ==========================================
    const sheetCi = workbook.addWorksheet('Cirugías');
    setearColumnas(sheetCi);

    await agregarSeccion(sheetCi, 'ESTATUS QUIRÚRGICO', 'estatus', 'graficoC_1', cirugias, 'simple');
    await agregarSeccion(sheetCi, 'SEXO', 'sexo', 'graficoC_2', cirugias, 'simple');
    await agregarSeccion(sheetCi, 'CIRUGÍA CONCERTADA', 'concertada', 'graficoC_3', cirugias, 'simple');
    await agregarSeccion(sheetCi, 'TIPO DE SOLICITUD', 'tipoSolicitud', 'graficoC_4', cirugias, 'simple');
    await agregarSeccion(sheetCi, 'TIEMPOS PROMEDIO', null, 'graficoC_5', cirugias);
    await agregarSeccion(sheetCi, 'CIRUJANO', 'nombreCirujano', 'graficoC_6', cirugias, 'simple');
    await agregarSeccion(sheetCi, 'DIVISIÓN', 'division', null, cirugias, 'simple');
    await agregarSeccion(sheetCi, 'ESPECIALIDAD', 'especialidad', 'graficoC_7', cirugias, 'simple');
    await agregarSeccion(sheetCi, 'PIRÁMIDE POBLACIONAL', null, 'graficoC_8', cirugias);
    await agregarSeccion(sheetCi, 'DÍAS DE DIFERIMIENTO', null, 'graficoC_9', cirugias);
    await agregarSeccion(sheetCi, 'MOTIVOS DE CANCELACIÓN', 'motivoCancelacion', 'graficoC_10', cirugias, 'simple');
    await agregarSeccion(sheetCi, 'MOTIVOS DE SUSPENSIÓN', 'ultimoMotivoSuspension', 'graficoC_11', cirugias, 'simple');
    await agregarSeccion(sheetCi, 'CIE10', 'cie10', 'graficoC_12', cirugias, 'simple');
    await agregarSeccion(sheetCi, 'CIE9', 'cie9', 'graficoC_13', cirugias, 'simple');
    await agregarSeccion(sheetCi, 'SALA', 'sala', 'graficoC_14', cirugias, 'simple');

    // ==========================================
    // HOJA 5: HOSPITALIZACIÓN
    // ==========================================
    if (hospitalizacion && hospitalizacion.length > 0) {
        const sheetHo = workbook.addWorksheet('Hospitalización');
        setearColumnas(sheetHo);

        await agregarSeccion(sheetHo, 'SERVICIO', 'servicio', null, hospitalizacion, 'simple');
        await agregarSeccion(sheetHo, 'ESPECIALIDAD', 'especialidad', null, hospitalizacion, 'simple');
    }

    const buffer = await workbook.xlsx.writeBuffer();

    saveAs(
        new Blob([buffer]),
        `Reporte_Ejecutivo_${new Date().toLocaleDateString('es-MX').replace(/\//g, '-')}.xlsx`
    );
};