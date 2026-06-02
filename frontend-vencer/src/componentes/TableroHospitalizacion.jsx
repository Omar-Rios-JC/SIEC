import React, { useState, useMemo, useEffect } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Users, Clock, ClipboardList, TrendingUp, Filter } from 'lucide-react';

// =================================================================
// SUB-COMPONENTE LOCAL: Tabla de Datos Estilo Producción Unificado
// =================================================================
const TablaDatos = ({ titulo1, titulo2, labels, data, dataDias, dataPromedios, total = true }) => {
    if (!labels || !data) return null;

    const totalEgresos = data.reduce((a, b) => a + b, 0);
    const totalDias = dataDias ? dataDias.reduce((a, b) => a + b, 0) : 0;
    const promedioGeneral = totalEgresos > 0 ? (totalDias / totalEgresos).toFixed(1) : '0.0';

    return (
        <div className="mt-4 border-t border-slate-100 pt-4 animate-in fade-in slide-in-from-top-2 duration-300 h-full">
            <div className="max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="py-2 px-3 font-bold rounded-l-lg">{titulo1}</th>
                            {dataDias && <th className="py-2 px-3 font-bold text-center text-slate-500">Días Estancia</th>}
                            {dataPromedios && <th className="py-2 px-3 font-bold text-center text-emerald-600">Prom. Estancia</th>}
                            <th className="py-2 px-3 font-bold text-right rounded-r-lg">{titulo2}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {labels.map((label, index) => (
                            <tr key={index} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                <td className="py-2 px-3 font-medium text-slate-700">{label || "No Especificado"}</td>
                                {dataDias && dataDias[index] !== undefined && (
                                    <td className="py-2 px-3 text-center text-slate-500 font-semibold">{dataDias[index].toLocaleString()}</td>
                                )}
                                {dataPromedios && dataPromedios[index] !== undefined && (
                                    <td className="py-2 px-3 text-center text-emerald-600 font-bold bg-slate-50/50">{dataPromedios[index]} d</td>
                                )}
                                <td className="py-2 px-3 text-right font-black text-slate-700">{data[index]?.toLocaleString() || 0}</td>
                            </tr>
                        ))}
                    </tbody>
                    {total && (
                        <tfoot className="bg-slate-50 font-bold sticky bottom-0 z-10 shadow-sm">
                            <tr>
                                <td className="py-2 px-3 rounded-l-lg text-slate-500 uppercase tracking-widest text-xs">Total General</td>
                                {dataDias && <td className="py-2 px-3 text-center text-slate-600 font-black">{totalDias.toLocaleString()}</td>}
                                {dataPromedios && <td className="py-2 px-3 text-center text-emerald-700 font-black bg-emerald-100/50">{promedioGeneral} d</td>}
                                <td className="py-2 px-3 text-right rounded-r-lg text-slate-800 font-black">{totalEgresos.toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
};

const anchoDinamico = (cantidad) => cantidad > 15 ? `${cantidad * 45}px` : '100%';

// =================================================================
// COMPONENTE PRINCIPAL: TABLERO HOSPITALIZACIÓN (LIMPÌO Y NACIONAL)
// =================================================================
export default function TableroHospitalizacion({ datos = [], mostrarTablas = false, setExportData }) {
    const [divisionSeleccionada, setDivisionSeleccionada] = useState("");
    const [especialidadSeleccionada, setEspecialidadSeleccionada] = useState("");

    // SINCRONIZACIÓN AUTOMÁTICA CON EL PADRE PARA EXCEL
    useEffect(() => {
        if (setExportData) {
            setExportData(datos || []);
        }
    }, [datos, setExportData]);

    const listaDeDivisiones = useMemo(() => {
        const divisionesUnicas = new Set();
        datos.forEach(item => {
            if (item.division) divisionesUnicas.add(item.division.toUpperCase().trim());
        });
        return Array.from(divisionesUnicas).sort();
    }, [datos]);

    const listaDeEspecialidadesFiltradas = useMemo(() => {
        const   especUnicas = new Set();
        datos.forEach(item => {
            const div = item.division ? item.division.toUpperCase().trim() : "";
            if (item.especialidad && (!divisionSeleccionada || div === divisionSeleccionada.toUpperCase().trim())) {
                especUnicas.add(item.especialidad.toUpperCase().trim());
            }
        });
        return Array.from(especUnicas).sort();
    }, [datos, divisionSeleccionada]);

    useEffect(() => {
        setEspecialidadSeleccionada("");
    }, [divisionSeleccionada]);

    const kpis = useMemo(() => {
        if (!datos || datos.length === 0) return { total: 0, promedioEstancia: '0.0', totalDias: 0 };
        const totalEgresos = datos.length;
        const totalDias = datos.reduce((sum, d) => sum + (Number(d.dias_estancia) || 0), 0);
        return { total: totalEgresos, promedioEstancia: (totalDias / totalEgresos).toFixed(1), totalDias };
    }, [datos]);

    const chartDivisiones = useMemo(() => {
        if (!datos || datos.length === 0) return { labels: [], datasets: [], dataDias: [], promedios: [] };

        const conteo = datos.reduce((acc, curr) => {
            const nombreDiv = curr.division ? curr.division.toUpperCase().trim() : "DIVISIÓN NO ESPECIFICADA";
            if (!acc[nombreDiv]) acc[nombreDiv] = { egresos: 0, dias: 0 };
            acc[nombreDiv].egresos++;
            acc[nombreDiv].dias += Number(curr.dias_estancia) || 0;
            return acc;
        }, {});

        const ordenados = Object.entries(conteo).sort((a, b) => b[1].egresos - a[1].egresos);
        return {
            labels: ordenados.map(item => item[0]),
            datasets: [{ label: 'Egresos', data: ordenados.map(item => item[1].egresos), backgroundColor: '#822626', borderRadius: 4 }],
            dataDias: ordenados.map(item => item[1].dias),
            promedios: ordenados.map(item => item[1].egresos > 0 ? (item[1].dias / item[1].egresos).toFixed(1) : '0.0')
        };
    }, [datos]);

    const chartEspecialidades = useMemo(() => {
        if (!datos || datos.length === 0) return { labels: [], datasets: [], dataDias: [], promedios: [] };

        const conteo = datos.reduce((acc, curr) => {
            const nombreEsp = curr.especialidad ? curr.especialidad.toUpperCase().trim() : "NO ESPECIFICADA";
            const divisionEsp = curr.division ? curr.division.toUpperCase().trim() : "";

            if (divisionSeleccionada && divisionEsp !== divisionSeleccionada.toUpperCase().trim()) return acc;

            if (!acc[nombreEsp]) acc[nombreEsp] = { egresos: 0, dias: 0 };
            acc[nombreEsp].egresos++;
            acc[nombreEsp].dias += Number(curr.dias_estancia) || 0;
            return acc;
        }, {});

        const ordenados = Object.entries(conteo).sort((a, b) => b[1].egresos - a[1].egresos);
        return {
            labels: ordenados.map(item => item[0]),
            datasets: [{ label: 'Egresos', data: ordenados.map(item => item[1].egresos), backgroundColor: '#0284c7', borderRadius: 4 }],
            dataDias: ordenados.map(item => item[1].dias),
            promedios: ordenados.map(item => item[1].egresos > 0 ? (item[1].dias / item[1].egresos).toFixed(1) : '0.0')
        };
    }, [datos, divisionSeleccionada]);

    const chartMotivos = useMemo(() => {
        if (!datos || datos.length === 0) return { labels: [], datasets: [] };
        const conteo = datos.reduce((acc, curr) => {
            let motivo = String(curr.motivo_egreso || '').trim().toUpperCase();
            if (motivo === '') motivo = "NO ESPECIFICADO";
            if (motivo.includes('ABANDONO')) return acc;

            acc[motivo] = (acc[motivo] || 0) + 1;
            return acc;
        }, {});

        const ordenados = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
        return {
            labels: ordenados.map(item => item[0]),
            datasets: [{ data: ordenados.map(item => item[1]), backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#64748b', '#a855f7', '#185bc4', '#94a3b8'], borderWidth: 0 }]
        };
    }, [datos]);

    const chartDiagnosticos = useMemo(() => {
        if (!datos || datos.length === 0) return { labels: [], datasets: [], dataDias: [], promedios: [] };

        const conteo = datos.reduce((acc, curr) => {
            if (!curr || !curr.diagnostico_egreso) return acc;

            const divisionPac = curr.division ? curr.division.toUpperCase().trim() : "";
            const especPac = curr.especialidad ? curr.especialidad.toUpperCase().trim() : "";

            if (divisionSeleccionada && divisionPac !== divisionSeleccionada.toUpperCase().trim()) return acc;
            if (especialidadSeleccionada && especPac !== especialidadSeleccionada.toUpperCase().trim()) return acc;

            const nombreCIE = String(curr.diagnostico_egreso).trim().toUpperCase();

            if (!acc[nombreCIE]) acc[nombreCIE] = { egresos: 0, dias: 0 };
            acc[nombreCIE].egresos++;
            acc[nombreCIE].dias += Number(curr.dias_estancia) || 0;
            return acc;
        }, {});

        const ordenados = Object.entries(conteo).sort((a, b) => b[1].egresos - a[1].egresos).slice(0, 20);
        return {
            labels: ordenados.map(item => item[0]),
            datasets: [{ label: 'Frecuencia de Egreso', data: ordenados.map(item => item[1].egresos), backgroundColor: '#475569', borderRadius: 4 }],
            dataDias: ordenados.map(item => item[1].dias),
            promedios: ordenados.map(item => item[1].egresos > 0 ? (item[1].dias / item[1].egresos).toFixed(1) : '0.0')
        };
    }, [datos, divisionSeleccionada, especialidadSeleccionada]);

    const chartOptionsVertical = { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true }, x: { grid: { display: false } } } };

    return (
        <div id="seccion-hospitalizacion-completa" className="w-full animate-in fade-in duration-500">
            {/* ENCABEZADO */}
            <div className="mb-8">
                <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                    <span className="text-emerald-600 bg-emerald-100 p-2 rounded-xl"><ClipboardList size={28} /></span>
                    Productividad de Hospitalización
                </h2>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-emerald-500">
                    <div className="flex items-center gap-3 text-slate-500 mb-2"><Users size={18} /><h3 className="text-xs font-bold uppercase tracking-widest">Total Egresos</h3></div>
                    <p className="text-4xl font-black text-emerald-600">{kpis.total.toLocaleString()}</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-sky-600">
                    <div className="flex items-center gap-3 text-slate-500 mb-2"><Clock size={18} /><h3 className="text-xs font-bold uppercase tracking-widest">Promedio Estancia</h3></div>
                    <p className="text-4xl font-black text-sky-600">{kpis.promedioEstancia} <span className="text-sm font-bold text-slate-400">días</span></p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-slate-500">
                    <div className="flex items-center gap-3 text-slate-500 mb-2"><ClipboardList size={18} /><h3 className="text-xs font-bold uppercase tracking-widest">Días Estancia Acumulados</h3></div>
                    <p className="text-4xl font-black text-slate-700">{kpis.totalDias.toLocaleString()}</p>
                </div>
            </div>

            {/* DIVISIONES Y MOTIVOS */}
            <div className={`grid grid-cols-1 ${mostrarTablas ? 'lg:grid-cols-2' : ''} gap-6 mb-6 items-start`}>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col h-full min-h-[300px]">
                    <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide mb-4 border-b border-slate-100 pb-2">Egresos por División Médica</h3>
                    <div className="relative flex-1 min-h-[220px]"><Bar data={chartDivisiones} options={chartOptionsVertical} /></div>
                    {mostrarTablas && <TablaDatos titulo1="División" titulo2="Egresos" labels={chartDivisiones.labels} data={chartDivisiones.datasets[0].data} dataDias={chartDivisiones.dataDias} dataPromedios={chartDivisiones.promedios} />}
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col h-full min-h-[300px]">
                    <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide mb-4 border-b border-slate-100 pb-2">Distribución por Motivo de Egreso</h3>
                    <div className="relative flex-1 min-h-[220px]"><Doughnut data={chartMotivos} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} /></div>
                    {mostrarTablas && <TablaDatos titulo1="Motivo Egreso" titulo2="Egresos" labels={chartMotivos.labels} data={chartMotivos.datasets[0].data} total={false} />}
                </div>
            </div>

            {/* ESPECIALIDADES */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-slate-100 pb-3">
                    <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Egresos y Rendimiento por Especialidad</h3>
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-inner">
                        <Filter size={14} className="text-slate-400" />
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">División:</label>
                        <select value={divisionSeleccionada} onChange={(e) => setDivisionSeleccionada(e.target.value)} className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer uppercase pr-4">
                            <option value="">-- Ver Todas --</option>
                            {listaDeDivisiones.map((div, idx) => <option key={idx} value={div}>{div}</option>)}
                        </select>
                    </div>
                </div>

                <div className={`flex-1 grid grid-cols-1 ${mostrarTablas && chartEspecialidades.labels.length > 0 ? 'lg:grid-cols-5 gap-6' : 'lg:grid-cols-1'}`}>
                    {chartEspecialidades.labels.length > 0 ? (
                        <>
                            <div className={`relative overflow-x-auto custom-scrollbar pb-4 ${mostrarTablas ? 'lg:col-span-3' : 'lg:col-span-1'}`} style={{ height: '400px' }}>
                                <div style={{ minWidth: anchoDinamico(chartEspecialidades.labels.length), height: '100%' }}><Bar data={chartEspecialidades} options={chartOptionsVertical} /></div>
                            </div>
                            {mostrarTablas && <div className="lg:col-span-2 h-[400px] overflow-hidden"><TablaDatos titulo1="Especialidad" titulo2="Egresos" labels={chartEspecialidades.labels} data={chartEspecialidades.datasets[0].data} dataDias={chartEspecialidades.dataDias} dataPromedios={chartEspecialidades.promedios} /></div>}
                        </>
                    ) : (
                        <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 w-full col-span-5">No se detectaron egresos para la división seleccionada.</div>
                    )}
                </div>
            </div>

            {/* DIAGNÓSTICOS CIE-10 */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-slate-100 pb-3">
                    <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide flex items-center gap-2"><TrendingUp size={18} className="text-slate-500" /> Top 20 Diagnósticos de Egreso (CIE-10)</h3>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-inner">
                            <Filter size={12} className="text-slate-400" />
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">División:</label>
                            <select value={divisionSeleccionada} onChange={(e) => setDivisionSeleccionada(e.target.value)} className="bg-transparent text-[11px] font-bold text-slate-700 focus:outline-none cursor-pointer uppercase pr-2"><option value="">-- Todas --</option>{listaDeDivisiones.map((div, idx) => <option key={idx} value={div}>{div}</option>)}</select>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-inner">
                            <Filter size={12} className="text-slate-400" />
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Especialidad:</label>
                            <select value={especialidadSeleccionada} onChange={(e) => setEspecialidadSeleccionada(e.target.value)} className="bg-transparent text-[11px] font-bold text-slate-700 focus:outline-none cursor-pointer uppercase pr-2 max-w-[200px]"><option value="">-- Todas --</option>{listaDeEspecialidadesFiltradas.map((esp, idx) => <option key={idx} value={esp}>{esp}</option>)}</select>
                        </div>
                    </div>
                </div>

                <div className={`flex-1 grid grid-cols-1 ${mostrarTablas && chartDiagnosticos.labels.length > 0 ? 'lg:grid-cols-5 gap-6' : 'lg:grid-cols-1'}`}>
                    {chartDiagnosticos.labels.length > 0 ? (
                        <>
                            <div className={`relative overflow-x-auto custom-scrollbar pb-4 ${mostrarTablas ? 'lg:col-span-3' : 'lg:col-span-1'}`} style={{ height: '400px' }}>
                                <div style={{ minWidth: anchoDinamico(chartDiagnosticos.labels.length), height: '100%' }}><Bar data={chartDiagnosticos} options={chartOptionsVertical} /></div>
                            </div>
                            {mostrarTablas && <div className="lg:col-span-2 h-[400px] overflow-hidden"><TablaDatos titulo1="Diagnóstico de Egreso" titulo2="Frecuencia" labels={chartDiagnosticos.labels} data={chartDiagnosticos.datasets[0].data} dataDias={chartDiagnosticos.dataDias} dataPromedios={chartDiagnosticos.promedios} total={false} /></div>}
                        </>
                    ) : (
                        <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 w-full col-span-5">No se detectaron diagnósticos para los filtros seleccionados.</div>
                    )}
                </div>
            </div>
        </div>
    );
}