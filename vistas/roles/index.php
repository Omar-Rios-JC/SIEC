<?php
require_once '../../modelos/conexion.php';
session_start();

$rol = isset($_SESSION['rol']) ? $_SESSION['rol'] : 'consulta';
$adminName = isset($_SESSION['admin_name']) ? $_SESSION['admin_name'] : null;
?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IMSS UMAE 48 | Portal Institucional</title>

    <link rel="icon" type="image/png" href="../../logo-imss.png">
    <link rel="stylesheet" href="../../css/bootstrap.min.css">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css" rel="stylesheet">

    <style>
        :root {
            --imss: #006341;
            --imss-dark: #003f2a;
            --imss-deep: #00291c;
            --imss-soft: #e7f4ee;

            --gold: #b38e5d;
            --gold-dark: #8b6636;
            --gold-soft: #f8f0e4;

            --blue: #2563eb;
            --blue-dark: #1e40af;
            --blue-soft: #eaf1ff;

            --slate: #0f172a;
            --muted: #64748b;
            --white: #ffffff;

            --border: rgba(0, 99, 65, 0.14);
            --shadow: 0 24px 70px rgba(0, 55, 38, 0.13);
        }

        * {
            box-sizing: border-box;
        }

        html {
            scroll-behavior: smooth;
        }

        body {
            margin: 0;
            min-height: 100vh;
            color: var(--slate);
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
            background:
                radial-gradient(circle at 0% 0%, rgba(0, 99, 65, 0.15), transparent 30%),
                radial-gradient(circle at 100% 0%, rgba(179, 142, 93, 0.13), transparent 28%),
                linear-gradient(180deg, #ffffff 0%, #f5f8f6 45%, #edf4f1 100%);
        }

        a {
            text-decoration: none;
        }

        .portal-shell {
            min-height: 100vh;
            padding-bottom: 36px;
        }

        /* ================= NAVBAR ================= */

        .main-navbar {
            width: min(1220px, calc(100% - 32px));
            margin: 18px auto 0;
            padding: 13px 18px;
            border-radius: 28px;
            border: 1px solid var(--border);
            background: rgba(255, 255, 255, 0.92);
            backdrop-filter: blur(18px);
            box-shadow: 0 18px 48px rgba(0, 61, 41, 0.09);
            position: relative;
            z-index: 50;
        }

        .navbar-inner {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 18px;
        }

        .brand-box {
            display: flex;
            align-items: center;
            gap: 13px;
            text-decoration: none;
            min-width: 0;
        }

        .brand-logo {
            width: 64px;
            height: 64px;
            border-radius: 22px;
            background: var(--imss-soft);
            border: 1px solid rgba(0, 99, 65, 0.18);
            display: grid;
            place-items: center;
            overflow: hidden;
            flex: 0 0 auto;
        }

        .brand-logo img {
            width: 56px;
            height: 56px;
            object-fit: contain;
            display: block;
        }

        .brand-kicker {
            margin: 0;
            color: var(--imss);
            font-size: 11px;
            font-weight: 950;
            letter-spacing: 0.14em;
            text-transform: uppercase;
        }

        .brand-title {
            margin: 2px 0 0;
            color: var(--slate);
            font-size: 17px;
            line-height: 1.1;
            font-weight: 950;
            letter-spacing: -0.02em;
        }

        .login-btn {
            border-radius: 999px;
            padding: 13px 22px;
            color: white !important;
            background: var(--imss);
            font-weight: 850;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            box-shadow: 0 12px 30px rgba(0, 99, 65, 0.22);
            white-space: nowrap;
        }

        .login-btn:hover {
            color: white !important;
            background: var(--imss-dark);
        }

        @media (max-width: 640px) {
            .navbar-inner {
                align-items: flex-start;
                flex-direction: column;
            }

            .login-btn {
                width: 100%;
            }

            .brand-title {
                font-size: 16px;
            }

            .brand-logo {
                width: 58px;
                height: 58px;
            }

            .brand-logo img {
                width: 50px;
                height: 50px;
            }
        }

        /* ================= CARRUSEL PRINCIPAL ================= */

        .main-carousel-section {
            width: min(1220px, calc(100% - 32px));
            margin: 24px auto 0;
        }

        .main-carousel-card {
            position: relative;
            overflow: hidden;
            border-radius: 42px;
            min-height: 620px;
            background: var(--imss-deep);
            box-shadow: var(--shadow);
            border: 1px solid rgba(0, 99, 65, 0.12);
        }

        .main-carousel-card .carousel,
        .main-carousel-card .carousel-inner,
        .main-carousel-card .carousel-item,
        .main-carousel-card img {
            height: 620px;
        }

        .main-carousel-card img {
            width: 100%;
            object-fit: cover;
            filter: saturate(0.95) contrast(1.04);
        }

        .carousel-dark-overlay {
            position: absolute;
            inset: 0;
            z-index: 2;
            pointer-events: none;
            background:
                radial-gradient(circle at 75% 25%, rgba(255, 255, 255, 0.12), transparent 24%),
                linear-gradient(90deg, rgba(0, 41, 28, 0.72) 0%, rgba(0, 64, 43, 0.46) 38%, rgba(0, 0, 0, 0.04) 100%),
                linear-gradient(180deg, transparent 48%, rgba(0, 41, 28, 0.50) 100%);
        }

        .carousel-main-content {
            position: absolute;
            z-index: 4;
            left: 48px;
            bottom: 48px;
            width: min(540px, calc(100% - 80px));
            color: white;
        }

        .system-chip {
            width: fit-content;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 7px 12px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.13);
            border: 1px solid rgba(255, 255, 255, 0.20);
            font-size: 10px;
            font-weight: 900;
            letter-spacing: 0.10em;
            text-transform: uppercase;
            margin-bottom: 16px;
        }

        .carousel-main-content h1 {
            margin: 0;
            font-size: clamp(34px, 4.2vw, 56px);
            line-height: 1;
            letter-spacing: -0.055em;
            font-weight: 950;
            max-width: 520px;
        }

        .carousel-main-content p {
            margin: 16px 0 0;
            max-width: 500px;
            font-size: 15px;
            line-height: 1.55;
            color: rgba(255, 255, 255, 0.82);
        }

        .carousel-actions {
            margin-top: 32px;
            display: flex;
            gap: 14px;
            flex-wrap: wrap;
        }

        .btn-carousel-primary,
        .btn-carousel-secondary {
            border-radius: 999px;
            padding: 14px 20px;
            font-size: 15px;
            font-weight: 900;
            display: inline-flex;
            align-items: center;
            gap: 9px;
            transition: 0.22s ease;
        }

        .btn-carousel-primary {
            color: var(--imss-dark);
            background: white;
            box-shadow: 0 18px 36px rgba(0, 0, 0, 0.16);
        }

        .btn-carousel-primary:hover {
            color: var(--imss-dark);
            transform: translateY(-2px);
        }

        .btn-carousel-secondary {
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.24);
            background: rgba(255, 255, 255, 0.12);
        }

        .btn-carousel-secondary:hover {
            color: white;
            background: rgba(255, 255, 255, 0.20);
        }

        .carousel-control-prev,
        .carousel-control-next {
            z-index: 5;
            width: 9%;
        }

        .carousel-control-prev-icon,
        .carousel-control-next-icon {
            width: 46px;
            height: 46px;
            border-radius: 50%;
            background-color: rgba(0, 0, 0, 0.38);
            background-size: 55%;
            backdrop-filter: blur(10px);
        }

        .carousel-indicators {
            z-index: 5;
            margin-bottom: 24px;
        }

        .carousel-indicators [data-bs-target] {
            width: 10px;
            height: 10px;
            border-radius: 999px;
            border: 0;
            opacity: 0.55;
        }

        .carousel-indicators .active {
            width: 32px;
            opacity: 1;
        }

        /* ================= CUADRO INFORMATIVO RECTANGULAR ================= */

        .info-rectangle {
            width: min(1140px, calc(100% - 48px));
            margin: -38px auto 0;
            position: relative;
            z-index: 10;
            background: rgba(255, 255, 255, 0.94);
            border: 1px solid var(--border);
            border-radius: 32px;
            box-shadow: 0 22px 56px rgba(0, 61, 41, 0.12);
            backdrop-filter: blur(16px);
            padding: 28px;
            display: grid;
            grid-template-columns: 1.25fr 0.75fr;
            gap: 26px;
            align-items: center;
        }

        .info-rectangle-left {
            display: flex;
            align-items: center;
            gap: 22px;
        }

        .info-rectangle-icon {
            width: 72px;
            height: 72px;
            border-radius: 26px;
            background: var(--imss-soft);
            color: var(--imss);
            display: grid;
            place-items: center;
            font-size: 32px;
            flex: 0 0 auto;
        }

        .info-rectangle small {
            display: block;
            color: var(--imss);
            font-size: 12px;
            font-weight: 950;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            margin-bottom: 6px;
        }

        .info-rectangle h2 {
            margin: 0;
            font-size: clamp(26px, 4vw, 42px);
            line-height: 1;
            letter-spacing: -0.055em;
            font-weight: 950;
        }

        .info-rectangle p {
            margin: 10px 0 0;
            color: var(--muted);
            line-height: 1.6;
            font-weight: 650;
        }

        .info-rectangle-stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
        }

        .info-stat {
            padding: 16px;
            border-radius: 22px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            text-align: center;
        }

        .info-stat strong {
            display: block;
            font-size: 24px;
            line-height: 1;
            font-weight: 950;
            color: var(--imss);
        }

        .info-stat span {
            display: block;
            margin-top: 8px;
            color: var(--muted);
            font-size: 12px;
            font-weight: 850;
            text-transform: uppercase;
            letter-spacing: 0.06em;
        }

        /* ================= MÓDULOS ================= */

        .modules-section {
            width: min(1220px, calc(100% - 32px));
            margin: 72px auto 0;
        }

        .section-head {
            display: flex;
            justify-content: space-between;
            align-items: end;
            gap: 22px;
            margin-bottom: 28px;
        }

        .section-kicker {
            margin: 0 0 8px;
            color: var(--imss);
            font-size: 13px;
            font-weight: 950;
            letter-spacing: 0.13em;
            text-transform: uppercase;
        }

        .section-title {
            margin: 0;
            font-size: clamp(32px, 4.5vw, 54px);
            line-height: 1;
            letter-spacing: -0.06em;
            font-weight: 950;
        }

        .section-note {
            margin: 0;
            max-width: 440px;
            color: var(--muted);
            line-height: 1.6;
            font-weight: 650;
        }

        .main-modules-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 24px;
        }

        .main-module-card {
            min-height: 440px;
            border-radius: 38px;
            border: 1px solid var(--border);
            background: rgba(255, 255, 255, 0.94);
            box-shadow: 0 22px 56px rgba(0, 61, 41, 0.09);
            padding: 30px;
            color: var(--slate);
            display: flex;
            flex-direction: column;
            position: relative;
            overflow: hidden;
            transition: 0.25s ease;
        }

        .main-module-card:hover {
            transform: translateY(-8px);
            box-shadow: 0 34px 76px rgba(0, 61, 41, 0.16);
            color: var(--slate);
        }

        .main-module-card::before {
            content: "";
            position: absolute;
            inset: 0;
            background:
                radial-gradient(circle at 85% 5%, var(--module-soft), transparent 38%),
                linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.88));
            z-index: 0;
        }

        .main-module-card>* {
            position: relative;
            z-index: 2;
        }

        .module-green {
            --module-main: var(--imss);
            --module-dark: var(--imss-dark);
            --module-soft: var(--imss-soft);
        }

        .module-purple {
            --module-main: #64748b;
            --module-dark: #475569;
            --module-soft: #f1f5f9;
        }

        .module-gold {
            --module-main: var(--gold);
            --module-dark: var(--gold-dark);
            --module-soft: var(--gold-soft);
        }

        .module-blue {
            --module-main: var(--blue);
            --module-dark: var(--blue-dark);
            --module-soft: var(--blue-soft);
        }

        .main-module-bg-number {
            position: absolute;
            right: -12px;
            top: 18px;
            z-index: 1;
            font-size: 118px;
            line-height: 1;
            font-weight: 950;
            letter-spacing: -0.09em;
            color: var(--module-main);
            opacity: 0.08;
        }

        .module-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .module-icon {
            width: 70px;
            height: 70px;
            border-radius: 25px;
            display: grid;
            place-items: center;
            font-size: 31px;
            color: var(--module-main);
            background: var(--module-soft);
        }

        .module-badge {
            padding: 8px 11px;
            border-radius: 999px;
            color: var(--module-main);
            background: var(--module-soft);
            font-size: 12px;
            font-weight: 950;
        }

        .main-module-content {
            margin-top: 42px;
        }

        .module-kicker {
            margin: 0 0 8px !important;
            color: var(--module-main) !important;
            font-size: 12px;
            font-weight: 950 !important;
            letter-spacing: 0.12em;
            text-transform: uppercase;
        }

        .main-module-card h3 {
            margin: 0 0 12px;
            font-size: clamp(34px, 4vw, 48px);
            line-height: 0.95;
            font-weight: 950;
            letter-spacing: -0.07em;
        }

        .main-module-card p {
            color: var(--muted);
            line-height: 1.65;
            font-weight: 650;
            margin-bottom: 0;
        }

        .module-meta {
            margin-top: 22px;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        .module-meta span {
            padding: 7px 10px;
            border-radius: 999px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            color: #475569;
            font-size: 12px;
            font-weight: 850;
        }

        .module-footer {
            margin-top: auto;
            padding-top: 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: var(--module-main);
            font-weight: 950;
        }

        .module-arrow {
            width: 46px;
            height: 46px;
            min-width: 46px;
            border-radius: 50%;
            display: grid;
            place-items: center;
            color: white;
            background: var(--module-main);
            font-size: 23px;
            font-weight: 900;
            line-height: 1;
            transition: 0.22s ease;
        }

        .main-module-card:hover .module-arrow {
            transform: translateX(4px);
            background: var(--module-dark);
        }

        /* ================= BANNER ================= */

        .institutional-banner {
            width: min(1220px, calc(100% - 32px));
            margin: 32px auto 0;
            border-radius: 36px;
            padding: 36px;
            color: white;
            background:
                radial-gradient(circle at 90% 0%, rgba(255, 255, 255, 0.20), transparent 30%),
                linear-gradient(135deg, var(--imss-deep), var(--imss));
            box-shadow: var(--shadow);
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 22px;
        }

        .institutional-banner p {
            margin: 0 0 7px;
            color: rgba(255, 255, 255, 0.72);
            font-weight: 950;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            font-size: 12px;
        }

        .institutional-banner h2 {
            margin: 0;
            font-size: clamp(28px, 4vw, 44px);
            line-height: 1;
            font-weight: 950;
            letter-spacing: -0.055em;
        }

        .institutional-banner a {
            white-space: nowrap;
            color: var(--imss-dark);
            background: white;
            border-radius: 999px;
            padding: 14px 20px;
            font-weight: 950;
            transition: 0.22s ease;
        }

        .institutional-banner a:hover {
            color: var(--imss-dark);
            transform: translateY(-2px);
        }

        footer {
            width: min(1220px, calc(100% - 32px));
            margin: 34px auto 0;
            color: var(--muted);
            display: flex;
            justify-content: space-between;
            gap: 14px;
            font-weight: 700;
        }

        /* ================= RESPONSIVE ================= */

        @media (max-width: 1050px) {

            .main-carousel-card,
            .main-carousel-card .carousel,
            .main-carousel-card .carousel-inner,
            .main-carousel-card .carousel-item,
            .main-carousel-card img {
                min-height: 560px;
                height: 560px;
            }

            .info-rectangle {
                grid-template-columns: 1fr;
            }

            .section-head {
                align-items: flex-start;
                flex-direction: column;
            }

            .main-modules-grid {
                grid-template-columns: 1fr;
            }

            .main-module-card {
                min-height: auto;
            }
        }

        @media (max-width: 991px) {
            .navbar-collapse {
                padding-top: 16px;
            }

            .login-btn {
                width: 100%;
                justify-content: center;
                margin-top: 10px;
            }
        }

        @media (max-width: 720px) {

            .main-carousel-card,
            .main-carousel-card .carousel,
            .main-carousel-card .carousel-inner,
            .main-carousel-card .carousel-item,
            .main-carousel-card img {
                min-height: 540px;
                height: 540px;
            }

            .main-modules-grid {
                grid-template-columns: 1fr;
            }

            .main-carousel-card {
                border-radius: 30px;
            }

            .carousel-main-content {
                left: 24px;
                right: 24px;
                bottom: 34px;
                width: auto;
            }

            .carousel-main-content h1 {
                font-size: 34px;
                line-height: 1;
            }

            .carousel-main-content p {
                font-size: 14px;
                line-height: 1.45;
                max-width: 100%;
            }

            .system-chip {
                font-size: 9px;
                padding: 6px 10px;
                margin-bottom: 12px;
            }


            .carousel-control-prev,
            .carousel-control-next {
                display: none;
            }

            .info-rectangle {
                width: min(1220px, calc(100% - 32px));
                margin-top: 22px;
                border-radius: 28px;
            }

            .info-rectangle-left {
                align-items: flex-start;
                flex-direction: column;
            }

            .info-rectangle-stats {
                grid-template-columns: 1fr;
            }

            .institutional-banner {
                flex-direction: column;
                align-items: flex-start;
            }

            footer {
                flex-direction: column;
            }
        }
    </style>
</head>

<body>
    <div class="portal-shell">

        <nav class="main-navbar">
            <div class="navbar-inner">
                <a class="brand-box" href="../roles/index.php">
                    <div class="brand-logo">
                        <img src="../../img/umae-48.jpg" alt="Logo UMAE 48">
                    </div>
                    <div>
                        <p class="brand-kicker">IMSS · UMAE HGP 48</p>
                        <h1 class="brand-title">Portal Institucional</h1>
                    </div>
                </a>

                <div>
                    <?php if ($adminName && $rol === 'admin'): ?>
                        <div class="dropdown">
                            <a class="login-btn dropdown-toggle" href="#" data-bs-toggle="dropdown">
                                <i class="bi bi-person-circle"></i>
                                <?php echo $adminName; ?>
                            </a>

                            <ul class="dropdown-menu dropdown-menu-end">
                                <li>
                                    <a class="dropdown-item" href="../admin/admin.php">
                                        <i class="bi bi-speedometer2 me-1"></i>Volver al panel
                                    </a>
                                </li>

                                <li>
                                    <hr class="dropdown-divider">
                                </li>

                                <li>
                                    <a class="dropdown-item text-danger" href="../admin/logout.php">
                                        <i class="bi bi-box-arrow-right me-1"></i>Cerrar sesión
                                    </a>
                                </li>
                            </ul>
                        </div>

                    <?php elseif ($adminName): ?>
                        <div class="dropdown">
                            <a class="login-btn dropdown-toggle" href="#" data-bs-toggle="dropdown">
                                <i class="bi bi-person-circle"></i>
                                <?php echo $adminName; ?>
                            </a>

                            <ul class="dropdown-menu dropdown-menu-end">
                                <li>
                                    <a class="dropdown-item text-danger" href="../admin/logout.php">
                                        <i class="bi bi-box-arrow-right me-1"></i>Cerrar sesión
                                    </a>
                                </li>
                            </ul>
                        </div>

                    <?php else: ?>
                        <a class="login-btn" href="../admin/login.php">
                            <i class="bi bi-box-arrow-in-right"></i>
                            Iniciar sesión
                        </a>
                    <?php endif; ?>
                </div>
            </div>
        </nav>

        <section class="main-carousel-section">
            <div class="main-carousel-card">
                <div id="carouselInstitucional" class="carousel slide" data-bs-ride="carousel">
                    <div class="carousel-inner">
                        <div class="carousel-item active" data-bs-interval="5000">
                            <img src="../../img/imss7.jpg" class="d-block w-100" alt="IMSS">
                        </div>

                        <div class="carousel-item" data-bs-interval="5000">
                            <img src="../../img/imss10.jpg" class="d-block w-100" alt="UMAE">
                        </div>

                        <div class="carousel-item" data-bs-interval="5000">
                            <img src="../../img/imss6.webp" class="d-block w-100" alt="Hospital">
                        </div>

                        <div class="carousel-item" data-bs-interval="5000">
                            <img src="../../img/imss8.jpg" class="d-block w-100" alt="Institucional">
                        </div>

                        <div class="carousel-item" data-bs-interval="5000">
                            <img src="../../img/imss9.webp" class="d-block w-100" alt="IMSS">
                        </div>
                    </div>

                    <button class="carousel-control-prev" type="button" data-bs-target="#carouselInstitucional"
                        data-bs-slide="prev">
                        <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                        <span class="visually-hidden">Anterior</span>
                    </button>

                    <button class="carousel-control-next" type="button" data-bs-target="#carouselInstitucional"
                        data-bs-slide="next">
                        <span class="carousel-control-next-icon" aria-hidden="true"></span>
                        <span class="visually-hidden">Siguiente</span>
                    </button>

                    <div class="carousel-indicators">
                        <button type="button" data-bs-target="#carouselInstitucional" data-bs-slide-to="0"
                            class="active" aria-current="true" aria-label="Slide 1"></button>
                        <button type="button" data-bs-target="#carouselInstitucional" data-bs-slide-to="1"
                            aria-label="Slide 2"></button>
                        <button type="button" data-bs-target="#carouselInstitucional" data-bs-slide-to="2"
                            aria-label="Slide 3"></button>
                        <button type="button" data-bs-target="#carouselInstitucional" data-bs-slide-to="3"
                            aria-label="Slide 4"></button>
                        <button type="button" data-bs-target="#carouselInstitucional" data-bs-slide-to="4"
                            aria-label="Slide 5"></button>
                    </div>
                </div>

                <div class="carousel-dark-overlay"></div>

                <div class="carousel-main-content">
                    <div class="system-chip">
                        <span></span>
                        Plataforma institucional UMAE HGP No.48
                    </div>

                    <h1>Portal de indicadores y seguimiento</h1>

                    <p>
                        Un acceso central para consultar los módulos principales del sistema:
                        Productividad, Vencer, Indicadores e IFU. Información operativa organizada de forma
                        clara, rápida y funcional.
                    </p>
                </div>
            </div>
        </section>

        <section class="info-rectangle">
            <div class="info-rectangle-left">
                <div class="info-rectangle-icon">
                    <i class="bi bi-hospital-fill"></i>
                </div>

                <div>
                    <small>Centro de acceso institucional</small>
                    <h2>Información organizada para consulta operativa</h2>
                </div>
            </div>

            <div class="info-rectangle-stats">
                <div class="info-stat">
                    <strong>04</strong>
                    <span>Módulos Principales</span>
                </div>

                <div class="info-stat">
                    <strong>01</strong>
                    <span>Portal Unificado</span>
                </div>

                <div class="info-stat">
                    <strong>IMSS</strong>
                    <span>UMAE HGP No.48</span>
                </div>
            </div>
        </section>

        <section class="modules-section" id="modulos">
            <div class="section-head">
                <div>
                    <p class="section-kicker">Accesos principales</p>
                    <h2 class="section-title">Selecciona un módulo</h2>
                </div>
            </div>

            <div class="main-modules-grid">
                <a class="main-module-card module-green"
                    href="/graficos/index.html?modulo=productividad&rol=<?php echo $rol; ?>">
                    <div class="main-module-bg-number">01</div>

                    <div class="module-top">
                        <div class="module-icon">
                            <i class="bi bi-graph-up-arrow"></i>
                        </div>
                        <span class="module-badge">Activo</span>
                    </div>

                    <div class="main-module-content">
                        <p class="module-kicker">Indicadores y reportes</p>
                        <h3>Productividad</h3>
                        <p>
                            Tableros acerca de consulta externa, paramédicos, cirugías, hospitalización y urgencias.
                        </p>
                    </div>

                    <div class="module-meta">
                        <span>Gráficas</span>
                        <span>Reportes</span>
                        <span>Productividad</span>
                    </div>

                    <div class="module-footer">
                        <span>Entrar al módulo</span>
                        <div class="module-arrow">→</div>
                    </div>
                </a>

                <a class="main-module-card module-gold"
                    href="/graficos/index.html?modulo=vencer&rol=<?php echo $rol; ?>">
                    <div class="main-module-bg-number">02</div>

                    <div class="module-top">
                        <div class="module-icon">
                            <i class="bi bi-heart-pulse-fill"></i>
                        </div>
                        <span class="module-badge">Activo</span>
                    </div>

                    <div class="main-module-content">
                        <p class="module-kicker">Seguimiento institucional</p>
                        <h3>Vencer</h3>
                        <p>
                            Control general de eventos adversos, cuasifallas, centinelas y seguimiento institucional.
                        </p>
                    </div>

                    <div class="module-meta">
                        <span>Control</span>
                        <span>Seguimiento</span>
                        <span>Eventos</span>
                    </div>

                    <div class="module-footer">
                        <span>Entrar al módulo</span>
                        <div class="module-arrow">→</div>
                    </div>
                </a>

                <a class="main-module-card module-purple"
                    href="/graficos/index.html?modulo=indicadores&rol=<?php echo $rol; ?>">
                    <div class="main-module-bg-number">03</div>

                    <div class="module-top">
                        <div class="module-icon">
                            <i class="bi bi-clipboard-data-fill"></i>
                        </div>
                        <span class="module-badge">Activo</span>
                    </div>

                    <div class="main-module-content">
                        <p class="module-kicker">Consulta externa</p>
                        <h3>Indicadores</h3>
                        <p>
                            Consulta indicadores hospitalarios enfocados en datos de consulta externa y seguimiento
                            operativo.
                        </p>
                    </div>

                    <div class="module-meta">
                        <span>Consulta externa</span>
                        <span>Hospitalarios</span>
                        <span>Análisis</span>
                    </div>

                    <div class="module-footer">
                        <span>Entrar al módulo</span>
                        <div class="module-arrow">→</div>
                    </div>
                </a>

                <a class="main-module-card module-blue" href="/IFU/index.php?rol=consulta">
                    <div class="main-module-bg-number">04</div>

                    <div class="module-top">
                        <div class="module-icon">
                            <i class="bi bi-box-seam-fill"></i>
                        </div>
                        <span class="module-badge">Nuevo</span>
                    </div>

                    <div class="main-module-content">
                        <p class="module-kicker">Almacén e IFU</p>
                        <h3>IFU</h3>
                        <p>
                            Espacio enfocado en herramientas, stock, reintegración y renovación dentro del área de
                            almacén.
                        </p>
                    </div>

                    <div class="module-meta">
                        <span>Stock</span>
                        <span>Reintegración</span>
                        <span>Almacén</span>
                    </div>

                    <div class="module-footer">
                        <span>Entrar al módulo</span>
                        <div class="module-arrow">→</div>
                    </div>
                </a>


            </div>
        </section>

        <footer>
            <p class="mb-0">© <?php echo date("Y"); ?> IMSS. Todos los derechos reservados.</p>
            <p class="mb-0">UMAE HGP 48 · Portal Institucional</p>
        </footer>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>

    <script>
        document.addEventListener("DOMContentLoaded", function () {
            const carrusel = document.querySelector("#carouselInstitucional");

            if (carrusel && window.bootstrap) {
                new bootstrap.Carousel(carrusel, {
                    interval: 5000,
                    ride: "carousel",
                    pause: false,
                    wrap: true
                });
            }
        });
    </script>
</body>

</html>