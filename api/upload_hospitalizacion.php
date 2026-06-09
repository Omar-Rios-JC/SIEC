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
        // Guardamos la clave en mayúsculas y limpia de puntos para máxima compatibilidad
        $codigoLimpioDicc = strtoupper(str_replace('.', '', trim($rowCIE['codigo'])));
        $diccCIE[$codigoLimpioDicc] = trim($rowCIE['descripcion']);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['archivo_csv'])) {
        $fileTmpPath = $_FILES['archivo_csv']['tmp_name'];
        
        if (($handle = fopen($fileTmpPath, "r")) !== FALSE) {
            // 1. LEER LA PRIMERA LÍNEA COMO STRING PURO
            $linea1 = fgets($handle);
            
            // VACUNA 1: Quitamos las comillas dobles externas del bloque completo si existen
            $linea1Limpia = trim($linea1);
            $linea1Limpia = trim($linea1Limpia, '"'); 
            
            // Detectamos el delimitador de forma automática sobre la línea ya limpia
            if (strpos($linea1Limpia, '|') !== false) {
                $delimitador = '|';
            } elseif (strpos($linea1Limpia, ';') !== false) {
                $delimitador = ';';
            } else {
                $delimitador = ',';
            }
            rewind($handle); // Reiniciamos el puntero para que str_getcsv procese desde el inicio

            // Volvemos a leer la primera línea pero ya limpia para construir los headers
            $linea1Header = fgets($handle);
            $linea1HeaderLimpia = trim($linea1Header);
            $linea1HeaderLimpia = trim($linea1HeaderLimpia, '"');

            $headers = str_getcsv($linea1HeaderLimpia, $delimitador);
            $headers = array_map(function($h) { 
                $h = preg_replace('/\xEF\xBB\xBF/', '', $h); 
                return trim(preg_replace('/[\x00-\x1F\x7F]/', '', $h)); 
            }, $headers);
            $colMap = array_flip($headers);

            // Verificación estricta de tus columnas requeridas fijas
            $columnasRequeridas = ['FEEGR', 'ESP', 'DIASEST', 'DiagPrincipalEgreso', 'des_motivo_egreso'];
            foreach ($columnasRequeridas as $req) {
                if (!isset($colMap[$req])) {
                    echo json_encode(['success' => false, 'message' => "Falta la columna requerida en el reporte: $req"]);
                    exit;
                }
            }

            // Iniciar transacción masiva para burlar los límites de CPU del hosting gratuito
            $pdo->beginTransaction();

            $stmt = $pdo->prepare("INSERT IGNORE INTO hospitalizacion_externa 
                (division, especialidad, anio, mes, dias_estancia, diagnostico_egreso, motivo_egreso) 
                VALUES (?, ?, ?, ?, ?, ?, ?)");

            $registrosInsertados = 0;
            $duplicadosSaltados = 0;

            // 2. PROCESAR EL RESTO DE LAS FILAS DE MANERA ENCAPSULADA
            while (($lineaRaw = fgets($handle)) !== FALSE) {
                $lineaRaw = trim($lineaRaw);
                if (empty($lineaRaw)) continue;

                // VACUNA 2: Le arrancamos las comillas externas a la fila de datos completa
                $lineaRawLimpia = trim($lineaRaw, '"');

                // Segmentamos las columnas usando el delimitador detectado
                $data = str_getcsv($lineaRawLimpia, $delimitador);

                if (count($data) < count($colMap)) continue; 

                $idxFecha = $colMap['FEEGR'];
                if (!isset($data[$idxFecha]) || empty(trim($data[$idxFecha]))) continue;

                // --- 1. PROCESAMIENTO DE FECHA DE EGRESO (CALENDARIO IMSS 26-25) ---
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

            // =================================================================
            // PARCHAR HISTÓRICOS DESVINCULADOS
            // =================================================================
            if (!empty($diccEspecialidades)) {
                $stmtUpdate = $pdo->prepare("UPDATE hospitalizacion_externa 
                    SET division = ?, especialidad = ? 
                    WHERE especialidad = ?");

                foreach ($diccEspecialidades as $clave => $info) {
                    $textoHuerfano = "ESPECIALIDAD CP: " . $clave;
                    $stmtUpdate->execute([
                        $info['division'],
                        $info['nombre'],
                        $textoHuerfano
                    ]);
                }
            }
            // =================================================================
            
            $pdo->commit();
            
            echo json_encode([
                'success' => true, 
                'message' => "¡Carga Masiva Exitosa! Formato encapsulado de la plataforma procesado correctamente. Egresos nuevos: $registrosInsertados, Duplicados saltados: $duplicadosSaltados."
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