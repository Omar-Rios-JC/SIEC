import React from 'react';
import { Stethoscope, Syringe, Bed, ArrowLeft } from 'lucide-react';

export default function MenuCarga({ setVistaActiva }) {
    return (
        <div className="bg-slate-50 min-h-screen flex flex-col items-center pt-16 px-8 animate-in fade-in duration-500">
            {/* Botón para regresar al Menú Principal */}

            <div className="w-full max-w-4xl mb-8">
                <button
                    onClick={() => { setVistaActiva('menu'); setMensaje(''); }}
                    className="flex items-center text-slate-500 hover:text-[#822626] font-bold transition-colors group"
                >
                    <span className="mr-2 transition-transform group-hover:-translate-x-1">←</span>
                    Volver al Menú Principal
                </button>
            </div>

            {/* Encabezado */}
            <div className="text-center mb-12">
                <h1 className="text-3xl font-black text-[#822626] mb-2 tracking-tight">
                    Selección de Origen de Datos
                </h1>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">
                    Módulos de actualización disponibles
                </p>
            </div>

            {/* Contenedor de Tarjetas (Cambiado a grid-cols-3 para albergar las 3 opciones) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full animate-in fade-in slide-in-from-bottom-6 duration-700">

                {/* 1. CONSULTA EXTERNA */}
                <button
                    onClick={() => setVistaActiva('subir_ce')}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-red-200 transition-all flex flex-col items-center text-center group"
                >
                    <div className="p-4 rounded-full mb-4 bg-red-50 text-[#822626] group-hover:bg-[#822626] group-hover:text-white transition-colors">
                        <Stethoscope size={40} />
                    </div>
                    <h2 className="text-lg font-black text-slate-800 mb-2">Consulta Externa</h2>
                    <p className="text-slate-500 text-xs font-medium leading-relaxed">
                        Sube el CSV de productividad para actualizar Consulta Externa, Paramédicos y Urgencias.
                    </p>
                </button>

                {/* 2. CIRUGÍAS (Solo redirección, sin componente asignado por ti) */}
                <button
                    onClick={() => setVistaActiva('subir_cirugias')}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-amber-200 transition-all flex flex-col items-center text-center group"
                >
                    <div className="p-4 rounded-full mb-4 bg-amber-50 text-amber-700 group-hover:bg-amber-700 group-hover:text-white transition-colors">
                        <Syringe size={40} />
                    </div>
                    <h2 className="text-lg font-black text-slate-800 mb-2">Cirugías</h2>
                    <p className="text-slate-500 text-xs font-medium leading-relaxed">
                        Procesa el archivo CSV con la programación y reportes del área de quirófanos.
                    </p>
                </button>

                {/* 3. HOSPITALIZACIÓN */}
                <button
                    onClick={() => setVistaActiva('subir_hosp')}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-emerald-200 transition-all flex flex-col items-center text-center group"
                >
                    <div className="p-4 rounded-full mb-4 bg-emerald-50 text-emerald-700 group-hover:bg-emerald-700 group-hover:text-white transition-colors">
                        <Bed size={40} />
                    </div>
                    <h2 className="text-lg font-black text-slate-800 mb-2">Hospitalización</h2>
                    <p className="text-slate-500 text-xs font-medium leading-relaxed">
                        Sube los registros de movimientos, altas y censos de camas para el periodo IMSS.
                    </p>
                </button>

            </div>
        </div>
    );
}