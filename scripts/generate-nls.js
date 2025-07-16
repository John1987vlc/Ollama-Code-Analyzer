// scripts/generate-nls.js
const { readFile, writeFile } = require('fs/promises');
const { resolve } = require('path');

async function generateNls() {
  try {
    console.log('Generando archivos NLS para localización...');

    // Usamos __dirname, que está disponible en CommonJS, para obtener la ruta correcta
    const localesFile = resolve(__dirname, '..', 'src', 'internationalization', 'locales.json');
    const content = await readFile(localesFile, 'utf-8');
    const allTranslations = JSON.parse(content);

    if (!allTranslations.en || !allTranslations.es) {
      throw new Error('El archivo locales.json no contiene las claves "en" y "es".');
    }

    const projectRoot = resolve(__dirname, '..');

    // Crear el archivo principal package.nls.json (inglés por defecto) en la raíz del proyecto
    const defaultNlsPath = resolve(projectRoot, 'package.nls.json');
    await writeFile(defaultNlsPath, JSON.stringify(allTranslations.en, null, 2));
    console.log(`Archivo generado: ${defaultNlsPath}`);

    // Crear el archivo de localización para español en la raíz del proyecto
    const esNlsPath = resolve(projectRoot, 'package.nls.es.json');
    await writeFile(esNlsPath, JSON.stringify(allTranslations.es, null, 2));
    console.log(`Archivo generado: ${esNlsPath}`);

    console.log('Archivos NLS generados correctamente.');
  } catch (error) {
    console.error('Error generando los archivos NLS:', error);
    process.exit(1);
  }
}

generateNls();