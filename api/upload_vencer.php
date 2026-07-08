<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');

// Aumentar límites preventivos de memoria y tiempo por el volumen de registros
ini_set('max_execution_time', 300);
ini_set('memory_limit', '256M');

// Configura tus credenciales (puedes usar las mismas del archivo upload_hospitalizacion.php)
$host = 'sql112.infinityfree.com';
$dbname = 'if0_41994851_siec'; 
$username = 'if0_41994851';
$password = 'BIguNSKaR7Wnk';

// --- FUNCIONES DE LIMPIEZA ---
function normalizarFecha($f) {
    $f = trim($f);
    if (empty($f)) return null;
    // Si viene en formato DD/MM/YYYY
    if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})(.*)$/', $f, $m)) return "$m[3]-$m[2]-$m[1]";
    // Si viene en formato DD-MM-YYYY
    if (preg_match('/^(\d{2})-(\d{2})-(\d{4})(.*)$/', $f, $m)) return "$m[3]-$m[2]-$m[1]";
    // Si ya viene YYYY-MM-DD
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})(.*)$/', $f, $m)) return "$m[1]-$m[2]-$m[3]";
    return null;
}

function clasificarEdad($edad) {
    if ($edad === '' || $edad === null) return '';
    $valor = intval(preg_replace('/[^0-9-]/', '', $edad));
    if ($valor < 1) return "<1";
    if ($valor >= 1 && $valor <= 4)   return "1 a 4";
    if ($valor >= 5 && $valor <= 9)   return "5 a 9";
    if ($valor >= 10 && $valor <= 14) return "10 a 14";
    if ($valor >= 15 && $valor <= 19) return "15 a 19";
    if ($valor >= 20 && $valor <= 29) return "20 a 29";
    if ($valor >= 30 && $valor <= 39) return "30 a 39";
    if ($valor >= 40 && $valor <= 49) return "40 a 49";
    if ($valor >= 50 && $valor <= 59) return "50 a 59";
    if ($valor >= 60) return ">60";
    return $edad;
}

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");

    // Asegúrate de que el input en React envíe el archivo con el nombre 'archivo_csv'
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['archivo_csv'])) {
        $fileTmpPath = $_FILES['archivo_csv']['tmp_name'];
        
        if (($handle = fopen($fileTmpPath, "r")) !== FALSE) {
            
            // 1. LEER Y DETECTAR DELIMITADOR (Igual que en hospitalización)
            $linea1 = fgets($handle);
            $linea1Limpia = trim(trim($linea1), '"'); 
            
            $delimitador = ',';
            if (strpos($linea1Limpia, '|') !== false) $delimitador = '|';
            elseif (strpos($linea1Limpia, ';') !== false) $delimitador = ';';
            
            rewind($handle); 
            $linea1Header = fgets($handle);
            $linea1HeaderLimpia = trim(trim($linea1Header), '"');

            // 2. MAPEO DE COLUMNAS DINÁMICO
            $headers = str_getcsv($linea1HeaderLimpia, $delimitador);
            $headers = array_map(function($h) { 
                $h = preg_replace('/\xEF\xBB\xBF/', '', $h); // Limpiar BOM
                return trim(preg_replace('/[\x00-\x1F\x7F]/', '', $h)); 
            }, $headers);
            $colMap = array_flip($headers); // Convierte los nombres de columnas en índices

            // Validar que existan las columnas mínimas para operar
            if (!isset($colMap['Folio']) || !isset($colMap['Tipo evento'])) {
                echo json_encode(['success' => false, 'message' => "El archivo no tiene el formato correcto. Faltan columnas clave (Folio, Tipo evento)."]);
                exit;
            }

            // 3. PREPARAR SENTENCIAS SQL
            $pdo->beginTransaction();

            $stmtCheck = $pdo->prepare("SELECT id FROM vencer WHERE folio = ? AND evento = ? AND anio = ?");
            
            $stmtInsert = $pdo->prepare("INSERT INTO vencer 
                (folio, evento, ini_paciente, seguridad_social, edad, sexo, diagnostico, fecha_evento, fecha_noti, turno, servicio, categoria, proceso, definicion, descripcion, estatus, anio) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                
            $stmtUpdate = $pdo->prepare("UPDATE vencer SET 
                ini_paciente = ?, seguridad_social = ?, edad = ?, sexo = ?, diagnostico = ?, fecha_evento = ?, fecha_noti = ?, turno = ?, servicio = ?, categoria = ?, proceso = ?, definicion = ?, descripcion = ?, estatus = ? 
                WHERE id = ?");

            $registrosInsertados = 0;
            $registrosActualizados = 0;
            $duplicadosSaltados = 0;
            $rechazadosIgnorados = 0;

            // 4. PROCESAMIENTO FILA POR FILA
            while (($lineaRaw = fgets($handle)) !== FALSE) {
                $lineaRaw = trim($lineaRaw);
                if (empty($lineaRaw)) continue;

                $lineaRawLimpia = trim($lineaRaw, '"');
                $data = str_getcsv($lineaRawLimpia, $delimitador);

                // --- A. LIMPIEZA Y EXTRACCIÓN ---
                // Se usa el $colMap para extraer sin importar el orden de las columnas
                $estatusRaw = isset($colMap['Estatus']) && isset($data[$colMap['Estatus']]) ? trim($data[$colMap['Estatus']]) : '';
                $estatus = mb_strtoupper($estatusRaw, 'UTF-8');
                
                // FILTRO: Ignorar rechazados
                if ($estatus === 'RECHAZADO') {
                    $rechazadosIgnorados++;
                    continue;
                }

                $folio = isset($colMap['Folio']) && isset($data[$colMap['Folio']]) ? trim($data[$colMap['Folio']]) : '';
                $evento = isset($colMap['Tipo evento']) && isset($data[$colMap['Tipo evento']]) ? mb_strtoupper(trim($data[$colMap['Tipo evento']]), 'UTF-8') : '';
                $ini_paciente = isset($colMap['Iniciales del paciente']) && isset($data[$colMap['Iniciales del paciente']]) ? mb_strtoupper(trim($data[$colMap['Iniciales del paciente']]), 'UTF-8') : '';
                
                // Limpieza NSS
                $nssRaw = isset($colMap['Número de Seguridad Social']) && isset($data[$colMap['Número de Seguridad Social']]) ? trim($data[$colMap['Número de Seguridad Social']]) : '';
                $seguridad_social = preg_replace('/[^0-9]/', '', $nssRaw);
                
                // Clasificación de Edad
                $edadRaw = isset($colMap['Edad']) && isset($data[$colMap['Edad']]) ? trim($data[$colMap['Edad']]) : '';
                $edad = clasificarEdad($edadRaw);
                
                $sexo = isset($colMap['Sexo']) && isset($data[$colMap['Sexo']]) ? mb_strtoupper(trim($data[$colMap['Sexo']]), 'UTF-8') : '';
                $diagnostico = isset($colMap['Diagnóstico principal']) && isset($data[$colMap['Diagnóstico principal']]) ? ucfirst(mb_strtolower(trim($data[$colMap['Diagnóstico principal']]), 'UTF-8')) : '';
                
                // Fechas y Año
                $fechaEventoRaw = isset($colMap['Fecha evento']) && isset($data[$colMap['Fecha evento']]) ? trim($data[$colMap['Fecha evento']]) : '';
                $fecha_evento = normalizarFecha($fechaEventoRaw);
                
                $fechaNotiRaw = isset($colMap['Fecha notificación']) && isset($data[$colMap['Fecha notificación']]) ? trim($data[$colMap['Fecha notificación']]) : '';
                $fecha_noti = normalizarFecha($fechaNotiRaw);
                
                $anio = 0;
                if (!empty($fecha_evento)) {
                    $anio = (int)substr($fecha_evento, 0, 4);
                }

                $turno = isset($colMap['Turno']) && isset($data[$colMap['Turno']]) ? mb_strtoupper(trim($data[$colMap['Turno']]), 'UTF-8') : '';
                $servicio = isset($colMap['Servicio o área donde sucedió el evento']) && isset($data[$colMap['Servicio o área donde sucedió el evento']]) ? mb_strtoupper(trim($data[$colMap['Servicio o área donde sucedió el evento']]), 'UTF-8') : '';
                
                // Estos campos van sin alterar mayúsculas/minúsculas por si son descripciones largas
                $categoria = isset($colMap['Categoría que reporta el evento']) && isset($data[$colMap['Categoría que reporta el evento']]) ? trim($data[$colMap['Categoría que reporta el evento']]) : '';
                $proceso = isset($colMap['Proceso relacionado con el evento']) && isset($data[$colMap['Proceso relacionado con el evento']]) ? trim($data[$colMap['Proceso relacionado con el evento']]) : '';
                $definicion = isset($colMap['Definición operativa']) && isset($data[$colMap['Definición operativa']]) ? trim($data[$colMap['Definición operativa']]) : '';
                $descripcion = isset($colMap['Descripción detallada del evento']) && isset($data[$colMap['Descripción detallada del evento']]) ? trim($data[$colMap['Descripción detallada del evento']]) : '';


                // --- B. LÓGICA DE BASE DE DATOS ---
                // Si el folio o evento están vacíos, no insertamos
                if (empty($folio) || empty($evento)) continue;

                $stmtCheck->execute([$folio, $evento, $anio]);
                $existe = $stmtCheck->fetch(PDO::FETCH_ASSOC);

                if ($existe) {
                    // Hacer UPDATE usando el ID encontrado
                    $idDb = $existe['id'];
                    $stmtUpdate->execute([
                        $ini_paciente, $seguridad_social, $edad, $sexo, $diagnostico, 
                        $fecha_evento, $fecha_noti, $turno, $servicio, $categoria, 
                        $proceso, $definicion, $descripcion, $estatus, $idDb
                    ]);
                    $registrosActualizados++;
                } else {
                    // Hacer INSERT
                    $stmtInsert->execute([
                        $folio, $evento, $ini_paciente, $seguridad_social, $edad, 
                        $sexo, $diagnostico, $fecha_evento, $fecha_noti, $turno, 
                        $servicio, $categoria, $proceso, $definicion, $descripcion, 
                        $estatus, $anio
                    ]);
                    $registrosInsertados++;
                }
            }
            fclose($handle);
            $pdo->commit();
            
            echo json_encode([
                'success' => true, 
                'message' => "¡Carga procesada con éxito!\nNuevos: $registrosInsertados\nActualizados: $registrosActualizados\nRechazados ignorados: $rechazadosIgnorados."
            ]);
        }
    } else {
        echo json_encode(['success' => false, 'message' => "No se recibió ningún archivo."]);
    }
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error Crítico en BD: ' . $e->getMessage()]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Error de procesamiento: ' . $e->getMessage()]);
}
?>