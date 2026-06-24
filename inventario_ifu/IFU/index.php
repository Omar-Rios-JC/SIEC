<?php
/*
 * inventario_ifu/IFU/index.php  –  versión corregida
 *
 * Cambios respecto al original:
 *  - session_start() compatible con el portal principal
 *  - Detección de rol desde $_SESSION del portal (admin_id / rol)
 *  - $volver apunta a /vistas/admin/admin.php (admin) o /vistas/roles/index.php (usuario)
 *  - Botón "Regresar al inicio" en lugar de "Volver"
 *  - El rol y nombre se inyectan desde PHP, no desde JS/URL
 *  - loginView oculto por defecto (el usuario ya viene autenticado del portal)
 *  - Null-check en JS para logoutBtn para que no rompa si no existe
 */
 
session_start();
 
$rolSolicitado  = $_GET['rol'] ?? 'consulta';
 
// Compatibilidad con sesión del portal principal
$esAdminPortal  = isset($_SESSION['admin_id'], $_SESSION['rol']) && $_SESSION['rol'] === 'admin';
$esAdminIfu     = isset($_SESSION['usuario']['rol']) && $_SESSION['usuario']['rol'] === 'admin';
 
$rolIfu         = ($esAdminPortal || $esAdminIfu) && $rolSolicitado === 'admin' ? 'admin' : 'usuario';
$rolVisible     = $rolIfu === 'admin' ? 'admin' : 'consulta';
$volver         = $rolIfu === 'admin' ? '/vistas/admin/admin.php' : '/vistas/roles/index.php';
$nombreSesion   = $rolIfu === 'admin'
                    ? ($_SESSION['admin_name'] ?? $_SESSION['usuario']['nombre'] ?? 'Administrador')
                    : 'Usuario';
 
// Sincronizar $_SESSION['usuario'] con el rol calculado
if (!isset($_SESSION['usuario']) || ($_SESSION['usuario']['rol'] ?? '') !== $rolIfu) {
    $_SESSION['usuario'] = [
        'id'      => (int)($_SESSION['admin_id'] ?? 0),
        'usuario' => $rolIfu === 'admin' ? 'admin_portal' : 'consulta_portal',
        'rol'     => $rolIfu,
        'nombre'  => $nombreSesion,
    ];
}
?>
<!DOCTYPE html>
<html lang="es">
 
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
 
    <title>Inventario IFU</title>
 
    <link rel="icon" href="favicon.ico" sizes="any">
    <link rel="icon" href="favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="css/style.css?v=20260622-2">
 
    <style>
        .hidden { display: none !important; }
    </style>

    <script>
        window.IFU_SESSION = <?php echo json_encode([
            'nombre' => $nombreSesion,
            'rol' => $rolVisible,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?>;
    </script>
 
    <script src="js/xlsx.full.min.js?v=20260527" defer></script>
    <script src="js/main.js?v=20260622-5" defer></script>
</head>
 
<body>
 
    <div class="topbar">
        <h1>Inventario IFU</h1>
        <p>HGP 48 CMN del Bajio</p>
    </div>
 
    <main class="container">
 
        <!-- loginView oculto: el usuario ya viene autenticado desde el portal -->
        <section id="loginView" class="login-card hidden">
            <h2>Iniciar sesión</h2>
            <p>Accede con tu usuario para consultar el inventario IFU.</p>
 
            <form id="loginForm" class="login-form">
                <label for="usuario">Usuario</label>
                <input type="text" id="usuario" autocomplete="username">
 
                <label for="password">Contraseña</label>
                <input type="password" id="password" autocomplete="current-password">
 
                <button type="submit">
                    <span class="local-icon" aria-hidden="true">IN</span>
                    Entrar
                </button>
            </form>
        </section>
 
        <section id="appView">
 
            <!-- Barra de sesión con botón "Regresar al inicio" -->
            <div class="session-bar">
                <div>
                    <strong id="sessionName"><?php echo htmlspecialchars($nombreSesion); ?></strong>
                    <span id="sessionRole"><?php echo htmlspecialchars($rolVisible); ?></span>
                </div>
 
                <!-- CAMBIO: texto "Regresar al inicio" + href dinámico según rol -->
                <a href="<?php echo htmlspecialchars($volver); ?>" id="homeBtn" class="logout-link">
                    <span class="local-icon" aria-hidden="true">&#8617;</span>
                    Regresar al inicio
                </a>
            </div>
 
            <!-- Panel de administración (solo visible para admin) -->
            <div id="adminPanel" class="upload-card admin-only<?php echo $rolIfu === 'admin' ? '' : ' hidden'; ?>">
                <div class="upload-grid">
                    <div class="upload-box">
                        <span class="upload-icon" aria-hidden="true">CSV</span>
                        <label>Archivo Metodología</label>
                        <input type="file" id="fileMetodologia" accept=".xlsx,.csv">
                    </div>
 
                    <div class="upload-box">
                        <span class="upload-icon" aria-hidden="true">XLS</span>
                        <label>Archivo Inventario IFU</label>
                        <input type="file" id="fileUpload" accept=".xlsx,.csv">
                    </div>
                </div>
            </div>
 
            <div id="messageBox" class="message hidden"></div>
 
            <!-- Dashboard con totales -->
            <div class="dashboard">
                <div class="total-card">
                    <h2>Camas Censables</h2>
                    <div class="total-number" id="totalCensables">0</div>
                </div>
 
                <div class="total-card">
                    <h2>Camas No Censables</h2>
                    <div class="total-number" id="totalNoCensables">0</div>
                </div>
            </div>
 
            <!-- Búsqueda -->
            <div class="search-box">
                <span class="search-icon" aria-hidden="true">&#128269;</span>
                <input
                    type="text"
                    id="searchInput"
                    placeholder="Buscar clave o especialidad..."
                    autocomplete="off"
                    aria-autocomplete="list"
                    aria-controls="searchSuggestions"
                    aria-expanded="false"
                    disabled
                >
                <button id="clearSearchBtn" class="clear-search hidden" type="button" aria-label="Limpiar búsqueda">&times;</button>
                <div id="searchSuggestions" class="search-suggestions hidden" role="listbox"></div>
            </div>
 
            <button id="searchBtn" type="button">Buscar</button>
 
            <!-- Filtros adicionales -->
            <div class="filtros-extra">
                <input type="text" id="filtroTabla" placeholder="Filtrar dentro de resultados...">
 
                <label>
                    <input type="checkbox" id="filterZero">
                    Ocultar inventario en 0
                </label>
            </div>
 
            <button id="downloadBtn" type="button">Descargar Excel</button>
 
            <button id="clearStorageBtn" class="admin-only<?php echo $rolIfu === 'admin' ? '' : ' hidden'; ?>" type="button">
                Borrar datos guardados
            </button>
 
            <div id="loading" class="loading hidden">Procesando archivos...</div>
 
            <!-- Área de resultados -->
            <div id="results" class="results">
                <div class="welcome-card">
                    <h2>Bienvenido</h2>
                    <p>Busca una clave IFU para consultar el inventario.</p>
                </div>
            </div>
 
            <div id="detalleDesglose"></div>
 
        </section>
    </main>
 
</body>
</html>
