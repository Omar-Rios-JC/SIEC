<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');

<<<<<<< HEAD
// Buscamos un archivo de texto donde guardaremos la fecha del último CSV
$archivo = 'ultima_actualizacion.txt';

// Si el archivo existe, leemos la fecha. Si no, devolvemos 0.
$fecha = file_exists($archivo) ? file_get_contents($archivo) : "0";

echo json_encode(['ultima_actualizacion' => $fecha]);
=======
$archivo = __DIR__ . '/ultima_actualizacion.txt';

$fecha = file_exists($archivo)
    ? trim(file_get_contents($archivo))
    : "0";

echo json_encode([
    'ultima_actualizacion' => $fecha
]);
>>>>>>> f01db6b1ce85c058bf31e25e14622d40c3461e89
?>