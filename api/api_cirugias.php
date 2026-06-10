<?php
header('Access-Control-Allow-Origin: *');

$directorioDatos = __DIR__ . '/../archivos/cirugias';
$archivoSubido = $directorioDatos . '/cirugias_actual.csv';
$archivoMetadata = $directorioDatos . '/cirugias_metadata.json';
$archivoRespaldo = __DIR__ . '/../graficos/datos_cirugias_ene_mayo_2026.csv';

$usarMetadata = isset($_GET['meta']);
$archivoActivo = null;
$origen = null;

if (file_exists($archivoSubido) && filesize($archivoSubido) > 0) {
    $archivoActivo = $archivoSubido;
    $origen = 'administrador';
} elseif (file_exists($archivoRespaldo) && filesize($archivoRespaldo) > 0) {
    $archivoActivo = $archivoRespaldo;
    $origen = 'respaldo';
}

if ($usarMetadata) {
    header('Content-Type: application/json; charset=utf-8');

    $metadata = [
        'success' => (bool) $archivoActivo,
        'origen' => $origen,
        'archivo' => $archivoActivo ? basename($archivoActivo) : null,
        'bytes' => $archivoActivo ? filesize($archivoActivo) : 0,
        'actualizado_en' => $archivoActivo ? filemtime($archivoActivo) : null,
    ];

    if ($origen === 'administrador' && file_exists($archivoMetadata)) {
        $metadataGuardada = json_decode(file_get_contents($archivoMetadata), true);
        if (is_array($metadataGuardada)) {
            $metadata = array_merge($metadata, $metadataGuardada);
            $metadata['success'] = true;
            $metadata['origen'] = 'administrador';
        }
    }

    echo json_encode($metadata);
    exit;
}

if (!$archivoActivo) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'message' => 'No hay un CSV de cirugias disponible.'
    ]);
    exit;
}

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: inline; filename="cirugias_actual.csv"');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

readfile($archivoActivo);
exit;
?>
