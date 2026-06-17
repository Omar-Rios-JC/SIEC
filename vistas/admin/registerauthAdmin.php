<?php
session_start();

if (isset($_POST['btnRegister'])) {
    $txtNames = $_POST['names'];
    $txtEmail = $_POST['email'];
    $txtPassword = password_hash($_POST['password'], PASSWORD_DEFAULT); 

    include "../../modelos/conexion.php";
    $conexion = new Conexion();
    
    // Verificar si el correo ya está registrado
    $db = $conexion->getConexion();
    $stmtCheck = $db->prepare('SELECT Id FROM admi WHERE Email = ? LIMIT 1');
    $stmtCheck->bind_param('s', $txtEmail);
    $stmtCheck->execute();
    $existe = $stmtCheck->get_result()->fetch_assoc();
    $stmtCheck->close();
    
    if ($existe) {
    $_SESSION['register_error'] = "El correo ya está registrado.";
    header('Location: registerformAdmin.php?msg=Email ya en uso');
    exit();
}
    $stmtInsert = $db->prepare(
        "INSERT INTO admi (Names, Email, Pasword, rol) VALUES (?, ?, ?, 'admin')"
    );
    $stmtInsert->bind_param('sss', $txtNames, $txtEmail, $txtPassword);

    if ($stmtInsert->execute()) {

        $adminId = $conexion->obtenerUltimoId();

        $_SESSION['admin_id'] = $adminId;
        $_SESSION['admin_name'] = $txtNames;
        $_SESSION['rol'] = 'admin';

        header("Location: login.php?msg=Administrador registrado correctamente");
        exit();
    } else {
        $_SESSION['register_error'] = "Error al registrar el administrador. Inténtalo de nuevo.";
        header('Location: registerformAdmin.php?msg=Error Registro');
        exit();
    }
}
?>
