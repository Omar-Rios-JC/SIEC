<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');

ini_set('max_execution_time', 300);
ini_set('memory_limit', '256M');

$directorioDatos = __DIR__ . '/../archivos/cirugias';
$archivoDestino = $directorioDatos . '/cirugias_actual.csv';
$archivoMetadata = $directorioDatos . '/cirugias_metadata.json';
$archivoVersion = __DIR__ . '/ultima_actualizacion_cirugias.txt';

function responder($success, $message, $extra = [], $statusCode = 200)
{
    http_response_code($statusCode);
    echo json_encode(array_merge([
        'success' => $success,
        'message' => $message,
    ], $extra));
    exit;
}

function convertirUtf8($valor)
{
    $texto = (string) $valor;
    $encoding = mb_detect_encoding($texto, ['UTF-8', 'Windows-1252', 'ISO-8859-1'], true);

    if ($encoding && $encoding !== 'UTF-8') {
        return mb_convert_encoding($texto, 'UTF-8', $encoding);
    }

    return $texto;
}

function normalizarEncabezado($valor)
{
    $texto = convertirUtf8($valor);
    $texto = preg_replace('/^\xEF\xBB\xBF/', '', $texto);
    $texto = preg_replace('/^\x{FEFF}/u', '', $texto);
    $texto = trim($texto);
    $texto = mb_strtolower($texto, 'UTF-8');

    $sinAcentos = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $texto);
    if ($sinAcentos !== false) {
        $texto = $sinAcentos;
    }

    $texto = preg_replace('/[^a-z0-9]+/', ' ', $texto);
    return trim(preg_replace('/\s+/', ' ', $texto));
}

function detectarDelimitador($linea)
{
    $delimitadores = [',', ';', '|', "\t"];
    $mejorDelimitador = ',';
    $mayorColumnas = 0;

    foreach ($delimitadores as $delimitador) {
        $columnas = str_getcsv($linea, $delimitador);
        $total = count($columnas);

        if ($total > $mayorColumnas) {
            $mayorColumnas = $total;
            $mejorDelimitador = $delimitador;
        }
    }

    return $mejorDelimitador;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_FILES['archivo_csv'])) {
    responder(false, 'No se recibio el archivo "archivo_csv".', [], 400);
}

$archivo = $_FILES['archivo_csv'];

if ($archivo['error'] !== UPLOAD_ERR_OK || empty($archivo['tmp_name'])) {
    responder(false, 'No se pudo recibir el archivo CSV.', [], 400);
}

$extension = strtolower(pathinfo($archivo['name'], PATHINFO_EXTENSION));
if ($extension !== 'csv') {
    responder(false, 'El archivo debe tener extension .csv.', [], 400);
}

$handle = fopen($archivo['tmp_name'], 'r');
if (!$handle) {
    responder(false, 'No se pudo abrir el archivo temporal.', [], 500);
}

$lineaHeader = fgets($handle);
if ($lineaHeader === false) {
    fclose($handle);
    responder(false, 'El archivo CSV esta vacio.', [], 400);
}

$delimitador = detectarDelimitador($lineaHeader);
$headers = str_getcsv($lineaHeader, $delimitador);
$headersNormalizados = array_map('normalizarEncabezado', $headers);

function existeColumna($headersNormalizados, $candidatos)
{
    foreach ($headersNormalizados as $header) {
        foreach ($candidatos as $candidato) {
            if ($header === $candidato || strpos($header, $candidato) !== false) {
                return true;
            }
        }
    }

    return false;
}

$columnasRequeridas = [
    'folio' => ['no folio', 'folio'],
    'estatus qx' => ['estatus qx', 'estatus'],
    'area donde se genero la solicitud' => ['area donde se genero la solicitud', 'rea donde se genero la solicitud', 'area'],
    'especialidad' => ['especialidad'],
    'fecha de la solicitud' => ['fecha de la solicitud', 'fecha solicitud'],
];

$faltantes = [];
foreach ($columnasRequeridas as $nombre => $candidatos) {
    if (!existeColumna($headersNormalizados, $candidatos)) {
        $faltantes[] = $nombre;
    }
}

if (!empty($faltantes)) {
    fclose($handle);
    responder(
        false,
        'El CSV no parece ser el reporte de cirugias. Faltan columnas: ' . implode(', ', $faltantes) . '.',
        [],
        400
    );
}

$filas = 0;
while (($data = fgetcsv($handle, 0, $delimitador)) !== false) {
    if (count(array_filter($data, function ($valor) { return trim((string) $valor) !== ''; })) === 0) {
        continue;
    }

    $filas++;
}
fclose($handle);

if ($filas === 0) {
    responder(false, 'El CSV no contiene registros para procesar.', [], 400);
}

if (!is_dir($directorioDatos) && !mkdir($directorioDatos, 0775, true)) {
    responder(false, 'No se pudo crear la carpeta de almacenamiento de cirugias.', [], 500);
}

if (!move_uploaded_file($archivo['tmp_name'], $archivoDestino)) {
    if (!copy($archivo['tmp_name'], $archivoDestino)) {
        responder(false, 'No se pudo guardar el CSV de cirugias en el servidor.', [], 500);
    }
}

$timestamp = time();
$metadata = [
    'archivo_original' => $archivo['name'],
    'registros' => $filas,
    'bytes' => filesize($archivoDestino),
    'actualizado_en' => $timestamp,
    'actualizado_en_legible' => date('Y-m-d H:i:s', $timestamp),
];

file_put_contents($archivoMetadata, json_encode($metadata, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
file_put_contents($archivoVersion, (string) $timestamp);

responder(true, "Carga de cirugias completada. Registros disponibles: $filas.", $metadata);
?>
