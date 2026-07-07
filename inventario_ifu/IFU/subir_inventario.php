<?php
declare(strict_types=1);

require_once __DIR__ . '/conexion.php';
require_once __DIR__ . '/auth.php';

requiereAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['ok' => false, 'message' => 'Método no permitido'], 405);
}

$payload = json_decode(file_get_contents('php://input') ?: '', true);
$file = $payload['file'] ?? [];
$inventario = $payload['inventario'] ?? [];
$maxSize = 5 * 1024 * 1024;

if (($payload['clear'] ?? false) === true) {
    try {
        $pdo->exec('TRUNCATE TABLE inventario');
        jsonResponse([
            'ok' => true,
            'message' => 'Inventario borrado correctamente',
            'total' => 0,
        ]);
    } catch (Throwable $e) {
        jsonResponse([
            'ok' => false,
            'message' => 'Error al borrar inventario: ' . $e->getMessage(),
        ], 500);
    }
}

if (!is_array($file) || !is_array($inventario)) {
    jsonResponse(['ok' => false, 'message' => 'Solicitud inválida'], 400);
}

$fileName = (string)($file['name'] ?? '');
$fileSize = (int)($file['size'] ?? 0);
$extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

if (!in_array($extension, ['xlsx', 'csv'], true)) {
    jsonResponse(['ok' => false, 'message' => 'Solo se permiten archivos .xlsx o .csv'], 400);
}

if ($fileSize <= 0 || $fileSize > $maxSize) {
    jsonResponse(['ok' => false, 'message' => 'El archivo debe pesar máximo 5 MB'], 400);
}

if (count($inventario) === 0) {
    jsonResponse(['ok' => false, 'message' => 'No se detectaron columnas obligatorias de inventario'], 400);
}

foreach ($inventario as $item) {
    if (
        !is_array($item) ||
        trim((string)($item['clave'] ?? '')) === '' ||
        trim((string)($item['descripcion'] ?? '')) === '' ||
        !array_key_exists('cantidad', $item)
    ) {
        jsonResponse([
            'ok' => false,
            'message' => 'Columnas obligatorias: clave, descripcion, cantidad',
        ], 400);
    }
}

try {
    $pdo->beginTransaction();
    $pdo->exec('DELETE FROM inventario');

    $stmt = $pdo->prepare(
        'INSERT INTO inventario (clave, descripcion, cantidad)
         VALUES (:clave, :descripcion, :cantidad)'
    );

    foreach ($inventario as $item) {
        $stmt->execute([
            ':clave' => trim((string)$item['clave']),
            ':descripcion' => trim((string)$item['descripcion']),
            ':cantidad' => (int)$item['cantidad'],
        ]);
    }

    $pdo->commit();

    jsonResponse([
        'ok' => true,
        'message' => 'Inventario actualizado correctamente',
        'total' => count($inventario),
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    jsonResponse([
        'ok' => false,
        'message' => 'Error al guardar inventario: ' . $e->getMessage(),
    ], 500);
}
