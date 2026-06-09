<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');

// Aumentar límites preventivos de memoria y tiempo por el volumen de egresos
ini_set('max_execution_time', 300);
ini_set('memory_limit', '256M');

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
        // Guardamos la clave en mayúsculas y limpia de puntos
        $codigoLimpioDicc = strtoupper(str_replace('.', '', trim($rowCIE['codigo'])));
        $diccCIE[$codigoLimpioDicc] = trim($rowCIE['descripcion']);
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

            // CORRECCIÓN: Línea exacta proporcionada por ti
            $columnasRequeridas = ['FEEGR', 'ESP', 'DIASEST', 'DiagPrincipalEgreso', 'des_motivo_egreso'];
            foreach ($columnasRequeridas as $req) {
                if (!isset($colMap[$req])) {
                    echo json_encode(['success' => false, 'message' => "Falta la columna requerida en el reporte: $req"]);
                    exit;
                }
            }

            // Iniciar transacción masiva para burlar límites de CPU
            $pdo->beginTransaction();

            $stmt = $pdo->prepare("INSERT IGNORE INTO hospitalizacion_externa 
                (division, especialidad, anio, mes, dias_estancia, diagnostico_egreso, motivo_egreso) 
                VALUES (?, ?, ?, ?, ?, ?, ?)");

            $registrosInsertados = 0;
            $duplicadosSaltados = 0;

            while (($data = fgetcsv($handle, 10000, $delimitador)) !== FALSE) {
                if (count($data) < count($colMap)) continue; 

                $idxFecha = $colMap['FEEGR'];
                if (!isset($data[$idxFecha]) || empty(trim($data[$idxFecha]))) continue;

                // --- 1. PROCESAMIENTO DE FECHA DE EGRESO (CALENDARIO IMSS) ---
                $fechaHoraBruta = trim($data[$idxFecha]);
                $fechaSola = explode(' ', $fechaHoraBruta)[0]; 
                
                $f = date_create_from_format('d/m/Y', $fechaSola);
                if (!$f) {
                    $f = date_create_from_format('Y-m-d', $fechaSola);
                }

                if ($f) {
                    $diaNatural = (int)$f->format('d');
                    $mesNatural = (int)$f->format('m');
                    $anioNatural = (int)$f->format('Y');

                    if ($diaNatural >= 26) {
                        $mesImss = $mesNatural + 1;
                        $anioImss = $anioNatural;
                        if ($mesImss === 13) {
                            $mesImss = 1;
                            $anioImss = $anioNatural + 1;
                        }
                    } else {
                        $mesImss = $mesNatural;
                        $anioImss = $anioNatural;
                    }
                } else {
                    continue; 
                }

                // --- 2. TRADUCCIÓN DE ESPECIALIDADES (USANDO 'ESP') ---
                $valorEsp = isset($data[$colMap['ESP']]) ? $data[$colMap['ESP']] : '';
                $claveEspClean = preg_replace('/[^0-9A-Z]/', '', strtoupper(trim($valorEsp)));
                $claveEspClean = str_replace('.0', '', $claveEspClean);

                $division = "SIN DIVISION ASIGNADA";
                $especialidad = "ESPECIALIDAD CP: " . $claveEspClean;

                if (isset($diccEspecialidades[$claveEspClean])) {
                    $division = $diccEspecialidades[$claveEspClean]['division'];
                    $especialidad = $diccEspecialidades[$claveEspClean]['nombre'];
                } else {
                    $claveSinCeros = ltrim($claveEspClean, '0');
                    if (!empty($claveSinCeros) && isset($diccEspecialidades[$claveSinCeros])) {
                        $division = $diccEspecialidades[$claveSinCeros]['division'];
                        $especialidad = $diccEspecialidades[$claveSinCeros]['nombre'];
                    }
                }

                // --- 3. TRADUCCIÓN DE DIAGNÓSTICOS CIE-10 (USANDO 'DiagPrincipalEgreso') ---
                $valorCIE = isset($data[$colMap['DiagPrincipalEgreso']]) ? $data[$colMap['DiagPrincipalEgreso']] : '';
                $codigoCIE = strtoupper(str_replace('.', '', trim($valorCIE)));
                
                if (isset($diccCIE[$codigoCIE])) {
                    $diagnosticoFinal = $codigoCIE . " - " . $diccCIE[$codigoCIE];
                } else {
                    $subCodigo3 = substr($codigoCIE, 0, 3);
                    if (isset($diccCIE[$subCodigo3])) {
                        $diagnosticoFinal = $codigoCIE . " - " . $diccCIE[$subCodigo3];
                    } else {
                        $diagnosticoFinal = "CIE-10: " . $codigoCIE;
                    }
                }

                $diagnosticoFinal = html_entity_decode($diagnosticoFinal, ENT_QUOTES | ENT_HTML5, 'UTF-8');
                if (!mb_check_encoding($diagnosticoFinal, 'UTF-8')) {
                    $diagnosticoFinal = mb_convert_encoding($diagnosticoFinal, 'UTF-8', 'Windows-1252');
                }

                // --- 4. TRADUCCIÓN DE MOTIVOS DE EGRESO (USANDO 'DIASEST' Y 'des_motivo_egreso') ---
                $diasEstancia = isset($data[$colMap['DIASEST']]) ? (int)$data[$colMap['DIASEST']] : 0;
                $valorMotivo = isset($data[$colMap['des_motivo_egreso']]) ? $data[$colMap['des_motivo_egreso']] : '';
                $motivoEgreso = strtoupper(trim($valorMotivo));
                
                $motivoFinal = html_entity_decode($motivoEgreso, ENT_QUOTES | ENT_HTML5, 'UTF-8');
                if (!mb_check_encoding($motivoFinal, 'UTF-8')) {
                    $motivoFinal = mb_convert_encoding($motivoFinal, 'UTF-8', 'Windows-1252');
                }

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

            // Recorremos el diccionario de especialidades que acabamos de leer de la BD
            if (!empty($diccEspecialidades)) {
                $stmtUpdate = $pdo->prepare("UPDATE hospitalizacion_externa 
                    SET division = ?, especialidad = ? 
                    WHERE especialidad = ?");

                foreach ($diccEspecialidades as $clave => $info) {
                    // El texto que se guardó erróneamente en el pasado cuando no existía la clave:
                    $textoHuerfano = "ESPECIALIDAD CP: " . $clave;
                    
                    // Ejecutamos la actualización para rescatar los registros viejos
                    $stmtUpdate->execute([
                        $info['division'],
                        $info['nombre'],
                        $textoHuerfano
                    ]);
                }
            }
            
            $pdo->commit();
            
            echo json_encode([
                'success' => true, 
                'message' => "¡Carga Masiva Exitosa! Periodos IMSS recalculados (26-25). Egresos nuevos: $registrosInsertados, Duplicados saltados: $duplicadosSaltados."
            ]);
        }
    }
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error Crítico en BD Hospitalización: ' . $e->getMessage()]);
}
?>