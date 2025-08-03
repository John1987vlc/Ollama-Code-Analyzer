const plantuml = require('node-plantuml');
const fs = require('fs');

console.log('Attempting to generate a test UML diagram to trigger JAR download...');

const puml = `@startuml
test -> test
@enduml`;

const gen = plantuml.generate(puml, { format: 'svg' });

let svg = '';
gen.out.on('data', (chunk) => {
    svg += chunk.toString();
});

gen.out.on('end', () => {
    console.log('Test diagram generation finished.');
    if (svg.length > 0) {
        console.log('Success! plantuml.jar should now be downloaded.');
    } else {
        console.error('Failure: No SVG was generated. The JAR might not have been downloaded.');
    }
});

gen.out.on('error', (err) => {
    console.error('Error during test generation:', err);
});
