// ================================================================= //
//        Archivo de Prueba para Ollama Code Analyzer                //
// ================================================================= //
// Este archivo está diseñado para probar todas las funcionalidades   //
// de la extensión. Sigue las instrucciones en los comentarios        //
// para ejecutar cada prueba.                                         //
// ================================================================= //

// --- PRUEBA 1: Generar código desde comentario ---
// Instrucciones:
// 1. Coloca el cursor en la línea de abajo que empieza por '///'.
// 2. Abre la paleta de comandos (Ctrl+Shift+P).
// 3. Ejecuta "Gemma3n Analysis: Generar código desde comentario (///, #, /*...*/)".
// Resultado esperado: La extensión debería generar una función que valide un email.

/// Crea una función que verifique si una cadena es un email válido usando una expresión regular.

// --- PRUEBA 2: Explicar código seleccionado ---
// Instrucciones:
// 1. Selecciona la función 'calculateFactorial' completa (incluyendo el comentario).
// 2. Haz clic derecho y ve a "Gemma3n Analysis" > "Explicar código seleccionado".
// Resultado esperado: Una webview debería abrirse explicando qué hace la función.

/**
 * Calcula el factorial de un número usando recursividad.
 * @param {number} n - El número para calcular el factorial.
 * @returns {number} El factorial de n.
 */
function calculateFactorial(n) {
  if (n < 0) {
    return -1; // Factorial no definido para negativos
  } else if (n === 0) {
    return 1;
  } else {
    return n * calculateFactorial(n - 1);
  }
}

// --- PRUEBA 3: Generar prueba unitaria ---
// Instrucciones:
// 1. Selecciona la función 'calculateFactorial' de nuevo.
// 2. Haz clic derecho y ve a "Gemma3n Analysis" > "Generar prueba unitaria".
// Resultado esperado: Una webview con el código de una prueba unitaria para la función.

// --- PRUEBA 4: Proponer refactorización inteligente ---
// Instrucciones:
// 1. Selecciona la función 'getUserInfo'.
// 2. Haz clic derecho y ve a "Gemma3n Analysis" > "Proponer refactorización inteligente".
// Resultado esperado: La IA debería sugerir una versión más moderna o eficiente de la función,
//                     posiblemente usando async/await y desestructuración.

function getUserInfo(userId) {
  fetch(`https://api.example.com/users/${userId}`)
    .then(function (response) {
      return response.json();
    })
    .then(function (data) {
      console.log("Name: " + data.name);
      console.log("Email: " + data.email);
    })
    .catch(function (error) {
      console.log("Error fetching data");
    });
}

// --- PRUEBA 5: Detectar lógica duplicada ---
// Instrucciones:
// 1. No selecciones nada.
// 2. Abre la paleta de comandos (Ctrl+Shift+P).
// 3. Ejecuta "Gemma3n Analysis: Detectar lógica duplicada".
// Resultado esperado: La IA debería identificar que 'processStandard' y 'processPremium'
//                     son casi idénticas y sugerir una unificación.

function processStandard(items) {
  const tax = 1.21;
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price * tax;
  }
  console.log("Standard total:", total);
  return total;
}

function processPremium(items) {
  const tax = 1.21;
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price * tax;
  }
  console.log("Premium total:", total);
  return total;
}

// --- PRUEBA 6: Analizar Documento Actual y Validar estándares ---
// Instrucciones:
// 1. No selecciones nada.
// 2. Abre la paleta de comandos (Ctrl+Shift+P).
// 3. Ejecuta "Gemma3n Analysis: Analizar Documento Actual".
// 4. Después, ejecuta "Gemma3n Analysis: Validar estándares de empresa".
// Resultado esperado: Ambas acciones deberían abrir una webview con un análisis.
//                     Se espera que señale el uso de 'var' en la línea de abajo como una mala práctica.

var legacyVariable = "No debería usarse 'var'";

// --- PRUEBA 7: Generar Diagrama UML del proyecto ---
// Instrucciones:
// 1. Asegúrate de tener varios archivos .js en tu proyecto (puedes copiar este varias veces).
// 2. Abre la paleta de comandos (Ctrl+Shift+P).
// 3. Ejecuta "Gemma3n Analysis: Generar Diagrama UML del proyecto".
// Resultado esperado: Se abrirá una webview mostrando el progreso del análisis de archivos
//                     y al final mostrará un diagrama PlantUML de las clases y funciones.

class ComponentA {
  constructor() {
    this.b = new ComponentB();
  }
}

class ComponentB {
  doSomething() {}
}