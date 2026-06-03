import React, { useState } from 'react';
import axios from 'axios';
import localforage from 'localforage';
import { Bed, Upload, CheckCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

export default function ModuloCargaHosp({ setVistaActiva, setMensaje, mensaje, cargarDatos }) {
    const [archivo, setArchivo] = useState(null);
    const [subiendo, setSubiendo] = useState(false);

    const handleSubirArchivo = async (e) => {
        e.preventDefault();
        if (!archivo) {
            setMensaje("⚠️ Por favor, selecciona un archivo CSV primero.");
            return;
        }

        const formData = new FormData();
        formData.append('archivo_csv', archivo);

        setSubiendo(true);
        setMensaje("");

        try {
            // Tu API destino para Hospitalización
            const respuesta = await axios.post('/api/upload_hospitalizacion.php', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (respuesta.data.success) {
                setMensaje(`¡Éxito! ${respuesta.data.message}`);
                setArchivo(null);
                
                // Limpieza específica de Hospitalización
                await localforage.removeItem('cache_hospitalizacion_vencer');
                await localforage.removeItem('version_hospitalizacion_vencer');
                
                if (cargarDatos) cargarDatos();
            } else {
                setMensaje(`Error: ${respuesta.data.message}`);
            }
        } catch (error) {
            console.error("Error al subir:", error);
            setMensaje("Error crítico al conectar con el servidor.");
        } finally {
            setSubiendo(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 font-sans flex flex-col items-center">
            <div className="w-full max-w-4xl mb-8">
                <button 
                    onClick={() => { setVistaActiva('subir'); setMensaje(''); }}
                    className="flex items-center text-slate-500 hover:text-[#822626] font-bold transition-colors group"
                >
                    <ArrowLeft size={16} className="mr-2 transition-transform group-hover:-translate-x-1" />
                    Volver a Selección de Carga
                </button>
            </div>

            <div className="max-w-4xl w-full bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-10 animate-in fade-in zoom-in-95 duration-500">
                <div className="flex items-center gap-4 mb-8">
                    <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-700">
                        <Bed size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-800">Carga Hospitalización</h2>
                        <p className="text-slate-500 font-medium">Sube los registros de movimientos, altas y censos de camas para el periodo IMSS.</p>
                    </div>
                </div>

                <form onSubmit={handleSubirArchivo} className="space-y-6">
                    <div className={`relative border-2 border-dashed rounded-3xl p-12 transition-all flex flex-col items-center justify-center ${archivo ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 hover:border-[#822626]/30 bg-slate-50/50'}`}>
                        <input 
                            type="file" 
                            accept=".csv"
                            onChange={(e) => setArchivo(e.target.files[0])}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        {!archivo ? (
                            <>
                                <Upload size={48} className="text-slate-300 mb-4" />
                                <p className="text-slate-600 font-bold">Haz clic o arrastra tu archivo CSV aquí</p>
                            </>
                        ) : (
                            <>
                                <CheckCircle size={48} className="text-emerald-500 mb-4" />
                                <p className="text-emerald-700 font-bold">{archivo.name}</p>
                                <button type="button" onClick={(e) => { e.stopPropagation(); setArchivo(null); }} className="mt-4 text-xs font-black uppercase text-red-500 underline">Quitar archivo</button>
                            </>
                        )}
                    </div>

                    <button type="submit" disabled={subiendo || !archivo} className={`w-full py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 ${subiendo || !archivo ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-emerald-700 text-white'}`}>
                        {subiendo ? <Loader2 className="animate-spin" size={24} /> : "Iniciar Carga de Hospitalización"}
                    </button>
                </form>

                {mensaje && (
                    <div className={`mt-8 p-4 rounded-2xl flex items-center gap-3 ${mensaje.includes('¡Éxito!') ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                        <CheckCircle size={20} />
                        <span className="font-bold text-sm">{mensaje}</span>
                    </div>
                )}
            </div>
        </div>
    );
}