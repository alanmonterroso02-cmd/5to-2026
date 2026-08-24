import { db } from "./firebase-config.js";

import {
    collection,
    getDocs,
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const form = document.getElementById("formParticipante");
const selectGrado = document.getElementById("grado");
const inputGradoNuevo = document.getElementById("gradoNuevo");
const inputNombre = document.getElementById("nombre");
const inputNumero = document.getElementById("numero");
const mensajeEstado = document.getElementById("mensajeEstado");
const selectFiltroGrado = document.getElementById("filtroGrado");
const listaParticipantes = document.getElementById("listaParticipantes");

let participantesData = [];

/* =====================================
   CARGAR PARTICIPANTES Y CARRERAS EXISTENTES
===================================== */

async function cargarParticipantes() {
    const snap = await getDocs(collection(db, "participantes"));

    participantesData = [];
    snap.forEach(doc => participantesData.push(doc.data()));

    const grados = [...new Set(participantesData.map(p => p.grado))].sort();

    selectGrado.innerHTML = `<option value="">Seleccione carrera existente</option>`;
    selectFiltroGrado.innerHTML = `<option value="">Todas las carreras</option>`;

    grados.forEach(grado => {
        selectGrado.innerHTML += `<option value="${grado}">${grado}</option>`;
        selectFiltroGrado.innerHTML += `<option value="${grado}">${grado}</option>`;
    });

    renderLista();
}

/* Sugerir automáticamente el siguiente número al elegir carrera */
selectGrado.addEventListener("change", () => {
    if (!selectGrado.value) return;
    inputGradoNuevo.value = "";
    sugerirNumero(selectGrado.value);
});

inputGradoNuevo.addEventListener("input", () => {
    if (inputGradoNuevo.value.trim()) {
        selectGrado.value = "";
        sugerirNumero(inputGradoNuevo.value.trim());
    }
});

function sugerirNumero(grado) {
    const delGrado = participantesData.filter(p => p.grado === grado);
    const maxNumero = delGrado.reduce((max, p) => Math.max(max, p.numero || 0), 0);
    inputNumero.value = maxNumero + 1;
}

/* =====================================
   REGISTRAR PARTICIPANTE
===================================== */

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const grado = inputGradoNuevo.value.trim() || selectGrado.value;
    const nombre = inputNombre.value.trim();
    const numero = parseInt(inputNumero.value, 10);

    if (!grado) {
        alert("Seleccione o escriba una carrera");
        return;
    }

    if (!nombre || !numero) {
        alert("Complete nombre y número");
        return;
    }

    const idDoc = `${grado}-${numero}`;
    const refDoc = doc(db, "participantes", idDoc);

    const existente = await getDoc(refDoc);

    if (existente.exists()) {
        const confirmar = confirm(
            `Ya existe un participante con el número ${numero} en "${grado}" (${existente.data().nombre}). ¿Desea sobrescribirlo?`
        );
        if (!confirmar) return;
    }

    try {
        await setDoc(refDoc, {
            numero,
            nombre,
            grado,
            total: existente.exists() ? existente.data().total || 0 : 0
        });

        mensajeEstado.textContent = `Participante "${nombre}" registrado en ${grado}`;
        form.reset();

        await cargarParticipantes();
    } catch (error) {
        console.error(error);
        mensajeEstado.textContent = "Error al registrar el participante";
    }
});

/* =====================================
   LISTAR / FILTRAR PARTICIPANTES
===================================== */

selectFiltroGrado.addEventListener("change", renderLista);

function renderLista() {
    const filtro = selectFiltroGrado.value;

    const filtrados = participantesData
        .filter(p => !filtro || p.grado === filtro)
        .sort((a, b) => a.grado.localeCompare(b.grado) || a.numero - b.numero);

    if (!filtrados.length) {
        listaParticipantes.innerHTML = "<p>No hay participantes registrados</p>";
        return;
    }

    let html = "";
    let gradoActual = "";

    filtrados.forEach(p => {
        if (p.grado !== gradoActual) {
            gradoActual = p.grado;
            html += `<h3>${gradoActual}</h3>`;
        }
        html += `<div class="item-tarea">#${p.numero} — ${p.nombre}</div>`;
    });

    listaParticipantes.innerHTML = html;
}

/* =====================================
   INICIALIZAR
===================================== */

cargarParticipantes();
