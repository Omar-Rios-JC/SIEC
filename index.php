<<<<<<< HEAD
<?php 
header('Location: vistas/roles/index.php');

?>
=======
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Inventario IFU</title>

    <link rel="stylesheet" href="css/style.css">
    <script src="js/xlsx.full.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
</head>

<body>
    <div class="topbar">
        <h1>Inventario IFU</h1>
        <p>HGP 48 CMN del Bajío</p>
    </div>

    <main class="container">
        <section id="loginView" class="login-card">
            <h2>Iniciar sesión</h2>
            <p>Accede con tu usuario para consultar el inventario IFU.</p>

            <form id="loginForm" class="login-form">
                <label for="usuario">Usuario</label>
                <input type="text" id="usuario" autocomplete="username" required>

                <label for="password">Contraseña</label>
                <input type="password" id="password" autocomplete="current-password" required>

                <button type="submit">
                    <i class="fa-solid fa-right-to-bracket"></i>
                    Entrar
                </button>
            </form>
        </section>

        <section id="appView" class="hidden">
            <div class="session-bar">
                <div>
                    <strong id="sessionName">Usuario</strong>
                    <span id="sessionRole">consulta</span>
                </div>

                <button id="logoutBtn" type="button">
                    <i class="fa-solid fa-arrow-right-from-bracket"></i>
                    Salir
                </button>
            </div>

            <div id="adminPanel" class="upload-card admin-only hidden">
                <div class="upload-grid">
                    <div class="upload-box">
                        <i class="fa-solid fa-file-csv"></i>
                        <label>Archivo Metodología</label>
                        <input type="file" id="fileMetodologia" accept=".xlsx,.csv">
                    </div>

                    <div class="upload-box">
                        <i class="fa-solid fa-file-excel"></i>
                        <label>Archivo Inventario IFU</label>
                        <input type="file" id="fileUpload" accept=".xlsx,.csv">
                    </div>
                </div>
            </div>

            <div id="messageBox" class="message hidden"></div>

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

            <div class="search-box">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input type="text" id="searchInput" list="listaClaves" placeholder="Buscar clave o especialidad..." disabled>
                <datalist id="listaClaves"></datalist>
            </div>

            <button id="searchBtn" type="button">Buscar</button>

            <div class="filtros-extra">
                <input type="text" id="filtroTabla" placeholder="Filtrar dentro de resultados...">

                <label>
                    <input type="checkbox" id="filterZero">
                    Ocultar inventario en 0
                </label>
            </div>

            <button id="downloadBtn" type="button">Descargar Excel</button>
            <button id="clearStorageBtn" class="admin-only hidden" type="button">Borrar datos guardados</button>

            <div id="loading" class="loading hidden">Procesando archivos...</div>

            <div id="results" class="results">
                <div class="welcome-card">
                    <h2>Bienvenido</h2>
                    <p>Busca una clave IFU para consultar el inventario.</p>
                </div>
            </div>

            <div id="detalleDesglose"></div>
        </section>
    </main>

    <script src="js/main.js"></script>
</body>

</html>
>>>>>>> 17b85096a702b6c059298500796f039de5fc2e8d
