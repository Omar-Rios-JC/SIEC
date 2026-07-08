import axios from "axios";

const APIS = {
    productividad: "/api/api_check_update.php",
    cirugias: "/api/api_check_update_cirugias.php",
    hospitalizacion: "/api/api_check_update_hospitalizacion.php"
};


export async function obtenerFechaActualizacion(modulo) {
    try {
        const url = APIS[modulo];

        if (!url) return "No disponible";

        const res = await axios.get(url);

        const timestamp = Number(res.data.ultima_actualizacion);

        if (!timestamp) return "No disponible";

        const fecha = new Date(timestamp * 1000);

        const dia = String(fecha.getDate()).padStart(2, "0");
        const mes = String(fecha.getMonth() + 1).padStart(2, "0");
        const anio = fecha.getFullYear();

        const hora = String(fecha.getHours()).padStart(2, "0");
        const minuto = String(fecha.getMinutes()).padStart(2, "0");

        return `${dia}/${mes}/${anio} ${hora}:${minuto}`;

    } catch (error) {
        console.error(error);
        return "No disponible";
    }
}


// NUEVA FUNCIÓN
export async function registrarActualizacion(modulo) {
    try {

        const res = await axios.post(
            "/api/registrar_actualizacion.php",
            {
                modulo: modulo
            }
        );

        return res.data;

    } catch(error){

        console.error(
            "Error registrando actualización:",
            error
        );

        return null;
    }
}