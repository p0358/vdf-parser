import * as VDF from './main.js';
// not: import { VDF } from './main.js';

let test1 = `
very basic
basic
{
    hello world
}
`;

let test1_expect = {
    very: 'basic',
    basic: {
        hello: 'world'
    }
};

let test1_result = VDF.parse(test1);

if (JSON.stringify(test1_result) === JSON.stringify(test1_expect)) {
    console.log("Tests passed");
} else {
    console.log(test1_result);
    console.error("=============\nTests failed!\n=============");
}
