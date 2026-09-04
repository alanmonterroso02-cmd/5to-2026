import { db } from "./firebase-config.js";
import {
    collection,
    getDocs,
    addDoc,
    doc,
    setDoc,
    query,
    where,
    serverTimestamp,
    Timestamp
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

/* =====================================
   CONFIGURACIÓN DE GOOGLE DRIVE (vía Google Apps Script)
   Pega aquí la URL que te da Google al publicar el script como
   "Aplicación web" (Deploy > New deployment > Web app).
===================================== */
const DRIVE_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxbar-ZQxZ0mJShsIdFeTVrs7KV9fLGWmFzGSGZBp_6teVd91jl9prShhuMfngbi0_x/exec";

const selectGrado = document.getElementById("grado");
const selectParticipante = document.getElementById("participante");
const selectCurso = document.getElementById("curso");
const selectFiltroCurso = document.getElementById("filtroCurso");
const inputArchivo = document.getElementById("archivo");
const limiteCurso = document.getElementById("limiteCurso");
const form = document.getElementById("formTarea");
// Botón de envío del formulario. Lo usamos para deshabilitarlo mientras
// la subida está en curso y así evitar que el usuario lo presione varias veces.
const botonSubir = form.querySelector('button[type="submit"]');
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
   subidas de archivos grandes en general.
   Aquí solo avisamos (no bloqueamos), para no impedir subir a nadie.
===================================== */
function advertirSiAhorroDatos(archivo) {
    const info = obtenerInfoRed();

    if (info.ahorroDatos) {
        mensajeEstado.textContent =
            "Detectamos que tu teléfono tiene activado el 'Ahorro de datos' en Chrome. " +
            "Esto a veces interfiere con la subida de archivos. Si falla, prueba " +
            "desactivándolo en Chrome → ⋮ → Configuración → Ahorro de datos.";
        mensajeEstado.className = "aviso-ahorro-datos";
        return info;
    }

    // Señal débil: Chrome a veces etiqueta la conexión como "4g" por el tipo de
    // radio aunque la velocidad real medida (downlink) sea muy baja. Combinamos
    // ambas señales en vez de confiar solo en "effectiveType".
    const senalDebil = info.velocidadMbps !== null && info.velocidadMbps < 1.5;
    const efectivoLento = ["slow-2g", "2g", "3g"].includes(info.tipoConexion);
    if (senalDebil || efectivoLento) {
        const archivoGrandeMB = archivo ? archivo.size / (1024 * 1024) : 0;
        let mensaje =
            "Tu señal de internet está débil o inestable en este momento. La subida puede " +
            "tardar más o fallar a la mitad. Si puedes, conéctate a Wi-Fi o acércate a una " +
            "zona con mejor señal antes de subir el archivo.";
        if (archivoGrandeMB > 3) {
            mensaje += ` Tu archivo pesa ${archivoGrandeMB.toFixed(1)} MB, lo cual con esta señal ` +
                `tiene más riesgo de fallar; si puedes comprimirlo primero, mejor.`;
        }
        mensajeEstado.textContent = mensaje;
        mensajeEstado.className = "aviso-senal-debil";
    }

    return info;
}

// Revisamos apenas el usuario elige un archivo, para avisar antes de que intente subir
inputArchivo?.addEventListener("change", () => {
    if (inputArchivo.files[0]) {
        advertirSiAhorroDatos(inputArchivo.files[0]);
    }
});

/* =====================================
   SANITIZAR TEXTO PARA USAR COMO NOMBRE DE CARPETA
   (quita tildes, '#', y cualquier otro carácter no permitido)
===================================== */
function sanitizarNombre(str) {
    return str
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quita tildes
        .replace(/#/g, "")                                  // quita almohadillas
        .replace(/[^a-zA-Z0-9/_\- ]/g, "")                   // quita cualquier otro carácter inválido
        .trim();
}

/* =====================================
   CONSTRUIR UN ID DE DOCUMENTO LEGIBLE PARA FIRESTORE
   (en vez del ID aleatorio que genera addDoc). Junta curso + nombre del
   alumno sin espacios ni tildes, ej: "Matematica_JuanPerez".
   Si el mismo alumno vuelve a subir tarea para el mismo curso, esto
   sobrescribe su entrega anterior en vez de crear una nueva (se
   considera la entrega más reciente).
===================================== */
function idDocumentoTarea(curso, nombre) {
    const limpiar = (str) =>
        str
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quita tildes
            .replace(/[^a-zA-Z0-9]/g, "");                     // deja solo letras/números
    return `${limpiar(curso)}_${limpiar(nombre)}`;
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
   CONVERTIR ARCHIVO A BASE64 (necesario para enviarlo al Apps Script,
   que solo puede recibir texto en el cuerpo de la petición)
===================================== */
function archivoABase64(archivo) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // reader.result es algo como "data:application/pdf;base64,JVBERi0x..."
            // solo nos interesa la parte después de la coma
            const base64 = reader.result.split(",")[1];
            resolve(base64);
        };
        reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
        reader.readAsDataURL(archivo);
    });
}

/* =====================================
   SUBIR PDF A GOOGLE DRIVE (vía Google Apps Script)
   IMPORTANTE: aquí usamos fetch normal (SIN "no-cors") para poder LEER
   la respuesta del servidor (url, id, name). Esto funciona sin
   problemas de CORS porque:
   - El Content-Type es "text/plain", que no dispara "preflight" (OPTIONS).
   - Un Apps Script Web App publicado con acceso "Cualquier usuario"
     responde con los headers CORS necesarios para que el navegador
     nos deje leer el cuerpo de la respuesta.
   Si en el futuro cambias el Content-Type a "application/json" sí
   podría dispararse un preflight que Apps Script no maneja bien;
   por eso se deja como "text/plain" a propósito.
===================================== */
function subirADriveUnaVez(archivo, grado, curso, base64, timeoutMs) {
    const controlador = new AbortController();
    const timer = setTimeout(() => controlador.abort(), timeoutMs);

    const cuerpo = JSON.stringify({
        grado,
        curso,
        archivoNombre: archivo.name,
        mimeType: archivo.type || "application/pdf",
        base64
    });

    return fetch(DRIVE_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: cuerpo,
        signal: controlador.signal
    })
        .then(async (res) => {
            clearTimeout(timer);
            let datos;
            try {
                datos = await res.json();
            } catch (parseError) {
                throw new Error("Respuesta inválida del servidor de Drive");
            }
            if (!datos.ok) {
                throw new Error(datos.error || "El servidor de Drive reportó un error");
            }
            return datos; // { ok: true, url, id, name }
        })
        .catch((error) => {
            clearTimeout(timer);
            if (error.name === "AbortError") {
                throw new Error("La subida tardó demasiado (tiempo agotado)");
            }
            // Si el error ya tiene un mensaje propio (ej. el que lanzamos arriba
            // por "datos.ok === false" o JSON inválido), lo dejamos pasar tal cual.
            if (error.message && error.message !== "Failed to fetch") {
                throw error;
            }
            throw new Error("Error de red al subir el archivo");
        });
}

async function subirADrive(archivo, grado, curso, onProgreso, onReintento) {
    const MAX_INTENTOS = 3;
    let ultimoError;
    const base64 = await archivoABase64(archivo);

    // Timeout adaptativo: 60s base + tiempo extra según el tamaño del archivo,
    // asumiendo una subida lenta de ~0.5 Mbps (peor caso realista en el aula).
    const MBPS_MINIMO_ASUMIDO = 0.5;
    const segundosEstimados = (archivo.size * 8) / (MBPS_MINIMO_ASUMIDO * 1024 * 1024);
    const timeoutMs = Math.max(60000, Math.ceil(segundosEstimados * 1000) + 30000);

    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
        // Progreso simulado: fetch normal tampoco expone bytes enviados de
        // forma sencilla para subidas, así que avanzamos la barra hasta 90%
        // durante el tiempo estimado y la completamos al 100% cuando la
        // petición termina.
        let detenerAnimacion = false;
        if (onProgreso) {
            const inicio = Date.now();
            const duracionEstimadaMs = Math.max(segundosEstimados * 1000, 2000);
            const animar = () => {
                if (detenerAnimacion) return;
                const pct = Math.min(90, ((Date.now() - inicio) / duracionEstimadaMs) * 90);
                onProgreso(pct);
                requestAnimationFrame(animar);
            };
            animar();
        }
        try {
            const datos = await subirADriveUnaVez(archivo, grado, curso, base64, timeoutMs);
            detenerAnimacion = true;
            if (onProgreso) onProgreso(100);
            return { url: datos.url, id: datos.id, name: datos.name };
        } catch (error) {
            detenerAnimacion = true;
            ultimoError = error;
            console.warn(`Intento ${intento} de ${MAX_INTENTOS} falló:`, error.message);
            if (intento === MAX_INTENTOS) {
                throw ultimoError;
            }
            if (onReintento) onReintento(intento + 1, MAX_INTENTOS);
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
   SUBIR TAREA (PDF vía Google Drive + metadatos en Firestore)
===================================== */
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Protección contra doble clic / doble envío: si ya hay una subida en
    // curso, ignoramos cualquier intento adicional de enviar el formulario.
    if (subidaEnCurso) {
        return;
    }

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

    const MAX_TAMANO_MB = 100;
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
        !DRIVE_WEBAPP_URL ||
        DRIVE_WEBAPP_URL === "PON_AQUI_LA_URL_DE_TU_APPS_SCRIPT"
    ) {
        alert(
            "Falta configurar la URL de Google Drive en js/tareas.js (DRIVE_WEBAPP_URL)"
        );
        return;
    }

    barraProgreso.style.display = "block";
    progreso.style.width = "0%";
    mensajeEstado.textContent = "Subiendo... No cierres esta pantalla ni bloquees el dispositivo";
    subidaEnCurso = true;
    // Deshabilitamos el botón para que no se pueda presionar de nuevo
    // mientras la subida está en curso.
    if (botonSubir) {
        botonSubir.disabled = true;
        botonSubir.dataset.textoOriginal = botonSubir.dataset.textoOriginal || botonSubir.textContent;
        botonSubir.textContent = "Subiendo...";
    }

    try {
        const resultado = await subirADrive(
            archivo,
            sanitizarNombre(grado),
            sanitizarNombre(curso),
            (pct) => {
                progreso.style.width = `${pct}%`;
            },
            (intento, maxIntentos) => {
                mensajeEstado.textContent = `Conexión inestable, reintentando (${intento}/${maxIntentos})... No cierres esta pantalla`;
            }
        );

        mensajeEstado.textContent = "Guardando en la base de datos...";
        // El ID del documento es "curso_nombreDelAlumno" (legible, sin
        // símbolos aleatorios). Si el alumno ya había subido tarea para
        // este curso, esta entrega reemplaza a la anterior.
        const idDoc = idDocumentoTarea(curso, nombre);
        await setDoc(doc(db, "tareas", idDoc), {
            nombre,
            grado,
            curso,
            archivoNombre: archivo.name,
            url: resultado.url,
            publicId: resultado.id,
            fecha: serverTimestamp()
        });

        mensajeEstado.textContent = "Tarea subida correctamente";
        subidaEnCurso = false;
        if (botonSubir) {
            botonSubir.disabled = false;
            botonSubir.textContent = botonSubir.dataset.textoOriginal || "Subir tarea";
        }
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
        const senalDebil = (infoRed.velocidadMbps !== null && infoRed.velocidadMbps < 1.5) ||
            ["slow-2g", "2g", "3g"].includes(infoRed.tipoConexion);
        if (pareceProblemaDeRed && infoRed.ahorroDatos) {
            mensajeEstado.textContent =
                `Error: ${error.message}. Tu teléfono tiene 'Ahorro de datos' activado en Chrome, ` +
                `lo cual suele causar justamente este tipo de falla. Desactívalo en Chrome → ⋮ → ` +
                `Configuración → Ahorro de datos, y vuelve a intentar.`;
        } else if (pareceProblemaDeRed && senalDebil) {
            mensajeEstado.textContent =
                `Error: ${error.message}. Tu señal de internet estaba débil o inestable ` +
                `(velocidad medida: ${infoRed.velocidadMbps ?? "?"} Mbps). Intenta conectarte a ` +
                `Wi-Fi o buscar mejor señal antes de volver a subir el archivo.`;
        } else {
            mensajeEstado.textContent = `Error: ${error.message}`;
        }
        barraProgreso.style.display = "none";
        subidaEnCurso = false;
        // Reactivamos el botón para que el usuario pueda reintentar tras el error
        if (botonSubir) {
            botonSubir.disabled = false;
            botonSubir.textContent = botonSubir.dataset.textoOriginal || "Subir tarea";
        }
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
                ${d.url
                    ? `<a href="${d.url}" target="_blank" rel="noopener">
                        <button type="button">Ver / Descargar PDF</button>
                    </a>`
                    : `<p><em>Sin link disponible (entrega antigua)</em></p>`
                }
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
