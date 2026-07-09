<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');

$archivo = __DIR__ . '/ultima_actualizacion.txt';

$fecha = file_exists($archivo)
    ? trim(file_get_contents($archivo))
    : "0";

echo json_encode([
    'ultima_actualizacion' => $fecha
]);
?>