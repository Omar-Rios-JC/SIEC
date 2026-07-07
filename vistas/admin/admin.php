<?php
include('verificar_sesion.php');

require_once '../../modelos/UsuariosAdmin.php';
require_once '../../modelos/Normatividad.php';

if (!isset($_SESSION['rol']) || $_SESSION['rol'] !== 'admin') {
    header("Location: ../roles/index.php");
    exit();
}

$totalUsuarios = 0;
$totalManuales = 0;

try {
    $totalUsuarios = Usuarios::contarUsuarios();
} catch (Throwable $e) {
    $totalUsuarios = 0;
}

try {
    $totalManuales = Manual::contarManuales();
} catch (Throwable $e) {
    $totalManuales = 0;
}
?>

<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Panel de Administración | Sistema Hospitalario</title>

    <link rel="stylesheet" href="../../css/bootstrap.min.css">
    <link rel="icon" type="image/png" href="../../logo-imss.png">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">

    <style>
        * {
            box-sizing: border-box;
        }

        html,
        body {
            min-height: 100%;
        }

        body {
            margin: 0;
            min-height: 100vh;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f4f6f9;
            color: #1f2933;
            display: flex;
            flex-direction: column;
        }

        .topbar {
            background: #7a123a;
            color: white;
            min-height: 58px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 22px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, .12);
        }

        .brand-area {
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 0;
        }

        .brand {
            font-weight: 800;
            font-size: 22px;
            letter-spacing: 1px;
            white-space: nowrap;
        }

        .back-home-btn {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 10px 16px;
            background: rgba(255, 255, 255, 0.08);
            color: white;
            text-decoration: none;
            border: 1px solid rgba(255, 255, 255, 0.18);
            border-radius: 10px;
            font-weight: 700;
            font-size: 15px;
            transition: .22s ease;
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.03);
        }

        .back-home-btn i {
            font-size: 15px;
        }

        .back-home-btn:hover {
            background: rgba(255, 255, 255, 0.16);
            color: #ffffff;
            transform: translateY(-1px);
        }

        .brand-area {
            display: flex;
            align-items: center;
            gap: 14px;
            min-width: 0;
            flex-wrap: wrap;
        }

        .user-area {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 14px;
            white-space: nowrap;
        }

        .logout-btn {
            color: white;
            text-decoration: none;
            border: 1px solid rgba(255, 255, 255, .8);
            padding: 7px 14px;
            border-radius: 6px;
            transition: .2s ease;
        }

        .logout-btn:hover {
            background: white;
            color: #7a123a;
        }

        .main {
            flex: 1;
            width: 100%;
            max-width: 1440px;
            margin: 0 auto;
            padding: 42px 36px 70px;
        }

        .header {
            text-align: center;
            margin-bottom: 48px;
        }

        .back-home-btn {
            font-size: 14px;
            padding: 9px 14px;
        }

        .header h1 {
            color: #8a1746;
            font-size: 42px;
            font-weight: 600;
            letter-spacing: 1px;
            margin: 0 0 12px;
        }

        .header p {
            margin: 0;
            color: #5f6670;
            font-size: 16px;
        }

        .cards {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 28px;
        }

        .module-card {
            background: white;
            min-height: 230px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, .08);
            padding: 28px 24px;
            text-align: center;
            display: flex;
            flex-direction: column;
            justify-content: center;
            border: 1px solid rgba(0, 0, 0, .04);
            transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
        }

        .module-card:hover {
            transform: translateY(-6px);
            box-shadow: 0 18px 38px rgba(15, 23, 42, 0.12);
            border-color: rgba(122, 18, 58, 0.14);
        }

        .module-card i {
            font-size: 46px;
            margin-bottom: 18px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: transform .22s ease, opacity .22s ease;
        }

        .module-card:hover i {
            transform: scale(1.08);
            opacity: .95;
        }

        .module-card h3 {
            margin: 0 0 10px;
            font-size: 22px;
            font-weight: 800;
            color: #111827;
        }

        .module-card p {
            min-height: 48px;
            margin: 0 0 20px;
            color: #5f6670;
            line-height: 1.45;
        }

        .module-card a {
            display: block;
            text-decoration: none;
            border: 1px solid currentColor;
            border-radius: 6px;
            padding: 9px 12px;
            font-size: 16px;
            transition: background .2s ease, color .2s ease, transform .2s ease;
        }

        .module-card a:hover {
            color: white !important;
            transform: translateY(-1px);
        }

        .center-card {
            grid-column: 2 / 3;
        }

        .green {
            color: #0f8b67;
        }

        .teal {
            color: #148f86;
        }

        .red {
            color: #e63946;
        }

        .purple {
            color: #5947e8;
        }

        .blue {
            color: #1f78ff;
        }

        .dark {
            color: #22272e;
        }

        .orange {
            color: #d97706;
        }

        .module-card a.green:hover {
            background: #0f8b67;
        }

        .module-card a.teal:hover {
            background: #148f86;
        }

        .module-card a.red:hover {
            background: #e63946;
        }

        .module-card a.purple:hover {
            background: #5947e8;
        }

        .module-card a.blue:hover {
            background: #1f78ff;
        }

        .module-card a.dark:hover {
            background: #22272e;
        }

        .module-card a.orange:hover {
            background: #d97706;
        }

        .admin-footer {
            width: 100%;
            background: #7a123a;
            color: white;
            text-align: center;
            padding: 16px 18px;
            font-size: 15px;
            font-weight: 800;
            letter-spacing: .5px;
        }

        @media (max-width: 1000px) {
            .topbar {
                height: auto;
                padding: 14px;
                flex-direction: column;
                gap: 12px;
            }

            .brand-area {
                justify-content: center;
            }

            .user-area {
                flex-wrap: wrap;
                justify-content: center;
            }

            .cards {
                grid-template-columns: repeat(2, 1fr);
            }

            .center-card {
                grid-column: 1 / -1;
                justify-self: center;
                width: min(100%, 520px);
            }

            .header h1 {
                font-size: 34px;
                letter-spacing: .8px;
            }
        }

        @media (max-width: 700px) {
            .cards {
                grid-template-columns: 1fr;
            }

            .center-card {
                grid-column: auto;
                width: 100%;
            }

            .main {
                padding: 30px 18px 54px;
            }

            .header {
                margin-bottom: 34px;
            }

            .header h1 {
                font-size: 28px;
                letter-spacing: .5px;
            }

            .brand {
                font-size: 19px;
            }

            .admin-footer {
                font-size: 13px;
            }
        }
    </style>
</head>

<body>

    <nav class="topbar">
        <div class="brand-area">

            <a href="../roles/index.php" class="back-home-btn" title="Volver al inicio">
                <i class="fa-solid fa-house"></i>
                <span>Volver al Inicio</span>
            </a>
        </div>

        <div class="user-area">
            <span>Bienvenido, <strong>Admin</strong></span>
            <a href="logout.php" class="logout-btn">Cerrar Sesión</a>
        </div>
    </nav>

    <main class="main">
        <section class="header">
            <h1>Panel de Control</h1>
            <p>Administracion del Sistema y Gestión de bases de datos</p>
        </section>

        <section class="cards">

            <div class="module-card">
                <i class="fa-solid fa-chart-bar green"></i>
                <h3>Productividad</h3>
                <p>Visualización de tableros analíticos y gráficas de atención.</p>
                <a class="green" href="/graficos/index.html?modulo=productividad&rol=admin">
                    Ir a Tableros
                </a>
            </div>

            <div class="module-card">
                <i class="fa-solid fa-chart-line teal"></i>
                <h3>Indicadores</h3>
                <p>HOSP, Semanales, Mensual y Mensual Acumulado.</p>
                <a class="teal" href="/graficos/index.html?modulo=indicadores&rol=admin">
                    Ir a Indicadores
                </a>
            </div>

            <div class="module-card">
                <i class="fa-solid fa-shield-virus red"></i>
                <h3>VENCER</h3>
                <p>Monitoreo de eventos críticos y registros de seguridad del paciente.</p>
                <a class="red" href="../productividad/vencer.php">
                    Registros Vencer
                </a>
            </div>

            <div class="module-card">
                <i class="fa-solid fa-sitemap purple"></i>
                <h3>Inventario IFU</h3>
                <p>Gestión, control de existencias y seguimiento de entradas/salidas.</p>
                <a class="purple" href="/IFU/index.php?rol=admin">
                    Ir a Inventario IFU
                </a>
            </div>

            <div class="module-card">
                <i class="fa-solid fa-file-medical blue"></i>
                <h3>Normatividad</h3>
                <p>Consulta de manuales, lineamientos y procedimientos vigentes.</p>
                <a class="blue" href="../normatividad/normatividad_inicio.php">
                    Ver Manuales
                </a>
            </div>

            <div class="module-card">
                <i class="fa-solid fa-user-shield dark"></i>
                <h3>Usuarios</h3>
                <p>Gestión de cuentas, perfiles de acceso y permisos del personal.</p>
                <a class="dark" href="usuariosAdmin.php">
                    Administrar Cuentas
                </a>
            </div>

            <div class="module-card center-card">
                <i class="fa-solid fa-building-user orange"></i>
                <h3>Estructura</h3>
                <p>Consulta y administración de la estructura organizacional.</p>
                <a class="orange" href="./Personal/personal.php">
                    Ver Estructura
                </a>
            </div>

        </section>
    </main>

    <footer class="admin-footer">
        UMAE 48 - Coordinación de Información Médica © 2026
    </footer>

    <script src="../../js/bootstrap.bundle.min.js"></script>

</body>

</html>
