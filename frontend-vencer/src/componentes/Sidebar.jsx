import React from "react";
import {
  Activity,
  Siren,
  AlertOctagon,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  TableProperties,
  Download,
} from "lucide-react";

export default function Sidebar({
  moduloActual,
  setModuloActual,
  pestanaActiva,
  setPestanaActiva,
  conteos,
  sidebarCollapsed,
  setSidebarCollapsed,
  mostrarTablas,
  setMostrarTablas,
  generarExcelReporte,
  descargandoExcel,
  hayDatos,
  onVolverInicio,
  onCerrarMovil,
}) {
  const handleVolverInicio = () => {
    if (typeof onVolverInicio === "function") {
      onVolverInicio();
    }
  };

  return (
    <aside className="h-full flex flex-col text-white transition-all duration-300 relative">
      {/* Encabezado / Botón Volver al inicio */}
      <div className="p-4 flex items-center justify-between border-b border-white/10 shrink-0 min-h-[64px] gap-2">
        <button
          type="button"
          onClick={handleVolverInicio}
          className={`flex items-center ${
            sidebarCollapsed ? "justify-center px-2" : "justify-start px-3"
          } gap-3 py-2.5 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20 transition-colors min-w-0 flex-1`}
          title="Volver al inicio"
        >
          {!sidebarCollapsed && (
            <span className="truncate">Volver al inicio</span>
          )}
        </button>

        {typeof onCerrarMovil === "function" ? (
          <button
            type="button"
            onClick={onCerrarMovil}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors shrink-0"
            title="Cerrar menu lateral"
            aria-label="Cerrar menu lateral"
          >
            <ChevronLeft size={22} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors shrink-0"
            title={sidebarCollapsed ? "Expandir menu" : "Contraer menu"}
          >
            {sidebarCollapsed ? (
              <ChevronRight size={22} />
            ) : (
              <ChevronLeft size={22} />
            )}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-6">
        {/* SUB-MENÚ DE VENCER */}
        {moduloActual === "vencer" && (
          <div className="space-y-1 animate-in fade-in slide-in-from-left-2 duration-300">
            {!sidebarCollapsed && (
              <p className="px-3 text-[10px] font-bold text-emerald-200/60 uppercase tracking-widest mb-2">
                Vistas Vencer
              </p>
            )}

            <button
              type="button"
              onClick={() => setPestanaActiva("general")}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                pestanaActiva === "general"
                  ? "bg-white/20 font-bold border border-white/30"
                  : "hover:bg-white/10 text-emerald-100/80 hover:text-white"
              }`}
              title="Panorama General"
            >
              <div className="flex items-center">
                <LayoutDashboard
                  size={18}
                  className={sidebarCollapsed ? "mx-auto" : "mr-3"}
                />
                {!sidebarCollapsed && <span>General</span>}
              </div>

              {!sidebarCollapsed && (
                <span className="text-[10px] bg-[#003B2D] px-2 py-0.5 rounded-full">
                  {conteos.general}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setPestanaActiva("adversos")}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                pestanaActiva === "adversos"
                  ? "bg-red-500/80 font-bold border border-red-400"
                  : "hover:bg-white/10 text-emerald-100/80 hover:text-white"
              }`}
              title="Eventos Adversos"
            >
              <div className="flex items-center">
                <AlertOctagon
                  size={18}
                  className={sidebarCollapsed ? "mx-auto" : "mr-3"}
                />
                {!sidebarCollapsed && <span>Adversos</span>}
              </div>

              {!sidebarCollapsed && (
                <span className="text-[10px] bg-red-900/50 px-2 py-0.5 rounded-full">
                  {conteos.adversos}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setPestanaActiva("cuasi")}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                pestanaActiva === "cuasi"
                  ? "bg-amber-500/80 font-bold border border-amber-400"
                  : "hover:bg-white/10 text-emerald-100/80 hover:text-white"
              }`}
              title="Cuasifallas"
            >
              <div className="flex items-center">
                <Activity
                  size={18}
                  className={sidebarCollapsed ? "mx-auto" : "mr-3"}
                />
                {!sidebarCollapsed && <span>Cuasifallas</span>}
              </div>

              {!sidebarCollapsed && (
                <span className="text-[10px] bg-amber-900/50 px-2 py-0.5 rounded-full">
                  {conteos.cuasi}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setPestanaActiva("centinela")}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                pestanaActiva === "centinela"
                  ? "bg-slate-800 font-bold border border-slate-600"
                  : "hover:bg-white/10 text-emerald-100/80 hover:text-white"
              }`}
              title="Eventos Centinela"
            >
              <div className="flex items-center">
                <Siren
                  size={18}
                  className={sidebarCollapsed ? "mx-auto" : "mr-3"}
                />
                {!sidebarCollapsed && <span>Centinelas</span>}
              </div>

              {!sidebarCollapsed && (
                <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded-full">
                  {conteos.centinela}
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Acciones Inferiores */}
      {moduloActual === "vencer" && (
        <div className="p-3 border-t border-white/10 bg-[#004a38] shrink-0 space-y-2">
          <button
            type="button"
            onClick={() => setMostrarTablas(!mostrarTablas)}
            className="w-full flex items-center p-3 rounded-xl hover:bg-white/10 transition-colors text-emerald-100 text-sm"
            title={mostrarTablas ? "Ocultar Tablas" : "Mostrar Tablas"}
          >
            <TableProperties
              size={18}
              className={sidebarCollapsed ? "mx-auto" : "mr-3"}
            />
            {!sidebarCollapsed && (
              <span>{mostrarTablas ? "Ocultar Tablas" : "Mostrar Tablas"}</span>
            )}
          </button>

          <button
            type="button"
            onClick={generarExcelReporte}
            disabled={!hayDatos || descargandoExcel}
            className={`w-full flex items-center p-3 rounded-xl transition-colors text-sm font-bold ${
              !hayDatos || descargandoExcel
                ? "opacity-50 cursor-not-allowed bg-white/5 text-emerald-200"
                : "bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg"
            }`}
            title="Descargar Reporte"
          >
            <Download
              size={18}
              className={`${sidebarCollapsed ? "mx-auto" : "mr-3"} ${
                descargandoExcel ? "animate-bounce" : ""
              }`}
            />

            {!sidebarCollapsed && (
              <span>{descargandoExcel ? "Generando..." : "Descargar Excel"}</span>
            )}
          </button>
        </div>
      )}
    </aside>
  );
}
