import localforage from 'localforage';

/**
 * Registra la fecha/hora EXACTA en que un administrador sube y actualiza
 * una base de datos. Se debe llamar justo cuando el servidor confirma
 * que la carga fue exitosa (respuesta.data.success === true).
 *
 * @param {string} clave - Identificador del módulo: 'productividad' | 'cirugias' | 'hospitalizacion'
 * @returns {Promise<string>} La fecha ISO guardada
 */
export async function registrarActualizacion(clave) {
  const ahora = new Date().toISOString();
  await localforage.setItem(`fecha_actualizacion_${clave}_vencer`, ahora);
  return ahora;
}

/**
 * Obtiene la fecha/hora de la última actualización real registrada
 * para un módulo, ya formateada como dd/mm/aaaa hh:mm.
 *
 * @param {string} clave - Identificador del módulo
 * @returns {Promise<string>} Fecha formateada, o "No disponible" si nunca se ha registrado
 */
export async function obtenerFechaActualizacion(clave) {
  try {
    const iso = await localforage.getItem(`fecha_actualizacion_${clave}_vencer`);
    if (!iso) return 'No disponible';

    const fecha = new Date(iso);
    if (isNaN(fecha.getTime())) return 'No disponible';

    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = fecha.getFullYear();
    const hora = String(fecha.getHours()).padStart(2, '0');
    const min = String(fecha.getMinutes()).padStart(2, '0');

    return `${dia}/${mes}/${anio} ${hora}:${min}`;
  } catch (error) {
    console.error('Error leyendo fecha de actualización:', error);
    return 'No disponible';
  }
}
