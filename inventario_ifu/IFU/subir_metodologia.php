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
$metodologia = $payload['metodologia'] ?? [];
$maxSize = 5 * 1024 * 1024;

if (($payload['clear'] ?? false) === true) {
    try {
        $pdo->exec('TRUNCATE TABLE metodologia');
        jsonResponse([
            'ok' => true,
            'message' => 'Metodología borrada correctamente',
            'total' => 0,
        ]);
    } catch (Throwable $e) {
        jsonResponse([
            'ok' => false,
            'message' => 'Error al borrar metodología: ' . $e->getMessage(),
        ], 500);
    }
}

if (!is_array($file) || !is_array($metodologia)) {
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

if (count($metodologia) === 0) {
    jsonResponse(['ok' => false, 'message' => 'No se detectaron columnas obligatorias de metodología'], 400);
}

foreach ($metodologia as $clavePadre => $relacion) {
    if (
        trim((string)$clavePadre) === '' ||
        !is_array($relacion) ||
        trim((string)($relacion['descripcion'] ?? '')) === '' ||
        !isset($relacion['hijos']) ||
        !is_array($relacion['hijos'])
    ) {
        jsonResponse([
            'ok' => false,
            'message' => 'Columnas obligatorias: clave padre, descripción e hijos',
        ], 400);
    }
}

try {
    $pdo->beginTransaction();
    $pdo->exec('DELETE FROM metodologia');

    $stmt = $pdo->prepare(
        'INSERT INTO metodologia (clave_padre, descripcion_padre, clave_hijo)
         VALUES (:clave_padre, :descripcion_padre, :clave_hijo)'
    );

    $total = 0;

    foreach ($metodologia as $clavePadre => $relacion) {
        $hijos = $relacion['hijos'];

        if (count($hijos) === 0) {
            $stmt->execute([
                ':clave_padre' => trim((string)$clavePadre),
                ':descripcion_padre' => trim((string)$relacion['descripcion']),
                ':clave_hijo' => '',
            ]);
            $total++;
            continue;
        }

        foreach ($hijos as $claveHijo) {
            $stmt->execute([
                ':clave_padre' => trim((string)$clavePadre),
                ':descripcion_padre' => trim((string)$relacion['descripcion']),
                ':clave_hijo' => trim((string)$claveHijo),
            ]);
            $total++;
        }
    }

    $pdo->commit();

    jsonResponse([
        'ok' => true,
        'message' => 'Metodología actualizada correctamente',
        'total' => $total,
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    jsonResponse([
        'ok' => false,
        'message' => 'Error al guardar metodología: ' . $e->getMessage(),
    ], 500);
}
