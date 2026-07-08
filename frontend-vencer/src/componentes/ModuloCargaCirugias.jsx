import React, { useState } from 'react';
import axios from 'axios';
import localforage from 'localforage';
import { Scissors, Upload, CheckCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
<<<<<<< HEAD
=======
import { 
    obtenerFechaActualizacion,
    registrarActualizacion
} from '../utils/fechaActualizacion';
>>>>>>> f01db6b1ce85c058bf31e25e14622d40c3461e89

export default function ModuloCargaCirugias({ setVistaActiva, setMensaje, mensaje, cargarDatosCirugias }) {
    const [archivo, setArchivo] = useState(null);
    const [subiendo, setSubiendo] = useState(false);

    const handleSubirArchivo = async (e) => {
        e.preventDefault();

        if (!archivo) {
            setMensaje('Por favor, selecciona un archivo CSV primero.');
            return;
        }

        const formData = new FormData();
        formData.append('archivo_csv', archivo);

        setSubiendo(true);
        setMensaje('');

        try {
            const respuesta = await axios.post('/api/upload_cirugias.php', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (respuesta.data.success) {
                setMensaje(`Exito: ${respuesta.data.message}`);
                setArchivo(null);

                await localforage.removeItem('cache_cirugias_vencer');
                await localforage.removeItem('version_cirugias_vencer');

                if (cargarDatosCirugias) cargarDatosCirugias();
            } else {
                setMensaje(`Error: ${respuesta.data.message}`);
            }
        } catch (error) {
            console.error('Error al subir cirugias:', error);
            const mensajeServidor = error?.response?.data?.message;
            setMensaje(mensajeServidor ? `Error: ${mensajeServidor}` : 'Error critico al conectar con el servidor.');
        } finally {
            setSubiendo(false);
        }
    };

    const limpiarArchivo = (e) => {
        e.stopPropagation();
        setArchivo(null);
    };

    const esExito = mensaje && mensaje.toLowerCase().startsWith('exito');

    return (
        <div className="min-h-screen bg-slate-50 p-6 font-sans flex flex-col items-center">
            <div className="w-full max-w-4xl mb-8">
                <button
                    onClick={() => { setVistaActiva('subir'); setMensaje(''); }}
                    className="flex items-center text-slate-500 hover:text-amber-700 font-bold transition-colors group"
                >
                    <ArrowLeft size={16} className="mr-2 transition-transform group-hover:-translate-x-1" />
                    Volver a Seleccion de Carga
                </button>
            </div>

            <div className="max-w-4xl w-full bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-10 animate-in fade-in zoom-in-95 duration-500">
                <div className="flex items-center gap-4 mb-8">
                    <div className="bg-amber-50 p-4 rounded-2xl text-amber-700">
                        <Scissors size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-800">Carga Cirugias</h2>
                        <p className="text-slate-500 font-medium">Sube el reporte CSV de programacion y seguimiento quirurgico.</p>
                    </div>
                </div>

                <form onSubmit={handleSubirArchivo} className="space-y-6">
                    <div className={`relative border-2 border-dashed rounded-3xl p-12 transition-all flex flex-col items-center justify-center ${archivo ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200 hover:border-amber-500/40 bg-slate-50/50'}`}>
                        <input
                            type="file"
                            accept=".csv"
                            onChange={(e) => setArchivo(e.target.files[0])}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />

                        {!archivo ? (
                            <>
                                <Upload size={48} className="text-slate-300 mb-4" />
                                <p className="text-slate-600 font-bold">Haz clic o arrastra tu archivo CSV aqui</p>
                                <p className="text-slate-400 text-sm mt-1">Reporte oficial de cirugias en formato .csv</p>
                            </>
                        ) : (
                            <>
                                <CheckCircle size={48} className="text-amber-600 mb-4" />
                                <p className="text-amber-700 font-bold">{archivo.name}</p>
                                <p className="text-amber-600 text-sm mt-1">{(archivo.size / 1024 / 1024).toFixed(2)} MB - Listo para subir</p>
                                <button
                                    type="button"
                                    onClick={limpiarArchivo}
                                    className="mt-4 text-xs font-black uppercase tracking-widest text-red-500 hover:text-red-700 underline"
                                >
                                    Quitar archivo
                                </button>
                            </>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={subiendo || !archivo}
                        className={`w-full py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 ${subiendo || !archivo ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-amber-700 text-white shadow-lg shadow-amber-100 hover:scale-[1.01] active:scale-[0.99]'}`}
                    >
                        {subiendo ? (
                            <>
                                <Loader2 className="animate-spin" size={24} />
                                Procesando Datos...
                            </>
                        ) : (
                            <>
                                <Scissors size={24} />
                                Iniciar Carga de Cirugias
                            </>
                        )}
                    </button>
                </form>

                {mensaje && (
                    <div className={`mt-8 p-4 rounded-2xl flex items-center gap-3 ${esExito ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                        {esExito ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                        <span className="font-bold text-sm">{mensaje}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
