import { db } from "./firebase-config.js";
import {
    collection,
    getDocs,
    addDoc,
    query,
    where,
    serverTimestamp,
    Timestamp
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

/* =====================================
   CONFIGURACIÓN DE CLOUDINARY
   Reemplaza estos dos valores con los tuyos
   (Dashboard de Cloudinary → Cloud Name / Settings → Upload → Upload Presets)
===================================== */
const CLOUDINARY_CLOUD_NAME = "e4x61s89";
const CLOUDINARY_UPLOAD_PRESET = "ml_default";

const selectGrado = document.getElementById("grado");
const selectParticipante = document.getElementById("participante");
const selectCurso = document.getElementById("curso");
const selectFiltroCurso = document.getElementById("filtroCurso");
const inputArchivo = document.getElementById("archivo");
const limiteCurso = document.getElementById("limiteCurso");
const form = document.getElementById("formTarea");
const mensajeEstado = document.getElementById("mensajeEstado");
const barraProgreso = document.getElementById("barraProgreso");
const progreso = document.getElementById("progreso");
const listaTareas = document.getElementById("listaTareas");

let participantesData = [];
let cursosData = []; // { nombre, fechaLimite (Date|null) }
let subidaEnCurso = false; // usado para advertir si el usuario intenta salir mientras sube

/* =====================================
   DIAGNÓSTICO DE RED DEL DISPOSITIVO
   navigator.connection es la Network Information API. No existe en
   todos los navegadores (ej. Safari/iOS no la soporta), así que todo
   va con "?." y con valores por defecto para no romper nada.
===================================== */
function obtenerInfoRed() {
    const conexion = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return {
        ahorroDatos: conexion?.saveData === true,          // "Ahorro de datos" / Data Saver activado
        tipoConexion: conexion?.effectiveType || "desconocida", // "4g", "3g", "2g", "slow-2g"
        velocidadMbps: typeof conexion?.downlink === "number" ? conexion.downlink : null,
        rttMs: typeof conexion?.rtt === "number" ? conexion.rtt : null,
        enLinea: navigator.onLine
    };
}

/* =====================================
   ADVERTIR SI "AHORRO DE DATOS" ESTÁ ACTIVADO
   Cuando está activo, Chrome en Android puede enrutar las peticiones
   a través de un proxy compresor que en algunos casos interfiere con
   subidas multipart/form-data a dominios de terceros como Cloudinary.
   Aquí solo avisamos (no bloqueamos), para no impedir subir a nadie.
===================================== */
function advertirSiAhorroDatos() {
    const info = obtenerInfoRed();
    if (info.ahorroDatos) {
        mensajeEstado.textContent =
            "Detectamos que tu teléfono tiene activado el 'Ahorro de datos' en Chrome. " +
            "Esto a veces interfiere con la subida de archivos. Si falla, prueba " +
            "desactivándolo en Chrome → ⋮ → Configuración → Ahorro de datos.";
        mensajeEstado.className = "aviso-ahorro-datos";
    }
    return info;
}

// Revisamos apenas el usuario elige un archivo, para avisar antes de que intente subir
inputArchivo?.addEventListener("change", () => {
    if (inputArchivo.files[0]) {
        advertirSiAhorroDatos();
    }
});

/* =====================================
   SANITIZAR TEXTO PARA USAR COMO PARTE DE UN public_id DE CLOUDINARY
   (quita tildes, '#', y cualquier otro carácter no permitido)
===================================== */
function sanitizarParaCloudinary(str) {
    return str
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quita tildes
        .replace(/#/g, "")                                  // quita almohadillas
        .replace(/[^a-zA-Z0-9/_\- ]/g, "")                   // quita cualquier otro carácter inválido
        .trim();
}

/* =====================================
   ADVERTIR SI EL USUARIO INTENTA SALIR MIENTRAS SUBE
===================================== */
window.addEventListener("beforeunload", (e) => {
    if (subidaEnCurso) {
        e.preventDefault();
        e.returnValue = "";
    }
});

/* =====================================
   CARGAR PARTICIPANTES (para carrera + nombre)
===================================== */
async function cargarParticipantes() {
    const snap = await getDocs(collection(db, "participantes"));
    participantesData = [];
    snap.forEach(doc => participantesData.push(doc.data()));
    const grados = [...new Set(participantesData.map(p => p.grado))].sort();
    selectGrado.innerHTML = `<option value="">Seleccione carrera</option>`;
    grados.forEach(grado => {
        selectGrado.innerHTML += `<option value="${grado}">${grado}</option>`;
    });
}

selectGrado.addEventListener("change", () => {
    const grado = selectGrado.value;
    selectParticipante.innerHTML = `<option value="">Seleccione participante</option>`;
    if (!grado) return;
    const filtrados = participantesData
        .filter(p => p.grado === grado)
        .sort((a, b) => a.numero - b.numero);
    filtrados.forEach(p => {
        selectParticipante.innerHTML += `<option value="${p.nombre}">${p.nombre}</option>`;
    });
});

/* =====================================
   CARGAR CURSOS DINÁMICOS (igual que categorías en punteos)
===================================== */
async function cargarCursos() {
    const snap = await getDocs(collection(db, "cursos"));
    selectCurso.innerHTML = `<option value="">Seleccione curso</option>`;
    selectFiltroCurso.innerHTML = `<option value="">Seleccione curso para ver tareas</option>`;
    cursosData = [];
    snap.forEach(doc => {
        const data = doc.data();
        // fechaLimite se guarda como Firestore Timestamp; lo convertimos a Date
        const fechaLimite = data.fechaLimite?.toDate ? data.fechaLimite.toDate() : null;
        cursosData.push({ nombre: data.nombre, fechaLimite });
        selectCurso.innerHTML += `<option value="${data.nombre}">${data.nombre}</option>`;
        selectFiltroCurso.innerHTML += `<option value="${data.nombre}">${data.nombre}</option>`;
    });
}

window.agregarCurso = async function () {
    const input = document.getElementById("nuevoCurso");
    const inputFecha = document.getElementById("nuevaFechaLimite");
    const inputHora = document.getElementById("nuevaHoraLimite");
    const nombre = input.value.trim();
    const fecha = inputFecha.value; // "YYYY-MM-DD"
    const hora = inputHora.value;   // "HH:MM"
    if (!nombre) {
        alert("Escriba el nombre del curso");
        return;
    }
    // La fecha y hora límite son opcionales, pero si se indica una, se pide la otra
    let fechaLimiteTimestamp = null;
    if (fecha || hora) {
        if (!fecha || !hora) {
            alert("Indique tanto la fecha como la hora máxima de entrega");
            return;
        }
        const fechaLimiteDate = new Date(`${fecha}T${hora}`);
        if (isNaN(fechaLimiteDate.getTime())) {
            alert("La fecha u hora ingresadas no son válidas");
            return;
        }
        fechaLimiteTimestamp = Timestamp.fromDate(fechaLimiteDate);
    }
    try {
        const cursoDoc = { nombre };
        if (fechaLimiteTimestamp) {
            cursoDoc.fechaLimite = fechaLimiteTimestamp;
        }
        await addDoc(collection(db, "cursos"), cursoDoc);
        input.value = "";
        inputFecha.value = "";
        inputHora.value = "";
        await cargarCursos();
        alert("Curso agregado correctamente");
    } catch (error) {
        console.error(error);
        alert("Error al agregar el curso");
    }
};

/* =====================================
   MOSTRAR / VALIDAR FECHA LÍMITE DEL CURSO
===================================== */
function obtenerCursoSeleccionado() {
    return cursosData.find(c => c.nombre === selectCurso.value) || null;
}

function actualizarLimiteCurso() {
    const curso = obtenerCursoSeleccionado();
    if (!curso || !curso.fechaLimite) {
        limiteCurso.textContent = "";
        limiteCurso.className = "limite-curso";
        return;
    }
    const formato = curso.fechaLimite.toLocaleString("es-GT", {
        dateStyle: "medium",
        timeStyle: "short"
    });
    if (new Date() > curso.fechaLimite) {
        limiteCurso.textContent = `Fecha límite: ${formato} (¡ya venció!)`;
        limiteCurso.className = "limite-curso vencido";
    } else {
        limiteCurso.textContent = `Fecha límite: ${formato}`;
        limiteCurso.className = "limite-curso ok";
    }
}

selectCurso.addEventListener("change", actualizarLimiteCurso);

/* =====================================
   SUBIR PDF A CLOUDINARY (con barra de progreso real vía XHR)
   Incluye reintentos automáticos ante fallos de red o timeout.
===================================== */
function intentoSubidaUnica(archivo, carpeta, onProgreso) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append("file", archivo);
        formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
        formData.append("folder", carpeta);
        // Los PDF se suben como "raw" en Cloudinary (no son imagen ni video)
        formData.append("resource_type", "raw");
        const xhr = new XMLHttpRequest();
        xhr.open(
            "POST",
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`
        );
        xhr.timeout = 60000; // 60 segundos máximo por intento
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgreso) {
                onProgreso((e.loaded / e.total) * 100);
            }
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText));
            } else {
                reject(new Error(`Error de Cloudinary: ${xhr.status} ${xhr.responseText}`));
            }
        };
        xhr.onerror = () => reject(new Error("Error de red al subir el archivo"));
        xhr.ontimeout = () => reject(new Error("La subida tardó demasiado (tiempo agotado)"));
        xhr.send(formData);
    });
}

async function subirACloudinary(archivo, carpeta, onProgreso, onReintento) {
    const MAX_INTENTOS = 3;
    let ultimoError;
    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
        try {
            return await intentoSubidaUnica(archivo, carpeta, onProgreso);
        } catch (error) {
            ultimoError = error;
            console.warn(`Intento ${intento} de ${MAX_INTENTOS} falló:`, error.message);
            // Solo reintentamos si es un error de red o de tiempo agotado,
            // no si es un error de validación de Cloudinary (400, etc.)
            const esErrorDeRed =
                error.message.includes("red") || error.message.includes("tiempo agotado");
            if (!esErrorDeRed || intento === MAX_INTENTOS) {
                throw ultimoError;
            }
            if (onReintento) onReintento(intento + 1, MAX_INTENTOS);
            // Esperar un poco antes de reintentar (1s, luego 2s)
            await new Promise(r => setTimeout(r, intento * 1000));
        }
    }
}

/* =====================================
   REGISTRAR ERROR EN FIRESTORE (para diagnóstico)
===================================== */
async function registrarError({ error, grado, nombre, curso, archivo }) {
    try {
        const infoRed = obtenerInfoRed();
        await addDoc(collection(db, "errores"), {
            mensaje: error.message,
            grado: grado || null,
            nombre: nombre || null,
            curso: curso || null,
            archivoNombre: archivo?.name || "desconocido",
            archivoTamanoMB: archivo ? (archivo.size / (1024 * 1024)).toFixed(2) : null,
            userAgent: navigator.userAgent,
            idioma: navigator.language,
            conexion: infoRed.tipoConexion,
            ahorroDatos: infoRed.ahorroDatos,
            velocidadMbps: infoRed.velocidadMbps,
            rttMs: infoRed.rttMs,
            enLinea: infoRed.enLinea,
            fecha: serverTimestamp()
        });
    } catch (errorGuardado) {
        // Si falla el guardado del error, solo lo dejamos en consola
        console.error("No se pudo guardar el error en Firestore:", errorGuardado);
    }
}

/* =====================================
   SUBIR TAREA (PDF vía Cloudinary + metadatos en Firestore)
===================================== */
form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const grado = selectGrado.value;
    const nombre = selectParticipante.value;
    const curso = selectCurso.value;
    const archivo = inputArchivo.files[0];

    if (!grado || !nombre || !curso) {
        alert("Complete carrera, participante y curso");
        return;
    }
    if (!archivo) {
        alert("Seleccione un archivo");
        return;
    }

    // Verificar conexión a internet antes de intentar subir
    if (!navigator.onLine) {
        alert("Tu dispositivo no tiene conexión a internet en este momento. Verifica tu Wi-Fi o datos móviles e intenta de nuevo.");
        return;
    }

    const cursoSeleccionado = obtenerCursoSeleccionado();
    if (cursoSeleccionado?.fechaLimite && new Date() > cursoSeleccionado.fechaLimite) {
        const formato = cursoSeleccionado.fechaLimite.toLocaleString("es-GT", {
            dateStyle: "medium",
            timeStyle: "short"
        });
        alert(`Ya no se puede subir esta tarea. La fecha límite era: ${formato}`);
        return;
    }

    if (archivo.type !== "application/pdf") {
        alert("El archivo debe ser un PDF");
        return;
    }

    const MAX_TAMANO_MB = 10;
    const MAX_TAMANO_BYTES = MAX_TAMANO_MB * 1024 * 1024;
    if (archivo.size > MAX_TAMANO_BYTES) {
        const tamanoMB = (archivo.size / (1024 * 1024)).toFixed(1);
        alert(
            `El archivo pesa ${tamanoMB} MB y el límite es ${MAX_TAMANO_MB} MB.\n\n` +
            `Comprime el PDF antes de subirlo (por ejemplo en https://www.ilovepdf.com/compress_pdf) e inténtalo de nuevo.`
        );
        return;
    }

    if (
        CLOUDINARY_CLOUD_NAME === "TU_CLOUD_NAME" ||
        CLOUDINARY_UPLOAD_PRESET === "TU_UPLOAD_PRESET"
    ) {
        alert(
            "Falta configurar Cloudinary en js/tareas.js (CLOUDINARY_CLOUD_NAME y CLOUDINARY_UPLOAD_PRESET)"
        );
        return;
    }

    barraProgreso.style.display = "block";
    progreso.style.width = "0%";
    mensajeEstado.textContent = "Subiendo... No cierres esta pantalla ni bloquees el dispositivo";
    subidaEnCurso = true;

    try {
        const carpeta = `tareas/${sanitizarParaCloudinary(grado)}/${sanitizarParaCloudinary(curso)}`;
        const resultado = await subirACloudinary(
            archivo,
            carpeta,
            (pct) => {
                progreso.style.width = `${pct}%`;
            },
            (intento, maxIntentos) => {
                mensajeEstado.textContent = `Conexión inestable, reintentando (${intento}/${maxIntentos})... No cierres esta pantalla`;
            }
        );

        mensajeEstado.textContent = "Guardando en la base de datos...";
        await addDoc(collection(db, "tareas"), {
            nombre,
            grado,
            curso,
            archivoNombre: archivo.name,
            url: resultado.secure_url,
            publicId: resultado.public_id,
            fecha: serverTimestamp()
        });

        mensajeEstado.textContent = "Tarea subida correctamente";
        subidaEnCurso = false;
        setTimeout(() => {
            barraProgreso.style.display = "none";
            progreso.style.width = "0%";
        }, 800);
        form.reset();
        selectParticipante.innerHTML = `<option value="">Seleccione participante</option>`;
    } catch (error) {
        console.error(error);
        const infoRed = obtenerInfoRed();
        const pareceProblemaDeRed = error.message.includes("red") || error.message.includes("tiempo agotado");
        if (pareceProblemaDeRed && infoRed.ahorroDatos) {
            mensajeEstado.textContent =
                `Error: ${error.message}. Tu teléfono tiene 'Ahorro de datos' activado en Chrome, ` +
                `lo cual suele causar justamente este tipo de falla. Desactívalo en Chrome → ⋮ → ` +
                `Configuración → Ahorro de datos, y vuelve a intentar.`;
        } else {
            mensajeEstado.textContent = `Error: ${error.message}`;
        }
        barraProgreso.style.display = "none";
        subidaEnCurso = false;
        // Guardar el error en Firestore para poder diagnosticarlo después
        await registrarError({ error, grado, nombre, curso, archivo });
    }
});

/* =====================================
   VER TAREAS SUBIDAS (filtradas por curso)
===================================== */
window.verTareas = async function () {
    const curso = selectFiltroCurso.value;
    if (!curso) {
        alert("Seleccione un curso");
        return;
    }
    // Solo filtramos por curso (no requiere índice compuesto).
    // El orden por fecha lo hacemos en el cliente para evitar
    // depender de crear índices en Firestore.
    const q = query(
        collection(db, "tareas"),
        where("curso", "==", curso)
    );
    const snap = await getDocs(q);
    let docs = [];
    snap.forEach(doc => docs.push(doc.data()));
    // Ordenar por fecha descendente (más reciente primero).
    // fecha es un Firestore Timestamp (tiene .toMillis()); si por
    // alguna razón aún no se ha guardado (serverTimestamp pendiente),
    // lo tratamos como el más antiguo.
    docs.sort((a, b) => {
        const ta = a.fecha?.toMillis ? a.fecha.toMillis() : 0;
        const tb = b.fecha?.toMillis ? b.fecha.toMillis() : 0;
        return tb - ta;
    });
    let html = "";
    docs.forEach(d => {
        html += `
            <div class="item-tarea">
                <h3>${d.nombre}</h3>
                <p>${d.grado}</p>
                <!--
                <a href="${d.url}" target="_blank" rel="noopener">
                    <button type="button">Ver / Descargar PDF</button>
                </a>
                -->
            </div>
        `;
    });
    if (!html) {
        html = "<p>No hay tareas subidas para este curso</p>";
    }
    listaTareas.innerHTML = html;
};

/* =====================================
   VER ERRORES REGISTRADOS (para diagnóstico)
   Ejecuta verErrores() desde la consola del navegador para revisarlos.
===================================== */
window.verErrores = async function () {
    const snap = await getDocs(collection(db, "errores"));
    let docs = [];
    snap.forEach(doc => docs.push(doc.data()));
    docs.sort((a, b) => {
        const ta = a.fecha?.toMillis ? a.fecha.toMillis() : 0;
        const tb = b.fecha?.toMillis ? b.fecha.toMillis() : 0;
        return tb - ta;
    });
    console.table(docs.map(d => ({
        fecha: d.fecha?.toDate ? d.fecha.toDate().toLocaleString("es-GT") : "sin fecha",
        nombre: d.nombre,
        curso: d.curso,
        mensaje: d.mensaje,
        archivo: d.archivoNombre,
        tamanoMB: d.archivoTamanoMB,
        conexion: d.conexion,
        ahorroDatos: d.ahorroDatos ?? "sin dato",
        velocidadMbps: d.velocidadMbps ?? "sin dato",
        dispositivo: d.userAgent
    })));
    return docs;
};

/* =====================================
   INICIALIZAR
===================================== */
cargarParticipantes();
cargarCursos();
