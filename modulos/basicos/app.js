let dataGlobal = [];

fetch('data/basicos_completo_OK.json')
  .then(res => res.json())
  .then(data => {
    dataGlobal = data;
    mostrarAparatos();
  });

function mostrarAparatos() {
  const cont = document.getElementById("contenido");
  const aparatos = [...new Set(dataGlobal.map(d => d.aparato))];

  let html = "";
  for (let i = 0; i < aparatos.length; i++) {
    html += `<button onclick="mostrarDificultad('${aparatos[i]}')">${aparatos[i]}</button>`;
  }

  cont.innerHTML = html;
}

function mostrarDificultad(aparato) {
  const cont = document.getElementById("contenido");
  const dificultades = ["A","B","C","D"];

  let html = "<h2>" + aparato + "</h2>";

  for (let i = 0; i < dificultades.length; i++) {
    html += `<button onclick="mostrarTabla('${aparato}','${dificultades[i]}')">${dificultades[i]}</button>`;
  }

  html += "<br><br><button onclick='mostrarAparatos()'>⬅ Volver</button>";

  cont.innerHTML = html;
}

function mostrarTabla(aparato, dificultad) {
  const cont = document.getElementById("contenido");

  const elementos = dataGlobal
    .filter(d => d.aparato === aparato && d.dificultad === dificultad)
    .sort((a,b) => a.orden - b.orden);

  let html = "<h2>" + aparato + " - " + dificultad + "</h2>";

  if (elementos.length === 0) {
    html += "<p>No hay elementos aún</p>";
  } else {
    html += "<table>";
    for (let i = 0; i < elementos.length; i++) {
      html += "<tr><td>" + elementos[i].orden + "</td><td>" + elementos[i].elemento + "</td></tr>";
    }
    html += "</table>";
  }

  html += `<br><button onclick="mostrarDificultad('${aparato}')">⬅ Volver</button>`;

  cont.innerHTML = html;
}
