import { db } from "./firebase-config.js";

import {
    collection,
    getDocs,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const listaPagos = document.getElementById("listaPagos");
const select = document.getElementById("coleccion");

/* =====================================
   CARGAR CATEGORÍAS DINÁMICAS
===================================== */

async function cargarCategorias() {

    select.innerHTML = `<option value="">Seleccione categoría</option>`;

    const snap = await getDocs(collection(db, "categorias"));

    snap.forEach(doc => {
        const data = doc.data();

        select.innerHTML += `
            <option value="${data.nombre}">
                ${data.nombre}
            </option>
        `;
    });
}

cargarCategorias();

/* =====================================
   VER DATOS
===================================== */

window.cargarDatos = async function () {

    const coleccion = select.value;

    if (!coleccion) {
        alert("Seleccione una categoría");
        return;
    }

    const q = query(
        collection(db, coleccion),
        orderBy("fecha", "desc")
    );

    const snap = await getDocs(q);

    let html = "";
    let total = 0;

    snap.forEach(doc => {
        const d = doc.data();
        total += d.monto;

        html += `
            <div>
                <h3>${d.nombre}</h3>
                <p>Grado: ${d.grado}</p>
                <p>Monto: Q${d.monto}</p>
            </div>
        `;
    });

    html += `<h2>Total: Q${total}</h2>`;
    listaPagos.innerHTML = html;
};

/* =====================================
   EXPORTAR EXCEL
===================================== */

window.exportarExcel = async function () {

    const coleccion = select.value;

    const datos = [];

    const snap = await getDocs(collection(db, coleccion));

    snap.forEach(doc => {
        const d = doc.data();

        datos.push({
            Nombre: d.nombre,
            Grado: d.grado,
            Monto: d.monto
        });
    });

    const hoja = XLSX.utils.json_to_sheet(datos);
    const libro = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(libro, hoja, "Reporte");

    XLSX.writeFile(libro, `Reporte_${coleccion}.xlsx`);
};