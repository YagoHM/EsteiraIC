<?php

session_start();

// Conexão com o banco de dados
$host = "localhost";
$user = "root";
$pass = ""; 
$dbname = "ic"; 
$conn = new mysqli($host, $user, $pass, $dbname);

if ($conn->connect_error) {
    die("Falha na conexão: " . $conn->connect_error);
}

if (isset($_POST['login'])) {
    $username = $_POST['username'];
    $password = $_POST['password'];

    $sql = "SELECT * FROM users WHERE nome = '$username' AND senha = '$password'";
    $result = $conn->query($sql);

    if ($result->num_rows > 0) {
        $_SESSION['username'] = $username;
        include("site.html");
        exit();
    } else {
        echo "Usuário ou senha incorretos!";
    }
}

if (isset($_SESSION['username'])) {
    echo "Bem-vindo, " . $_SESSION['username'] . "!";
    include("site.html");
} else {
    echo "
    <form method='POST' action=''>
        <label for='username'>Usuário:</label>
        <input type='text' id='username' name='username' required><br>
        <label for='password'>Senha:</label>
        <input type='password' id='password' name='password' required><br>
        <button type='submit' name='login'>Entrar</button>
    </form>
    ";
}
?>



