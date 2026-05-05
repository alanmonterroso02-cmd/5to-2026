var usuario = "admin";
var password = "admin";

function login() {
    var user = document.getElementById("user").value;
    var pass = document.getElementById("pass").value;

    if (user === usuario && pass === password) {
        alert("Acceso correcto");
        window.location.href = "admin.html";
    } else {
        alert("Usuario o contraseña incorrectos");
    }
}