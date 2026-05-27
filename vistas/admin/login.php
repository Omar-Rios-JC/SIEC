<?php
session_start();

if (isset($_POST['btnLogin'])) {
    $txtEmail = $_POST['email'];
    $txtPassword = $_POST['password'];

    include "../../modelos/conexion.php";

    $conexion = new Conexion();

    $sql = "SELECT * FROM admi WHERE Email = '$txtEmail'";
    $admin = $conexion->consultarUnaFila($sql);

    if ($admin) {
        if (password_verify($txtPassword, $admin['Pasword'])) {
            $_SESSION['admin_id'] = $admin['Id'];
            $_SESSION['admin_name'] = $admin['Names'];
            $_SESSION['rol'] = $admin['rol'];

            header("Location: admin.php");
            exit();
        } else {
            $_SESSION['login_error'] = "Correo o contraseña incorrectos. Por favor, inténtalo de nuevo.";
            header("Location: ./login.php");
            exit();
        }
    } else {
        $_SESSION['login_error'] = "Usuario no registrado. Pulsa en 'Crear Cuenta'.";
        header("Location: ./login.php");
        exit();
    }
}

$loginError = isset($_SESSION['login_error']) ? $_SESSION['login_error'] : null;
unset($_SESSION['login_error']);
?>

<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Iniciar sesión | IMSS UMAE 48</title>

    <link rel="icon" type="image/png" href="../../img/umae-48.jpg">
    <link rel="stylesheet" href="../../css/bootstrap.min.css">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css" rel="stylesheet">

    <style>
        :root {
            --imss: #006341;
            --imss-dark: #003f2a;
            --imss-soft: #e7f4ee;
            --slate: #0f172a;
            --muted: #64748b;
            --danger: #dc2626;
            --danger-soft: #fef2f2;
            --border: rgba(0, 99, 65, 0.14);
            --shadow: 0 30px 90px rgba(0, 55, 38, 0.22);
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            min-height: 100vh;
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
            color: var(--slate);
            background:
                linear-gradient(135deg,
                    rgba(0, 41, 28, 0.46),
                    rgba(0, 99, 65, 0.16)),
                url("../../img/fondo_imss_inicio_sesion.png");
            background-size: cover;
            background-position: left center;
            background-repeat: no-repeat;
            overflow: hidden;
        }

        body::before {
            content: "";
            position: fixed;
            inset: 0;
            pointer-events: none;
            background:
                radial-gradient(circle at 15% 50%, rgba(0, 99, 65, 0.30), transparent 34%),
                radial-gradient(circle at 85% 20%, rgba(179, 142, 93, 0.16), transparent 30%);
            z-index: 0;
        }

        .login-page {
            position: relative;
            z-index: 1;
        }

        a {
            text-decoration: none;
        }

        .login-page {
            min-height: 100vh;
            width: 100%;
            display: grid;
            place-items: center;
            padding: 24px;
        }

        .login-panel {
            width: min(540px, 100%);
            max-height: calc(100vh - 48px);
            border-radius: 34px;
            background: rgba(255, 255, 255, 0.78);
            border: 1px solid rgba(255, 255, 255, 0.52);
            box-shadow: 0 30px 90px rgba(0, 55, 38, 0.28);
            backdrop-filter: blur(20px);
            padding: 32px 36px;
            overflow: auto;
        }

        .brand-login {
            display: flex;
            align-items: center;
            gap: 13px;
            margin-bottom: 24px;
        }

        .brand-logo {
            width: 58px;
            height: 58px;
            border-radius: 20px;
            background: var(--imss-soft);
            border: 1px solid rgba(0, 99, 65, 0.18);
            display: grid;
            place-items: center;
            overflow: hidden;
            flex: 0 0 auto;
        }

        .brand-logo img {
            width: 50px;
            height: 50px;
            object-fit: contain;
            display: block;
        }

        .brand-kicker {
            margin: 0;
            color: var(--imss);
            font-size: 10px;
            font-weight: 950;
            letter-spacing: .14em;
            text-transform: uppercase;
        }

        .brand-title {
            margin: 3px 0 0;
            color: var(--slate);
            font-size: 18px;
            font-weight: 950;
            letter-spacing: -0.03em;
        }

        .login-card-header {
            margin-bottom: 24px;
        }

        .login-card-header small {
            display: block;
            color: var(--imss);
            font-size: 11px;
            font-weight: 950;
            letter-spacing: .14em;
            text-transform: uppercase;
            margin-bottom: 9px;
        }

        .login-card-header h1 {
            margin: 0;
            font-size: clamp(34px, 4vw, 46px);
            line-height: .98;
            letter-spacing: -0.065em;
            font-weight: 950;
            color: var(--slate);
        }

        .login-card-header p {
            margin: 12px 0 0;
            color: var(--muted);
            font-size: 15px;
            font-weight: 700;
            line-height: 1.5;
        }

        .alert-login {
            border-radius: 18px;
            padding: 12px 14px;
            background: var(--danger-soft);
            color: var(--danger);
            border: 1px solid rgba(220, 38, 38, 0.16);
            font-weight: 750;
            display: flex;
            align-items: flex-start;
            gap: 10px;
            margin-bottom: 16px;
        }

        .form-group-modern {
            margin-bottom: 16px;
        }

        .form-group-modern label {
            display: block;
            margin-bottom: 7px;
            color: #334155;
            font-size: 14px;
            font-weight: 900;
        }

        .input-wrap {
            position: relative;
        }

        .input-wrap i.input-icon {
            position: absolute;
            left: 17px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--imss);
            font-size: 18px;
        }

        .form-control-modern {
            width: 100%;
            height: 54px;
            border-radius: 18px;
            border: 1px solid rgba(15, 23, 42, 0.13);
            background: #f8fafc;
            color: var(--slate);
            padding: 0 18px 0 52px;
            outline: none;
            font-size: 15px;
            font-weight: 800;
            transition: .2s ease;
        }

        .form-control-modern::placeholder {
            color: rgba(15, 23, 42, 0.46);
        }

        .form-control-modern:focus {
            border-color: var(--imss);
            background: white;
            box-shadow: 0 0 0 5px rgba(0, 99, 65, 0.10);
        }

        .password-input {
            padding-right: 56px;
        }

        .password-toggle {
            position: absolute;
            right: 12px;
            top: 50%;
            transform: translateY(-50%);
            border: 0;
            background: transparent;
            color: var(--imss);
            font-size: 18px;
            cursor: pointer;
            padding: 8px;
        }

        .login-options {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin: 2px 0 20px;
            color: var(--muted);
            font-size: 14px;
            font-weight: 800;
        }

        .login-options label {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
        }

        .login-options a {
            color: var(--imss);
            font-weight: 950;
        }

        .btn-login-main {
            width: 100%;
            height: 56px;
            border: 0;
            border-radius: 999px;
            background: var(--imss);
            color: white;
            font-size: 16px;
            font-weight: 950;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            box-shadow: 0 18px 38px rgba(0, 99, 65, 0.26);
            transition: .22s ease;
        }

        .btn-login-main:hover {
            background: var(--imss-dark);
            transform: translateY(-2px);
        }

        .login-footer-actions {
            margin-top: 20px;
            display: grid;
            gap: 10px;
            text-align: center;
        }

        .create-account {
            padding: 14px;
            border-radius: 20px;
            background: var(--imss-soft);
            color: var(--imss);
            font-size: 15px;
            font-weight: 950;
            transition: .2s ease;
        }

        .create-account:hover {
            color: var(--imss-dark);
            background: #d9eee5;
        }

        .back-home {
            color: var(--muted);
            font-size: 15px;
            font-weight: 900;
        }

        .back-home:hover {
            color: var(--imss);
        }

        @media (max-width: 700px) {
            body {
                overflow: auto;
            }

            .login-page {
                padding: 18px;
            }

            .login-panel {
                width: 100%;
                max-height: none;
                border-radius: 28px;
                padding: 28px;
            }

            .brand-login {
                align-items: flex-start;
            }

            .login-card-header h1 {
                font-size: 36px;
            }

            .login-options {
                align-items: flex-start;
                flex-direction: column;
            }
        }

        @media (max-width: 900px) {
            .login-page {
                justify-content: center;
                padding: 24px;
            }

            .login-panel {
                min-height: auto;
                padding: 38px;
                border-radius: 34px;
            }
        }

        @media (max-width: 560px) {
            .login-page {
                padding: 16px;
            }

            .login-panel {
                padding: 28px;
                border-radius: 28px;
            }

            .brand-login {
                align-items: flex-start;
            }

            .brand-logo {
                width: 58px;
                height: 58px;
                border-radius: 20px;
            }

            .brand-logo img {
                width: 52px;
                height: 52px;
            }

            .login-card-header h1 {
                font-size: 40px;
            }

            .login-card-header p {
                font-size: 16px;
            }

            .login-options {
                align-items: flex-start;
                flex-direction: column;
            }
        }
    </style>
</head>

<body>
    <main class="login-page">
        <section class="login-panel">
            <div class="brand-login">
                <div class="brand-logo">
                    <img src="../../img/umae-48.jpg" alt="Logo UMAE 48">
                </div>

                <div>
                    <p class="brand-kicker">IMSS · UMAE HGP 48</p>
                    <h2 class="brand-title">Portal Institucional</h2>
                </div>
            </div>

            <div class="login-card-header">
                <small>Inicio de sesión</small>
                <h1>Accede a tu cuenta</h1>
                <p>
                    Utiliza tu correo institucional y contraseña para continuar.
                </p>
            </div>

            <?php if ($loginError): ?>
                <div class="alert-login">
                    <i class="bi bi-exclamation-triangle-fill"></i>
                    <span><?php echo $loginError; ?></span>
                </div>
            <?php endif; ?>

            <form method="POST" action="./login.php" autocomplete="off">
                <div class="form-group-modern">
                    <label for="email">Correo electrónico</label>
                    <div class="input-wrap">
                        <i class="bi bi-envelope-fill input-icon"></i>
                        <input type="email" id="email" name="email" class="form-control-modern"
                            placeholder="correo@ejemplo.com" required>
                    </div>
                </div>

                <div class="form-group-modern">
                    <label for="password">Contraseña</label>
                    <div class="input-wrap">
                        <i class="bi bi-lock-fill input-icon"></i>
                        <input type="password" id="password" name="password" class="form-control-modern password-input"
                            placeholder="Ingresa tu contraseña" required>

                        <button type="button" class="password-toggle" onclick="togglePassword()"
                            aria-label="Mostrar u ocultar contraseña">
                            <i class="bi bi-eye-fill" id="passwordIcon"></i>
                        </button>
                    </div>
                </div>

                <div class="login-options">
                    <label>
                        <input type="checkbox" name="remember">
                        Mantener sesión
                    </label>

                    <a href="#">¿Olvidaste tu contraseña?</a>
                </div>

                <button type="submit" name="btnLogin" class="btn-login-main">
                    <i class="bi bi-box-arrow-in-right"></i>
                    Iniciar sesión
                </button>
            </form>

            <div class="login-footer-actions">
                <a class="create-account" href="./registro.php">
                    <i class="bi bi-person-plus-fill me-1"></i>
                    Crear cuenta
                </a>

                <a class="back-home" href="../roles/index.php">
                    Volver al portal institucional
                </a>
            </div>
        </section>
    </main>

    <script>
        function togglePassword() {
            const input = document.getElementById("password");
            const icon = document.getElementById("passwordIcon");

            if (input.type === "password") {
                input.type = "text";
                icon.classList.remove("bi-eye-fill");
                icon.classList.add("bi-eye-slash-fill");
            } else {
                input.type = "password";
                icon.classList.remove("bi-eye-slash-fill");
                icon.classList.add("bi-eye-fill");
            }
        }
    </script>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
</body>

</html>