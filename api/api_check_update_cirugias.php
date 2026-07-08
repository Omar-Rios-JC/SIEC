<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');


$archivo = __DIR__ . '/ultima_actualizacion_cirugias.txt';


if(file_exists($archivo)){

    $timestamp = trim(file_get_contents($archivo));

    echo json_encode([
        "ultima_actualizacion" => $timestamp
    ]);

}else{

    echo json_encode([
        "ultima_actualizacion" => null
    ]);

}

?>