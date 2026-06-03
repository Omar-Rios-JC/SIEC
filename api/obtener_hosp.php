<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');

$host = 'sql112.infinityfree.com';
$dbname = 'if0_41994851_siec';
$username = 'if0_41994851';
$password = 'BIguNSKaR7Wnk';

function responder($payload, $code = 200) {
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function asegurarTabla(PDO $pdo) {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS indicadores_hosp (
            id INT AUTO_INCREMENT PRIMARY KEY,
            anio INT NOT NULL,
            indicador VARCHAR(20) NOT NULL,
            mes VARCHAR(10) NOT NULL,
            mes_orden TINYINT NOT NULL,
            numerador DECIMAL(14,2) NOT NULL DEFAULT 0,
            denominador DECIMAL(14,2) NOT NULL DEFAULT 0,
            auxiliar DECIMAL(14,2) NOT NULL DEFAULT 0,
            porcentaje DECIMAL(10,2) NOT NULL DEFAULT 0,
            actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_indicador_anio_mes (anio, indicador, mes_orden)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
}

try {
    $anio = isset($_GET['anio']) ? (int) $_GET['anio'] : (int) date('Y');
    $indicador = isset($_GET['indicador']) ? strtoupper(trim($_GET['indicador'])) : 'HOSP_01';

    if ($anio < 2000 || $anio > 2100) {
        responder(['success' => false, 'message' => 'Anio invalido.'], 400);
    }

    if (!preg_match('/^HOSP_(0[1-9]|10)$/', $indicador)) {
        responder(['success' => false, 'message' => 'Indicador invalido.'], 400);
    }

    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");
    asegurarTabla($pdo);

    $stmt = $pdo->prepare("
        SELECT mes, numerador, denominador, auxiliar, porcentaje
        FROM indicadores_hosp
        WHERE anio = ? AND indicador = ?
        ORDER BY mes_orden ASC
    ");
    $stmt->execute([$anio, $indicador]);

    $datos = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $datos[] = [
            'mes' => $row['mes'],
            'numerador' => (float) $row['numerador'],
            'denominador' => (float) $row['denominador'],
            'auxiliar' => (float) $row['auxiliar'],
            'porcentaje' => (float) $row['porcentaje']
        ];
    }

    responder(['success' => true, 'datos' => $datos]);
} catch (PDOException $e) {
    responder(['success' => false, 'message' => 'Error de BD HOSP: ' . $e->getMessage()], 500);
}
?>