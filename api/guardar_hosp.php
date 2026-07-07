<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

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
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        responder(['success' => false, 'message' => 'Metodo no permitido.'], 405);
    }

    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        responder(['success' => false, 'message' => 'JSON invalido.'], 400);
    }

    $anio = isset($payload['anio']) ? (int) $payload['anio'] : 0;
    $datosBatch = $payload['datosBatch'] ?? [];

    if ($anio < 2000 || $anio > 2100) {
        responder(['success' => false, 'message' => 'Anio invalido.'], 400);
    }

    if (!is_array($datosBatch) || count($datosBatch) === 0) {
        responder(['success' => false, 'message' => 'No se recibieron datos para guardar.'], 400);
    }

    $ordenMes = [
        'Ene' => 1,
        'Feb' => 2,
        'Mar' => 3,
        'Abr' => 4,
        'May' => 5,
        'Jun' => 6,
        'Jul' => 7,
        'Ago' => 8,
        'Sep' => 9,
        'Oct' => 10,
        'Nov' => 11,
        'Dic' => 12
    ];

    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");
    asegurarTabla($pdo);

    $stmt = $pdo->prepare("
        INSERT INTO indicadores_hosp
            (anio, indicador, mes, mes_orden, numerador, denominador, auxiliar, porcentaje)
        VALUES
            (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            mes = VALUES(mes),
            numerador = VALUES(numerador),
            denominador = VALUES(denominador),
            auxiliar = VALUES(auxiliar),
            porcentaje = VALUES(porcentaje)
    ");

    $pdo->beginTransaction();
    $guardados = 0;

    foreach ($datosBatch as $fila) {
        $indicador = strtoupper(trim($fila['indicador'] ?? ''));
        $mes = trim($fila['mes'] ?? '');

        if (!preg_match('/^HOSP_(0[1-9]|10)$/', $indicador) || !isset($ordenMes[$mes])) {
            continue;
        }

        $stmt->execute([
            $anio,
            $indicador,
            $mes,
            $ordenMes[$mes],
            (float) ($fila['numerador'] ?? 0),
            (float) ($fila['denominador'] ?? 0),
            (float) ($fila['auxiliar'] ?? 0),
            (float) ($fila['porcentaje'] ?? 0)
        ]);

        $guardados++;
    }

    $pdo->commit();

    responder([
        'success' => true,
        'message' => "Indicadores HOSP guardados: $guardados.",
        'guardados' => $guardados
    ]);
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    responder(['success' => false, 'message' => 'Error de BD HOSP: ' . $e->getMessage()], 500);
}
?>