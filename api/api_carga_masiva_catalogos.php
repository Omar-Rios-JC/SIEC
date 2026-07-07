<?php
// Activar compresión para optimizar las respuestas masivas
if (substr_count($_SERVER['HTTP_ACCEPT_ENCODING'], 'gzip')) {
    ob_start("ob_gzhandler");
} else {
    ob_start();
}

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 1. CONFIGURACIÓN DE BASE DE DATOS UNIFICADA
$host = 'sql112.infinityfree.com';
$user = 'if0_41994851';
$pass = 'BIguNSKaR7Wnk';
$dbname = 'if0_41994851_siec'; 

try {
    // Conexión única a la base de datos general
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");

    // Helper para transformar codificaciones de Excel (ANSI / Windows-1252) a UTF-8 limpio
    $convertirAUtf8 = function($texto) {
        $textoDecodificado = html_entity_decode(trim($texto), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        if (!mb_check_encoding($textoDecodificado, 'UTF-8')) {
            $textoDecodificado = mb_convert_encoding($textoDecodificado, 'UTF-8', 'Windows-1252');
        }
        return $textoDecodificado;
    };

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['archivo_csv']) && isset($_POST['seccion'])) {
        $fileTmpPath = $_FILES['archivo_csv']['tmp_name'];
        $seccion = trim($_POST['seccion']);

        if (($handle = fopen($fileTmpPath, "r")) !== FALSE) {
            // Detección automática del delimitador del Excel (; o ,)
            $linea1 = fgets($handle);
            $delimitador = strpos($linea1, ';') !== false ? ';' : ',';
            rewind($handle);

            // Mapeo dinámico de cabeceras limpiando bytes invisibles (BOM)
            $headers = fgetcsv($handle, 10000, $delimitador);
            $headers = array_map(function($h) {
                $h = preg_replace('/\xEF\xBB\xBF/', '', $h);
                return trim(preg_replace('/[\x00-\x1F\x7F]/', '', $h));
            }, $headers);
            $colMap = array_flip($headers);

            $insertados = 0;
            $saltados = 0;

            // =========================================================
            // CASO 1: SUBIDA MASIVA DE DIAGNÓSTICOS (CIE-10)
            // =========================================================
            if ($seccion === 'diagnosticos') {
                if (!isset($colMap['CATALOG_KEY']) || !isset($colMap['NOMBRE'])) {
                    echo json_encode(['success' => false, 'error' => 'Formato inválido. El CSV de Diagnósticos debe incluir: CATALOG_KEY y NOMBRE.']);
                    exit;
                }

                $stmt = $pdo->prepare("INSERT IGNORE INTO cat_cie10 (codigo, descripcion) VALUES (?, ?)");

                while (($data = fgetcsv($handle, 10000, $delimitador)) !== FALSE) {
                    if (count($data) < 2 || empty(trim($data[0]))) continue;

                    $codigo = strtoupper(trim($data[$colMap['CATALOG_KEY']]));
                    $descripcion = $convertirAUtf8($data[$colMap['NOMBRE']]);

                    $stmt->execute([$codigo, $descripcion]);
                    if ($stmt->rowCount() > 0) $insertados++; else $saltados++;
                }
            }

            // =========================================================
            // CASO 2: SUBIDA MASIVA DE ESPECIALIDADES 
            // =========================================================
            elseif ($seccion === 'especialidades') {
                if (!isset($colMap['cve_especialidad']) || !isset($colMap['especialidad']) || !isset($colMap['division'])) {
                    echo json_encode(['success' => false, 'error' => 'Formato inválido. El CSV de Especialidades debe incluir: cve_especialidad, especialidad y division.']);
                    exit;
                }

                $stmt = $pdo->prepare("INSERT IGNORE INTO cat_especialidades (clave, nombre, division) VALUES (?, ?, ?)");

                while (($data = fgetcsv($handle, 10000, $delimitador)) !== FALSE) {
                    if (count($data) < 3 || empty(trim($data[0]))) continue;

                    $clave = preg_replace('/[^0-9A-Z]/', '', $data[$colMap['cve_especialidad']]);
                    $nombre = $convertirAUtf8($data[$colMap['especialidad']]);
                    $division = $convertirAUtf8($data[$colMap['division']]);

                    if ($clave === '') continue;

                    $stmt->execute([$clave, $nombre, $division]);
                    if ($stmt->rowCount() > 0) $insertados++; else $saltados++;
                }
            }

            // =========================================================
            // CASO 3: SUBIDA MASIVA DE MÉDICOS (Misma Base de Datos)
            // =========================================================
            elseif ($seccion === 'medicos') {
                if (!isset($colMap['matricula']) || !isset($colMap['nombre'])) {
                    echo json_encode(['success' => false, 'error' => 'Formato inválido. El CSV de Médicos debe incluir: matricula y nombre.']);
                    exit;
                }

                $stmt = $pdo->prepare("INSERT IGNORE INTO medicos (matricula, nombre) VALUES (?, ?)");

                while (($data = fgetcsv($handle, 10000, $delimitador)) !== FALSE) {
                    if (count($data) < 2 || empty(trim($data[0]))) continue;

                    $matricula = trim($data[$colMap['matricula']]);
                    $nombreMedico = $convertirAUtf8($data[$colMap['nombre']]);

                    // Estandarización de nombres
                    if (!str_contains($nombreMedico, 'Dr. ') && !str_contains($nombreMedico, 'Lic. ')) {
                        $nombreMedico = 'Dr. ' . $nombreMedico;
                    }

                    $stmt->execute([$matricula, $nombreMedico]);
                    if ($stmt->rowCount() > 0) $insertados++; else $saltados++;
                }
            } else {
                echo json_encode(['success' => false, 'error' => 'Sección de catálogo no reconocida.']);
                exit;
            }

            fclose($handle);
            echo json_encode([
                'success' => true,
                'message' => "Procesados correctamente. Agregados nuevos: $insertados, Registros omitidos por duplicidad: $saltados."
            ]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Imposible leer el archivo de datos temporal.']);
        }
    } else {
        echo json_encode(['success' => false, 'error' => 'Petición HTTP incompleta. Falta archivo_csv o seccion.']);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Fallo crítico de base de datos: ' . $e->getMessage()]);
}

ob_end_flush();
?>