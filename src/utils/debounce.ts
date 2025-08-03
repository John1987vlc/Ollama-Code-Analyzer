/**
 * @file Contiene una función de utilidad `debounce`.
 * Se utiliza para retrasar la ejecución de una función hasta que haya
 * transcurrido un tiempo determinado sin que se vuelva a llamar,
 * optimizando eventos frecuentes como el tecleo del usuario.
 */

/**
 * Crea una versión "debounced" de una función que retrasa su invocación
 * hasta que haya pasado un tiempo determinado sin que se llame de nuevo.
 * * Es ideal para eventos que se disparan rápidamente, como `onDidChangeTextDocument`.
 * * @param func La función a la que se le aplicará el debounce.
 * @param delay El tiempo en milisegundos a esperar antes de ejecutar la función.
 * @returns La nueva función con debounce aplicado.
 */
export function debounce<T extends (...args: any[]) => void>(func: T, delay: number): T {
    let timeoutId: NodeJS.Timeout | undefined;

    return function(this: any, ...args: Parameters<T>) {
        // Si ya hay un temporizador en marcha, se cancela.
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        // Se establece un nuevo temporizador.
        timeoutId = setTimeout(() => {
            // Se ejecuta la función original con el contexto y argumentos correctos.
            func.apply(this, args);
        }, delay);
    } as T;
}