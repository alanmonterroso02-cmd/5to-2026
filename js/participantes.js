import { db } from "./firebase-config.js";

import {
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

  const participantes = [
    //medicina
    {
      numero: 1,
      nombre: "Cabrera Lorenzo Esvin Santiago",
      grado: "Quinto Medicina",
      total: 0
    },
    {
      numero: 2,
      nombre: "Cortéz Hernández Jeferson José Luis",
      grado: "Quinto Medicina",
      total: 0
    },
    {
      numero: 3,
      nombre: "Cristóbal Pérez Lesly Beatriz",
      grado: "Quinto Medicina",
      total: 0
    },
    {
      numero: 4,
      nombre: "Delgado Vicente Noe Michael",
      grado: "Quinto Medicina",
      total: 0
    },
    {
      numero: 5,
      nombre: "Diego Morales Alexis Denilson",
      grado: "Quinto Medicina",
      total: 0
    },
    {
      numero: 6,
      nombre: "García Juárez María Del Carmen",
      grado: "Quinto Medicina",
      total: 0
    },
    {
      numero: 7,
      nombre: "Jiménez Cortéz Yeni Clarisa",
      grado: "Quinto Medicina",
      total: 0
    },
    {
      numero: 8,
      nombre: "Katherin Mishel Ralda Jiménez",
      grado: "Quinto Medicina",
      total: 0
    },
    {
      numero: 9,
      nombre: "Pérez Vaíl Keily Lisbeth",
      grado: "Quinto Medicina",
      total: 0
    },
    {
      numero: 10,
      nombre: "Ramírez Rodríguez Miqueas Emanuel",
      grado: "Quinto Medicina",
      total: 0
    },
    {
      numero: 11,
      nombre: "Reyes Gómez Jorge Geovany",
      grado: "Quinto Medicina",
      total: 0
    },
    {
      numero: 12,
      nombre: "Vásquez Lucas Fernado Ángel",
      grado: "Quinto Medicina",
      total: 0
    },
    {
      numero: 13,
      nombre: "Vásquez Luis Vivian Dayana",
      grado: "Quinto Medicina",
      total: 0
    },
    {
      numero: 14,
      nombre: "Velásquez Cabrera Mynor",
      grado: "Quinto Medicina",
      total: 0
    },
    {
      numero: 15,
      nombre: "Jonatan Margarito",
      grado: "Quinto Medicina",
      total: 0
    },
    //enfermeria
    {
      numero: 1,
      nombre: "Alonzo Pérez Yaquelín Anayeli",
      grado: "Quinto Enfermería",
      total: 0
    },
    {
      numero: 2,
      nombre: "Cabrera López Yuliza",
      grado: "Quinto Enfermería",
      total: 0
    },
    {
      numero: 3,
      nombre: "Camacho López Glendy Lisbeth",
      grado: "Quinto Enfermería",
      total: 0
    },
    {
      numero: 4,
      nombre: "Cortéz Ramos Yeni Carina",
      grado: "Quinto Enfermería",
      total: 0
    },
    {
      numero: 5,
      nombre: "Díaz González Esmeralda Liseth",
      grado: "Quinto Enfermería",
      total: 0
    },
    {
      numero: 6,
      nombre: "Hernández Díaz Sabina Lorenza",
      grado: "Quinto Enfermería",
      total: 0
    },
    {
      numero: 7,
      nombre: "López Vásquez Keily Dayana",
      grado: "Quinto Enfermería",
      total: 0
    },
    {
      numero: 8,
      nombre: "Ortega Pérez Leidy Noemí",
      grado: "Quinto Enfermería",
      total: 0
    },
    {
      numero: 9,
      nombre: "Pérez Vásquez Vilma Daniela",
      grado: "Quinto Enfermería",
      total: 0
    },
    {
      numero: 10,
      nombre: "Rabanales Gómez Neidy Fabiola",
      grado: "Quinto Enfermería",
      total: 0
    },
    //Derecho
    {
      numero: 1,
      nombre: "Marroquín Escobar Karla Andrea",
      grado: "Quinto Derecho",
      total: 0
    },
    {
      numero: 2,
      nombre: "Monterroso Monterroso Beberly Belinda",
      grado: "Quinto Derecho",
      total: 0
    },
    {
      numero: 3,
      nombre: "Reyes Monterroso Mariana Analy",
      grado: "Quinto Derecho",
      total: 0
    },
    {
      numero: 4,
      nombre: "Vásquez Escobar Abraham Santos",
      grado: "Quinto Derecho",
      total: 0
    },
    {
      numero: 5,
      nombre: "Vicente Chile Ashle Mariza",
      grado: "Quinto Derecho",
      total: 0
    },
    //Odontología
    {
      numero: 1,
      nombre: "Díaz Gómez José Mario",
      grado: "Quinto Odontología",
      total: 0
    },
    {
      numero: 2,
      nombre: "Jimenéz Gómez Rolfi Hernan",
      grado: "Quinto Odontología",
      total: 0
    },
    {
      numero: 3,
      nombre: "Méndez Méndez Anderson Hermenegildo",
      grado: "Quinto Odontología",
      total: 0
    },
    {
      numero: 4,
      nombre: "Vásquez Gómez Melvin Gabriel",
      grado: "Quinto Odontología",
      total: 0
    },
    //Quinto Mecánica
    {
      numero: 1,
      nombre: "Alvarez Gantenbein Mario Estuardo",
      grado: "Quinto Mecánica",
      total: 0
    },
    {
      numero: 2,
      nombre: "Calderón Rivera Edison Iván",
      grado: "Quinto Mecánica",
      total: 0
    },
    {
      numero: 3,
      nombre: "Carreto Morales, Néstor Hernán",
      grado: "Quinto Mecánica",
      total: 0
    },
    {
      numero: 4,
      nombre: "Delgado Vicente Elmer David",
      grado: "Quinto Mecánica",
      total: 0
    },
    {
      numero: 5,
      nombre: "Escobar Méndez Isaac Esau",
      grado: "Quinto Mecánica",
      total: 0
    },
    {
      numero: 6,
      nombre: "García Flores, Gilver Francisco Josué",
      grado: "Quinto Mecánica",
      total: 0
    },
    {
      numero: 7,
      nombre: "López Romero Brayan Daniel",
      grado: "Quinto Mecánica",
      total: 0
    },
    {
      numero: 8,
      nombre: "Marroquín Ramírez Wilfrido Daniel",
      grado: "Quinto Mecánica",
      total: 0
    },
    {
      numero: 9,
      nombre: "Monterroso López Víctor Geovany",
      grado: "Quinto Mecánica",
      total: 0
    },
    {
      numero: 10,
      nombre: "Orozco Vásquez Brayan Martín",
      grado: "Quinto Mecánica",
      total: 0
    },
    {
      numero: 11,
      nombre: "Pérez Carreto Denilson Miguel",
      grado: "Quinto Mecánica",
      total: 0
    },
    {
      numero: 12,
      nombre: "Romero López Iberton Alexis",
      grado: "Quinto Mecánica",
      total: 0
    },
    //Quinto Electromecánica
    {
      numero: 1,
      nombre: "Agustín López Oscar Rene",
      grado: "Quinto Electromecánica",
      total: 0
    },
    {
      numero: 2,
      nombre: "Castillo Barrios Brandon Osiel",
      grado: "Quinto Electromecánica",
      total: 0
    },
    //musica
    {
      numero: 1,
      nombre: "López Romero Ester Estefany",
      grado: "Quinto Música",
      total: 0
    },
    //electrisidad
    {
      numero: 1,
      nombre: "López Gabriel Abner Gudiel",
      grado: "Quinto Electricidad",
      total: 0
    },
    {
      numero: 2,
      nombre: "López Romero Andy Leonardo",
      grado: "Quinto Electricidad",
      total: 0
    },
    {
      numero: 3,
      nombre: "Vicente Pérez Domingo Frisly",
      grado: "Quinto Electricidad",
      total: 0
    },
    {
      numero: 4,
      nombre: "Vicente Vicente Axel Aroldo",
      grado: "Quinto Electricidad",
      total: 0
    },
    //diseño grfico
    {
      numero: 1,
      nombre: "Díaz Pérez, Werner Misael",
      grado: "Quinto Diseño Gráfico",
      total: 0
    },
    {
      numero: 2,
      nombre: "Gómez Mejía Geraldine Zulimar",
      grado: "Quinto Diseño Gráfico",
      total: 0
    },
    {
      numero: 3,
      nombre: "Pérez Romero Brailin Geovany",
      grado: "Quinto Diseño Gráfico",
      total: 0
    },
    {
      numero: 4,
      nombre: "Monterroso Rodríguez Dulce Analucia",
      grado: "Quinto Diseño Gráfico",
      total: 0
    },
    //finansas
    {
      numero: 1,
      nombre: "De León Mazariegos Jennifer Anabelly",
      grado: "Quinto Finanzas y Admo",
      total: 0
    },
    {
      numero: 2,
      nombre: "Sac Camacho Eddy Francisco",
      grado: "Quinto Finanzas y Admo",
      total: 0
    },
    {
      numero: 3,
      nombre: "Sergio Gonsales",
      grado: "Quinto Finanzas y Admo",
      total: 0
    },
    {
      numero: 4,
      nombre: "Werner Marokin Diaz",
      grado: "Quinto Finanzas y Admo",
      total: 0
    },
    //electronica
      {
      numero: 1,
      nombre: "Monterroso Gómez Alan Rene",
      grado: "Quinto Electrónica",
      total: 0
    }
];

async function guardarParticipantes() {
  for (const participante of participantes) {
    try {
      await setDoc(
        doc(db, "participantes", `${participante.grado}-${participante.numero}`),
        participante
      );

      console.log("Guardado:", participante.nombre);

    } catch (error) {
      console.error("Error:", error);
    }
  }
}

guardarParticipantes();
