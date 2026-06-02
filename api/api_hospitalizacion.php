<?php
// 1. ACTIVAR COMPRESIÓN GZIP (Reduce el tamaño de la transferencia un 90%)
if (substr_count($_SERVER['HTTP_ACCEPT_ENCODING'], 'gzip')) {
    ob_start("ob_gzhandler");
} else {
    ob_start();
}

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');

ini_set('memory_limit', '256M');
set_time_limit(300); 

$host = 'sql112.infinityfree.com';
$dbname = 'if0_41994851_siec'; 
$username = 'if0_41994851';
$password = 'BIguNSKaR7Wnk';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // 2. CONSULTA OPTIMIZADA: Traemos los campos limpios que React necesita procesar
    $sql = "SELECT 
                division, 
                especialidad, 
                anio, 
                mes, 
                dias_estancia, 
                diagnostico_egreso, 
                motivo_egreso 
            FROM hospitalizacion_externa";
            
    $stmt = $pdo->prepare($sql);
    $stmt->execute();

    echo '['; 
    $primeraFila = true;
    
    // FETCH_ASSOC con Streaming directo para no saturar el servidor
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        if (!$primeraFila) {
            echo ','; 
        }
        echo json_encode($row); 
        $primeraFila = false;
    }
    
    echo ']'; 

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Error de BD Hospitalización: ' . $e->getMessage()]);
}

// Enviar el buffer comprimido al navegador
ob_end_flush();
?>