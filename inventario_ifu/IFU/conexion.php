<?php
declare(strict_types=1);

/*
 * InfinityFree:
 * 1. Crea la base de datos desde el panel.
 * 2. Copia aquí el host, nombre de BD, usuario y contraseña que te da InfinityFree.
 *
 * XAMPP local:
 * $host = 'localhost';
 * $database = 'inventario_ifu';
 * $user = 'root';
 * $password = '';
 */
$host = 'localhost';
$database = 'inventario_ifu';
$user = 'root';
$password = '';
$charset = 'utf8mb4';

function jsonResponse(array $data, int $statusCode = 200): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    try {
        $pdo = new PDO(
            "mysql:host={$host};dbname={$database};charset={$charset}",
            $user,
            $password,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        );
    } catch (PDOException $e) {
        $pdoServer = new PDO(
            "mysql:host={$host};charset={$charset}",
            $user,
            $password,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        );

        $pdoServer->exec(
            "CREATE DATABASE IF NOT EXISTS `{$database}`
             CHARACTER SET utf8mb4
             COLLATE utf8mb4_unicode_ci"
        );

        $pdo = new PDO(
            "mysql:host={$host};dbname={$database};charset={$charset}",
            $user,
            $password,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        );
    }

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS usuarios (
            id INT AUTO_INCREMENT PRIMARY KEY,
            usuario VARCHAR(50) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            rol ENUM('admin','usuario') NOT NULL DEFAULT 'usuario',
            nombre VARCHAR(100) NOT NULL,
            activo TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS inventario (
            id INT AUTO_INCREMENT PRIMARY KEY,
            clave VARCHAR(20) NOT NULL,
            descripcion TEXT NOT NULL,
            cantidad INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_clave (clave)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS metodologia (
            id INT AUTO_INCREMENT PRIMARY KEY,
            clave_padre VARCHAR(20) NOT NULL,
            descripcion_padre TEXT NOT NULL,
            clave_hijo VARCHAR(20) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_padre (clave_padre),
            INDEX idx_hijo (clave_hijo)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $countUsers = (int)$pdo->query('SELECT COUNT(*) FROM usuarios')->fetchColumn();

    if ($countUsers === 0) {
        $stmt = $pdo->prepare(
            'INSERT INTO usuarios (usuario, password_hash, rol, nombre)
             VALUES (:usuario, :password_hash, :rol, :nombre)'
        );

        $stmt->execute([
            ':usuario' => 'admin',
            ':password_hash' => password_hash('Admin123*', PASSWORD_DEFAULT),
            ':rol' => 'admin',
            ':nombre' => 'Administrador',
        ]);

        $stmt->execute([
            ':usuario' => 'usuario',
            ':password_hash' => password_hash('Usuario123*', PASSWORD_DEFAULT),
            ':rol' => 'usuario',
            ':nombre' => 'Usuario de consulta',
        ]);
    }
} catch (Throwable $e) {
    jsonResponse([
        'ok' => false,
        'message' => 'Error de conexión a MySQL: ' . $e->getMessage(),
    ], 500);
}
