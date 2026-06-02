<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');

$host = 'sql112.infinityfree.com';
$dbname = 'if0_41994851_siec'; 
$username = 'if0_41994851';
$password = 'BIguNSKaR7Wnk';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");

    // A. CARGAR EN MEMORIA EL DICCIONARIO DE ESPECIALIDADES
    $diccEspecialidades = [];
    $queryEsp = $pdo->query("SELECT clave, nombre, division FROM cat_especialidades");
    while ($rowEsp = $queryEsp->fetch(PDO::FETCH_ASSOC)) {
        $diccEspecialidades[trim($rowEsp['clave'])] = [
            'nombre' => trim($rowEsp['nombre']),
            'division' => trim($rowEsp['division'])
        ];
    }

    // B. CARGAR EN MEMORIA EL DICCIONARIO CIE-10
    $diccCIE = [];
    $queryCIE = $pdo->query("SELECT codigo, descripcion FROM cat_cie10");
    while ($rowCIE = $queryCIE->fetch(PDO::FETCH_ASSOC)) {
        $diccCIE[strtoupper(trim($rowCIE['codigo']))] = trim($rowCIE['descripcion']);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['archivo_csv'])) {
        $fileTmpPath = $_FILES['archivo_csv']['tmp_name'];
        
        if (($handle = fopen($fileTmpPath, "r")) !== FALSE) {
            $linea1 = fgets($handle);
            $delimitador = strpos($linea1, ';') !== false ? ';' : ',';
            rewind($handle); 

            $headers = fgetcsv($handle, 10000, $delimitador);
            $headers = array_map(function($h) { 
                $h = preg_replace('/\xEF\xBB\xBF/', '', $h); 
                return trim(preg_replace('/[\x00-\x1F\x7F]/', '', $h)); 
            }, $headers);
            $colMap = array_flip($headers);

            // Cambiamos 'aniom' y 'mesm' por la columna nativa de fecha de egreso 'FEEGR'
            $columnasRequeridas = ['FEEGR', 'esp', 'diasest', 'diagprincipalegreso', 'des_motivo_egreso'];
            foreach ($columnasRequeridas as $req) {
                if (!isset($colMap[$req])) {
                    echo json_encode(['success' => false, 'message' => "Falta la columna requerida en el reporte: $req"]);
                    exit;
                }
            }

            $stmt = $pdo->prepare("INSERT IGNORE INTO hospitalizacion_externa 
                (division, especialidad, anio, mes, dias_estancia, diagnostico_egreso, motivo_egreso) 
                VALUES (?, ?, ?, ?, ?, ?, ?)");

            $registrosInsertados = 0;
            $duplicadosSaltados = 0;

            while (($data = fgetcsv($handle, 10000, $delimitador)) !== FALSE) {
                if (count($data) < 4 || empty(trim($data[0]))) continue; 

                // --- 1. PROCESAMIENTO DE FECHA DE EGRESO (CALENDARIO IMSS) ---
                $fechaHoraBruta = trim($data[$colMap['FEEGR']]);
                $fechaSola = explode(' ', $fechaHoraBruta)[0]; // Aislamos el componente DD/MM/YYYY quitando la hora HH:MM
                
                $f = date_create_from_format('d/m/Y', $fechaSola);
                if (!$f) {
                    $f = date_create_from_format('Y-m-d', $fechaSola);
                }

                if ($f) {
                    $diaNatural = (int)$f->format('d');
                    $mesNatural = (int)$f->format('m');
                    $anioNatural = (int)$f->format('Y');

                    // 🚀 REGLA DE ORO DEL IMSS: Si es día 26 o superior, brinca al siguiente Mes Institucional
                    if ($diaNatural >= 26) {
                        $mesImss = $mesNatural + 1;
                        $anioImss = $anioNatural;
                        
                        // Si el mes brinca a 13, significa que era 26-Diciembre, pasa a ser Enero (1) del siguiente año
                        if ($mesImss === 13) {
                            $mesImss = 1;
                            $anioImss = $anioNatural + 1;
                        }
                    } else {
                        // Si es del 1 al 25, se queda en el mes y año natural corriendo
                        $mesImss = $mesNatural;
                        $anioImss = $anioNatural;
                    }
                } else {
                    // Si la celda de fecha viene corrupta o vacía, saltamos el registro por seguridad analítica
                    continue;
                }

                // --- 2. TRADUCCIÓN DE ESPECIALIDADES ---
                $claveEsp = preg_replace('/[^0-9A-Z]/', '', $data[$colMap['esp']]);
                $claveEspClean = str_replace('.0', '', $claveEsp);

                $division = $diccEspecialidades[$claveEspClean]['division'] ?? "SIN DIVISION ASIGNADA";
                $especialidad = $diccEspecialidades[$claveEspClean]['nombre'] ?? "ESPECIALIDAD CP: " . $claveEspClean;

                // --- 3. TRADUCCIÓN DE DIAGNÓSTICOS CIE-10 ---
                $codigoCIE = strtoupper(trim($data[$colMap['diagprincipalegreso']]));
                if (isset($diccCIE[$codigoCIE])) {
                    $diagnosticoFinal = $codigoCIE . " - " . $diccCIE[$codigoCIE];
                } else {
                    $diagnosticoFinal = "CIE-10: " . $codigoCIE;
                }

                $diagnosticoFinal = html_entity_decode($diagnosticoFinal, ENT_QUOTES | ENT_HTML5, 'UTF-8');
                if (!mb_check_encoding($diagnosticoFinal, 'UTF-8')) {
                    $diagnosticoFinal = mb_convert_encoding($diagnosticoFinal, 'UTF-8', 'Windows-1252');
                }

                // --- 4. TRADUCCIÓN DE MOTIVOS DE EGRESO ---
                $diasEstancia = (int)$data[$colMap['diasest']];
                $motivoEgreso = strtoupper(trim($data[$colMap['des_motivo_egreso']]));
                
                $motivoFinal = html_entity_decode($motivoEgreso, ENT_QUOTES | ENT_HTML5, 'UTF-8');
                if (!mb_check_encoding($motivoFinal, 'UTF-8')) {
                    $motivoFinal = mb_convert_encoding($motivoFinal, 'UTF-8', 'Windows-1252');
                }

                // Insertamos usando las variables institucionales $anioImss y $mesImss
                $stmt->execute([
                    $division, 
                    $especialidad, 
                    $anioImss, 
                    $mesImss, 
                    $diasEstancia, 
                    $diagnosticoFinal, 
                    $motivoFinal
                ]);

                if ($stmt->rowCount() > 0) $registrosInsertados++; else $duplicadosSaltados++;
            }
            fclose($handle);
            
            echo json_encode([
                'success' => true, 
                'message' => "¡Carga Masiva Exitosa! Periodos IMSS recalculados (26-25). Egresos nuevos: $registrosInsertados, Duplicados saltados: $duplicadosSaltados."
            ]);
        }
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error Crítico en BD Hospitalización: ' . $e->getMessage()]);
}
?>