<?php
declare(strict_types=1);

require_once __DIR__ . '/conexion.php';
require_once __DIR__ . '/auth.php';

requiereLogin();

$q = trim((string)($_GET['q'] ?? ''));

try {
    if ($q !== '') {
        $stmt = $pdo->prepare(
            'SELECT clave, descripcion, cantidad
             FROM inventario
             WHERE clave LIKE :q OR descripcion LIKE :q
             ORDER BY clave ASC, descripcion ASC'
        );
        $stmt->execute([':q' => '%' . $q . '%']);
    } else {
        $stmt = $pdo->query(
            'SELECT clave, descripcion, cantidad
             FROM inventario
             ORDER BY clave ASC, descripcion ASC'
        );
    }

    $inventario = $stmt->fetchAll();

    $metodologiaStmt = $pdo->query(
        'SELECT clave_padre, descripcion_padre, clave_hijo
         FROM metodologia
         ORDER BY clave_padre ASC, clave_hijo ASC'
    );

    $metodologia = [];

    foreach ($metodologiaStmt->fetchAll() as $row) {
        $padre = (string)$row['clave_padre'];

        if (!isset($metodologia[$padre])) {
            $metodologia[$padre] = [
                'descripcion' => (string)$row['descripcion_padre'],
                'hijos' => [],
            ];
        }

        $hijo = trim((string)$row['clave_hijo']);

        if ($hijo !== '' && !in_array($hijo, $metodologia[$padre]['hijos'], true)) {
            $metodologia[$padre]['hijos'][] = $hijo;
        }
    }

    jsonResponse([
        'ok' => true,
        'inventario' => $inventario,
        'metodologia' => $metodologia,
    ]);
} catch (Throwable $e) {
    jsonResponse([
        'ok' => false,
        'message' => 'Error al buscar datos: ' . $e->getMessage(),
    ], 500);
}
