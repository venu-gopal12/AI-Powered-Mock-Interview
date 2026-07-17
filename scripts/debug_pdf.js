const pdf = require('pdf-parse');
// Quick inspection script for checking what pdf-parse exports in this runtime.
console.log("Type of pdf:", typeof pdf);
console.log("Is pdf a function?", typeof pdf === 'function');
console.log("Exports:", pdf);
